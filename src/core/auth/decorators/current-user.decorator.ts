/**
 * @file src/core/auth/decorators/current-user.decorator.ts
 * @type backend
 * @description دکوراتور دسترسی به کاربر احراز هویت‌شده در endpointهای ERP Pro
 */

import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../strategies/jwt.strategy';

export const CurrentUser = createParamDecorator(
  (
    property: keyof AuthenticatedUser | undefined,
    context: ExecutionContext,
  ): AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser] | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();

    const user = request.user;

    if (!user) {
      return undefined;
    }

    if (property) {
      return user[property];
    }

    return user;
  },
);
