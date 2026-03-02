# API Contract (Backend <-> iOS)

This document reflects the current backend implementation in:
- `backend/src/app.ts`
- `backend/src/routes/jobs.routes.ts`

## API Base

- Local base URL: `http://localhost:3000`
- JSON endpoints return `application/json`
- Upload endpoint (`POST /jobs`) accepts `multipart/form-data`
- Download endpoint (`GET /jobs/:id/output`) returns binary PDF

Default JSON error shape:

```json
{ "error": "error_code" }
```

## Endpoints

### GET /health

Success (`200`):

```json
{ "ok": true }
```

---

### POST /jobs

Description: Upload PDF and create a translation job.

Request:
- `multipart/form-data`
- fields:
  - `file` (required, must have `.pdf` filename extension)
  - `target_lang` (required, string)
  - `source_lang` (optional, string)

Success (`201`):

```json
{
  "job_id": "string",
  "status": "PENDING"
}
```

Errors:

`400`

```json
{ "error": "file is required" }
```

`400`

```json
{ "error": "target_lang is required" }
```

`400`

```json
{ "error": "only pdf is accepted" }
```

`500`

```json
{ "error": "internal_error" }
```

---

### POST /jobs/:id/run

Success (`202`):

```json
{
  "accepted": true,
  "job_id": "string",
  "status": "PENDING"
}
```

Errors:

`404`

```json
{ "error": "job_not_found" }
```

`409`

```json
{ "error": "job_already_running" }
```

Deterministic rule:
- If job status is not `PENDING`, response is always `409 job_already_running`.

---

### GET /jobs/:id

Success (`200`):

```json
{
  "job_id": "string",
  "status": "PENDING|PROCESSING|READY|FAILED",
  "progress_pct": 0,
  "output_file_path": null,
  "error_code": null,
  "billing": {
    "request_id": null,
    "billing_request_id": null,
    "charged_units": 0,
    "charged": false,
    "refunded": false
  }
}
```

Notes:
- `output_file_path` is `string` when `READY`, otherwise `null`.
- `error_code` is normalized provider code when failed, otherwise `null`.
- `billing.request_id` is `string|null`.
- `billing.billing_request_id` is `string|null`.

Errors:

`404`

```json
{ "error": "job_not_found" }
```

---

### GET /jobs/:id/output

Description: Download translated PDF bytes.

Success (`200`):
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="translated.pdf"`
- Body: binary PDF bytes

Errors:

`404`

```json
{ "error": "job_not_found" }
```

`409`

```json
{ "error": "job_not_ready" }
```

`404`

```json
{ "error": "output_not_found" }
```

Deterministic rule:
- If job status is not `READY`, response is always `409 job_not_ready`.

## Provider Error Normalization

Normalized provider error codes exposed via `GET /jobs/:id` -> `error_code`:

- `PROVIDER_RATE_LIMIT`
- `PROVIDER_TIMEOUT`
- `PROVIDER_QUOTA_EXCEEDED`
- `PROVIDER_UPSTREAM_5XX`
- `PROVIDER_UNKNOWN`
