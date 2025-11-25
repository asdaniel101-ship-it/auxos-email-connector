# Deploy Both Frontend and API in One Vercel Project

Yes! You can deploy both `apps/web` and `apps/api` in a single Vercel project. Here's how:

## Option 1: Deploy API as Serverless Functions (Recommended)

Since your frontend is already deployed, we can add the API as serverless functions in the same project.

### Step 1: Update vercel.json

Update your root `vercel.json` to handle both:

```json
{
  "buildCommand": "pnpm install && pnpm --filter web run build",
  "installCommand": "pnpm install",
  "outputDirectory": "apps/web/.next",
  "framework": "nextjs",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/api/:path*"
    }
  ]
}
```

### Step 2: Move API Entry Point

The API serverless function needs to be accessible. The current setup with `apps/api/api/index.ts` should work, but Vercel needs to know about it.

**Actually, a better approach**: Since you're using NestJS, we can deploy it as a separate service but in the same project using Vercel's monorepo features.

## Option 2: Use Vercel Monorepo Configuration (Better for NestJS)

Vercel supports deploying multiple apps from one repo, but it's a bit complex. The simpler approach is:

### Keep Them Separate (Easiest)

**Why separate projects are actually better:**
- ✅ Independent deployments (frontend changes don't trigger API rebuilds)
- ✅ Separate environment variables
- ✅ Different scaling/configuration
- ✅ Easier to manage
- ✅ No build command conflicts

**The only downside**: You need to manage two projects (but they're both in the same Vercel dashboard)

### If You Really Want One Project

You can use Vercel's "Projects" feature to link them, but they still deploy separately. Or:

1. **Deploy frontend as main app** (already done)
2. **Add API endpoints as Next.js API routes** (would require rewriting NestJS controllers)
3. **Or use Vercel's "Deploy Hooks"** to deploy both together

## Recommended Solution: Two Projects, One Dashboard

This is actually the **best practice** for monorepos:

1. **Frontend Project**: `your-app-frontend`
   - Root: repo root
   - Build: `pnpm --filter web run build`
   - Framework: Next.js

2. **API Project**: `your-app-api`
   - Root: repo root  
   - Build: `pnpm --filter api run build`
   - Framework: Other

Both projects:
- Are in the same Vercel dashboard
- Share the same GitHub repo
- Deploy independently
- Can reference each other via environment variables

## Quick Fix for Your Current Issue

Since the build command is locked, try this:

1. **Delete the current API project** (if you just created it)

2. **Create a new project** with a different approach:
   - Go to Vercel → "Add New..." → "Project"
   - Import your repo
   - **Before any auto-detection**, click "Configure Project"
   - Set:
     - **Framework**: "Other" (this is key!)
     - **Root Directory**: Leave empty
     - **Build Command**: `pnpm install && pnpm --filter api run build`
     - **Output Directory**: Leave empty
   - **Then** click "Deploy"

3. If it still auto-detects as Next.js, you can:
   - Use Vercel CLI to override:
     ```bash
     vercel --prod
     # When prompted, override the build command
     ```
   - Or create a `vercel.json` in the repo root specifically for the API project

## Alternative: Use vercel.json to Force Configuration

Create a `vercel-api.json` in root (we already have this), and when creating the project, Vercel should read it. But you might need to manually configure it in the dashboard anyway.

## My Recommendation

**Keep them as two separate projects**. It's:
- ✅ Easier to manage
- ✅ More flexible
- ✅ Industry standard for monorepos
- ✅ No build command conflicts
- ✅ Independent scaling

The "two projects" are just two entries in your Vercel dashboard - they're both connected to the same GitHub repo and deploy from the same codebase.

