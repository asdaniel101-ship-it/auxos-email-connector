import { Body, Controller, Post, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';

@ApiTags('extracted-fields')
@Controller('extracted-fields')
export class ExtractedFieldsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @ApiOperation({ summary: 'Save an extracted field from document processing' })
  @ApiResponse({ status: 201, description: 'Field saved successfully' })
  async create(@Body() body: {
    leadId: string;
    documentId?: string;
    fieldName: string;
    fieldValue: string;
    confidence?: number;
    source?: string;
    extractedText?: string;
  }) {
    // Check if this field already exists for this document/lead
    const existing = body.documentId
      ? await this.prisma.extractedField.findFirst({
          where: {
            leadId: body.leadId,
            documentId: body.documentId,
            fieldName: body.fieldName,
          },
        })
      : null;

    if (existing) {
      // Update existing
      return this.prisma.extractedField.update({
        where: { id: existing.id },
        data: {
          fieldValue: body.fieldValue,
          confidence: body.confidence,
          source: body.source,
          extractedText: body.extractedText,
        },
      });
    }

    // Create new
    return this.prisma.extractedField.create({
      data: {
        leadId: body.leadId,
        documentId: body.documentId || null,
        fieldName: body.fieldName,
        fieldValue: body.fieldValue,
        confidence: body.confidence,
        source: body.source,
        extractedText: body.extractedText,
      },
    });
  }
}

