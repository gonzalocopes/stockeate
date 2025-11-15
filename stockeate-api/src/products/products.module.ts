import { Module } from '@nestjs/common';
import { LoggerModule } from '../logger.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [LoggerModule],
  controllers: [ProductsController],
  providers: [ProductsService, PrismaService],
  exports: [ProductsService],
})
export class ProductsModule {}
