# Railway Deployment Guide for API

## Quick Setup Steps

### 1. Create Railway Project

1. Go to https://railway.app
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose repository: `asdaniel101-ship-it/auxos-email-connector`
5. Name the project: `auxos-email-connector-api`

### 2. Configure Project Settings

Once the project is created:

1. Go to **Settings** → **Service**
2. Set **Root Directory** to: `apps/api`
3. Set **Build Command** to: `npm install && npx prisma generate && npm run build`
4. Set **Start Command** to: `npm run start:prod`

### 3. Add Environment Variables

Go to **Variables** tab and add:

```
DATABASE_URL=your-supabase-postgresql-connection-string
OPENAI_API_KEY=your-openai-api-key
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

### 4. Deploy

1. Railway will automatically deploy when you push to `main`
2. Or click **"Deploy"** button to trigger manually
3. Watch the build logs to ensure it completes successfully

### 5. Get Your API URL

After deployment:
1. Go to **Settings** → **Networking**
2. Generate a **Public Domain** (or use the default Railway domain)
3. Your API will be available at: `https://your-project.up.railway.app`

### 6. Test the Deployment

```bash
# Health check
curl https://your-project.up.railway.app/health

# Test API
curl https://your-project.up.railway.app/
```

## Troubleshooting

### Build Fails
- Check build logs in Railway dashboard
- Ensure `apps/api` has `package.json` and `package-lock.json`
- Verify Prisma schema is in `apps/api/prisma/schema.prisma`

### App Won't Start
- Check logs: `railway logs` (if using CLI) or view in dashboard
- Verify all environment variables are set
- Ensure `PORT` is being used (Railway sets this automatically)

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check if Supabase allows connections from Railway IPs
- Run migrations: `npx prisma migrate deploy` (in Railway shell or locally)

## Using Railway CLI (Alternative)

If you prefer CLI:

```bash
# Install CLI
npm install -g @railway/cli

# Login (opens browser)
railway login

# Link to project
cd apps/api
railway link

# Set environment variables
railway variables set DATABASE_URL="your-url"
railway variables set OPENAI_API_KEY="your-key"
# ... etc

# Deploy
railway up
```

## Next Steps After Deployment

1. **Update Frontend API URL**: Update `apps/web/src/lib/api-url.ts` to point to Railway URL
2. **Test Email Processing**: Send a test email to `auxoreachout@gmail.com`
3. **Monitor Logs**: Watch Railway logs for email processing
4. **Set up Cron Jobs**: Configure email polling (Railway supports cron)

## Railway vs Vercel

Railway advantages for this API:
- ✅ Better monorepo support
- ✅ Native pnpm/npm support
- ✅ Persistent processes (good for email polling)
- ✅ Built-in cron job support
- ✅ Better for long-running services

