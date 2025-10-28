import { Module } from '@nestjs/common';
import { RemitosService } from './remitos.service';
import { RemitosController } from './remitos.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [RemitosController],
  providers: [RemitosService, PrismaService],
  exports: [RemitosService],
})
export class RemitosModule {}
