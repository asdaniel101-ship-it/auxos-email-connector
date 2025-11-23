import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow your frontend (Next.js) to call this API
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
  });

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
