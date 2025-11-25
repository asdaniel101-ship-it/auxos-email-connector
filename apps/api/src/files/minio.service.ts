import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private client: Minio.Client;
  private readonly bucketName: string;

  constructor() {
    // Initialize MinIO client - supports both local Docker and cloud S3-compatible services
    const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    const port = process.env.MINIO_PORT 
      ? Number(process.env.MINIO_PORT) 
      : (useSSL ? 443 : 9000);
    
    this.client = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey: process.env.MINIO_ACCESS_KEY || 'dev',
      secretKey: process.env.MINIO_SECRET_KEY || 'dev12345',
    });
    
    // Bucket name is configurable (default: 'documents')
    // For AWS S3, use your actual bucket name
    this.bucketName = process.env.MINIO_BUCKET_NAME || 'documents';
  }

  async onModuleInit() {
    // Ensure the bucket exists
    const bucketName = this.bucketName;
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
    const bucketName = this.bucketName;
    
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
    const bucketName = this.bucketName;
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

