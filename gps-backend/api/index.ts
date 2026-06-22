import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import compression from 'compression';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

let cachedApp: any;

async function bootstrapServer() {
  if (!cachedApp) {
    const app = await NestFactory.create(AppModule);

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

    await app.init();
    cachedApp = app;
  }
  return cachedApp;
}

export default async function (req: any, res: any) {
  const app = await bootstrapServer();
  const instance = app.getHttpAdapter().getInstance();
  return instance(req, res);
}
