/// The API's two pagination shapes. Offset pages (rows, hasMore, page) address
/// rows by position; keyset pages (rows, hasMore, nextCursor) by key, so they
/// never skip or repeat when rows are inserted mid-walk.
class Pagination {
  Pagination._();

  /// Every row from [startPage]; stops on hasMore=false OR an empty page.
  static Stream<dynamic> offsetRows(Future<Map<String, dynamic>> Function(int page) fetch, {int startPage = 1}) async* {
    for (var page = startPage;; page++) {
      final result = await fetch(page);
      final rows = (result['rows'] as List?) ?? const [];
      yield* Stream.fromIterable(rows);
      if (result['hasMore'] != true || rows.isEmpty) return;
    }
  }

  /// Every row following nextCursor; stops when it is absent or repeats.
  static Stream<dynamic> cursorRows(Future<Map<String, dynamic>> Function(String? cursor) fetch,
      {String? startCursor}) async* {
    var cursor = startCursor;
    while (true) {
      final result = await fetch(cursor);
      yield* Stream.fromIterable((result['rows'] as List?) ?? const []);
      final next = result['nextCursor'] as String?;
      if (result['hasMore'] != true || next == null || next == cursor) return;
      cursor = next;
    }
  }
}
