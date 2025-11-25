# Quick Railway Setup

## Option 1: Via Railway Web Dashboard (Easiest)

1. Go to https://railway.app/project/7a7d2d21-e857-4011-9c85-ce5d3057c614
2. If no service exists, click **"New"** → **"GitHub Repo"** → Select your repo
3. In the service settings:
   - **Root Directory**: `apps/api`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm run start:prod`
4. Go to **Variables** tab and add all environment variables (see below)
5. Click **Deploy**

## Option 2: Via CLI (Run from apps/api directory)

```bash
cd apps/api
export RAILWAY_TOKEN=a5f910f4-634c-49b9-94e4-75d41b8fa0ad

# Link to project
railway link --project 7a7d2d21-e857-4011-9c85-ce5d3057c614

# If you need to create a service first, do it via web dashboard
# Then link to it:
railway service <service-name-or-id>

# Set variables
railway variables --set "DATABASE_URL=your-database-url"
railway variables --set "OPENAI_API_KEY=your-openai-key"
railway variables --set "GMAIL_EMAIL=auxoreachout@gmail.com"
railway variables --set "GMAIL_APP_PASSWORD=your-gmail-app-password"
railway variables --set "FRONTEND_URL=https://auxos-email-connector2.vercel.app"
railway variables --set "MINIO_ENDPOINT=s3.amazonaws.com"
railway variables --set "MINIO_ACCESS_KEY=your-aws-access-key"
railway variables --set "MINIO_SECRET_KEY=your-aws-secret-key"
railway variables --set "MINIO_BUCKET_NAME=auxodocuments"
railway variables --set "MINIO_USE_SSL=true"
railway variables --set "MINIO_PORT=443"

# Deploy
railway up
```

## Environment Variables Needed

```
DATABASE_URL=your-database-url
OPENAI_API_KEY=your-openai-key
GMAIL_EMAIL=auxoreachout@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password
FRONTEND_URL=https://auxos-email-connector2.vercel.app
MINIO_ENDPOINT=s3.amazonaws.com
MINIO_ACCESS_KEY=your-aws-access-key
MINIO_SECRET_KEY=your-aws-secret-key
MINIO_BUCKET_NAME=auxodocuments
MINIO_USE_SSL=true
MINIO_PORT=443
```

**Note**: Railway automatically sets `PORT` - your app already uses it!

## After Deployment

1. Get your Railway URL from the dashboard
2. Test: `curl https://your-app.up.railway.app/health`
3. Update frontend `apps/web/src/lib/api-url.ts` to use Railway URL

