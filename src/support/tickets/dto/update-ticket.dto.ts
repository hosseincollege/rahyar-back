// src/support/tickets/dto/update-ticket.dto.ts

import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  Min,
} from 'class-validator';
import {
  TicketPriority,
  TicketStatus,
  TicketType,
  TicketVisibility,
} from '@prisma/client';

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TicketType)
  type?: TicketType;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketVisibility)
  visibility?: TicketVisibility;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  // فیلدهای حرفه‌ای فرآیند Case Management مایکروسافت داینامیکس
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsUUID()
  parentTicketId?: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  billableHours?: number;

  @IsOptional()
  @IsDateString()
  targetResolveAt?: string;
}

export class ResolveTicketDto {
  @IsString()
  resolution: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  billableHours?: number;
}
