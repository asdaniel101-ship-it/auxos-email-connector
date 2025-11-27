# Email Intake System

A monorepo application for processing insurance submission emails and extracting structured data automatically using LLM-powered field extraction.

## Overview

This system processes incoming emails with insurance submission documents, extracts structured data using AI, and provides a web dashboard for viewing and managing submissions.

### Components

- **API** (`apps/api`): NestJS backend for email processing, field extraction, and data management
- **Web** (`apps/web`): Next.js frontend dashboard for viewing submissions and extracted fields

## Features

### API Features
- **Email Processing**: IMAP integration to receive and process emails automatically
- **Document Parsing**: Extract text from PDFs, Excel, Word documents
- **Field Extraction**: LLM-powered extraction of structured data from documents
- **Submission Management**: Store and manage insurance submissions with extracted fields
- **Email Replies**: Automatically send formatted replies with extracted data

### Web Features
- **Dashboard**: View all processed email submissions
- **Submission Details**: View extracted fields and source documents
- **Field Inspection**: Click on extracted fields to see source document excerpts
- **Admin Tools**: Field schema management and email debugging

## Tech Stack

### Backend
- **NestJS**: Backend framework
- **Prisma**: Database ORM
- **PostgreSQL**: Database
- **MinIO**: Object storage (S3-compatible)
- **OpenAI**: LLM for field extraction
- **Swagger**: API documentation

### Frontend
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Vercel Analytics**: Analytics tracking

## Getting Started

### Prerequisites

- Node.js ≥18
- pnpm ≥8
- Docker Desktop (for Postgres, MinIO, Redis, Temporal)

### Installation

```bash
# Install dependencies
pnpm install
```

### Environment Variables

#### API (`apps/api/.env`)

Required:
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API key for field extraction

Optional:
- `GMAIL_EMAIL`: Gmail account for email intake
- `GMAIL_APP_PASSWORD`: Gmail app password
- `MINIO_ENDPOINT`: MinIO endpoint (default: localhost)
- `MINIO_PORT`: MinIO port (default: 9000)
- `MINIO_ACCESS_KEY`: MinIO access key
- `MINIO_SECRET_KEY`: MinIO secret key
- `PORT`: API port (default: 4000)
- `FRONTEND_URL`: Frontend URL for CORS
- `API_KEY`: API authentication key (optional)

#### Web (`apps/web/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Running the Application

1. **Start Docker services**
   ```bash
   pnpm up
   # or: docker compose up -d
   ```
   This starts Postgres, MinIO, Redis, and Temporal.

2. **Run database migrations**
   ```bash
   cd apps/api
   pnpm prisma:migrate
   cd ../..
   ```

3. **Start the API server**
   ```bash
   pnpm api
   ```
   The API will be available at `http://localhost:4000`

4. **Start the web server** (in a new terminal)
   ```bash
   pnpm web
   ```
   The web app will be available at `http://localhost:3000`

## Project Structure

```
.
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── email-intake/   # Email processing and field extraction
│   │   │   ├── field-schema/   # Field schema management
│   │   │   ├── documents/      # Document management
│   │   │   └── files/          # File upload/download (MinIO)
│   │   └── prisma/
│   │       └── schema.prisma   # Database schema
│   └── web/                    # Next.js frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── dashboard/        # Main dashboard
│       │   │   ├── submission/[id]/   # Submission details page
│       │   │   ├── upload-eml/        # .eml file upload
│       │   │   └── admin/              # Admin tools
│       │   ├── components/            # React components
│       │   └── lib/                   # Utilities
│       └── public/                    # Static assets
├── compose.yaml                       # Docker services configuration
└── package.json                       # Root package.json with workspace scripts
```

## Key Endpoints

### API Endpoints

- `GET /health` - Health check
- `POST /email-intake/poll` - Manually trigger email polling
- `GET /email-intake/submissions` - List all submissions
- `GET /email-intake/submissions/:id` - Get submission details
- `POST /email-intake/test/upload-eml` - Upload .eml file for testing
- `GET /field-schema/expected` - Get expected field schema
- `GET /docs` - Swagger API documentation

### Web Pages

- `/` - Landing page
- `/dashboard` - View all submissions
- `/submission/[id]` - Submission details with extracted fields
- `/upload-eml` - Upload .eml files for testing
- `/debug-emails` - Email debugging tools
- `/admin/field-schema` - Field schema management

## Development

### Database Management

The project uses Prisma for database management:

```bash
# Run migrations
cd apps/api
pnpm prisma:migrate

# Generate Prisma Client
pnpm prisma:generate

# Open Prisma Studio
pnpm prisma:studio
```

### Testing

#### Upload a .eml file for testing:
```bash
curl -X POST http://localhost:4000/email-intake/test/upload-eml \
  -F "file=@/path/to/your/submission.eml"
```

#### Manual email polling:
```bash
curl -X POST http://localhost:4000/email-intake/poll
```

#### View submissions:
- Dashboard: `http://localhost:3000/dashboard`
- API: `GET http://localhost:4000/email-intake/submissions`

### Running Tests

```bash
# API unit tests
cd apps/api
pnpm test

# API e2e tests
pnpm test:e2e
```

## Helpful URLs

- Web Dashboard: `http://localhost:3000/dashboard`
- Swagger API Docs: `http://localhost:4000/docs`
- Prisma Studio: `cd apps/api && pnpm prisma:studio`
- MinIO Console: `http://localhost:9001` (dev/dev12345)

## Troubleshooting

- **API fails to start (`EADDRINUSE`):** Kill existing `pnpm api` process (`lsof -i :4000` then `kill` PID).
- **Prisma migration errors:** Ensure Docker Postgres is running; re-run `pnpm prisma:migrate`.
- **Email not processing:** Check Gmail credentials in `apps/api/.env`, verify IMAP is enabled.
- **Field extraction failing:** Verify `OPENAI_API_KEY` is set and has credits.
- **Dashboard shows errors:** Check API is running on `http://localhost:4000`, verify CORS settings.
- **MinIO errors:** Ensure MinIO is running: `docker ps` should show minio container.

## License

Private project

