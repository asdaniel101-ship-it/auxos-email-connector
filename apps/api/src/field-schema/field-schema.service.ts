import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FieldSchemaService {
  private readonly logger = new Logger(FieldSchemaService.name);
  private readonly schemaPath: string;

  constructor() {
    // Path to field-schema.json in apps/api directory
    // The API runs from apps/api, so process.cwd() should be apps/api
    // In development, __dirname is in src/, in production it's in dist/src/
    // Try both relative to cwd and relative to __dirname
    const cwd = process.cwd();
    const relativeToCwd = path.join(cwd, 'field-schema.json');
    const relativeToDirname = path.join(__dirname, '../../field-schema.json');

    // Check which path exists
    if (fs.existsSync(relativeToCwd)) {
      this.schemaPath = relativeToCwd;
    } else if (fs.existsSync(relativeToDirname)) {
      this.schemaPath = relativeToDirname;
    } else {
      // Default to cwd (most common case)
      this.schemaPath = relativeToCwd;
      this.logger.warn(`Field schema not found, will use: ${this.schemaPath}`);
    }

    this.logger.log(`Field schema path: ${this.schemaPath}`);
  }

  /**
   * Get the current field schema
   */
  async getSchema(): Promise<any> {
    try {
      if (!fs.existsSync(this.schemaPath)) {
        throw new Error(`Field schema file not found at ${this.schemaPath}`);
      }

      const content = fs.readFileSync(this.schemaPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Error reading field schema:', error);
      throw error;
    }
  }

  /**
   * Normalize section name for lookup (handles "Loss History" -> "lossHistory", etc.)
   */
  private normalizeSectionName(sectionName: string): string {
    // Remove spaces and convert to camelCase
    return sectionName
      .replace(/\s+/g, '')
      .replace(/^./, (str) => str.toLowerCase());
  }

  /**
   * Convert field-schema.json structure to expected schema format for rendering
   * This is the source of truth used by both email reply and submission details page
   * Keys are normalized to handle both "Loss History" and "lossHistory" lookups
   */
  convertToExpectedSchema(schema: any): Record<string, unknown> {
    const expected: Record<string, unknown> = {};

    // Process each top-level section
    Object.entries(schema).forEach(([sectionName, sectionDef]) => {
      if (sectionName === 'locations') {
        // Handle locations array
        const locationDef = sectionDef as any;
        if (locationDef.type === 'array' && locationDef.items) {
          const locationItem = locationDef.items;
          const locationSchema: Record<string, unknown> = {};

          Object.entries(locationItem).forEach(([key, fieldDef]) => {
            if (key === 'buildings') {
              // Handle nested buildings array
              const buildingDef = fieldDef as any;
              if (buildingDef.type === 'array' && buildingDef.items) {
                const buildingItem = buildingDef.items;
                const buildingSchema: Record<string, unknown> = {};
                Object.keys(buildingItem).forEach((buildingKey) => {
                  buildingSchema[buildingKey] = null;
                });
                locationSchema[key] = [buildingSchema];
              } else {
                locationSchema[key] = null;
              }
            } else {
              locationSchema[key] = null;
            }
          });

          expected[sectionName] = [locationSchema];
          // Also add normalized key for lookup (e.g., "Loss History" -> "lossHistory")
          const normalizedKey = this.normalizeSectionName(sectionName);
          if (normalizedKey !== sectionName) {
            expected[normalizedKey] = [locationSchema];
          }
        }
      } else {
        // Handle object sections (submission, coverage, lossHistory)
        const sectionObj = sectionDef as Record<string, unknown>;
        const sectionSchema: Record<string, unknown> = {};
        Object.keys(sectionObj).forEach((key) => {
          sectionSchema[key] = null;
        });
        expected[sectionName] = sectionSchema;
        // Also add normalized key for lookup (e.g., "Loss History" -> "lossHistory")
        const normalizedKey = this.normalizeSectionName(sectionName);
        if (normalizedKey !== sectionName) {
          expected[normalizedKey] = sectionSchema;
        }
      }
    });

    return expected;
  }

  /**
   * Get the expected schema format (converted from field-schema.json)
   * This is used by both email reply and submission details page
   */
  async getExpectedSchema(): Promise<Record<string, unknown>> {
    const schema = await this.getSchema();
    return this.convertToExpectedSchema(schema);
  }

  /**
   * Update the field schema
   */
  async updateSchema(
    schema: any,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validate it's valid JSON structure
      if (typeof schema !== 'object' || schema === null) {
        throw new Error('Schema must be a valid JSON object');
      }

      // Create backup before updating
      if (fs.existsSync(this.schemaPath)) {
        const backupPath = `${this.schemaPath}.backup.${Date.now()}`;
        fs.copyFileSync(this.schemaPath, backupPath);
        this.logger.log(`Backup created at ${backupPath}`);
      }

      // Write updated schema
      const content = JSON.stringify(schema, null, 2);
      fs.writeFileSync(this.schemaPath, content, 'utf-8');

      this.logger.log('Field schema updated successfully');

      return {
        success: true,
        message: 'Field schema updated successfully',
      };
    } catch (error) {
      this.logger.error('Error updating field schema:', error);
      throw error;
    }
  }
}
