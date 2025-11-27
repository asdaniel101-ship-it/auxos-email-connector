# FORYOURCURSORREADME

Welcome to the Email Intake System inside Cursor! This doc gives you a patient, step-by-step walkthrough of everything you need to know to work on the project—even if you've never touched it before.

---

## 1. Big-picture: what is this project?

- **Email Intake System** is a platform for processing insurance submission emails and extracting structured data automatically.
- It has:
  - A **Next.js** frontend (`apps/web`) for viewing submissions, extracted fields, and admin tools.
  - A **NestJS** API (`apps/api`) backed by **Prisma** + Postgres for email processing, field extraction, and submission management.
  - **LLM-powered extraction** using OpenAI to extract structured data from email attachments (PDFs, Excel, Word).

---

## 2. Repo structure cheat sheet

```
apps/
  api/    -> NestJS backend, Prisma models, email processing, field extraction
  web/    -> Next.js frontend (dashboard, submission details, admin UI)
  worker/ -> Temporal worker (optional, for background processing)
.cursor-messages/ -> Developer documentation (this file lives here!)
compose.yaml -> Docker services (Postgres, Redis, MinIO, Temporal)
```

---

## 3. First-time setup (do this once)

1. **Clone & enter repo**
   ```bash
   git clone <repo-url>
   cd auxos-email-connector-feature-email-intake-mvp
   ```

2. **Install prerequisites**
   - Node.js ≥18, pnpm ≥8 (`npm install -g pnpm`)
   - Docker Desktop (for Postgres/Redis/MinIO/Temporal)

3. **Install dependencies**
   ```bash
   pnpm install
   ```

4. **Set up environment variables**
   - Create `apps/api/.env` with required variables (see `apps/api/README.md`)
   - Create `apps/web/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:4000`

---

## 4. Everyday boot sequence

Open terminals (or use Cursor's split shell):

1. **Infrastructure**
   ```bash
   pnpm up  # or: docker compose up -d
   ```
   This starts Postgres, MinIO, Redis, and Temporal.

2. **Database migration (only when schema changes or first run)**
   ```bash
   cd apps/api
   pnpm prisma:migrate
   cd ../..
   ```

3. **Services**
   ```bash
   pnpm api     # API on http://localhost:4000
   pnpm web     # Web app on http://localhost:3000
   ```

4. **Helpful URLs**
   - Web Dashboard: `http://localhost:3000/dashboard`
   - Swagger docs: `http://localhost:4000/docs`
   - Prisma Studio: `cd apps/api && pnpm prisma:studio`

Stop services with `Ctrl+C`. Shut down Docker containers via `docker compose down`.

---

## 5. Git workflow

- Main development happens on the `main` branch.
- Stay current:
  ```bash
  git pull --rebase origin main
  ```
- Use feature branches if collaborating, then open PRs into `main`.

---

## 6. Frontend pages and what they do

- `/` – Landing page with hero section
- `/dashboard` – View all processed email submissions
- `/submission/[id]` – Submission details page with extracted fields and source documents
- `/upload-eml` – Upload .eml files for testing
- `/debug-emails` – Email debugging tools
- `/admin/field-schema` – Field schema management

Frontend code lives under `apps/web/src/app`.

---

## 7. Backend services & special functionality

### 7.1 Prisma + Postgres
- Schema: `apps/api/prisma/schema.prisma`
- Models include `EmailMessage`, `EmailAttachment`, `ExtractionResult`, `FieldExtraction`, `Submission`.
- Migrations live in `apps/api/prisma/migrations/`.
- Run `pnpm prisma:migrate` whenever you pull new schema changes.

### 7.2 Email processing
- IMAP integration to receive emails from Gmail
- Automatic polling every 60 seconds (configurable)
- Email parsing and attachment extraction
- Storage in MinIO (S3-compatible object storage)

### 7.3 Document parsing & field extraction
- Documents (PDFs, Excel, Word) are parsed to extract text
- LLM-powered extraction using OpenAI to extract structured fields
- Field extraction uses `field-schema.json` as the source of truth
- Extracted fields are stored with document chunks for source citation

### 7.4 Email replies
- Automatically sends formatted reply emails with extracted data
- Includes summary, structured table, and links to view source documents
- Clickable fields in email link to submission details page

### 7.5 Field schema
- Central schema definition in `apps/api/field-schema.json`
- Defines all expected fields for submissions, locations, coverage, and loss history
- Used by both extraction and UI rendering

---

## 8. Key features quick reference

| Feature | Tech / File | Notes |
|---|---|---|
| Email intake | IMAP (`apps/api/src/email-intake/email-listener.service.ts`) | Polls Gmail, processes emails |
| Field extraction | LLM (`apps/api/src/email-intake/field-extraction.service.ts`) | Uses OpenAI to extract structured data |
| Document parsing | `apps/api/src/email-intake/document-parser.service.ts` | Parses PDFs, Excel, Word |
| Email replies | `apps/api/src/email-intake/email-listener.service.ts` | Sends formatted HTML replies |
| Submission storage | Prisma + Postgres | Stores emails, attachments, extracted data |
| File storage | MinIO (`apps/api/src/files/minio.service.ts`) | S3-compatible object storage |

---

## 9. Common troubleshooting tips

- **API fails to start (`EADDRINUSE`):** Kill existing `pnpm api` process (`lsof -i :4000` then `kill` PID).
- **Prisma migration errors:** Ensure Docker Postgres is running; re-run `pnpm prisma:migrate`.
- **Email not processing:** Check Gmail credentials in `apps/api/.env`, verify IMAP is enabled.
- **Field extraction failing:** Verify `OPENAI_API_KEY` is set and has credits.
- **Dashboard shows errors:** Check API is running on `http://localhost:4000`, verify CORS settings.
- **MinIO errors:** Ensure MinIO is running: `docker ps` should show minio container.

---

## 10. Testing

### Upload a .eml file for testing:
```bash
curl -X POST http://localhost:4000/email-intake/test/upload-eml \
  -F "file=@/path/to/your/submission.eml"
```

### Manual email polling:
```bash
curl -X POST http://localhost:4000/email-intake/poll
```

### View submissions:
- Dashboard: `http://localhost:3000/dashboard`
- API: `GET http://localhost:4000/email-intake/submissions`

---

## 11. Handoff checklist

- Update README files when adding new features.
- Place new developer docs inside `.cursor-messages/`.
- Coordinate database schema changes with teammates (share migration names).
- Document any prompt tweaks or extraction logic changes in PR descriptions.

---

You're all set! Keep this doc handy in Cursor to refresh your memory, and reach out to the team if anything feels unclear. Happy building! 🎉
