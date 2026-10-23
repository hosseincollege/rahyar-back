/**
 * مسیر فایل:
 * backend/src/human-resources/dto/update-leave-request-status.dto.ts
 *
 * هدف:
 * تغییر وضعیت درخواست مرخصی و ثبت توضیح بررسی‌کننده.
 */

import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { LeaveRequestStatus } from '@prisma/client';

export class UpdateLeaveRequestStatusDto {
  @IsEnum(LeaveRequestStatus)
  status: LeaveRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewerNote?: string;
}
