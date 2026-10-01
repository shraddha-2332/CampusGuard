# CampusGuard

CampusGuard is an admission support workspace for applicants, parents, admission staff, and college admin.

## Local Development

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Open:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:4000/api/health`

## Demo Accounts

Password for seed accounts: `campusguard`

- `applicant@example.com`
- `parent@example.com`
- `staff@mitcorer.edu.in`
- `admin@mitcorer.edu.in`

## Production-Oriented Features Implemented

- SQLite-backed persistence
- Access token plus refresh token sessions
- Refresh-token revocation on logout
- RBAC-protected backend APIs
- Real document upload with type validation
- Protected document/source viewing for the owning applicant and authorised staff
- Chat attachment handoff to staff, without falsely claiming image/PDF interpretation
- Audit logging
- Backend assistant endpoint with retrieval-grounded knowledge evidence
- OpenRouter configuration reserved for a future citation-preserving generation layer; verified rules remain authoritative today
- Admin-managed official source library separated from applicant documents
- Review-gated source ingestion: TXT/CSV extraction, embedded-PDF extraction, and English OCR for scans/images in Docker; admin publishing; retrieval chunks linked to their source
- 360-case English, Marathi, Hindi, and Hinglish assistant evaluation benchmark
- Docker deployment setup

## Run With Docker

```bash
docker compose up --build
```

In PowerShell, set the required secret in the current terminal first:

```powershell
$env:TOKEN_SECRET = 'replace-with-a-long-random-secret'
docker compose up --build
```

Open `http://127.0.0.1:8080`.

The browser uses the same-origin `/api` proxy; the backend is not exposed as a public Docker port. For a public deployment, place HTTPS and a real domain at the reverse-proxy or cloud load-balancer layer, set an unpredictable `TOKEN_SECRET`, and update `CORS_ORIGIN` to the exact frontend origin.

Docker containers receive their configuration from `docker-compose.yml` and the terminal environment; `backend/.env` is deliberately not copied into an image.

`ASSISTANT_RATE_LIMIT_MAX` defaults to `30` verified assistant requests per user per minute. Keep this limit conservative when an LLM is enabled later.

## Remaining Future Hardening

- Move from SQLite to managed PostgreSQL for multi-instance production deployment.
- Add virus scanning for uploaded files.
- Add HTTPS and secure cookies at deployment gateway.
- Add source-page citations for extracted PDF content and additional OCR language packs when the institution needs them.
- Add e2e tests for browser workflows.
- Add managed object storage and malware scanning before accepting real institutional uploads.

## OpenRouter Configuration (Not Active In Current Answers)

Keep a full key only in `backend/.env` if you plan to develop a future, citation-preserving generation layer:

```bash
OPENROUTER_API_KEY=your-full-key
OPENROUTER_MODEL=qwen/qwen3.8-27b:free
```

Put the key only in `backend/.env`. Never place it in frontend code or commit it. Masked keys cannot be recovered from the OpenRouter UI; create a replacement and copy it immediately when necessary.

## Assistant Evaluation

`backend/evaluation/campusguard-qa-360.json` provides 360 multilingual routing cases; the evaluator adds 140 admission-workflow cases, for a 500-case evaluation. Run `npm.cmd run evaluate` from `backend` to evaluate every case against an isolated seeded backend. It is an evaluation dataset, not a fine-tuning dataset. CampusGuard improves through verified source ingestion, retrieval, deterministic admission rules, and measured evaluation.

## Saved Conversations

The sidebar lists the signed-in account's recent chats, with New chat, reopen, and Load older chats actions. New conversations are created on the first successful answer. Exchanges, source links, and category actions persist in the existing SQLite database and Docker data volume. Chats from before this feature cannot be recovered because they were held only in browser memory.

- `GET /api/conversations?offset=0`: owner-only metadata, 30 per page.
- `GET /api/conversations/:id`: owner-only messages; other accounts receive 404, including staff and admin.
- `POST /api/conversations/ask`: question plus optional conversationId; generates and saves an exchange under the authenticated user's ID. The existing assistant rate limit applies.
- Each conversation holds up to 100 question/answer pairs. Start a new chat when full.
- History restores prior messages for the user; it does not add conversational reasoning or model training. The current answer engine still evaluates the submitted question independently.

## Local Backup

Before changing source data or deploying, create a timestamped local backup of the SQLite database, applicant uploads, and official-source files:

```powershell
cd backend
npm.cmd run backup
```
