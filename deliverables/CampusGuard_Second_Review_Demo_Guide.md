# CampusGuard Second Review Demo Guide

## Current Scope

CampusGuard is an admission-support workspace for MITCORER with a React frontend, Node.js backend, SQLite persistence, backend authentication, and role-based API access. The second review demo should present it as a chatbot-first admission assistant with applicant/parent guidance, document pre-check, staff inquiry handling, and admin content/reporting workflows.

Do not present it as a fully deployed institutional production system yet. Present it as a working college-project system that still needs production hosting, managed storage, malware scanning, and annual source verification.

## Core Faculty Explanation

CampusGuard is not a replacement for the college website. The website publishes information. CampusGuard converts admission information into guided actions:

- Applicants and parents ask doubts in one admission desk.
- The assistant routes them to the correct workflow only when needed.
- Document uploads become visible in staff review.
- Staff can track inquiries and document status.
- Admin can monitor admission content and operational reports.

## Demo Flow

### 1. Sign In / Sign Up

Show the professional sign-in screen and switch roles.

Explain:

- Authentication is implemented in the frontend for the second review.
- Role-based authorization is enforced in the UI.
- Backend authentication and API-level RBAC will be added in the next phase.

### 2. Applicant Flow

Sign in as Applicant.

Show:

- Admission Desk as the main screen.
- Topic chips: CAP, Documents, Programs, Fees, Scholarship, Placement, Hostel & Mess.
- Ask one query, for example: "I received allotment. What should I do next?"
- Use an action button from the assistant to open the relevant workflow.

Then show:

- CAP Tracker: current stage, allotment decision helper, reporting readiness checklist.
- Documents: multi-file upload, checklist status, uploaded/completed marking.
- Programs: branch list and CAP preference draft builder.
- Fees: category-wise estimate and scholarship connection.
- Scholarship: likely scholarship route and required document checklist.
- Placement: branch-goal fit and placement readiness.
- Hostel & Mess: stay cost estimator and decision checklist.

### 3. Parent Flow

Sign in as Parent.

Explain:

- Parent and applicant share the same admission information because both are involved in the same admission process.
- The difference is not separate features; the value is that parents can ask cost, hostel, visit, and confidence-related questions from the same assistant.
- This avoids duplicate sidebar pages and keeps the product chatbot-first.

Show:

- Ask fee, hostel, scholarship, or placement question.
- Use Staff Help if the doubt is student-specific.

### 4. Request Help Workflow

From Applicant or Parent:

- Open Request Help.
- Create an inquiry for documents, fees, scholarship, hostel, programs, placement, or campus visit.

Then sign in as Admission Staff:

- Open Review Queue.
- Show the newly submitted inquiry.
- Change status from Unassigned to In progress or Resolved.

### 5. Document Review Workflow

From Applicant:

- Upload a document in Documents.

Then sign in as Admission Staff:

- Open Document Reviews.
- Mark a file as Ready for reporting or Needs correction.

Then return as Applicant:

- Show that document status updates in the checklist.

### 6. Admin Flow

Sign in as College Admin.

Show:

- Content area for verified admission knowledge.
- Reports with top topic, open inquiries, document reviews, unresolved requests, and document readiness.

Explain:

- Admin will later manage official content from backend.
- The current frontend shows the target control surface for the college.

## What Is Implemented Now

- Professional sign in/sign up UI.
- Role-based frontend access.
- Applicant/Parent admission desk.
- Topic-based assistant routing.
- CAP tracker.
- Documents upload and checklist workflow.
- Staff document review.
- Inquiry creation and staff queue.
- Fees calculator.
- Scholarship readiness.
- Program preference builder.
- Placement and career outcome guidance.
- Hostel and mess estimator.
- Admin content/report screens.
- Responsive frontend build.

## Honest Limitations

- SQLite is appropriate for the local review build but not for a multi-instance institutional deployment.
- Uploaded file signatures are validated, but malware scanning and managed object storage are not deployed.
- Assistant answers use verified seed records and deterministic rules; full PDF extraction and semantic retrieval are future work.
- Fees, CAP data, cutoffs, schedules, and facilities need authorised annual review before each admission cycle.

## Next Phase After Second Review

- Managed PostgreSQL and object storage.
- PDF/OCR ingestion with source-page citations and staff publishing approval.
- Virus scanning and retention policies for uploads.
- Deployment monitoring, HTTPS, backups, and error tracking.
- Admin content management with approval states.
- RAG-based verified answer engine using official college documents.
- Audit logs and testing.

## Suggested Closing Line

CampusGuard is designed as an admission engagement assistant. The college website gives static information, while CampusGuard helps families decide what to do next, prepare documents, reduce unnecessary visits, and connect unresolved cases to staff.
