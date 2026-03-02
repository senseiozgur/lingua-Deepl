import express from "express";
import fs from "fs/promises";
import os from "os";
import path from "path";
import request from "supertest";
import { BillingAdapter } from "../src/billing/billing.adapter";
import { JobRunner } from "../src/jobs/job.runner";
import { JobStore } from "../src/jobs/job.store";
import { TranslationProvider } from "../src/providers/provider.interface";
import { createJobsRouter } from "../src/routes/jobs.routes";
import { LocalStorage } from "../src/storage/local.storage";

function createRunnerStub() {
  return { runAsync: jest.fn() } as unknown as JobRunner;
}

function createApp(deps: { jobs: JobStore; runner: JobRunner; storage: LocalStorage }) {
  const app = express();
  app.use("/jobs", createJobsRouter(deps));
  return app;
}

function createBaseJob(jobs: JobStore, patch?: Partial<Parameters<JobStore["create"]>[0]>) {
  return jobs.create({
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
    },
    ...patch
  });
}

async function waitForTerminal(app: express.Express, jobId: string): Promise<request.Response> {
  for (let i = 0; i < 40; i += 1) {
    const res = await request(app).get(`/jobs/${jobId}`);
    if (res.body.status === "READY" || res.body.status === "FAILED") {
      return res;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return request(app).get(`/jobs/${jobId}`);
}

describe("jobs API contract", () => {
  it("1) POST /jobs success returns 201 with job_id and PENDING", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "contract-"));
    const app = createApp({ jobs: new JobStore(), runner: createRunnerStub(), storage: new LocalStorage(dir) });

    const res = await request(app)
      .post("/jobs")
      .field("target_lang", "TR")
      .attach("file", Buffer.from("%PDF-1.4"), "input.pdf");

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PENDING");
    expect(typeof res.body.job_id).toBe("string");
  });

  it("2) POST /jobs missing file -> 400", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "contract-"));
    const app = createApp({ jobs: new JobStore(), runner: createRunnerStub(), storage: new LocalStorage(dir) });

    const res = await request(app).post("/jobs").field("target_lang", "TR");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "file is required" });
  });

  it("3) POST /jobs missing target_lang -> 400", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "contract-"));
    const app = createApp({ jobs: new JobStore(), runner: createRunnerStub(), storage: new LocalStorage(dir) });

    const res = await request(app).post("/jobs").attach("file", Buffer.from("%PDF-1.4"), "input.pdf");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "target_lang is required" });
  });

  it("4) POST /jobs/:id/run job_not_found -> 404", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "contract-"));
    const app = createApp({ jobs: new JobStore(), runner: createRunnerStub(), storage: new LocalStorage(dir) });

    const res = await request(app).post("/jobs/missing/run");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "job_not_found" });
  });

  it("5) GET /jobs/:id job_not_found -> 404", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "contract-"));
    const app = createApp({ jobs: new JobStore(), runner: createRunnerStub(), storage: new LocalStorage(dir) });

    const res = await request(app).get("/jobs/missing");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "job_not_found" });
  });

  it("6) GET /jobs/:id/output when status != READY -> 409", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "contract-"));
    const jobs = new JobStore();
    const job = createBaseJob(jobs, { status: "PROCESSING" });
    const app = createApp({ jobs, runner: createRunnerStub(), storage: new LocalStorage(dir) });

    const res = await request(app).get(`/jobs/${job.id}/output`);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "job_not_ready" });
  });

  it("7) GET /jobs/:id/output when READY -> 200 pdf", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "contract-"));
    const jobs = new JobStore();
    const storage = new LocalStorage(dir);
    const job = createBaseJob(jobs, { status: "READY", progress_pct: 100 });
    const outPath = await storage.saveOutput(job.id, Buffer.from("%PDF-1.4 translated"));
    jobs.update(job.id, { output_file_path: outPath });
    const app = createApp({ jobs, runner: createRunnerStub(), storage });

    const res = await request(app).get(`/jobs/${job.id}/output`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("8) processing failure never leaks SensitiveInternalError to clients", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "contract-"));
    const jobs = new JobStore();
    const storage = new LocalStorage(dir);
    const provider: TranslationProvider = {
      translateDocument: jest.fn().mockRejectedValue(new Error("SensitiveInternalError")),
      translateText: jest.fn(),
      detectLanguage: jest.fn(),
      getUsage: jest.fn(),
      normalizeError: jest.fn().mockReturnValue({ code: "PROVIDER_UNKNOWN", retryable: false })
    };
    const billing: BillingAdapter = {
      charge: jest.fn().mockResolvedValue({
        billing_request_id: "bill-1",
        charged_units: 1,
        already_charged: false
      }),
      refund: jest.fn().mockResolvedValue({
        refund_id: "refund-1",
        refunded: true
      })
    };
    const runner = new JobRunner(jobs, provider, billing, storage);
    const app = createApp({ jobs, runner, storage });

    const createRes = await request(app)
      .post("/jobs")
      .field("target_lang", "TR")
      .attach("file", Buffer.from("%PDF-1.4"), "input.pdf");
    const jobId = createRes.body.job_id as string;

    const runRes = await request(app).post(`/jobs/${jobId}/run`);
    expect(runRes.status).toBe(202);
    expect(JSON.stringify(runRes.body)).not.toContain("SensitiveInternalError");

    const finalRes = await waitForTerminal(app, jobId);
    expect(finalRes.body.status).toBe("FAILED");
    expect(finalRes.body.error_code).toBe("PROVIDER_UNKNOWN");
    expect(JSON.stringify(finalRes.body)).not.toContain("SensitiveInternalError");
  });

  it("9) POST /jobs/:id/run twice gives deterministic second response", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "contract-"));
    const jobs = new JobStore();
    const storage = new LocalStorage(dir);
    const provider: TranslationProvider = {
      translateDocument: jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { outputBuffer: Buffer.from("%PDF-1.4 translated") };
      }),
      translateText: jest.fn(),
      detectLanguage: jest.fn(),
      getUsage: jest.fn(),
      normalizeError: jest.fn().mockReturnValue({ code: "PROVIDER_UNKNOWN", retryable: false })
    };
    const billing: BillingAdapter = {
      charge: jest.fn().mockResolvedValue({
        billing_request_id: "bill-1",
        charged_units: 1,
        already_charged: false
      }),
      refund: jest.fn().mockResolvedValue({
        refund_id: "refund-1",
        refunded: true
      })
    };
    const runner = new JobRunner(jobs, provider, billing, storage);
    const app = createApp({ jobs, runner, storage });

    const createRes = await request(app)
      .post("/jobs")
      .field("target_lang", "TR")
      .attach("file", Buffer.from("%PDF-1.4"), "input.pdf");
    const jobId = createRes.body.job_id as string;

    const firstRun = await request(app).post(`/jobs/${jobId}/run`);
    const secondRun = await request(app).post(`/jobs/${jobId}/run`);
    expect(firstRun.status).toBe(202);
    expect(secondRun.status).toBe(409);
    expect(secondRun.body).toEqual({ error: "job_already_running" });
  });

  it("12) storage write failure sets FAILED with safe error_code and no raw leak", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "contract-"));
    const jobs = new JobStore();
    class FailingOutputStorage extends LocalStorage {
      async saveOutput(): Promise<string> {
        throw new Error("SensitiveDiskWriteFailure");
      }
    }
    const storage = new FailingOutputStorage(dir);
    const provider: TranslationProvider = {
      translateDocument: jest.fn().mockResolvedValue({ outputBuffer: Buffer.from("%PDF-1.4 translated") }),
      translateText: jest.fn(),
      detectLanguage: jest.fn(),
      getUsage: jest.fn(),
      normalizeError: jest.fn().mockReturnValue({ code: "PROVIDER_UNKNOWN", retryable: false })
    };
    const billing: BillingAdapter = {
      charge: jest.fn().mockResolvedValue({
        billing_request_id: "bill-1",
        charged_units: 1,
        already_charged: false
      }),
      refund: jest.fn().mockResolvedValue({
        refund_id: "refund-1",
        refunded: true
      })
    };
    const runner = new JobRunner(jobs, provider, billing, storage);
    const app = createApp({ jobs, runner, storage });

    const createRes = await request(app)
      .post("/jobs")
      .field("target_lang", "TR")
      .attach("file", Buffer.from("%PDF-1.4"), "input.pdf");
    const jobId = createRes.body.job_id as string;

    await request(app).post(`/jobs/${jobId}/run`);
    const finalRes = await waitForTerminal(app, jobId);
    expect(finalRes.body.status).toBe("FAILED");
    expect(finalRes.body.error_code).toBe("PROVIDER_UNKNOWN");
    expect(JSON.stringify(finalRes.body)).not.toContain("SensitiveDiskWriteFailure");
  });
});

