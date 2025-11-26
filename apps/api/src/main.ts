import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // Log startup info
  logger.log(`Starting API server...`);
  logger.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  logger.log(`PORT: ${process.env.PORT || '4000 (default)'}`);
  
  // Validate environment variables
  try {
    validateEnv(process.env);
    logger.log('Environment variables validated', 'Bootstrap');
  } catch (error) {
    logger.error(`Environment validation failed: ${error.message}`, 'Bootstrap');
    logger.error(`Missing or invalid environment variables. Check Railway environment variables.`);
    // In production, exit on validation failure
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  let app;
  try {
    app = await NestFactory.create(AppModule);
    logger.log('App module created successfully');
  } catch (error) {
    logger.error(`Failed to create app: ${error.message}`, error.stack, 'Bootstrap');
    process.exit(1);
  }
  
  const configService = app.get(ConfigService);

  // Configure CORS - allow production frontend URL and Vercel domains
  const frontendUrl = configService.get('FRONTEND_URL') || 'http://localhost:3000';
  
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
      ].filter(Boolean);
      
      // Allow all Vercel domains (production and preview)
      const isVercelDomain = /^https:\/\/.*\.vercel\.app$/.test(origin);
      
      if (allowedOrigins.includes(origin) || isVercelDomain) {
        Logger.log(`CORS: Allowing origin: ${origin}`, 'CORS');
        callback(null, true);
      } else {
        Logger.warn(`CORS: Blocked origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}, Vercel domains`, 'CORS');
        callback(new Error(`Not allowed by CORS: ${origin}`));
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
  // Railway automatically sets PORT environment variable
  const port = Number(process.env.PORT ?? 4000);
  
  // Log port info for debugging
  logger.log(`Attempting to listen on port: ${port}`);
  logger.log(`PORT env var: ${process.env.PORT || 'not set (using default 4000)'}`);
  
  try {
    // Listen on all interfaces (0.0.0.0) so Railway can reach it
    // Use app.listen() to ensure NestJS is fully initialized
    await app.listen(port, '0.0.0.0');
    
    // Get the HTTP server instance to verify listening address
    const server = app.getHttpServer();
    const address = server.address();
    
    // Log the actual listening address
    logger.log(`📡 Server listening on: ${JSON.stringify(address)}`);
    
    // Verify it's listening on 0.0.0.0
    if (address && typeof address === 'object') {
      if (address.address === '0.0.0.0' || address.address === '::') {
        logger.log(`✅ Server is listening on 0.0.0.0:${port} - Railway can reach it`);
      } else {
        logger.warn(`⚠️  WARNING: Server address is ${address.address}, expected 0.0.0.0`);
        logger.warn(`⚠️  This may cause Railway health checks to fail`);
      }
    }
    
    logger.log(`🚀 API is ready and listening on port ${port}`);
    logger.log(`✅ Health check endpoint available at: http://0.0.0.0:${port}/health/live`);
    logger.log(`✅ All routes initialized and ready to accept requests`);
  } catch (error) {
    logger.error(`Failed to start server on port ${port}: ${error.message}`, error.stack, 'Bootstrap');
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('Fatal error during bootstrap:', error);
  process.exit(1);
});
