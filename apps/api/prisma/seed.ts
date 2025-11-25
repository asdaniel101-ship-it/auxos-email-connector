import { PrismaClient, FieldValueType } from '@prisma/client';
import extractionConfig from '../extraction-config.json';

const prisma = new PrismaClient();

const CATEGORY_MAP: Record<string, string> = {
  businessName: 'Company Info',
  address: 'Company Info',
  city: 'Company Info',
  state: 'Company Info',
  zip: 'Company Info',
  additionalLocations: 'Company Info',
  employeeCount: 'Company Info',
  yearsInOperation: 'Company Info',
  industryCode: 'Company Info',
  industryLabel: 'Company Info',
  overview: 'Company Info',
  revenue: 'Financials',
  totalClaimsCount: 'Loss History',
  totalClaimsLoss: 'Loss History',
  riskToleranceLevel: 'Strategy',
  currentCoverages: 'Coverage',
  insuranceNeeds: 'Coverage',
  keyAssets: 'Operations',
  growthPlans: 'Operations',
  taxId: 'Compliance',
  businessRegistrationCert: 'Compliance',
  financialStatements: 'Financials',
  proofOfAddress: 'Compliance',
  ownershipStructure: 'Ownership',
  priorInsuranceDocs: 'Coverage',
  employeeList: 'Operations',
  safetyManuals: 'Operations',
  alcoholServiceStatus: 'Restaurant Risk',
  alcoholSalesPercentage: 'Restaurant Risk',
  alcoholSalesInfoStatus: 'Restaurant Risk',
  digitalInfrastructureProfile: 'Technology',
};

const NUMBER_FIELDS = new Set([
  'employeeCount',
  'yearsInOperation',
  'totalClaimsCount',
]);

const DECIMAL_FIELDS = new Set([
  'revenue',
  'totalClaimsLoss',
  'alcoholSalesPercentage',
]);

const BOOLEAN_FIELDS = new Set<string>();

const TEXT_FIELDS = new Set([
  'businessDescription',
  'businessRegistrationCert',
  'financialStatements',
  'proofOfAddress',
  'currentCoverages',
  'keyAssets',
  'growthPlans',
  'ownershipStructure',
  'priorInsuranceDocs',
  'employeeList',
  'safetyManuals',
  'digitalInfrastructureProfile',
]);

type FieldInstruction = {
  label?: string;
  instructions?: string;
  keywords?: string[];
  documentTypes?: string[];
};

function inferFieldType(fieldName: string): FieldValueType {
  if (NUMBER_FIELDS.has(fieldName)) return FieldValueType.number;
  if (DECIMAL_FIELDS.has(fieldName)) return FieldValueType.decimal;
  if (BOOLEAN_FIELDS.has(fieldName)) return FieldValueType.boolean;
  if (TEXT_FIELDS.has(fieldName)) return FieldValueType.text;
  return FieldValueType.string;
}

function buildFieldDefinitions() {
  const instructions = extractionConfig.fieldExtractionInstructions as Record<string, FieldInstruction>;

  const baseFields = Object.entries(instructions).map(([fieldName, config]) => ({
    fieldName,
    category: CATEGORY_MAP[fieldName] ?? 'General',
    fieldType: inferFieldType(fieldName),
    enteredFieldKey: fieldName,
    chatFieldKey: fieldName,
    documentFieldKey: fieldName,
    businessDescription: config.label ?? null,
    extractorLogic: config.instructions ?? null,
    documentSources: config.documentTypes ?? [],
    alternateFieldNames: config.keywords ?? [],
  }));

  const supplementalFields = [
    {
      fieldName: 'alcoholServiceStatus',
      category: CATEGORY_MAP['alcoholServiceStatus'],
      fieldType: FieldValueType.string,
      businessDescription: 'Indicates whether the business serves alcohol (yes, no, or unknown).',
      extractorLogic: 'Capture explicit statements about alcohol service from chat or documents.',
    },
    {
      fieldName: 'alcoholSalesPercentage',
      category: CATEGORY_MAP['alcoholSalesPercentage'],
      fieldType: FieldValueType.decimal,
      businessDescription: 'Percentage of revenue derived from alcohol sales.',
      extractorLogic: 'Numeric percentage provided by applicant or inferred from documents; request follow up if missing.',
    },
    {
      fieldName: 'alcoholSalesInfoStatus',
      category: CATEGORY_MAP['alcoholSalesInfoStatus'],
      fieldType: FieldValueType.string,
      businessDescription: 'Tracks whether alcohol sales information is known or marked unknown.',
      extractorLogic: 'Set to unknown when applicant cannot estimate alcohol revenue mix.',
    },
    {
      fieldName: 'digitalInfrastructureProfile',
      category: CATEGORY_MAP['digitalInfrastructureProfile'],
      fieldType: FieldValueType.text,
      businessDescription: 'Narrative describing the technology stack, cybersecurity posture, or digital tooling.',
      extractorLogic: 'Summarize technology references from documents or chat conversations.',
    },
  ].map((field) => ({
    ...field,
    enteredFieldKey: field.fieldName,
    chatFieldKey: field.fieldName,
    documentFieldKey: field.fieldName,
    documentSources: [],
    alternateFieldNames: [],
  }));

  return [...baseFields, ...supplementalFields];
}

async function main() {
  // Old submission seeding removed - using new Session/Lead model
  // If you need test data, create sessions instead:
  // await prisma.session.create({ ... })

  const fieldDefinitions = buildFieldDefinitions();

  if (fieldDefinitions.length > 0) {
    await prisma.fieldDefinition.createMany({
      data: fieldDefinitions,
      skipDuplicates: true,
    });
  }

  console.log('Field definitions seeded successfully');
}

main().finally(() => prisma.$disconnect());
