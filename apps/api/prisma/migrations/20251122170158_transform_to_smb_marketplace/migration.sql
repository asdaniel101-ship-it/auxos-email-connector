-- Transform to SMB Marketplace Schema
-- This migration transforms from Submission-based to Session/Lead-based model

-- Drop old foreign key constraints
ALTER TABLE "ChatMessage" DROP CONSTRAINT IF EXISTS "ChatMessage_submissionId_fkey";
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_submissionId_fkey";
ALTER TABLE "ExtractedField" DROP CONSTRAINT IF EXISTS "ExtractedField_submissionId_fkey";
ALTER TABLE "ExtractedField" DROP CONSTRAINT IF EXISTS "ExtractedField_documentId_fkey";

-- Drop old tables
DROP TABLE IF EXISTS "ChatMessage";
DROP TABLE IF EXISTS "ExtractedField";
DROP TABLE IF EXISTS "Submission";

-- Create Session table
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "businessType" TEXT,
    "ownerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "howDidYouHear" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- Create Lead table
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "legalBusinessName" TEXT,
    "doingBusinessAs" TEXT,
    "entityType" TEXT,
    "fein" TEXT,
    "businessStartDate" TIMESTAMP(3),
    "yearsInOperation" INTEGER,
    "businessDescription" TEXT,
    "naicsCode" TEXT,
    "websiteURL" TEXT,
    "primaryAddress" TEXT,
    "primaryCity" TEXT,
    "primaryState" TEXT,
    "primaryZip" TEXT,
    "additionalLocations" JSONB,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "ownerPhone" TEXT,
    "employeeCountTotal" INTEGER,
    "annualRevenue" DECIMAL(15,2),
    "avgMonthlyRevenue" DECIMAL(15,2),
    "payrollAnnualTotal" DECIMAL(15,2),
    "businessHours" TEXT,
    "stateOfIncorporation" TEXT,
    "currentCarrier" TEXT,
    "currentPolicyTypes" TEXT[],
    "currentPremiumTotal" DECIMAL(15,2),
    "desiredCoverages" TEXT[],
    "desiredEffectiveDate" TIMESTAMP(3),
    "claimsPast3YearsCount" INTEGER,
    "claimsPast3YearsTotalPaid" DECIMAL(15,2),
    "priorCancellationsOrNonRenewals" BOOLEAN,
    "priorCancellationsDetails" TEXT,
    "subcontractorUsage" BOOLEAN,
    "subcontractorUsagePercent" DECIMAL(5,2),
    "highRiskActivities" TEXT,
    "propertyOwnedOrLeased" TEXT,
    "propertyValue" DECIMAL(15,2),
    "seatingCapacity" INTEGER,
    "servesAlcohol" BOOLEAN,
    "alcoholRevenuePercent" DECIMAL(5,2),
    "deliveryOrCatering" BOOLEAN,
    "deliveryCateringRevenuePercent" DECIMAL(5,2),
    "cookingMethods" TEXT,
    "fireProtection" TEXT,
    "inventoryValue" DECIMAL(15,2),
    "securitySystems" TEXT,
    "onsiteCustomersPerDayEstimate" INTEGER,
    "fundingPurpose" TEXT,
    "amountRequested" DECIMAL(15,2),
    "desiredTermMonths" INTEGER,
    "existingDebt" TEXT,
    "averageBankBalance" DECIMAL(15,2),
    "nsfCountLast3Months" INTEGER,
    "creditScoreRangeSelfReported" TEXT,
    "collateralAvailable" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "completionPercentage" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- Create ConversationMessage table
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fieldUpdates" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- Create FieldCandidate table
CREATE TABLE "FieldCandidate" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "documentId" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldCandidate_pkey" PRIMARY KEY ("id")
);

