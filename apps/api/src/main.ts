import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  // Validate environment variables
  try {
    validateEnv(process.env);
    Logger.log('Environment variables validated', 'Bootstrap');
  } catch (error) {
    Logger.error(`Environment validation failed: ${error.message}`, 'Bootstrap');
    // In production, you might want to exit here
    // process.exit(1);
  }

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Configure CORS - allow production frontend URL and Vercel domains
  const frontendUrl = configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      const allowedOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        frontendUrl,
      ];
      
      // Allow all Vercel domains (production and preview)
      const isVercelDomain = /^https:\/\/.*\.vercel\.app$/.test(origin);
      
      if (allowedOrigins.includes(origin) || isVercelDomain) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,X-API-Key',
  });

  // Add global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Validate incoming DTOs automatically
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,               // strip unknown fields
      forbidNonWhitelisted: true,    // reject invalid payloads
      transform: true,               // auto-convert primitives
    }),
  );

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('Auxo API')
    .setDescription('API for restaurant intake, lead management, and partner matching')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Choose the port (default 4000) and listen on all interfaces
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');

  // Print the actual URL so you know what to curl
  console.log(`🚀 API running at ${await app.getUrl()}`);
}

bootstrap();
