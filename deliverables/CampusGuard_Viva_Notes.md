# CampusGuard Viva Notes

## One-Line Explanation

CampusGuard is a chatbot-first admission support platform that helps applicants and parents understand admission steps, documents, fees, scholarships, hostel, placement outcomes, and staff follow-up from one workspace.

## Website vs CampusGuard

The college website publishes static information. CampusGuard turns information into workflows:

- Ask a doubt.
- Route to CAP, documents, fees, scholarship, program, placement, or hostel workflow.
- Upload documents.
- Staff reviews and updates status.
- Admin manages verified knowledge.
- Reports and audit logs track the process.

## Why Applicant And Parent Are Not Fully Separate

Applicant and parent are part of the same admission decision. We avoid duplicate pages and use the same assistant/workflows. Parents mostly ask cost, hostel, travel, and confidence questions; applicants mostly ask documents, CAP, branch, and reporting questions.

## Security Points

- Passwords are hashed.
- Access tokens are short-lived.
- Refresh tokens are hashed, rotated, and revoked on logout.
- Backend enforces role-based authorization.
- Staff/admin-only reports and audit logs are protected.
- Uploaded files are validated by type.
- Important actions are audit logged.

## RAG / AI Explanation

The current backend has a retrieval-grounded assistant foundation. It retrieves verified knowledge records and returns evidence with the answer. A full future RAG pipeline can ingest official PDFs and website content automatically.

## Current Limitations

- SQLite is suitable for local/demo deployment; PostgreSQL is better for cloud scale.
- Uploaded files are local; object storage is better for production.
- Virus scanning is future work.
- Full PDF ingestion pipeline is future work.
- Current assistant is retrieval/rule grounded, not a large external LLM.

## Strong Project Points

- Complete frontend and backend workflow.
- Auth and RBAC implemented.
- Real document upload.
- Staff review queue.
- Admin content and knowledge control.
- Reports and audit logs.
- RAG foundation with evidence.
- Docker deployment setup.
- Tests passing.
