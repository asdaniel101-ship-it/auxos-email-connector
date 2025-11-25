# 🚀 Dashboard Setup Guide

## Quick Start - Get Dashboard Running

### Step 1: Start Required Services

**Start Docker services (Postgres, MinIO, Redis, Temporal):**
```bash
pnpm up
```

This starts:
- ✅ Postgres (database)
- ✅ MinIO (file storage)
- ✅ Redis
- ✅ Temporal

### Step 2: Ensure Database Migrations Are Applied

**Apply the email intake migrations:**
```bash
cd apps/api
pnpm prisma:migrate
```

This creates the `EmailMessage`, `EmailAttachment`, and `ExtractionResult` tables.

### Step 3: Start the API Server

**In one terminal:**
```bash
pnpm api
```

The API should start on **port 4000** (check the console output). The dashboard expects it on port 3001, so we need to either:
- Change the API port to 3001, OR
- Set the environment variable

**Option A: Change API port (recommended)**
Add to `apps/api/.env`:
```bash
PORT=3001
```

**Option B: Set web app environment variable**
Create/update `apps/web/.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Step 4: Start the Web Server

**In another terminal:**
```bash
pnpm web
```

The web app will start on **http://localhost:3000**

### Step 5: Access the Dashboard

Open your browser to:
**http://localhost:3000/dashboard**

## ✅ What You Should See

- Empty table if no submissions yet
- "No submissions found" message
- Refresh button to reload data

## 🧪 Test It Out

### Option 1: Upload a .eml File

```bash
curl -X POST http://localhost:3001/email-intake/test/upload-eml \
  -F "file=@/path/to/your/submission.eml"
```

Then refresh the dashboard to see it!

### Option 2: Manually Trigger Email Polling

```bash
curl -X POST http://localhost:3001/email-intake/poll
```

## 🔧 Troubleshooting

### Dashboard shows "Failed to load submissions"
- ✅ Check API is running: `curl http://localhost:3001/email-intake/submissions`
- ✅ Check API port matches dashboard expectation (3001 or set NEXT_PUBLIC_API_URL)
- ✅ Check browser console for CORS errors

### API won't start
- ✅ Check database is running: `docker ps` should show postgres
- ✅ Check migrations applied: `cd apps/api && pnpm prisma:migrate`
- ✅ Check .env file exists in `apps/api/.env`

### Database connection errors
- ✅ Ensure Docker is running: `pnpm up`
- ✅ Check DATABASE_URL in `apps/api/.env` points to `app_test` database

### MinIO errors
- ✅ Ensure MinIO is running: `docker ps` should show minio
- ✅ Check MinIO console at http://localhost:9001 (dev/dev12345)

## 📋 Checklist

Before accessing dashboard:
- [ ] Docker services running (`pnpm up`)
- [ ] Database migrations applied (`cd apps/api && pnpm prisma:migrate`)
- [ ] API server running (`pnpm api`) on port 3001 or 4000
- [ ] Web server running (`pnpm web`) on port 3000
- [ ] Browser opens http://localhost:3000/dashboard

## 🎯 Next Steps After Dashboard Works

1. Upload your test .eml file
2. Watch it process in the dashboard
3. View extracted fields and attachments
4. Check processing status and errors

---

**That's it!** Once both servers are running, the dashboard should be accessible at `/dashboard`.

