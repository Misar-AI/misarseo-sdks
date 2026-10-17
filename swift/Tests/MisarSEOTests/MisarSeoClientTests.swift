import Foundation
#if canImport(FoundationNetworking)
// On Linux, URLProtocol, URLRequest and URLSession live here, not in Foundation.
import FoundationNetworking
#endif
import XCTest
@testable import MisarSEO

/// Serves canned replies and records every request — never the real API.
final class StubProtocol: URLProtocol {
    struct Reply { let status: Int; let body: String; let headers: [String: String] }
    nonisolated(unsafe) static var replies: [Reply] = []
    nonisolated(unsafe) static var requests: [URLRequest] = []
    nonisolated(unsafe) static var bodies: [Data] = []
    static let lock = NSLock()

    static func reset(_ replies: [Reply]) {
        lock.lock(); defer { lock.unlock() }
        self.replies = replies
        requests = []
        bodies = []
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        var body = request.httpBody ?? Data()
        if body.isEmpty, let stream = request.httpBodyStream {
            stream.open()
            let size = 4096
            var buffer = [UInt8](repeating: 0, count: size)
            while stream.hasBytesAvailable {
                let n = stream.read(&buffer, maxLength: size)
                if n <= 0 { break }
                body.append(buffer, count: n)
            }
            stream.close()
        }
        StubProtocol.lock.lock()
        StubProtocol.requests.append(request)
        StubProtocol.bodies.append(body)
        let index = min(StubProtocol.requests.count - 1, StubProtocol.replies.count - 1)
        let reply = StubProtocol.replies[index]
        StubProtocol.lock.unlock()
        let response = HTTPURLResponse(url: request.url!, statusCode: reply.status, httpVersion: "HTTP/1.1", headerFields: reply.headers)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(reply.body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

final class MisarSeoClientTests: XCTestCase {
    func makeClient(_ replies: StubProtocol.Reply...) throws -> MisarSeoClient {
        StubProtocol.reset(replies.isEmpty ? [.init(status: 200, body: "{\"ok\":true}", headers: [:])] : replies)
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubProtocol.self]
        return try MisarSeoClient(apiKey: "mseo_test", baseURL: "https://stub.test/seo", retryBaseDelay: 0.001,
                                  maxRetryDelay: 0.05, session: URLSession(configuration: config))
    }

    func header(_ r: URLRequest, _ name: String) -> String? { r.value(forHTTPHeaderField: name) }

    func query(_ r: URLRequest) -> [String: String] {
        let items = URLComponents(url: r.url!, resolvingAgainstBaseURL: false)?.queryItems ?? []
        return Dictionary(items.map { ($0.name, $0.value ?? "") }, uniquingKeysWith: { a, _ in a })
    }

    func testEveryManifestMethodHitsItsRoute() async throws {
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("../../manifest.json")
        let manifest = JSONValue.decode(try Data(contentsOf: url.standardizedFileURL))
        var count = 0
        for (resource, def) in manifest["resources"].objectValue! {
            for method in def["methods"].arrayValue! {
                count += 1
                let name = method["name"].stringValue!
                let client = try makeClient()
                let pathParams = method["pathParams"].arrayValue!.compactMap(\.stringValue)
                let required = method["requiredQuery"].arrayValue!.compactMap(\.stringValue)
                let hasBody = method["hasBody"].boolValue!
                guard let entry = GeneratedDispatch.table["\(resource).\(name)"] else {
                    return XCTFail("\(resource).\(name) not dispatchable")
                }
                let args = (0..<(pathParams.count + required.count)).map { "v/\($0)" }
                XCTAssertEqual(entry.arity, args.count)
                let out = try await entry.call(client, args, hasBody ? ["x": 1] : nil)
                XCTAssertEqual(out["ok"].boolValue, true, "\(resource).\(name)")

                let req = StubProtocol.requests[0]
                XCTAssertEqual(req.httpMethod, method["verb"].stringValue, "\(resource).\(name)")
                var want = method["path"].stringValue!
                for (i, p) in pathParams.enumerated() { want = want.replacingOccurrences(of: ":\(p)", with: "v%2F\(i)") }
                XCTAssertEqual(URLComponents(url: req.url!, resolvingAgainstBaseURL: false)!.percentEncodedPath, "/seo\(want)")
                let q = query(req)
                for (j, name) in required.enumerated() { XCTAssertEqual(q[name], "v/\(pathParams.count + j)") }
                XCTAssertEqual(!StubProtocol.bodies[0].isEmpty, hasBody, "\(resource).\(name) body")
                XCTAssertEqual(header(req, "Authorization"), "Bearer mseo_test")
                XCTAssertTrue(header(req, "User-Agent")!.hasPrefix("misarseo-swift/"))
            }
        }
        XCTAssertGreaterThan(count, 200)
    }

    func testRateLimitRetriedThenSucceeds() async throws {
        let client = try makeClient(.init(status: 429, body: "{\"error\":\"slow\",\"code\":\"RATE_LIMITED\"}", headers: [:]),
                                    .init(status: 200, body: "{\"projects\":[]}", headers: [:]))
        let out = try await client.projects.list()
        XCTAssertEqual(out["projects"].arrayValue?.count, 0)
        XCTAssertEqual(StubProtocol.requests.count, 2)
    }

    func testPlanLimitIsNotRetriedAndCarriesTheOffer() async throws {
        let client = try makeClient(.init(
            status: 429,
            body: "{\"error\":\"Limit reached.\",\"code\":\"plan_limit_exceeded\",\"upgrade\":{\"reason\":\"quota_exhausted\",\"feature\":\"keyword_lookups\",\"current_plan\":{\"slug\":\"free\"},\"urls\":{\"pricing\":\"https://seo.misar.io/subscribe\"}}}",
            headers: ["Retry-After": "3600", "X-Misar-Plan": "free", "X-Misar-Upgrade-Url": "https://seo.misar.io/subscribe?plan=pro"]))
        do {
            _ = try await client.keywords.research(body: ["projectId": "p"])
            XCTFail("expected a plan-limit error")
        } catch let e as MisarSeoPlanLimitError {
            XCTAssertEqual(StubProtocol.requests.count, 1)
            XCTAssertEqual(e.status, 429)
            XCTAssertEqual(e.code, "plan_limit_exceeded")
            XCTAssertEqual(e.reason, "quota_exhausted")
            XCTAssertEqual(e.feature, "keyword_lookups")
            XCTAssertEqual(e.plan, "free")
            XCTAssertEqual(e.upgradeURL, "https://seo.misar.io/subscribe?plan=pro")
            XCTAssertEqual(e.retryAfter, 3600)
        }
    }

    func testPlanLimit402FallsBackToTheBody() async throws {
        let client = try makeClient(.init(status: 402, body: "{\"error\":\"Locked.\",\"code\":\"plan_limit_exceeded\",\"upgrade\":{\"reason\":\"feature_locked\",\"current_plan\":{\"slug\":\"free\"},\"urls\":{\"pricing\":\"https://seo.misar.io/subscribe\"}}}", headers: [:]))
        do {
            _ = try await client.backlinks.overview(projectId: "p1", target: "example.com")
            XCTFail("expected a plan-limit error")
        } catch let e as MisarSeoPlanLimitError {
            XCTAssertEqual(e.plan, "free")
            XCTAssertEqual(e.upgradeURL, "https://seo.misar.io/subscribe")
        }
    }

    func testNotFoundKeepsTheCode() async throws {
        let client = try makeClient(.init(status: 404, body: "{\"error\":\"Project not found\",\"code\":\"NOT_FOUND\"}", headers: [:]))
        do {
            _ = try await client.projects.get(projectId: "nope")
            XCTFail("expected an error")
        } catch let e as MisarSeoError {
            XCTAssertTrue(e.isNotFound)
            XCTAssertEqual(e.code, "NOT_FOUND")
        }
    }

    func testPost503NotRetriedGet503Retried() async throws {
        var client = try makeClient(.init(status: 503, body: "{\"error\":\"down\"}", headers: [:]))
        do { _ = try await client.crawl.start(body: [:]); XCTFail() } catch {}
        XCTAssertEqual(StubProtocol.requests.count, 1)
        client = try makeClient(.init(status: 503, body: "{}", headers: [:]), .init(status: 200, body: "{}", headers: [:]))
        _ = try await client.projects.list()
        XCTAssertEqual(StubProtocol.requests.count, 2)
    }

    func testPagination() async throws {
        let pages: [Int: JSONValue] = [1: ["rows": [1, 2], "hasMore": true], 2: ["rows": [3], "hasMore": true], 3: ["rows": [], "hasMore": true]]
        let rows = try await Pagination.collectOffsetPages { pages[$0]! }
        XCTAssertEqual(rows.count, 3)
        let cursors: [String: JSONValue] = ["": ["rows": ["a"], "hasMore": true, "nextCursor": "c1"], "c1": ["rows": ["b"], "hasMore": true, "nextCursor": "c1"]]
        let rows2 = try await Pagination.collectCursorPages { cursors[$0 ?? ""]! }
        XCTAssertEqual(rows2.count, 2)
    }

    func testCrawlStreamReadsUntilComplete() async throws {
        let body = ": ping\n\nevent: progress\ndata: {\"pages\":3}\n\nevent: complete\ndata: {}\n\nevent: progress\ndata: {}\n\n"
        let client = try makeClient(.init(status: 200, body: body, headers: ["Content-Type": "text/event-stream"]))
        var names: [String] = []
        for try await ev in client.crawl.streamEvents(jobId: "a1", projectId: "p1") { names.append(ev.event) }
        XCTAssertEqual(names, ["progress", "complete"])
        XCTAssertEqual(header(StubProtocol.requests[0], "Accept"), "text/event-stream")
        XCTAssertEqual(query(StubProtocol.requests[0])["projectId"], "p1")
    }

    func testMissingKeyFailsFast() {
        XCTAssertThrowsError(try MisarSeoClient(apiKey: "", session: .shared)) { error in
            XCTAssertTrue(String(describing: error).contains("seo.misar.io") || ProcessInfo.processInfo.environment["MISARSEO_API_KEY"] != nil)
        }
    }
}
