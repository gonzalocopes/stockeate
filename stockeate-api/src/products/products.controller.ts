import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('products')
export class ProductsController {
  constructor(private prisma: PrismaService) {}

  @Get('by-code/:code')
  async byCode(@Param('code') code: string) {
    const p = await this.prisma.product.findUnique({ where: { code } });
    if (!p) throw new NotFoundException();
    return p;
  }
}
