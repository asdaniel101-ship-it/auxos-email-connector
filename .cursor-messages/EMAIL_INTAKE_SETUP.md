# 📧 Email Intake Setup - Ready to Use!

## ✅ What's Working

1. **Email Processing**: The system can receive emails at `auxoreachout@gmail.com`
2. **Automatic Polling**: Enabled - checks for new emails every 60 seconds
3. **Reply Emails**: Automatically sends a reply with extracted data once processing completes
4. **Document Parsing**: PDFs, Excel, Word documents are parsed
5. **Field Extraction**: Uses OpenAI LLM for intelligent extraction
6. **Dashboard**: View all processed submissions at http://localhost:3000/dashboard

## 🚀 How to Use

### Option 1: Send Email (Automatic Processing)

1. **Send an email** to `auxoreachout@gmail.com` with:
   - Subject: Can be anything (e.g., "New Property Submission")
   - Body: Any text describing the submission
   - Attachments: ACORD forms, SOVs, loss runs, schedules, etc. (PDF, Excel, Word)

2. **Wait 1-2 minutes** - The system polls every 60 seconds

3. **You'll receive a reply email** with:
   - Summary of extracted data
   - Structured field table
   - JSON attachment with all extracted fields
   - PDF report (when PDF generation is fully implemented)

### Option 2: Manual Polling (For Testing)

If you want to manually trigger email checking:

```bash
curl -X POST http://localhost:4000/email-intake/poll
```

### Option 3: Upload .eml File (For Testing)

1. Go to: http://localhost:3000/upload-eml
2. Upload a `.eml` file
3. View results on the dashboard

## 📋 What Gets Extracted

The system extracts:
- **Submission Info**: Named insured, carrier, broker, dates
- **Locations & Buildings**: Addresses, square footage, construction type, year built
- **Coverage**: Policy types, limits, deductibles, coinsurance
- **Loss History**: Claims, losses, loss runs

## 🔧 Configuration

Make sure these environment variables are set in `apps/api/.env`:

```env
GMAIL_EMAIL=auxoreachout@gmail.com
GMAIL_APP_PASSWORD=xgpk xygb ctov epfx
OPENAI_API_KEY=your-openai-api-key
```

## 📊 View Results

- **Dashboard**: http://localhost:3000/dashboard
  - See all processed submissions
  - View extracted data
  - Download attachments

## ⚠️ Important Notes

1. **Email Reply**: The reply is sent to the original sender's email address (`from` field)
2. **Processing Time**: Usually takes 30-60 seconds depending on document size
3. **OpenAI Quota**: If quota is exceeded, the system uses fallback extraction
4. **Duplicate Detection**: Same email won't be processed twice

## 🐛 Troubleshooting

**No reply received?**
- Check API logs for errors
- Verify Gmail credentials are correct
- Check if email was classified as a submission
- View dashboard to see processing status

**Email not being picked up?**
- Make sure automatic polling is enabled (it is by default now)
- Check API server is running
- Verify IMAP connection in logs

**Processing errors?**
- Check OpenAI API key and quota
- Verify MinIO is running (for file storage)
- Check database connection

---

**Ready to test!** Send an email to `auxoreachout@gmail.com` and you'll get a reply! 🎉
