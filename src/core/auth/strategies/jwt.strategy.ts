/**
 * File: backend/src/core/auth/strategies/jwt.strategy.ts
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';

export type JwtPayload = {
  sub: string;
  username?: string;
  organizationId?: string;
  impersonatedBy?: string;
  impersonationOrganizationId?: string;
  iat?: number;
  exp?: number;
};

export type AuthenticatedUser = {
  id: string;
  username: string;
  email: string | null;
  firstName: string;
  lastName: string;
  status: string;
  isSystemUser: boolean;
  organizationId: string | null;
  impersonatedBy?: string;
  impersonationOrganizationId?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const jwtSecret =
      configService.get<string>('JWT_SECRET') ||
      process.env.JWT_SECRET ||
      'erp-pro-secret';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub) {
      throw new UnauthorizedException('توکن احراز هویت نامعتبر است');
    }

    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException('کاربر یافت نشد یا حساب کاربری فعال نیست');
    }

    let organizationId: string | null = null;

    if (payload.organizationId) {
      const membership = await this.prisma.organizationMember.findFirst({
        where: {
          userId: user.id,
          organizationId: payload.organizationId,
          status: 'ACTIVE',
          organization: {
            status: 'ACTIVE',
          },
        },
        select: {
          organizationId: true,
        },
      });

      organizationId = membership?.organizationId ?? null;
    }

    if (!organizationId) {
      const activeMembership = await this.prisma.organizationMember.findFirst({
        where: {
          userId: user.id,
          status: 'ACTIVE',
          organization: {
            status: 'ACTIVE',
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          organizationId: true,
        },
      });

      organizationId = activeMembership?.organizationId ?? null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      isSystemUser: user.isSystemUser,
      organizationId,
      impersonatedBy: payload.impersonatedBy,
      impersonationOrganizationId: payload.impersonationOrganizationId,
    };
  }
}
