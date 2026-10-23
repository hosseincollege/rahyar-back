import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { AccountingAccountType } from '@prisma/client';

export class CreateAccountDto {
  @IsString() @Matches(/^[0-9A-Za-z._-]{1,24}$/) code: string;
  @IsString() @MaxLength(120) name: string;
  @IsEnum(AccountingAccountType) type: AccountingAccountType;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
