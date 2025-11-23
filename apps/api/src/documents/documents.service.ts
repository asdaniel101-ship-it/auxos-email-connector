import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { getTemporalClient } from '../workflows.client';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: {
    sessionId: string;
    fileName: string;
    fileKey: string;
    fileSize: number;
    mimeType: string;
    docType?: string;
  }) {
    // Create document record
    const document = await this.prisma.document.create({
      data: {
        sessionId: data.sessionId,
        fileName: data.fileName,
        fileKey: data.fileKey,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        docType: data.docType,
        processingStatus: 'pending',
      },
    });

    // Trigger extraction workflow asynchronously
    this.triggerExtractionWorkflow(document.id, data.sessionId).catch((error) => {
      this.logger.error(`Failed to trigger extraction workflow for document ${document.id}:`, error);
    });

    return document;
  }

  private async triggerExtractionWorkflow(documentId: string, sessionId: string) {
    try {
      const client = await getTemporalClient();
      
      // Start the extraction workflow
      // The workflow name must match the exported function name in workflows.ts
      const workflowId = `extract-doc-${documentId}`;
      
      await client.workflow.start('extractDocumentWorkflow', {
        taskQueue: 'agent-queue',
        workflowId,
        args: [{ documentId, sessionId }],
      });

      this.logger.log(`Started extraction workflow for document ${documentId} (workflowId: ${workflowId})`);
    } catch (error) {
      this.logger.error(`Error starting extraction workflow:`, error);
      // Update document status to failed
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          processingStatus: 'failed',
          processingError: error instanceof Error ? error.message : 'Failed to start workflow',
        },
      });
    }
  }

  async findOne(id: string) {
    return this.prisma.document.findUnique({
      where: { id },
      include: {
        extractedFields: true,
      },
    });
  }

  async update(
    id: string,
    data: {
      processingStatus?: string;
      docType?: string;
      processingError?: string;
    }
  ) {
    return this.prisma.document.update({
      where: { id },
      data,
    });
  }
}

