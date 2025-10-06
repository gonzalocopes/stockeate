import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * GET /products?branchId=central&search=cola&includeArchived=0|1
   * Devuelve el catálogo de la sucursal.
   */
  @Get()
  async list(
    @Query('branchId') branchId: string,
    @Query('search') search?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }
    const include = includeArchived === '1' || includeArchived === 'true';
    const rows = await this.productsService.findMany(branchId, search ?? '', include);
    return rows;
  }

  /**
   * GET /products/by-code/:code?branchId=central
   * (ruta que ya usabas; la mantengo)
   */
  @Get('by-code/:code')
  async byCode(
    @Param('code') code: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.productsService.findByCode(code, branchId ?? null);
  }
}
