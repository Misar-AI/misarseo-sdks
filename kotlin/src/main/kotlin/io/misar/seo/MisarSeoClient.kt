package io.misar.seo

import io.misar.seo.core.Transport
import io.misar.seo.generated.GeneratedResources
import java.time.Duration

/**
 * MisarSEO API client. Every resource is a property — `client.projects`,
 * `client.rankTracking`, `client.aiSearch` … — whose methods are `suspend`.
 *
 * ```kotlin
 * val client = MisarSeoClient(System.getenv("MISARSEO_API_KEY"))
 * val projects = client.projects.list()
 * ```
 */
class MisarSeoClient private constructor(transport: Transport) : GeneratedResources(transport) {
    constructor(apiKey: String? = null, config: Config = Config()) : this(
        Transport(
            apiKey = resolveKey(apiKey),
            baseUrl = config.baseUrl,
            timeout = config.timeout,
            maxRetries = config.maxRetries,
            retryBaseDelay = config.retryBaseDelay,
            maxRetryDelay = config.maxRetryDelay,
            userAgent = "misarseo-kotlin/$VERSION",
        ),
    )

    data class Config(
        val baseUrl: String = DEFAULT_BASE_URL,
        val timeout: Duration = Duration.ofSeconds(30),
        val maxRetries: Int = 2,
        val retryBaseDelay: Duration = Duration.ofMillis(250),
        val maxRetryDelay: Duration = Duration.ofSeconds(60),
    )

    companion object {
        const val VERSION = "1.0.0"
        const val DEFAULT_BASE_URL = "https://api.misar.io/seo"

        private fun resolveKey(key: String?): String {
            val resolved = key?.takeIf { it.isNotEmpty() } ?: System.getenv("MISARSEO_API_KEY")
            require(!resolved.isNullOrEmpty()) {
                "A MisarSEO API key (mseo_...) is required: pass it or set MISARSEO_API_KEY; see https://seo.misar.io/ai"
            }
            return resolved
        }
    }
}
