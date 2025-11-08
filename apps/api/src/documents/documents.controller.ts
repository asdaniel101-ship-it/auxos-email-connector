import { Body, Controller, Param, Patch, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get document by ID' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Returns the document' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async findOne(@Param('id') id: string) {
    return this.prisma.document.findUnique({
      where: { id },
      include: {
        extractedFields: true,
      },
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update document processing status' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Document updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() body: {
      processingStatus?: string;
      documentType?: string;
      processingError?: string;
    }
  ) {
    return this.prisma.document.update({
      where: { id },
      data: body,
    });
  }
}

