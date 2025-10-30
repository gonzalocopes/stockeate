// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// 👇 1. Importaciones necesarias para Digitalización y Servidor Estático
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DigitalizedRemitoModule } from './digitilazed-remito/digitalized-remito.module';

import { AppController } from './app.controller'; // <-- Asegúrate que este archivo exista
import { AppService } from './app.service';     // <-- Asegúrate que este archivo exista
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { SyncModule } from './sync/sync.module';
import { BranchesModule } from './branches/branches.module';
import { EmailModule } from './email/email.module';
import { PrismaService } from './prisma.service';
import { RemitosModule } from './remitos/remitos.module'; 

@Module({
  imports: [
    // 👇 2. Configuración para servir imágenes desde la carpeta /uploads
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    ProductsModule,
    SyncModule,
    BranchesModule,
    EmailModule,
    // RemitosModule, // Mantenido comentado si no existe
    DigitalizedRemitoModule, // <-- 3. Módulo de Digitalización registrado
  ],
  controllers: [AppController], // <-- 4. AppController añadido (si es necesario)
  providers: [AppService, PrismaService], // <-- 5. AppService añadido (fundamental)
})
export class AppModule {}