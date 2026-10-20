// backend/src/core/auth/auth.service.ts

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';

type AuthUser = {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: string;
  isSystemUser: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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

    const isFirstUser = (await this.prisma.user.count()) === 0;
    if (!isFirstUser) {
      throw new ForbiddenException('Public registration is disabled.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
        status: isFirstUser ? 'ACTIVE' : 'INVITED',
        isSystemUser: isFirstUser,
      },
    });

    let organizationId: string | null = null;

    if (isFirstUser) {
      const organization = await this.prisma.organization.create({
        data: {
          name: `${user.firstName} ${user.lastName}`.trim(),
          slug: `${user.username}-${user.id}`,
          ownerId: user.id,
          status: 'ACTIVE',
        },
      });

      const membership = await this.prisma.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          status: 'ACTIVE',
        },
      });

      const role = await this.prisma.role.create({
        data: {
          name: 'Super Admin',
          key: 'SUPER_ADMIN',
          description: 'دسترسی کامل مدیر ارشد سیستم',
          scope: 'ORGANIZATION',
          isSystemRole: true,
          organizationId: organization.id,
        },
      });

      await this.prisma.memberRole.create({
        data: {
          memberId: membership.id,
          roleId: role.id,
        },
      });

      organizationId = organization.id;
    }

    return this.createAuthResponse(user, organizationId);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: dto.identifier },
          { email: dto.identifier },
          { phone: dto.identifier },
        ],
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('کاربر یا رمز عبور نادرست است');
    }

    const passwordIsValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordIsValid || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('کاربر یا رمز عبور نادرست است');
    }

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
      }),
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        organizationId,
      },
    };
  }
}
