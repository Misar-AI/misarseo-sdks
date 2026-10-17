package io.misar.seo.core;

import com.fasterxml.jackson.databind.JsonNode;

/** One Server-Sent Events frame: its {@code event:} name and JSON-decoded {@code data:}. */
public record SseEvent(String event, JsonNode data) {}
