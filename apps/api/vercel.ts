import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

let cachedApp: any;

async function createApp() {
  if (cachedApp) {
    return cachedApp;
  }

  // NestJS uses Express by default, so we can create the app normally
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);

  // Configure CORS - allow production frontend URL
  const frontendUrl = configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    frontendUrl,
  ].filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,X-API-Key',
  });

  // Add global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Validate incoming DTOs automatically
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  
  // Get the underlying Express instance from NestJS
  cachedApp = app.getHttpAdapter().getInstance();
  
  Logger.log('Vercel serverless app initialized', 'Bootstrap');
  return cachedApp;
}

export default async function handler(req: any, res: any) {
  const app = await createApp();
  return app(req, res);
}

