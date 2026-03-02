# LinguaFlow iOS Setup (SwiftUI Files Only)

This folder contains Swift source files for an iOS client that matches the current backend API contract.

## 1) Create a new Xcode app (on macOS)

1. Open Xcode.
2. Create a new project:
   - iOS App
   - Interface: SwiftUI
   - Language: Swift
3. Close Xcode-generated sample views if needed.

## 2) Copy files into your project

Copy all files from:

- `ios-client/LinguaFlowIOS/`

Into your Xcode project target.

Files:
- `AppConfig.swift`
- `Models.swift`
- `APIClient.swift`
- `MultipartFormDataBuilder.swift`
- `TranslateViewModel.swift`
- `DocumentPicker.swift`
- `QuickLookPreview.swift`
- `HomeView.swift`
- `ProgressScreen.swift`
- `ResultScreen.swift`
- `LinguaFlowApp.swift`

## 3) Set backend base URL

In `AppConfig.swift`, update:

```swift
static let baseURL = URL(string: "http://localhost:3000")!
```

Examples:
- iOS Simulator -> host machine backend commonly works with `http://127.0.0.1:3000` only if backend runs inside simulator host context.
- Physical device -> use your machine LAN IP, e.g. `http://192.168.1.10:3000`.

## 4) Backend API expected by client

This client targets:
- `GET /health`
- `POST /jobs`
- `POST /jobs/:id/run`
- `GET /jobs/:id`
- `GET /jobs/:id/output`

The app:
- uploads a PDF with multipart/form-data,
- runs the job,
- polls every 2 seconds,
- handles `job_already_running` by continuing polling,
- downloads translated PDF on `READY`,
- saves to `Documents/linguaflow/<job_id>.pdf`,
- opens with QuickLook and supports share sheet.

