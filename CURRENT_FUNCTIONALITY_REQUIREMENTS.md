# Current Functionality Requirements

This document captures the current functionality across all pages and systems. **DO NOT BREAK THESE REQUIREMENTS** when making updates.

## Table of Contents
1. [Navigation & UI](#navigation--ui)
2. [Home Page](#home-page)
3. [Dashboard](#dashboard)
4. [Field Schema Page](#field-schema-page)
5. [Email Processing & Replies](#email-processing--replies)

---

## Navigation & UI

### Always Only One Navbar
- **Requirement**: Only ONE navbar should ever be shown on any page
- **Implementation**: 
  - `ConditionalHeader` component is rendered once in `apps/web/src/app/layout.tsx`
  - No other pages should render their own navbar/header
  - **File**: `apps/web/src/components/ConditionalHeader.tsx`

### Fields Must Load
- **Requirement**: All fields must load correctly on all pages
- **Implementation**: 
  - Field definitions are loaded from `/field-definitions` API endpoint
  - Field schema is loaded from `/field-schema` API endpoint
  - Both are merged to show complete field information

---

## Home Page

### Navbar Content
- **Requirement**: Home page navbar should only show:
  - Home page logo (AuxosLogo component)
  - Slogan: "Process insurance submissions faster."
  - Admin Login link/button
- **Implementation**: 
  - `ConditionalHeader` shows restricted navigation when user is not authenticated
  - Admin navigation links (Dashboard, Debug Emails, etc.) are only shown when `isAuthenticated === true`
  - **File**: `apps/web/src/components/ConditionalHeader.tsx` (lines 84-146)
  - **File**: `apps/web/src/app/page.tsx` (no navbar rendered here, uses layout)

### Admin Login Access
- **Requirement**: Other navigation fields (Dashboard, Debug Emails, etc.) should only be visible after user logs in
- **Implementation**: 
  - Uses `useAdminAuth` hook to check authentication state
  - Password: "Insurance123"
  - Admin links are conditionally rendered based on `isAuthenticated`
  - **File**: `apps/web/src/components/ConditionalHeader.tsx` (lines 98-116)

---

## Dashboard

### Show All Submissions
- **Requirement**: Dashboard must show ALL submissions
- **Implementation**: 
  - Fetches from `/email-intake/submissions?limit=100` endpoint
  - Displays all submissions with their details
  - Shows submission number, subject, from, received date, processing status
  - **File**: `apps/web/src/app/dashboard/page.tsx` (lines 65-79)
  - **API Endpoint**: `GET /email-intake/submissions`

### Submission Details
- **Requirement**: Each submission should show:
  - Submission number
  - Subject
  - From address
  - Received date
  - Processing status
  - Attachments
  - Extraction results (if available)

---

## Field Schema Page

### Required Field Information
- **Requirement**: For each field, the following must be displayed:
  1. **Business Description** - Should never be empty
  2. **Extraction Logic** - Should never be empty
  3. **Where to Look** - Should never be empty
  4. **Field Type** - e.g., "string", "number", "boolean", "array"
  5. **Internal Field Name** - e.g., "submission.carrierName", "locations[0].buildings[0].riskAddress"

### Implementation Details
- **File**: `apps/web/src/app/admin/field-schema/page.tsx`
- **Data Sources**:
  - Schema structure from `/field-schema` API
  - Field definitions from `/field-definitions` API (database)
- **Merging Logic**: 
  - Database definitions are merged into schema structure
  - Shows field path (e.g., `locations[0].buildings[0].fireAlarmType`)
  - Displays `fieldType` from database
  - Shows `businessDescription`, `extractorLogic`, `whereToLook` from database
- **Visual Indicators**:
  - Green "✓ Has Definition" badge for fields with database definitions
  - Yellow "⚠ No Definition" badge for fields without definitions
- **Editing**: 
  - All three fields (businessDescription, extractorLogic, whereToLook) are editable
  - Changes are saved immediately to database via `/field-definitions` endpoint

---

## Email Processing & Replies

### Email Scanning Frequency
- **Requirement**: Scan for new emails every 30 seconds
- **Implementation**: 
  - Uses NestJS `@Cron` decorator with expression `'*/30 * * * * *'`
  - **File**: `apps/api/src/email-intake/email-intake-scheduler.service.ts` (line 15)
  - **Method**: `handleEmailPolling()` calls `emailIntakeService.pollForNewEmails()`

### Processing Status Checks
- **Requirement**: Gmail's unread status is the source of truth
  - If an email is **UNREAD in Gmail**, it will be processed regardless of database status
  - This handles cases where:
    - Email was processed but Gmail wasn't marked as read
    - UID collisions (same UID = different email after mailbox reset)
    - Emails that need reprocessing
- **Requirement**: DO NOT process emails with status:
  - `processing` - Currently being processed by another instance (prevents duplicates)
- **Requirement**: Process emails with ANY status if they're unread in Gmail:
  - `pending` - New emails that haven't been processed
  - `error` - Emails that failed processing (retry)
  - `done` - Successfully processed but unread in Gmail (reprocess)
- **Implementation**: 
  - `getNewMessages()` returns ALL unread emails from Gmail (no database filtering)
  - **File**: `apps/api/src/email-intake/email-listener.service.ts` (lines 850-860)
  - **Logic**: 
    ```typescript
    // CRITICAL: If an email is UNREAD in Gmail, we ALWAYS process it
    // Don't check the database - Gmail's unread status is the source of truth
    // The database might be out of sync, or there might be a UID collision
    // If it's unread, it needs to be processed (or reprocessed)
    return filteredUids; // Return all unread emails
    ```
  - Atomic transaction in `processEmail()` prevents duplicate processing:
    - **File**: `apps/api/src/email-intake/email-intake.service.ts` (lines 51-84)
    - **Logic**: 
      ```typescript
      // Only skip if currently being processed (prevents race conditions)
      if (existing.processingStatus === 'processing') {
        return null; // Skip - already being processed
      }
      // Use conditional update: only update if status != 'processing'
      const updateResult = await tx.emailMessage.updateMany({
        where: {
          gmailMessageId,
          processingStatus: { not: 'processing' },
        },
        data: { processingStatus: 'processing' },
      });
      // If updateResult.count === 0, another process already claimed it
      if (updateResult.count === 0) {
        return null; // Skip - claimed by another process
      }
      ```

### Always Reply to Original Email
- **Requirement**: ALWAYS reply to the original submission email, never send a new email
- **Implementation**: 
  - Uses `originalMessageId` stored in database (from `parsed.messageId`)
  - Sets `In-Reply-To` header to original Message-ID
  - Sets `References` header to ONLY the original Message-ID (not a chain)
  - **File**: `apps/api/src/email-intake/email-listener.service.ts` (lines 1027-1212)
  - **Key Logic**:
    - Stores `originalMessageId` when email is first received (line 261, 335, 344, 382)
    - Uses stored `originalMessageId` for `In-Reply-To` header (line 1208)
    - `References` header contains ONLY the original Message-ID (line 1096-1098)
    - Ensures all replies thread directly to the original submission

### Do Not Reply to Own Emails
- **Requirement**: Do not process or reply to emails FROM `submit@auxos.dev`
- **Implementation**: 
  - Checks `from` field in `processEmail()` method
  - If email is from system address, marks as `done` and skips processing
  - Also filters in `getNewMessages()` to skip emails FROM our own address
  - **File**: `apps/api/src/email-intake/email-intake.service.ts` (lines 93-111)
  - **File**: `apps/api/src/email-intake/email-listener.service.ts` (lines 823-829)
  - **System Email**: `submit@auxos.dev` (configurable via `GMAIL_EMAIL` env var)

### Email Identification
- **Requirement**: Use Message-ID header (unique per email) instead of Gmail UID
- **Implementation**: 
  - `gmailMessageId` is generated from `parsed.messageId` (Message-ID header)
  - Falls back to content hash + timestamp if no Message-ID exists
  - **File**: `apps/api/src/email-intake/email-listener.service.ts` (lines 120-141)
  - **Logic**:
    ```typescript
    if (parsed.messageId) {
      gmailMessageId = parsed.messageId.replace(/^<|>$/g, '');
    } else if (rawBuffer) {
      // Use content hash + timestamp
    }
    ```

### Atomic Processing Prevention
- **Requirement**: Prevent duplicate processing of the same email
- **Implementation**: 
  - Uses Prisma transaction with conditional `updateMany`
  - Only one process can successfully update status to 'processing'
  - If `updateResult.count === 0`, another process already claimed it
  - **File**: `apps/api/src/email-intake/email-intake.service.ts` (lines 65-84)

---

## API Endpoints

### Field Definitions
- **GET** `/field-definitions` - Returns all field definitions from database
- **PUT** `/field-definitions` - Updates field definitions in database
- **File**: `apps/api/src/field-definitions/field-definitions.controller.ts`

### Field Schema
- **GET** `/field-schema` - Returns field schema structure (JSON)
- **File**: `apps/api/src/field-definitions/field-definitions.controller.ts`

### Email Intake
- **GET** `/email-intake/submissions?limit=100` - Returns all submissions
- **POST** `/email-intake/poll` - Manually trigger email polling
- **File**: `apps/api/src/email-intake/email-intake.controller.ts`

---

## Database Schema

### EmailMessage Model
- `gmailMessageId` - Unique identifier (uses Message-ID header)
- `originalMessageId` - Original Message-ID header for reply threading
- `processingStatus` - 'pending' | 'processing' | 'done' | 'error'
- `submissionNumber` - Sequential submission number (1, 2, 3, ...)
- `isSubmission` - Boolean indicating if email is a submission
- **File**: `apps/api/prisma/schema.prisma`

### FieldDefinition Model
- `fieldName` - Internal field name (e.g., "carrierName")
- `businessDescription` - Business context for the field
- `extractorLogic` - Detailed extraction instructions for LLM
- `whereToLook` - Document sources to prioritize
- `fieldType` - Type of field (string, number, boolean, etc.)
- **File**: `apps/api/prisma/schema.prisma`

---

## Environment Variables

### Email Configuration
- `GMAIL_EMAIL` - Email address for receiving submissions (default: `submit@auxos.dev`)
- `GMAIL_APP_PASSWORD` - App password for Gmail (default: `xtvc icag ozew onoe`)
- **Files**: 
  - `apps/api/src/email-intake/email-listener.service.ts` (lines 25-33)
  - `apps/api/src/email-intake/email-intake.service.ts` (lines 93-95)

---

## Critical Notes

1. **Never break the single navbar requirement** - Always use `ConditionalHeader` from layout
2. **Always check processing status** - Only process `pending` or `error` emails, never `done` or `processing`
3. **Always use originalMessageId for replies** - Never send new emails, always reply to original
4. **Never process emails from submit@auxos.dev** - Prevents infinite loops
5. **Always use Message-ID for identification** - Not Gmail UID (can be reused)
6. **Field definitions must never be empty** - All three fields (businessDescription, extractorLogic, whereToLook) must have values

---

## Testing Checklist

When making updates, verify:
- [ ] Only one navbar appears on all pages
- [ ] Home page shows only logo, slogan, and admin login
- [ ] Admin links only appear after login
- [ ] Dashboard shows all submissions
- [ ] Field Schema page shows all fields with complete information
- [ ] Emails are scanned every 30 seconds
- [ ] All unread emails in Gmail are processed (regardless of database status)
- [ ] Emails with status 'processing' are skipped (prevents duplicates)
- [ ] Replies always thread to original email
- [ ] No replies are sent to submit@auxos.dev
- [ ] No duplicate processing occurs (atomic transaction prevents this)

---

**Last Updated**: December 5, 2025
**Branch**: kerrylu-main-backup-1205

