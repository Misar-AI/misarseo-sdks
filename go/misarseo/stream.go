package misarseo

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

// Event is one Server-Sent Events frame from a text/event-stream endpoint.
type Event struct {
	Event string
	Data  any
}

// ParseFrame decodes one frame; ok is false for keep-alive comments and frames
// without an event line.
func ParseFrame(frame string) (Event, bool) {
	var name string
	var data []string
	for _, line := range strings.Split(strings.ReplaceAll(frame, "\r\n", "\n"), "\n") {
		switch {
		case line == "" || strings.HasPrefix(line, ":"):
		case strings.HasPrefix(line, "event:"):
			name = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
		case strings.HasPrefix(line, "data:"):
			data = append(data, strings.TrimLeft(strings.TrimPrefix(line, "data:"), " "))
		}
	}
	if name == "" {
		return Event{}, false
	}
	raw := strings.Join(data, "\n")
	var decoded any = raw
	if raw != "" {
		var v any
		if json.Unmarshal([]byte(raw), &v) == nil {
			decoded = v
		}
	}
	return Event{Event: name, Data: decoded}, true
}

func (c *Client) stream(ctx context.Context, path string, query map[string]string, terminal []string, onEvent func(Event) bool) error {
	req, err := c.newRequest(ctx, http.MethodGet, path, query, nil, "text/event-stream")
	if err != nil {
		return err
	}
	// The stream legitimately stays open for minutes: use a client without the
	// overall timeout and rely on ctx for cancellation.
	streaming := *c.httpClient
	streaming.Timeout = 0
	resp, err := streaming.Do(req)
	if err != nil {
		return &Error{Code: "NETWORK_ERROR", Message: "could not reach the MisarSEO API: " + err.Error()}
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		return errorFromResponse(resp, raw)
	}
	ends := map[string]bool{}
	for _, t := range terminal {
		ends[t] = true
	}
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 64*1024), 4*1024*1024)
	var frame strings.Builder
	flush := func() bool {
		ev, ok := ParseFrame(frame.String())
		frame.Reset()
		if !ok {
			return true
		}
		return onEvent(ev) && !ends[ev.Event]
	}
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			if !flush() {
				return nil
			}
			continue
		}
		frame.WriteString(line)
		frame.WriteString("\n")
	}
	if frame.Len() > 0 {
		flush()
	}
	return scanner.Err()
}
