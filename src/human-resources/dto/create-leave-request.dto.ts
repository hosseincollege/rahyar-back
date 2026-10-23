/**
 * مسیر فایل:
 * backend/src/human-resources/dto/create-leave-request.dto.ts
 *
 * هدف:
 * اعتبارسنجی اطلاعات درخواست مرخصی.
 */

import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { LeaveType } from '@prisma/client';

export class CreateLeaveRequestDto {
  @IsString()
  employeeId: string;

  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
