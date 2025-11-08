import { IsString, IsInt, IsArray, ValidateNested, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class DocumentFileDto {
  @ApiProperty({ description: 'Original file name', example: 'business_license.pdf' })
  @IsString()
  fileName!: string;

  @ApiProperty({ description: 'MinIO file key', example: 'uploads/1234-business_license.pdf' })
  @IsString()
  fileKey!: string;

  @ApiProperty({ description: 'File size in bytes', example: 102400 })
  @IsInt()
  @Min(0)
  fileSize!: number;

  @ApiProperty({ description: 'MIME type', example: 'application/pdf' })
  @IsString()
  mimeType!: string;
}

export class RegisterDocumentsDto {
  @ApiProperty({ description: 'Array of uploaded files', type: [DocumentFileDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentFileDto)
  files!: DocumentFileDto[];
}

