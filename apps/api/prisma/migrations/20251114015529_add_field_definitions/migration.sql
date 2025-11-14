-- CreateEnum
CREATE TYPE "FieldValueType" AS ENUM ('string', 'number', 'decimal', 'boolean', 'text');

-- CreateTable
CREATE TABLE "FieldDefinition" (
    "id" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fieldType" "FieldValueType" NOT NULL,
    "enteredFieldKey" TEXT,
    "chatFieldKey" TEXT,
    "documentFieldKey" TEXT,
    "businessDescription" TEXT,
    "extractorLogic" TEXT,
    "documentSources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alternateFieldNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FieldDefinition_fieldName_key" ON "FieldDefinition"("fieldName");
