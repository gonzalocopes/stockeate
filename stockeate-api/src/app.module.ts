// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { SyncModule } from './sync/sync.module';
import { BranchesModule } from './branches/branches.module';
import { EmailModule } from './email/email.module';
import { PrismaService } from './prisma.service';
// 👇 CORRECCIÓN 1: Corregido el error de tipeo en la ruta ("digitilazed" -> "digitalized")
import { DigitalizedRemitoModule } from './digitilazed-remito/digitalized-remito.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
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
    DigitalizedRemitoModule,
  ],
  controllers: [AppController],
  // 👇 CORRECCIÓN 2: AppService ha sido añadido de nuevo a la lista de providers.
  providers: [AppService, PrismaService],
})
export class AppModule {}