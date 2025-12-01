# Testing Dashboard Connection

## Step 1: Verify Environment Variable is Set

### In Vercel:
1. Go to your project → Settings → Environment Variables
2. Confirm `NEXT_PUBLIC_API_URL` is set to your Railway API URL
3. **Important**: After adding/updating env vars, you need to **redeploy** for changes to take effect
4. Go to Deployments → Click "Redeploy" on the latest deployment

## Step 2: Test API Directly

Open your Railway API URL in a browser:
```
https://your-railway-api-url.railway.app/email-intake/submissions?limit=100
```

**Expected Result:**
- If working: You should see JSON data (either an empty array `[]` or an array of submissions)
- If not working: You'll see an error page or timeout

## Step 3: Check Browser Console

1. Open your Vercel frontend URL
2. Open Developer Tools (F12 or Right-click → Inspect)
3. Go to **Console** tab
4. Look for:
   - ✅ No errors = Good
   - ❌ CORS errors = CORS configuration issue
   - ❌ Network errors = API URL might be wrong
   - ❌ 404 errors = API endpoint doesn't exist

## Step 4: Check Network Tab

1. Open Developer Tools (F12)
2. Go to **Network** tab
3. Refresh the dashboard page
4. Look for a request to `/email-intake/submissions`
5. Click on it to see:
   - **Status**: Should be `200 OK` (green)
   - **Request URL**: Should be your Railway API URL
   - **Response**: Should show JSON data

## Step 5: Test Dashboard Functionality

1. Go to your dashboard: `https://your-vercel-app.vercel.app/dashboard`
2. You should see:
   - ✅ Either a list of submissions (if any exist)
   - ✅ Or "No submissions found" message (if database is empty but working)
   - ❌ "Failed to load submissions" = Connection issue

## Step 6: Check Railway Logs

1. Go to Railway → API service → **Logs** tab
2. Look for:
   - ✅ "CORS: Allowing origin: https://your-vercel-app.vercel.app" = CORS working
   - ✅ "GET /email-intake/submissions" = Requests coming through
   - ❌ "CORS: Blocked origin" = CORS issue
   - ❌ Database connection errors = Database issue

## Step 7: Quick Test Script

You can also test from the command line:

```bash
# Replace with your actual URLs
RAILWAY_API_URL="https://your-railway-api-url.railway.app"
VERCEL_FRONTEND_URL="https://your-vercel-app.vercel.app"

# Test API health
curl "$RAILWAY_API_URL/health/live"

# Test submissions endpoint
curl "$RAILWAY_API_URL/email-intake/submissions?limit=100"

# Test CORS (should see CORS headers)
curl -H "Origin: $VERCEL_FRONTEND_URL" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     "$RAILWAY_API_URL/email-intake/submissions" \
     -v
```

## Common Issues & Solutions

### Issue: "Failed to load submissions" in dashboard
**Check:**
1. Browser console for errors
2. Network tab for failed requests
3. Railway logs for API errors

### Issue: CORS errors in browser console
**Solution:**
- Verify `FRONTEND_URL` in Railway is set to your Vercel URL
- Check Railway logs for "CORS: Blocked origin" messages

### Issue: API returns 404
**Solution:**
- Verify the API URL is correct
- Check Railway logs to see if API started successfully

### Issue: API returns 500/502/503
**Solution:**
- Check Railway logs for detailed error messages
- Verify `DATABASE_URL` is set correctly
- Check if database is accessible

## Success Indicators

✅ Dashboard loads without errors
✅ Browser console shows no errors
✅ Network tab shows successful API calls (200 status)
✅ Railway logs show CORS allowing your Vercel origin
✅ Railway logs show successful database queries

