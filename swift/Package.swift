// swift-tools-version: 5.9
//
// Local manifest, for building and testing the SDK in place. The public
// mirror (github.com/Misar-AI/misarseo-sdks) uses ../Package.swift at its
// root instead, because Swift Package Manager only resolves a package from a
// repository root. Both must describe the same targets.
import PackageDescription

let package = Package(
    name: "MisarSEO",
    platforms: [
        .macOS(.v12),
        .iOS(.v15),
        .tvOS(.v15),
        .watchOS(.v8),
    ],
    products: [
        .library(name: "MisarSEO", targets: ["MisarSEO"]),
    ],
    targets: [
        .target(name: "MisarSEO", path: "Sources/MisarSEO"),
        .testTarget(name: "MisarSEOTests", dependencies: ["MisarSEO"], path: "Tests/MisarSEOTests"),
    ]
)
