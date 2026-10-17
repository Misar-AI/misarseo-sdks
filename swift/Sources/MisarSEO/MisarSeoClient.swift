import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// MisarSEO API client. Every resource is a property — `client.projects`,
/// `client.rankTracking`, `client.aiSearch` … — whose methods are `async throws`.
///
/// ```swift
/// let client = try MisarSeoClient(apiKey: ProcessInfo.processInfo.environment["MISARSEO_API_KEY"])
/// let projects = try await client.projects.list()
/// ```
public final class MisarSeoClient: Sendable {
    public static let version = "1.0.0"
    public static let defaultBaseURL = "https://api.misar.io/seo"

    let transport: Transport

    /// - Parameters:
    ///   - apiKey: a `mseo_` key; nil or empty falls back to `MISARSEO_API_KEY`.
    ///   - baseURL: defaults to https://api.misar.io/seo.
    ///   - session: the `URLSession` to use (inject one with a stub protocol in tests).
    public init(
        apiKey: String? = nil,
        baseURL: String = MisarSeoClient.defaultBaseURL,
        timeout: TimeInterval = 30,
        maxRetries: Int = 2,
        retryBaseDelay: TimeInterval = 0.25,
        maxRetryDelay: TimeInterval = 60,
        session: URLSession = .shared
    ) throws {
        let key = (apiKey?.isEmpty == false ? apiKey : ProcessInfo.processInfo.environment["MISARSEO_API_KEY"]) ?? ""
        guard !key.isEmpty else {
            throw MisarSeoError(status: 0, code: "CONFIG_ERROR",
                                message: "A MisarSEO API key (mseo_…) is required: pass it or set MISARSEO_API_KEY; see https://seo.misar.io/ai",
                                body: .null, retryAfter: nil)
        }
        transport = Transport(apiKey: key, baseURL: baseURL, timeout: timeout, maxRetries: maxRetries,
                              retryBaseDelay: retryBaseDelay, maxRetryDelay: maxRetryDelay, session: session)
    }
}

/// One Server-Sent Events frame: its `event:` name and JSON-decoded `data:`.
public struct SseEvent: Sendable, Equatable {
    public let event: String
    public let data: JSONValue
}

/// The API's two pagination shapes. Offset pages (`rows, hasMore, page`)
/// address rows by position; keyset pages (`rows, hasMore, nextCursor`) by
/// key, so they never skip or repeat when rows are inserted mid-walk.
public enum Pagination {
    /// Every row from `startPage`; stops on hasMore=false OR an empty page.
    public static func collectOffsetPages(startPage: Int = 1, _ fetch: (Int) async throws -> JSONValue) async throws -> [JSONValue] {
        var out: [JSONValue] = []
        var page = startPage
        while true {
            let result = try await fetch(page)
            let rows = result["rows"].arrayValue ?? []
            out += rows
            if result["hasMore"].boolValue != true || rows.isEmpty { return out }
            page += 1
        }
    }

    /// Every row following `nextCursor`; stops when it is absent or repeats.
    public static func collectCursorPages(startCursor: String? = nil, _ fetch: (String?) async throws -> JSONValue) async throws -> [JSONValue] {
        var out: [JSONValue] = []
        var cursor = startCursor
        while true {
            let result = try await fetch(cursor)
            out += result["rows"].arrayValue ?? []
            let next = result["nextCursor"].stringValue
            if result["hasMore"].boolValue != true || next == nil || next == cursor { return out }
            cursor = next
        }
    }
}
