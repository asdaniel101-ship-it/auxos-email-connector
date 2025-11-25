# Railway Deployment Setup

## Configuration

The project is configured for Railway deployment with:
- **Root Directory**: `apps/api` (set in Railway project settings)
- **Build Command**: `npm install && npx prisma generate && npm run build`
- **Start Command**: `npm run start:prod`
- **Port**: Automatically uses Railway's `PORT` environment variable

## Railway API Access

To deploy via Railway API, I'll need:

1. **Railway API Token**: 
   - Go to https://railway.app/account/tokens
   - Create a new token
   - Give it to me and I can deploy via API

2. **Project ID** (optional):
   - After creating the project on Railway, you can find the Project ID
   - Or I can create it via API if you give me the token

## Manual Setup Steps

1. **Create Railway Project**:
   - Go to https://railway.app
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository: `auxos-email-connector`

2. **Configure Project Settings**:
   - **Root Directory**: Set to `apps/api`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm run start:prod`

3. **Add Environment Variables**:
   - `DATABASE_URL` - Your Supabase PostgreSQL connection string
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `GMAIL_EMAIL` - auxoreachout@gmail.com
   - `GMAIL_APP_PASSWORD` - Your Gmail app password
   - `FRONTEND_URL` - https://auxos-email-connector2.vercel.app
   - `MINIO_ENDPOINT` - Your S3 endpoint
   - `MINIO_ACCESS_KEY` - Your S3 access key
   - `MINIO_SECRET_KEY` - Your S3 secret key
   - `MINIO_BUCKET_NAME` - auxodocuments
   - `MINIO_USE_SSL` - true
   - `MINIO_PORT` - 443
   - `PORT` - Railway will set this automatically

4. **Add PostgreSQL Database** (if not using Supabase):
   - Railway can provision a PostgreSQL database
   - Or use your existing Supabase database

5. **Deploy**:
   - Railway will automatically deploy on every push to main
   - Or trigger a manual deployment

## Prisma Migrations

Railway will run `prisma generate` during build. For migrations:
- Run migrations manually: `npx prisma migrate deploy`
- Or add a Railway service/script to run migrations on deploy

## Health Check

The API has a health endpoint at `/health` that Railway can use for health checks.

