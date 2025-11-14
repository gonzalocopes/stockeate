import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

// DTO para crear branch
export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  address?: string;
}
