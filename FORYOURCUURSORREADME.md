# FORYOURCURSORREADME

Welcome to BrokerZero inside Cursor! This doc gives you a patient, step-by-step walkthrough of everything you need to know to work on the project—even if you’ve never touched it before.

---

## 1. Big-picture: what is BrokerZero?
- **BrokerZero** is an insurance workflow platform for business owners (SMBs), brokers, and carriers.
- It has:
  - A **Next.js** frontend (`apps/web`) for intake, carrier review, and admin tools.
  - A **NestJS** API (`apps/api`) backed by **Prisma** + Postgres for submissions, chat, and document management.
  - A **Temporal worker** (`apps/worker`) that processes uploaded documents, extracts data, and stores structured results.

---

## 2. Repo structure cheat sheet
```
apps/
  api/    -> NestJS backend, Prisma models, REST endpoints, chat logic
  web/    -> Next.js frontend (SMB intake, carrier portal, admin UI)
  worker/ -> Temporal worker for document processing & field extraction
.dev-docs/ -> Extra developer docs (this file lives here!)
compose.yaml -> Docker services (Postgres, Redis, MinIO, Temporal)
README.md   -> High-level onboarding guide
```

---

## 3. First-time setup (do this once)
1. **Clone & enter repo**
   ```bash
   git clone https://github.com/asdaniel101-ship-it/brokerzeroashton1.git
   cd brokerzeroashton1
   ```
2. **Install prerequisites**
   - Node.js ≥18, pnpm ≥8 (`npm install -g pnpm`)
   - Docker Desktop (for Postgres/Redis/MinIO/Temporal)
3. **Install dependencies**
   ```bash
   pnpm install
   ```

---

## 4. Everyday boot sequence
Open three terminals (or use Cursor’s split shell):

1. **Infrastructure**
   ```bash
   docker compose up -d
   ```
2. **Database migration + seed (only when schema changes or first run)**
   ```bash
   cd apps/api
   npx prisma migrate dev
   pnpm run seed
   cd ../..
   ```
3. **Services**
   ```bash
   pnpm api     # API on http://localhost:4000
   pnpm worker  # Temporal worker (optional for doc extraction tests)
   pnpm web     # Web app on http://localhost:3000
   ```
4. **Helpful URLs**
   - Web UI: `http://localhost:3000`
   - Swagger docs: `http://localhost:4000/docs`
   - Prisma Studio: `cd apps/api && pnpm prisma:studio`

Stop services with `Ctrl+C`. Shut down Docker containers via `docker compose down`.

---

## 5. Git workflow (very important)
- Main development happens on the `main` branch.
- The `marketing-landing` branch powers the public marketing site—**do not push edits there unless you are deliberately changing the marketing site**.
- Stay current:
  ```bash
  git pull --rebase origin main
  ```
- Use feature branches if collaborating, then open PRs into `main`.

---

## 6. Frontend pages and what they do
- `/` – Marketing hero for BrokerZero (branding, value props, CTA).
- `/request-demo` – Demo request form (console logs + success banner).
- `/intake` – SMB intake entry point.
- `/intake/[id]/chat` – Conversational intake (asks alcohol questions for restaurants).
- `/submissions/[id]` – SMB review page with AI extraction comparisons.
- `/carrier` – Carrier dashboard with metrics & new submissions queue.
- `/carrier/submissions/[id]` – Carrier review page (edit fields, conflict handling, remove from queue).
- `/carrier/submissions/[id]/quote` – Quote entry page.
- `/admin` – Field metadata table (edit extractor instructions, add new fields, click “+” to create rows).

Frontend code lives under `apps/web/src/app`.

---

## 7. Backend services & special functionality

### 7.1 Prisma + Postgres
- Schema: `apps/api/prisma/schema.prisma`
- Models include `Submission`, `Document`, `ExtractedField`, `FieldDefinition`, `ChatMessage`.
- Migrations live in `apps/api/prisma/migrations/`.
- Run `npx prisma migrate dev` whenever you pull new schema changes.

