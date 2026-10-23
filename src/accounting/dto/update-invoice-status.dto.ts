/**
 * مسیر فایل:
 * backend/src/accounting/dto/update-invoice-status.dto.ts
 *
 * هدف:
 * اعتبارسنجی درخواست تغییر وضعیت فاکتور و ثبت یادداشت اختیاری.
 */

import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { AccountingInvoiceStatus } from '@prisma/client';

export class UpdateInvoiceStatusDto {
  @IsEnum(AccountingInvoiceStatus)
  status: AccountingInvoiceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
