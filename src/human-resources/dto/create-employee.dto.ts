/**
 * مسیر فایل:
 * backend/src/human-resources/dto/create-employee.dto.ts
 *
 * هدف:
 * اعتبارسنجی اطلاعات اولیه کارمند هنگام ثبت پرسنل جدید،
 * همراه با پشتیبانی از اتصال کاربری و ایجاد هم‌زمان حساب کاربری (User Account) در سیستم.
 */

import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EmployeeStatus, EmploymentType } from '@prisma/client';

export class CreateEmployeeDto {
  @IsNotEmpty({ message: 'کد پرسنلی الزامی است' })
  @IsString({ message: 'کد پرسنلی باید متن باشد' })
  @MaxLength(50, { message: 'کد پرسنلی نمی‌تواند بیشتر از ۵۰ کاراکتر باشد' })
  employeeCode!: string;

  @IsNotEmpty({ message: 'نام الزامی است' })
  @IsString({ message: 'نام باید متن باشد' })
  @MaxLength(100, { message: 'نام نمی‌تواند بیشتر از ۱۰۰ کاراکتر باشد' })
  firstName!: string;

  @IsNotEmpty({ message: 'نام خانوادگی الزامی است' })
  @IsString({ message: 'نام خانوادگی باید متن باشد' })
  @MaxLength(100, { message: 'نام خانوادگی نمی‌تواند بیشتر از ۱۰۰ کاراکتر باشد' })
  lastName!: string;

  @IsOptional()
  @IsString({ message: 'شناسه کاربر نامعتبر است' })
  userId?: string;

  @IsOptional()
  @IsString({ message: 'شناسه شعبه نامعتبر است' })
  branchId?: string;

  @IsOptional()
  @IsString({ message: 'شناسه دپارتمان نامعتبر است' })
  departmentId?: string;

  @IsOptional()
  @IsString({ message: 'شناسه مدیر مستقیم نامعتبر است' })
  managerId?: string;

  @IsOptional()
  @IsString({ message: 'کد ملی باید متن باشد' })
  @MaxLength(20, { message: 'کد ملی نمی‌تواند بیشتر از ۲۰ کاراکتر باشد' })
  nationalId?: string;

  @IsOptional()
  @IsPhoneNumber('IR', { message: 'شماره تماس باید شماره معتبر ایران باشد' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'ایمیل نامعتبر است' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'عنوان شغلی باید متن باشد' })
  @MaxLength(150, { message: 'عنوان شغلی نمی‌تواند بیشتر از ۱۵۰ کاراکتر باشد' })
  jobTitle?: string;

  @IsOptional()
  @IsEnum(EmploymentType, { message: 'نوع استخدام نامعتبر است' })
  employmentType?: EmploymentType;

  @IsOptional()
  @IsEnum(EmployeeStatus, { message: 'وضعیت کارمند نامعتبر است' })
  status?: EmployeeStatus;

  @IsNotEmpty({ message: 'تاریخ استخدام الزامی است' })
  @IsDateString({}, { message: 'تاریخ استخدام نامعتبر است' })
  hiredAt!: string;

  @IsOptional()
  @IsDateString({}, { message: 'تاریخ تولد نامعتبر است' })
  birthDate?: string;

  @IsOptional()
  @IsString({ message: 'آدرس باید متن باشد' })
  address?: string;

  @IsOptional()
  @IsPhoneNumber('IR', { message: 'شماره اضطراری نامعتبر است' })
  emergencyPhone?: string;

  @IsOptional()
  @IsString({ message: 'یادداشت نامعتبر است' })
  notes?: string;

  // --- تنظیمات ساخت هم‌زمان حساب کاربری ---

  @IsOptional()
  @IsBoolean({ message: 'وضعیت ایجاد حساب کاربری باید مقدار بولی (true/false) باشد' })
  createAccount?: boolean;

  @IsOptional()
  @IsString({ message: 'نام کاربری باید متن باشد' })
  @MinLength(3, { message: 'نام کاربری باید حداقل ۳ کاراکتر باشد' })
  @MaxLength(50, { message: 'نام کاربری نمی‌تواند بیشتر از ۵۰ کاراکتر باشد' })
  username?: string;

  @IsOptional()
  @IsString({ message: 'رمز عبور باید متن باشد' })
  @MinLength(6, { message: 'رمز عبور باید حداقل ۶ کاراکتر باشد' })
  password?: string;

  @IsOptional()
  @IsArray({ message: 'نقش‌ها باید به صورت آرایه ارسال شوند' })
  @IsString({ each: true, message: 'شناسه هر نقش باید متن معتبر باشد' })
  roleIds?: string[];
}
