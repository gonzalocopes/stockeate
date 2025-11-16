import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { DigitalizedRemitoController } from './digitalized-remito.controller';
import { DigitalizedRemitoService } from './digitalized-remito.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module'; // <-- 1. IMPORTA EL MÓDULO DE AUTENTICACIÓN

@Module({
  imports: [
    AuthModule, // <-- 2. AÑÁDELO AQUÍ
    MulterModule.register({
      dest: './uploads',
    }),
  ],
  controllers: [DigitalizedRemitoController],
  providers: [DigitalizedRemitoService, PrismaService],
})
export class DigitalizedRemitoModule {}