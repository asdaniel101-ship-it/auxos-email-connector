# API Project Vercel Setup Instructions

## Critical Settings for API Project

1. **Go to Project Settings** for `auxos-email-connector2-api`
2. **General Tab**:
   - **Root Directory**: Leave EMPTY (repository root) - DO NOT set to `apps/api`
   - **Framework Preset**: `Other`
   - **Build Command**: `pnpm install && cd apps/api && pnpm prisma generate && pnpm build`
   - **Output Directory**: `apps/api/dist`
   - **Install Command**: `pnpm install`

3. **Environment Variables** (should already be added):
   - DATABASE_URL
   - OPENAI_API_KEY
   - EMAIL_USER
   - EMAIL_PASSWORD
   - MINIO_ENDPOINT
   - MINIO_USE_SSL
   - MINIO_PORT
   - MINIO_ACCESS_KEY
   - MINIO_SECRET_KEY
   - MINIO_BUCKET_NAME
   - FRONTEND_URL

4. **Functions Tab**:
   - The `apps/api/api/index.ts` function should be auto-detected
   - Max Duration: 60 seconds
   - Memory: 1024 MB

## After updating settings, trigger a new deployment

