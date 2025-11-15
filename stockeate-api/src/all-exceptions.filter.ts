import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Inject } from '@nestjs/common';
import { LOGGER } from './logger.provider';
import { Logger } from 'winston';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { context?: any }>();

    // Evitar doble envío de headers
    if (response.headersSent) {
      return;
    }

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : 500;

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : exception;

    // Extraer requestId y metadata
    const requestId = request.context?.requestId || '-';
    const path = request.url;
    const timestamp = new Date().toISOString();

    // Extraer mensaje principal y código
    let mensajePrincipal = '';
    let code = '';
    if (
      typeof message === 'object' && message !== null &&
      'meta' in message && message.meta && typeof message.meta === 'object' &&
      'cause' in (message.meta as any)
    ) {
      mensajePrincipal = String((message.meta as any).cause);
      code = String((message as any).code || 'INTERNAL_ERROR');
    } else if (
      typeof message === 'object' && message !== null &&
      'message' in message
    ) {
      const msgVal = (message as any).message;
      mensajePrincipal = Array.isArray(msgVal) ? msgVal.join(' | ') : String(msgVal);
      code = String((message as any).error || 'BAD_REQUEST');
    } else {
      mensajePrincipal = typeof message === 'string' ? message : JSON.stringify(message);
      code = 'INTERNAL_ERROR';
    }

    // Loguear con Winston (incluyendo requestId y metadata)
    this.logger.error(`[${requestId}] ${request.method} ${path} status=${status} code=${code} msg=${mensajePrincipal}`);

    // Respuesta JSON estándar
    response.status(status).json({
      status: 'error',
      message: mensajePrincipal,
      code,
      timestamp,
      path,
      requestId,
    });
  }
}
