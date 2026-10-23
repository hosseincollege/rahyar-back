/**
 * @file backend/src/support/tickets/dto/create-ticket.dto.ts
 * @description CreateTicketDto — قرارداد ورودی ثبت تیکت.
 */

import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  TicketPriority,
  TicketType,
  TicketVisibility,
} from '@prisma/client';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsEnum(TicketType)
  type?: TicketType;

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
  @IsDateString()
  dueAt?: string;
}
