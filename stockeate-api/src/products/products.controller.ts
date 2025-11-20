import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Post,
  Body,
  Delete,
  Patch,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import {
  IsString,
  MinLength,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiQuery } from '@nestjs/swagger';

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
  @Min(0)
  stock: number;

  @IsNumber()
  @Type(() => Number)
  price: number;
}

export class UpdateProductDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  code?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  stock?: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  price?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
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

  @Patch('toggle-active/:code')
  async toggleActive(
    @Param('code') code: string,
    @Param('branchId') branchId: string,
  ) {
    return this.productsService.toggleActive(code, branchId);
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

  @Patch(':code')
  @ApiQuery({
    name: 'branchId',
    required: true,
    type: String,
    description: 'ID de la sucursal del producto',
  })
  async updateProduct(
    @Param('code') code: string,
    @Query('branchId') branchId: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    if (!branchId) {
      throw new BadRequestException('El parámetro branchId es obligatorio');
    }
    return this.productsService.updateProduct(code, branchId, updateProductDto);
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
