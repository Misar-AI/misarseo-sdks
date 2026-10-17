// Package misarseo is the Go client for the MisarSEO API at
// https://api.misar.io/seo — keyword research, site audits, rank tracking,
// backlinks, AI search visibility, Search Console, GA4 and Business Profile.
//
// One [Client] reaches every resource as an exported field (client.Projects,
// client.RankTracking, client.AiSearch, …). Calls authenticate with a MisarSEO
// API key (mseo_…) sent as Authorization: Bearer, take a context.Context, and
// return the decoded JSON body. Failures are typed: a plan refusal is a
// [*PlanLimitError] carrying the server's upgrade offer and is never retried;
// everything else is an [*Error] with the API's own code.
package misarseo

import (
	"bytes"
	"context"
	cryptorand "crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Version is the SDK version, sent in the User-Agent header.
const Version = "1.0.0"

// DefaultBaseURL is the public API gateway for MisarSEO.
const DefaultBaseURL = "https://api.misar.io/seo"

// Client is the MisarSEO API client. Create one with [NewClient].
type Client struct {
	Resources

	apiKey         string
	baseURL        string
	httpClient     *http.Client
	maxRetries     int
	retryBaseDelay time.Duration
	maxRetryDelay  time.Duration
}

// Option configures a [Client].
type Option func(*Client)

// WithBaseURL overrides https://api.misar.io/seo.
func WithBaseURL(u string) Option { return func(c *Client) { c.baseURL = strings.TrimRight(u, "/") } }

// WithHTTPClient supplies the *http.Client (timeouts, proxies, transports).
func WithHTTPClient(h *http.Client) Option { return func(c *Client) { c.httpClient = h } }

// WithMaxRetries sets the extra attempts for retryable failures (default 2).
func WithMaxRetries(n int) Option { return func(c *Client) { c.maxRetries = n } }

// WithRetryDelays sets the first backoff step and the cap on any single wait,
// including a server-sent Retry-After (defaults 250ms and 60s).
func WithRetryDelays(base, max time.Duration) Option {
	return func(c *Client) { c.retryBaseDelay, c.maxRetryDelay = base, max }
}

// NewClient builds a client. An empty apiKey falls back to MISARSEO_API_KEY;
// with neither, it returns an error.
func NewClient(apiKey string, opts ...Option) (*Client, error) {
	if apiKey == "" {
		apiKey = os.Getenv("MISARSEO_API_KEY")
	}
	if apiKey == "" {
		return nil, errors.New("misarseo: an API key (mseo_…) is required: pass it or set MISARSEO_API_KEY; see https://seo.misar.io/ai")
	}
	c := &Client{
		apiKey:         apiKey,
		baseURL:        DefaultBaseURL,
		httpClient:     &http.Client{Timeout: 30 * time.Second},
		maxRetries:     2,
		retryBaseDelay: 250 * time.Millisecond,
		maxRetryDelay:  60 * time.Second,
	}
	for _, opt := range opts {
		opt(c)
	}
	c.Resources = newResources(c)
	return c, nil
}

func seg(v string) string { return url.PathEscape(v) }

func merge(required, query map[string]string) map[string]string {
	out := make(map[string]string, len(required)+len(query))
	for k, v := range required {
		out[k] = v
	}
	for k, v := range query {
		out[k] = v
	}
	return out
}

func (c *Client) newRequest(ctx context.Context, method, path string, query map[string]string, body any, accept string) (*http.Request, error) {
	u := c.baseURL + path
	if len(query) > 0 {
		values := url.Values{}
		for k, v := range query {
			values.Set(k, v)
		}
		u += "?" + values.Encode()
	}
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("misarseo: encoding request body: %w", err)
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, u, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", accept)
	req.Header.Set("User-Agent", "misarseo-go/"+Version)
	return req, nil
}

// backoff returns the wait before the next attempt, honouring Retry-After;
// ok is false when the server asked for longer than the configured cap.
func (c *Client) backoff(attempt int, resp *http.Response) (time.Duration, bool) {
	if resp != nil {
		if s, err := strconv.Atoi(strings.TrimSpace(resp.Header.Get("Retry-After"))); err == nil {
			d := time.Duration(s) * time.Second
			return d, d <= c.maxRetryDelay
		}
	}
	base := c.retryBaseDelay << attempt
	if base <= 0 {
		return 0, true
	}
	d := base/2 + time.Duration(jitter(int64(base/2)+1))
	if d > c.maxRetryDelay {
		d = c.maxRetryDelay
	}
	return d, true
}

// jitter returns a uniform value in [0, n). crypto/rand rather than math/rand:
// backoff jitter needs no secrecy, but it costs nothing here and keeps a
// predictable generator out of the client entirely. If the system source ever
// fails, the midpoint is a safe fallback.
func jitter(n int64) int64 {
	if n <= 1 {
		return 0
	}
	v, err := cryptorand.Int(cryptorand.Reader, big.NewInt(n))
	if err != nil {
		return n / 2
	}
	return v.Int64()
}

func sleep(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

// do sends one request with the shared retry policy: 429 retried for every
// verb unless the body says plan_limit_exceeded; 502/503/504 and network
// failures retried for GET only.
func (c *Client) do(ctx context.Context, method, path string, query map[string]string, body any) (any, error) {
	for attempt := 0; ; attempt++ {
		req, err := c.newRequest(ctx, method, path, query, body, "application/json")
		if err != nil {
			return nil, err
		}
		resp, err := c.httpClient.Do(req)
		if err != nil {
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			if method == http.MethodGet && attempt < c.maxRetries {
				d, _ := c.backoff(attempt, nil)
				if serr := sleep(ctx, d); serr != nil {
					return nil, serr
				}
				continue
			}
			return nil, &Error{Status: 0, Code: "NETWORK_ERROR", Message: "could not reach the MisarSEO API: " + err.Error()}
		}
		raw, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			return nil, &Error{Status: resp.StatusCode, Code: "NETWORK_ERROR", Message: readErr.Error()}
		}
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return decode(raw), nil
		}
		apiErr := errorFromResponse(resp, raw)
		var planErr *PlanLimitError
		retryable := resp.StatusCode == 429 ||
			(method == http.MethodGet && (resp.StatusCode == 502 || resp.StatusCode == 503 || resp.StatusCode == 504))
		if errors.As(apiErr, &planErr) || !retryable || attempt >= c.maxRetries {
			return nil, apiErr
		}
		d, ok := c.backoff(attempt, resp)
		if !ok {
			return nil, apiErr
		}
		if serr := sleep(ctx, d); serr != nil {
			return nil, serr
		}
	}
}

func decode(raw []byte) any {
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil
	}
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		return string(raw)
	}
	return v
}
