import SwiftUI

struct ProgressScreen: View {
    @EnvironmentObject var viewModel: TranslateViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showResult = false

    var body: some View {
        VStack(spacing: 20) {
            Text("Translation Progress")
                .font(.title2.bold())

            Text("Job ID: \(viewModel.jobID ?? "-")")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            ProgressView(value: Double(viewModel.progress), total: 100)
                .padding(.horizontal)
            Text("\(viewModel.progress)%")
                .font(.headline)

            Text("Status: \(viewModel.jobStatus?.rawValue ?? "PENDING")")
                .font(.body)

            if let errorCode = viewModel.errorCode {
                Text("Failed: \(errorCode)")
                    .foregroundStyle(.red)
            }

            if let message = viewModel.userMessage {
                Text(message)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }

            Button("Close") {
                viewModel.stopPolling()
                dismiss()
            }
            .buttonStyle(.bordered)
            .padding(.top, 8)
        }
        .padding()
        .navigationDestination(isPresented: $showResult) {
            if let fileURL = viewModel.downloadedFileURL, let jobID = viewModel.jobID {
                ResultScreen(jobID: jobID, fileURL: fileURL)
            }
        }
        .onChange(of: viewModel.isShowingResult) { show in
            if show {
                showResult = true
            }
        }
    }
}

