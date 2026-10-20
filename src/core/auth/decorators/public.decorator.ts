/**
 * @file src/core/auth/decorators/public.decorator.ts
 * @type backend
 * @description مشخص‌کردن endpointهای عمومی که نیاز به احراز هویت ندارند
 */

import { SetMetadata } from '@nestjs/common';

/**
 * کلید متادیتای endpointهای عمومی
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * دکوراتور عمومی‌کردن یک endpoint یا controller
 *
 * این دکوراتور برای مسیرهایی مانند ورود، ثبت‌نام و health check
 * استفاده می‌شود تا در صورت وجود Global AuthGuard، بدون JWT قابل‌دسترسی باشند.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
