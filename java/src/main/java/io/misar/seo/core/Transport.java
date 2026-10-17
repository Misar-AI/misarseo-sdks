package io.misar.seo.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.TextNode;
import io.misar.seo.MisarSeoException;
import io.misar.seo.MisarSeoPlanLimitException;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * Request plumbing the generated resources are written against.
 *
 * <p>Retry policy, identical in every MisarSEO SDK: 429 is retried for every
 * verb unless the body says {@code plan_limit_exceeded}; 502/503/504 and
 * network failures are retried for GET only (a POST may have started a billed
 * crawl); backoff starts at 250 ms with jitter and honours {@code Retry-After}
 * up to the configured cap.
 */
public final class Transport {
    private static final ObjectMapper JSON = new ObjectMapper();

    private final String apiKey;
    private final String baseUrl;
    private final Duration timeout;
    private final int maxRetries;
    private final Duration retryBaseDelay;
    private final Duration maxRetryDelay;
    private final String userAgent;
    private final HttpClient http;

    public Transport(String apiKey, String baseUrl, Duration timeout, int maxRetries, Duration retryBaseDelay,
                     Duration maxRetryDelay, String userAgent) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.timeout = timeout;
        this.maxRetries = maxRetries;
        this.retryBaseDelay = retryBaseDelay;
        this.maxRetryDelay = maxRetryDelay;
        this.userAgent = userAgent;
        this.http = HttpClient.newBuilder().connectTimeout(timeout).build();
    }

    /** Encode one path segment. */
    public static String seg(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    /** Required query parameters first; an explicit key in {@code query} wins. */
    public static Map<String, String> merge(Map<String, String> query, String... requiredPairs) {
        Map<String, String> out = new LinkedHashMap<>();
        for (int i = 0; i + 1 < requiredPairs.length; i += 2) out.put(requiredPairs[i], requiredPairs[i + 1]);
        if (query != null) out.putAll(query);
        return out;
    }

    private URI uri(String path, Map<String, String> query) {
        String url = baseUrl + path;
        if (query != null && !query.isEmpty()) {
            url += "?" + query.entrySet().stream()
                    .filter(e -> e.getValue() != null)
                    .map(e -> seg(e.getKey()) + "=" + seg(e.getValue()))
                    .collect(Collectors.joining("&"));
        }
        return URI.create(url);
    }

    private HttpRequest.Builder builder(URI uri, String accept) {
        return HttpRequest.newBuilder(uri)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .header("Accept", accept)
                .header("User-Agent", userAgent);
    }

    private long backoffMillis(int attempt, Integer retryAfter) {
        if (retryAfter != null) {
            long ms = retryAfter * 1000L;
            return ms > maxRetryDelay.toMillis() ? -1 : ms;
        }
        long base = retryBaseDelay.toMillis() << Math.min(attempt, 16);
        long half = base / 2;
        return Math.min(maxRetryDelay.toMillis(), half + ThreadLocalRandom.current().nextLong(half + 1));
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new MisarSeoException(0, "INTERRUPTED", "interrupted while waiting to retry", null, null);
        }
    }

    private static JsonNode decode(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return JSON.readTree(raw);
        } catch (IOException e) {
            return TextNode.valueOf(raw);
        }
    }

    /** Build the exception for a non-2xx response; the plan-limit code is checked BEFORE the status. */
    static MisarSeoException errorFrom(int status, java.net.http.HttpHeaders headers, String raw) {
        JsonNode body = decode(raw);
        String message = body != null && body.hasNonNull("error") ? body.get("error").asText()
                : body != null && body.hasNonNull("message") ? body.get("message").asText() : "HTTP " + status;
        String code = body != null && body.hasNonNull("code") ? body.get("code").asText() : "API_ERROR";
        Integer retryAfter = headers.firstValue("retry-after").map(String::trim)
                .filter(v -> v.matches("\\d+")).map(Integer::valueOf).orElse(null);
        if (MisarSeoPlanLimitException.PLAN_LIMIT_CODE.equals(code)) {
            return new MisarSeoPlanLimitException(status, message, body, retryAfter,
                    headers.firstValue("x-misar-plan").orElse(null),
                    headers.firstValue("x-misar-upgrade-url").orElse(null));
        }
        return new MisarSeoException(status, code, message, body, retryAfter);
    }

    /** One request with the shared retry policy; returns the decoded JSON body (null when empty). */
    public JsonNode request(String method, String path, Map<String, String> query, Object body) {
        URI uri = uri(path, query);
        String payload;
        try {
            payload = body == null ? null : JSON.writeValueAsString(body);
        } catch (IOException e) {
            throw new MisarSeoException(0, "ENCODING_ERROR", "could not encode the request body: " + e.getMessage(), null, null);
        }
        for (int attempt = 0; ; attempt++) {
            HttpRequest request = builder(uri, "application/json")
                    .timeout(timeout)
                    .method(method, payload == null ? HttpRequest.BodyPublishers.noBody()
                            : HttpRequest.BodyPublishers.ofString(payload))
                    .build();
            HttpResponse<String> response;
            try {
                response = http.send(request, HttpResponse.BodyHandlers.ofString());
            } catch (IOException e) {
                if ("GET".equals(method) && attempt < maxRetries) {
                    sleep(backoffMillis(attempt, null));
                    continue;
                }
                throw new MisarSeoException(0, "NETWORK_ERROR", "could not reach the MisarSEO API: " + e.getMessage(), null, null);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new MisarSeoException(0, "INTERRUPTED", "request interrupted", null, null);
            }
            int status = response.statusCode();
            if (status >= 200 && status < 300) return decode(response.body());
            MisarSeoException error = errorFrom(status, response.headers(), response.body());
            boolean retryable = status == 429 || ("GET".equals(method) && (status == 502 || status == 503 || status == 504));
            if (error instanceof MisarSeoPlanLimitException || !retryable || attempt >= maxRetries) throw error;
            long wait = backoffMillis(attempt, error.getRetryAfter());
            if (wait < 0) throw error;
            sleep(wait);
        }
    }

    /** Parse one SSE frame; null for keep-alive comments and frames without an event line. */
    public static SseEvent parseFrame(String frame) {
        String event = null;
        StringBuilder data = new StringBuilder();
        for (String line : frame.replace("\r\n", "\n").split("\n")) {
            if (line.isEmpty() || line.startsWith(":")) continue;
            if (line.startsWith("event:")) event = line.substring(6).trim();
            else if (line.startsWith("data:")) {
                if (data.length() > 0) data.append('\n');
                data.append(line.substring(5).replaceFirst("^ +", ""));
            }
        }
        if (event == null) return null;
        JsonNode decoded = decode(data.toString());
        return new SseEvent(event, decoded == null ? TextNode.valueOf("") : decoded);
    }

    /** GET a text/event-stream endpoint, calling {@code onEvent} per frame until a terminal event. */
    public void stream(String path, Map<String, String> query, List<String> terminal, Predicate<SseEvent> onEvent) {
        HttpRequest request = builder(uri(path, query), "text/event-stream").GET().build();
        HttpResponse<InputStream> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
        } catch (IOException e) {
            throw new MisarSeoException(0, "NETWORK_ERROR", "could not reach the MisarSEO API: " + e.getMessage(), null, null);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new MisarSeoException(0, "INTERRUPTED", "request interrupted", null, null);
        }
        try (InputStream in = response.body();
             BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String raw = reader.lines().collect(Collectors.joining("\n"));
                throw errorFrom(response.statusCode(), response.headers(), raw);
            }
            StringBuilder frame = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.isEmpty()) {
                    frame.append(line).append('\n');
                    continue;
                }
                SseEvent event = parseFrame(frame.toString());
                frame.setLength(0);
                if (event == null) continue;
                if (!onEvent.test(event) || terminal.contains(event.event())) return;
            }
            if (frame.length() > 0) {
                SseEvent event = parseFrame(frame.toString());
                if (event != null) onEvent.test(event);
            }
        } catch (IOException e) {
            throw new MisarSeoException(0, "NETWORK_ERROR", "stream interrupted: " + e.getMessage(), null, null);
        }
    }
}
