# Production Deployment Checklist

## ✅ Completed Improvements

### 1. Environment Variable Validation
- ✅ Added validation on startup
- ✅ Validates required variables (DATABASE_URL, etc.)
- ✅ Warns about missing optional variables

### 2. Health Check Endpoints
- ✅ `/health` - Full health check with DB status
- ✅ `/health/ready` - Readiness probe
- ✅ `/health/live` - Liveness probe
- ✅ All marked as public and skip throttling

### 3. API Authentication
- ✅ API key guard implemented
- ✅ Optional (works without API_KEY in dev)
- ✅ Public endpoints marked with `@Public()` decorator
- ✅ Frontend endpoints (sessions, chat, leads, submissions) are public
- ✅ Admin endpoints (poll, reprocess) require API key if set

### 4. CORS Configuration
- ✅ Configurable via `FRONTEND_URL` environment variable
- ✅ Supports multiple origins
- ✅ Includes `X-API-Key` in allowed headers

### 5. Rate Limiting
- ✅ 100 requests per minute per IP
- ✅ Health endpoints skip throttling
- ✅ Uses `@nestjs/throttler`

### 6. Request Logging
- ✅ Global logging interceptor
- ✅ Logs method, URL, status, duration, IP, user agent
- ✅ Logs errors with status codes

### 7. Retry Logic
- ✅ Email processing retries up to 3 times
- ✅ Exponential backoff (1s, 2s, 4s, max 10s)
- ✅ Logs retry attempts

### 8. Database Indexes
- ✅ Already present in schema (verified)
- ✅ Indexes on: gmailMessageId, threadId, processingStatus, isSubmission, receivedAt
- ✅ Indexes on field extractions: fieldPath, fieldName, source

### 9. Error Handling
- ✅ Improved error messages
- ✅ Proper HTTP status codes
- ✅ Error logging
- ✅ Fallback mechanisms for OpenAI

### 10. Frontend Endpoints Marked Public
- ✅ Sessions endpoints
- ✅ Chat endpoints
- ✅ Leads endpoints
- ✅ Submission endpoints (GET only)

## 🔧 Required Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string

### Optional (but recommended)
- `API_KEY` - API authentication key
- `FRONTEND_URL` - Production frontend URL (for CORS)
- `OPENAI_API_KEY` - For LLM features
- `GMAIL_EMAIL` - Gmail account for email intake
- `GMAIL_APP_PASSWORD` - Gmail app password
- `MINIO_ENDPOINT` - MinIO/S3 endpoint
- `MINIO_ACCESS_KEY` - MinIO access key
- `MINIO_SECRET_KEY` - MinIO secret key
- `PORT` - API port (default: 4000)

## 🚀 Deployment Steps

1. **Set Environment Variables**
   ```bash
   export DATABASE_URL="postgresql://..."
   export FRONTEND_URL="https://your-domain.com"
   export API_KEY="your-secure-api-key"
   # ... other vars
   ```

2. **Run Database Migrations**
   ```bash
   cd apps/api
   pnpm prisma migrate deploy
   ```

3. **Build Application**
   ```bash
   cd apps/api
   pnpm run build
   ```

4. **Start Application**
   ```bash
   pnpm run start:prod
   ```

5. **Verify Health**
   ```bash
   curl http://your-api-url/health
   ```

## 🧪 Testing

Run the test script:
```bash
cd apps/api
API_URL=http://localhost:4000 API_KEY=your-key ./test-platform.sh
```

Or test manually:
```bash
# Health check
curl http://localhost:4000/health

# With API key (if set)
curl -H "X-API-Key: your-key" http://localhost:4000/email-intake/poll
```

## 📊 Monitoring

- Monitor `/health` endpoint
- Check logs for errors
- Monitor OpenAI API usage
- Monitor database connections
- Monitor email processing queue

## 🔒 Security Notes

- API key is optional but recommended for production
- If `API_KEY` is not set, all endpoints are accessible (dev mode)
- Set `API_KEY` in production to protect admin endpoints
- Frontend endpoints are public by design
- CORS is configured to only allow your frontend domain

## ⚠️ Known Limitations

1. **Storage Cleanup**: Not yet implemented - old emails/attachments will accumulate
2. **Email Queue**: No queue system - emails processed synchronously
3. **Connection Pooling**: No explicit limits set (uses Prisma defaults)
4. **Error Tracking**: No Sentry/error tracking service integrated yet

## 🎯 Next Steps (Post-Deployment)

1. Set up error tracking (Sentry)
2. Implement storage cleanup job
3. Add email processing queue (Bull/BullMQ)
4. Set up database connection pooling limits
5. Add monitoring/alerting
6. Implement request size limits
7. Add request validation middleware

