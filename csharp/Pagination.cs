using System.Text.Json;

namespace MisarSEO;

/// <summary>
/// The API's two pagination shapes. Offset pages (rows, hasMore, page) address rows by position;
/// keyset pages (rows, hasMore, nextCursor) by key, so they never skip or repeat when rows are
/// inserted mid-walk.
/// </summary>
public static class Pagination
{
    /// <summary>Every row from <paramref name="startPage"/>; stops on hasMore=false OR an empty page.</summary>
    public static async IAsyncEnumerable<JsonElement> OffsetRowsAsync(Func<int, Task<JsonElement>> fetch, int startPage = 1)
    {
        for (var page = startPage; ; page++)
        {
            var result = await fetch(page).ConfigureAwait(false);
            var count = 0;
            if (result.TryGetProperty("rows", out var rows) && rows.ValueKind == JsonValueKind.Array)
            {
                foreach (var row in rows.EnumerateArray()) { count++; yield return row; }
            }
            if (!HasMore(result) || count == 0) yield break;
        }
    }

    /// <summary>Every row following nextCursor; stops when it is absent or repeats.</summary>
    public static async IAsyncEnumerable<JsonElement> CursorRowsAsync(Func<string?, Task<JsonElement>> fetch, string? startCursor = null)
    {
        var cursor = startCursor;
        while (true)
        {
            var result = await fetch(cursor).ConfigureAwait(false);
            if (result.TryGetProperty("rows", out var rows) && rows.ValueKind == JsonValueKind.Array)
            {
                foreach (var row in rows.EnumerateArray()) yield return row;
            }
            var next = result.TryGetProperty("nextCursor", out var n) && n.ValueKind == JsonValueKind.String ? n.GetString() : null;
            if (!HasMore(result) || next is null || next == cursor) yield break;
            cursor = next;
        }
    }

    private static bool HasMore(JsonElement result) =>
        result.TryGetProperty("hasMore", out var h) && h.ValueKind == JsonValueKind.True;
}
