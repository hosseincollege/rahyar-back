import { IsEnum } from 'class-validator';
import { PayrollStatus } from '@prisma/client';

export class UpdatePayrollStatusDto {
  @IsEnum(PayrollStatus)
  status!: PayrollStatus;
}
