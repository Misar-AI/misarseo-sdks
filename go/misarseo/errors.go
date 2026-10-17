package misarseo

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

// PlanLimitCode is the `code` every Misar product sends on a plan-limit rejection.
const PlanLimitCode = "plan_limit_exceeded"

// Error is a non-2xx response (or, with Status 0, a request that got none).
// Code is the API's own code — NOT_FOUND, VALIDATION_ERROR, RATE_LIMITED … —
// which is more precise than the status.
type Error struct {
	Status     int
	Code       string
	Message    string
	Body       map[string]any
	RetryAfter int // seconds, from Retry-After on a 429; 0 when absent
}

func (e *Error) Error() string {
	if e.Status == 0 {
		return "misarseo: " + e.Message
	}
	return fmt.Sprintf("misarseo: HTTP %d (%s): %s", e.Status, e.Code, e.Message)
}

// IsNotFound reports a 404.
func IsNotFound(err error) bool { return statusOf(err) == http.StatusNotFound }

// IsUnauthorized reports a 401: the key is missing, revoked or expired.
func IsUnauthorized(err error) bool { return statusOf(err) == http.StatusUnauthorized }

// IsRateLimited reports an ordinary 429 throttle (not a plan limit).
func IsRateLimited(err error) bool {
	var p *PlanLimitError
	return statusOf(err) == http.StatusTooManyRequests && !errors.As(err, &p)
}

func statusOf(err error) int {
	var e *Error
	if errors.As(err, &e) {
		return e.Status
	}
	var p *PlanLimitError
	if errors.As(err, &p) {
		return p.Status
	}
	return 0
}

// PlanLimitError means the organization's plan does not cover the call: a
// feature its tier locks (402), a spent day/month quota (429 with Retry-After
// at the rollover) or a point-in-time cap such as projects (402). It is never
// retried; show Offer — or at least UpgradeURL — to the user.
type PlanLimitError struct {
	Error_     *Error
	Status     int
	Message    string
	Offer      map[string]any // the server's `upgrade` object: plans, prices, URLs
	Reason     string         // quota_exhausted, feature_locked, …
	Feature    string         // machine key of the limit that was hit
	Plan       string         // current plan slug (x-misar-plan, else the offer)
	UpgradeURL string         // where to upgrade (x-misar-upgrade-url, else the offer)
	RetryAfter int            // seconds until a periodic quota resets; 0 when not sent
}

func (e *PlanLimitError) Error() string {
	return fmt.Sprintf("misarseo: HTTP %d (%s): %s", e.Status, PlanLimitCode, e.Message)
}

// Unwrap exposes the underlying *Error, so errors.As(err, &*Error) also works.
func (e *PlanLimitError) Unwrap() error { return e.Error_ }

func str(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func obj(m map[string]any, key string) map[string]any {
	if v, ok := m[key].(map[string]any); ok {
		return v
	}
	return map[string]any{}
}

// errorFromResponse checks the plan-limit code BEFORE the status: a spent
// quota is a 429 that otherwise looks exactly like an ordinary throttle.
func errorFromResponse(resp *http.Response, raw []byte) error {
	body := map[string]any{}
	_ = json.Unmarshal(raw, &body)
	message := str(body, "error")
	if message == "" {
		message = str(body, "message")
	}
	if message == "" {
		message = http.StatusText(resp.StatusCode)
	}
	code := str(body, "code")
	if code == "" {
		code = "API_ERROR"
	}
	retryAfter, _ := strconv.Atoi(strings.TrimSpace(resp.Header.Get("Retry-After")))
	base := &Error{Status: resp.StatusCode, Code: code, Message: message, Body: body, RetryAfter: retryAfter}
	if code != PlanLimitCode {
		return base
	}
	offer, _ := body["upgrade"].(map[string]any)
	plan := resp.Header.Get("X-Misar-Plan")
	if plan == "" {
		plan = str(obj(offer, "current_plan"), "slug")
	}
	upgradeURL := resp.Header.Get("X-Misar-Upgrade-Url")
	if upgradeURL == "" {
		upgradeURL = str(obj(offer, "urls"), "pricing")
	}
	return &PlanLimitError{
		Error_:     base,
		Status:     resp.StatusCode,
		Message:    message,
		Offer:      offer,
		Reason:     str(offer, "reason"),
		Feature:    str(offer, "feature"),
		Plan:       plan,
		UpgradeURL: upgradeURL,
		RetryAfter: retryAfter,
	}
}
