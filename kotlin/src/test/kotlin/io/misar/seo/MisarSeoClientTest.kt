package io.misar.seo

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.sun.net.httpserver.HttpServer
import io.misar.seo.core.Pagination
import io.misar.seo.generated.Dispatch
import java.io.File
import java.net.InetSocketAddress
import java.net.URLDecoder
import java.time.Duration
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking

class MisarSeoClientTest {
    private val json = ObjectMapper()

    data class Reply(val status: Int, val body: String, val headers: Map<String, String> = emptyMap())

    data class Call(val method: String, val rawPath: String, val query: Map<String, String>, val body: String, val headers: Map<String, String>)

    private var server: HttpServer? = null
    private val calls = mutableListOf<Call>()

    private fun start(vararg replies: Reply): MisarSeoClient {
        calls.clear()
        val s = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        s.createContext("/") { ex ->
            val body = ex.requestBody.readBytes().toString(Charsets.UTF_8)
            val query = ex.requestURI.rawQuery.orEmpty().split("&").filter { it.isNotEmpty() }.associate {
                val (k, v) = (it.split("=", limit = 2) + "").take(2)
                URLDecoder.decode(k, Charsets.UTF_8) to URLDecoder.decode(v, Charsets.UTF_8)
            }
            val headers = ex.requestHeaders.entries.associate { it.key.lowercase() to it.value.first() }
            val index = synchronized(calls) {
                calls += Call(ex.requestMethod, ex.requestURI.rawPath, query, body, headers)
                calls.size - 1
            }
            val reply = replies[minOf(index, replies.size - 1)]
            reply.headers.forEach { (k, v) -> ex.responseHeaders.set(k, v) }
            val out = reply.body.toByteArray()
            ex.sendResponseHeaders(reply.status, if (out.isEmpty()) -1 else out.size.toLong())
            ex.responseBody.use { it.write(out) }
        }
        s.start()
        server = s
        return MisarSeoClient(
            "mseo_test",
            MisarSeoClient.Config(
                baseUrl = "http://127.0.0.1:${s.address.port}/seo",
                retryBaseDelay = Duration.ofMillis(1),
                maxRetryDelay = Duration.ofMillis(50),
            ),
        )
    }

    @AfterTest
    fun stop() {
        server?.stop(0)
        server = null
    }

    @Test
    fun everyManifestMethodHitsItsRoute() = runBlocking {
        val manifest = json.readTree(File("manifest.json"))
        var count = 0
        manifest["resources"].fields().forEach { (resource, def) ->
            for (method in def["methods"]) {
                count++
                val name = method["name"].asText()
                val client = start(Reply(200, """{"ok":true}"""))
                val pathParams = method["pathParams"].map { it.asText() }
                val required = method["requiredQuery"].map { it.asText() }
                val hasBody = method["hasBody"].asBoolean()
                val args = (0 until pathParams.size + required.size).map { "v/$it" }
                val result = Dispatch.invoke(client, resource, name, args, if (hasBody) mapOf("x" to 1) else null)
                assertNotNull(result, "$resource.$name not dispatchable")
                assertTrue(result.getOrThrow()!!["ok"].asBoolean(), "$resource.$name")
                val call = calls[0]
                assertEquals(method["verb"].asText(), call.method, "$resource.$name verb")
                var want = method["path"].asText()
                pathParams.forEachIndexed { i, p -> want = want.replace(":$p", "v%2F$i") }
                assertEquals("/seo$want", call.rawPath, "$resource.$name path")
                required.forEachIndexed { j, q -> assertEquals("v/${pathParams.size + j}", call.query[q], "$resource.$name ?$q") }
                assertEquals(hasBody, call.body.isNotEmpty(), "$resource.$name body")
                assertEquals("Bearer mseo_test", call.headers["authorization"])
                assertTrue(call.headers["user-agent"]!!.startsWith("misarseo-kotlin/"))
                stop()
            }
        }
        assertTrue(count > 200)
    }

    @Test
    fun rateLimitRetriedThenSucceeds() = runBlocking {
        val client = start(Reply(429, """{"error":"slow","code":"RATE_LIMITED"}"""), Reply(200, """{"projects":[]}"""))
        assertTrue(client.projects.list()!!["projects"].isArray)
        assertEquals(2, calls.size)
    }

