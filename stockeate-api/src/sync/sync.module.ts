// src/sync/sync.module.ts (VERSIÓN CORREGIDA)
import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module'; // <-- 1. IMPORTAR AUTHMODULE

@Module({
  imports: [AuthModule], // <-- 2. AÑADIR AUTHMODULE A LOS IMPORTS
  controllers: [SyncController],
  providers: [SyncService, PrismaService],
})
export class SyncModule {}