// src/digitalized-remito/digitalized-remito.module.ts
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express'; // <-- 1. Importar Multer
import { DigitalizedRemitoController } from './digitalized-remito.controller';
import { DigitalizedRemitoService } from './digitalized-remito.service';
import { PrismaService } from '../prisma.service'; // <-- 3. Importar PrismaService

@Module({
  imports: [
    MulterModule.register({ // <-- 2. Registrar Multer
      dest: './uploads', // Directorio temporal donde se guardarán los archivos
    }),
  ],
  controllers: [DigitalizedRemitoController],
  providers: [DigitalizedRemitoService, PrismaService], // Y aquí
})
export class DigitalizedRemitoModule {}