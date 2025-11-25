# Testing Email Intake MVP

## 🧪 Testing with .eml Files

### Where to Upload Your .eml File

You can test the email intake system by uploading a `.eml` file directly via the API:

**Endpoint:** `POST http://localhost:3001/email-intake/test/upload-eml`

### Using cURL

```bash
curl -X POST http://localhost:3001/email-intake/test/upload-eml \
  -F "file=@/path/to/your/submission.eml"
```

### Using Postman/Insomnia

1. Create a POST request to `http://localhost:3001/email-intake/test/upload-eml`
2. Set body type to `form-data`
3. Add a field named `file` (type: File)
4. Select your `.eml` file
5. Send the request

### What Happens

1. The `.eml` file is parsed using `mailparser`
2. Email metadata and attachments are stored in the database
3. Raw email and attachments are stored in MinIO
4. The email is classified as a submission (or not)
5. If it's a submission:
   - Documents are classified (ACORD, SOV, loss runs, etc.)
   - Fields are extracted using LLM
   - QA checks are run
   - A response is packaged (summary, table, PDF, JSON)
   - A reply email is sent (if configured)

### Viewing Results

After processing, view the submission in the admin dashboard:
- **Dashboard:** http://localhost:3000/dashboard
- **API:** `GET http://localhost:3001/email-intake/submissions`

## 📧 Automatic Email Polling

The system automatically polls Gmail every 60 seconds for new emails.

### Manual Polling

You can also manually trigger polling:

```bash
curl -X POST http://localhost:3001/email-intake/poll
```

## 🔧 Configuration

Add these to `apps/api/.env`:

```bash
# Gmail credentials
GMAIL_EMAIL=auxoreachout@gmail.com
GMAIL_APP_PASSWORD=xgpkxygbctovepfx

# OpenAI (already configured)
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o

# MinIO (already configured)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=dev
MINIO_SECRET_KEY=dev12345
```

## 📝 Sample .eml File Structure

Your `.eml` file should contain:
- Email headers (From, To, Subject, Date)
- Email body (text or HTML)
- Attachments (PDFs, Excel files, etc.)

The system will:
- Extract all metadata
- Parse attachments
- Classify document types
- Extract structured fields

## 🐛 Troubleshooting

### "No file uploaded" error
- Make sure the form field is named `file`
- Check that the file is actually a `.eml` file

### IMAP connection errors
- Verify Gmail App Password is correct (no spaces)
- Check that IMAP is enabled in Gmail settings
- Ensure firewall allows connections to `imap.gmail.com:993`

### Processing errors
- Check API logs for detailed error messages
- Verify OpenAI API key is set
- Ensure MinIO is running (`docker compose up minio`)

## 📊 Monitoring

- Check the dashboard at `/dashboard` for all processed submissions
- View API logs for processing details
- Check MinIO console at http://localhost:9001 (dev/dev12345) for stored files

