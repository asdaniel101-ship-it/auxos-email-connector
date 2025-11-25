import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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
import { FieldSchemaModule } from './field-schema/field-schema.module';
import { EmailModule } from './email/email.module';
import { EmailIntakeModule } from './email-intake/email-intake.module';
import { HealthModule } from './health/health.module';
import { FeedbackModule } from './feedback/feedback.module';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    PrismaModule,
    SessionsModule,
    LeadsModule,
    ChatModule,
    PartnersModule,
    FilesModule,
    DocumentsModule,
    FieldDefinitionsModule,
    FieldSchemaModule,
    EmailModule,
    EmailIntakeModule,
    HealthModule,
    FeedbackModule,
  ],
  controllers: [
    AppController,
    ExtractedFieldsController,
  ],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
