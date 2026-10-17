# frozen_string_literal: true

module MisarSEO
  # The API's two pagination shapes. Offset pages (rows, hasMore, page)
  # address rows by position; keyset pages (rows, hasMore, nextCursor) by key,
  # so they never skip or repeat when rows are inserted mid-walk.
  module Pagination
    module_function

    # Every row of an offset-paginated endpoint, page by page.
    def collect_offset_pages(start_page = 1)
      rows = []
      page = start_page
      loop do
        result = yield(page) || {}
        batch = Array(result["rows"])
        rows.concat(batch)
        return rows if !result["hasMore"] || batch.empty?

        page += 1
      end
    end

    # Every row following nextCursor; stops when it is absent or repeats.
    def collect_cursor_pages(start_cursor = nil)
      rows = []
      cursor = start_cursor
      loop do
        result = yield(cursor) || {}
        rows.concat(Array(result["rows"]))
        nxt = result["nextCursor"]
        return rows if !result["hasMore"] || nxt.nil? || nxt == cursor

        cursor = nxt
      end
    end
  end
end