    @Test
    fun planLimitIsNotRetriedAndCarriesTheOffer() = runBlocking {
        val client = start(
            Reply(
                429,
                """{"error":"Limit reached.","code":"plan_limit_exceeded","upgrade":{"reason":"quota_exhausted","feature":"keyword_lookups","current_plan":{"slug":"free"},"urls":{"pricing":"https://seo.misar.io/subscribe"}}}""",
                mapOf("Retry-After" to "3600", "X-Misar-Plan" to "free", "X-Misar-Upgrade-Url" to "https://seo.misar.io/subscribe?plan=pro"),
            ),
        )
        val e = assertFailsWith<MisarSeoPlanLimitException> { client.keywords.research(mapOf("projectId" to "p")) }
        assertEquals(1, calls.size)
        assertEquals(429, e.status)
        assertEquals("plan_limit_exceeded", e.code)
        assertEquals("quota_exhausted", e.reason)
        assertEquals("keyword_lookups", e.feature)
        assertEquals("free", e.plan)
        assertEquals("https://seo.misar.io/subscribe?plan=pro", e.upgradeUrl)
        assertEquals(3600, e.retryAfter)
        assertNotNull(e.offer)
        assertFalse(e.isRateLimited)
    }

    @Test
    fun planLimit402FallsBackToTheBody() = runBlocking {
        val client = start(
            Reply(402, """{"error":"Locked.","code":"plan_limit_exceeded","upgrade":{"reason":"feature_locked","current_plan":{"slug":"free"},"urls":{"pricing":"https://seo.misar.io/subscribe"}}}"""),
        )
        val e = assertFailsWith<MisarSeoPlanLimitException> { client.backlinks.overview("p1", "example.com") }
        assertEquals("free", e.plan)
        assertEquals("https://seo.misar.io/subscribe", e.upgradeUrl)
    }

    @Test
    fun notFoundKeepsTheCode() = runBlocking {
        val client = start(Reply(404, """{"error":"Project not found","code":"NOT_FOUND"}"""))
        val e = assertFailsWith<MisarSeoException> { client.projects.get("nope") }
        assertTrue(e.isNotFound)
        assertEquals("NOT_FOUND", e.code)
    }

    @Test
    fun post503NotRetriedGet503Retried() = runBlocking {
        var client = start(Reply(503, """{"error":"down"}"""))
        assertFailsWith<MisarSeoException> { client.crawl.start(emptyMap<String, Any>()) }
        assertEquals(1, calls.size)
        stop()
        client = start(Reply(503, "{}"), Reply(200, "{}"))
        client.projects.list()
        assertEquals(2, calls.size)
    }

    private fun read(raw: String): JsonNode = json.readTree(raw)

    @Test
    fun pagination() = runBlocking {
        val pages = mapOf(1 to """{"rows":[1,2],"hasMore":true}""", 2 to """{"rows":[3],"hasMore":true}""", 3 to """{"rows":[],"hasMore":true}""")
        assertEquals(3, Pagination.collectOffsetPages { read(pages.getValue(it)) }.size)
        val cursors = mapOf(null to """{"rows":["a"],"hasMore":true,"nextCursor":"c1"}""", "c1" to """{"rows":["b"],"hasMore":true,"nextCursor":"c1"}""")
        assertEquals(2, Pagination.collectCursorPages { read(cursors.getValue(it)) }.size)
    }

    @Test
    fun crawlStreamReadsUntilComplete() = runBlocking {
        val body = ": ping\n\nevent: progress\ndata: {\"pages\":3}\n\nevent: complete\ndata: {}\n\nevent: progress\ndata: {}\n\n"
        val client = start(Reply(200, body, mapOf("Content-Type" to "text/event-stream")))
        val events = client.crawl.streamEvents("a1", "p1").toList()
        assertEquals(listOf("progress", "complete"), events.map { it.event })
        assertEquals("text/event-stream", calls[0].headers["accept"])
        assertEquals("p1", calls[0].query["projectId"])
    }
}
