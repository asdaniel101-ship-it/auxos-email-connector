# Dashboard Debugging Guide

## Issue: "Failed to load submissions"

The dashboard calls: `${API_URL}/email-intake/submissions?limit=100`

## Where to Check Logs

### Vercel (Frontend - Web App)
1. Go to https://vercel.com/dashboard
2. Select your project
3. Click on the **"Deployments"** tab
4. Click on the latest deployment
5. Click **"Functions"** tab to see server-side logs
6. Or check **"Runtime Logs"** for client-side errors

**To check environment variables:**
- Go to Project Settings → Environment Variables
- Verify `NEXT_PUBLIC_API_URL` is set to your Railway API URL

### Railway (Backend - API)
1. Go to https://railway.app/dashboard
2. Select your API service
3. Click on the **"Deployments"** tab
4. Click on the latest deployment
5. Click **"View Logs"** to see real-time logs
6. Or use the **"Logs"** tab in the service view

**To check environment variables:**
- Go to the service → Variables tab
- Verify all required env vars are set (DATABASE_URL, GMAIL_EMAIL, etc.)

## Common Issues

### 1. API URL Not Configured
**Symptom:** Dashboard can't reach API
**Fix:** Set `NEXT_PUBLIC_API_URL` in Vercel to your Railway API URL (e.g., `https://your-api.railway.app`)

### 2. CORS Issues
**Symptom:** Browser console shows CORS errors
**Fix:** Check Railway API CORS settings in `apps/api/src/main.ts`

### 3. API Not Running
**Symptom:** API endpoint returns 502/503
**Fix:** Check Railway logs to see if API crashed or failed to start

### 4. Database Connection Issues
**Symptom:** API logs show database connection errors
**Fix:** Verify `DATABASE_URL` is set correctly in Railway

## Quick Debug Steps

1. **Check browser console** (F12 → Console tab) for errors
2. **Check Network tab** (F12 → Network tab) to see the actual API request/response
3. **Verify API URL** - The dashboard should be calling your Railway API URL
4. **Test API directly** - Try accessing `https://your-api.railway.app/health/live` in browser
5. **Check Railway logs** - Look for errors when the API starts or when requests come in

## Testing the API Endpoint Directly

You can test the endpoint directly:
```bash
curl https://your-api.railway.app/email-intake/submissions?limit=100
```

Or in browser:
```
https://your-api.railway.app/email-intake/submissions?limit=100
```

If this works but the dashboard doesn't, it's likely a CORS or API URL configuration issue.

