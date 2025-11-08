import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { MinioService } from './minio.service';

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly minioService: MinioService) {}

  @Get('presign')
  @ApiOperation({
    summary: 'Get presigned upload URL',
    description:
      'Returns a presigned URL that the client can use to upload a file directly to MinIO/S3',
  })
  @ApiQuery({
    name: 'name',
    description: 'The name of the file to upload',
    example: 'certificate.pdf',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Presigned PUT URL for direct upload',
        },
        fileName: {
          type: 'string',
          description: 'Original file name',
        },
        expiresIn: {
          type: 'number',
          description: 'URL expiry time in seconds',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - file name is required',
  })
  async getPresignedUrl(@Query('name') fileName: string) {
    if (!fileName || !fileName.trim()) {
      throw new BadRequestException('File name is required');
    }

    // Sanitize filename (remove potentially dangerous characters)
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

    const { url, fileKey } = await this.minioService.getPresignedPutUrl(sanitizedFileName);

    return {
      url,
      fileKey,
      expiresIn: 3600, // 1 hour
    };
  }

  @Get('download')
  @ApiOperation({
    summary: 'Get presigned download URL',
    description:
      'Returns a presigned URL that the client can use to download a file from MinIO/S3',
  })
  @ApiQuery({
    name: 'key',
    description: 'The file key/path in MinIO',
    example: 'uploads/1697123456789-certificate.pdf',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned download URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Presigned GET URL for download',
        },
        expiresIn: {
          type: 'number',
          description: 'URL expiry time in seconds',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - file key is required',
  })
  async getDownloadUrl(@Query('key') fileKey: string) {
    if (!fileKey || !fileKey.trim()) {
      throw new BadRequestException('File key is required');
    }

    const url = await this.minioService.getPresignedGetUrl(fileKey);

    return {
      url,
      expiresIn: 3600, // 1 hour
    };
  }
}

