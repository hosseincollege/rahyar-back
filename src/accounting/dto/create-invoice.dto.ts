/**
 * مسیر فایل:
 * backend/src/accounting/dto/create-invoice.dto.ts
 *
 * هدف:
 * اعتبارسنجی payload ثبت فاکتور خرید.
 *
 * نکته امنیتی:
 * organizationId و createdById از body دریافت نمی‌شوند؛
 * این دو مقدار فقط از JWT کاربر لاگین‌شده استخراج خواهند شد.
 */

import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { AccountingPriority } from '@prisma/client';

import { CreateInvoiceLineItemDto } from './create-invoice-line-item.dto';

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  vendorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsEnum(AccountingPriority)
  priority?: AccountingPriority;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineItemDto)
  lineItems: CreateInvoiceLineItemDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
