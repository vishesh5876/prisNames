/**
 * PrisNames — Global Exception Filter
 *
 * Implements ARCHITECTURE.md §4.2 error model:
 * { error: { code, message, requestId } }
 *
 * NEVER exposes raw provider errors or stack traces to clients.
 */

import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

interface AppError {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();
    const requestId = (request.headers['x-request-id'] as string) ?? 'unknown';

    let statusCode: number;
    let code: string;
    let message: string;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null && 'code' in response) {
        // App-level error with code
        const appError = response as { code: string; message?: string };
        code = appError.code;
        message = appError.message || exception.message;
      } else {
        code = this.statusToCode(statusCode);
        message = typeof response === 'string' ? response : exception.message;
      }
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_ERROR';
      message = 'An unexpected error occurred';
      this.logger.error(
        { requestId, err: exception },
        'Unhandled exception',
      );
    }

    const body: AppError = {
      error: { code, message, requestId },
    };

    reply.status(statusCode).send(body);
  }

  private statusToCode(status: number): string {
    switch (status) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 409: return 'CONFLICT';
      case 422: return 'VALIDATION_ERROR';
      case 429: return 'RATE_LIMITED';
      default: return 'INTERNAL_ERROR';
    }
  }
}
