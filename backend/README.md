# CampusGuard Backend

Zero-dependency Node.js API for the CampusGuard second-review backend foundation.

## Run

```bash
cd backend
npm run dev
```

Default URL: `http://127.0.0.1:4000`

## Demo Accounts

All seed users use password `campusguard`.

- `applicant@example.com`
- `parent@example.com`
- `staff@mitcorer.edu.in`
- `admin@mitcorer.edu.in`

## API Summary

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/signup`
- `GET /api/me`
- `GET /api/inquiries`
- `POST /api/inquiries`
- `PATCH /api/inquiries/:id/status`
- `GET /api/documents`
- `POST /api/documents`
- `PATCH /api/documents/:id/status`
- `DELETE /api/documents/:id`
- `GET /api/content`
- `POST /api/content`
- `PATCH /api/content/:id`
- `GET /api/reports`

## Current Scope

This backend provides SQLite-backed persistence, password hashing, signed short-lived access tokens, refresh-token rotation, backend RBAC, audit logs, upload validation, and staff/admin workflows. Official sources flow through an admin review and publish gate; only published source chunks are available to retrieval. It remains a college-project deployment baseline rather than a completed institutional production service: malware scanning, object storage, normalized relational tables, OCR for scanned material, and managed secret/session infrastructure still require deployment-specific work.

## OpenRouter Configuration (Not Active In Current Answers)

CampusGuard currently answers from deterministic verified rules and retrieval evidence. The configuration below is reserved for a future citation-preserving generation layer and does not override those verified answers.

Set these environment variables before starting the backend:

```bash
OPENROUTER_API_KEY=your-full-key
OPENROUTER_MODEL=qwen/qwen3.8-27b:free
OPENROUTER_REFERER=http://127.0.0.1:5173
OPENROUTER_TITLE=CampusGuard
```

The current release does not invoke the model from this configuration. It keeps deterministic, verified evidence in control until a citation-preserving generation layer has its own evaluation and safety gate.
