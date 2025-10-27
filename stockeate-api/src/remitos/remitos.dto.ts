import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Decimal } from '@prisma/client/runtime/library';

export enum RemitoType {
  IN = 'IN',
  OUT = 'OUT',
}

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

  @IsEnum(RemitoType)
  @IsNotEmpty()
  type: RemitoType;

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

  @IsOptional()
  @IsEnum(RemitoType)
  type?: RemitoType;
}

// DTO para estadísticas de remitos
export class RemitosStatsResponseDto {
  total: number;
  inCount: number;
  outCount: number;
}

// // DTO extendido para remito con tipo
// export class RemitoWithTypeDto {
//   id: string;
//   branchId: string;
//   tmpNumber: string;
//   officialNumber?: string;
//   customer?: string;
//   notes?: string;
//   createdAt: Date;
//   type: RemitoType;
//   items: any[];
//   branch?: any;
// }

// DTO para items del remito
export class RemitoItemWithProductDto {
  id: string;
  remitoId: string;
  productId: string;
  qty: number;
  unitPrice: Decimal;
  product: {
    id: string;
    branchId: string;
    code: string;
    name: string;
    price: Decimal;
    stock: number;
    version: number;
    updatedAt: Date;
    isActive: boolean;
  };
}

// DTO para branch
export class BranchDto {
  id: string;
  name: string;
}

// DTO extendido para remito con tipo
export class RemitoWithTypeDto {
  id: string;
  branchId: string;
  tmpNumber: string;
  officialNumber?: string | null;
  customer?: string | null;
  notes?: string | null;
  createdAt: Date;
  type: RemitoType;
  items: RemitoItemWithProductDto[];
  branch?: BranchDto;
}
