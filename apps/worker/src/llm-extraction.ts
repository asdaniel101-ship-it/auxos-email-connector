import OpenAI from 'openai';

// Field name mapping from extraction config to Lead model
const FIELD_NAME_MAP: Record<string, string> = {
  businessName: 'legalBusinessName',
  address: 'primaryAddress',
  city: 'primaryCity',
  state: 'primaryState',
  zip: 'primaryZip',
  employeeCount: 'employeeCountTotal',
  revenue: 'annualRevenue',
  overview: 'businessDescription',
  // Keep these as-is (they match)
  yearsInOperation: 'yearsInOperation',
  taxId: 'taxId',
  industryCode: 'industryCode',
  industryLabel: 'industryLabel',
  totalClaimsCount: 'totalClaimsCount',
  totalClaimsLoss: 'totalClaimsLoss',
  currentCoverages: 'currentCoverages',
  ownershipStructure: 'ownershipStructure',
  keyAssets: 'keyAssets',
  additionalLocations: 'additionalLocations',
};

interface FieldDefinition {
  label: string;
  mandatory: boolean;
  instructions: string;
  keywords: string[];
  documentTypes: string[];
  patterns: string[];
}

interface ExtractionConfig {
  fieldExtractionInstructions: Record<string, FieldDefinition>;
}

interface ExtractedFieldData {
  fieldName: string; // This will be the Lead model field name
  fieldValue: string;
  confidence: number;
  source: string;
  extractedText: string;
}

/**
 * Use LLM to intelligently extract all fields from document text
 */
export async function extractFieldsWithLLM(
  text: string,
  config: ExtractionConfig,
  documentType: string | null,
  openai: OpenAI
): Promise<ExtractedFieldData[]> {
  // Build field schema for LLM
  const fieldSchema: any = {};
  const relevantFields: string[] = [];

  for (const [fieldName, fieldConfig] of Object.entries(config.fieldExtractionInstructions)) {
    // Skip if document type doesn't match
    if (documentType && !fieldConfig.documentTypes.includes(documentType)) {
      continue;
    }

    const leadFieldName = FIELD_NAME_MAP[fieldName] || fieldName;
    relevantFields.push(leadFieldName);

    fieldSchema[leadFieldName] = {
      label: fieldConfig.label,
      description: fieldConfig.instructions,
      keywords: fieldConfig.keywords,
      mandatory: fieldConfig.mandatory,
      originalFieldName: fieldName,
    };
  }

  if (relevantFields.length === 0) {
    return [];
  }

  // Build comprehensive prompt for LLM
  const systemPrompt = `You are an expert document extraction agent. Your job is to extract structured business information from document text.

DOCUMENT TYPE: ${documentType || 'Unknown'}

FIELDS TO EXTRACT:
${JSON.stringify(fieldSchema, null, 2)}

EXTRACTION RULES:
1. Read the entire document carefully - understand context, not just keywords
2. Extract values even if labels are in different formats (camelCase, Title Case, lowercase, etc.)
3. Use contextual understanding - information may not have explicit labels
4. Look for patterns (dates, addresses, numbers, codes)
5. Be flexible with formats (currency, dates, numbers)
6. Check headers, footers, and document titles
7. Calculate when needed (e.g., years in operation from founding date)
8. Extract complete values - don't truncate
9. Preserve formatting and entity suffixes (LLC, Inc., Corp.)

RESPONSE FORMAT (JSON only):
{
  "extractedFields": {
    "fieldName": "extracted value",
    "anotherField": "another value"
  },
  "confidence": {
    "fieldName": 0.95,
    "anotherField": 0.85
  },
  "reasoning": {
    "fieldName": "Found in document header as 'Legal Name: Acme Corp LLC'",
    "anotherField": "Calculated from founding year 2017 to current year"
  }
}

CONFIDENCE SCORING:
- 0.9-1.0: Field label and value clearly identified with exact match
- 0.7-0.89: Value identified through contextual understanding
- 0.5-0.69: Value inferred from patterns or calculated
- Below 0.5: Uncertain extraction

IMPORTANT:
- Only extract fields you're confident about (confidence >= 0.5)
- Use the Lead model field names exactly as specified
- For numbers, extract as strings (we'll convert later)
- For arrays, extract as JSON arrays
- Return ONLY valid JSON, no markdown`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Extract all relevant business information from this document text:\n\n${text.substring(0, 8000)}`, // Limit text to avoid token limits
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent extraction
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      return [];
    }

    // Parse JSON response
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Extract JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const result = JSON.parse(jsonText);
    const extractedFields: ExtractedFieldData[] = [];

    if (result.extractedFields) {
      for (const [fieldName, fieldValue] of Object.entries(result.extractedFields)) {
        const confidence = result.confidence?.[fieldName] || 0.7;
        const reasoning = result.reasoning?.[fieldName] || 'Extracted from document';

        // Only include if confidence is reasonable
        if (confidence >= 0.5 && fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
          extractedFields.push({
            fieldName, // Already mapped to Lead model field name
            fieldValue: String(fieldValue),
            confidence,
            source: `LLM extraction: ${reasoning}`,
            extractedText: reasoning.substring(0, 1000),
          });
        }
      }
    }

    return extractedFields;
  } catch (error) {
    console.error('Error in LLM extraction:', error);
    // Fall back to basic extraction
    return [];
  }
}

/**
 * Map extracted field names to Lead model field names
 */
export function mapFieldNameToLeadModel(extractedFieldName: string): string {
  return FIELD_NAME_MAP[extractedFieldName] || extractedFieldName;
}

