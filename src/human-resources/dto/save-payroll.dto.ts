import { IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class SavePayrollDto {
  @IsString()
  employeeId!: string;

  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  baseSalary!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  overtime?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  allowances?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deductions?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
