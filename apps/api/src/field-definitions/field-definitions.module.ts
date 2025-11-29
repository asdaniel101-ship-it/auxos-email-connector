import { Module } from '@nestjs/common';
import { FieldDefinitionsController } from './field-definitions.controller';
import { FieldDefinitionsService } from './field-definitions.service';
import { PrismaModule } from '../prisma.module';
import { EmailIntakeModule } from '../email-intake/email-intake.module';

@Module({
  imports: [PrismaModule, EmailIntakeModule],
  controllers: [FieldDefinitionsController],
  providers: [FieldDefinitionsService],
  exports: [FieldDefinitionsService],
})
export class FieldDefinitionsModule {}

