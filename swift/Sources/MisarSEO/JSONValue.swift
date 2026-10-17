import Foundation

/// A decoded JSON value. Responses are returned as `JSONValue` and request
/// bodies are passed as one — dictionary, array and scalar literals convert
/// implicitly, so `body: ["projectId": "p1", "keywords": ["seo"]]` just works.
public enum JSONValue: Sendable, Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    /// `value["key"]` on an object, `.null` otherwise.
    public subscript(key: String) -> JSONValue {
        if case .object(let o) = self { return o[key] ?? .null }
        return .null
    }

    /// `value[0]` on an array, `.null` otherwise.
    public subscript(index: Int) -> JSONValue {
        if case .array(let a) = self, a.indices.contains(index) { return a[index] }
        return .null
    }

    public var stringValue: String? { if case .string(let s) = self { return s }; return nil }
    public var doubleValue: Double? { if case .number(let n) = self { return n }; return nil }
    public var intValue: Int? { doubleValue.map { Int($0) } }
    public var boolValue: Bool? { if case .bool(let b) = self { return b }; return nil }
    public var arrayValue: [JSONValue]? { if case .array(let a) = self { return a }; return nil }
    public var objectValue: [String: JSONValue]? { if case .object(let o) = self { return o }; return nil }
    public var isNull: Bool { self == .null }

    /// From a `JSONSerialization` result.
    public init(any value: Any?) {
        switch value {
        case nil, is NSNull: self = .null
        case let n as NSNumber:
            // JSONSerialization boxes booleans as NSNumber too; the ObjC type
            // encoding ("c" for BOOL) is what tells them apart.
            self = String(cString: n.objCType) == "c" ? .bool(n.boolValue) : .number(n.doubleValue)
        case let s as String: self = .string(s)
        case let a as [Any]: self = .array(a.map { JSONValue(any: $0) })
        case let o as [String: Any]: self = .object(o.mapValues { JSONValue(any: $0) })
        default: self = .string(String(describing: value!))
        }
    }

    /// Decode JSON bytes; non-JSON text becomes `.string`, empty becomes `.null`.
    public static func decode(_ data: Data) -> JSONValue {
        if data.isEmpty { return .null }
        if let any = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) {
            return JSONValue(any: any)
        }
        return .string(String(decoding: data, as: UTF8.self))
    }

    var foundation: Any {
        switch self {
        case .null: return NSNull()
        case .bool(let b): return b
        case .number(let n): return n
        case .string(let s): return s
        case .array(let a): return a.map(\.foundation)
        case .object(let o): return o.mapValues(\.foundation)
        }
    }

    /// Encode to JSON bytes.
    public func encoded() throws -> Data {
        try JSONSerialization.data(withJSONObject: foundation, options: [.fragmentsAllowed, .sortedKeys])
    }
}

extension JSONValue: ExpressibleByNilLiteral, ExpressibleByBooleanLiteral, ExpressibleByIntegerLiteral,
    ExpressibleByFloatLiteral, ExpressibleByStringLiteral, ExpressibleByArrayLiteral, ExpressibleByDictionaryLiteral {
    public init(nilLiteral: ()) { self = .null }
    public init(booleanLiteral value: Bool) { self = .bool(value) }
    public init(integerLiteral value: Int) { self = .number(Double(value)) }
    public init(floatLiteral value: Double) { self = .number(value) }
    public init(stringLiteral value: String) { self = .string(value) }
    public init(arrayLiteral elements: JSONValue...) { self = .array(elements) }
    public init(dictionaryLiteral elements: (String, JSONValue)...) {
        self = .object(Dictionary(elements, uniquingKeysWith: { _, last in last }))
    }
}
