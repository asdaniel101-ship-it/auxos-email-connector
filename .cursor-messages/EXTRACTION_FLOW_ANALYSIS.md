# Document Extraction Flow Analysis

## Current Flow (What Should Happen)

### 1. **Document Upload** (`apps/web/src/app/start/page.tsx`)
   - User selects files on `/start` page
   - Files are uploaded to MinIO via presigned URL
   - Document record is created via `POST /documents/upload`
   - **PROBLEM**: No workflow is triggered after document creation

### 2. **Document Record Creation** (`apps/api/src/documents/documents.controller.ts`)
   - Creates a `Document` record in database with:
     - `sessionId` (links to Session)
     - `fileName`, `fileKey` (MinIO key), `fileSize`, `mimeType`
     - `processingStatus: 'pending'`
   - **PROBLEM**: This endpoint doesn't trigger the Temporal workflow

### 3. **Temporal Workflow** (`apps/worker/src/workflows.ts`)
   - `extractDocumentWorkflow` should be triggered with `{ documentId, sessionId }`
   - Workflow steps:
     1. Update document status to `'processing'`
     2. Get document info from API
     3. Download file from MinIO
     4. Extract text from PDF
     5. Load extraction config from `extraction-config.json`
     6. Classify document type (basic_company_info, financial_statements, claims_loss_history)
     7. Extract fields using LLM (primary) or regex/keyword (fallback)
     8. Get session to find lead ID
     9. Save extracted fields to database via `POST /extracted-fields`
     10. Update document status to `'processed'`

### 4. **Field Extraction Logic** (`apps/worker/src/activities.ts`)

#### LLM Extraction (Primary Method)
- Uses OpenAI GPT model (default: `gpt-4o-mini`)
- Requires `OPENAI_API_KEY` environment variable
- System prompt includes:
  - Document type context
  - Field schema with labels, descriptions, keywords
  - Extraction rules and confidence scoring
- Returns JSON with:
  ```json
  {
    "extractedFields": {
      "legalBusinessName": "Acme Corp",
      "annualRevenue": "1250000"
    },
    "confidence": {
      "legalBusinessName": 0.95,
      "annualRevenue": 0.9
    },
    "reasoning": {
      "legalBusinessName": "Found in document header",
      "annualRevenue": "Found in income statement"
    }
  }
  ```

#### Regex/Keyword Extraction (Fallback)
- Used if LLM fails or `OPENAI_API_KEY` is not set
- Iterates through each field in `extraction-config.json`
- Tries regex patterns first (high confidence: 0.9)
- Falls back to keyword matching (medium confidence: 0.7)
- Only extracts fields that match the document type

### 5. **Field Name Mapping** (`apps/worker/src/llm-extraction.ts`)
- Maps extraction config field names to Lead model field names:
  - `businessName` → `legalBusinessName`
  - `address` → `primaryAddress`
  - `city` → `primaryCity`
  - `state` → `primaryState`
  - `zip` → `primaryZip`
  - `employeeCount` → `employeeCountTotal`
  - `revenue` → `annualRevenue`
  - `overview` → `businessDescription`

### 6. **Saving Extracted Fields** (`apps/worker/src/activities.ts`)
- Calls `POST /extracted-fields` for each extracted field
- Creates `ExtractedField` records linked to:
  - `leadId` (required)
  - `documentId` (optional, can be null)
  - `fieldName` (Lead model field name)
  - `fieldValue` (extracted value as string)
  - `confidence` (0.0-1.0)
  - `source` (description of extraction method)
  - `extractedText` (context snippet)

## Fields Being Extracted (from `extraction-config.json`)

### Basic Company Info Fields
- `businessName` → `legalBusinessName`
- `address` → `primaryAddress`
- `city` → `primaryCity`
- `state` → `primaryState`
- `zip` → `primaryZip`
- `employeeCount` → `employeeCountTotal`
- `yearsInOperation` → `yearsInOperation`
- `industryCode` → `industryCode`
- `industryLabel` → `industryLabel`
- `overview` → `businessDescription`
- `taxId` → `taxId`
- `ownershipStructure` → `ownershipStructure`
- `additionalLocations` → `additionalLocations`

### Financial Statement Fields
- `revenue` → `annualRevenue`
- `keyAssets` → `keyAssets`

### Claims/Loss History Fields
- `totalClaimsCount` → `totalClaimsCount`
- `totalClaimsLoss` → `totalClaimsLoss`

### Insurance Fields
- `currentCoverages` → `currentCoverages`

## Document Types

1. **basic_company_info**: Business licenses, articles of incorporation, tax IDs
2. **financial_statements**: Balance sheets, income statements, P&L, tax returns
3. **claims_loss_history**: Loss runs, ACORD forms, claim records

## Root Cause: Missing Workflow Trigger

**The workflow is never started!** After a document is created via `POST /documents/upload`, there's no code that:
1. Gets a Temporal client
2. Starts the `extractDocumentWorkflow` with the document ID and session ID

## Required Fix

Add code to trigger the workflow after document creation:
1. Import Temporal client in documents controller/service
2. After creating document, start workflow:
   ```typescript
   const client = await getTemporalClient();
   await client.workflow.start(extractDocumentWorkflow, {
     taskQueue: 'agent-queue',
     args: [{ documentId: document.id, sessionId: body.sessionId }],
   });
   ```

## Prerequisites

1. **Temporal server running**: `localhost:7233`
2. **Worker running**: `pnpm run worker` (listens to `agent-queue`)
3. **OpenAI API key**: Set `OPENAI_API_KEY` in worker environment
4. **MinIO running**: For file storage
5. **Database**: For storing extracted fields

## Testing the Flow

1. Upload a PDF document on `/start` page
2. Check Temporal UI (if available) to see if workflow started
3. Check worker logs for extraction progress
4. Query database: `SELECT * FROM "ExtractedField" WHERE "leadId" = '...'`
5. Check document status: `SELECT "processingStatus", "docType" FROM "Document" WHERE id = '...'`

