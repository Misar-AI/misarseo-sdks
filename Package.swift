// swift-tools-version: 5.9
//
// This manifest exists for the PUBLIC MIRROR repository
// (github.com/Misar-AI/misarseo-sdks), not for this monorepo.
//
// Swift Package Manager requires Package.swift at the repository ROOT and has
// no notion of a package living in a subdirectory — so the mirror's root
// manifest reaches down into swift/ for its sources. sdks/swift/Package.swift
// remains the local manifest, used for building and testing in place. Both
// must describe the same targets — if you add one here, add it there.
import PackageDescription

let package = Package(
    name: "MisarSEO",
    platforms: [.iOS(.v15), .macOS(.v12), .tvOS(.v15), .watchOS(.v8)],
    products: [
        .library(name: "MisarSEO", targets: ["MisarSEO"]),
    ],
    dependencies: [],
    targets: [
        .target(name: "MisarSEO", path: "swift/Sources/MisarSEO"),
        .testTarget(name: "MisarSEOTests", dependencies: ["MisarSEO"], path: "swift/Tests/MisarSEOTests"),
    ]
)
