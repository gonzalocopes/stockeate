// src/digitalized-remito/dto/validation-data.dto.ts
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

class ValidatedItemDto {
  @IsString()
  @IsNotEmpty()
  detectedCode: string;

  @IsString()
  @IsNotEmpty()
  detectedName: string;
  
  // En el futuro, aquí recibirías el productId real
  // @IsUUID()
  // productId: string;

  @IsInt()
  qty: number;
}

export class ValidationDataDto {
  @IsString()
  provider: string;

  @IsString()
  date: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidatedItemDto)
  items: ValidatedItemDto[];
}