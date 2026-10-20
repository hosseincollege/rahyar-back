//backend/src/settings/dto/create-organization.dto.ts


import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  slug!: string;

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
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsIn(['LIGHT', 'DARK'])
  logoTone?: 'LIGHT' | 'DARK';

  @IsOptional()
  @IsIn(['NONE', 'DARK', 'LIGHT'])
  logoBackground?: 'NONE' | 'DARK' | 'LIGHT';
}
