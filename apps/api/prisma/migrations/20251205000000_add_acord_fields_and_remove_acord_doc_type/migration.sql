-- Add new ACORD 130 fields to FieldDefinition
ALTER TABLE "FieldDefinition" ADD COLUMN IF NOT EXISTS "inAcord130" TEXT;
ALTER TABLE "FieldDefinition" ADD COLUMN IF NOT EXISTS "whereInAcord130" TEXT;

-- Remove 'acord' from DocumentType enum and add new types
-- First, update any existing 'acord' records to 'other'
UPDATE "EmailAttachment" SET "documentType" = 'other' WHERE "documentType" = 'acord';

-- Note: Prisma doesn't support removing enum values directly
-- We'll need to recreate the enum. For now, we'll leave 'acord' in the enum
-- but it won't be used going forward. The application code has been updated
-- to not use 'acord' as a document type.

-- The enum will be updated when we regenerate Prisma client
-- New enum values (payroll, questionnaire, application) will be added

