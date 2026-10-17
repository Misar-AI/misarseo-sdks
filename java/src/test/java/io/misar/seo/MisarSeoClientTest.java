package io.misar.seo;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import io.misar.seo.core.Pagination;
import io.misar.seo.core.SseEvent;
import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import org.junit.jupiter.api.DynamicTest;

class MisarSeoClientTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    record Reply(int status, String body, Map<String, String> headers) {}

    record Call(String method, String rawPath, String query, String body, Map<String, List<String>> headers) {}

    private HttpServer server;
    private final List<Call> calls = new ArrayList<>();

    private MisarSeoClient start(Reply... replies) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            URI uri = exchange.getRequestURI();
            synchronized (calls) {
                calls.add(new Call(exchange.getRequestMethod(), uri.getRawPath(), uri.getRawQuery(), body,
                        new HashMap<>(exchange.getRequestHeaders())));
            }
            Reply reply = replies[Math.min(calls.size() - 1, replies.length - 1)];
            reply.headers().forEach((k, v) -> exchange.getResponseHeaders().set(k, v));
            byte[] out = reply.body().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(reply.status(), out.length == 0 ? -1 : out.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(out);
            }
        });
        server.start();
        MisarSeoClient.Config config = new MisarSeoClient.Config("mseo_test");
        config.baseUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/seo";
        config.retryBaseDelay = Duration.ofMillis(1);
        config.maxRetryDelay = Duration.ofMillis(50);
        return new MisarSeoClient(config);
    }

    @AfterEach
    void stop() {
        if (server != null) server.stop(0);
        calls.clear();
    }

    private static String header(Call call, String name) {
        return call.headers().entrySet().stream().filter(e -> e.getKey().equalsIgnoreCase(name))
                .map(e -> e.getValue().get(0)).findFirst().orElse(null);
    }

    private static Map<String, String> queryOf(Call call) {
        Map<String, String> out = new HashMap<>();
        if (call.query() == null) return out;
        for (String pair : call.query().split("&")) {
            String[] kv = pair.split("=", 2);
            out.put(java.net.URLDecoder.decode(kv[0], StandardCharsets.UTF_8),
                    kv.length > 1 ? java.net.URLDecoder.decode(kv[1], StandardCharsets.UTF_8) : "");
        }
        return out;
    }

    @TestFactory
    Stream<DynamicTest> everyManifestMethodHitsItsRoute() throws IOException {
        JsonNode manifest = JSON.readTree(Files.readString(Path.of("manifest.json")));
        List<DynamicTest> tests = new ArrayList<>();
        manifest.get("resources").fields().forEachRemaining(entry -> {
            String resource = entry.getKey();
            for (JsonNode method : entry.getValue().get("methods")) {
                String name = method.get("name").asText();
                tests.add(DynamicTest.dynamicTest(resource + "." + name, () -> {
                    MisarSeoClient client = start(new Reply(200, "{\"ok\":true}", Map.of()));
                    try {
                        Object target = GeneratedResourcesAccess.field(client, resource);
                        List<String> pathParams = new ArrayList<>();
                        method.get("pathParams").forEach(n -> pathParams.add(n.asText()));
                        List<String> required = new ArrayList<>();
                        method.get("requiredQuery").forEach(n -> required.add(n.asText()));
                        boolean hasBody = method.get("hasBody").asBoolean();
                        int arity = pathParams.size() + required.size() + (hasBody ? 1 : 0) + 1;
                        Method fn = Arrays.stream(target.getClass().getMethods())
                                .filter(m -> m.getName().equals(name) || m.getName().equals(name + "_"))
                                .filter(m -> m.getParameterCount() == arity).findFirst()
                                .orElseThrow(() -> new AssertionError(resource + "." + name + " missing"));
                        List<Object> args = new ArrayList<>();
                        for (int i = 0; i < pathParams.size() + required.size(); i++) args.add("v/" + i);
                        if (hasBody) args.add(Map.of("x", 1));
                        args.add(null);
                        JsonNode out = (JsonNode) fn.invoke(target, args.toArray());
                        assertTrue(out.get("ok").asBoolean());

                        Call call = calls.get(0);
                        assertEquals(method.get("verb").asText(), call.method());
                        String want = method.get("path").asText();
                        for (int i = 0; i < pathParams.size(); i++) want = want.replace(":" + pathParams.get(i), "v%2F" + i);
                        assertEquals("/seo" + want, call.rawPath());
                        Map<String, String> query = queryOf(call);
                        for (int j = 0; j < required.size(); j++) {
                            assertEquals("v/" + (pathParams.size() + j), query.get(required.get(j)), "query " + required.get(j));
                        }
                        assertEquals(hasBody, !call.body().isEmpty());
                        assertEquals("Bearer mseo_test", header(call, "Authorization"));
                        assertTrue(header(call, "User-Agent").startsWith("misarseo-java/"));
                    } finally {
                        stop();
                    }
                }));
            }
        });
        assertTrue(tests.size() > 200);
        return tests.stream();
    }

    @Test
    void rateLimitRetriedThenSucceeds() throws IOException {
        MisarSeoClient client = start(new Reply(429, "{\"error\":\"slow\",\"code\":\"RATE_LIMITED\"}", Map.of()),
                new Reply(200, "{\"projects\":[]}", Map.of()));
        assertTrue(client.projects.list(null).get("projects").isArray());
        assertEquals(2, calls.size());
    }

    @Test
    void planLimitIsNotRetriedAndCarriesTheOffer() throws IOException {
        MisarSeoClient client = start(new Reply(429,
                "{\"error\":\"Limit reached.\",\"code\":\"plan_limit_exceeded\",\"upgrade\":{\"reason\":\"quota_exhausted\",\"feature\":\"keyword_lookups\",\"current_plan\":{\"slug\":\"free\"},\"urls\":{\"pricing\":\"https://seo.misar.io/subscribe\"}}}",
                Map.of("Retry-After", "3600", "X-Misar-Plan", "free", "X-Misar-Upgrade-Url", "https://seo.misar.io/subscribe?plan=pro")));
        MisarSeoPlanLimitException e = assertThrows(MisarSeoPlanLimitException.class,
                () -> client.keywords.research(Map.of("projectId", "p"), null));
        assertEquals(1, calls.size());
        assertEquals(429, e.getStatus());
        assertEquals("plan_limit_exceeded", e.getCode());
        assertEquals("quota_exhausted", e.getReason());
        assertEquals("keyword_lookups", e.getFeature());
        assertEquals("free", e.getPlan());
        assertEquals("https://seo.misar.io/subscribe?plan=pro", e.getUpgradeUrl());
        assertEquals(3600, e.getRetryAfter());
        assertNotNull(e.getOffer());
        assertFalse(e.isRateLimited());
    }

    @Test
    void planLimit402FallsBackToTheBody() throws IOException {
        MisarSeoClient client = start(new Reply(402,
                "{\"error\":\"Locked.\",\"code\":\"plan_limit_exceeded\",\"upgrade\":{\"reason\":\"feature_locked\",\"current_plan\":{\"slug\":\"free\"},\"urls\":{\"pricing\":\"https://seo.misar.io/subscribe\"}}}",
                Map.of()));
        MisarSeoPlanLimitException e = assertThrows(MisarSeoPlanLimitException.class,
                () -> client.backlinks.overview("p1", "example.com", null));
        assertEquals("free", e.getPlan());
        assertEquals("https://seo.misar.io/subscribe", e.getUpgradeUrl());
    }

    @Test
    void notFoundKeepsTheCode() throws IOException {
        MisarSeoClient client = start(new Reply(404, "{\"error\":\"Project not found\",\"code\":\"NOT_FOUND\"}", Map.of()));
        MisarSeoException e = assertThrows(MisarSeoException.class, () -> client.projects.get("nope", null));
        assertTrue(e.isNotFound());
        assertEquals("NOT_FOUND", e.getCode());
    }

    @Test
    void post503NotRetriedGet503Retried() throws IOException {
        MisarSeoClient client = start(new Reply(503, "{\"error\":\"down\"}", Map.of()));
        assertThrows(MisarSeoException.class, () -> client.crawl.start(Map.of(), null));
        assertEquals(1, calls.size());
        stop();
        MisarSeoClient again = start(new Reply(503, "{}", Map.of()), new Reply(200, "{}", Map.of()));
        again.projects.list(null);
        assertEquals(2, calls.size());
    }

    @Test
    void pagination() {
        Map<Integer, String> pages = Map.of(1, "{\"rows\":[1,2],\"hasMore\":true}", 2, "{\"rows\":[3],\"hasMore\":true}",
                3, "{\"rows\":[],\"hasMore\":true}");
        List<JsonNode> rows = Pagination.collectOffsetPages(1, p -> read(pages.get(p)));
        assertEquals(3, rows.size());
        Map<String, String> cursors = new HashMap<>();
        cursors.put(null, "{\"rows\":[\"a\"],\"hasMore\":true,\"nextCursor\":\"c1\"}");
        cursors.put("c1", "{\"rows\":[\"b\"],\"hasMore\":true,\"nextCursor\":\"c1\"}");
        assertEquals(2, Pagination.collectCursorPages(null, c -> read(cursors.get(c))).size());
    }

    private static JsonNode read(String raw) {
        try {
            return JSON.readTree(raw);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void crawlStreamReadsUntilComplete() throws IOException {
        String body = ": ping\n\nevent: progress\ndata: {\"pages\":3}\n\nevent: complete\ndata: {}\n\nevent: progress\ndata: {}\n\n";
        MisarSeoClient client = start(new Reply(200, body, Map.of("Content-Type", "text/event-stream")));
        List<String> names = new ArrayList<>();
        client.crawl.streamEvents("a1", "p1", null, (SseEvent e) -> names.add(e.event()));
        assertEquals(List.of("progress", "complete"), names);
        assertEquals("text/event-stream", header(calls.get(0), "Accept"));
        assertEquals("p1", queryOf(calls.get(0)).get("projectId"));
    }
}
