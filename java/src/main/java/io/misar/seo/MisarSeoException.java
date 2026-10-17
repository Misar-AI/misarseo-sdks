package io.misar.seo;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * A non-2xx response, or (status 0) a request that never got one.
 *
 * <p>{@link #getCode()} is the API's own code — {@code NOT_FOUND},
 * {@code VALIDATION_ERROR}, {@code RATE_LIMITED} … — which says more than the
 * status. A plan refusal is the subclass {@link MisarSeoPlanLimitException}.
 */
public class MisarSeoException extends RuntimeException {
    private final int status;
    private final String code;
    private final JsonNode body;
    private final Integer retryAfter;

    public MisarSeoException(int status, String code, String message, JsonNode body, Integer retryAfter) {
        super(status == 0 ? "misarseo: " + message : "misarseo: HTTP " + status + " (" + code + "): " + message);
        this.status = status;
        this.code = code;
        this.body = body;
        this.retryAfter = retryAfter;
    }

    /** HTTP status; 0 when no response arrived. */
    public int getStatus() { return status; }

    /** The API's error code. */
    public String getCode() { return code; }

    /** The decoded error body, when there was one. */
    public JsonNode getBody() { return body; }

    /** Seconds from {@code Retry-After}, when sent. */
    public Integer getRetryAfter() { return retryAfter; }

    public boolean isNotFound() { return status == 404; }

    public boolean isUnauthorized() { return status == 401; }

    /** An ordinary throttle — never true for a plan limit. */
    public boolean isRateLimited() { return status == 429 && !(this instanceof MisarSeoPlanLimitException); }
}
