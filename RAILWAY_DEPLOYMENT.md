# Deploy API to Railway - Step by Step

## Why Railway?
- Supports long-running processes (IMAP polling)
- Built-in cron job support
- Automatic PostgreSQL database
- Easy environment variable management
- Free tier available

## Step-by-Step Deployment

### 1. Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub (easiest)
3. Authorize Railway to access your repositories

### 2. Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Find and select: `brokerzeroashton1` (or your repo name)
4. Select branch: `feature/email-intake-mvp`

### 3. Add PostgreSQL Database
1. In your Railway project, click "+ New"
2. Select "Database" → "Add PostgreSQL"
3. Railway will automatically create a database and set `DATABASE_URL`
4. Copy the `DATABASE_URL` - you'll need it later

### 4. Configure API Service
1. Railway should auto-detect your repo and the `railway.json` config file
2. If it creates a service, click on it
3. Go to "Settings" tab
4. Verify these settings (Railway should auto-detect from `railway.json`):
   - **Root Directory**: Leave empty (Railway will use repo root for monorepo)
   - **Build Command**: `pnpm install && pnpm --filter api run build`
   - **Start Command**: `pnpm --filter api run start:prod`
   
   **Note:** The `railway.json` file in the repo root should handle this automatically, but you can verify these settings match.

### 5. Add Environment Variables
In your API service → "Variables" tab, add:

**Required:**
- `DATABASE_URL` - Already set by Railway PostgreSQL (check the database service)
- `GMAIL_EMAIL` - `auxoreachout@gmail.com`
- `GMAIL_APP_PASSWORD` - Your Gmail app password (not your regular password)
- `FRONTEND_URL` - Your Vercel frontend URL (e.g., `https://auxo-email-connector.vercel.app`)
- `OPENAI_API_KEY` - Your OpenAI API key

**Optional (for file storage):**
- `MINIO_ENDPOINT` - If using external MinIO/S3
- `MINIO_ACCESS_KEY` - MinIO access key
- `MINIO_SECRET_KEY` - MinIO secret key
- `MINIO_PORT` - `9000`
- `MINIO_USE_SSL` - `false` for local MinIO, `true` for S3
- `MINIO_BUCKET_NAME` - `documents`

**For API authentication:**
- `API_KEY` - Generate a random secret key (e.g., `openssl rand -hex 32`)

### 6. Run Database Migrations
1. In Railway, go to your API service
2. Click "Deployments" → Latest deployment → "View Logs"
3. Or use Railway's CLI:
   ```bash
   railway run pnpm --filter api run prisma:migrate deploy
   ```

### 7. Get Your API URL
1. In Railway, go to your API service
2. Click "Settings" → "Networking"
3. Generate a domain (e.g., `auxo-api.up.railway.app`)
4. Copy this URL - this is your API URL

### 8. Update Vercel Frontend
1. Go to Vercel → Your Project → Settings → Environment Variables
2. Add: `NEXT_PUBLIC_API_URL` = `https://auxo-api.up.railway.app` (your Railway URL)
3. Go to "Deployments" → Click "Redeploy" on the latest deployment

### 9. Update API CORS
1. Make sure `FRONTEND_URL` in Railway is set to your Vercel URL
2. The API will automatically allow CORS from that domain

## Troubleshooting

### Database Connection Issues
- Make sure `DATABASE_URL` is set correctly
- Check that PostgreSQL service is running in Railway
- Run migrations: `railway run pnpm --filter api run prisma:migrate deploy`

### Email Processing Not Working
- Check `GMAIL_EMAIL` and `GMAIL_APP_PASSWORD` are correct
- Verify Gmail app password is valid (not your regular password)
- Check Railway logs for IMAP connection errors

### Frontend Can't Connect
- Verify `NEXT_PUBLIC_API_URL` is set in Vercel
- Check Railway API is running (visit the URL in browser)
- Verify CORS is configured (check `FRONTEND_URL` in Railway)

## Quick Commands

```bash
# Install Railway CLI (optional)
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Run migrations
railway run pnpm --filter api run prisma:migrate deploy

# View logs
railway logs
```

