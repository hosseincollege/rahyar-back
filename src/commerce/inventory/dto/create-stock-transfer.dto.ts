// Path: backend/src/commerce/inventory/dto/create-stock-transfer.dto.ts
// Backend - DTO for stock transfer operations

import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateStockTransferDto {
  @IsString()
  productId!: string;

  @IsString()
  fromWarehouseId!: string;

  @IsString()
  toWarehouseId!: string;

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
