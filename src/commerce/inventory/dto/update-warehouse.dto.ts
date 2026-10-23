// Path: backend/src/commerce/inventory/dto/update-warehouse.dto.ts
// Backend - DTO for updating an inventory warehouse

import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  branchId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
