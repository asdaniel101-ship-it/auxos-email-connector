import { Module } from '@nestjs/common';
import { FieldSchemaController } from './field-schema.controller';
import { FieldSchemaService } from './field-schema.service';

@Module({
  controllers: [FieldSchemaController],
  providers: [FieldSchemaService],
  exports: [FieldSchemaService],
})
export class FieldSchemaModule {}