### 7.2 Document ingestion + extraction
- Uploads are stored in MinIO (S3-compatible object storage).
- Temporal worker (`apps/worker/src/activities.ts`) downloads files, extracts text, and chunks content.
- Extraction is currently regex/keyword driven (no external OCR service yet; PDF text extraction handled in worker).
- The worker references `apps/api/extraction-config.json` to know what to look for and how to score confidence.
- It writes context-rich snippets to the `ExtractedField` table (300 chars before/after matches).

### 7.3 Chat + AI logic
- Chat endpoints live in `apps/api/src/submissions/submissions.controller.ts`.
- Business logic sits in `apps/api/src/submissions/submissions.service.ts`:
  - Detects keywords (“alcohol”, etc.)
  - Prompts for follow-up (alcohol sales percentage)
  - Ensures conversation state flows correctly
  - Generates responses (currently rules + templated prompts; LLM hooks can be inserted later)
- Chat history is stored in `ChatMessage` rows; deduplication prevents double system greetings.

### 7.4 Conflict resolution UX
- Review pages compare user-entered values (`Submission`) vs extracted data (`ExtractedField`).
- If values differ, the UI shows an “Extracted by AI Agent” badge and a conflict modal.
- Users can view the source document snippet and adopt the AI value.

### 7.5 Admin metadata management
- `/admin` hits `GET/PUT /field-definitions`.
- Backend module: `apps/api/src/field-definitions/*`.
- Allows editing categories, descriptions, extractor logic, document sources, and synonyms.
- “Add field” button inserts a blank row; field name + type required before saving.

### 7.6 Temporal worker overview
- Located in `apps/worker`.
- Activities manage download, OCR/text extraction, classification, and field extraction.
- Ensures long-running tasks survive restarts and gives observability into document processing.

---

## 8. AI/special features quick table
| Feature | Tech / File | Notes |
|---|---|---|
| Field extraction | Temporal worker (`apps/worker/src/activities.ts`) + `extraction-config.json` | Regex + keyword matching, stores `ExtractedField` with context |
| Chat intelligence | `apps/api/src/submissions/submissions.service.ts` | Rule-based prompts (ready for LLM); tracks alcohol logic |
| Conflict badges | `apps/web/src/app/submissions/[id]/page.tsx` & carrier equivalent | Compares form vs extracted values |
| Source document modal | Same review pages | Presents snippets and highlights matches |
| Admin metadata | `/admin`, backed by `FieldDefinition` table | Bulk edit metadata and add new fields |
| Document storage | MinIO via `apps/api/src/files/*` | Upload/download helpers using S3 API |
| Temporal integration | `apps/worker/src/index.ts` | Orchestrates jobs for reliable document processing |

---

## 9. Common troubleshooting tips
- **API fails to start (`EADDRINUSE`):** Kill existing `pnpm api` process (`lsof -i :4000` then `kill` PID).
- **Prisma migration errors:** Ensure Docker Postgres is running; re-run `npx prisma migrate dev`.
- **Seed script issues:** Run from `apps/api`, after migrations: `pnpm run seed`.
- **Admin table “Load failed”:** Usually API isn’t running on `http://localhost:4000`. Start `pnpm api`.
- **Temporal worker errors:** Ensure Temporal containers are up via `docker compose up -d`.

---

## 10. Handoff checklist
- Update README.md and this doc when adding new flows.
- Place new developer docs inside `.dev-docs/`.
- Coordinate database schema changes with teammates (share migration names).
- For production deployment, marketing branch (`marketing-landing`) deploys via Vercel; API/services deployment strategy still TBD.
- Document any prompt tweaks or workflow changes in PR descriptions.

---

You’re all set! Keep this doc handy in Cursor to refresh your memory, and reach out to the team if anything feels unclear. Happy building! 🎉

