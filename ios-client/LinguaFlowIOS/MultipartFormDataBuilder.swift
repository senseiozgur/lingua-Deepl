import Foundation

struct MultipartFormDataBuilder {
    let boundary: String = "Boundary-\(UUID().uuidString)"

    func makeBody(pdfData: Data, fileName: String, targetLang: String) -> Data {
        var body = Data()

        appendField(name: "target_lang", value: targetLang, to: &body)
        appendFileField(
            name: "file",
            fileName: fileName,
            mimeType: "application/pdf",
            fileData: pdfData,
            to: &body
        )
        body.appendString("--\(boundary)--\r\n")
        return body
    }

    private func appendField(name: String, value: String, to body: inout Data) {
        body.appendString("--\(boundary)\r\n")
        body.appendString("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n")
        body.appendString("\(value)\r\n")
    }

    private func appendFileField(
        name: String,
        fileName: String,
        mimeType: String,
        fileData: Data,
        to body: inout Data
    ) {
        body.appendString("--\(boundary)\r\n")
        body.appendString("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(fileName)\"\r\n")
        body.appendString("Content-Type: \(mimeType)\r\n\r\n")
        body.append(fileData)
        body.appendString("\r\n")
    }
}

private extension Data {
    mutating func appendString(_ string: String) {
        if let data = string.data(using: .utf8) {
            append(data)
        }
    }
}

