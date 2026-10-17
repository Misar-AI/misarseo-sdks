package io.misar.seo;

import io.misar.seo.core.Transport;
import io.misar.seo.generated.GeneratedResources;
import java.time.Duration;

/**
 * MisarSEO API client. Every resource is a public field —
 * {@code client.projects}, {@code client.rankTracking}, {@code client.aiSearch} …
 *
 * <pre>{@code
 * MisarSeoClient client = new MisarSeoClient(System.getenv("MISARSEO_API_KEY"));
 * JsonNode projects = client.projects.list(null);
 * }</pre>
 */
public final class MisarSeoClient extends GeneratedResources {
    /** SDK version, sent in the User-Agent header. */
    public static final String VERSION = "1.0.0";
    public static final String DEFAULT_BASE_URL = "https://api.misar.io/seo";

    private final Transport transport;

    /** A client with the production defaults. A null/empty key falls back to MISARSEO_API_KEY. */
    public MisarSeoClient(String apiKey) {
        this(new Config(apiKey));
    }

    public MisarSeoClient(Config config) {
        this(new Transport(resolveKey(config.apiKey), config.baseUrl, config.timeout, config.maxRetries,
                config.retryBaseDelay, config.maxRetryDelay, "misarseo-java/" + VERSION));
    }

    private MisarSeoClient(Transport transport) {
        super(transport);
        this.transport = transport;
    }

    private static String resolveKey(String key) {
        String resolved = key == null || key.isEmpty() ? System.getenv("MISARSEO_API_KEY") : key;
        if (resolved == null || resolved.isEmpty()) {
            throw new IllegalArgumentException("A MisarSEO API key (mseo_...) is required: pass it or set "
                    + "MISARSEO_API_KEY; see https://seo.misar.io/ai");
        }
        return resolved;
    }

    /** Client configuration; fields are public and mutable before construction. */
    public static final class Config {
        public String apiKey;
        public String baseUrl = DEFAULT_BASE_URL;
        public Duration timeout = Duration.ofSeconds(30);
        public int maxRetries = 2;
        public Duration retryBaseDelay = Duration.ofMillis(250);
        public Duration maxRetryDelay = Duration.ofSeconds(60);

        public Config(String apiKey) {
            this.apiKey = apiKey;
        }
    }
}
