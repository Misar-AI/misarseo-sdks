package io.misar.seo.core

import com.fasterxml.jackson.databind.JsonNode

/**
 * The API's two pagination shapes. Offset pages (`rows, hasMore, page`)
 * address rows by position; keyset pages (`rows, hasMore, nextCursor`) by key,
 * so they never skip or repeat when rows are inserted mid-walk.
 */
object Pagination {
    /** Every row from [startPage]; stops on hasMore=false OR an empty page. */
    suspend fun collectOffsetPages(startPage: Int = 1, fetch: suspend (Int) -> JsonNode): List<JsonNode> {
        val out = mutableListOf<JsonNode>()
        var page = startPage
        while (true) {
            val result = fetch(page)
            val rows = result.path("rows")
            rows.forEach { out.add(it) }
            if (!result.path("hasMore").asBoolean(false) || rows.size() == 0) return out
            page++
        }
    }

    /** Every row following `nextCursor`; stops when it is absent or repeats. */
    suspend fun collectCursorPages(startCursor: String? = null, fetch: suspend (String?) -> JsonNode): List<JsonNode> {
        val out = mutableListOf<JsonNode>()
        var cursor = startCursor
        while (true) {
            val result = fetch(cursor)
            result.path("rows").forEach { out.add(it) }
            val next = result.get("nextCursor")?.takeUnless { it.isNull }?.asText()
            if (!result.path("hasMore").asBoolean(false) || next == null || next == cursor) return out
            cursor = next
        }
    }
}
