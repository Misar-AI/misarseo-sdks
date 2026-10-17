package io.misar.seo.core

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.TextNode
import io.misar.seo.MisarSeoException
import io.misar.seo.MisarSeoPlanLimitException
import io.misar.seo.PLAN_LIMIT_CODE
import java.io.IOException
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpHeaders
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration
import kotlin.random.Random
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.future.await

/**
 * Request plumbing the generated resources are written against.
 *
 * Retry policy, identical in every MisarSEO SDK: 429 is retried for every
 * verb unless the body says `plan_limit_exceeded`; 502/503/504 and network
 * failures are retried for GET only (a POST may have started a billed
 * crawl); backoff starts at 250 ms with jitter and honours `Retry-After` up
 * to the configured cap.
 */
class Transport(
    private val apiKey: String,
    baseUrl: String,
    private val timeout: Duration,
    private val maxRetries: Int,
    private val retryBaseDelay: Duration,
    private val maxRetryDelay: Duration,
    private val userAgent: String,
) {
    private val baseUrl = baseUrl.trimEnd('/')
    private val http: HttpClient = HttpClient.newBuilder().connectTimeout(timeout).build()

    companion object {
        private val JSON = ObjectMapper()

        /** Encode one path segment. */
        fun seg(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20")

        /** Required query parameters first; an explicit key in [query] wins. */
        fun merge(query: Map<String, String>?, vararg required: Pair<String, String>): Map<String, String> =
            linkedMapOf(*required).apply { query?.let { putAll(it) } }

        private fun decode(raw: String?): JsonNode? {
            if (raw.isNullOrBlank()) return null
            return try {
                JSON.readTree(raw)
            } catch (e: IOException) {
                TextNode.valueOf(raw)
            }
        }

        /** The exception for a non-2xx response; the plan-limit code is checked BEFORE the status. */
        internal fun errorFrom(status: Int, headers: HttpHeaders, raw: String?): MisarSeoException {
            val body = decode(raw)
            val message = body?.get("error")?.asText() ?: body?.get("message")?.asText() ?: "HTTP $status"
            val code = body?.get("code")?.asText() ?: "API_ERROR"
            val retryAfter = headers.firstValue("retry-after").orElse(null)?.trim()?.toIntOrNull()
            if (code == PLAN_LIMIT_CODE) {
                return MisarSeoPlanLimitException(
                    status, message, body, retryAfter,
                    headers.firstValue("x-misar-plan").orElse(null),
                    headers.firstValue("x-misar-upgrade-url").orElse(null),
                )
            }
            return MisarSeoException(status, code, message, body, retryAfter)
        }

        /** Parse one SSE frame; null for keep-alive comments and frames without an event line. */
        fun parseFrame(frame: String): SseEvent? {
            var event: String? = null
            val data = mutableListOf<String>()
            for (line in frame.replace("\r\n", "\n").split("\n")) {
                when {
                    line.isEmpty() || line.startsWith(":") -> Unit
                    line.startsWith("event:") -> event = line.removePrefix("event:").trim()
                    line.startsWith("data:") -> data += line.removePrefix("data:").trimStart(' ')
                }
            }
            return event?.let { SseEvent(it, decode(data.joinToString("\n")) ?: TextNode.valueOf("")) }
        }
    }

    private fun uri(path: String, query: Map<String, String>?): URI {
        val qs = query.orEmpty().entries.joinToString("&") { "${seg(it.key)}=${seg(it.value)}" }
        return URI.create(baseUrl + path + if (qs.isEmpty()) "" else "?$qs")
    }

    private fun builder(uri: URI, accept: String): HttpRequest.Builder =
        HttpRequest.newBuilder(uri)
            .header("Authorization", "Bearer $apiKey")
            .header("Content-Type", "application/json")
            .header("Accept", accept)
            .header("User-Agent", userAgent)

    private fun backoffMillis(attempt: Int, retryAfter: Int?): Long {
        if (retryAfter != null) {
            val ms = retryAfter * 1000L
            return if (ms > maxRetryDelay.toMillis()) -1 else ms
        }
        val base = retryBaseDelay.toMillis() shl minOf(attempt, 16)
        val half = base / 2
        return minOf(maxRetryDelay.toMillis(), half + Random.nextLong(half + 1))
    }

    /** One request with the shared retry policy; the decoded JSON body, or null when empty. */
    suspend fun request(method: String, path: String, query: Map<String, String>?, body: Any?): JsonNode? {
        val uri = uri(path, query)
        val payload = body?.let { JSON.writeValueAsString(it) }
        var attempt = 0
        while (true) {
            val request = builder(uri, "application/json")
                .timeout(timeout)
                .method(method, payload?.let { HttpRequest.BodyPublishers.ofString(it) } ?: HttpRequest.BodyPublishers.noBody())
                .build()
            val response = try {
                http.sendAsync(request, HttpResponse.BodyHandlers.ofString()).await()
            } catch (e: IOException) {
                if (method == "GET" && attempt < maxRetries) {
                    delay(backoffMillis(attempt++, null))
                    continue
                }
                throw MisarSeoException(0, "NETWORK_ERROR", "could not reach the MisarSEO API: ${e.message}")
            }
            val status = response.statusCode()
            if (status in 200..299) return decode(response.body())
            val error = errorFrom(status, response.headers(), response.body())
            val retryable = status == 429 || (method == "GET" && status in setOf(502, 503, 504))
            if (error is MisarSeoPlanLimitException || !retryable || attempt >= maxRetries) throw error
            val wait = backoffMillis(attempt++, error.retryAfter)
            if (wait < 0) throw error
            delay(wait)
        }
    }

    /** GET a text/event-stream endpoint as a cold Flow that completes after a terminal event. */
    fun stream(path: String, query: Map<String, String>?, terminal: List<String>): Flow<SseEvent> = flow {
        val request = builder(uri(path, query), "text/event-stream").GET().build()
        val response = try {
            http.send(request, HttpResponse.BodyHandlers.ofLines())
        } catch (e: IOException) {
            throw MisarSeoException(0, "NETWORK_ERROR", "could not reach the MisarSEO API: ${e.message}")
        }
        val lines = response.body().iterator()
        if (response.statusCode() !in 200..299) {
            val raw = buildString { lines.forEach { appendLine(it) } }
            throw errorFrom(response.statusCode(), response.headers(), raw)
        }
        val frame = StringBuilder()
        while (lines.hasNext()) {
            val line = lines.next()
            if (line.isNotEmpty()) {
                frame.append(line).append('\n')
                continue
            }
            val event = parseFrame(frame.toString())
            frame.setLength(0)
            if (event != null) {
                emit(event)
                if (event.event in terminal) return@flow
            }
        }
        parseFrame(frame.toString())?.let { emit(it) }
    }.flowOn(Dispatchers.IO)
}
