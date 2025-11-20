// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// 👇 1. IMPORTACIONES NUEVAS NECESARIAS
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DigitalizedRemitoModule } from './digitalized-remito/digitalized-remito.module';

import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { SyncModule } from './sync/sync.module';
import { BranchesModule } from './branches/branches.module';
import { EmailModule } from './email/email.module';
import { PrismaService } from './prisma.service';
import { RemitosModule } from './remitos/remitos.module';

@Module({
  imports: [
    // 👇 2. CONFIGURACIÓN PARA SERVIR IMÁGENES (PÚBLICO)
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
    RemitosModule,
    DigitalizedRemitoModule,
  ],
  controllers: [], // Si no usas AppController, déjalo vacío
  providers: [PrismaService],
})
export class AppModule {}