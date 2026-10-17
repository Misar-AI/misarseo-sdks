package io.misar.seo.core;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import java.util.function.IntFunction;

/**
 * Helpers for the API's two pagination shapes. Offset pages
 * ({@code rows, hasMore, page}) address rows by position; keyset pages
 * ({@code rows, hasMore, nextCursor}) by key, so they never skip or repeat
 * when rows are inserted mid-walk.
 */
public final class Pagination {
    private Pagination() {}

    /** Every row from {@code startPage}; stops on hasMore=false OR an empty page. */
    public static List<JsonNode> collectOffsetPages(int startPage, IntFunction<JsonNode> fetch) {
        List<JsonNode> out = new ArrayList<>();
        for (int page = startPage; ; page++) {
            JsonNode result = fetch.apply(page);
            JsonNode rows = result.path("rows");
            rows.forEach(out::add);
            if (!result.path("hasMore").asBoolean(false) || rows.size() == 0) return out;
        }
    }

    /** Every row following {@code nextCursor}; stops when it is absent or repeats. */
    public static List<JsonNode> collectCursorPages(String startCursor, Function<String, JsonNode> fetch) {
        List<JsonNode> out = new ArrayList<>();
        String cursor = startCursor;
        while (true) {
            JsonNode result = fetch.apply(cursor);
            result.path("rows").forEach(out::add);
            JsonNode next = result.get("nextCursor");
            String nextCursor = next == null || next.isNull() ? null : next.asText();
            if (!result.path("hasMore").asBoolean(false) || nextCursor == null || Objects.equals(nextCursor, cursor)) {
                return out;
            }
            cursor = nextCursor;
        }
    }
}
