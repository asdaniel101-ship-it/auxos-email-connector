-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "activelyLookingForInsurance" BOOLEAN DEFAULT false,
ALTER COLUMN "currentPolicyTypes" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "desiredCoverages" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Partner" ALTER COLUMN "verticals" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "statesServed" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "preferredIndustries" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "coverageTypesInterested" SET DEFAULT ARRAY[]::TEXT[];
