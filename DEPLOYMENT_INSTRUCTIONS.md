# Single Vercel Deployment - Complete Instructions

## ✅ What I've Done

1. **Restructured for single deployment:**
   - Updated `vercel.json` to build both web and API
   - Created `api/index.ts` at root (Vercel auto-detects this)
   - Updated all frontend files to use `/api` in production
   - Created `apps/web/src/lib/api-url.ts` helper

2. **API Structure:**
   - Root `api/index.ts` → points to `apps/api/vercel.ts`
   - `apps/api/vercel.ts` → NestJS serverless adapter
   - All API routes accessible at `/api/*`

## 🚀 Fresh Deployment Steps

### Step 1: Delete Old Projects (if any)
1. Go to https://vercel.com
2. Delete any existing API projects
3. Keep your frontend project (or delete and recreate)

### Step 2: Create New Single Project
1. Go to Vercel → "Add New..." → "Project"
2. Import your GitHub repo: `brokerzeroashton1`
3. Select branch: `feature/email-intake-mvp`
4. **Before deploying**, click "Configure Project"
5. Settings:
   - **Framework Preset**: "Next.js" (auto-detected is fine)
   - **Root Directory**: Leave empty
   - **Build Command**: Should auto-detect (or `pnpm install && pnpm --filter web run build && pnpm --filter api run build`)
   - **Output Directory**: `apps/web/.next`
   - **Install Command**: `pnpm install`
6. Click "Deploy"

### Step 3: Add Environment Variables

Go to **Settings** → **Environment Variables**, add:

**Required:**
- `DATABASE_URL` - Get from Supabase (see Step 4)
- `GMAIL_EMAIL` - `auxoreachout@gmail.com`
- `GMAIL_APP_PASSWORD` - Your Gmail app password
- `FRONTEND_URL` - Your Vercel URL (e.g., `https://your-project.vercel.app`)
- `OPENAI_API_KEY` - Your OpenAI key
- `NODE_ENV` - `production`

**Optional:**
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` - For file storage
- `API_KEY` - Secret key for API auth

### Step 4: Set Up Supabase Database

**Yes, you still need Supabase** (or Neon) - Vercel doesn't provide databases.

1. Go to https://supabase.com
2. Sign up (free tier available)
3. Create new project
4. Wait for database to provision (~2 minutes)
5. Go to **Settings** → **Database**
6. Copy the connection string (looks like: `postgresql://postgres:[password]@[host]:5432/postgres`)
7. Add it as `DATABASE_URL` in Vercel (Step 3)

### Step 5: Run Database Migrations

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Link to your project
cd /Users/ashtondaniel/dev/insurance-app
vercel link
# Select your project

# Pull environment variables
vercel env pull .env.local

# Run migrations
cd apps/api
npx prisma migrate deploy
```

### Step 6: Set Up Email Polling

**Option A: Vercel Cron Jobs (Pro plan - $20/month)**
- Already configured in `vercel.json`
- Will run automatically

**Option B: External Cron (Free)**
1. Go to https://cron-job.org
2. Create cron job:
   - URL: `https://your-project.vercel.app/api/email-intake/poll`
   - Schedule: Every minute
   - Method: POST

### Step 7: Test Deployment

1. Visit your Vercel URL
2. Test API: `https://your-project.vercel.app/api` (should show API)
3. Test endpoint: `https://your-project.vercel.app/api/email-intake/poll`

## 📝 Important Notes

- **API Routes**: All API calls use `/api/*` (relative path in production)
- **Local Dev**: Still uses `http://localhost:4000` automatically
- **Database**: Must be external (Supabase/Neon) - Vercel doesn't provide one
- **Function Timeout**: 10 seconds (free), 60 seconds (Pro)
- **Cron Jobs**: Require Pro plan, or use external cron service

## 🔧 Troubleshooting

### Build Fails
- Check build logs in Vercel
- Make sure `api/index.ts` exists
- Verify `apps/api/vercel.ts` exists

### API Returns 404
- Check function logs in Vercel dashboard
- Verify `api/index.ts` exports correctly
- Check that routes start with `/api/`

### Database Connection Errors
- Verify `DATABASE_URL` is set correctly
- Check Supabase allows connections from Vercel
- Run migrations (Step 5)

### CORS Errors
- Make sure `FRONTEND_URL` is set to your Vercel URL
- Check CORS config in `apps/api/vercel.ts`

## ✅ Checklist

- [ ] Created single Vercel project
- [ ] Added all environment variables
- [ ] Set up Supabase database
- [ ] Ran database migrations
- [ ] Deployed successfully
- [ ] Set up email polling (cron)
- [ ] Tested API endpoints
- [ ] Tested frontend

