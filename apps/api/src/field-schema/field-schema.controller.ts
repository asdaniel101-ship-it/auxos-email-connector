import { Controller, Get, Put, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FieldSchemaService } from './field-schema.service';

@ApiTags('field-schema')
@Controller('field-schema')
export class FieldSchemaController {
  constructor(private readonly fieldSchemaService: FieldSchemaService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current field schema' })
  @ApiResponse({ status: 200, description: 'Returns the field schema JSON' })
  async getSchema() {
    try {
      return await this.fieldSchemaService.getSchema();
    } catch (error) {
      throw new HttpException(
        `Failed to load field schema: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put()
  @ApiOperation({ summary: 'Update the field schema' })
  @ApiResponse({ status: 200, description: 'Schema updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid schema format' })
  async updateSchema(@Body() schema: any) {
    try {
      return await this.fieldSchemaService.updateSchema(schema);
    } catch (error) {
      throw new HttpException(
        `Failed to update field schema: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}

