// Vercel serverless function - NestJS adapter
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

let cachedApp: any;

async function createApp() {
  if (cachedApp) {
    return cachedApp;
  }

  try {
    // Try to load CommonJS modules - use dynamic import which should handle both
    let AppModule: any;
    let LoggingInterceptor: any;
    
    try {
      // Dynamic import should work for both ESM and CommonJS with interop
      const appModule = await import('../apps/api/dist/src/app.module.js');
      const interceptorModule = await import('../apps/api/dist/src/common/interceptors/logging.interceptor.js');
      
      // Handle CommonJS exports (exports.AppModule) or ESM default exports
      AppModule = appModule.AppModule || appModule.default?.AppModule || appModule.default;
      LoggingInterceptor = interceptorModule.LoggingInterceptor || interceptorModule.default?.LoggingInterceptor || interceptorModule.default;
      
      console.log('Loaded AppModule:', AppModule ? 'Success' : 'Failed');
      console.log('AppModule exports:', Object.keys(appModule));
    } catch (importError) {
      console.error('Import failed:', importError);
      // Try with createRequire as fallback
      try {
        const { createRequire } = await import('module');
        // @ts-ignore - import.meta.url might not be available
        const require = createRequire(typeof import.meta !== 'undefined' ? import.meta.url : __filename);
        const appModulePath = require.resolve('../apps/api/dist/src/app.module.js');
        const interceptorPath = require.resolve('../apps/api/dist/src/common/interceptors/logging.interceptor.js');
        
        const appModule = require(appModulePath);
        const interceptorModule = require(interceptorPath);
        
        AppModule = appModule.AppModule || appModule.default;
        LoggingInterceptor = interceptorModule.LoggingInterceptor || interceptorModule.default;
      } catch (requireError) {
        console.error('Require also failed:', requireError);
        throw new Error(`Failed to load AppModule: ${importError instanceof Error ? importError.message : String(importError)}`);
      }
    }

    if (!AppModule) {
      throw new Error('AppModule is undefined after loading');
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
    console.error('Failed to create app:', errorMsg);
    console.error('Stack:', errorStack);
    console.error('Full error object:', error);
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
      details: errorStack
    });
  }
}
