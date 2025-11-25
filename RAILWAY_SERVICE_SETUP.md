# Railway Service Setup

The CLI needs a service to be created first. Here's what to do:

## Step 1: Create Service via Web Dashboard

1. Go to: https://railway.app/project/7a7d2d21-e857-4011-9c85-ce5d3057c614
2. Click **"New"** → **"GitHub Repo"**
3. Select repository: `asdaniel101-ship-it/auxos-email-connector`
4. In the service settings that appear:
   - **Root Directory**: `apps/api`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm run start:prod`
5. Note the service name (it will be something like "auxos-email-connector" or "api")

## Step 2: Link Service via CLI

Once the service is created, run:

```bash
cd apps/api
export RAILWAY_TOKEN=a5f910f4-634c-49b9-94e4-75d41b8fa0ad
railway service <service-name>
```

## Step 3: Set Environment Variables

After linking, I can set all the variables. Or you can run:

```bash
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
```

## Step 4: Deploy

```bash
railway up
```

## Alternative: Do Everything via Web Dashboard

If CLI is too complicated, you can:
1. Create service via web (Step 1 above)
2. Add all environment variables in the **Variables** tab
3. Click **Deploy** button

The service will auto-deploy on every push to `main` branch.

