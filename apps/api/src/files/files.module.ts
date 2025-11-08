import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { MinioService } from './minio.service';

@Module({
  controllers: [FilesController],
  providers: [MinioService],
  exports: [MinioService], // Export so other modules can use it
})
export class FilesModule {}

