// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ZenoApp",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "ZenoApp",
            targets: ["ZenoApp"]
        ),
    ],
    targets: [
        .target(
            name: "ZenoApp",
            path: "Sources/ZenoApp"
        ),
    ]
)
