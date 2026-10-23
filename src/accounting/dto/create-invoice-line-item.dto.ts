/**
 * مسیر فایل:
 * backend/src/accounting/dto/create-invoice-line-item.dto.ts
 *
 * هدف:
 * اعتبارسنجی یک ردیف از اقلام فاکتور خرید.
 */

import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateInvoiceLineItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate?: number;

  /**
   * total ممکن است از فرانت ارسال شود،
   * اما در سرویس عمداً نادیده گرفته و دوباره محاسبه می‌شود.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total?: number;
}
