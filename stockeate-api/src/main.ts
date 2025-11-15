import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { LOGGER } from './logger.provider';
import { Logger } from 'winston';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Middleware global para requestId, IP y user-agent
  app.use(new RequestContextMiddleware().use);

  // Obtener logger inyectado
  const logger = app.get<Logger>(LOGGER);

  // Interceptor global para logging de requests y respuestas
  app.useGlobalInterceptors(new LoggingInterceptor(logger));

  // Filtro global de excepciones
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  // CORS abierto para pruebas (ajusta luego si querés restringir)
  app.enableCors({ origin: true });

  // Validaciones DTO (whitelist)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Stockeate API')
    .setDescription('Endpoints del backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Escuchar en todas las interfaces para que el teléfono pueda acceder asd
  const port = Number(process.env.PORT) || 3000;
  // Desactivar logs por defecto de NestJS para que solo Winston maneje la salida
  app.useLogger(false);
  await app.listen(port, '0.0.0.0');

  logger.info(`✅ API escuchando en 0.0.0.0:${port} (Swagger: /docs)`);
}
bootstrap();
// nose