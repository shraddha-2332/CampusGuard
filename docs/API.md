# CampusGuard API

Base URL: `http://127.0.0.1:4000`

Authentication uses a short-lived bearer access token. Login and signup return:

```json
{
  "data": {
    "user": { "id": "USR-APP", "email": "applicant@example.com", "role": "applicant" },
    "token": "access-token"
  }
}
```

The refresh token is an HttpOnly, `SameSite=Strict` cookie scoped to `/api/auth`. Call `POST /api/auth/refresh` without a body to restore a browser session, and `POST /api/auth/logout` to revoke and clear it. The assistant route is limited to 30 requests per authenticated user per minute.

## Auth

- `POST /api/auth/login`
- `POST /api/auth/signup`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/me`

## Assistant / RAG

- `POST /api/assistant/ask`
- `GET /api/assistant/attachments`
- `POST /api/assistant/attachments/upload`
- `GET /api/assistant/attachments/:id/file`

Body:

```json
{ "question": "Which documents are required for reporting?" }
```

Returns routed guidance, source, next action, and retrieval evidence.

The current assistant returns deterministic, evidence-grounded answers. The OpenRouter configuration is reserved for a later citation-preserving generation layer; it is not allowed to override verified rules or source records in the current release.

## Inquiries

- `GET /api/inquiries`
- `POST /api/inquiries`
- `PATCH /api/inquiries/:id/status`

Applicants/parents see their own records. Staff/admin see all records.

## Documents

- `GET /api/documents`
- `POST /api/documents`
- `POST /api/documents/upload`
- `PATCH /api/documents/:id/status`
- `DELETE /api/documents/:id`
- `GET /api/documents/:id/file`

Real upload supports PDF, JPG, and PNG. Staff/admin can update review status.

## Content And Knowledge

- `GET /api/content`
- `POST /api/content`
- `PATCH /api/content/:id`
- `GET /api/knowledge`
- `POST /api/knowledge`
- `GET /api/official-sources`
- `POST /api/official-sources/upload`
- `GET /api/official-sources/:id/extracted-text`
- `PATCH /api/official-sources/:id/publish`
- `GET /api/official-sources/:id/file`

Knowledge records are used by backend retrieval when answering assistant questions. Staff/admin can list official sources; only college admins can upload, inspect extracted text, or publish it. Official-source upload supports PDF, DOCX, XLSX, CSV, TXT, JPG, and PNG. TXT/CSV content is extracted automatically; Docker deployments also extract text from PDFs. DOCX, XLSX, image-based PDFs, and images require reviewed text to be supplied manually.

An upload stays in `Review` until a college admin calls `PATCH /api/official-sources/:id/publish` with reviewed `verifiedText`. Publishing replaces any prior retrieval chunks for that source and records an audit event. Unpublished source text is never used to answer applicants.

Assistant attachments support PDF, JPG, and PNG. They are stored as support files for the owner and staff/admin review; CampusGuard does not claim to extract or interpret their visual content unless that capability is explicitly deployed.

## Reports And Audit

- `GET /api/reports`
- `GET /api/audit-logs`

Staff/admin only.
