// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "RelogioGarmin",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "RelogioGarmin", targets: ["RelogioGarminPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        // Connect IQ Mobile SDK (binário oficial da Garmin). O app precisa da flag -ObjC no link.
        .package(url: "https://github.com/garmin/connectiq-companion-app-sdk-ios.git", exact: "1.8.0")
    ],
    targets: [
        .target(
            name: "RelogioGarminPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "ConnectIQ", package: "connectiq-companion-app-sdk-ios")
            ],
            path: "ios/Sources/RelogioGarminPlugin")
    ]
)
