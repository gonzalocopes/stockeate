import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Inject } from '@nestjs/common';
import { LOGGER } from '../../logger.provider';
import { Logger } from 'winston';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, originalUrl } = req;
    const requestId = req.context?.requestId || '-';
    const userId = req.user?.id || req.user?.sub || '-';
    const start = Date.now();

    this.logger.info(
      `[${requestId}] --> ${method} ${originalUrl} userId=${userId}`
    );

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        const status = context.switchToHttp().getResponse().statusCode;
        this.logger.info(
          `[${requestId}] <-- ${method} ${originalUrl} status=${status} userId=${userId} ${ms}ms`
        );
      })
    );
  }
}
