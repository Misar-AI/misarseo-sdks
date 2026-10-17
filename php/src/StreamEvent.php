<?php

declare(strict_types=1);

namespace MisarSEO;

/** One Server-Sent Events frame: its `event:` name and JSON-decoded `data:`. */
final class StreamEvent
{
    public function __construct(public readonly string $event, public readonly mixed $data)
    {
    }
}
