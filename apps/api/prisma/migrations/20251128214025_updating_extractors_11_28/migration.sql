/*
  Warnings:

  - You are about to drop the `ConversationMessage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Document` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExtractedField` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FieldCandidate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Lead` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LeadAssignment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Partner` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ConversationMessage" DROP CONSTRAINT "ConversationMessage_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Document" DROP CONSTRAINT "Document_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ExtractedField" DROP CONSTRAINT "ExtractedField_documentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ExtractedField" DROP CONSTRAINT "ExtractedField_leadId_fkey";

-- DropForeignKey
ALTER TABLE "public"."FieldCandidate" DROP CONSTRAINT "FieldCandidate_leadId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Lead" DROP CONSTRAINT "Lead_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LeadAssignment" DROP CONSTRAINT "LeadAssignment_leadId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LeadAssignment" DROP CONSTRAINT "LeadAssignment_partnerId_fkey";

-- DropTable
DROP TABLE "public"."ConversationMessage";

-- DropTable
DROP TABLE "public"."Document";

-- DropTable
DROP TABLE "public"."ExtractedField";

-- DropTable
DROP TABLE "public"."FieldCandidate";

-- DropTable
DROP TABLE "public"."Lead";

-- DropTable
DROP TABLE "public"."LeadAssignment";

-- DropTable
DROP TABLE "public"."Partner";

-- DropTable
DROP TABLE "public"."Session";
