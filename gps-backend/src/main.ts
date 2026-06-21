import 'reflect-metadata';
import compression from 'compression';
import helmet from 'helmet';
import express from 'express';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Serve static Swagger API documentation at /swagger if the directory exists
  try {
    const swaggerPath = join(__dirname, '..', '..', 'swagger');
    app.use('/swagger', express.static(swaggerPath));
  } catch (err) {
    console.warn('Swagger directory not found, skipping static serve.');
  }

  const port = config.get<number>('PORT') || 3001;
  await app.listen(port, '0.0.0.0');
  // Keep the startup banner close to the legacy backend for operator continuity.
  console.log(`GPS NestJS Backend running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`API Docs: http://localhost:${port}/swagger`);
}

void bootstrap();
