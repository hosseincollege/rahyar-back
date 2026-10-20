/**
 * @file src/core/auth/guards/global-auth.guard.ts
 * @type backend
 * @description گارد سراسری احراز هویت JWT با پشتیبانی از endpointهای عمومی ERP Pro
 */

import {
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class GlobalAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * بررسی می‌کند endpoint یا controller با @Public علامت‌گذاری شده است یا خیر.
   *
   * در صورت عمومی‌بودن endpoint، احراز هویت JWT اجرا نمی‌شود.
   * در غیر این صورت، Passport مسئول استخراج و اعتبارسنجی Bearer Token است.
   */
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
