// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "wkc",
    platforms: [.macOS(.v15)],
    products: [
        .executable(name: "wkc", targets: ["wkc"])
    ],
    targets: [
        .executableTarget(
            name: "wkc",
            path: "Sources/wkc"
        )
    ]
)
