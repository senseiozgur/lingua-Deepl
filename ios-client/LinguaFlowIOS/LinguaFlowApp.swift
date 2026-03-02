import SwiftUI

@main
struct LinguaFlowApp: App {
    @StateObject private var viewModel = TranslateViewModel()

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environmentObject(viewModel)
        }
    }
}

