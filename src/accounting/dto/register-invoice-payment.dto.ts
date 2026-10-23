/**
 * مسیر فایل:
 * backend/src/accounting/dto/register-invoice-payment.dto.ts
 *
 * هدف:
 * اعتبارسنجی اطلاعات یک پرداخت ثبت‌شده برای فاکتور.
 */

import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { AccountingPaymentMethod } from '@prisma/client';

export class RegisterInvoicePaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  paidAmount: number;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsEnum(AccountingPaymentMethod)
  method?: AccountingPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
