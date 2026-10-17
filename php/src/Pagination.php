<?php

declare(strict_types=1);

namespace MisarSEO;

/**
 * The API's two pagination shapes. Offset pages (rows, hasMore, page) address
 * rows by position; keyset pages (rows, hasMore, nextCursor) by key, so they
 * never skip or repeat when rows are inserted mid-walk.
 */
final class Pagination
{
    /**
     * Every row from $startPage; stops on hasMore=false OR an empty page.
     *
     * @param callable(int): array<string, mixed> $fetch
     * @return \Generator<int, mixed>
     */
    public static function offsetRows(callable $fetch, int $startPage = 1): \Generator
    {
        for ($page = $startPage;; $page++) {
            $result = $fetch($page);
            $rows = $result['rows'] ?? [];
            yield from $rows;
            if (empty($result['hasMore']) || $rows === []) {
                return;
            }
        }
    }

    /**
     * Every row following nextCursor; stops when it is absent or repeats.
     *
     * @param callable(?string): array<string, mixed> $fetch
     * @return \Generator<int, mixed>
     */
    public static function cursorRows(callable $fetch, ?string $startCursor = null): \Generator
    {
        $cursor = $startCursor;
        while (true) {
            $result = $fetch($cursor);
            yield from $result['rows'] ?? [];
            $next = $result['nextCursor'] ?? null;
            if (empty($result['hasMore']) || $next === null || $next === $cursor) {
                return;
            }
            $cursor = $next;
        }
    }
}
