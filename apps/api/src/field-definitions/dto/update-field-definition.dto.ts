import { FieldValueType } from '@prisma/client';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateFieldDefinitionDto {
  @IsString()
  @IsNotEmpty()
  fieldName!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsEnum(FieldValueType)
  fieldType!: FieldValueType;

  @IsOptional()
  @IsString()
  enteredFieldKey?: string;

  @IsOptional()
  @IsString()
  chatFieldKey?: string;

  @IsOptional()
  @IsString()
  documentFieldKey?: string;

  @IsOptional()
  @IsString()
  businessDescription?: string | null;

  @IsOptional()
  @IsString()
  extractorLogic?: string | null;

  @IsOptional()
  @IsString()
  whereToLook?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentSources?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alternateFieldNames?: string[];
}

