// File: src/core/auth/dto/bootstrap.dto.ts

import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

/**
 * اطلاعات لازم برای راه‌اندازی اولیه ERP Pro
 *
 * این DTO فقط برای اولین کاربر سیستم استفاده می‌شود.
 * نقش کاربر در این درخواست از سمت کلاینت دریافت نمی‌شود
 * و در سرویس بک‌اند به‌صورت اجباری ADMIN تعیین خواهد شد.
 */
export class BootstrapDto {
  @IsString()
  @IsNotEmpty()
  setupToken: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
