# Deploy API to Production

The API needs to be deployed to a platform that supports:
- Long-running processes (IMAP email polling)
- Cron jobs (scheduled email polling every minute)
- Database connections (PostgreSQL)
- File storage (MinIO/S3)

## Recommended Platforms

### Option 1: Railway (Easiest)
1. Go to https://railway.app
2. Create a new project
3. Connect your GitHub repository
4. Add a new service → Select "Deploy from GitHub repo"
5. Select your repo and branch `feature/email-intake-mvp`
6. Set root directory to `apps/api`
7. Add environment variables (see below)
8. Railway will auto-detect NestJS and deploy

### Option 2: Render
1. Go to https://render.com
2. Create a new "Web Service"
3. Connect your GitHub repository
4. Set:
   - Root Directory: `apps/api`
   - Build Command: `cd ../.. && pnpm install && pnpm --filter api run build`
   - Start Command: `cd ../.. && pnpm --filter api run start:prod`

### Option 3: Fly.io
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Run `fly launch` in `apps/api`
3. Follow the prompts

## Required Environment Variables

Add these to your deployment platform:

### Database
- `DATABASE_URL` - PostgreSQL connection string (Railway/Render provide this automatically)

### Email (Gmail)
- `GMAIL_EMAIL` - Your Gmail address (e.g., `auxoreachout@gmail.com`)
- `GMAIL_APP_PASSWORD` - Gmail app password (not your regular password)

### File Storage (MinIO/S3)
- `MINIO_ENDPOINT` - MinIO endpoint (or S3 endpoint)
- `MINIO_PORT` - Port (usually 9000)
- `MINIO_ACCESS_KEY` - Access key
- `MINIO_SECRET_KEY` - Secret key
- `MINIO_USE_SSL` - `false` for local, `true` for production
- `MINIO_BUCKET_NAME` - Bucket name (usually `documents`)

### Frontend URL (for CORS)
- `FRONTEND_URL` - Your Vercel frontend URL (e.g., `https://your-app.vercel.app`)

### API Key (for authentication)
- `API_KEY` - A secret key for API authentication

### OpenAI (for AI features)
- `OPENAI_API_KEY` - Your OpenAI API key

## After Deployment

1. Get your API URL (e.g., `https://your-api.railway.app`)
2. Go to Vercel → Your Project → Settings → Environment Variables
3. Add: `NEXT_PUBLIC_API_URL` = `https://your-api.railway.app`
4. Redeploy your Vercel frontend

## Database Setup

You'll need to:
1. Create a PostgreSQL database (Railway/Render provide this)
2. Run migrations: `pnpm --filter api run prisma:migrate deploy`
3. Or set up automatic migrations in your deployment platform

