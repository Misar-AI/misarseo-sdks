package misarseo_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Misar-AI/misarseo-sdks/go/misarseo"
)

type manifestMethod struct {
	Name          string   `json:"name"`
	Verb          string   `json:"verb"`
	Path          string   `json:"path"`
	PathParams    []string `json:"pathParams"`
	RequiredQuery []string `json:"requiredQuery"`
	HasBody       bool     `json:"hasBody"`
}

type manifest struct {
	Resources map[string]struct {
		Methods []manifestMethod `json:"methods"`
	} `json:"resources"`
}

type reply struct {
	status  int
	body    string
	headers map[string]string
}

type recorder struct {
	mu      sync.Mutex
	replies []reply
	calls   []*http.Request
	bodies  []string
}

func (r *recorder) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	r.mu.Lock()
	raw, _ := io.ReadAll(req.Body)
	r.calls = append(r.calls, req)
	r.bodies = append(r.bodies, string(raw))
	i := len(r.calls) - 1
	if i >= len(r.replies) {
		i = len(r.replies) - 1
	}
	rep := r.replies[i]
	r.mu.Unlock()
	for k, v := range rep.headers {
		w.Header().Set(k, v)
	}
	w.WriteHeader(rep.status)
	_, _ = io.WriteString(w, rep.body)
}

