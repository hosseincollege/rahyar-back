// Path: backend/src/commerce/inventory/dto/create-warehouse.dto.ts
// Backend - DTO for creating an inventory warehouse

import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
