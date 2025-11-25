// Vercel serverless function - NestJS adapter
// Use require for CommonJS compatibility in Vercel
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

let cachedApp: any;

async function createApp() {
  if (cachedApp) {
    return cachedApp;
  }

  try {
    // Use dynamic import with .js extension for ESM compatibility
    // The dist files are CommonJS, so we need to handle this correctly
    const appModulePath = '../apps/api/dist/src/app.module.js';
    const interceptorPath = '../apps/api/dist/src/common/interceptors/logging.interceptor.js';
    
    // For Vercel, we need to use require for CommonJS modules
    // But since we're in ESM context, we'll use dynamic import
    const appModule = await import(appModulePath);
    const interceptorModule = await import(interceptorPath);
    
    const AppModule = appModule.AppModule || appModule.default?.AppModule || appModule.default;
    const LoggingInterceptor = interceptorModule.LoggingInterceptor || interceptorModule.default?.LoggingInterceptor || interceptorModule.default;

    if (!AppModule) {
      throw new Error(`Could not find AppModule in ${appModulePath}. Exports: ${Object.keys(appModule).join(', ')}`);
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
    if (LoggingInterceptor) {
      app.useGlobalInterceptors(new LoggingInterceptor());
    }

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
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    Logger.error(`Failed to create app: ${errorMsg}`, 'Bootstrap');
    Logger.error(`Stack: ${errorStack}`, 'Bootstrap');
    console.error('Full error:', error);
    throw error;
  }
}

export default async function handler(req: any, res: any) {
  try {
    const app = await createApp();
    
    // Strip /api prefix from the URL path for NestJS routing
    // Vercel routes /api/* to this handler, but NestJS expects paths without /api
    if (req.url && req.url.startsWith('/api/')) {
      req.url = req.url.replace('/api', '');
      // Also update the originalUrl if it exists
      if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
        req.originalUrl = req.originalUrl.replace('/api', '');
      }
    }
    
    return app(req, res);
  } catch (error) {
    console.error('Vercel handler error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : String(error);
    console.error('Error stack:', errorStack);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    });
  }
}
