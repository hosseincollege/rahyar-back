import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ProjectImportItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'])
  status?: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
}

export class ImportProjectsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ProjectImportItemDto)
  projects: ProjectImportItemDto[];
}
