// Path: backend/src/commerce/inventory/dto/create-stock-issue.dto.ts
// Backend - DTO for stock issue operations

import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateStockIssueDto {
  @IsString()
  productId!: string;

  @IsString()
  warehouseId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity!: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
