# Quick API Deployment to Vercel

## TL;DR - Fastest Path

1. **Create new Vercel project** → Import your repo
2. **Before deploying**: Click "Configure Project"
3. **Set Framework to "Other"** (this unlocks build command)
4. **Set Build Command**: `pnpm install && pnpm --filter api run build`
5. **Add environment variables** (database, Gmail, OpenAI, etc.)
6. **Deploy**
7. **Update frontend** with API URL

## The Build Command Lock Issue

If the build command is locked:
- **Framework MUST be "Other"** (not Next.js, not Node.js)
- If it's still locked, delete project and recreate
- Or use Vercel CLI (see full guide)

## Files You Need (Already Created ✅)

- ✅ `apps/api/vercel.ts` - Serverless adapter
- ✅ `apps/api/api/index.ts` - Entry point
- ✅ `vercel-api.json` - Config (optional, but helpful)

## Environment Variables Needed

**Required:**
- `DATABASE_URL` - Get from Neon/Supabase
- `GMAIL_EMAIL` - `auxoreachout@gmail.com`
- `GMAIL_APP_PASSWORD` - Your Gmail app password
- `FRONTEND_URL` - Your frontend Vercel URL
- `OPENAI_API_KEY` - Your OpenAI key

**After deployment:**
- Get your API URL from Vercel
- Add `NEXT_PUBLIC_API_URL` to your frontend project
- Redeploy frontend

## Full Guide

See `API_VERCEL_DEPLOYMENT_SIMPLE.md` for detailed step-by-step instructions.

