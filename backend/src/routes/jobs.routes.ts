import express from "express";
import multer from "multer";
import { JobRunner } from "../jobs/job.runner";
import { JobStore } from "../jobs/job.store";
import { LocalStorage } from "../storage/local.storage";

const upload = multer({ storage: multer.memoryStorage() });

export function createJobsRouter(deps: {
  jobs: JobStore;
  runner: JobRunner;
  storage: LocalStorage;
}) {
  const router = express.Router();

  router.post("/", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      const targetLang = String(req.body?.target_lang || "").trim().toUpperCase();
      const sourceLangRaw = String(req.body?.source_lang || "").trim().toUpperCase();
      const sourceLang = sourceLangRaw || null;

      if (!file) {
        res.status(400).json({ error: "file is required" });
        return;
      }
      if (!targetLang) {
        res.status(400).json({ error: "target_lang is required" });
        return;
      }
      if (!file.originalname.toLowerCase().endsWith(".pdf")) {
        res.status(400).json({ error: "only pdf is accepted" });
        return;
      }

      const tempJob = deps.jobs.create({
        status: "PENDING",
        progress_pct: 0,
        input_file_path: "",
        output_file_path: null,
        file_name: file.originalname,
        source_lang: sourceLang,
        target_lang: targetLang,
        error_code: null,
        billing: {
          request_id: null,
          billing_request_id: null,
          charged_units: 0,
          charged: false,
          refunded: false
        }
      });

      const inputPath = await deps.storage.saveInput(tempJob.id, file.originalname, file.buffer);
      deps.jobs.update(tempJob.id, { input_file_path: inputPath });

      res.status(201).json({ job_id: tempJob.id, status: "PENDING" });
    } catch {
      res.status(500).json({ error: "internal_error" });
    }
  });

  router.post("/:id/run", (req, res) => {
    const job = deps.jobs.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: "job_not_found" });
      return;
    }

    if (job.status === "PENDING") {
      deps.runner.runAsync(job.id);
    }
    res.status(202).json({ accepted: true, job_id: job.id, status: job.status });
  });

  router.get("/:id", (req, res) => {
    const job = deps.jobs.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: "job_not_found" });
      return;
    }

    res.status(200).json({
      job_id: job.id,
      status: job.status,
      progress_pct: job.progress_pct,
      output_file_path: job.output_file_path,
      error_code: job.error_code,
      billing: {
        request_id: job.billing.request_id,
        billing_request_id: job.billing.billing_request_id,
        charged_units: job.billing.charged_units,
        charged: job.billing.charged,
        refunded: job.billing.refunded
      }
    });
  });

  return router;
}

