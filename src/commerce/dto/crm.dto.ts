//src/commerce/dto/crm.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsNumber,
  Min,
  IsDateString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  LeadStatus,
  DisqualifyReason,
  OpportunityState,
  SalesStage,
  StakeholderRole,
  CasePriority,
  ActivityType,
} from '@prisma/client';

// ==========================================
// 1. Account DTOs
// ==========================================
export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class UpdateAccountDto extends PartialType(CreateAccountDto) {}

// ==========================================
// 2. Contact DTOs
// ==========================================
export class CreateContactDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  mobilePhone?: string;

  @IsOptional()
  @IsString()
  accountId?: string;
}

export class UpdateContactDto extends PartialType(CreateContactDto) {}

// ==========================================
// 3. Lead DTOs & Actions (Qualify / Disqualify)
// ==========================================
export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedRevenue?: number;
}

export class UpdateLeadStatusDto {
  @IsEnum(LeadStatus)
  status: LeadStatus;
}

export class DisqualifyLeadDto {
  @IsEnum(DisqualifyReason)
  reason: DisqualifyReason;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ==========================================
// 4. Opportunity & Stakeholder DTOs
// ==========================================
export class CreateOpportunityDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsNumber()
  estimatedRevenue?: number;

  @IsOptional()
  @IsDateString()
  estimatedCloseDate?: string;

  @IsOptional()
  @IsEnum(SalesStage)
  stage?: SalesStage;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;
}

export class UpdateOpportunityDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  estimatedRevenue?: number;

  @IsOptional()
  @IsNumber()
  actualRevenue?: number;

  @IsOptional()
  @IsDateString()
  estimatedCloseDate?: string;

  @IsOptional()
  @IsDateString()
  actualCloseDate?: string;

  @IsOptional()
  @IsEnum(SalesStage)
  stage?: SalesStage;

  @IsOptional()
  @IsEnum(OpportunityState)
  state?: OpportunityState;

  @IsOptional()
  @IsString()
  closeReason?: string;
}

export class AddStakeholderDto {
  @IsString()
  contactId: string;

  @IsEnum(StakeholderRole)
  role: StakeholderRole;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ==========================================
// 5. Quote Line Item & Quote DTOs
// ==========================================
export class CreateQuoteLineItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  productName: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;
}

export class CreateQuoteDto {
  @IsString()
  name: string;

  @IsString()
  opportunityId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteLineItemDto)
  lineItems: CreateQuoteLineItemDto[];
}

// ==========================================
// 6. Case (Ticket) DTOs
// ==========================================
export class CreateCaseDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CasePriority)
  priority?: CasePriority;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsDateString()
  targetResolveAt?: string;
}

export class ResolveCaseDto {
  @IsString()
  resolution: string;

  @IsOptional()
  @IsNumber()
  billableHours?: number;
}

export class MergeCasesDto {
  @IsString()
  targetCaseId: string;

  @IsArray()
  @IsString({ each: true })
  sourceCaseIds: string[];
}

// ==========================================
// 7. Activity DTOs (Task, Phone, Email, Note)
// ==========================================
export class CreateActivityDto {
  @IsEnum(ActivityType)
  type: ActivityType;

  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  opportunityId?: string;

  @IsOptional()
  @IsString()
  caseId?: string;
}
