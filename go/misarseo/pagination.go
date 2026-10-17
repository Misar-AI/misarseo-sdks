package misarseo

import "context"

// OffsetPage is one page of an offset-paginated endpoint.
type OffsetPage struct {
	Rows    []any
	HasMore bool
}

// CursorPage is one page of a keyset (cursor) paginated endpoint.
type CursorPage struct {
	Rows       []any
	HasMore    bool
	NextCursor string
}

// IterateOffsetPages walks pages from startPage, calling yield per row. It
// stops on HasMore false OR an empty page (a result set that shrank mid-walk
// must not loop forever against a billed endpoint), or when yield returns false.
func IterateOffsetPages(ctx context.Context, startPage int, fetch func(ctx context.Context, page int) (OffsetPage, error), yield func(row any) bool) error {
	for page := startPage; ; page++ {
		result, err := fetch(ctx, page)
		if err != nil {
			return err
		}
		for _, row := range result.Rows {
			if !yield(row) {
				return nil
			}
		}
		if !result.HasMore || len(result.Rows) == 0 {
			return nil
		}
	}
}

// IterateCursorPages follows NextCursor, stopping when it is empty or repeats.
func IterateCursorPages(ctx context.Context, startCursor string, fetch func(ctx context.Context, cursor string) (CursorPage, error), yield func(row any) bool) error {
	cursor := startCursor
	for {
		result, err := fetch(ctx, cursor)
		if err != nil {
			return err
		}
		for _, row := range result.Rows {
			if !yield(row) {
				return nil
			}
		}
		if !result.HasMore || result.NextCursor == "" || result.NextCursor == cursor {
			return nil
		}
		cursor = result.NextCursor
	}
}

// PageFrom adapts a decoded {rows, hasMore, nextCursor} response to the page types.
func PageFrom(v any) (OffsetPage, CursorPage) {
	m, _ := v.(map[string]any)
	rows, _ := m["rows"].([]any)
	hasMore, _ := m["hasMore"].(bool)
	next, _ := m["nextCursor"].(string)
	return OffsetPage{Rows: rows, HasMore: hasMore}, CursorPage{Rows: rows, HasMore: hasMore, NextCursor: next}
}
