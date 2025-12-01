# Email Processing Flow - End-to-End Analysis

## Why We Check UIDs

**We need to check Gmail UIDs because:**
1. Gmail assigns unique UIDs to each email in a mailbox
2. We need to identify which emails we've already processed BEFORE fetching them from Gmail
3. The `gmailMessageId` format is `imap-{emailHash}-{uid}` which includes the UID
4. This prevents us from fetching and processing the same email multiple times

**However, once an email is in our database:**
- It gets an internal Prisma ID (`id` field)
- It gets a `gmailMessageId` (which includes the UID)
- We use `gmailMessageId` to look up emails in the database
- We use `processingStatus` to determine if it's been processed

## Complete Email Processing Flow

### 1. Email Polling (Every 30 seconds)
- `EmailIntakeSchedulerService.handleEmailPolling()` runs
- Calls `EmailListenerService.getNewMessages()`

### 2. Finding New Messages
- `getNewMessages()` searches Gmail for unread emails addressed to `submit@auxos.dev`
- For each UID found:
  - Generates `gmailMessageId = imap-{emailHash}-{uid}`
  - Checks database for existing email with that `gmailMessageId` and `processingStatus='done'`
  - Only returns UIDs that are NOT in database with status 'done'

### 3. Processing Each Email
- `pollForNewEmails()` calls `fetchAndStoreEmail(uid)` for each new UID
- `fetchAndStoreEmail()`:
  - Fetches email from Gmail
  - Parses it
  - Stores in database with `processingStatus='pending'`
  - Returns email data
- Then calls `processEmail(gmailMessageId, emailBody)`

### 4. Processing Email (Atomic Transaction)
- `processEmail()` uses a transaction to:
  - Check if email exists
  - If `processingStatus='done'` → skip (return null)
  - If `processingStatus='processing'` → skip (return null)
  - Otherwise, atomically set `processingStatus='processing'`
- This prevents duplicate processing

### 5. Email Classification
- Classifies if email is a submission
- If NOT a submission → mark as `done` and return
- If IS a submission → continue processing

### 6. Field Extraction
- Extracts fields using LLM
- Stores extraction results in database

### 7. Send Reply
- Sends reply email with proper threading headers
- `In-Reply-To` and `References` both point to original submission

### 8. Mark as Done
- Assigns sequential `submissionNumber`
- Sets `processingStatus='done'`
- This prevents reprocessing

## Issues Fixed

### Issue 1: Stuck Emails in Loop
**Problem:** Emails with `pending`, `error`, or `processing` status were being retried, causing loops.

**Fix:** Removed retry logic. Emails that are stuck should be manually marked as 'done' using the script.

### Issue 2: UID Matching Bug
**Problem:** Retry logic was using old UID format (`imap-{uid}`) instead of new format (`imap-{hash}-{uid}`).

**Fix:** Removed retry logic entirely. Only process emails that are truly new (not in database with status 'done').

### Issue 3: Emails Not Marked as Done
**Problem:** If processing fails, email might be stuck in 'processing' or 'error' status.

**Fix:** 
- Added error handling to mark as 'error' if processing fails
- Created script to mark all existing emails as 'done' to reset state

## Running the One-Time Script

To mark all existing emails as 'done':

```bash
cd apps/api
pnpm run mark-all-emails-done
```

This will:
1. Find all emails with `processingStatus != 'done'`
2. Mark them all as `processingStatus='done'`
3. Add error message explaining why

After running this, the system will only process truly new emails going forward.

