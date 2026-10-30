// backend/src/core/auth/auth.service.ts

import {
  ForbiddenException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHmac } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { normalizeNationalId } from '../national-id';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastLoginRateCleanupAt = 0;

type AuthUser = {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  status: string;
  isSystemUser: boolean;
  tokenVersion: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: dto.username },
          ...(dto.email ? [{ email: dto.email }] : []),
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
    });

    if (existingUser) {
      throw new ConflictException('کاربری با این مشخصات قبلاً ثبت شده است');
    }

    const { user, organizationId } = await this.prisma.$transaction(async (tx) => {
      if (await tx.user.count() > 0) {
        throw new ForbiddenException('ثبت‌نام عمومی بسته است؛ حساب کاربری را مالک سامانه ایجاد می‌کند.');
      }

      const passwordHash = await bcrypt.hash(dto.password, 12);
      const user = await tx.user.create({
        data: {
          username: dto.username,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          nationalId: normalizeNationalId(dto.nationalCode),
          firstName: dto.firstName,
          lastName: dto.lastName,
          passwordHash,
          status: 'ACTIVE',
          isSystemUser: true,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: `${user.firstName} ${user.lastName}`.trim(),
          slug: `${user.username}-${user.id}`,
          ownerId: user.id,
          status: 'ACTIVE',
        },
      });

      const membership = await tx.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          status: 'ACTIVE',
        },
      });

      const role = await tx.role.create({
        data: {
          name: 'Super Admin',
          key: 'SUPER_ADMIN',
          description: 'دسترسی کامل مدیر ارشد سیستم',
          scope: 'ORGANIZATION',
          isSystemRole: true,
          organizationId: organization.id,
        },
      });

      await tx.memberRole.create({
        data: {
          memberId: membership.id,
          roleId: role.id,
        },
      });

      return { user, organizationId: organization.id };
    }, { isolationLevel: 'Serializable' });
    return this.createAuthResponse(user, organizationId);
  }

  async login(dto: LoginDto) {
    const keyHash = this.getLoginRateLimitKey(dto.identifier);
    await this.ensureLoginAllowed(keyHash);

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: dto.identifier },
          { email: dto.identifier },
          { phone: dto.identifier },
        ],
      },
    });

    const passwordIsValid = user?.passwordHash
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : await this.compareAgainstDummyHash(dto.password);

    if (!user || !passwordIsValid || user.status !== 'ACTIVE') {
      await this.recordLoginFailure(keyHash);
      throw new UnauthorizedException('\u06a9\u0627\u0631\u0628\u0631 \u06cc\u0627 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0646\u0627\u062f\u0631\u0633\u062a \u0627\u0633\u062a.');
    }

    await this.prisma.authLoginAttempt.deleteMany({ where: { keyHash } });

    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      orderBy: { createdAt: 'asc' },
      select: { organizationId: true },
    });

    return this.createAuthResponse(user, membership?.organizationId ?? null);
  }

  private dummyPasswordHash: Promise<string> | null = null;

  private async compareAgainstDummyHash(password: string): Promise<boolean> {
    this.dummyPasswordHash ??= bcrypt.hash('not-a-real-rahyar-account-password', 12);
    return bcrypt.compare(password, await this.dummyPasswordHash);
  }

  private getLoginRateLimitKey(identifier: string): string {
    const secret = this.configService.get<string>('JWT_SECRET') ?? process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is required to protect login attempt keys.');
    const normalizedIdentifier = identifier.trim().normalize('NFKC').toLocaleLowerCase('en-US');
    return createHmac('sha256', secret).update(normalizedIdentifier).digest('hex');
  }

  private async ensureLoginAllowed(keyHash: string): Promise<void> {
    const bucket = await this.prisma.authLoginAttempt.findUnique({ where: { keyHash } });
    if (!bucket) return;
    const expired = Date.now() - bucket.windowStartedAt.getTime() >= LOGIN_WINDOW_MS;
    if (!expired && bucket.attempts >= LOGIN_LIMIT) {
      throw new HttpException('AUTH_RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async recordLoginFailure(keyHash: string): Promise<void> {
    const now = new Date();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const bucket = await tx.authLoginAttempt.findUnique({ where: { keyHash } });
          if (!bucket) {
            await tx.authLoginAttempt.create({ data: { keyHash, attempts: 1, windowStartedAt: now } });
          } else if (now.getTime() - bucket.windowStartedAt.getTime() >= LOGIN_WINDOW_MS) {
            await tx.authLoginAttempt.update({ where: { keyHash }, data: { attempts: 1, windowStartedAt: now } });
          } else {
            await tx.authLoginAttempt.update({ where: { keyHash }, data: { attempts: { increment: 1 } } });
          }
        }, { isolationLevel: 'Serializable' });

        if (now.getTime() - lastLoginRateCleanupAt >= LOGIN_RATE_CLEANUP_INTERVAL_MS) {
          lastLoginRateCleanupAt = now.getTime();
          try {
            await this.prisma.authLoginAttempt.deleteMany({
              where: { windowStartedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
            });
          } catch {
            // Cleanup is best effort; failed-login tracking remains committed.
          }
        }
        return;
      } catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
        if ((code !== 'P2034' && code !== 'P2002') || attempt === 2) throw error;
      }
    }
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.status !== 'ACTIVE') {
      return null;
    }

    return user;
  }

  async getMe(userId: string) {
    const user = await this.validateUser(userId);

    if (!user) {
      throw new UnauthorizedException(
        'کاربر یافت نشد یا حساب کاربری فعال نیست',
      );
    }

    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      orderBy: { createdAt: 'asc' },
      select: { organizationId: true },
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        email: user.email,
        phone: user.phone,
        organizationId: membership?.organizationId ?? null,
      },
    };
  }

  async updateMe(userId: string, dto: UpdateOwnProfileDto) {
    const user = await this.validateUser(userId);
    if (!user) throw new UnauthorizedException('حساب کاربری فعال نیست');

    const firstName = dto.firstName?.trim();
    const lastName = dto.lastName?.trim();
    const phone =
      dto.phone === undefined ? undefined : dto.phone?.trim() || null;

    if (phone) {
      const existing = await this.prisma.user.findFirst({
        where: { phone, id: { not: userId } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('این شماره تلفن قبلاً ثبت شده است');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.user.update({
        where: { id: userId },
        data: {
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
          ...(phone !== undefined ? { phone } : {}),
        },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          email: true,
          phone: true,
        },
      });

      if (firstName || lastName) {
        await tx.employee.updateMany({
          where: { userId },
          data: {
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
          },
        });
      }

      return profile;
    });

    return { user: updated };
  }

  async getOrganizationDirectory(userId: string) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      orderBy: { createdAt: 'asc' },
      select: { organizationId: true },
    });

    if (!membership) return null;

    const [organization, employees] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: membership.organizationId },
        select: {
          id: true,
          name: true,
          legalName: true,
          phone: true,
          email: true,
          website: true,
          address: true,
          branches: {
            where: { isActive: true },
            orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
            select: {
              id: true,
              name: true,
              code: true,
              address: true,
              phone: true,
              email: true,
              isMain: true,
            },
          },
          departments: {
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: {
              id: true,
              name: true,
              code: true,
              branchId: true,
              branch: { select: { id: true, name: true } },
              manager: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  jobTitle: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.employee.findMany({
        where: {
          organizationId: membership.organizationId,
          status: { in: ['ACTIVE', 'ON_LEAVE'] },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          jobTitle: true,
          status: true,
          employeeCode: true,
          branchId: true,
          departmentId: true,
          managerId: true,
          branch: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
            },
          },
        },
      }),
    ]);

    if (!organization) return null;
    return { organization, employees };
  }

  async getPreferences(userId: string) {
    return this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: {
        locale: true,
        lightContrast: true,
        darkContrast: true,
        lightBrightness: true,
        darkBrightness: true,
        workspaceMode: true,
      },
    });
  }

  async updatePreferences(userId: string, dto: UpdateUserPreferencesDto) {
    return this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
      select: {
        locale: true,
        lightContrast: true,
        darkContrast: true,
        lightBrightness: true,
        darkBrightness: true,
        workspaceMode: true,
      },
    });
  }

  async updateWorkspaceMode(userId: string, workspaceMode: 'FORM' | 'COMMAND' | 'AI') {
    return this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, workspaceMode },
      update: { workspaceMode },
      select: { workspaceMode: true },
    });
  }

  private createAuthResponse(user: AuthUser, organizationId: string | null) {
    return {
      access_token: this.jwtService.sign({
        sub: user.id,
        username: user.username,
        organizationId: organizationId ?? undefined,
        tokenVersion: user.tokenVersion,
      }),
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        email: user.email,
        organizationId,
      },
    };
  }
}
