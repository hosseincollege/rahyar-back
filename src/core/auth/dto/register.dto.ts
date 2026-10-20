// backend/src/core/auth/dto/register.dto.ts

import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsString()
  fatherName?: string;

  @IsOptional()
  @Matches(/^\d{10}$/, {
    message: 'کد ملی باید دقیقاً ۱۰ رقم باشد.',
  })
  nationalCode?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'تاریخ تولد باید با فرمت YYYY-MM-DD باشد.',
  })
  birthDate?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsString()
  @MinLength(8)
  password: string;
}
