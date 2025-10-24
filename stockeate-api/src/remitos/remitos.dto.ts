import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// DTO para crear items de remito
export class CreateRemitoItemDto {
  @IsString()
  @IsNotEmpty()
  productCode: string;

  @IsNumber()
  @Min(1)
  qty: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

// DTO para crear remito
export class CreateRemitoDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  tmpNumber: string;

  @IsString()
  @IsOptional()
  officialNumber?: string;

  @IsString()
  @IsOptional()
  customer?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRemitoItemDto)
  items: CreateRemitoItemDto[];
}

// DTO para actualizar remito
export class UpdateRemitoDto {
  @IsString()
  @IsOptional()
  officialNumber?: string;

  @IsString()
  @IsOptional()
  customer?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

// DTO para query params
export class GetRemitosQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  customer?: string;

  @IsOptional()
  @IsString()
  tmpNumber?: string;

  @IsOptional()
  @IsString()
  officialNumber?: string;
}
