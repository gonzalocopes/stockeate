import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Post,
  Body,
  Delete,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import {
  IsString,
  MinLength,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @MinLength(1)
  @IsNotEmpty()
  code: string;

  @IsString()
  @MinLength(1)
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Type(() => Number)
  stock: number;

  @IsNumber()
  @Type(() => Number)
  price: number;

  @IsBoolean()
  isActive: boolean;
}

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  async create(@Body() product: ProductDto) {
    return this.productsService.createProduct(product.branchId, product);
  }

  @Delete(':code')
  async remove(
    @Param('code') code: string,
    @Param('branchId') branchId: string,
  ) {
    return this.productsService.deleteProduct(code, branchId);
  }

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
    const rows = await this.productsService.findMany(
      branchId,
      search ?? '',
      include,
    );
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
