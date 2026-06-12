import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      return response.status(status).json(exceptionResponse);
    }

    const message =
      exception instanceof Error ? exception.message : 'Internal server error';

    return response.status(status).json({
      error: status === 500 ? 'Internal server error' : message,
      details: message,
    });
  }
}
