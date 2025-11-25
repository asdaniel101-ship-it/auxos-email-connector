# Files Module - MinIO Integration

This module handles file uploads and downloads using MinIO (S3-compatible object storage).

## Architecture

### Components

1. **MinioService** (`minio.service.ts`)
   - Manages MinIO client connection
   - Auto-creates the `documents` bucket on startup
   - Provides methods to generate presigned URLs

2. **FilesController** (`files.controller.ts`)
   - `GET /files/presign?name=filename.pdf` - Get upload URL
   - `GET /files/download?key=uploads/123-file.pdf` - Get download URL

3. **FilesModule** (`files.module.ts`)
   - Exports MinioService for use in other modules (e.g., for Temporal workflows)

## Configuration

The MinIO service reads from environment variables (with defaults for local dev):

```bash
MINIO_ENDPOINT=localhost      # MinIO host
MINIO_PORT=9000               # MinIO port
MINIO_USE_SSL=false           # Use HTTPS?
MINIO_ACCESS_KEY=dev          # Access key (matches compose.yaml)
MINIO_SECRET_KEY=dev12345     # Secret key (matches compose.yaml)
```

## How It Works

### Upload Flow (Presigned URLs)

1. **Frontend** requests upload permission:
   ```javascript
   const response = await fetch('http://localhost:4000/files/presign?name=certificate.pdf');
   const { url } = await response.json();
   ```

2. **API** generates a presigned PUT URL (valid for 1 hour):
   - File will be stored at: `documents/uploads/{timestamp}-{filename}`

3. **Frontend** uploads directly to MinIO:
   ```javascript
   await fetch(url, {
     method: 'PUT',
     body: fileBlob,
     headers: {
       'Content-Type': file.type
     }
   });
   ```

### Download Flow

1. **Backend** generates presigned GET URL:
   ```typescript
   const url = await this.minioService.getPresignedGetUrl('uploads/123-file.pdf');
   ```

2. User can access the file via the temporary URL

## Benefits

✅ **No file size limits on API** - Files go directly to MinIO  
✅ **Scalable** - MinIO handles storage, not your app server  
✅ **Secure** - Presigned URLs expire after 1 hour  
✅ **Production-ready** - Switch to AWS S3 by changing environment variables

## Testing

See the main API README for testing instructions.

## Future Enhancements

- [ ] Add file metadata tracking in database
- [ ] Implement virus scanning on upload
- [ ] Support multipart uploads for large files (>5GB)
- [ ] Add file type validation
- [ ] Track storage usage per user/submission

