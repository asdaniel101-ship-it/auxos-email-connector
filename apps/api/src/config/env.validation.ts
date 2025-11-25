import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsString, IsOptional, IsNumber, IsUrl, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsNotEmpty()
  @IsString()
  DATABASE_URL: string;

  @IsOptional()
  @IsString()
  OPENAI_API_KEY?: string;

  @IsOptional()
  @IsString()
  GMAIL_EMAIL?: string;

  @IsOptional()
  @IsString()
  GMAIL_APP_PASSWORD?: string;

  @IsOptional()
  @IsNumber()
  PORT?: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  FRONTEND_URL?: string;

  @IsOptional()
  @IsString()
  API_KEY?: string;

  @IsOptional()
  @IsString()
  MINIO_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  MINIO_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  MINIO_SECRET_KEY?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const missingVars = errors
      .map((error) => Object.values(error.constraints || {}).join(', '))
      .join('; ');
    throw new Error(`Environment validation failed: ${missingVars}`);
  }

  return validatedConfig;
}

