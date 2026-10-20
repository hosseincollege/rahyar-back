// File: backend/src/settings/dto/update-organization-settings.dto.ts

import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsString,
  MaxLength,
} from 'class-validator';

export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED',
}

export class UpdateOrganizationSettingsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  economicCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  taxOffice?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  fiscalYearStart?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrl?: string;

  @IsOptional()
  @IsIn(['LIGHT', 'DARK'])
  logoTone?: 'LIGHT' | 'DARK';

  @IsOptional()
  @IsIn(['NONE', 'DARK', 'LIGHT'])
  logoBackground?: 'NONE' | 'DARK' | 'LIGHT';

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;
}
