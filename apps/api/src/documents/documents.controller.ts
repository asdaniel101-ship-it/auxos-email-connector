import { Body, Controller, Param, Patch, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Create a document record after upload' })
  @ApiResponse({ status: 201, description: 'Document created successfully' })
  async create(
    @Body() body: {
      sessionId: string;
      fileName: string;
      fileKey: string;
      fileSize: number;
      mimeType: string;
      docType?: string;
    }
  ) {
    return this.documentsService.create(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document by ID' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Returns the document' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update document processing status' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Document updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() body: {
      processingStatus?: string;
      docType?: string;
      processingError?: string;
    }
  ) {
    return this.documentsService.update(id, body);
  }
}

