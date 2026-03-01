import express from "express";
import os from "os";
import path from "path";
import fs from "fs/promises";
import request from "supertest";
import { createJobsRouter } from "../src/routes/jobs.routes";
import { JobStore } from "../src/jobs/job.store";
import { LocalStorage } from "../src/storage/local.storage";
import { JobRunner } from "../src/jobs/job.runner";

describe("GET /jobs/:id/output", () => {
  it("returns pdf bytes when job is READY", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "deepl-output-"));
    const jobs = new JobStore();
    const storage = new LocalStorage(tempDir);
    const runner = { runAsync: jest.fn() } as unknown as JobRunner;

    const job = jobs.create({
      status: "READY",
      progress_pct: 100,
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
    const outputPath = await storage.saveOutput(job.id, Buffer.from("%PDF-1.4 test"));
    jobs.update(job.id, { output_file_path: outputPath });

    const app = express();
    app.use("/jobs", createJobsRouter({ jobs, runner, storage }));

    const res = await request(app).get(`/jobs/${job.id}/output`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toBe('attachment; filename="translated.pdf"');
  });

  it("returns 409 when job is PROCESSING", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "deepl-output-"));
    const jobs = new JobStore();
    const storage = new LocalStorage(tempDir);
    const runner = { runAsync: jest.fn() } as unknown as JobRunner;

    const job = jobs.create({
      status: "PROCESSING",
      progress_pct: 50,
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

    const app = express();
    app.use("/jobs", createJobsRouter({ jobs, runner, storage }));

    const res = await request(app).get(`/jobs/${job.id}/output`);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "job_not_ready" });
  });
});

