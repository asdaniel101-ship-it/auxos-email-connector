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
    submissionId: string;
    documentId: string;
    fieldName: string;
    fieldValue: string;
    confidence?: number;
    source?: string;
    extractedText?: string;
  }) {
    // Check if this field already exists for this document
    const existing = await this.prisma.extractedField.findUnique({
      where: {
        documentId_fieldName: {
          documentId: body.documentId,
          fieldName: body.fieldName,
        },
      },
    });

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
        submissionId: body.submissionId,
        documentId: body.documentId,
        fieldName: body.fieldName,
        fieldValue: body.fieldValue,
        confidence: body.confidence,
        source: body.source,
        extractedText: body.extractedText,
      },
    });
  }
}

