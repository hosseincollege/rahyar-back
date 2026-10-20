import {
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SetDepartmentManagerDto {
  @IsOptional()
  @IsString()
  managerEmployeeId?: string | null;
}

export class AssignDepartmentEmployeeDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;
}

export class SetEmployeeManagerDto {
  @IsOptional()
  @IsString()
  managerId?: string | null;
}

export class CreateDepartmentTeamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsOptional()
  @IsString()
  managerEmployeeId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  employeeIds?: string[];
}

export class UpdateDepartmentTeamDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  managerEmployeeId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  employeeIds?: string[];
}
