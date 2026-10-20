/**
 * @file src/core/auth/decorators/roles.decorator.ts
 * @type backend
 * @description دکوراتور تعیین نقش‌های مجاز برای endpointهای ERP Pro
 */

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * تعیین نقش‌های مجاز برای دسترسی به یک controller یا endpoint
 *
 * نمونه:
 * @Roles('ADMIN', 'MANAGER')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 */
export const Roles = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);
