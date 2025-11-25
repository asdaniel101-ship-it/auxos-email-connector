# Testing File Upload (Phase 0 Step 6)

This guide walks you through testing the completed MinIO file upload functionality.

## ✅ What Was Added

1. **MinIO SDK** - Installed `minio` package
2. **MinioService** - Manages MinIO client and presigned URLs
3. **FilesController** - Exposes `/files/presign` and `/files/download` endpoints
4. **FilesModule** - Wraps everything together
5. **Auto-bucket creation** - Creates `documents` bucket on API startup

---

## 🧪 Testing Steps

### Prerequisites

Make sure Docker services are running:
```bash
pnpm run up
docker ps  # Verify postgres, minio, temporal, redis are running
```

---

### Test 1: Start the API and Verify Bucket Creation

1. Start the API:
   ```bash
   pnpm run api
   ```

2. Look for this log message:
   ```
   ✅ MinIO bucket 'documents' is ready
   ```
   or
   ```
   📦 Creating MinIO bucket: documents
   ```

3. Visit the Swagger docs to see the new endpoints:
   ```
   http://localhost:4000/docs
   ```
   
   You should see:
   - `GET /files/presign` - Get presigned upload URL
   - `GET /files/download` - Get presigned download URL

---

### Test 2: Get a Presigned Upload URL via cURL

```bash
curl "http://localhost:4000/files/presign?name=test-document.pdf"
```

**Expected response:**
```json
{
  "url": "http://localhost:9000/documents/uploads/1729123456789-test-document.pdf?X-Amz-Algorithm=...",
  "fileName": "test-document.pdf",
  "expiresIn": 3600
}
```

---

### Test 3: Upload a File Using the Presigned URL

1. Get the presigned URL (from Test 2)

2. Upload a file using the URL:
   ```bash
   # Create a test file
   echo "This is a test document" > test.txt
   
   # Get presigned URL
   PRESIGNED_URL=$(curl -s "http://localhost:4000/files/presign?name=test.txt" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
   
   # Upload the file
   curl -X PUT -T test.txt "$PRESIGNED_URL"
   ```

3. If successful, you'll see no output (or an empty response)

---

### Test 4: Verify File in MinIO Console

1. Open MinIO console:
   ```
   http://localhost:9001
   ```

2. Login with:
   - Username: `dev`
   - Password: `dev12345`

3. Navigate to **Buckets** → **documents** → **uploads/**

4. You should see your uploaded file with a timestamp prefix:
   ```
   1729123456789-test.txt
   ```

---

### Test 5: Test from the Web Frontend

1. Start the web app:
   ```bash
   pnpm run web
   ```

2. Visit:
   ```
   http://localhost:3000
   ```

3. Click the file upload button (already in the UI from Phase 0)

4. Select a PDF or image file

5. You should see an "Uploaded!" alert

6. Verify in MinIO console (http://localhost:9001) that the file appears

---

### Test 6: Test Invalid Requests

1. **Missing filename:**
   ```bash
   curl "http://localhost:4000/files/presign"
   ```
   **Expected:** `400 Bad Request` - "File name is required"

2. **Special characters in filename:**
   ```bash
   curl "http://localhost:4000/files/presign?name=my%20file%20(v2).pdf"
   ```
   **Expected:** Returns URL with sanitized filename: `my_file__v2_.pdf`

---

## 🎯 Success Criteria

✅ API starts without errors  
✅ `documents` bucket auto-created in MinIO  
✅ `/files/presign` returns valid presigned URL  
✅ File uploads work via presigned URL  
✅ Files appear in MinIO console  
✅ Frontend upload button works  
✅ Invalid requests return proper error messages

---

## 🐛 Troubleshooting

### "Error: connect ECONNREFUSED 127.0.0.1:9000"

**Problem:** MinIO is not running

**Solution:**
```bash
docker ps  # Check if minio container is running
pnpm run up  # Start Docker services if not running
```

---

### "Bucket 'documents' not found"

**Problem:** Bucket wasn't created automatically

**Solution:**
```bash
# Manually create the bucket
docker exec -it minio mc alias set local http://localhost:9000 dev dev12345
docker exec -it minio mc mb local/documents
```

---

### Frontend upload shows "Failed to fetch"

**Problem:** API is not running or CORS issue

**Solution:**
1. Verify API is running: `curl http://localhost:4000/health`
2. Check API logs for CORS errors
3. Verify `main.ts` has `http://localhost:3000` in CORS origins

---

## 📝 Next Steps

Now that file uploads work, you can:

1. Store file metadata in the database:
   ```prisma
   model UploadedFile {
     id           String   @id @default(cuid())
     submissionId String
     fileKey      String   // e.g., "uploads/123-doc.pdf"
     fileName     String   // Original name
     fileSize     Int      // Bytes
     mimeType     String   // e.g., "application/pdf"
     uploadedAt   DateTime @default(now())
   }
   ```

2. Add file listing to submission detail page

3. Implement the document extraction workflow (Phase 1)

---

**Phase 0 Step 6 is now complete! ✅**

