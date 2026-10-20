// File: backend/src/settings/dto/save-role.dto.ts


import {
  IsArray,
  IsOptional,
  IsString,
} from 'class-validator';

export class SaveRoleDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
