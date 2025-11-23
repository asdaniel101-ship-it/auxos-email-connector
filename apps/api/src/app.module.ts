import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { SessionsModule } from './sessions/sessions.module';
import { LeadsModule } from './leads/leads.module';
import { ChatModule } from './chat/chat.module';
import { PartnersModule } from './partners/partners.module';
import { FilesModule } from './files/files.module';
import { ExtractedFieldsController } from './extracted-fields/extracted-fields.controller';
import { DocumentsModule } from './documents/documents.module';
import { FieldDefinitionsModule } from './field-definitions/field-definitions.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SessionsModule,
    LeadsModule,
    ChatModule,
    PartnersModule,
    FilesModule,
    DocumentsModule,
    FieldDefinitionsModule,
    EmailModule,
  ],
  controllers: [
    AppController,
    ExtractedFieldsController,
  ],
  providers: [AppService],
})
export class AppModule {}
