import { Body, Controller, Get, ParseArrayPipe, Put } from '@nestjs/common';
import { FieldDefinitionsService } from './field-definitions.service';
import { UpdateFieldDefinitionDto } from './dto/update-field-definition.dto';
import { FieldExtractionService } from '../email-intake/field-extraction.service';

@Controller('field-definitions')
export class FieldDefinitionsController {
  constructor(
    private readonly fieldDefinitionsService: FieldDefinitionsService,
    private readonly fieldExtractionService: FieldExtractionService,
  ) {}

  @Get()
  findAll() {
    return this.fieldDefinitionsService.findAll();
  }

  @Put()
  async updateMany(
    @Body(new ParseArrayPipe({ items: UpdateFieldDefinitionDto }))
    definitions: UpdateFieldDefinitionDto[],
  ) {
    const result = await this.fieldDefinitionsService.upsertMany(definitions);
    // Refresh field definitions in extraction service after update
    await this.fieldExtractionService.refreshFieldDefinitions();
    return result;
  }
}
