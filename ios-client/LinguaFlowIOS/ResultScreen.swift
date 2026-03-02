import SwiftUI
import UIKit

struct ResultScreen: View {
    let jobID: String
    let fileURL: URL

    @State private var showPreview = false
    @State private var showShare = false

    var body: some View {
        VStack(spacing: 16) {
            Text("Translation Ready")
                .font(.title2.bold())

            Text("Job ID: \(jobID)")
                .font(.footnote)
                .foregroundStyle(.secondary)

            Text(fileURL.lastPathComponent)
                .font(.body)

            Button("Open PDF") {
                showPreview = true
            }
            .buttonStyle(.borderedProminent)

            Button("Share PDF") {
                showShare = true
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .sheet(isPresented: $showPreview) {
            QuickLookPreview(fileURL: fileURL)
        }
        .sheet(isPresented: $showShare) {
            ShareSheet(items: [fileURL])
        }
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

