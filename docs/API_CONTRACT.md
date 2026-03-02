# API CONTRACT (Mobile Integration)

This document is the canonical, stable API contract between backend and iOS app integration.

## API Base

- Base URL (local): `http://localhost:3000`
- JSON endpoints use `Content-Type: application/json`
- Upload endpoint uses `multipart/form-data`
- JSON encoding: UTF-8
- Error response format:

```json
{ "error": "error_code_string" }
```

## Endpoints

### 1) POST /jobs

Description: Upload PDF and create job.

Request:
- `multipart/form-data`
- fields:
- `file` (PDF)
- `target_lang` (string)

Success:
- `201`

```json
{
  "job_id": "string",
  "status": "PENDING"
}
```

Validation Errors:
- `400`

```json
{ "error": "file is required" }
```

```json
{ "error": "target_lang is required" }
```

```json
{ "error": "only pdf is accepted" }
```

---

### 2) POST /jobs/:id/run

Success:
- `202`

```json
{
  "accepted": true,
  "job_id": "string",
  "status": "PENDING|PROCESSING"
}
```

Errors:
- `404`

```json
{ "error": "job_not_found" }
```

---

### 3) GET /jobs/:id

Success:
- `200`

```json
{
  "job_id": "string",
  "status": "PENDING|PROCESSING|READY|FAILED",
  "progress_pct": 0,
  "output_file_path": "string|null",
  "error_code": "string|null",
  "billing": {
    "request_id": "string|null",
    "billing_request_id": "string|null",
    "charged_units": 0,
    "charged": true,
    "refunded": false
  }
}
```

Errors:
- `404`

```json
{ "error": "job_not_found" }
```

---

### 4) GET /jobs/:id/output

Description: Download translated PDF.

Success:
- `200`
- `Content-Type: application/pdf`
- Binary PDF response body

Errors:
- `404`

```json
{ "error": "job_not_found" }
```

- `409`

```json
{ "error": "job_not_ready" }
```

- `404`

```json
{ "error": "output_not_found" }
```

---

## Error Codes

Provider normalized error codes:
- `PROVIDER_RATE_LIMIT`
- `PROVIDER_TIMEOUT`
- `PROVIDER_QUOTA_EXCEEDED`
- `PROVIDER_UPSTREAM_5XX`
- `PROVIDER_UNKNOWN`

---

## State Machine

`PENDING -> PROCESSING -> READY`

`PENDING -> PROCESSING -> FAILED`

---

## Mobile Integration Notes

- Poll interval: 2 seconds
- Stop polling when `READY` or `FAILED`
- Download output only when `READY`
- Never expose internal provider messages

---

## Stability Rules

- Do not change existing endpoints
- Do not modify backend logic for this contract document
- This document is canonical and must match code

