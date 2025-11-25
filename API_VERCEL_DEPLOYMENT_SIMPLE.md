# Deploy API to Vercel - Simple Step-by-Step Guide

## Prerequisites
- Your frontend is already deployed on Vercel
- You have a GitHub repo with your code
- You have environment variables ready (Gmail, OpenAI, Database, etc.)

## Step 1: Create New Vercel Project for API

1. Go to https://vercel.com and log in
2. Click **"Add New..."** button (top right or in your dashboard)
3. Click **"Project"**
4. You'll see "Import Git Repository"
5. Find and select your repository: `brokerzeroashton1` (or whatever your repo is called)
6. Click **"Import"**

## Step 2: Configure Project (CRITICAL STEP)

**BEFORE clicking "Deploy"**, you MUST configure it:

1. You'll see a screen with project settings
2. Look for **"Configure Project"** button - click it
3. You should see these fields:

### Project Name
- Give it a name like: `auxo-api` or `insurance-api`
- This helps you identify it in your dashboard

### Framework Preset
- **IMPORTANT**: Click the dropdown
- Select **"Other"** (NOT Next.js, NOT Node.js, just "Other")
- This unlocks the build command field

### Root Directory
- Leave this **EMPTY** (don't set it to `apps/api`)
- Vercel needs to see the whole repo for the monorepo to work

### Build Command
- You should now be able to edit this (if you selected "Other")
- **Delete** whatever is there (probably `pnpm --filter web run build`)
- Enter: `pnpm install && pnpm --filter api run build`

### Output Directory
- Leave this **EMPTY**

### Install Command
- Should be: `pnpm install`
- If it's different, change it to `pnpm install`

4. **Now click "Deploy"**

## Step 3: If Build Command is Still Locked

If you can't edit the build command even after selecting "Other":

### Option A: Use Vercel CLI (Recommended)

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. In your terminal, go to your project root:
   ```bash
   cd /Users/ashtondaniel/dev/insurance-app
   ```

3. Link to your new API project:
   ```bash
   vercel link
   ```
   - Select your API project when prompted
   - Answer the questions (use defaults)

4. Create a `.vercel` folder (if it doesn't exist) and set the project:
   ```bash
   vercel --prod
   ```
   - When it asks about settings, you can override them
   - Or manually edit `.vercel/project.json` after linking

5. Create `vercel.json` specifically for API (we'll do this next)

### Option B: Delete and Recreate

1. Delete the project you just created
2. Create a new one
3. **This time**, before importing, make sure you:
   - Don't let Vercel auto-detect anything
   - Click "Configure Project" immediately
   - Set Framework to "Other" FIRST
   - Then set build command

## Step 4: Create API-Specific vercel.json

Create a file `vercel-api.json` in your repo root (we already have this, but let's make sure it's right):

```json
{
  "buildCommand": "pnpm install && pnpm --filter api run build",
  "installCommand": "pnpm install",
  "framework": null,
  "outputDirectory": null
}
```

**OR** if you're using Vercel CLI, you can set it via:
```bash
vercel env add BUILD_COMMAND
# Enter: pnpm install && pnpm --filter api run build
```

## Step 5: Add Environment Variables

1. In your API project on Vercel, go to **Settings** → **Environment Variables**

2. Add these (click "Add" for each):

   **Required:**
   - `DATABASE_URL` = Your PostgreSQL connection string
   - `GMAIL_EMAIL` = `auxoreachout@gmail.com`
   - `GMAIL_APP_PASSWORD` = Your Gmail app password
   - `FRONTEND_URL` = Your frontend Vercel URL (e.g., `https://your-frontend.vercel.app`)
   - `OPENAI_API_KEY` = Your OpenAI API key
   - `NODE_ENV` = `production`

   **Optional:**
   - `MINIO_ENDPOINT` = Your MinIO/S3 endpoint
   - `MINIO_ACCESS_KEY` = MinIO access key
   - `MINIO_SECRET_KEY` = MinIO secret key
   - `MINIO_PORT` = `9000`
   - `MINIO_USE_SSL` = `false` or `true`
   - `MINIO_BUCKET_NAME` = `documents`
   - `API_KEY` = A secret key for API auth (generate one)

3. Make sure to select **"Production"** environment for each variable
4. Click **"Save"** after adding each one

## Step 6: Set Up Database

Vercel doesn't provide databases. You need an external one:

### Option A: Neon (Recommended - Free tier)
1. Go to https://neon.tech
2. Sign up (free)
3. Create a new project
4. Copy the connection string (looks like: `postgresql://user:pass@host/dbname`)
5. Add it as `DATABASE_URL` in Vercel (Step 5)

### Option B: Supabase (Free tier)
1. Go to https://supabase.com
2. Sign up and create project
3. Go to Settings → Database
4. Copy connection string
5. Add as `DATABASE_URL` in Vercel

## Step 7: Run Database Migrations

After your database is set up:

1. Install Vercel CLI (if you haven't):
   ```bash
   npm i -g vercel
   ```

2. Link to your API project:
   ```bash
   cd /Users/ashtondaniel/dev/insurance-app
   vercel link
   # Select your API project
   ```

3. Pull environment variables:
   ```bash
   vercel env pull .env.local
   ```

4. Run migrations:
   ```bash
   cd apps/api
   npx prisma migrate deploy
   ```

## Step 8: Deploy and Test

1. Go to your API project in Vercel
2. Click **"Deployments"** tab
3. Click **"Redeploy"** on the latest deployment (or it should auto-deploy)
4. Wait for deployment to complete
5. Check the build logs - you should see:
   ```
   Running "pnpm install && pnpm --filter api run build"
   ```

## Step 9: Get Your API URL

1. In your API project, go to **Settings** → **Domains**
2. You'll see your API URL (e.g., `https://auxo-api.vercel.app`)
3. Copy this URL

## Step 10: Update Frontend to Use API

1. Go to your **frontend** Vercel project
2. Go to **Settings** → **Environment Variables**
3. Add or update:
   - `NEXT_PUBLIC_API_URL` = Your API URL from Step 9 (e.g., `https://auxo-api.vercel.app`)
4. Go to **Deployments** → Click **"Redeploy"** on latest deployment

## Step 11: Set Up Email Polling (Cron)

### Option A: Vercel Cron Jobs (Requires Pro - $20/month)

1. In your API project, go to **Settings** → **Cron Jobs**
2. Click **"Add Cron Job"**
3. Set:
   - **Path**: `/api/email-intake/poll`
   - **Schedule**: `* * * * *` (every minute)
4. Save

### Option B: External Cron Service (Free)

1. Go to https://cron-job.org (free)
2. Sign up
3. Create new cron job:
   - **URL**: `https://your-api.vercel.app/api/email-intake/poll`
   - **Schedule**: Every minute
   - **Method**: POST
4. Save

## Step 12: Test Your API

1. Visit: `https://your-api.vercel.app/api` (should show your API)
2. Visit: `https://your-api.vercel.app/api/email-intake/poll` (should trigger polling)
3. Check your frontend - it should now connect to the API

## Troubleshooting

### Build Command Still Locked

1. Make sure Framework is set to "Other" (not Next.js)
2. Try using Vercel CLI to override (see Step 3, Option A)
3. Or delete project and recreate (see Step 3, Option B)

### Build Fails

Check build logs:
- Should see: `pnpm install && pnpm --filter api run build`
- If you see `pnpm --filter web run build`, the override didn't work
- Make sure `apps/api/api/index.ts` exists
- Make sure `apps/api/vercel.ts` exists

### API Routes Return 404

1. Check that `apps/api/api/index.ts` exists
2. Check that it exports the handler correctly
3. Check Vercel function logs in dashboard
4. Make sure the route is `/api/email-intake/poll` (not `/email-intake/poll`)

### Database Connection Errors

1. Verify `DATABASE_URL` is set correctly
2. Check database allows connections from Vercel IPs
3. Run migrations (Step 7)
4. Check database is running

### CORS Errors

1. Make sure `FRONTEND_URL` is set to your frontend Vercel URL
2. Check CORS configuration in `apps/api/vercel.ts`
3. Verify frontend is calling the correct API URL

## Quick Checklist

- [ ] Created new Vercel project for API
- [ ] Set Framework to "Other"
- [ ] Set Build Command to `pnpm install && pnpm --filter api run build`
- [ ] Added all environment variables
- [ ] Set up external database (Neon/Supabase)
- [ ] Ran database migrations
- [ ] Deployed successfully
- [ ] Got API URL
- [ ] Updated frontend `NEXT_PUBLIC_API_URL`
- [ ] Set up email polling (cron)
- [ ] Tested API endpoints

## Still Having Issues?

If you're stuck on a specific step, let me know:
- What step are you on?
- What error message are you seeing?
- What does the build log show?

