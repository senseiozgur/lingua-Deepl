import Foundation
import SwiftUI

@MainActor
final class TranslateViewModel: ObservableObject {
    @Published var selectedPDFURL: URL?
    @Published var targetLang: String = "TR"
    @Published var jobID: String?
    @Published var jobStatus: JobStatus?
    @Published var progress: Int = 0
    @Published var errorCode: String?
    @Published var downloadedFileURL: URL?
    @Published var isProcessing = false
    @Published var isShowingResult = false
    @Published var userMessage: String?

    private let apiClient = APIClient()
    private var pollingTask: Task<Void, Never>?

    func startTranslation() {
        guard let selectedPDFURL else {
            userMessage = "Please select a PDF file."
            return
        }

        isProcessing = true
        userMessage = nil
        errorCode = nil
        downloadedFileURL = nil
        isShowingResult = false

        Task {
            do {
                let created = try await apiClient.createJob(pdfURL: selectedPDFURL, targetLang: targetLang)
                jobID = created.job_id
                jobStatus = created.status
                progress = 0

                do {
                    _ = try await apiClient.runJob(jobID: created.job_id)
                    startPolling(jobID: created.job_id)
                } catch APIClientError.backendError(let code) where code == "job_already_running" {
                    startPolling(jobID: created.job_id)
                } catch {
                    isProcessing = false
                    userMessage = displayMessage(for: error)
                }
            } catch {
                isProcessing = false
                userMessage = displayMessage(for: error)
            }
        }
    }

    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }

    private func startPolling(jobID: String) {
        pollingTask?.cancel()
        pollingTask = Task {
            while !Task.isCancelled {
                do {
                    let job = try await apiClient.getJob(jobID: jobID)
                    self.jobStatus = job.status
                    self.progress = job.progress_pct

                    switch job.status {
                    case .READY:
                        do {
                            let fileURL = try await apiClient.downloadOutput(jobID: jobID)
                            downloadedFileURL = fileURL
                            isShowingResult = true
                            isProcessing = false
                            stopPolling()
                            return
                        } catch APIClientError.backendError(let code) where code == "job_not_ready" {
                            // READY can race output availability; keep polling.
                            break
                        } catch {
                            isProcessing = false
                            userMessage = displayMessage(for: error)
                            stopPolling()
                            return
                        }
                    case .FAILED:
                        // Display only normalized error_code from backend.
                        errorCode = job.error_code ?? "PROVIDER_UNKNOWN"
                        isProcessing = false
                        stopPolling()
                        return
                    case .PENDING, .PROCESSING:
                        break
                    }
                } catch {
                    isProcessing = false
                    userMessage = displayMessage(for: error)
                    stopPolling()
                    return
                }

                try? await Task.sleep(nanoseconds: AppConfig.pollIntervalSeconds * 1_000_000_000)
            }
        }
    }

    private func displayMessage(for error: Error) -> String {
        if let apiError = error as? APIClientError {
            switch apiError {
            case .backendError(let code):
                return code
            default:
                return "client_error"
            }
        }
        return "client_error"
    }
}
