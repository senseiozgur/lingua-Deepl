import Foundation

enum AppConfig {
    // Update this when running against a different backend host.
    static let baseURL = URL(string: "http://localhost:3000")!
    static let pollIntervalSeconds: UInt64 = 2
}

