# Deploy API to Vercel - Step by Step

## ⚠️ Important Considerations

Vercel works, but has limitations:
- **Function timeout**: 10 seconds (free), 60 seconds (Pro), 900 seconds (Enterprise)
- **No persistent connections**: IMAP connections must be made on-demand (which is fine for your use case)
- **Cron jobs**: Available on Pro plan ($20/month) or use external cron service
- **Database**: Not included - you'll need an external database (Neon, Supabase, etc.)

Your email polling should work fine since it's stateless and makes connections on-demand.

## Step-by-Step Deployment

### Step 1: Create Separate Vercel Project for API

1. Go to https://vercel.com
2. Click "Add New..." → "Project"
3. Import your GitHub repository: `brokerzeroashton1`
4. Select branch: `feature/email-intake-mvp`
5. Click "Deploy" (we'll configure it next)

### Step 2: Configure Project Settings

After initial deploy, go to **Settings** → **General**:

- **Root Directory**: Leave empty (uses repo root)
- **Framework Preset**: Select "Other"
- **Build Command**: `pnpm install && pnpm --filter api run build`
- **Output Directory**: `apps/api/dist` (but NestJS doesn't use this - see Step 3)
- **Install Command**: `pnpm install`

**Important**: NestJS doesn't work as a traditional Vercel serverless function. We need to create a serverless adapter.

### Step 3: Vercel Serverless Adapter (Already Created)

✅ The files are already created:
- `apps/api/vercel.ts` - Serverless adapter for NestJS
- `apps/api/api/index.ts` - Vercel API route entry point

These files wrap your NestJS app to work with Vercel's serverless functions.

### Step 4: Configure Vercel Project

In your Vercel API project settings:
- **Root Directory**: Leave empty
- **Framework Preset**: "Other"
- **Build Command**: `pnpm install && pnpm --filter api run build`
- **Output Directory**: Leave empty (not used for serverless)
- **Install Command**: `pnpm install`

**Note**: Vercel will automatically detect the `apps/api/api/index.ts` file as the serverless function entry point.

### Step 5: Set Up Database

Vercel doesn't provide databases. Choose one:

**Option A: Neon (Recommended - Free tier)**
1. Go to https://neon.tech
2. Create account and database
3. Copy connection string
4. Add as `DATABASE_URL` in Vercel environment variables

**Option B: Supabase (Free tier)**
1. Go to https://supabase.com
2. Create project
3. Get connection string from Settings → Database
4. Add as `DATABASE_URL` in Vercel

### Step 6: Add Environment Variables

In Vercel → Settings → Environment Variables:

**Required:**
- `DATABASE_URL` - From Neon/Supabase
- `GMAIL_EMAIL` - `auxoreachout@gmail.com`
- `GMAIL_APP_PASSWORD` - Your Gmail app password
- `FRONTEND_URL` - Your frontend Vercel URL
- `OPENAI_API_KEY` - Your OpenAI key
- `NODE_ENV` - `production`

**Optional:**
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` - Or use Vercel Blob
- `API_KEY` - For authentication

### Step 7: Run Database Migrations

```bash
# Install Vercel CLI
npm i -g vercel

# Link to your API project
cd apps/api
vercel link

# Pull environment variables
vercel env pull .env.local

# Run migrations
npx prisma migrate deploy
```

### Step 8: Set Up Email Polling (Cron)

**Option A: Vercel Cron Jobs (Requires Pro - $20/month)**

✅ A `vercel-api.json` file is already created in the repo root with cron configuration.

In your Vercel API project:
1. Go to Settings → General
2. The cron job will be automatically configured from the `vercel-api.json` file
3. Or manually add in Vercel dashboard: Settings → Cron Jobs → Add Cron Job
   - Path: `/api/email-intake/poll`
   - Schedule: `* * * * *` (every minute)

**Option B: External Cron Service (Free)**

1. Sign up at https://cron-job.org (free)
2. Create cron job:
   - URL: `https://your-api.vercel.app/api/email-intake/poll`
   - Schedule: Every minute
   - Method: POST

### Step 9: Update Frontend

1. Go to your **frontend** Vercel project
2. Settings → Environment Variables
3. Add: `NEXT_PUBLIC_API_URL` = `https://your-api.vercel.app`
4. Redeploy frontend

## Alternative: Simpler Approach

If the serverless adapter is too complex, consider:

1. **Deploy API to Railway** (5 minutes, includes database)
2. **Use Vercel Cron Jobs** to call Railway API (if you have Pro)
3. **Or use external cron** to call Railway API (free)

This gives you:
- ✅ Free database
- ✅ No timeout issues
- ✅ Better for IMAP
- ✅ Still easy to manage

## Troubleshooting

### Function Timeout
If email processing takes > 10 seconds (free) or > 60 seconds (Pro):
- Process emails in smaller batches
- Use Vercel Background Functions (Pro plan)
- Or deploy to Railway instead

### Database Connection Issues
- Make sure `DATABASE_URL` is set correctly
- Check database allows connections from Vercel IPs
- Run migrations: `npx prisma migrate deploy`

### CORS Errors
- Verify `FRONTEND_URL` is set correctly in API project
- Check CORS configuration in `vercel.ts`
