# 🧪 How to Test with Your .eml File

## Quick Test - Upload .eml File

### Step 1: Make sure API is running
```bash
pnpm api
```
Wait for: `🚀 API running at http://localhost:4000`

### Step 2: Upload your .eml file

**Using cURL (Terminal):**
```bash
curl -X POST http://localhost:4000/email-intake/test/upload-eml \
  -F "file=@/path/to/your/submission.eml"
```

**Example:**
```bash
curl -X POST http://localhost:4000/email-intake/test/upload-eml \
  -F "file=@/Users/ashtondaniel/Downloads/submission.eml"
```

**Using Postman/Insomnia:**
1. Create a new POST request
2. URL: `http://localhost:4000/email-intake/test/upload-eml`
3. Body type: `form-data`
4. Add a field:
   - Key: `file` (make sure it's type "File", not "Text")
   - Value: Select your `.eml` file
5. Click Send

**Using a simple HTML form (for quick testing):**
Create a file `test-upload.html`:
```html
<!DOCTYPE html>
<html>
<body>
  <h2>Upload .eml File</h2>
  <form action="http://localhost:4000/email-intake/test/upload-eml" method="post" enctype="multipart/form-data">
    <input type="file" name="file" accept=".eml" required>
    <button type="submit">Upload</button>
  </form>
</body>
</html>
```
Open it in a browser and upload your file.

### Step 3: Check the Dashboard

Open: **http://localhost:3000/dashboard**

You should see your submission appear in the table!

### Step 4: View Details

Click on any submission row to see:
- Email details (from, subject, date)
- Attachments list
- Extracted fields (once processing completes)
- Processing status

## Option 2: Send to Email (Currently Disabled)

**Note:** Automatic email polling is currently **disabled** because IMAP fetching needs more testing.

To enable it:
1. Uncomment the `@Cron` decorator in `apps/api/src/email-intake/email-intake-scheduler.service.ts`
2. Fix any remaining IMAP issues
3. Forward your test email to `auxoreachout@gmail.com`

For now, **use Option 1 (upload .eml file)** - it's the most reliable way to test!

## What Happens When You Upload

1. ✅ File is parsed using `mailparser`
2. ✅ Email metadata stored in database
3. ✅ Attachments stored in MinIO
4. ✅ Submission classification runs
5. ✅ Document classification runs
6. ⚠️ Field extraction (needs document parsing to be fully implemented)
7. ⚠️ QA checks run
8. ⚠️ Response packaging (summary generation works, PDF needs implementation)

## Troubleshooting

**"No file uploaded" error:**
- Make sure the form field is named exactly `file`
- Check the file is actually a `.eml` file

**"Failed to process" error:**
- Check API logs for details
- Verify database is running
- Verify MinIO is running

**Dashboard shows nothing:**
- Make sure API processed the file (check API logs)
- Try refreshing the dashboard
- Check browser console (F12) for errors

---

**Ready to test!** Upload your `.eml` file and watch it process! 🚀