func setup(t *testing.T, replies ...reply) (*misarseo.Client, *recorder) {
	t.Helper()
	if len(replies) == 0 {
		replies = []reply{{status: 200, body: `{"ok":true}`}}
	}
	rec := &recorder{replies: replies}
	srv := httptest.NewServer(rec)
	t.Cleanup(srv.Close)
	c, err := misarseo.NewClient("mseo_test", misarseo.WithBaseURL(srv.URL+"/seo"), misarseo.WithRetryDelays(time.Millisecond, 50*time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}
	return c, rec
}

func pascal(s string) string { return strings.ToUpper(s[:1]) + s[1:] }

func TestEveryManifestMethodHitsItsRoute(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	var m manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	count := 0
	for resource, def := range m.Resources {
		for _, method := range def.Methods {
			method := method
			count++
			t.Run(resource+"."+method.Name, func(t *testing.T) {
				c, rec := setup(t)
				res := reflect.ValueOf(c.Resources).FieldByName(pascal(resource))
				if !res.IsValid() {
					t.Fatalf("client.%s missing", pascal(resource))
				}
				fn := res.MethodByName(pascal(method.Name))
				if !fn.IsValid() {
					t.Fatalf("%s.%s missing", pascal(resource), pascal(method.Name))
				}
				args := []reflect.Value{reflect.ValueOf(context.Background())}
				positional := append(append([]string{}, method.PathParams...), method.RequiredQuery...)
				for i := range positional {
					args = append(args, reflect.ValueOf(fmt.Sprintf("v/%d", i)))
				}
				if method.HasBody {
					args = append(args, reflect.ValueOf(map[string]any{"x": 1}))
				}
				args = append(args, reflect.ValueOf(map[string]string(nil)))
				if fn.Type().NumIn() != len(args) {
					t.Fatalf("arity %d, want %d", fn.Type().NumIn(), len(args))
				}
				out := fn.Call(args)
				if errV := out[1].Interface(); errV != nil {
					t.Fatalf("unexpected error: %v", errV)
				}
				req := rec.calls[0]
				if req.Method != method.Verb {
					t.Errorf("verb %s, want %s", req.Method, method.Verb)
				}
				want := method.Path
				for i, p := range method.PathParams {
					want = strings.Replace(want, ":"+p, fmt.Sprintf("v%%2F%d", i), 1)
				}
				if got := req.URL.EscapedPath(); got != "/seo"+want {
					t.Errorf("path %s, want /seo%s", got, want)
				}
				for j, q := range method.RequiredQuery {
					if got := req.URL.Query().Get(q); got != fmt.Sprintf("v/%d", len(method.PathParams)+j) {
						t.Errorf("query %s = %q", q, got)
					}
				}
				if (rec.bodies[0] != "") != method.HasBody {
					t.Errorf("body sent = %v, want %v", rec.bodies[0] != "", method.HasBody)
				}
				if req.Header.Get("Authorization") != "Bearer mseo_test" {
					t.Errorf("auth header %q", req.Header.Get("Authorization"))
				}
				if !strings.HasPrefix(req.Header.Get("User-Agent"), "misarseo-go/") {
					t.Errorf("user agent %q", req.Header.Get("User-Agent"))
				}
			})
		}
	}
	if count < 200 {
		t.Fatalf("manifest has %d methods", count)
	}
}

func TestRateLimitRetriedThenSucceeds(t *testing.T) {
	c, rec := setup(t, reply{429, `{"error":"slow","code":"RATE_LIMITED"}`, nil}, reply{200, `{"projects":[]}`, nil})
	if _, err := c.Projects.List(context.Background(), nil); err != nil {
		t.Fatal(err)
	}
	if len(rec.calls) != 2 {
		t.Fatalf("calls = %d", len(rec.calls))
	}
}

func TestPlanLimitNotRetriedAndCarriesOffer(t *testing.T) {
	c, rec := setup(t, reply{429, `{"error":"Limit reached.","code":"plan_limit_exceeded","upgrade":{"reason":"quota_exhausted","feature":"keyword_lookups","current_plan":{"slug":"free"},"urls":{"pricing":"https://seo.misar.io/subscribe"}}}`,
		map[string]string{"Retry-After": "3600", "X-Misar-Plan": "free", "X-Misar-Upgrade-Url": "https://seo.misar.io/subscribe?plan=pro"}})
	_, err := c.Keywords.Research(context.Background(), map[string]any{"projectId": "p"}, nil)
	var pl *misarseo.PlanLimitError
	if !errors.As(err, &pl) {
		t.Fatalf("want PlanLimitError, got %v", err)
	}
	if len(rec.calls) != 1 {
		t.Fatalf("plan limit was retried: %d calls", len(rec.calls))
	}
	if pl.Status != 429 || pl.Reason != "quota_exhausted" || pl.Feature != "keyword_lookups" || pl.Plan != "free" ||
		pl.UpgradeURL != "https://seo.misar.io/subscribe?plan=pro" || pl.RetryAfter != 3600 || pl.Offer == nil {
		t.Fatalf("unexpected %+v", pl)
	}
	if misarseo.IsRateLimited(err) {
		t.Fatal("a plan limit must not read as a rate limit")
	}
}

func TestPlanLimit402FallsBackToBody(t *testing.T) {
	c, _ := setup(t, reply{402, `{"error":"Locked.","code":"plan_limit_exceeded","upgrade":{"reason":"feature_locked","current_plan":{"slug":"free"},"urls":{"pricing":"https://seo.misar.io/subscribe"}}}`, nil})
	_, err := c.Backlinks.Overview(context.Background(), "p1", "example.com", nil)
	var pl *misarseo.PlanLimitError
	if !errors.As(err, &pl) || pl.Plan != "free" || pl.UpgradeURL != "https://seo.misar.io/subscribe" || pl.Status != 402 {
		t.Fatalf("got %v", err)
	}
}

func TestNotFoundKeepsCode(t *testing.T) {
	c, _ := setup(t, reply{404, `{"error":"Project not found","code":"NOT_FOUND"}`, nil})
	_, err := c.Projects.Get(context.Background(), "nope", nil)
	var e *misarseo.Error
	if !errors.As(err, &e) || e.Code != "NOT_FOUND" || !misarseo.IsNotFound(err) {
		t.Fatalf("got %v", err)
	}
}

func TestPost503NotRetriedGet503Retried(t *testing.T) {
	c, rec := setup(t, reply{503, `{"error":"down"}`, nil})
	if _, err := c.Crawl.Start(context.Background(), map[string]any{}, nil); err == nil {
		t.Fatal("want error")
	}
	if len(rec.calls) != 1 {
		t.Fatalf("POST retried: %d", len(rec.calls))
	}
	c, rec = setup(t, reply{503, `{"error":"down"}`, nil}, reply{200, `{}`, nil})
	if _, err := c.Projects.List(context.Background(), nil); err != nil {
		t.Fatal(err)
	}
	if len(rec.calls) != 2 {
		t.Fatalf("GET not retried: %d", len(rec.calls))
	}
}

func TestPagination(t *testing.T) {
	pages := map[int]misarseo.OffsetPage{1: {Rows: []any{1, 2}, HasMore: true}, 2: {Rows: []any{3}, HasMore: true}, 3: {HasMore: true}}
	var got []any
	_ = misarseo.IterateOffsetPages(context.Background(), 1, func(_ context.Context, p int) (misarseo.OffsetPage, error) { return pages[p], nil },
		func(r any) bool { got = append(got, r); return true })
	if len(got) != 3 {
		t.Fatalf("offset rows %v", got)
	}
	cursors := map[string]misarseo.CursorPage{"": {Rows: []any{"a"}, HasMore: true, NextCursor: "c1"}, "c1": {Rows: []any{"b"}, HasMore: true, NextCursor: "c1"}}
	got = nil
	_ = misarseo.IterateCursorPages(context.Background(), "", func(_ context.Context, c string) (misarseo.CursorPage, error) { return cursors[c], nil },
		func(r any) bool { got = append(got, r); return true })
	if len(got) != 2 {
		t.Fatalf("cursor rows %v", got)
	}
}

func TestCrawlStream(t *testing.T) {
	body := ": ping\n\nevent: progress\ndata: {\"pages\":3}\n\nevent: complete\ndata: {}\n\nevent: progress\ndata: {}\n\n"
	c, rec := setup(t, reply{200, body, map[string]string{"Content-Type": "text/event-stream"}})
	var events []string
	err := c.Crawl.StreamEvents(context.Background(), "a1", "p1", nil, func(e misarseo.Event) bool {
		events = append(events, e.Event)
		return true
	})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(events, ",") != "progress,complete" {
		t.Fatalf("events %v", events)
	}
	if rec.calls[0].Header.Get("Accept") != "text/event-stream" || rec.calls[0].URL.Query().Get("projectId") != "p1" {
		t.Fatalf("request %v", rec.calls[0].Header)
	}
}

func TestMissingKey(t *testing.T) {
	t.Setenv("MISARSEO_API_KEY", "")
	if _, err := misarseo.NewClient(""); err == nil || !strings.Contains(err.Error(), "seo.misar.io") {
		t.Fatalf("got %v", err)
	}
}
