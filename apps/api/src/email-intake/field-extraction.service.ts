import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { DocumentParserService } from './document-parser.service';
import * as fs from 'fs';
import * as path from 'path';

// Dynamic import for OpenAI
let OpenAI: any;
try {
  OpenAI = require('openai').default;
} catch (e) {
  // OpenAI not installed
}

interface FieldDefinitionInfo {
  fieldName: string;
  category: string;
  fieldType: string;
  businessDescription?: string | null;
  extractorLogic?: string | null;
  whereToLook?: string | null;
  documentSources?: string[];
}

@Injectable()
export class FieldExtractionService implements OnModuleInit {
  private readonly logger = new Logger(FieldExtractionService.name);
  private openai: any;
  private fieldSchema: any;
  private fieldDefinitions: Map<string, FieldDefinitionInfo> = new Map();

  constructor(
    private configService: ConfigService,
    private documentParser: DocumentParserService,
    private prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey || !OpenAI) {
      this.logger.warn(
        'OPENAI_API_KEY not set or OpenAI not installed - field extraction will not work',
      );
    } else {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async onModuleInit() {
    // Load field schema and definitions at startup
    await this.loadFieldSchema();
    await this.loadFieldDefinitions();
  }

  /**
   * Load field schema from JSON file (for structure)
   */
  private async loadFieldSchema() {
    try {
      // Try multiple possible locations so this works both in dev and in the built Docker image
      const candidates: string[] = [];

      // 1) CWD (apps/api in dev, /app/apps/api in prod)
      candidates.push(path.join(process.cwd(), 'field-schema.json'));

      // 2) Relative to compiled file (dist/src/email-intake → dist/field-schema.json)
      candidates.push(path.join(__dirname, '../../field-schema.json'));

      // 3) One level higher (dist/src/email-intake → ../field-schema.json) – safety fallback
      candidates.push(path.join(__dirname, '../field-schema.json'));

      const existingPath = candidates.find((p) => fs.existsSync(p));

      if (existingPath) {
        this.logger.log(`Loaded field schema from: ${existingPath}`);
        this.fieldSchema = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));
      } else {
        this.logger.warn(
          `field-schema.json not found in any known location, using default schema. Tried: ${candidates.join(
            ', ',
          )}`,
        );
        this.fieldSchema = this.getDefaultSchema();
      }
    } catch (error) {
      this.logger.error('Error loading field schema:', error);
      this.fieldSchema = this.getDefaultSchema();
    }
  }

  /**
   * Load field definitions from database (businessDescription, extractorLogic, whereToLook)
   */
  private async loadFieldDefinitions() {
    try {
      const definitions = await this.prisma.fieldDefinition.findMany();
      this.fieldDefinitions.clear();

      for (const def of definitions) {
        this.fieldDefinitions.set(def.fieldName, {
          fieldName: def.fieldName,
          category: def.category,
          fieldType: def.fieldType,
          businessDescription: def.businessDescription,
          extractorLogic: def.extractorLogic,
          whereToLook: def.whereToLook,
          documentSources: def.documentSources,
        });
      }

      this.logger.log(
        `Loaded ${this.fieldDefinitions.size} field definitions from database`,
      );
    } catch (error) {
      this.logger.error(
        'Error loading field definitions from database:',
        error,
      );
      // Continue with empty map - will use schema defaults
    }
  }

  /**
   * Refresh field definitions from database (call after updates)
   */
  async refreshFieldDefinitions() {
    await this.loadFieldDefinitions();
  }

  /**
   * Get enhanced schema for debugging (exposes private method)
   */
  getEnhancedSchemaForDebug() {
    const enhancedSchema = this.buildEnhancedSchema();
    const fieldsWithLogic = this.countFieldsWithExtractorLogic(enhancedSchema);

    // Get a sample of fields with extractor logic
    const sampleFields: any[] = [];
    const collectSampleFields = (obj: any, path: string = '') => {
      if (!obj || typeof obj !== 'object' || sampleFields.length >= 5) return;

      if (obj.type === 'array' && obj.items) {
        collectSampleFields(obj.items, path);
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
        if (sampleFields.length >= 5) break;
        const fieldPath = path ? `${path}.${key}` : key;

        if (
          value &&
          typeof value === 'object' &&
          'type' in value &&
          typeof value.type === 'string'
        ) {
          const fieldValue = value as any;
          if (fieldValue.extractorLogic) {
            sampleFields.push({
              fieldPath,
              fieldName: key,
              hasBusinessDescription: !!fieldValue.businessDescription,
              hasExtractorLogic: !!fieldValue.extractorLogic,
              hasWhereToLook: !!fieldValue.whereToLook,
              extractorLogicPreview:
                fieldValue.extractorLogic.substring(0, 100) + '...',
            });
          }
        } else if (value && typeof value === 'object') {
          collectSampleFields(value, fieldPath);
        }
      }
    };

    collectSampleFields(enhancedSchema);

    return {
      totalFieldsWithExtractorLogic: fieldsWithLogic,
      totalFieldDefinitionsLoaded: this.fieldDefinitions.size,
      sampleFields,
      fullSchema: enhancedSchema,
    };
  }

  /**
   * Extract fields from email and documents using LLM
   * Returns both extracted data and field extractions with document chunks
   */
  async extract(
    emailData: any,
    documentClassifications: Map<string, string>,
  ): Promise<{
    data: any;
    fieldExtractions: Array<{
      fieldPath: string;
      fieldName: string;
      fieldValue: any;
      source: string;
      documentId?: string;
      documentChunk?: string;
      highlightedText?: string;
      chunkStartIndex?: number;
      chunkEndIndex?: number;
      llmReasoning?: string;
    }>;
    llmPrompt?: string | null;
    llmResponse?: string | null;
  }> {
    // Parse all documents and store full text by attachment ID
    const parsedTexts = await this.documentParser.parseAllDocuments(
      emailData.attachments || [],
      documentClassifications,
    );

    // Removed verbose document parsing logs - keep logs clean

    // Build a map of attachment ID to full parsed text
    // Note: parseAllDocuments groups by docType, so we need to parse individually for proper mapping
    const attachmentTextMap = new Map<
      string,
      { text: string; docType: string }
    >();
    for (const attachment of emailData.attachments || []) {
      const docType = documentClassifications.get(attachment.id) || 'other';
      try {
        // Parse this specific attachment to get its individual text
        const text = await this.documentParser.parseDocument(attachment);
        attachmentTextMap.set(attachment.id, { text, docType });
      } catch (error) {
        // If individual parsing fails, try to get from grouped results
        const groupedText = parsedTexts.get(docType) || '';
        attachmentTextMap.set(attachment.id, { text: groupedText, docType });
      }
    }

    // Build extraction prompt with actual parsed text
    const extractionPrompt = this.buildExtractionPrompt(
      emailData,
      documentClassifications,
      parsedTexts,
    );

    if (!this.openai) {
      throw new Error('OpenAI API not configured');
    }

    try {
      // NEW APPROACH: Extract each field separately with its own LLM call
      // Each field gets: businessDescription, extractorLogic, whereToLook, and all documents
      const allSchemaFields = this.getAllSchemaFields();
      this.logger.log(
        `Starting field extraction: ${allSchemaFields.length} fields to process`,
      );
      const extractedData: any = {
        submission: {},
        locations: [],
        coverage: {},
        lossHistory: {},
      };

      const fieldExtractions: Array<{
        fieldPath: string;
        fieldName: string;
        fieldValue: any;
        source: string;
        documentId?: string;
        documentChunk?: string;
        highlightedText?: string;
        chunkStartIndex?: number;
        chunkEndIndex?: number;
        llmReasoning?: string;
      }> = [];

      const fullResponses: string[] = [];

      // Extract fields in parallel batches to speed up processing while respecting rate limits
      const BATCH_SIZE = 5; // Process 5 fields in parallel
      const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches

      for (
        let batchStart = 0;
        batchStart < allSchemaFields.length;
        batchStart += BATCH_SIZE
      ) {
        const batchEnd = Math.min(
          batchStart + BATCH_SIZE,
          allSchemaFields.length,
        );
        const batch = allSchemaFields.slice(batchStart, batchEnd);

        const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(allSchemaFields.length / BATCH_SIZE);

        // Process batch in parallel
        const batchPromises = batch.map(async (schemaField, index) => {
          const fieldIndex = batchStart + index + 1;
          const totalFields = allSchemaFields.length;

          try {
            const fieldResult = await this.extractSingleField(
              schemaField,
              emailData,
              documentClassifications,
              parsedTexts,
            );

            // Log progress: field name, X/total, and value found
            const valuePreview =
              fieldResult.fieldValue != null
                ? String(fieldResult.fieldValue).substring(0, 50)
                : 'null';
            this.logger.log(
              `[${fieldIndex}/${totalFields}] ✓ ${schemaField.name}: ${valuePreview}`,
            );

            return { success: true, field: schemaField, result: fieldResult };
          } catch (error: any) {
            const isRateLimit = error?.status === 429;
            if (isRateLimit) {
              this.logger.warn(
                `[${fieldIndex}/${totalFields}] ⚠ ${schemaField.name}: Rate limited, will retry`,
              );
            } else {
              this.logger.warn(
                `[${fieldIndex}/${totalFields}] ✗ ${schemaField.name}: ${error.message}`,
              );
            }
            return {
              success: false,
              field: schemaField,
              error: error.message,
              isRateLimit,
            };
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);

        // Process results
        for (const batchResult of batchResults) {
          if (batchResult.success && batchResult.result) {
            // Store the extracted value
            this.setValueByPath(
              extractedData,
              batchResult.field.path,
              batchResult.result.fieldValue,
            );

            // Add to field extractions
            fieldExtractions.push(batchResult.result);

            if (batchResult.result.llmResponse) {
              fullResponses.push(
                `${batchResult.field.path}: ${batchResult.result.llmResponse}`,
              );
            }
          } else {
            // Add null extraction for failed fields
            fieldExtractions.push({
              fieldPath: batchResult.field.path,
              fieldName: batchResult.field.name,
              fieldValue: null,
              source: 'other',
              llmReasoning: `Error during extraction: ${batchResult.error}`,
            });

            // If rate limit, wait longer before next batch
            if (
              batchResult.isRateLimit &&
              batchStart + BATCH_SIZE < allSchemaFields.length
            ) {
              const waitTime = 5000; // Wait 5 seconds on rate limit
              const remainingFields = allSchemaFields.length - batchEnd;
              this.logger.warn(
                `⚠ Rate limit hit. Waiting ${waitTime}ms before processing remaining ${remainingFields} fields`,
              );
              await new Promise((resolve) => setTimeout(resolve, waitTime));
            }
          }
        }

        // Log batch completion progress
        const completedFields = batchEnd;
        const totalFields = allSchemaFields.length;
        const extractedCount = fieldExtractions.filter(
          (fe) => fe.fieldValue !== null && fe.fieldValue !== undefined && fe.fieldValue !== '',
        ).length;
        this.logger.log(
          `Batch ${batchNum}/${totalBatches} complete: ${completedFields}/${totalFields} fields processed, ${extractedCount} extracted`,
        );

        // Delay between batches (except for last batch)
        if (batchEnd < allSchemaFields.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, DELAY_BETWEEN_BATCHES),
          );
        }
      }

      const fullResponse = fullResponses.join('\n\n');
      const fullPrompt = `Per-field extraction: ${allSchemaFields.length} separate LLM calls, one per field`;

      // Log extraction summary
      const extractedCount = fieldExtractions.filter(
        (fe) =>
          fe.fieldValue !== null &&
          fe.fieldValue !== undefined &&
          fe.fieldValue !== '',
      ).length;
      const nullCount = fieldExtractions.length - extractedCount;

      // Final summary already logged in batch completion above

      return {
        data: extractedData,
        fieldExtractions: fieldExtractions,
        llmPrompt: fullPrompt,
        llmResponse: fullResponse,
      };
    } catch (error: any) {
      this.logger.error('Error in field extraction:', error);

      // Handle OpenAI API errors gracefully
      if (
        error?.status === 429 ||
        error?.message?.includes('quota') ||
        error?.message?.includes('429')
      ) {
        this.logger.warn(
          'OpenAI API quota exceeded, using fallback extraction',
        );
        return this.fallbackExtraction(
          emailData,
          documentClassifications,
          parsedTexts,
        );
      }

      if (error?.status === 401 || error?.message?.includes('401')) {
        throw new Error(
          'OpenAI API key is invalid. Please check your OPENAI_API_KEY environment variable.',
        );
      }

      // For other errors, try fallback before throwing
      this.logger.warn('OpenAI API error, attempting fallback extraction');
      try {
        return this.fallbackExtraction(
          emailData,
          documentClassifications,
          parsedTexts,
        );
      } catch (fallbackError) {
        throw new Error(
          `Field extraction failed: ${error.message || String(error)}`,
        );
      }
    }
  }

  /**
   * Build system prompt with field schema
   */
  private buildSystemPrompt(): string {
    return `You are an expert at extracting structured commercial property insurance submission data from emails and documents.

Extract all fields from the provided content according to this schema:
${JSON.stringify(this.fieldSchema, null, 2)}

Return a JSON object with:
- Top-level submission fields (submissionId, carrierName, brokerName, etc.)
- locations: array of location objects with buildings array
- coverage: coverage and limits fields
- lossHistory: loss history fields

For each field, return either a concrete value or null if not present.`;
  }

  /**
   * Build system prompt for Pass 1: Pure data extraction only (no fieldExtractions, no reasoning)
   * Uses clean output template instead of JSON Schema
   */
  private buildSystemPromptDataOnly(): string {
    // Build output template (clean shape with null placeholders)
    const outputTemplate = this.buildOutputTemplate();

    // Build field definitions reference (for extraction guidance)
    const fieldDefinitions = this.buildFieldDefinitionsReference();

    const prompt = `You are an expert at extracting structured commercial property insurance submission data from emails and documents.

Your task is to extract data and return ONLY valid JSON matching this exact structure:
${JSON.stringify(outputTemplate, null, 2)}

Use this object as a template. Replace nulls with extracted values and keep the exact same property names and nesting.

FIELD EXTRACTION GUIDELINES:
${fieldDefinitions}

CRITICAL EXTRACTION STRATEGY:
For each field, follow this search order:
1. FIRST: Check the document sections specified in "Where to Look" (if provided)
   - These are the most likely places to find the value
   - Search thoroughly in these sections first
2. IF NOT FOUND: Then search ALL other available document sections
   - Don't give up after checking "Where to Look" sections
   - Continue searching in all other document types (acord, sov, loss_run, schedule, supplemental, email_body, other)
   - The value might be in an unexpected location

Example: If "Where to Look" says "SOV, ACORD" but you don't find the value there, still check:
- email_body
- loss_run
- schedule
- supplemental
- other

IMPORTANT INSTRUCTIONS:
1. Return ONLY the JSON object matching the template structure above. Do not include any explanations, comments, or additional fields.
2. Use null for any field you cannot find in ANY of the provided content after searching all document sections.
3. For arrays (locations, buildings), create array items based on what you find in the documents. If there's one location with one building, create locations[0] with buildings[0].
4. Keep property names exactly as shown in the template - do not change or add any keys.
5. The section names in the content (between ===) indicate document types. Search all sections systematically.

Return valid JSON only. No explanations, no reasoning, no fieldExtractions - just the data object.`;

    return prompt;
  }

  /**
   * Build field definitions reference for extraction guidance
   * This provides businessDescription, extractorLogic, and whereToLook without the schema structure
   */
  private buildFieldDefinitionsReference(): string {
    const definitions: string[] = [];

    const addFieldDefinition = (schemaObj: any, path: string = '') => {
      if (!schemaObj || typeof schemaObj !== 'object') return;

      if (schemaObj.type === 'array' && schemaObj.items) {
        addFieldDefinition(schemaObj.items, path);
        return;
      }

      for (const [key, value] of Object.entries(schemaObj)) {
        if (!value || typeof value !== 'object') continue;

        const fieldPath = path ? `${path}.${key}` : key;

        if ('type' in value && typeof value.type === 'string') {
          if (value.type === 'array' && 'items' in value) {
            addFieldDefinition(value.items, `${fieldPath}[0]`);
          } else {
            // This is a field - add its definition
            const fieldDef = this.fieldDefinitions.get(key);
            if (fieldDef) {
              let defText = `\n${fieldPath}:`;
              if (fieldDef.businessDescription) {
                defText += `\n  Business Description: ${fieldDef.businessDescription}`;
              }
              if (fieldDef.extractorLogic) {
                defText += `\n  Extraction Logic: ${fieldDef.extractorLogic}`;
              }
              if (fieldDef.whereToLook) {
                defText += `\n  Where to Look: ${fieldDef.whereToLook}`;
              }
              definitions.push(defText);
            }
          }
        } else {
          addFieldDefinition(value, fieldPath);
        }
      }
    };

    // Process each section
    if (this.fieldSchema.submission) {
      addFieldDefinition(this.fieldSchema.submission, 'submission');
    }
    if (this.fieldSchema.locations) {
      addFieldDefinition(this.fieldSchema.locations, 'locations[0]');
    }
    if (this.fieldSchema.coverage) {
      addFieldDefinition(this.fieldSchema.coverage, 'coverage');
    }
    if (this.fieldSchema.lossHistory) {
      addFieldDefinition(this.fieldSchema.lossHistory, 'lossHistory');
    }

    return definitions.join('\n');
  }

  /**
   * Build system prompt that requests document chunks and highlights
   * Includes field definitions with businessDescription, extractorLogic, and whereToLook
   * This is the OLD approach - kept for backward compatibility or Pass 2
   */
  private buildSystemPromptWithChunks(): string {
    // Build enhanced schema with field definitions
    const enhancedSchema = this.buildEnhancedSchema();

    // Log how many fields have extractor logic for debugging
    const fieldsWithLogic = this.countFieldsWithExtractorLogic(enhancedSchema);
    this.logger.log(
      `Enhanced schema includes ${fieldsWithLogic} fields with extractorLogic`,
    );

    const prompt = `You are an expert at extracting structured commercial property insurance submission data from emails and documents.

Extract all fields from the provided content according to this schema:
${JSON.stringify(enhancedSchema, null, 2)}

IMPORTANT: For each field in the schema, pay special attention to:
- businessDescription: This explains what the field represents and its business context
- extractorLogic: Follow these detailed instructions on HOW to extract this specific field
- whereToLook: This tells you WHICH document types to search first (e.g., "acord", "sov", "email_body", "loss_run"). 
  When you see whereToLook for a field, prioritize searching in those specific document sections below.
  Document sections are labeled with section names that match the source values exactly (e.g., "=== acord ===", "=== email_body ===").

CRITICAL EXTRACTION GUIDELINES:
1. For fields with whereToLook including "email body" or "email signature": 
   - Search the ENTIRE email body thoroughly, including signatures at the bottom
   - Look for values even if they're not explicitly labeled (e.g., phone numbers, addresses in signatures)
   - Check for patterns like "Name | Title | Phone | Email" in signatures
   - Look for addresses mentioned in the narrative text, not just labeled sections

2. For fields like brokerEmail: Check EMAIL METADATA section first (From field), then email body signature

3. For fields like brokerPhone, mailingAddress: Even if not explicitly labeled, search for:
   - Phone: patterns like (XXX) XXX-XXXX, XXX-XXX-XXXX, or XXX.XXX.XXXX
   - Address: lines with street numbers, city names, state abbreviations, ZIP codes

4. Be thorough: If a field's whereToLook says "email body", search the ENTIRE email body carefully, including:
   - Signature blocks
   - Narrative text
   - Any contact information
   - Addresses mentioned in context

Use the extractorLogic for each field as your primary guide for extraction, and use whereToLook to know which document sections to prioritize.

Return a JSON object with this structure:
{
  "data": {
    "submission": { ... },
    "locations": [ ... ],
    "coverage": { ... },
    "lossHistory": { ... }
  },
  "fieldExtractions": [
    {
      "fieldPath": "submission.namedInsured",
      "fieldName": "namedInsured",
      "fieldValue": "Harborview Manufacturing, LLC",
      "source": "acord",
      "documentChunk": "Named Insured: Harborview Manufacturing, LLC\\nAddress: 1250 Harbor Park Drive",
      "highlightedText": "Named Insured: <mark>Harborview Manufacturing, LLC</mark>\\nAddress: 1250 Harbor Park Drive",
      "chunkStartIndex": 150,
      "chunkEndIndex": 250,
      "llmReasoning": "Found this value in the ACORD 125 form under the 'Named Insured' field. The value was clearly labeled and matched the businessDescription requirement for a legal entity name. I searched the ACORD forms first as indicated in whereToLook, and found an exact match."
    },
    {
      "fieldPath": "submission.submissionId",
      "fieldName": "submissionId",
      "fieldValue": null,
      "source": "other",
      "documentChunk": null,
      "highlightedText": null,
      "chunkStartIndex": null,
      "chunkEndIndex": null,
      "llmReasoning": "I searched through all provided documents (ACORD forms, email body, SOV) for any submission ID or reference number. I looked for patterns like 'Submission ID:', 'Ref:', 'Submission #', but found no such identifier. Based on the extractorLogic, this field should be programmatically generated, not extracted from documents, so null is the expected value here."
    }
  ]
}

For each extracted field:
- fieldPath: The JSON path (e.g., "submission.namedInsured", "locations[0].buildings[0].riskAddress")
- fieldName: The field name without path
- fieldValue: The extracted value (null if not found)
- source: Must match one of the document section labels: "email_body", "acord", "sov", "loss_run", "schedule", "supplemental", or "other". 
  Use the source that matches the document section where you found the value (e.g., if found in "=== ACORD DOCUMENTS (source: "acord") ===", use source: "acord").
- documentChunk: A 200-500 character excerpt from the source document containing the value. 
  Make sure to extract from the document section that matches the field's whereToLook instruction.
- highlightedText: The same chunk with the extracted value wrapped in <mark> tags
- chunkStartIndex: Character position where chunk starts in original document (approximate)
- chunkEndIndex: Character position where chunk ends in original document (approximate)
- llmReasoning: A brief explanation (1-3 sentences) of HOW you found this value, WHAT you looked for, WHERE you found it, and WHY you chose this specific value. Include your thought process, any alternatives you considered, and your confidence level. For null values, explain what you searched for and why you couldn't find it.

CRITICAL: You MUST include fieldExtractions for EVERY SINGLE FIELD in the schema, regardless of whether you found a value or not.

For EVERY field in the schema (including ALL fields with null values in the data object), you MUST provide a complete fieldExtraction entry with:
- fieldPath: The full path (e.g., "submission.submissionId", "locations[0].buildings[0].riskAddress")
- fieldName: The field name without path
- fieldValue: The extracted value OR null if not found
- source: The document type where you searched (even if not found, indicate where you looked)
- llmReasoning: REQUIRED for every field - explain your search process

For fields with null values, your llmReasoning MUST explain:
1. What you searched for (describe the field based on businessDescription and extractorLogic)
2. Where you looked (list the specific document types you checked based on whereToLook)
3. What patterns or keywords you searched for
4. Why you couldn't find it (what was missing, what you expected to see, any similar values you considered but rejected)

Example for a null field:
"llmReasoning": "I searched for a submission ID in the email body and all ACORD forms, looking for patterns like 'Submission ID:', 'Ref #', or 'Submission Number:'. I checked the email subject line and headers, and reviewed all document headers. No submission ID was found in any of the provided documents. Based on the extractorLogic, this field should be programmatically generated rather than extracted from documents."

DO NOT skip any fields. Every field in the schema must have a corresponding entry in fieldExtractions with reasoning.`;

    return prompt;
  }

  /**
   * Build enhanced schema with field definitions (businessDescription, extractorLogic, whereToLook)
   * This is used for the old schema-based approach - kept for backward compatibility
   */
  private buildEnhancedSchema(): any {
    const enhanced = JSON.parse(JSON.stringify(this.fieldSchema)); // Deep copy

    // Helper to recursively add field definitions
    const addFieldDefinitions = (obj: any, path: string = '') => {
      if (!obj || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          if (typeof item === 'object') {
            addFieldDefinitions(item, `${path}[${index}]`);
          }
        });
        return;
      }

      // Check if this is an array type definition
      if (obj.type === 'array' && obj.items) {
        addFieldDefinitions(obj.items, path);
        return;
      }

      // Process object fields
      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = path ? `${path}.${key}` : key;

        if (value && typeof value === 'object') {
          if ('type' in value && typeof value.type === 'string') {
            // This is a field definition - enhance it with database info
            const fieldDef = this.fieldDefinitions.get(key);
            if (fieldDef) {
              // Type assertion to allow adding properties
              const fieldValue = value as any;
              if (fieldDef.businessDescription) {
                fieldValue.businessDescription = fieldDef.businessDescription;
              }
              if (fieldDef.extractorLogic) {
                fieldValue.extractorLogic = fieldDef.extractorLogic;
              }
              if (fieldDef.whereToLook) {
                fieldValue.whereToLook = fieldDef.whereToLook;
                this.logger.debug(
                  `Enhanced field "${key}" with whereToLook: ${fieldDef.whereToLook}`,
                );
              } else if (fieldValue.whereToLook) {
                // Keep existing whereToLook from JSON if no DB override
              }
              // Log when we enhance a field with extractor logic
              if (fieldDef.extractorLogic) {
                this.logger.debug(
                  `Enhanced field "${key}" with extractorLogic (${fieldDef.extractorLogic.substring(0, 50)}...)`,
                );
              }
            } else {
              // Log when a field doesn't have a database definition
              this.logger.debug(
                `Field "${key}" at path "${fieldPath}" not found in fieldDefinitions map`,
              );
            }
          } else {
            // Recurse into nested objects
            addFieldDefinitions(value, fieldPath);
          }
        }
      }
    };

    addFieldDefinitions(enhanced);
    return enhanced;
  }

  /**
   * Build clean output template from schema (no JSON Schema syntax, just the final shape with null placeholders)
   * This is the new approach - provides a clean template the model can fill in
   */
  private buildOutputTemplate(): any {
    const template: any = {
      submission: {},
      locations: [],
      coverage: {},
      lossHistory: {},
    };

    // Helper to convert schema to output template
    const convertToTemplate = (schemaObj: any, outputObj: any): void => {
      if (!schemaObj || typeof schemaObj !== 'object') return;

      // Handle array type definitions at root level
      if (schemaObj.type === 'array' && schemaObj.items) {
        // For arrays, create a single item template
        const itemTemplate: any = {};
        convertToTemplate(schemaObj.items, itemTemplate);
        outputObj.push(itemTemplate);
        return;
      }

      // Process object properties
      for (const [key, value] of Object.entries(schemaObj)) {
        if (!value || typeof value !== 'object') continue;

        if ('type' in value && typeof value.type === 'string') {
          if (value.type === 'array' && 'items' in value) {
            // Array field - create array with one item template
            const itemTemplate: any = {};
            convertToTemplate(value.items, itemTemplate);
            outputObj[key] = [itemTemplate];
          } else {
            // Regular field - set to null as placeholder
            outputObj[key] = null;
          }
        } else {
          // Nested object - recurse
          if (!outputObj[key]) {
            outputObj[key] = {};
          }
          convertToTemplate(value, outputObj[key]);
        }
      }
    };

    // Convert each section
    if (this.fieldSchema.submission) {
      convertToTemplate(this.fieldSchema.submission, template.submission);
    }
    if (
      this.fieldSchema.locations &&
      this.fieldSchema.locations.type === 'array' &&
      this.fieldSchema.locations.items
    ) {
      convertToTemplate(this.fieldSchema.locations, template.locations);
    }
    if (this.fieldSchema.coverage) {
      convertToTemplate(this.fieldSchema.coverage, template.coverage);
    }
    if (this.fieldSchema.lossHistory) {
      convertToTemplate(this.fieldSchema.lossHistory, template.lossHistory);
    }

    return template;
  }

  /**
   * Count fields with extractor logic for logging/debugging
   */
  private countFieldsWithExtractorLogic(schema: any): number {
    let count = 0;

    const countInObject = (obj: any): void => {
      if (!obj || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        obj.forEach((item) => countInObject(item));
        return;
      }

      if (obj.type === 'array' && obj.items) {
        countInObject(obj.items);
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'object') {
          if ('type' in value && typeof value.type === 'string') {
            // This is a field definition
            if ((value as any).extractorLogic) {
              count++;
            }
          } else {
            countInObject(value);
          }
        }
      }
    };

    countInObject(schema);
    return count;
  }

  /**
   * Build extraction prompt with document content
   */
  private buildExtractionPrompt(
    emailData: any,
    documentClassifications: Map<string, string>,
    parsedTexts: Map<string, string>,
  ): string {
    // Log what documents are being included
    const availableDocTypes = Array.from(parsedTexts.keys());
    this.logger.debug(
      `Building extraction prompt with document types: ${availableDocTypes.join(', ')}`,
    );
    // Include email metadata and body - use "email_body" as the source label
    let prompt = `=== email_body ===\n`;
    prompt += `From: ${emailData.from || 'Not available'}\n`;
    prompt += `To: ${Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to || 'Not available'}\n`;
    prompt += `Subject: ${emailData.subject || 'Not available'}\n`;
    prompt += `Date: ${emailData.receivedAt || emailData.date || 'Not available'}\n\n`;
    prompt += `${emailData.body || 'No email body'}\n\n`;

    // Add parsed documents grouped by type - section name matches source value exactly
    const docTypes = [
      'acord',
      'sov',
      'loss_run',
      'schedule',
      'supplemental',
      'other',
    ];

    for (const docType of docTypes) {
      const text = parsedTexts.get(docType);
      if (text) {
        // Section name is exactly the source value (e.g., "=== acord ===")
        // Increased limit from 50k to 200k chars per document type to preserve more context
        const maxChars = 200000;
        const truncated =
          text.length > maxChars
            ? text.substring(0, maxChars) +
              `\n\n[Document truncated - showing first ${maxChars} characters of ${text.length} total]`
            : text;
        prompt += `=== ${docType} ===\n${truncated}\n\n`;
      }
    }

    // Add any unclassified attachments
    for (const att of emailData.attachments || []) {
      const docType = documentClassifications.get(att.id) || 'other';
      if (!parsedTexts.has(docType)) {
        prompt += `=== ${docType} ===\n[Content not yet parsed: ${att.filename}]\n\n`;
      }
    }

    prompt += `\nExtract all fields from the above content according to the schema. 
    
IMPORTANT: The section name (between ===) is exactly the value you must use for "source" in your response.
For example, if you find a value in the "=== acord ===" section, use source: "acord".
If you find a value in the "=== email_body ===" section, use source: "email_body".`;

    return prompt;
  }

  /**
   * Get all field paths from the schema (to ensure we generate extractions for ALL fields)
   */
  private getAllSchemaFields(): Array<{ path: string; name: string }> {
    const fields: Array<{ path: string; name: string }> = [];

    const extractFieldsFromSchema = (obj: any, path: string = '') => {
      if (!obj || typeof obj !== 'object') return;

      // Check if this is an array type definition
      if (obj.type === 'array' && obj.items) {
        // For arrays, we'll generate fields for index [0] as a template
        // The actual array items will be handled when we process extractedData
        extractFieldsFromSchema(obj.items, `${path}[0]`);
        return;
      }

      // Iterate through object properties
      for (const [key, value] of Object.entries(obj)) {
        if (!value || typeof value !== 'object') continue;

        const currentPath = path ? `${path}.${key}` : key;

        // Check if this is a field definition (has 'type' property)
        if ('type' in value && typeof value.type === 'string') {
          // Check if it's an array type with items
          if (value.type === 'array' && 'items' in value && value.items) {
            // This is an array field - recurse into items
            extractFieldsFromSchema(value.items as any, `${currentPath}[0]`);
          } else {
            // This is a regular field definition - add it
            fields.push({ path: currentPath, name: key });
          }
        } else {
          // Nested object (not a field definition) - recurse
          extractFieldsFromSchema(value, currentPath);
        }
      }
    };

    // Process each section of the schema separately
    if (this.fieldSchema.submission) {
      extractFieldsFromSchema(this.fieldSchema.submission, 'submission');
    }
    if (this.fieldSchema.locations) {
      extractFieldsFromSchema(this.fieldSchema.locations, 'locations[0]');
    }
    if (this.fieldSchema.coverage) {
      extractFieldsFromSchema(this.fieldSchema.coverage, 'coverage');
    }
    if (this.fieldSchema.lossHistory) {
      extractFieldsFromSchema(this.fieldSchema.lossHistory, 'lossHistory');
    }

    this.logger.log(
      `getAllSchemaFields found ${fields.length} fields in schema`,
    );
    return fields;
  }

  /**
   * Get value from nested object by path (e.g., "submission.namedInsured" or "locations[0].buildings[0].riskAddress")
   */
  private getValueByPath(obj: any, path: string): any {
    const parts = path.split(/[\.\[\]]/).filter((p) => p);
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return null;
      if (Array.isArray(current)) {
        const index = parseInt(part, 10);
        if (isNaN(index)) return null;
        current = current[index];
      } else if (typeof current === 'object') {
        current = current[part];
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * Set value in nested object by path, creating structure as needed
   * Handles paths like "submission.namedInsured" or "locations[0].buildings[0].riskAddress"
   */
  private setValueByPath(obj: any, path: string, value: any): void {
    // Parse path properly handling both dots and brackets
    const parts: Array<{ key: string; index?: number }> = [];
    let current = '';
    let i = 0;

    while (i < path.length) {
      if (path[i] === '.') {
        if (current) {
          parts.push({ key: current });
          current = '';
        }
        i++;
      } else if (path[i] === '[') {
        if (current) {
          parts.push({ key: current });
          current = '';
        }
        i++;
        // Read index until ']'
        let indexStr = '';
        while (i < path.length && path[i] !== ']') {
          indexStr += path[i];
          i++;
        }
        if (indexStr && !isNaN(parseInt(indexStr, 10))) {
          const prevPart = parts[parts.length - 1];
          if (prevPart) {
            prevPart.index = parseInt(indexStr, 10);
          }
        }
        i++; // Skip ']'
      } else {
        current += path[i];
        i++;
      }
    }

    // Add last part
    if (current) {
      parts.push({ key: current });
    }

    // Navigate/create structure
    let currentObj = obj;
    for (let j = 0; j < parts.length - 1; j++) {
      const part = parts[j];

      if (part.index !== undefined) {
        // Array access
        if (!currentObj[part.key] || !Array.isArray(currentObj[part.key])) {
          currentObj[part.key] = [];
        }
        // Ensure array is large enough
        while (currentObj[part.key].length <= part.index) {
          currentObj[part.key].push({});
        }
        if (
          !currentObj[part.key][part.index] ||
          typeof currentObj[part.key][part.index] !== 'object'
        ) {
          currentObj[part.key][part.index] = {};
        }
        currentObj = currentObj[part.key][part.index];
      } else {
        // Object property
        if (
          !currentObj[part.key] ||
          typeof currentObj[part.key] !== 'object' ||
          Array.isArray(currentObj[part.key])
        ) {
          currentObj[part.key] = {};
        }
        currentObj = currentObj[part.key];
      }
    }

    // Set the final value
    const lastPart = parts[parts.length - 1];
    if (lastPart.index !== undefined) {
      // Final value is in an array
      if (
        !currentObj[lastPart.key] ||
        !Array.isArray(currentObj[lastPart.key])
      ) {
        currentObj[lastPart.key] = [];
      }
      while (currentObj[lastPart.key].length <= lastPart.index) {
        currentObj[lastPart.key].push(null);
      }
      currentObj[lastPart.key][lastPart.index] = value;
    } else {
      // Final value is a property
      currentObj[lastPart.key] = value;
    }
  }

  /**
   * Extract a single field with its own dedicated LLM call
   * Includes: businessDescription, extractorLogic, whereToLook, and all documents
   */
  private async extractSingleField(
    schemaField: { path: string; name: string },
    emailData: any,
    documentClassifications: Map<string, string>,
    parsedTexts: Map<string, string>,
  ): Promise<{
    fieldPath: string;
    fieldName: string;
    fieldValue: any;
    source: string;
    documentId?: string;
    documentChunk?: string;
    highlightedText?: string;
    chunkStartIndex?: number;
    chunkEndIndex?: number;
    llmReasoning?: string;
    llmResponse?: string;
  }> {
    // Get field definition from database
    const fieldDef = this.fieldDefinitions.get(schemaField.name);

    // Build single-field system prompt
    const systemPrompt = this.buildSingleFieldSystemPrompt(
      schemaField,
      fieldDef,
    );

    // Build user prompt with all documents
    const userPrompt = this.buildExtractionPrompt(
      emailData,
      documentClassifications,
      parsedTexts,
    );

    // Add field-specific instruction
    const fieldSpecificPrompt = `${userPrompt}\n\nEXTRACT THIS SPECIFIC FIELD:\nField Path: ${schemaField.path}\nField Name: ${schemaField.name}\n\nReturn a JSON object with this structure:\n{\n  "fieldValue": <extracted value or null>,\n  "source": "<document section where found>",\n  "documentChunk": "<200-500 char excerpt containing the value>",\n  "llmReasoning": "<explanation of extraction process>"\n}`;

    // Retry logic for rate limits
    let retries = 3;
    let delay = 1000; // Start with 1 second delay

    while (retries > 0) {
      try {
        const response = await this.openai.chat.completions.create({
          model: this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: fieldSpecificPrompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        });

        const responseContent = response.choices[0].message.content || '{}';
        const responseData = JSON.parse(responseContent);

        const fieldValue = responseData.fieldValue ?? null;
        const hasValue =
          fieldValue !== null && fieldValue !== undefined && fieldValue !== '';

        if (hasValue) {
          this.logger.log(
            `✓ Extracted ${schemaField.path}: ${JSON.stringify(fieldValue)} (source: ${responseData.source || 'other'})`,
          );
        } else {
          this.logger.debug(
            `✗ No value found for ${schemaField.path} (source: ${responseData.source || 'other'})`,
          );
        }

        return {
          fieldPath: schemaField.path,
          fieldName: schemaField.name,
          fieldValue: fieldValue,
          source: responseData.source || 'other',
          documentChunk: responseData.documentChunk || undefined,
          highlightedText: responseData.documentChunk
            ? `<mark>${responseData.fieldValue}</mark>`
            : undefined,
          llmReasoning: responseData.llmReasoning || undefined,
          llmResponse: responseContent,
        };
      } catch (error: any) {
        // Handle rate limits with retry
        if (error?.status === 429 && retries > 0) {
          const retryAfter = error.headers?.['retry-after-ms']
            ? parseInt(error.headers['retry-after-ms'], 10)
            : delay;
          this.logger.warn(
            `Rate limit hit for ${schemaField.path}, retrying in ${retryAfter}ms (${retries} retries left)`,
          );
          await new Promise((resolve) => setTimeout(resolve, retryAfter));
          retries--;
          delay *= 2; // Exponential backoff
          continue;
        }

        this.logger.error(
          `Error in single field extraction for ${schemaField.path}:`,
          error,
        );
        throw error;
      }
    }

    // If we exhausted retries, throw the last error
    throw new Error('Failed to extract field after retries');
  }

  /**
   * Build system prompt for a single field extraction
   */
  private buildSingleFieldSystemPrompt(
    schemaField: { path: string; name: string },
    fieldDef?: FieldDefinitionInfo,
  ): string {
    let prompt = `You are an expert at extracting a single field from commercial property insurance submission documents.

FIELD TO EXTRACT:
Field Path: ${schemaField.path}
Field Name: ${schemaField.name}`;

    if (fieldDef) {
      if (fieldDef.businessDescription) {
        prompt += `\n\nBusiness Description:\n${fieldDef.businessDescription}`;
      }
      if (fieldDef.extractorLogic) {
        prompt += `\n\nExtraction Logic:\n${fieldDef.extractorLogic}`;
      }
      if (fieldDef.whereToLook) {
        prompt += `\n\nWhere to Look:\n${fieldDef.whereToLook}`;
      }
    }

    prompt += `\n\nCRITICAL EXTRACTION STRATEGY:
1. FIRST: Check the document sections specified in "Where to Look" (if provided)
   - These are the most likely places to find the value
   - Search thoroughly in these sections first
2. IF NOT FOUND: Then search ALL other available document sections
   - Don't give up after checking "Where to Look" sections
   - Continue searching in all other document types (acord, sov, loss_run, schedule, supplemental, email_body, other)
   - The value might be in an unexpected location

Return a JSON object with:
- fieldValue: The extracted value (or null if not found)
- source: The document section where you found it (or "other" if not found)
- documentChunk: A 200-500 character excerpt from the source document containing the value (or null if not found)
- llmReasoning: A brief explanation of:
  * What extraction logic you used
  * Where you searched (list all document sections you checked)
  * What patterns or keywords you looked for
  * Why you chose this value (or why you couldn't find it)

Be thorough and check ALL available document sections before returning null.`;

    return prompt;
  }

  /**
   * Add LLM reasoning for ALL fields (both extracted and null)
   * This helps understand what logic was used, where it searched, and why it found (or didn't find) a value
   */
  private async addReasoningForAllFields(
    fieldExtractions: Array<{
      fieldPath: string;
      fieldName: string;
      fieldValue: any;
      source: string;
      documentId?: string;
      documentChunk?: string;
      highlightedText?: string;
      chunkStartIndex?: number;
      chunkEndIndex?: number;
      llmReasoning?: string;
    }>,
    extractedData: any,
    emailData: any,
    documentClassifications: Map<string, string>,
    parsedTexts: Map<string, string>,
  ): Promise<
    Array<{
      fieldPath: string;
      fieldName: string;
      fieldValue: any;
      source: string;
      documentId?: string;
      documentChunk?: string;
      highlightedText?: string;
      chunkStartIndex?: number;
      chunkEndIndex?: number;
      llmReasoning?: string;
    }>
  > {
    if (fieldExtractions.length === 0) {
      this.logger.log('No fields found, skipping reasoning generation');
      return fieldExtractions;
    }

    this.logger.log(
      `Getting LLM reasoning for ${fieldExtractions.length} fields (both extracted and null)`,
    );

    // Build a prompt asking for reasoning on all fields
    const allFieldsPrompt = this.buildAllFieldsReasoningPrompt(
      fieldExtractions,
      extractedData,
      emailData,
      documentClassifications,
      parsedTexts,
    );

    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are helping debug field extraction. For each field listed, explain:
1. What extraction logic you used (based on the field's businessDescription and extractorLogic)
2. Where you searched:
   - FIRST: Which documents you checked from "Where to Look" (if provided)
   - THEN: Which other documents you checked if not found in the prioritized documents
   - List ALL document sections you searched (acord, sov, loss_run, schedule, supplemental, email_body, other)
3. What patterns or keywords you looked for
4. For extracted fields: Why you chose this specific value, which document section you found it in, and whether it was in the "Where to Look" section or elsewhere
5. For null fields: Why you couldn't find a value after searching all document sections (what was missing, what you expected to see)

Be concise but specific. Return JSON with fieldPath as key and reasoning as value.`,
          },
          {
            role: 'user',
            content: allFieldsPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const responseContent = response.choices[0].message.content || '{}';
      const reasoningMap = JSON.parse(responseContent);

      // Merge reasoning into field extractions
      const updatedExtractions = fieldExtractions.map((fe) => {
        const reasoning =
          reasoningMap[fe.fieldPath] || reasoningMap[fe.fieldName];
        if (reasoning) {
          return { ...fe, llmReasoning: reasoning };
        }
        return fe;
      });

      return updatedExtractions;
    } catch (error: any) {
      this.logger.warn(
        `Failed to get LLM reasoning for all fields: ${error.message}`,
      );
      // Return original extractions if reasoning fails
      return fieldExtractions;
    }
  }

  /**
   * Build prompt for getting reasoning on all fields (extracted and null)
   */
  private buildAllFieldsReasoningPrompt(
    fieldExtractions: Array<{
      fieldPath: string;
      fieldName: string;
      fieldValue: any;
    }>,
    extractedData: any,
    emailData: any,
    documentClassifications: Map<string, string>,
    parsedTexts: Map<string, string>,
  ): string {
    // Get field definitions and current values for all fields
    const fieldDefs: string[] = [];
    for (const field of fieldExtractions) {
      const fieldDef = this.fieldDefinitions.get(field.fieldName);
      const currentValue = field.fieldValue;
      const valueStatus =
        currentValue === null ||
        currentValue === undefined ||
        currentValue === ''
          ? 'NULL (not extracted)'
          : `EXTRACTED: "${currentValue}"`;

      let defText = `\n${field.fieldPath}: ${valueStatus}`;
      if (fieldDef) {
        if (fieldDef.businessDescription) {
          defText += `\n  Business Description: ${fieldDef.businessDescription}`;
        }
        if (fieldDef.extractorLogic) {
          defText += `\n  Extraction Logic: ${fieldDef.extractorLogic}`;
        }
        if (fieldDef.whereToLook) {
          defText += `\n  Where to Look: ${fieldDef.whereToLook}`;
        }
      }
      fieldDefs.push(defText);
    }

    let prompt = `The following fields were extracted (some successfully, some returned null). For EACH field, explain:
1. What extraction logic you used
2. Where you searched
3. What patterns or keywords you looked for
4. For extracted fields: Why you chose this specific value and where you found it
5. For null fields: Why you couldn't find a value

FIELDS TO EXPLAIN:\n${fieldDefs.join('\n')}\n\n`;

    // Include document content for context
    prompt += `DOCUMENT CONTENT:\n`;
    prompt += `=== email_body ===\n`;
    prompt += `From: ${emailData.from || 'N/A'}\n`;
    prompt += `To: ${emailData.to || 'N/A'}\n`;
    prompt += `Subject: ${emailData.subject || 'N/A'}\n`;
    prompt += `${emailData.body || 'No email body'}\n\n`;

    const docTypes = [
      'acord',
      'sov',
      'loss_run',
      'schedule',
      'supplemental',
      'other',
    ];
    for (const docType of docTypes) {
      const text = parsedTexts.get(docType);
      if (text) {
        const maxChars = 50000; // Smaller chunk for reasoning prompt
        const truncated =
          text.length > maxChars
            ? text.substring(0, maxChars) +
              `\n\n[Document truncated - showing first ${maxChars} characters]`
            : text;
        prompt += `=== ${docType} ===\n${truncated}\n\n`;
      }
    }

    prompt += `\nReturn a JSON object where each key is a fieldPath and the value is your reasoning for that field.

For EXTRACTED fields, explain what you found and why:
Example:
{
  "submission.namedInsured": "I first searched the ACORD forms and email body as indicated in whereToLook. I found 'Greenway Plaza, LLC' in the ACORD 125 form under the 'Named Insured' field (found in prioritized section). The value was clearly labeled and matched the businessDescription requirement for a legal entity name. I also verified this name appears in the loss runs.",
  "locations[0].buildings[0].riskAddress": "I first searched the SOV document as indicated in whereToLook. I found the address in the SOV row: '2100 Greenway Plaza Drive, Austin, TX 78759' (found in prioritized section). I concatenated the Address, City, State, and Zip columns to form the complete address.",
  "submission.brokerEmail": "I first checked email headers as indicated in whereToLook, but didn't find a broker email there. I then searched all other document sections (email body, ACORD, SOV, loss runs) and found the email 'jordan.lee@example.com' in the email body signature section (found in secondary search)."
}

For NULL fields, explain what you searched for and why you couldn't find it:
Example:
{
  "submission.carrierName": "I first searched the email body, email signature, and ACORD headers as indicated in whereToLook. I looked for patterns like 'Carrier:', 'Insurance Company:', or company names in headers. I then searched all other document sections (SOV, loss runs, schedule, supplemental). I found 'Central States Property Insurance Co.' in the loss runs, but that appears to be the prior carrier, not the target market carrier. After searching all available documents, no target carrier name was found.",
  "submission.brokerPhone": "I first searched the email signature and body as indicated in whereToLook for phone number patterns like (XXX) XXX-XXXX, XXX-XXX-XXXX, or XXX.XXX.XXXX. I then searched all other document sections (ACORD, SOV, loss runs, schedule, supplemental). After checking all available documents, no phone number matching these patterns was found."
}`;

    return prompt;
  }

  /**
   * Generate field extractions from extracted data by finding source chunks
   * Now generates extractions for ALL fields in the schema, not just ones with values
   */
  private async generateFieldExtractions(
    extractedData: any,
    emailData: any,
    attachmentTextMap: Map<string, { text: string; docType: string }>,
    documentClassifications: Map<string, string>,
  ): Promise<
    Array<{
      fieldPath: string;
      fieldName: string;
      fieldValue: any;
      source: string;
      documentId?: string;
      documentChunk?: string;
      highlightedText?: string;
      chunkStartIndex?: number;
      chunkEndIndex?: number;
      llmReasoning?: string;
    }>
  > {
    const fieldExtractions: Array<{
      fieldPath: string;
      fieldName: string;
      fieldValue: any;
      source: string;
      documentId?: string;
      documentChunk?: string;
      highlightedText?: string;
      chunkStartIndex?: number;
      chunkEndIndex?: number;
      llmReasoning?: string;
    }> = [];

    // Get ALL fields from schema (not just ones in extractedData)
    const schemaFields = this.getAllSchemaFields();

    // Also get fields from extractedData to handle array indices properly
    const flattenObject = (
      obj: any,
      prefix = '',
      path = '',
    ): Array<{ path: string; name: string; value: any }> => {
      const fields: Array<{ path: string; name: string; value: any }> = [];

      for (const key in obj) {
        const currentPath = path ? `${path}.${key}` : key;
        const value = obj[key];

        if (value === null || value === undefined) {
          fields.push({ path: currentPath, name: key, value: null });
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              fields.push(
                ...flattenObject(
                  item,
                  `${currentPath}[${index}]`,
                  `${currentPath}[${index}]`,
                ),
              );
            } else {
              fields.push({
                path: `${currentPath}[${index}]`,
                name: key,
                value: item,
              });
            }
          });
        } else if (typeof value === 'object') {
          fields.push(...flattenObject(value, currentPath, currentPath));
        } else {
          fields.push({ path: currentPath, name: key, value });
        }
      }

      return fields;
    };

    const extractedFields = flattenObject(extractedData);
    const extractedFieldsMap = new Map<string, any>();
    for (const field of extractedFields) {
      extractedFieldsMap.set(field.path, field.value);
    }

    // Process ALL schema fields
    const allFieldsToProcess = new Set<string>();

    // Add all schema fields
    for (const schemaField of schemaFields) {
      allFieldsToProcess.add(schemaField.path);

      // For array fields, also check if there are actual array items in extractedData
      if (schemaField.path.includes('[0]')) {
        const basePath = schemaField.path.replace('[0]', '');
        const arrayValue = this.getValueByPath(extractedData, basePath);
        if (Array.isArray(arrayValue)) {
          // Generate fields for each array item
          for (let i = 0; i < arrayValue.length; i++) {
            const itemPath = schemaField.path.replace('[0]', `[${i}]`);
            allFieldsToProcess.add(itemPath);
          }
        }
      }
    }

    // Also add any fields from extractedData that aren't in schema (for backwards compatibility)
    for (const field of extractedFields) {
      allFieldsToProcess.add(field.path);
    }

    // Process ALL fields (from schema + extracted data)
    for (const fieldPath of allFieldsToProcess) {
      // Get field name from path
      const pathParts = fieldPath.split(/[\.\[\]]/).filter((p) => p);
      const fieldName = pathParts[pathParts.length - 1] || fieldPath;

      // Get value from extractedData (or null if not present)
      const fieldValue =
        extractedFieldsMap.get(fieldPath) ??
        this.getValueByPath(extractedData, fieldPath) ??
        null;

      // Create field object for processing
      const field = { path: fieldPath, name: fieldName, value: fieldValue };

      if (
        field.value === null ||
        field.value === undefined ||
        field.value === ''
      ) {
        // Create extraction record for null values WITHOUT chunks (no value found, nothing to show)
        fieldExtractions.push({
          fieldPath: field.path,
          fieldName: field.name,
          fieldValue: null,
          source: 'email_body', // Default source for attribution, but no chunk since no value was found
        });
        continue;
      }

      const searchValue = String(field.value).toLowerCase();
      // Also try normalized versions (remove commas, dollar signs, etc.)
      const normalizedValue = searchValue.replace(/[,$%]/g, '').trim();
      let found = false;
      let bestMatch: {
        source: string;
        chunk: ReturnType<typeof this.extractChunk>;
        documentId?: string;
      } | null = null;

      // Search in email body first
      if (emailData.body) {
        const bodyLower = emailData.body.toLowerCase();
        let index = bodyLower.indexOf(searchValue);

        // If exact match not found, try normalized search
        if (index === -1 && normalizedValue) {
          const bodyNormalized = bodyLower.replace(/[,$%]/g, '');
          const normalizedIndex = bodyNormalized.indexOf(normalizedValue);
          if (normalizedIndex !== -1) {
            // Map back to original text position (approximate)
            index = this.findApproximatePosition(
              emailData.body,
              normalizedIndex,
              normalizedValue.length,
            );
          }
        }

        // If still not found, try searching for field name near the value
        if (index === -1) {
          const fieldNamePattern = new RegExp(
            this.escapeRegex(
              field.name.replace(/([A-Z])/g, ' $1').toLowerCase(),
            ),
            'i',
          );
          const fieldNameMatch = emailData.body.match(fieldNamePattern);
          if (fieldNameMatch && fieldNameMatch.index !== undefined) {
            // Extract chunk around field name
            index = fieldNameMatch.index;
          }
        }

        if (index !== -1) {
          const chunk = this.extractChunk(
            emailData.body,
            index,
            searchValue.length || 50,
          );
          bestMatch = { source: 'email_body', chunk };
          found = true;
        }
      }

      // Search in attachments if not found in email body
      if (!found) {
        for (const [
          attachmentId,
          { text, docType },
        ] of attachmentTextMap.entries()) {
          const textLower = text.toLowerCase();
          let index = textLower.indexOf(searchValue);

          // If exact match not found, try normalized search
          if (index === -1 && normalizedValue) {
            const textNormalized = textLower.replace(/[,$%]/g, '');
            const normalizedIndex = textNormalized.indexOf(normalizedValue);
            if (normalizedIndex !== -1) {
              index = this.findApproximatePosition(
                text,
                normalizedIndex,
                normalizedValue.length,
              );
            }
          }

          // If still not found, try searching for field name
          if (index === -1) {
            const fieldNamePattern = new RegExp(
              this.escapeRegex(
                field.name.replace(/([A-Z])/g, ' $1').toLowerCase(),
              ),
              'i',
            );
            const fieldNameMatch = text.match(fieldNamePattern);
            if (fieldNameMatch && fieldNameMatch.index !== undefined) {
              index = fieldNameMatch.index;
            }
          }

          if (index !== -1) {
            const chunk = this.extractChunk(
              text,
              index,
              searchValue.length || 50,
            );
            bestMatch = { source: docType, chunk, documentId: attachmentId };
            found = true;
            break;
          }
        }
      }

      // Create extraction record - always include a chunk if we found something
      if (bestMatch) {
        fieldExtractions.push({
          fieldPath: field.path,
          fieldName: field.name,
          fieldValue: field.value,
          source: bestMatch.source,
          documentId: bestMatch.documentId,
          documentChunk: bestMatch.chunk.text,
          highlightedText: bestMatch.chunk.highlighted,
          chunkStartIndex: bestMatch.chunk.startIndex,
          chunkEndIndex: bestMatch.chunk.endIndex,
        });
      } else {
        // If not found anywhere, still create record with email_body as default source
        // ALWAYS try to extract a chunk from email body so fields are clickable
        let defaultChunk: ReturnType<typeof this.extractChunk> | null = null;
        if (emailData.body) {
          // First, try to find the field value in email body (case-insensitive, normalized)
          const valueStr = String(field.value);
          const bodyLower = emailData.body.toLowerCase();
          const valueLower = valueStr.toLowerCase();
          let valueIndex = bodyLower.indexOf(valueLower);

          // If value not found, try normalized search
          if (valueIndex === -1 && valueStr) {
            const normalizedValue = valueLower.replace(/[,$%]/g, '').trim();
            if (normalizedValue) {
              const bodyNormalized = bodyLower.replace(/[,$%]/g, '');
              const normalizedIndex = bodyNormalized.indexOf(normalizedValue);
              if (normalizedIndex !== -1) {
                valueIndex = this.findApproximatePosition(
                  emailData.body,
                  normalizedIndex,
                  normalizedValue.length,
                );
              }
            }
          }

          // If value found, extract chunk around it
          if (valueIndex !== -1) {
            defaultChunk = this.extractChunk(
              emailData.body,
              valueIndex,
              valueStr.length,
            );
          } else {
            // Try to find field name in email body
            const fieldNamePattern = new RegExp(
              this.escapeRegex(
                field.name.replace(/([A-Z])/g, ' $1').toLowerCase(),
              ),
              'i',
            );
            const fieldNameMatch = emailData.body.match(fieldNamePattern);
            if (fieldNameMatch && fieldNameMatch.index !== undefined) {
              defaultChunk = this.extractChunk(
                emailData.body,
                fieldNameMatch.index,
                50,
              );
            } else {
              // Extract a general chunk from the beginning of email body
              defaultChunk = this.extractChunk(emailData.body, 0, 200);
            }
          }
        }

        const extractionRecord: {
          fieldPath: string;
          fieldName: string;
          fieldValue: any;
          source: string;
          documentChunk?: string;
          highlightedText?: string;
          chunkStartIndex?: number;
          chunkEndIndex?: number;
        } = {
          fieldPath: field.path,
          fieldName: field.name,
          fieldValue: field.value,
          source: 'email_body', // Default
        };

        // Always include chunk if email body exists
        if (defaultChunk) {
          extractionRecord.documentChunk = defaultChunk.text;
          // Try to highlight the value in the chunk
          const valueStr = String(field.value);
          if (
            valueStr &&
            defaultChunk.text.toLowerCase().includes(valueStr.toLowerCase())
          ) {
            extractionRecord.highlightedText = defaultChunk.text.replace(
              new RegExp(this.escapeRegex(valueStr), 'gi'),
              (match) => `<mark>${match}</mark>`,
            );
          } else {
            // If value not in chunk, just use the chunk as-is
            extractionRecord.highlightedText = defaultChunk.highlighted;
          }
          extractionRecord.chunkStartIndex = defaultChunk.startIndex;
          extractionRecord.chunkEndIndex = defaultChunk.endIndex;
        } else if (emailData.body) {
          // Fallback: if we somehow don't have a chunk but have email body, create a minimal one
          const minimalChunk = this.extractChunk(emailData.body, 0, 200);
          extractionRecord.documentChunk = minimalChunk.text;
          extractionRecord.highlightedText = minimalChunk.highlighted;
          extractionRecord.chunkStartIndex = minimalChunk.startIndex;
          extractionRecord.chunkEndIndex = minimalChunk.endIndex;
        }

        fieldExtractions.push(extractionRecord);
      }
    }

    return fieldExtractions;
  }

  /**
   * Extract a chunk of text around a found value
   */
  private extractChunk(
    fullText: string,
    valueIndex: number,
    valueLength: number,
  ): {
    text: string;
    highlighted: string;
    startIndex: number;
    endIndex: number;
  } {
    const contextSize = 200; // Characters before and after
    const startIndex = Math.max(0, valueIndex - contextSize);
    const endIndex = Math.min(
      fullText.length,
      valueIndex + valueLength + contextSize,
    );

    const chunk = fullText.substring(startIndex, endIndex);
    const valueInChunk = fullText.substring(
      valueIndex,
      valueIndex + valueLength,
    );
    const highlighted = chunk.replace(
      new RegExp(this.escapeRegex(valueInChunk), 'gi'),
      (match) => `<mark>${match}</mark>`,
    );

    return {
      text: chunk,
      highlighted,
      startIndex,
      endIndex,
    };
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Find approximate position in original text after normalization
   * This is a helper to map normalized positions back to original text
   */
  private findApproximatePosition(
    originalText: string,
    normalizedIndex: number,
    length: number,
  ): number {
    // Simple approach: count characters in original text, skipping special chars
    let normalizedCount = 0;
    for (let i = 0; i < originalText.length; i++) {
      const char = originalText[i];
      if (!/[,$%]/.test(char)) {
        if (normalizedCount === normalizedIndex) {
          return i;
        }
        normalizedCount++;
      }
    }
    // Fallback: return normalized index if mapping fails
    return Math.min(normalizedIndex, originalText.length - 1);
  }

  /**
   * Fallback extraction when OpenAI API is unavailable
   * Uses simple pattern matching and keyword extraction
   */
  private async fallbackExtraction(
    emailData: any,
    documentClassifications: Map<string, string>,
    parsedTexts: Map<string, string>,
  ): Promise<{
    data: any;
    fieldExtractions: Array<any>;
    llmPrompt?: string | null;
    llmResponse?: string | null;
  }> {
    this.logger.log('Using fallback extraction (no LLM)');

    const extracted: any = {
      submission: {},
      locations: [],
      coverage: {},
      lossHistory: {},
    };

    // Combine all text for searching
    const allText = [emailData.body || '', ...Array.from(parsedTexts.values())]
      .join('\n\n')
      .toLowerCase();

    // Simple pattern matching for common fields
    const patterns: Record<string, RegExp> = {
      namedInsured:
        /(?:named\s+insured|insured\s+name|company\s+name)[\s:]+([^\n]+)/i,
      carrierName: /(?:carrier|insurance\s+company|insurer)[\s:]+([^\n]+)/i,
      brokerName: /(?:broker|agent)[\s:]+([^\n]+)/i,
      effectiveDate: /(?:effective\s+date|policy\s+start)[\s:]+([^\n]+)/i,
      expirationDate:
        /(?:expiration\s+date|expiry|policy\s+end)[\s:]+([^\n]+)/i,
    };

    for (const [field, pattern] of Object.entries(patterns)) {
      const match = allText.match(pattern);
      if (match && match[1]) {
        extracted.submission[field] = match[1].trim();
      }
    }

    // Extract building square footage
    const sqftMatch = allText.match(
      /(\d+(?:,\d+)*)\s*(?:sq\s*ft|square\s*feet|sf)/i,
    );
    if (sqftMatch) {
      extracted.locations = [
        {
          locationNumber: 1,
          buildings: [
            {
              buildingNumber: 1,
              buildingSqFt: parseInt(sqftMatch[1].replace(/,/g, ''), 10),
            },
          ],
        },
      ];
    }

    // Extract building limit
    const limitMatch = allText.match(
      /\$(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:building\s+limit|coverage\s+limit)/i,
    );
    if (limitMatch) {
      extracted.coverage.buildingLimit = parseFloat(
        limitMatch[1].replace(/,/g, ''),
      );
    }

    // Generate field extractions for fallback
    const attachmentTextMap = new Map<
      string,
      { text: string; docType: string }
    >();
    for (const [docType, text] of parsedTexts.entries()) {
      // For fallback, we don't have individual attachment mapping, so use docType as key
      attachmentTextMap.set(docType, { text, docType });
    }

    const fieldExtractions = await this.generateFieldExtractions(
      extracted,
      emailData,
      attachmentTextMap,
      documentClassifications,
    );

    this.logger.log('Fallback extraction completed with basic fields');
    return {
      data: extracted,
      fieldExtractions,
      llmPrompt: undefined, // Fallback doesn't use LLM
      llmResponse: undefined,
    };
  }

  /**
   * Default field schema (will be replaced with full schema from spec)
   */
  private getDefaultSchema(): any {
    return {
      submission: {
        submissionId: 'string',
        carrierName: 'string',
        brokerName: 'string',
        namedInsured: 'string',
        effectiveDate: 'date',
        expirationDate: 'date',
      },
      locations: {
        type: 'array',
        items: {
          locationNumber: 'number',
          buildings: {
            type: 'array',
            items: {
              buildingNumber: 'number',
              riskAddress: 'string',
              buildingSqFt: 'number',
              constructionType: 'string',
            },
          },
        },
      },
    };
  }
}
