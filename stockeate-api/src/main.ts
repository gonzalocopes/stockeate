import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
  await app.listen(port, '0.0.0.0');

  console.log(`✅ API escuchando en 0.0.0.0:${port} (Swagger: /docs)`);
}
bootstrap();
// nose