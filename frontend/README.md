# CampusGuard Frontend

The React/Vite frontend for the MITCORER admission-support workspace.

## Run locally

```bash
cd frontend
npm.cmd run dev
```

Vite prints the local URL. The frontend proxies `/api` requests to `http://127.0.0.1:4000` during development, so start the backend first.

## Verification

```bash
npm.cmd run lint
npm.cmd run build
```

## Current application structure

- `src/App.jsx`: sign-in, role-aware screens, assistant, CAP, documents, and staff/admin workflows.
- `src/api.js`: authenticated API and protected-file calls.
- `src/index.css`: shared responsive visual system.
- `src/assets/`: verified fee and hostel/mess images used in the UI.

The application uses backend authentication and backend-enforced RBAC. It does not use the former mock policy prototype or client-only role detection.
