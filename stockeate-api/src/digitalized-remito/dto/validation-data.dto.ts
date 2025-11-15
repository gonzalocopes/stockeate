import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested, Min } from 'class-validator';

// Define la forma de cada ítem
class ValidatedItemDto {
  @IsString()
  @IsOptional() // <-- CAMBIO: El código puede ser opcional o vacío
  detectedCode: string;

  @IsString()
  @IsOptional() // <-- CAMBIO: El nombre puede ser opcional o vacío
  detectedName: string;
  
  @IsInt()
  @Min(0) // Asegurarse de que la cantidad no sea negativa
  qty: number;
}

// Define la forma del payload completo que la app envía al validar
export class ValidationDataDto {
  @IsString()
  @IsOptional() // <-- CAMBIO: Permitir proveedor vacío
  provider: string;

  @IsString()
  @IsOptional() // <-- CAMBIO: Permitir fecha vacía
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