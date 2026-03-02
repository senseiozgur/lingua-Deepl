import Foundation

final class APIClient {
    private let baseURL: URL
    private let session: URLSession
    private let decoder = JSONDecoder()

    init(baseURL: URL = AppConfig.baseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func health() async throws -> HealthResponse {
        let url = baseURL.appendingPathComponent("health")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        return try await sendJSON(request: request, expectedStatusCodes: [200], decodeAs: HealthResponse.self)
    }

    func createJob(pdfURL: URL, targetLang: String) async throws -> CreateJobResponse {
        guard let fileData = try? Data(contentsOf: pdfURL) else {
            throw APIClientError.fileReadError
        }

        let builder = MultipartFormDataBuilder()
        let body = builder.makeBody(
            pdfData: fileData,
            fileName: pdfURL.lastPathComponent,
            targetLang: targetLang
        )

        let url = baseURL.appendingPathComponent("jobs")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = body
        request.setValue("multipart/form-data; boundary=\(builder.boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue(String(body.count), forHTTPHeaderField: "Content-Length")

        return try await sendJSON(request: request, expectedStatusCodes: [201], decodeAs: CreateJobResponse.self)
    }

    func runJob(jobID: String) async throws -> RunJobResponse {
        let url = baseURL.appendingPathComponent("jobs/\(jobID)/run")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return try await sendJSON(request: request, expectedStatusCodes: [202], decodeAs: RunJobResponse.self)
    }

    func getJob(jobID: String) async throws -> JobResponse {
        let url = baseURL.appendingPathComponent("jobs/\(jobID)")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return try await sendJSON(request: request, expectedStatusCodes: [200], decodeAs: JobResponse.self)
    }

    func downloadOutput(jobID: String) async throws -> URL {
        let url = baseURL.appendingPathComponent("jobs/\(jobID)/output")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidHTTPResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw parseBackendError(data: data, statusCode: httpResponse.statusCode)
        }

        let docsDirectory = try FileManager.default.url(
            for: .documentDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let folderURL = docsDirectory.appendingPathComponent("linguaflow", isDirectory: true)
        try FileManager.default.createDirectory(at: folderURL, withIntermediateDirectories: true)
        let fileURL = folderURL.appendingPathComponent("\(jobID).pdf")

        do {
            try data.write(to: fileURL, options: .atomic)
            return fileURL
        } catch {
            throw APIClientError.fileWriteError
        }
    }

    private func sendJSON<T: Decodable>(
        request: URLRequest,
        expectedStatusCodes: Set<Int>,
        decodeAs type: T.Type
    ) async throws -> T {
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidHTTPResponse
        }

        guard expectedStatusCodes.contains(httpResponse.statusCode) else {
            throw parseBackendError(data: data, statusCode: httpResponse.statusCode)
        }

        guard let decoded = try? decoder.decode(T.self, from: data) else {
            throw APIClientError.decodingError
        }
        return decoded
    }

    private func parseBackendError(data: Data, statusCode: Int) -> APIClientError {
        if let parsed = try? decoder.decode(APIErrorResponse.self, from: data) {
            return .backendError(parsed.error)
        }
        return .backendError("http_\(statusCode)")
    }
}

