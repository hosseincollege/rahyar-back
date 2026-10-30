import { IsString, IsNotEmpty, IsOptional, IsArray, IsIn, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  code: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'])
  status?: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';

  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  memberUserIds?: string[];
}
