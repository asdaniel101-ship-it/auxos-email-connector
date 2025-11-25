# Platform End-to-End Test Checklist

## Pre-Deployment Testing

### 1. Environment Variables
- [ ] Set `FRONTEND_URL` to production URL
- [ ] Set `API_KEY` for API authentication (optional, but recommended)
- [ ] Verify `DATABASE_URL` is correct
- [ ] Verify `OPENAI_API_KEY` has sufficient credits
- [ ] Verify `GMAIL_EMAIL` and `GMAIL_APP_PASSWORD` are set

### 2. Health Checks
```bash
# Test health endpoints
curl http://localhost:4000/health
curl http://localhost:4000/health/ready
curl http://localhost:4000/health/live
```

### 3. API Authentication (if API_KEY is set)
```bash
# Should fail without API key
curl http://localhost:4000/email-intake/poll

# Should work with API key
curl -H "X-API-Key: your-api-key" http://localhost:4000/email-intake/poll
```

### 4. Rate Limiting
```bash
# Make 101 requests quickly - should get rate limited
for i in {1..101}; do curl http://localhost:4000/health; done
```

### 5. Frontend Endpoints (Public)
- [ ] Create session: `POST /sessions`
- [ ] Get session: `GET /sessions/:id`
- [ ] Send chat message: `POST /chat/:sessionId`
- [ ] Get submissions: `GET /email-intake/submissions`
- [ ] Get submission: `GET /email-intake/submissions/:id`

### 6. Email Processing
- [ ] Upload .eml file: `POST /email-intake/test/upload-eml`
- [ ] Check email is processed
- [ ] Verify reply email is sent with hyperlinks
- [ ] Click hyperlink in email - should open submission page with field popup
- [ ] Verify navigation is restricted when `?fromEmail=true`

### 7. Email Hyperlinks
- [ ] Click extracted field in email
- [ ] Verify URL format: `/submission/[id]?field=[fieldPath]&fromEmail=true`
- [ ] Verify field popup opens automatically
- [ ] Verify "Back to full submission" button works
- [ ] Verify navigation is hidden when `fromEmail=true`

### 8. Database
- [ ] Verify all indexes exist (check Prisma schema)
- [ ] Test query performance on large datasets
- [ ] Verify connection pooling works

### 9. Error Handling
- [ ] Test with invalid API key
- [ ] Test with missing required fields
- [ ] Test with malformed .eml file
- [ ] Test with OpenAI quota exceeded (should use fallback)

### 10. CORS
- [ ] Test from production frontend domain
- [ ] Verify CORS headers are correct
- [ ] Test preflight OPTIONS requests

## Production Deployment Checklist

1. **Environment Variables**
   - Set all required env vars in production
   - Use secrets manager for sensitive values
   - Verify `FRONTEND_URL` matches production domain

2. **Database**
   - Run migrations: `pnpm prisma migrate deploy`
   - Verify connection string
   - Set up connection pooling limits

3. **Monitoring**
   - Set up health check monitoring
   - Configure alerts for errors
   - Monitor API rate limits
   - Monitor OpenAI API usage

4. **Security**
   - Set `API_KEY` in production
   - Review CORS origins
   - Enable HTTPS only
   - Review error messages (don't leak sensitive info)

5. **Scaling**
   - Set up horizontal scaling if needed
   - Configure database connection limits
   - Monitor memory/CPU usage
   - Set up auto-scaling based on load

