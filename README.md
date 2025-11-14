# BrokerZero

## Setup

### 1. Git prerequisites
- Ensure you have a GitHub account and access to the `BrokerZero` repository.
- Clone the repo (or add as a remote if you already have a copy):
  ```bash
  git clone https://github.com/asdaniel101-ship-it/brokerzeroashton1.git
  cd brokerzeroashton1
  ```
- Always work from the `main` branch unless explicitly instructed otherwise. Never push directly to `marketing-landing`—that branch powers the public marketing site.

### 2. Requirements & packages
- **Node.js** v18+
- **pnpm** v8+ (`npm install -g pnpm` if you don’t have it)
- **Docker Desktop** (for Postgres, Redis, MinIO services)
- Optional but recommended:
  - Temporal CLI (if you want to run worker workflows end-to-end)
  - Prisma CLI (`pnpm dlx prisma`)

After installing prerequisites, install dependencies once:
```bash
pnpm install
```

### 3. Commands to run the app locally

From the repo root:
```bash
# start supporting services (Postgres, Redis, MinIO)
docker compose up -d

# apply database migrations (run whenever schema changes)
cd apps/api
npx prisma migrate dev
pnpm run seed          # seeds default data/field definitions
cd ../..

# start services (run each time in separate terminals)
pnpm api               # NestJS API at http://localhost:4000
pnpm worker            # Temporal worker (optional for doc processing)
pnpm web               # Next.js web app at http://localhost:3000
```

Stop services with `Ctrl+C`. To shut down the infrastructure containers, run `docker compose down`.

### 4. Where to view the app
- **Web app:** http://localhost:3000
- **API docs:** http://localhost:4000/docs (Swagger UI)
- **Database UI (optional):** `cd apps/api && pnpm prisma:studio`

## Repository overview

```
├── apps/
│   ├── api/          # NestJS backend (REST API, Prisma, chat workflow logic)
│   ├── web/          # Next.js frontend (SMB intake, carrier portal, admin tools)
│   └── worker/       # Temporal worker for document processing/extractions
├── packages/         # Shared libraries (UI components, config)
├── compose.yaml      # Docker services (Postgres, Redis, MinIO, Temporal)
└── README.md         # This document
```

Key directories inside `apps/api`:
- `prisma/schema.prisma` – Prisma models for submissions, documents, field definitions, etc.
- `src/submissions` – controllers/services for intake flow, chat, and carrier pages.
- `src/field-definitions` – admin CRUD endpoints that power the metadata table.

Key directories inside `apps/web`:
- `src/app` – Next.js App Router pages.
  - `intake/` – SMB-side intake/chat flow.
  - `carrier/` – Carrier dashboard, review, quote pages.
  - `admin/` – Field metadata admin UI.
  - `page.tsx` – Landing page / hero.

## Git workflow overview

- **main** – Primary development branch. Use feature branches off `main` and merge via PRs if working with a team.
- **marketing-landing** – Dedicated branch for the public marketing site (deployed to Vercel). **Do not push changes here unless you’re updating the marketing site.**
- When collaborating:
  - `git pull --rebase origin main` to stay current.
  - Commit frequently with descriptive messages.
  - Coordinate schema changes (Prisma migrations) to avoid conflicts.

## Pages overview

- `/` – Marketing hero for BrokerZero (branding, value props, demo CTA).
- `/request-demo` – Demo request form (submits contact info, shows success state).
- `/intake` – SMB intake landing page to start a submission.
- `/intake/[id]/chat` – Conversational flow for business owners (restaurant alcohol logic included).
- `/submissions/[id]` – SMB-side submission review page with AI extraction badges and source-document modal.
- `/carrier` – Carrier dashboard showing metrics and new submissions queue.
- `/carrier/submissions/[id]` – Carrier review page (edit fields, conflict handling, remove from queue).
- `/carrier/submissions/[id]/quote` – Quote entry page for carriers.
- `/admin` – Field metadata admin table (edit categories, extractor notes, add new fields).

## Key tools & platform functionality

- **Prisma ORM**  
  Central data layer for submissions, chat messages, documents, extracted fields, and the new `FieldDefinition` metadata. The schema in `apps/api/prisma/schema.prisma` drives migrations and type-safe access throughout the NestJS API. Migrations live under `apps/api/prisma/migrations`.

- **Document ingestion & OCR**  
  Uploads are stored in MinIO (S3-compatible). The Temporal worker (`apps/worker`) orchestrates downloading files, running OCR/text extraction, and chunking. Currently PDFs are read via pdf-lib/text extraction (no external OCR service yet); the pipeline creates chunks, classifies document types, and writes extracted snippets back to the API.

- **Field extraction pipeline**  
  `apps/api/extraction-config.json` defines instructions, keywords, and regex patterns per field. The worker reads this config to match text, capture contextual snippets, and persist results in `ExtractedField`. It stores 300+ characters of surrounding context to support the “See source document” view.

- **AI assistance in chat**  
  The submissions service (`apps/api/src/submissions/submissions.service.ts`) handles message analysis and response generation. It uses rule-based NLP (keyword + regex matching) for domain-specific prompts (e.g., alcohol sales percentage follow-up) and hides automation details behind Temporal tasks. Future drop-in for LLM calls can hook into the same service.

- **Conflict resolution UX**  
  Both SMB and carrier review pages (`apps/web/src/app/submissions/...` and `apps/web/src/app/carrier/...`) compare user-entered data vs. document extractions, surface conflicts with badges, and let users accept extracted values or view source snippets.

- **Metadata administration**  
  The admin page `/admin` calls `GET/PUT /field-definitions` to edit global field metadata, including extractor logic, aliases, and document sources. Bulk updates are handled via Prisma transactions. This metadata is intended to drive future ingestion logic and reporting consistency.

- **Temporal workflow integration**  
  The worker communicates with the API via gRPC/HTTP to trigger document processing, ensuring long-running tasks (OCR, extractions) are resilient. Temporal’s activity definitions live in `apps/worker/src/activities.ts`.

- **Prompt & chat state management**  
  Chat prompts and responses are stored in `ChatMessage` records. The API filters duplicates, enforces conversation order, and uses prompt templates inside the service layer. When prompts are updated, migrations + seed scripts ensure new metadata fields remain consistent.

## Handoff notes

- **Environment variables:** See `.env.example` or team documentation; ensure Next.js (`apps/web`) and API (`apps/api`) have matching `NEXT_PUBLIC_API_URL` and `DATABASE_URL` settings.
- **Database migrations:** Run `npx prisma migrate dev` after pulling new migrations. Seed with `pnpm run seed` inside `apps/api`.
- **Temporal workflows:** `pnpm worker` uses Temporal; keep the service running if testing document extraction end-to-end.
- **Linting/testing:** `pnpm lint` and `pnpm test` (per workspace) before committing. Next.js build runs with Turbopack; Vercel expects lint-clean code unless `ignoreDuringBuilds` is set.
- **Deployment:** Marketing site (`marketing-landing`) deploys via Vercel. API/workers run locally via Docker Compose; production deployment scripts TBD.
- **Support material:** Additional guides live in `.dev-docs/`—add new developer docs there to keep the repo root tidy.

For questions or handoffs, document context in PR descriptions and update this README as new pages/services are added. Happy shipping! 🚀