# Test Submissions Folder

Drop your test submission files here:

1. **Email file**: `.eml` file containing the email
2. **Documents**: Any supporting documents (PDF, Excel, Word, CSV, TXT, etc.)

## Usage

After dropping files here, you can test the extraction by running:

```bash
cd apps/api
npx ts-node scripts/test-submission-extraction.ts
```

This will:
- Parse the .eml file
- Process all attachments
- Run per-field extraction on all 64 fields
- Show detailed results and any missing fields

