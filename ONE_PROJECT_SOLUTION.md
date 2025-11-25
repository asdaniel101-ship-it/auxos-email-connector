# Deploy Both Frontend and API in One Vercel Project

## The Problem
Vercel locked your build command because it auto-detected Next.js. Here's how to deploy both in one project:

## Solution: Use vercel.json to Override

I've updated your `vercel.json` to handle both apps. Here's what to do:

### Step 1: Update Your Existing Project

1. Go to your **existing frontend project** in Vercel
2. Go to **Settings** → **General**
3. The `vercel.json` file should now override the build settings
4. **Redeploy** your project

### Step 2: Verify API Routes Work

The API should be accessible at:
- `https://your-project.vercel.app/api/email-intake/poll`
- `https://your-project.vercel.app/api/email-intake/emails/recent`
- etc.

### Step 3: Update Frontend API URL

In your frontend code, the API_URL should be:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
```

This way:
- **Local**: Uses `/api` which proxies to `http://localhost:4000`
- **Production**: Uses `/api` which routes to your serverless functions

### Step 4: Set Environment Variables

In your Vercel project → **Settings** → **Environment Variables**, add:
- `DATABASE_URL` - Your database connection string
- `GMAIL_EMAIL` - Your Gmail address
- `GMAIL_APP_PASSWORD` - Gmail app password
- `FRONTEND_URL` - Your Vercel URL
- `OPENAI_API_KEY` - Your OpenAI key
- All other API environment variables

### Step 5: Set Up Cron Jobs

For email polling, you have two options:

**Option A: Vercel Cron Jobs (Pro plan)**
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/email-intake/poll",
      "schedule": "* * * * *"
    }
  ]
}
```

**Option B: External Cron (Free)**
Use https://cron-job.org to call:
`https://your-project.vercel.app/api/email-intake/poll`

## How It Works

1. **Frontend** (`apps/web`): Deploys as Next.js app
   - Builds with: `pnpm --filter web run build`
   - Serves from: `apps/web/.next`

2. **API** (`apps/api`): Deploys as serverless functions
   - Entry point: `apps/api/api/index.ts`
   - Routes: `/api/*` → `apps/api/api/index.ts`
   - Max duration: 60 seconds (Pro plan) or 10 seconds (free)

## Important Notes

⚠️ **Function Timeout Limits:**
- **Free/Hobby**: 10 seconds max
- **Pro**: 60 seconds max
- **Enterprise**: 900 seconds max

If your email processing takes longer than 10 seconds, you'll need:
- Vercel Pro plan ($20/month), OR
- Deploy API separately to Railway (free, no timeout)

## Troubleshooting

### API Routes Not Working

1. Check that `apps/api/api/index.ts` exists
2. Verify `vercel.json` has the rewrite rule
3. Check build logs - API should build during deployment
4. Check function logs in Vercel dashboard

### Build Command Still Locked

Even with `vercel.json`, Vercel might still lock it. Try:
1. Delete the project
2. Create new project
3. **Before deploying**, manually set Framework to "Other"
4. Then deploy - `vercel.json` will take over

### API Timeout Issues

If you get timeouts:
- Upgrade to Vercel Pro, OR
- Deploy API to Railway separately
- Keep frontend on Vercel

## Alternative: Keep Them Separate (Recommended)

If you're having issues, **two separate projects is actually better**:
- ✅ No build command conflicts
- ✅ Independent deployments
- ✅ Better for scaling
- ✅ Industry standard

Both projects stay in your Vercel dashboard - they're just separate entries.

