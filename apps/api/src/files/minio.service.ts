import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private client: Minio.Client;

  constructor() {
    // Initialize MinIO client with local Docker settings
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: Number(process.env.MINIO_PORT) || 9000,
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'dev',
      secretKey: process.env.MINIO_SECRET_KEY || 'dev12345',
    });
  }

  async onModuleInit() {
    // Ensure the 'documents' bucket exists
    const bucketName = 'documents';
    const exists = await this.client.bucketExists(bucketName);

    if (!exists) {
      console.log(`📦 Creating MinIO bucket: ${bucketName}`);
      await this.client.makeBucket(bucketName, 'us-east-1');
    } else {
      console.log(`✅ MinIO bucket '${bucketName}' is ready`);
    }
  }

  /**
   * Generate a presigned URL for uploading a file
   * @param fileName - Name of the file to upload
   * @param expirySeconds - URL expiry time (default 1 hour)
   * @returns Presigned PUT URL
   */
  async getPresignedPutUrl(
    fileName: string,
    expirySeconds = 3600,
  ): Promise<{ url: string; fileKey: string }> {
    const bucketName = 'documents';

    // Generate a unique file key with timestamp to avoid collisions
    const timestamp = Date.now();
    const fileKey = `uploads/${timestamp}-${fileName}`;

    // Generate presigned URL for PUT operation
    const url = await this.client.presignedPutObject(
      bucketName,
      fileKey,
      expirySeconds,
    );

    return { url, fileKey };
  }

  /**
   * Generate a presigned URL for downloading/viewing a file
   * @param fileKey - The key/path of the file in MinIO
   * @param expirySeconds - URL expiry time (default 1 hour)
   * @returns Presigned GET URL
   */
  async getPresignedGetUrl(
    fileKey: string,
    expirySeconds = 3600,
  ): Promise<string> {
    const bucketName = 'documents';
    const url = await this.client.presignedGetObject(
      bucketName,
      fileKey,
      expirySeconds,
    );
    return url;
  }

  /**
   * Get the raw MinIO client for advanced operations
   */
  getClient(): Minio.Client {
    return this.client;
  }
}