-- Create Partner table
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "verticals" TEXT[],
    "statesServed" TEXT[],
    "preferredIndustries" TEXT[],
    "minEmployeeCount" INTEGER,
    "maxEmployeeCount" INTEGER,
    "minRevenue" DECIMAL(15,2),
    "maxRevenue" DECIMAL(15,2),
    "coverageTypesInterested" TEXT[],
    "averageLeadValueEstimate" DECIMAL(15,2),
    "minMonthlyRevenue" DECIMAL(15,2),
    "minTimeInBusinessMonths" INTEGER,
    "maxLoanAmount" DECIMAL(15,2),
    "riskTolerance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- Create LeadAssignment table
CREATE TABLE "LeadAssignment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "LeadAssignment_pkey" PRIMARY KEY ("id")
);

-- Delete existing documents since we're transforming to a new schema
-- (This is safe for a test branch transformation)
DELETE FROM "Document";

-- Update Document table to reference Session
ALTER TABLE "Document" DROP COLUMN IF EXISTS "submissionId";
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;
ALTER TABLE "Document" DROP COLUMN IF EXISTS "documentType";
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "docType" TEXT;
ALTER TABLE "Document" DROP COLUMN IF EXISTS "verified";
ALTER TABLE "Document" DROP COLUMN IF EXISTS "verifiedAt";
ALTER TABLE "Document" DROP COLUMN IF EXISTS "verificationData";

-- Now make sessionId required (since we deleted old data)
ALTER TABLE "Document" ALTER COLUMN "sessionId" SET NOT NULL;

-- Recreate ExtractedField table to reference Lead
CREATE TABLE "ExtractedField" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "documentId" TEXT,
    "fieldName" TEXT NOT NULL,
    "fieldValue" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "source" TEXT,
    "extractedText" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedField_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldCandidate" ADD CONSTRAINT "FieldCandidate_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add unique constraints
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sessionId_key" UNIQUE ("sessionId");
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_leadId_partnerId_key" UNIQUE ("leadId", "partnerId");

-- Create indexes
CREATE INDEX IF NOT EXISTS "Session_email_idx" ON "Session"("email");
CREATE INDEX IF NOT EXISTS "Session_status_idx" ON "Session"("status");
CREATE INDEX IF NOT EXISTS "Lead_status_idx" ON "Lead"("status");
CREATE INDEX IF NOT EXISTS "Lead_primaryState_idx" ON "Lead"("primaryState");
CREATE INDEX IF NOT EXISTS "ConversationMessage_sessionId_idx" ON "ConversationMessage"("sessionId");
CREATE INDEX IF NOT EXISTS "ConversationMessage_createdAt_idx" ON "ConversationMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "Document_sessionId_idx" ON "Document"("sessionId");
CREATE INDEX IF NOT EXISTS "Document_docType_idx" ON "Document"("docType");
CREATE INDEX IF NOT EXISTS "Document_processingStatus_idx" ON "Document"("processingStatus");
CREATE INDEX IF NOT EXISTS "ExtractedField_leadId_idx" ON "ExtractedField"("leadId");
CREATE INDEX IF NOT EXISTS "ExtractedField_documentId_idx" ON "ExtractedField"("documentId");
CREATE INDEX IF NOT EXISTS "ExtractedField_fieldName_idx" ON "ExtractedField"("fieldName");
CREATE INDEX IF NOT EXISTS "FieldCandidate_leadId_idx" ON "FieldCandidate"("leadId");
CREATE INDEX IF NOT EXISTS "FieldCandidate_fieldName_idx" ON "FieldCandidate"("fieldName");
CREATE INDEX IF NOT EXISTS "Partner_contactEmail_idx" ON "Partner"("contactEmail");
CREATE INDEX IF NOT EXISTS "Partner_verticals_idx" ON "Partner"("verticals");
CREATE INDEX IF NOT EXISTS "LeadAssignment_partnerId_idx" ON "LeadAssignment"("partnerId");
CREATE INDEX IF NOT EXISTS "LeadAssignment_leadId_idx" ON "LeadAssignment"("leadId");
CREATE INDEX IF NOT EXISTS "LeadAssignment_status_idx" ON "LeadAssignment"("status");

