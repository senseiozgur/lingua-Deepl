import Foundation

struct HealthResponse: Decodable {
    let ok: Bool
}

struct APIErrorResponse: Decodable {
    let error: String
}

struct CreateJobResponse: Decodable {
    let job_id: String
    let status: JobStatus
}

struct RunJobResponse: Decodable {
    let accepted: Bool
    let job_id: String
    let status: JobStatus
}

struct JobBillingResponse: Decodable {
    let request_id: String?
    let billing_request_id: String?
    let charged_units: Int?
    let charged: Bool
    let refunded: Bool
}

struct JobResponse: Decodable {
    let job_id: String
    let status: JobStatus
    let progress_pct: Int
    let output_file_path: String?
    let error_code: String?
    let billing: JobBillingResponse
}

enum JobStatus: String, Decodable {
    case PENDING
    case PROCESSING
    case READY
    case FAILED
}

enum APIClientError: LocalizedError {
    case badURL
    case invalidHTTPResponse
    case backendError(String)
    case decodingError
    case fileReadError
    case fileWriteError

    var errorDescription: String? {
        switch self {
        case .badURL:
            return "Invalid URL."
        case .invalidHTTPResponse:
            return "Invalid server response."
        case .backendError(let code):
            return code
        case .decodingError:
            return "Failed to decode response."
        case .fileReadError:
            return "Failed to read local file."
        case .fileWriteError:
            return "Failed to save file."
        }
    }
}

