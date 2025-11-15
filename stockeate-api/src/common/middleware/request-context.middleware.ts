import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RequestContext {
  requestId: string;
  ip: string;
  userAgent: string;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request & { context?: RequestContext }, res: Response, next: NextFunction) {
    const requestId = uuidv4();
    const ip = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    req.context = {
      requestId,
      ip,
      userAgent: String(userAgent),
    };

    // También se puede exponer en res.locals si se desea
    res.locals.requestId = requestId;

    next();
  }
}
