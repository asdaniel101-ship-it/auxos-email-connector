import { Body, Controller, Get, ParseArrayPipe, Put } from '@nestjs/common';
import { FieldDefinitionsService } from './field-definitions.service';
import { UpdateFieldDefinitionDto } from './dto/update-field-definition.dto';

@Controller('field-definitions')
export class FieldDefinitionsController {
  constructor(private readonly fieldDefinitionsService: FieldDefinitionsService) {}

  @Get()
  findAll() {
    return this.fieldDefinitionsService.findAll();
  }

  @Put()
  updateMany(
    @Body(new ParseArrayPipe({ items: UpdateFieldDefinitionDto }))
    definitions: UpdateFieldDefinitionDto[],
  ) {
    return this.fieldDefinitionsService.upsertMany(definitions);
  }
}

