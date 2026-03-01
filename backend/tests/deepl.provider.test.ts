import { DeepLProvider } from "../src/providers/deepl.provider";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("DeepLProvider document flow", () => {
  it("runs upload -> poll -> download in order", async () => {
    const fetchFn = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse({ document_id: "doc-1", document_key: "key-1" }))
      .mockResolvedValueOnce(jsonResponse({ status: "done" }))
      .mockResolvedValueOnce(new Response(Buffer.from("translated-pdf"), { status: 200 }));

    const provider = new DeepLProvider({
      apiKey: "k",
      baseUrl: "https://api-free.deepl.com",
      pollIntervalMs: 1,
      pollTimeoutMs: 1000,
      httpTimeoutMs: 1000,
      fetchFn
    });

    const result = await provider.translateDocument({
      fileBuffer: Buffer.from("pdf"),
      fileName: "input.pdf",
      targetLang: "TR"
    });

    expect(result.outputBuffer.toString()).toBe("translated-pdf");
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(fetchFn.mock.calls[0][0]).toBe("https://api-free.deepl.com/v2/document");
    expect(fetchFn.mock.calls[1][0]).toBe("https://api-free.deepl.com/v2/document/doc-1");
    expect(fetchFn.mock.calls[2][0]).toBe("https://api-free.deepl.com/v2/document/doc-1/result");
  });

  it("maps 429, quota 456 and timeout errors", async () => {
    const tooManyReqProvider = new DeepLProvider({
      apiKey: "k",
      baseUrl: "https://api-free.deepl.com",
      pollIntervalMs: 1,
      pollTimeoutMs: 1000,
      httpTimeoutMs: 1000,
      fetchFn: jest.fn().mockResolvedValue(new Response("", { status: 429 }))
    });
    await expect(
      tooManyReqProvider.translateDocument({
        fileBuffer: Buffer.from("pdf"),
        fileName: "x.pdf",
        targetLang: "TR"
      })
    ).rejects.toBeDefined();
    const rateErr = tooManyReqProvider.normalizeError(
      await tooManyReqProvider
        .translateDocument({
          fileBuffer: Buffer.from("pdf"),
          fileName: "x.pdf",
          targetLang: "TR"
        })
        .catch((e) => e)
    );
    expect(rateErr.code).toBe("PROVIDER_RATE_LIMIT");

    const quotaProvider = new DeepLProvider({
      apiKey: "k",
      baseUrl: "https://api-free.deepl.com",
      pollIntervalMs: 1,
      pollTimeoutMs: 1000,
      httpTimeoutMs: 1000,
      fetchFn: jest.fn().mockResolvedValue(new Response("", { status: 456 }))
    });
    const quotaErr = quotaProvider.normalizeError(
      await quotaProvider
        .translateDocument({
          fileBuffer: Buffer.from("pdf"),
          fileName: "x.pdf",
          targetLang: "TR"
        })
        .catch((e) => e)
    );
    expect(quotaErr.code).toBe("PROVIDER_QUOTA_EXCEEDED");

    const timeoutProvider = new DeepLProvider({
      apiKey: "k",
      baseUrl: "https://api-free.deepl.com",
      pollIntervalMs: 1,
      pollTimeoutMs: 1000,
      httpTimeoutMs: 1000,
      fetchFn: jest.fn().mockRejectedValue(new DOMException("aborted", "AbortError"))
    });
    const timeoutErr = timeoutProvider.normalizeError(
      await timeoutProvider
        .translateDocument({
          fileBuffer: Buffer.from("pdf"),
          fileName: "x.pdf",
          targetLang: "TR"
        })
        .catch((e) => e)
    );
    expect(timeoutErr.code).toBe("PROVIDER_TIMEOUT");
  });
});

