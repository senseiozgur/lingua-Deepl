import fs from "fs/promises";
import os from "os";
import path from "path";
import { BillingAdapter } from "../src/billing/billing.adapter";
import { JobRunner } from "../src/jobs/job.runner";
import { JobStore } from "../src/jobs/job.store";
import { ProviderExecutionError, TranslationProvider } from "../src/providers/provider.interface";
import { LocalStorage } from "../src/storage/local.storage";

function createFailingProvider(): TranslationProvider {
  return {
    translateDocument: jest
      .fn()
      .mockRejectedValue(new ProviderExecutionError({ code: "PROVIDER_RATE_LIMIT" })),
    translateText: jest.fn(),
    detectLanguage: jest.fn(),
    getUsage: jest.fn(),
    normalizeError: jest.fn().mockReturnValue({ code: "PROVIDER_RATE_LIMIT" })
  };
}

describe("JobRunner billing behavior", () => {
  it("charges once with request_id and refunds once on provider failure after charge", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "deepl-mvp-"));
    const storage = new LocalStorage(tmp);
    const jobs = new JobStore();
    const job = jobs.create({
      status: "PENDING",
      progress_pct: 0,
      input_file_path: "",
      output_file_path: null,
      file_name: "a.pdf",
      source_lang: null,
      target_lang: "TR",
      error_code: null,
      billing: {
        request_id: null,
        billing_request_id: null,
        charged_units: 0,
        charged: false,
        refunded: false
      }
    });
    const inputPath = await storage.saveInput(job.id, job.file_name, Buffer.from("fake-pdf"));
    jobs.update(job.id, { input_file_path: inputPath });

    const billing: BillingAdapter = {
      charge: jest.fn().mockResolvedValue({
        billing_request_id: "billing-1",
        charged_units: 1,
        already_charged: false
      }),
      refund: jest.fn().mockResolvedValue({
        refund_id: "refund-1",
        refunded: true
      })
    };
    const provider = createFailingProvider();
    const runner = new JobRunner(jobs, provider, billing, storage);

    await runner.run(job.id);

    expect(billing.charge).toHaveBeenCalledTimes(1);
    expect(billing.refund).toHaveBeenCalledTimes(1);

    const chargeInput = (billing.charge as jest.Mock).mock.calls[0][0];
    const refundInput = (billing.refund as jest.Mock).mock.calls[0][0];
    expect(chargeInput.request_id).toBeDefined();
    expect(refundInput.request_id).toBe(chargeInput.request_id);

    const updated = jobs.get(job.id);
    expect(updated?.status).toBe("FAILED");
    expect(updated?.billing.refunded).toBe(true);
    expect(updated?.error_code).toBe("PROVIDER_RATE_LIMIT");
  });

  it("does not charge again when run is retried after terminal failure", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "deepl-mvp-"));
    const storage = new LocalStorage(tmp);
    const jobs = new JobStore();
    const job = jobs.create({
      status: "PENDING",
      progress_pct: 0,
      input_file_path: "",
      output_file_path: null,
      file_name: "a.pdf",
      source_lang: null,
      target_lang: "TR",
      error_code: null,
      billing: {
        request_id: null,
        billing_request_id: null,
        charged_units: 0,
        charged: false,
        refunded: false
      }
    });
    const inputPath = await storage.saveInput(job.id, job.file_name, Buffer.from("fake-pdf"));
    jobs.update(job.id, { input_file_path: inputPath });

    const billing: BillingAdapter = {
      charge: jest.fn().mockResolvedValue({
        billing_request_id: "billing-1",
        charged_units: 1,
        already_charged: false
      }),
      refund: jest.fn().mockResolvedValue({
        refund_id: "refund-1",
        refunded: true
      })
    };
    const provider = createFailingProvider();
    const runner = new JobRunner(jobs, provider, billing, storage);

    await runner.run(job.id);
    await runner.run(job.id);

    expect(billing.charge).toHaveBeenCalledTimes(1);
    expect(billing.refund).toHaveBeenCalledTimes(1);
  });
});
