import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { FilesModule } from './files/files.module';
import { ExtractedFieldsController } from './extracted-fields/extracted-fields.controller';
import { DocumentsController } from './documents/documents.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SubmissionsModule,
    FilesModule,
  ],
  controllers: [
    AppController,
    ExtractedFieldsController,
    DocumentsController,
  ],
  providers: [AppService],
})
export class AppModule {}
