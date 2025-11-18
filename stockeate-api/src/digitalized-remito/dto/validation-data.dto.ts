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

// Define la forma de cada ítem
export class ValidatedItemDto {
  @IsString()
  @IsOptional() // Código puede venir vacío y se normaliza en el service
  detectedCode: string;

  @IsString()
  @IsOptional() // Nombre también puede venir vacío
  detectedName: string;

  @IsInt()
  @Min(0) // Cantidad no negativa (el service ya corrige a 1 si viene 0)
  qty: number;

  // NUEVO: precio del ítem
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}

// Define la forma del payload completo que la app envía al validar
export class ValidationDataDto {
  @IsString()
  @IsOptional() // Permitimos proveedor vacío
  provider: string;

  @IsString()
  @IsOptional() // Permitimos fecha vacía
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
