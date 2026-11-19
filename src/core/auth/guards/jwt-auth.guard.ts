/**
 * @file src/core/auth/guards/jwt-auth.guard.ts
 * @type backend
 * @description Rahyar backend authentication and setup
 */

import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;
    // GlobalAuthGuard already verified the bearer token before controller
    // guards run. Reuse its request user instead of querying the user and
    // organization membership a second time for the same request.
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { id?: string } }>();
    if (request.user?.id) return true;
    return super.canActivate(context);
  }
}
