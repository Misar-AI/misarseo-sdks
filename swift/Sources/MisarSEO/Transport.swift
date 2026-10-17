import Foundation

// On Linux, URLSession/URLRequest/HTTPURLResponse live in FoundationNetworking,
// and swift-corelibs-foundation has no async `data(for:)` or `bytes(for:)`.
// Bridging the completion-handler API keeps one implementation everywhere.
#if canImport(FoundationNetworking)
import FoundationNetworking

extension URLSession {
    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await withCheckedThrowingContinuation { continuation in
            let task = dataTask(with: request) { data, response, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let data, let response {
                    continuation.resume(returning: (data, response))
                } else {
                    continuation.resume(throwing: URLError(.badServerResponse))
                }
            }
            task.resume()
        }
    }
}
#endif

/// Request plumbing the generated resources are written against.
///
/// Retry policy, identical in every MisarSEO SDK: 429 is retried for every
/// verb unless the body says `plan_limit_exceeded`; 502/503/504 and network
/// failures are retried for GET only (a POST may have started a billed crawl);
/// backoff starts at 250 ms with jitter and honours `Retry-After` up to the
/// configured cap.
struct Transport: Sendable {
    let apiKey: String
    let baseURL: String
    let timeout: TimeInterval
    let maxRetries: Int
    let retryBaseDelay: TimeInterval
    let maxRetryDelay: TimeInterval
    let session: URLSession

    init(apiKey: String, baseURL: String, timeout: TimeInterval, maxRetries: Int, retryBaseDelay: TimeInterval,
         maxRetryDelay: TimeInterval, session: URLSession) {
        self.apiKey = apiKey
        self.baseURL = baseURL.hasSuffix("/") ? String(baseURL.dropLast()) : baseURL
        self.timeout = timeout
        self.maxRetries = maxRetries
        self.retryBaseDelay = retryBaseDelay
        self.maxRetryDelay = maxRetryDelay
        self.session = session
    }

    private static let unreserved = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")

