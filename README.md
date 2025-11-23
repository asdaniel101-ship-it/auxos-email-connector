# SMB Lead Marketplace

**TurboTax for SMB Data Intake** – A web app where SMBs walk through a chat-driven "interview" + doc upload, and you output a clean, structured dossier that can be sold as a lead or used to prefill other systems.

## Product Overview

This platform serves two verticals:
- **Commercial Insurance (SMB P&C)** – GL/BOP/WC for restaurants, retail shops, and local services
- **SMB Lending** – Term loans and lines of credit for working capital

Both verticals share ~70% of the same "business profile" fields, making the data model reusable.

### Primary Personas

1. **SMB Owner** – Confused but motivated, wants funding/insurance quickly, hates forms
2. **Receiver / Buyer** – Broker or lender who wants "underwriting-ready" leads with normalized data

## Setup

### 1. Git prerequisites
- Ensure you have a GitHub account and access to the repository
- Clone the repo:
  ```bash
  git clone <repo-url>
  cd insurance-app
  ```
- Work from the `main` branch or create a feature branch

### 2. Requirements & packages
- **Node.js** v18+
- **pnpm** v8+ (`npm install -g pnpm` if you don't have it)
- **Docker Desktop** (for Postgres, Redis, MinIO, Temporal services)
- Optional but recommended:
  - Temporal CLI (if you want to run worker workflows end-to-end)
  - Prisma CLI (`pnpm dlx prisma`)

After installing prerequisites, install dependencies once:
```bash
pnpm install
```

### 3. Environment Variables

Create a `.env` file in `apps/api` with:
```env
DATABASE_URL="postgresql://dev:dev@localhost:5432/app"
OPENAI_API_KEY="your-openai-api-key"  # Optional - chat works without it using rule-based patterns
OPENAI_MODEL="gpt-4o-mini"  # Optional, only used if OPENAI_API_KEY is set
API_URL="http://localhost:4000"
MINIO_ENDPOINT="localhost"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="dev"
MINIO_SECRET_KEY="dev12345"
```

**Note:** The chat system uses rule-based pattern matching (like the main branch) and works **without** an OpenAI API key. If you provide an API key, it will enhance responses with more natural language, but it's completely optional.

### 4. Commands to run the app locally

From the repo root:
```bash
# start supporting services (Postgres, Redis, MinIO, Temporal)
docker compose up -d

# apply database migrations (run whenever schema changes)
cd apps/api
npx prisma migrate dev
pnpm run seed          # seeds default data/field definitions
cd ../..

# start services (run each time in separate terminals)
pnpm api               # NestJS API at http://localhost:4000
pnpm worker            # Temporal worker (for doc processing)
pnpm web               # Next.js web app at http://localhost:3000
```

Stop services with `Ctrl+C`. To shut down the infrastructure containers, run `docker compose down`.

### 5. Where to view the app
- **Web app:** http://localhost:3000
- **API docs:** http://localhost:4000/docs (Swagger UI)
- **Database UI (optional):** `cd apps/api && pnpm prisma:studio`

## Repository overview

```
├── apps/
│   ├── api/          # NestJS backend (REST API, Prisma, chat workflow logic)
│   ├── web/          # Next.js frontend (SMB intake, partner portal, admin tools)
│   └── worker/       # Temporal worker for document processing/extractions
├── packages/         # Shared libraries (UI components, config)
├── compose.yaml      # Docker services (Postgres, Redis, MinIO, Temporal)
└── README.md         # This document
```

Key directories inside `apps/api`:
- `prisma/schema.prisma` – Prisma models for sessions, leads, partners, documents, etc.
- `src/sessions` – Session management (replaces old submissions)
- `src/leads` – Lead management and completion tracking
- `src/chat` – LLM-powered chat orchestration
- `src/partners` – Partner/buyer management and lead matching
- `src/documents` – Document upload and processing

Key directories inside `apps/web`:
- `src/app` – Next.js App Router pages
  - `/` – Landing page with two CTAs (insurance/lending)
  - `/start` – Pre-intake form
  - `/intake/[sessionId]` – Chat-driven intake flow
  - `/review/[sessionId]` – Summary & consent
  - `/partners/dashboard` – Partner lead dashboard
  - `/partners/leads/[leadId]` – Lead detail view

## Pages overview

### SMB-facing pages
- `/` – Landing page with two CTAs: "I want better insurance quotes" and "I want small business funding"
- `/start` – Pre-intake form (collects vertical, business type, name, email)
- `/intake/[sessionId]` – Main chat interface with document upload panel
- `/review/[sessionId]` – Summary page with confirmation and matching trigger

### Partner/Buyer-facing pages
- `/partners/dashboard` – Lead table showing assigned leads
- `/partners/leads/[leadId]` – Full lead detail view with accept/reject actions
- `/partners/settings/appetite` – Appetite configuration (TODO)

### Admin pages (TODO)
- `/admin/login` – Admin authentication
- `/admin/leads` – All leads management
- `/admin/partners` – Partner management
- `/admin/analytics` – Analytics dashboard

## Key tools & platform functionality

### Prisma ORM
Central data layer for sessions, leads, chat messages, documents, extracted fields, partners, and lead assignments. The schema in `apps/api/prisma/schema.prisma` drives migrations and type-safe access throughout the NestJS API.

### Document ingestion & OCR
Uploads are stored in MinIO (S3-compatible). The Temporal worker (`apps/worker`) orchestrates downloading files, running OCR/text extraction, and field extraction. PDFs are read via pdf-parse; the pipeline creates chunks, classifies document types, and writes extracted fields back to the API.

### AI-powered chat orchestration
The chat service (`apps/api/src/chat/chat.service.ts`) uses OpenAI to:
- Conduct natural conversations with SMB owners
- Extract structured field data from chat messages
- Ask follow-up questions based on vertical and business type
- Update lead records in real-time

### Field extraction pipeline
Documents are processed by the Temporal worker which:
- Downloads files from MinIO
- Extracts text from PDFs
- Classifies document types
- Extracts fields using regex patterns and keyword matching
- Saves extracted fields to the database with confidence scores

### Lead matching
The matching service (`apps/api/src/partners/matching.service.ts`) implements rule-based matching:
- Matches leads to partners based on appetite criteria (states, industries, revenue ranges, etc.)
- Creates `LeadAssignment` records when matches are found
- Updates lead status to `ASSIGNED`

### Temporal workflow integration
The worker communicates with the API via HTTP to trigger document processing, ensuring long-running tasks (OCR, extractions) are resilient. Temporal's activity definitions live in `apps/worker/src/activities.ts`.

## Data Model

### Core Models
- **Session** – Represents an SMB intake session (vertical, business type, owner info)
- **Lead** – Complete business profile with all collected fields (shared + vertical-specific)
- **ConversationMessage** – Chat messages with optional field updates
- **Document** – Uploaded documents with processing status
- **ExtractedField** – Fields extracted from documents
- **FieldCandidate** – Field candidates from chat or documents (before confirmation)
- **Partner** – Broker/lender with appetite configuration
- **LeadAssignment** – Assignment of leads to partners

## API Endpoints

### Sessions
- `POST /sessions` – Create new session
- `GET /sessions/:id` – Get session with lead and messages
- `GET /sessions` – List all sessions

### Chat
- `POST /chat/:sessionId` – Send chat message (returns assistant response + field updates)

### Leads
- `GET /leads/:id` – Get full lead detail
- `POST /leads/:id/confirm` – Mark lead as ready for matching
- `GET /leads` – List all leads

### Partners
- `POST /partners` – Create partner
- `GET /partners/:id` – Get partner with assignments
- `GET /partners/:id/leads` – Get leads assigned to partner
- `POST /partners/:id/leads/:leadId/accept` – Accept a lead
- `POST /partners/:id/leads/:leadId/reject` – Reject a lead
- `POST /partners/match/:leadId` – Run matching logic

### Documents
- `POST /documents/upload` – Create document record after upload
- `GET /documents/:id` – Get document with extracted fields
- `PATCH /documents/:id` – Update document processing status

## Handoff notes

- **Environment variables:** See `.env.example` or team documentation; ensure Next.js (`apps/web`) and API (`apps/api`) have matching `NEXT_PUBLIC_API_URL` and `DATABASE_URL` settings.
- **Database migrations:** Run `npx prisma migrate dev` after pulling new migrations. Seed with `pnpm run seed` inside `apps/api`.
- **Temporal workflows:** `pnpm worker` uses Temporal; keep the service running if testing document extraction end-to-end. Make sure Temporal server is running (`docker compose up -d temporal`).
- **LLM Integration:** The chat system uses rule-based pattern matching by default (no API key needed). Set `OPENAI_API_KEY` in environment to optionally enhance responses with more natural language, but it's not required.
- **Linting/testing:** `pnpm lint` and `pnpm test` (per workspace) before committing.
- **Deployment:** Production deployment scripts TBD.

For questions or handoffs, document context in PR descriptions and update this README as new pages/services are added. Happy shipping! 🚀
