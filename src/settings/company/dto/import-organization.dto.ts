// Path: backend/src/settings/dto/import-organization.dto.ts
// این DTO ساختار داده‌های ورودی برای عملیات درون‌ریزی سازمان، شعب و دپارتمان‌ها را تعیین و اعتبارسنجی می‌کند.

import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImportOrganizationDetailsDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  economicCode?: string;

  @IsOptional()
  @IsString()
  taxOffice?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
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
}

export class ImportBranchItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'فرمت ایمیل شعبه نامعتبر است.' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ImportDepartmentItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  branchName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ImportOrganizationDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ImportOrganizationDetailsDto)
  organization?: ImportOrganizationDetailsDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportBranchItemDto)
  branches?: ImportBranchItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportDepartmentItemDto)
  departments?: ImportDepartmentItemDto[];
}