    /// Encode one path segment (or query component).
    static func seg(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: unreserved) ?? value
    }

    /// Required query parameters first; an explicit key in `query` wins.
    static func merge(_ query: [String: String]?, _ required: [String: String]) -> [String: String] {
        required.merging(query ?? [:]) { _, explicit in explicit }
    }

    private func url(_ path: String, _ query: [String: String]?) -> URL {
        var s = baseURL + path
        if let q = query, !q.isEmpty {
            s += "?" + q.keys.sorted().map { "\(Transport.seg($0))=\(Transport.seg(q[$0]!))" }.joined(separator: "&")
        }
        return URL(string: s)!
    }

    private func makeRequest(_ method: String, _ url: URL, accept: String) -> URLRequest {
        var r = URLRequest(url: url, timeoutInterval: timeout)
        r.httpMethod = method
        r.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        r.setValue(accept, forHTTPHeaderField: "Accept")
        r.setValue("misarseo-swift/\(MisarSeoClient.version)", forHTTPHeaderField: "User-Agent")
        return r
    }

    private func backoff(_ attempt: Int, retryAfter: Int?) -> TimeInterval? {
        if let s = retryAfter { return TimeInterval(s) > maxRetryDelay ? nil : TimeInterval(s) }
        let base = retryBaseDelay * pow(2, Double(attempt))
        return min(maxRetryDelay, base / 2 + Double.random(in: 0...(base / 2)))
    }

    /// The error for a non-2xx response; the plan-limit code is checked BEFORE the status.
    static func error(status: Int, headers: [AnyHashable: Any], data: Data) -> Error {
        let body = JSONValue.decode(data)
        let message = body["error"].stringValue ?? body["message"].stringValue ?? "HTTP \(status)"
        let code = body["code"].stringValue ?? "API_ERROR"
        func header(_ name: String) -> String? {
            headers.first { ($0.key as? String)?.lowercased() == name }.flatMap { $0.value as? String }
        }
        let retryAfter = header("retry-after").flatMap { Int($0.trimmingCharacters(in: .whitespaces)) }
        if code == planLimitCode {
            let offer = body["upgrade"]
            return MisarSeoPlanLimitError(
                status: status, message: message, offer: offer,
                plan: header("x-misar-plan") ?? offer["current_plan"]["slug"].stringValue,
                upgradeURL: header("x-misar-upgrade-url") ?? offer["urls"]["pricing"].stringValue,
                retryAfter: retryAfter)
        }
        return MisarSeoError(status: status, code: code, message: message, body: body, retryAfter: retryAfter)
    }

    func request(_ method: String, _ path: String, query: [String: String]?, body: JSONValue?) async throws -> JSONValue {
        var request = makeRequest(method, url(path, query), accept: "application/json")
        if let body = body { request.httpBody = try body.encoded() }
        var attempt = 0
        while true {
            let data: Data
            let response: URLResponse
            do {
                (data, response) = try await session.data(for: request)
            } catch {
                if method == "GET", attempt < maxRetries, let wait = backoff(attempt, retryAfter: nil) {
                    try await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
                    attempt += 1
                    continue
                }
                throw MisarSeoError(status: 0, code: "NETWORK_ERROR",
                                    message: "could not reach the MisarSEO API: \(error.localizedDescription)", body: .null, retryAfter: nil)
            }
            let http = response as? HTTPURLResponse
            let status = http?.statusCode ?? 0
            if (200..<300).contains(status) { return JSONValue.decode(data) }
            let err = Transport.error(status: status, headers: http?.allHeaderFields ?? [:], data: data)
            let retryable = status == 429 || (method == "GET" && [502, 503, 504].contains(status))
            if err is MisarSeoPlanLimitError || !retryable || attempt >= maxRetries { throw err }
            guard let wait = backoff(attempt, retryAfter: (err as? MisarSeoError)?.retryAfter) else { throw err }
            try await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
            attempt += 1
        }
    }

    /// Decode one SSE frame; nil for keep-alive comments and frames without an event line.
    static func parseFrame(_ frame: String) -> SseEvent? {
        var event: String?
        var data: [String] = []
        for line in frame.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n") {
            if line.isEmpty || line.hasPrefix(":") { continue }
            if line.hasPrefix("event:") {
                event = String(line.dropFirst(6)).trimmingCharacters(in: .whitespaces)
            } else if line.hasPrefix("data:") {
                data.append(String(String(line.dropFirst(5)).drop(while: { $0 == " " })))
            }
        }
        guard let name = event else { return nil }
        return SseEvent(event: name, data: JSONValue.decode(Data(data.joined(separator: "\n").utf8)))
    }

    /// Opens the SSE connection through a data delegate — `bytes(for:)` does not
    /// exist in swift-corelibs-foundation — and yields frames as they arrive.
    /// Never retried: replaying a stream would duplicate what was consumed.
    func stream(_ path: String, query: [String: String]?, terminal: [String]) -> AsyncThrowingStream<SseEvent, Error> {
        let request = makeRequest("GET", url(path, query), accept: "text/event-stream")
        let configuration = session.configuration
        return AsyncThrowingStream { continuation in
            let queue = OperationQueue()
            queue.maxConcurrentOperationCount = 1
            let state = SSEState()
            let separator = Data("\n\n".utf8)
            let delegate = SSEChunkDelegate(
                onResponse: { http in
                    state.status = http.statusCode
                    state.headers = http.allHeaderFields
                },
                onChunk: { chunk in
                    guard (200..<300).contains(state.status) else {
                        state.errorBody.append(chunk)
                        return
                    }
                    guard !state.finished else { return }
                    state.buffer.append(Data(chunk.filter { $0 != UInt8(ascii: "\r") }))
                    while let range = state.buffer.range(of: separator) {
                        let frame = String(decoding: state.buffer[state.buffer.startIndex..<range.lowerBound], as: UTF8.self)
                        state.buffer.removeSubrange(state.buffer.startIndex..<range.upperBound)
                        guard let ev = Transport.parseFrame(frame) else { continue }
                        continuation.yield(ev)
                        if terminal.contains(ev.event) {
                            state.finished = true
                            continuation.finish()
                            return
                        }
                    }
                },
                onComplete: { error in
                    guard !state.finished else { return }
                    state.finished = true
                    if let error {
                        continuation.finish(throwing: MisarSeoError(
                            status: 0, code: "NETWORK_ERROR", message: error.localizedDescription, body: .null, retryAfter: nil))
                        return
                    }
                    if !(200..<300).contains(state.status) {
                        continuation.finish(throwing: Transport.error(status: state.status, headers: state.headers, data: state.errorBody))
                        return
                    }
                    if let ev = Transport.parseFrame(String(decoding: state.buffer, as: UTF8.self)) {
                        continuation.yield(ev)
                    }
                    continuation.finish()
                }
            )
            // The caller's configuration (timeouts, proxies, protocolClasses), so
            // an injected session's behaviour applies to the stream too.
            let streamSession = URLSession(configuration: configuration, delegate: delegate, delegateQueue: queue)
            let task = streamSession.dataTask(with: request)
            continuation.onTermination = { _ in
                task.cancel()
                // Invalidation waits for the delegate queue, which is where the
                // stream usually finishes — doing it inline would deadlock.
                DispatchQueue.global().async { streamSession.finishTasksAndInvalidate() }
            }
            task.resume()
        }
    }
}

/// Mutable SSE parse state, confined to the delegate's serial queue.
final class SSEState: @unchecked Sendable {
    var status = 0
    var headers: [AnyHashable: Any] = [:]
    var buffer = Data()
    var errorBody = Data()
    var finished = false
}

/// Bridges `URLSession`'s delegate callbacks into chunk callbacks.
final class SSEChunkDelegate: NSObject, URLSessionDataDelegate, @unchecked Sendable {
    private let onResponse: (HTTPURLResponse) -> Void
    private let onChunk: (Data) -> Void
    private let onComplete: (Error?) -> Void

    init(onResponse: @escaping (HTTPURLResponse) -> Void, onChunk: @escaping (Data) -> Void,
         onComplete: @escaping (Error?) -> Void) {
        self.onResponse = onResponse
        self.onChunk = onChunk
        self.onComplete = onComplete
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        if let http = response as? HTTPURLResponse { onResponse(http) }
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        onChunk(data)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        onComplete(error)
    }
}
