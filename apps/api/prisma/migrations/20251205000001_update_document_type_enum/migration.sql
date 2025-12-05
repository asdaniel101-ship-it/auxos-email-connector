-- Update DocumentType enum to add new values and remove 'acord'
-- PostgreSQL doesn't support removing enum values directly, so we need to:
-- 1. Create a new enum with the updated values
-- 2. Update the column to use the new enum
-- 3. Drop the old enum
-- 4. Rename the new enum

-- Step 1: Create new enum with updated values
CREATE TYPE "DocumentType_new" AS ENUM (
  'email_body',
  'sov',
  'loss_run',
  'schedule',
  'supplemental',
  'payroll',
  'questionnaire',
  'application',
  'other'
);

-- Step 2: Update existing records from 'acord' to 'other' (if any)
UPDATE "EmailAttachment" SET "documentType" = 'other' WHERE "documentType" = 'acord';

-- Step 3: Drop the default constraint temporarily
ALTER TABLE "EmailAttachment" ALTER COLUMN "documentType" DROP DEFAULT;

-- Step 4: Alter the column to use the new enum
ALTER TABLE "EmailAttachment" 
  ALTER COLUMN "documentType" TYPE "DocumentType_new" 
  USING "documentType"::text::"DocumentType_new";

-- Step 5: Restore the default value
ALTER TABLE "EmailAttachment" ALTER COLUMN "documentType" SET DEFAULT 'other';

-- Step 6: Drop the old enum
DROP TYPE "DocumentType";

-- Step 7: Rename the new enum to the original name
ALTER TYPE "DocumentType_new" RENAME TO "DocumentType";

