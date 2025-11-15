import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import * as path from 'path';

export const LOGGER = 'LOGGER';

export const loggerProvider: Provider = {
  provide: LOGGER,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const logDir = path.join(__dirname, '../logs');
    const logLevel = configService.get<string>('LOG_LEVEL') || (configService.get<string>('NODE_ENV') === 'production' ? 'error' : 'info');
    const enableConsole = configService.get<string>('LOG_CONSOLE') !== 'false' && configService.get<string>('NODE_ENV') !== 'production';

    // Winston transportes con nivel explícito
    const transports: winston.transport[] = [];
    if (enableConsole) {
      transports.push(
        new winston.transports.Console({
          level: logLevel,
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, stack }) => {
              if (level === 'error' && stack) {
                return `\n[${level}] ${message}\n\x1b[90m${stack}\x1b[0m\n`;
              }
              return `[${level}] ${message}`;
            })
          ),
        })
      );
    }
    transports.push(
      new winston.transports.DailyRotateFile({
        level: logLevel,
        filename: path.join(logDir, 'app-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: false,
        maxSize: '20m',
        maxFiles: '14d',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, stack }) => {
            const msg = stack ? `${message}\n${stack}` : message;
            return `${timestamp} [${level}]: ${msg}`;
          })
        ),
      })
    );

    // Forzar el nivel en todos los transportes
    transports.forEach(t => { t.level = logLevel; });

    const logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
      ),
      transports,
    });
    logger.info(`[LOGGER] Inicializado con nivel: ${logLevel}, console: ${enableConsole}`);
    return logger;
  },
};
