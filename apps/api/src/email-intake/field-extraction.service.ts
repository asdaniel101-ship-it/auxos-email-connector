import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class FieldExtractionService {
  private readonly logger = new Logger(FieldExtractionService.name);
  private openai: any;
  private fieldSchema: any;

  constructor(
    private configService: ConfigService,
    private documentParser: DocumentParserService,
    private prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey || !OpenAI) {
      this.logger.warn('OPENAI_API_KEY not set or OpenAI not installed - field extraction will not work');
    } else {
      this.openai = new OpenAI({ apiKey });
    }

    // Load field schema
    this.loadFieldSchema();
  }

  /**
   * Load field schema from JSON file
   */
  private loadFieldSchema() {
    try {
      const schemaPath = path.join(__dirname, '../../field-schema.json');
      if (fs.existsSync(schemaPath)) {
        this.fieldSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
      } else {
        this.logger.warn('field-schema.json not found, using default schema');
        this.fieldSchema = this.getDefaultSchema();
      }
    } catch (error) {
      this.logger.error('Error loading field schema:', error);
      this.fieldSchema = this.getDefaultSchema();
    }
  }

  /**
   * Extract fields from email and documents using LLM
   * Returns both extracted data and field extractions with document chunks
   */
  async extract(emailData: any, documentClassifications: Map<string, string>): Promise<{
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
    }>;
  }> {
    this.logger.log('Starting field extraction...');

    // Parse all documents and store full text by attachment ID
    const parsedTexts = await this.documentParser.parseAllDocuments(
      emailData.attachments || [],
      documentClassifications,
    );

    // Build a map of attachment ID to full parsed text
    // Note: parseAllDocuments groups by docType, so we need to parse individually for proper mapping
    const attachmentTextMap = new Map<string, { text: string; docType: string }>();
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
    const extractionPrompt = this.buildExtractionPrompt(emailData, documentClassifications, parsedTexts);

    if (!this.openai) {
      throw new Error('OpenAI API not configured');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.buildSystemPromptWithChunks(),
          },
          {
            role: 'user',
            content: extractionPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const responseData = JSON.parse(response.choices[0].message.content || '{}');
      const extractedData = responseData.data || responseData;
      
      // Always generate field extractions for ALL fields to ensure every field has a source
      // The LLM might only provide extractions for fields with values, but we want ALL fields
      const llmFieldExtractions = responseData.fieldExtractions || [];
      const allFieldExtractions = await this.generateFieldExtractions(
        extractedData, 
        emailData, 
        attachmentTextMap, 
        documentClassifications
      );
      
      // Merge LLM extractions with generated ones, preferring LLM chunks if available
      const mergedExtractions = new Map<string, typeof allFieldExtractions[0]>();
      
      // First, add all generated extractions (covers ALL fields)
      for (const fe of allFieldExtractions) {
        mergedExtractions.set(fe.fieldPath, fe);
      }
      
      // Then, override with LLM extractions if they have better chunks
      for (const llmFe of llmFieldExtractions) {
        const existing = mergedExtractions.get(llmFe.fieldPath);
        if (existing) {
          // Prefer LLM extraction if it has a chunk and existing doesn't
          if (llmFe.documentChunk && !existing.documentChunk) {
            mergedExtractions.set(llmFe.fieldPath, llmFe);
          } else if (llmFe.documentChunk && existing.documentChunk) {
            // Both have chunks, prefer LLM one
            mergedExtractions.set(llmFe.fieldPath, llmFe);
          }
          // If LLM doesn't have chunk but existing does, keep existing (don't override)
        } else {
          // LLM provided an extraction we don't have
          // If it doesn't have a chunk and source is email_body, try to create one
          if (!llmFe.documentChunk && llmFe.source === 'email_body' && emailData.body) {
            const valueStr = String(llmFe.fieldValue || '');
            const bodyLower = emailData.body.toLowerCase();
            let valueIndex = valueStr ? bodyLower.indexOf(valueStr.toLowerCase()) : -1;
            
            if (valueIndex === -1) {
              // Try to find field name
              const fieldNamePattern = new RegExp(
                this.escapeRegex(llmFe.fieldName.replace(/([A-Z])/g, ' $1').toLowerCase()),
                'i'
              );
              const fieldNameMatch = emailData.body.match(fieldNamePattern);
              if (fieldNameMatch && fieldNameMatch.index !== undefined) {
                valueIndex = fieldNameMatch.index;
              }
            }
            
            const chunkIndex = valueIndex !== -1 ? valueIndex : 0;
            const chunk = this.extractChunk(emailData.body, chunkIndex, valueStr.length || 200);
            llmFe.documentChunk = chunk.text;
            llmFe.highlightedText = chunk.highlighted;
            llmFe.chunkStartIndex = chunk.startIndex;
            llmFe.chunkEndIndex = chunk.endIndex;
          }
          mergedExtractions.set(llmFe.fieldPath, llmFe);
        }
      }
      
      const fieldExtractions = Array.from(mergedExtractions.values());
      this.logger.log(`Field extraction completed: ${fieldExtractions.length} fields with sources`);

      return { data: extractedData, fieldExtractions };
    } catch (error: any) {
      this.logger.error('Error in field extraction:', error);
      
      // Handle OpenAI API errors gracefully
      if (error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('429')) {
        this.logger.warn('OpenAI API quota exceeded, using fallback extraction');
        return this.fallbackExtraction(emailData, documentClassifications, parsedTexts);
      }
      
      if (error?.status === 401 || error?.message?.includes('401')) {
        throw new Error('OpenAI API key is invalid. Please check your OPENAI_API_KEY environment variable.');
      }
      
      // For other errors, try fallback before throwing
      this.logger.warn('OpenAI API error, attempting fallback extraction');
      try {
        return this.fallbackExtraction(emailData, documentClassifications, parsedTexts);
      } catch (fallbackError) {
        throw new Error(`Field extraction failed: ${error.message || String(error)}`);
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
   * Build system prompt that requests document chunks and highlights
   */
  private buildSystemPromptWithChunks(): string {
    return `You are an expert at extracting structured commercial property insurance submission data from emails and documents.

Extract all fields from the provided content according to this schema:
${JSON.stringify(this.fieldSchema, null, 2)}

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
      "documentChunk": "Named Insured: Harborview Manufacturing, LLC\nAddress: 1250 Harbor Park Drive",
      "highlightedText": "Named Insured: <mark>Harborview Manufacturing, LLC</mark>\nAddress: 1250 Harbor Park Drive",
      "chunkStartIndex": 150,
      "chunkEndIndex": 250
    }
  ]
}

For each extracted field:
- fieldPath: The JSON path (e.g., "submission.namedInsured", "locations[0].buildings[0].riskAddress")
- fieldName: The field name without path
- fieldValue: The extracted value (null if not found)
- source: "email_body", "acord", "sov", "loss_run", "schedule", "supplemental", or "other"
- documentChunk: A 200-500 character excerpt from the source document containing the value
- highlightedText: The same chunk with the extracted value wrapped in <mark> tags
- chunkStartIndex: Character position where chunk starts in original document (approximate)
- chunkEndIndex: Character position where chunk ends in original document (approximate)

Include fieldExtractions for ALL fields in the data structure, even if the value is null. This ensures every field has a source attribution.`;
  }

  /**
   * Build extraction prompt with document content
   */
  private buildExtractionPrompt(
    emailData: any,
    documentClassifications: Map<string, string>,
    parsedTexts: Map<string, string>,
  ): string {
    let prompt = `=== EMAIL BODY ===\n${emailData.body || 'No email body'}\n\n`;

    // Add parsed documents grouped by type
    const docTypes = ['acord', 'sov', 'loss_run', 'schedule', 'supplemental', 'other'];
    
    for (const docType of docTypes) {
      const text = parsedTexts.get(docType);
      if (text) {
        prompt += `=== ${docType.toUpperCase()} DOCUMENTS ===\n${text.substring(0, 50000)}\n\n`; // Limit to 50k chars per type
      }
    }

    // Add any unclassified attachments
    for (const att of emailData.attachments || []) {
      const docType = documentClassifications.get(att.id);
      if (!docType || !parsedTexts.has(docType)) {
        prompt += `=== ${att.filename} (${docType || 'other'}) ===\n[Content not yet parsed]\n\n`;
      }
    }

    prompt += `\nExtract all fields from the above content according to the schema.`;

    return prompt;
  }

  /**
   * Generate field extractions from extracted data by finding source chunks
   */
  private async generateFieldExtractions(
    extractedData: any,
    emailData: any,
    attachmentTextMap: Map<string, { text: string; docType: string }>,
    documentClassifications: Map<string, string>,
  ): Promise<Array<{
    fieldPath: string;
    fieldName: string;
    fieldValue: any;
    source: string;
    documentId?: string;
    documentChunk?: string;
    highlightedText?: string;
    chunkStartIndex?: number;
    chunkEndIndex?: number;
  }>> {
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
    }> = [];

    // Flatten the extracted data structure to iterate through all fields
    const flattenObject = (obj: any, prefix = '', path = ''): Array<{ path: string; name: string; value: any }> => {
      const fields: Array<{ path: string; name: string; value: any }> = [];
      
      for (const key in obj) {
        const currentPath = path ? `${path}.${key}` : key;
        const value = obj[key];
        
        if (value === null || value === undefined) {
          // Still add it but with null value
          fields.push({ path: currentPath, name: key, value: null });
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              fields.push(...flattenObject(item, `${currentPath}[${index}]`, `${currentPath}[${index}]`));
            } else {
              fields.push({ path: `${currentPath}[${index}]`, name: key, value: item });
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

    const allFields = flattenObject(extractedData);
    
    // For each field with a value, try to find it in the source documents
    for (const field of allFields) {
      if (field.value === null || field.value === undefined || field.value === '') {
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
      let bestMatch: { source: string; chunk: ReturnType<typeof this.extractChunk>; documentId?: string } | null = null;

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
            index = this.findApproximatePosition(emailData.body, normalizedIndex, normalizedValue.length);
          }
        }
        
        // If still not found, try searching for field name near the value
        if (index === -1) {
          const fieldNamePattern = new RegExp(
            this.escapeRegex(field.name.replace(/([A-Z])/g, ' $1').toLowerCase()),
            'i'
          );
          const fieldNameMatch = emailData.body.match(fieldNamePattern);
          if (fieldNameMatch && fieldNameMatch.index !== undefined) {
            // Extract chunk around field name
            index = fieldNameMatch.index;
          }
        }
        
        if (index !== -1) {
          const chunk = this.extractChunk(emailData.body, index, searchValue.length || 50);
          bestMatch = { source: 'email_body', chunk };
          found = true;
        }
      }

      // Search in attachments if not found in email body
      if (!found) {
        for (const [attachmentId, { text, docType }] of attachmentTextMap.entries()) {
          const textLower = text.toLowerCase();
          let index = textLower.indexOf(searchValue);
          
          // If exact match not found, try normalized search
          if (index === -1 && normalizedValue) {
            const textNormalized = textLower.replace(/[,$%]/g, '');
            const normalizedIndex = textNormalized.indexOf(normalizedValue);
            if (normalizedIndex !== -1) {
              index = this.findApproximatePosition(text, normalizedIndex, normalizedValue.length);
            }
          }
          
          // If still not found, try searching for field name
          if (index === -1) {
            const fieldNamePattern = new RegExp(
              this.escapeRegex(field.name.replace(/([A-Z])/g, ' $1').toLowerCase()),
              'i'
            );
            const fieldNameMatch = text.match(fieldNamePattern);
            if (fieldNameMatch && fieldNameMatch.index !== undefined) {
              index = fieldNameMatch.index;
            }
          }
          
          if (index !== -1) {
            const chunk = this.extractChunk(text, index, searchValue.length || 50);
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
                valueIndex = this.findApproximatePosition(emailData.body, normalizedIndex, normalizedValue.length);
              }
            }
          }
          
          // If value found, extract chunk around it
          if (valueIndex !== -1) {
            defaultChunk = this.extractChunk(emailData.body, valueIndex, valueStr.length);
          } else {
            // Try to find field name in email body
            const fieldNamePattern = new RegExp(
              this.escapeRegex(field.name.replace(/([A-Z])/g, ' $1').toLowerCase()),
              'i'
            );
            const fieldNameMatch = emailData.body.match(fieldNamePattern);
            if (fieldNameMatch && fieldNameMatch.index !== undefined) {
              defaultChunk = this.extractChunk(emailData.body, fieldNameMatch.index, 50);
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
          if (valueStr && defaultChunk.text.toLowerCase().includes(valueStr.toLowerCase())) {
            extractionRecord.highlightedText = defaultChunk.text.replace(
              new RegExp(this.escapeRegex(valueStr), 'gi'),
              (match) => `<mark>${match}</mark>`
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
  ): { text: string; highlighted: string; startIndex: number; endIndex: number } {
    const contextSize = 200; // Characters before and after
    const startIndex = Math.max(0, valueIndex - contextSize);
    const endIndex = Math.min(fullText.length, valueIndex + valueLength + contextSize);
    
    const chunk = fullText.substring(startIndex, endIndex);
    const valueInChunk = fullText.substring(valueIndex, valueIndex + valueLength);
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
  private findApproximatePosition(originalText: string, normalizedIndex: number, length: number): number {
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
  ): Promise<{ data: any; fieldExtractions: Array<any> }> {
    this.logger.log('Using fallback extraction (no LLM)');
    
    const extracted: any = {
      submission: {},
      locations: [],
      coverage: {},
      lossHistory: {},
    };

    // Combine all text for searching
    const allText = [
      emailData.body || '',
      ...Array.from(parsedTexts.values()),
    ].join('\n\n').toLowerCase();

    // Simple pattern matching for common fields
    const patterns: Record<string, RegExp> = {
      namedInsured: /(?:named\s+insured|insured\s+name|company\s+name)[\s:]+([^\n]+)/i,
      carrierName: /(?:carrier|insurance\s+company|insurer)[\s:]+([^\n]+)/i,
      brokerName: /(?:broker|agent)[\s:]+([^\n]+)/i,
      effectiveDate: /(?:effective\s+date|policy\s+start)[\s:]+([^\n]+)/i,
      expirationDate: /(?:expiration\s+date|expiry|policy\s+end)[\s:]+([^\n]+)/i,
    };

    for (const [field, pattern] of Object.entries(patterns)) {
      const match = allText.match(pattern);
      if (match && match[1]) {
        extracted.submission[field] = match[1].trim();
      }
    }

    // Extract building square footage
    const sqftMatch = allText.match(/(\d+(?:,\d+)*)\s*(?:sq\s*ft|square\s*feet|sf)/i);
    if (sqftMatch) {
      extracted.locations = [{
        locationNumber: 1,
        buildings: [{
          buildingNumber: 1,
          buildingSqFt: parseInt(sqftMatch[1].replace(/,/g, ''), 10),
        }],
      }];
    }

    // Extract building limit
    const limitMatch = allText.match(/\$(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:building\s+limit|coverage\s+limit)/i);
    if (limitMatch) {
      extracted.coverage.buildingLimit = parseFloat(limitMatch[1].replace(/,/g, ''));
    }

    // Generate field extractions for fallback
    const attachmentTextMap = new Map<string, { text: string; docType: string }>();
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
    return { data: extracted, fieldExtractions };
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

