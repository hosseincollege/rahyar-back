import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  IsNumber,
} from 'class-validator';

export class CreateStockReceiptItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity: number;
}

export class CreateStockReceiptDto {
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockReceiptItemDto)
  items: CreateStockReceiptItemDto[];
}
