package io.misar.seo.core

import com.fasterxml.jackson.databind.JsonNode

/** One Server-Sent Events frame: its `event:` name and JSON-decoded `data:`. */
data class SseEvent(val event: String, val data: JsonNode?)
