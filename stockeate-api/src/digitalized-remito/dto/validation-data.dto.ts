// src/digitalized-remito/dto/validation-data.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
  IsNumber,
} from 'class-validator';

// Ítems que vienen desde la app
export class ValidatedItemDto {
  @IsString()
  @IsOptional()
  detectedCode: string;

  @IsString()
  @IsOptional()
  detectedName: string;

  @IsInt()
  @Min(0)
  qty: number;

  // 👇 NUEVO: precio opcional (puede venir vacío)
  @IsNumber({}, { message: 'price debe ser numérico', each: false })
  @IsOptional()
  price?: number;
}

// Payload completo que envía la app al validar
export class ValidationDataDto {
  @IsString()
  @IsOptional()
  provider: string;

  @IsString()
  @IsOptional()
  date: string;

  @IsString()
  @IsOptional()
  customerCuit: string;

  @IsString()
  @IsOptional()
  customerAddress: string;

  @IsString()
  @IsOptional()
  customerTaxCondition: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidatedItemDto)
  items: ValidatedItemDto[];
}
