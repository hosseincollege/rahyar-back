/**
 * @file src/core/auth/guards/roles.guard.ts
 * @type backend
 * @description گارد کنترل نقش‌ها برای محدودسازی endpointهای ERP Pro
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

interface AuthenticatedRequest {
  user?: {
    id?: string;
    role?: string;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  /**
   * کلید متادیتایی که Roles decorator باید استفاده کند.
   *
   * نمونه مقدار:
   * @Roles('ADMIN', 'MANAGER')
   */
  private readonly rolesMetadataKey = 'roles';

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      this.rolesMetadataKey,
      [context.getHandler(), context.getClass()],
    );

    /**
     * اگر برای endpoint نقشی تعریف نشده باشد،
     * کنترل دسترسی نقش‌ها لازم نیست.
     */
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const userRole = request.user?.role;

    if (!userRole) {
      throw new ForbiddenException(
        'برای دسترسی به این بخش، نقش کاربر مشخص نیست.',
      );
    }

    const hasRequiredRole = requiredRoles.some(
      (requiredRole) =>
        requiredRole.toLowerCase() === userRole.toLowerCase(),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        'شما مجوز دسترسی به این بخش را ندارید.',
      );
    }

    return true;
  }
}
