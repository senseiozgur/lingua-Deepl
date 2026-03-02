import SwiftUI

struct HomeView: View {
    @EnvironmentObject var viewModel: TranslateViewModel
    @State private var showPicker = false
    @State private var showProgress = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Source PDF") {
                    Button("Select PDF") {
                        showPicker = true
                    }
                    .buttonStyle(.borderedProminent)

                    Text(viewModel.selectedPDFURL?.lastPathComponent ?? "No file selected")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("Target Language") {
                    TextField("Target Lang (e.g. TR, EN, DE)", text: $viewModel.targetLang)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                }

                Section {
                    Button("Translate PDF") {
                        viewModel.startTranslation()
                        showProgress = true
                    }
                    .disabled(viewModel.selectedPDFURL == nil || viewModel.targetLang.trimmingCharacters(in: .whitespaces).isEmpty)
                }

                if let message = viewModel.userMessage {
                    Section("Message") {
                        Text(message)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("LinguaFlow")
            .sheet(isPresented: $showPicker) {
                DocumentPicker { url in
                    viewModel.selectedPDFURL = url
                    showPicker = false
                }
            }
            .navigationDestination(isPresented: $showProgress) {
                ProgressScreen()
                    .environmentObject(viewModel)
            }
        }
    }
}

