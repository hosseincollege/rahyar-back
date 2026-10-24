// Path: backend/src/settings/settings.service.ts

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuditAction } from '@prisma/client';

import { PrismaService } from '../core/prisma/prisma.service';
import { normalizeNationalId } from '../core/national-id';
import { CreateOrganizationDto } from './company/dto/create-organization.dto';
import { UpdateOrganizationSettingsDto } from './company/dto/update-organization-settings.dto';
import { UpdateOrganizationAppearanceDto } from './company/dto/update-organization-appearance.dto';
import { CreateBranchDto } from './organization/dto/create-branch.dto';
import { UpdateBranchDto } from './organization/dto/update-branch.dto';
import { CreateDepartmentDto } from './organization/dto/create-department.dto';
import { UpdateDepartmentDto } from './organization/dto/update-department.dto';
import {
  ImportDepartmentItemDto,
  ImportOrganizationDto,
} from './company/dto/import-organization.dto';
import { SaveRoleDto } from './roles/dto/save-role.dto';
import { AuthenticatedUser } from '../core/auth/strategies/jwt.strategy';
import { OrganizationLogoStorageService } from './company/organization-logo-storage.service';
import { ORGANIZATION_ACCENT_COLORS } from './appearance-palette.backup';

const VISITOR_TIME_ZONE = 'Asia/Tehran';

function normalizeOrganizationAccent<T extends { accentPreset: string }>(settings: T) {
  if (settings.accentPreset === 'custom') return settings;
  const preset = settings.accentPreset in ORGANIZATION_ACCENT_COLORS
    ? settings.accentPreset as keyof typeof ORGANIZATION_ACCENT_COLORS
    : 'blue';
  const [accentLightColor, accentDarkColor] = ORGANIZATION_ACCENT_COLORS[preset];
  return { ...settings, accentPreset: preset, accentLightColor, accentDarkColor };
}

function zonedDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: VISITOR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute'), second: value('second') };
}

function startOfZonedDay(year: number, month: number, day: number, reference: Date) {
  const localNow = zonedDateParts(reference);
  const localNowAsUtc = Date.UTC(localNow.year, localNow.month - 1, localNow.day, localNow.hour, localNow.minute, localNow.second);
  const referenceToSecond = Math.floor(reference.getTime() / 1000) * 1000;
  const zoneOffset = localNowAsUtc - referenceToSecond;
  return new Date(Date.UTC(year, month - 1, day) - zoneOffset);
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logoStorage: OrganizationLogoStorageService,
  ) {}

  /** آمار بازدیدکنندگان بر اساس روزهای تقویمی تهران و حضور در پنج دقیقه اخیر. */
  async getPublicStats() {
    if (!this.isVercelRuntime()) return { enabled: false, daily: 0, weekly: 0, monthly: 0, yearly: 0, online: 0, today: 0, week: 0, month: 0, year: 0 };
    const now = new Date();
    const { year, month, day } = zonedDateParts(now);
    const todayStart = startOfZonedDay(year, month, day, now);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const daysSinceSaturday = (weekday + 1) % 7;
    const saturday = new Date(Date.UTC(year, month - 1, day - daysSinceSaturday));
    const weekStart = startOfZonedDay(saturday.getUTCFullYear(), saturday.getUTCMonth() + 1, saturday.getUTCDate(), now);
    const monthStart = startOfZonedDay(year, month, 1, now);
    const yearStart = startOfZonedDay(year, 1, 1, now);
    const onlineSince = new Date(now.getTime() - 5 * 60 * 1000);

    const countUniqueVisitorsSince = async (since: Date) => {
      const visitors = await this.prisma.visit.findMany({
        where: { createdAt: { gte: since } },
        distinct: ['ipAddress'],
        select: { ipAddress: true },
      });
      return visitors.length;
    };

    const [daily, weekly, monthly, yearly, online] = await Promise.all([
      countUniqueVisitorsSince(todayStart),
      countUniqueVisitorsSince(weekStart),
      countUniqueVisitorsSince(monthStart),
      countUniqueVisitorsSince(yearStart),
      this.prisma.visitorPresence.count({ where: { lastSeenAt: { gte: onlineSince } } }),
    ]);

    return { enabled: true, daily, weekly, monthly, yearly, online, today: daily, week: weekly, month: monthly, year: yearly };
  }

  private isVercelRuntime() {
    return process.env.VERCEL === '1' && process.env.VERCEL_ENV !== 'development';
  }

  /**
   * ثبت بازدید کاربر با IP
   */
  async trackVisit(ipAddress: string, userAgent?: string) {
    if (!this.isVercelRuntime()) return { success: true, enabled: false };
    await this.prisma.visit.create({
      data: {
        ipAddress: ipAddress.slice(0, 100),
        userAgent: userAgent ? userAgent.slice(0, 500) : null,
      },
    });
    return { success: true };
  }

  async trackVisitorPresence(visitorId: string, userAgent: string | undefined, ipAddress: string, input?: { sessionId?: string; pageViewId?: string; path?: string; event?: 'ENTER' | 'HEARTBEAT' | 'EXIT' }) {
    if (!this.isVercelRuntime()) return { success: true, enabled: false };
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId)) {
      throw new BadRequestException('شناسه بازدیدکننده معتبر نیست.');
    }
    await this.prisma.visitorPresence.upsert({
      where: { visitorId },
      create: { visitorId, userAgent: userAgent?.slice(0, 500) ?? null },
      update: { lastSeenAt: new Date(), userAgent: userAgent?.slice(0, 500) ?? null },
    });

    if (input?.sessionId && input.pageViewId && input.path && input.event) {
      const sessionId = input.sessionId;
      const pageViewId = input.pageViewId;
      const path = input.path.slice(0, 500);
      const moduleKey = path.split('/').filter(Boolean)[0] || 'home';
      const now = new Date();
      await this.prisma.visitorSession.upsert({
        where: { id: sessionId },
        create: { id: sessionId, ipAddress: ipAddress.slice(0, 100), userAgent: userAgent?.slice(0, 500) ?? null, startedAt: now, lastSeenAt: now },
        update: { lastSeenAt: now, userAgent: userAgent?.slice(0, 500) ?? null, endedAt: input.event === 'EXIT' ? now : null },
      });
      if (input.event === 'ENTER') {
        await this.prisma.visitorPageView.upsert({
          where: { id: pageViewId },
          create: { id: pageViewId, sessionId, path, moduleKey, enteredAt: now, lastSeenAt: now },
          update: {},
        });
      } else {
        const current = await this.prisma.visitorPageView.findUnique({ where: { id: pageViewId }, select: { lastSeenAt: true } });
        if (current) {
          const seconds = Math.max(0, Math.min(60, Math.floor((now.getTime() - current.lastSeenAt.getTime()) / 1000)));
          await this.prisma.visitorPageView.update({ where: { id: pageViewId }, data: { lastSeenAt: now, durationSeconds: { increment: seconds }, ...(input.event === 'EXIT' ? { leftAt: now } : {}) } });
        }
      }
    }
    return { success: true };
  }

  async createOrganization(dto: CreateOrganizationDto, user: AuthenticatedUser) {
    if (!user?.id) {
      throw new ForbiddenException('کاربر احراز هویت نشده است.');
    }

    if (!user.isSystemUser) {
      throw new ForbiddenException(
        'فقط سوپرادمین سیستم می‌تواند سازمان اولیه را ایجاد کند.',
      );
    }

    const existingMembership = await this.prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
      select: {
        id: true,
      },
    });

    if (existingMembership) {
      throw new ConflictException('این کاربر از قبل عضو یک سازمان فعال است.');
    }

    const existingOrganization = await this.prisma.organization.findUnique({
      where: {
        slug: dto.slug,
      },
      select: {
        id: true,
      },
    });

    if (existingOrganization) {
      throw new ConflictException('این شناسه سازمان قبلاً استفاده شده است.');
    }

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          legalName: dto.legalName,
          nationalId: dto.nationalId,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          logoUrl: dto.logoUrl,
          ...(dto.logoTone && { logoTone: dto.logoTone }),
          ...(dto.logoBackground && { logoBackground: dto.logoBackground }),
          ownerId: user.id,
          status: 'ACTIVE',
        },
      });

      const membership = await tx.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });

      return {
        organization,
        membership,
        organizationId: organization.id,
      };
    });
  }

  async getOrganization(id: string, user: AuthenticatedUser) {
    const access = await this.getOrganizationAccess(id, user);
    if (!access.canView) {
      throw new ForbiddenException('مجوز مشاهده اطلاعات این سازمان را ندارید.');
    }
    return this.getOrganizationSettings(id);
  }

  async getOrganizationAccess(id: string, user: AuthenticatedUser) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: id,
        userId: user.id,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      select: {
        organization: { select: { ownerId: true } },
        roles: {
          select: {
            role: {
              select: {
                permissions: {
                  select: { permission: { select: { key: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      const ownedOrganization = await this.prisma.organization.findFirst({
        where: { id, ownerId: user.id, status: 'ACTIVE' },
        select: { id: true },
      });
      if (ownedOrganization) {
        return {
          canView: true,
          canEdit: true,
          canViewRahcom: true,
          canManageRahcom: true,
          canViewAccounting: true,
          canViewHumanResources: true,
        };
      }
      return { canView: false, canEdit: false, canViewRahcom: false, canManageRahcom: false, canViewAccounting: false, canViewHumanResources: false };
    }

    const isOwner = membership.organization.ownerId === user.id;
    const permissions = new Set(
      membership.roles.flatMap((memberRole) =>
        memberRole.role.permissions.map((item) => item.permission.key),
      ),
    );
    const canEdit = isOwner || permissions.has('settings.write');
    const canView = canEdit || permissions.has('settings.read');
    const canManageRahcom = isOwner;
    const canViewRahcom = isOwner;
    const canViewAccounting = isOwner || permissions.has('accounting.read') || permissions.has('accounting.write');
    const canViewHumanResources = isOwner || [...permissions].some((key) => key.startsWith('hr.'));

    return { canView, canEdit, canViewRahcom, canManageRahcom, canViewAccounting, canViewHumanResources };
  }

  async getShellVisibility(id: string, user: AuthenticatedUser) {
    const access = await this.getOrganizationAccess(id, user);
    if (!access.canView) throw new ForbiddenException('Organization access denied.');
    const settings = await this.prisma.organizationSettings.findUnique({ where: { organizationId: id }, select: { shellVisibility: true } });
    return { shellVisibility: settings?.shellVisibility ?? {} };
  }

  async updateShellVisibility(id: string, shellVisibility: Record<string, unknown>, user: AuthenticatedUser) {
    const access = await this.getOrganizationAccess(id, user);
    if (!access.canEdit) throw new ForbiddenException('Organization edit access denied.');
    const settings = await this.prisma.organizationSettings.upsert({
      where: { organizationId: id },
      create: { organizationId: id, shellVisibility: shellVisibility as any },
      update: { shellVisibility: shellVisibility as any },
      select: { shellVisibility: true },
    });
    return { shellVisibility: settings.shellVisibility ?? {} };
  }

  async getOrganizationAppearance(id: string, user: AuthenticatedUser) {
    const access = await this.getOrganizationAccess(id, user);
    if (!access.canView) {
      throw new ForbiddenException('مجوز مشاهده تنظیمات این سازمان را ندارید.');
    }

    const settings = await this.prisma.organizationSettings.upsert({
      where: { organizationId: id },
      create: { organizationId: id },
      update: {},
      select: {
        accentPreset: true,
        accentLightColor: true,
        accentDarkColor: true,
        backgroundStyle: true,
        timezone: true,
        calendar: true,
      },
    });

    return { ...normalizeOrganizationAccent(settings), canEdit: access.canEdit };
  }

  async updateOrganizationAppearance(
    id: string,
    dto: UpdateOrganizationAppearanceDto,
    user: AuthenticatedUser,
  ) {
    const access = await this.getOrganizationAccess(id, user);
    if (!access.canEdit) {
      throw new ForbiddenException('مجوز ویرایش تنظیمات این سازمان را ندارید.');
    }

    try {
      new Intl.DateTimeFormat('en-US', { timeZone: dto.timezone });
    } catch {
      throw new BadRequestException('منطقه زمانی معتبر نیست.');
    }

    const appearance = dto.accentPreset === 'custom'
      ? dto
      : {
          ...dto,
          accentLightColor: ORGANIZATION_ACCENT_COLORS[dto.accentPreset as keyof typeof ORGANIZATION_ACCENT_COLORS][0],
          accentDarkColor: ORGANIZATION_ACCENT_COLORS[dto.accentPreset as keyof typeof ORGANIZATION_ACCENT_COLORS][1],
        };

    const savedAppearance = await this.prisma.organizationSettings.upsert({
      where: { organizationId: id },
      create: { organizationId: id, ...appearance },
      update: appearance,
      select: {
        accentPreset: true,
        accentLightColor: true,
        accentDarkColor: true,
        backgroundStyle: true,
        timezone: true,
        calendar: true,
      },
    });

    return { ...savedAppearance, canEdit: access.canEdit };
  }

  async getOrganizationBranding(id: string, user: AuthenticatedUser) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: id,
        userId: user.id,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      select: {
        organization: { select: { name: true, logoUrl: true, logoTone: true, logoBackground: true } },
      },
    });

    if (!membership) {
      throw new ForbiddenException('کاربر عضو این سازمان فعال نیست.');
    }

    return membership.organization;
  }

  async getPublicBranding(organizationId?: string) {
    return this.prisma.organization.findFirst({
      where: { status: 'ACTIVE', ...(organizationId ? { id: organizationId } : {}) },
      orderBy: { createdAt: 'asc' },
      select: {
        name: true,
        logoUrl: true,
        logoTone: true,
        logoBackground: true,
        settings: {
          select: {
            accentPreset: true,
            accentLightColor: true,
            accentDarkColor: true,
            backgroundStyle: true,
          },
        },
      },
    });
  }

  async uploadOrganizationLogo(
    id: string,
    file: { buffer: Buffer; mimetype: string; size: number },
    user: AuthenticatedUser,
  ) {
    const access = await this.getOrganizationAccess(id, user);
    if (!access.canEdit) {
      throw new ForbiddenException('مجوز ویرایش اطلاعات این سازمان را ندارید.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('حجم لوگو نباید بیشتر از ۵ مگابایت باشد.');
    }

    const organization = await this.getOrganizationSettings(id);
    let logoUrl: string;

    try {
      logoUrl = await this.logoStorage.save(file.buffer, file.mimetype);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('ذخیره لوگو ناموفق بود.');
    }

    try {
      await this.prisma.organization.update({
        where: { id },
        data: { logoUrl },
      });
    } catch (error) {
      await this.logoStorage.remove(logoUrl);
      throw error;
    }

    await this.logoStorage.remove(organization.logoUrl).catch(() => undefined);
    return { logoUrl };
  }

  async getOrganizationSettings(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        branches: true,
        departments: {
          include: {
            branch: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException(`سازمان با شناسه ${id} یافت نشد.`);
    }

    return organization;
  }

  async getRoles(organizationId: string) {
    const roles = await this.prisma.role.findMany({
      where: {
        OR: [
          { organizationId },
          { isSystemRole: true },
        ],
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      key: role.key,
      description: role.description ?? '',
      isSystemRole: role.isSystemRole,
      userCount: role._count.members,
      permissions: role.permissions.map((rp) => rp.permission.key),
    }));
  }

  async saveRoles(organizationId: string, rolesDto: SaveRoleDto[]) {
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });

      if (!org) {
        throw new NotFoundException(`سازمان با شناسه ${organizationId} یافت نشد.`);
      }

      const processedRoleIds: string[] = [];

      for (const item of rolesDto) {
        const roleKey =
          item.key || item.name.trim().toLowerCase().replace(/\s+/g, '_');

        let role;

        if (item.id) {
          role = await tx.role.update({
            where: { id: item.id },
            data: {
              name: item.name,
              description: item.description,
            },
          });
        } else {
          const existingRole = await tx.role.findFirst({
            where: {
              organizationId,
              key: roleKey,
            },
          });

          if (existingRole) {
            role = await tx.role.update({
              where: { id: existingRole.id },
              data: {
                name: item.name,
                description: item.description,
              },
            });
          } else {
            role = await tx.role.create({
              data: {
                organizationId,
                name: item.name,
                key: roleKey,
                description: item.description,
              },
            });
          }
        }

        processedRoleIds.push(role.id);

        if (Array.isArray(item.permissions)) {
          await tx.rolePermission.deleteMany({
            where: { roleId: role.id },
          });

          if (item.permissions.length > 0) {
            const matchedPerms = await tx.permission.findMany({
              where: { key: { in: item.permissions } },
            });

            if (matchedPerms.length > 0) {
              await tx.rolePermission.createMany({
                data: matchedPerms.map((p) => ({
                  roleId: role.id,
                  permissionId: p.id,
                })),
              });
            }
          }
        }
      }

      await tx.role.deleteMany({
        where: {
          organizationId,
          isSystemRole: false,
          id: { notIn: processedRoleIds },
        },
      });

      return this.getRoles(organizationId);
    });
  }

  async getUsers(organizationId: string, user: AuthenticatedUser) {
    const access = await this.getOrganizationAccess(organizationId, user);
    if (!access.canView) {
      throw new ForbiddenException('مجوز مشاهده کاربران این سازمان را ندارید.');
    }

    const users = await this.prisma.user.findMany({
      where: {
        memberships: {
          some: {
            organizationId,
          },
        },
      },
      include: {
        memberships: {
          where: { organizationId },
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => {
      const membership = u.memberships[0];
      const primaryRole = membership?.roles?.[0]?.role;
      const roleName = primaryRole?.name || 'USER';
      const roleKey = primaryRole?.key || 'USER';
      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;

      return {
        id: u.id,
        username: u.username,
        name: fullName,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        nationalId: u.nationalId,
        status: u.status,
        isSystemUser: u.isSystemUser,
        role: roleName,
        roleKey: roleKey,
        roles: membership?.roles?.map((r) => r.role.key) || [roleKey],
        department: 'عمومی',
        isActive: u.status === 'ACTIVE',
      };
    });
  }

  /**
   * پیاده‌سازی متد saveUsers برای ذخیره/درون‌ریزی مطمئن کاربران با پشتیبانی از کلمه عبور و نام کاربری دلخواه
   */
  async saveUsers(
    organizationId: string,
    users: any[],
    actor: AuthenticatedUser,
  ) {
    const access = await this.getOrganizationAccess(organizationId, actor);
    if (!access.canEdit) {
      throw new ForbiddenException('مجوز ویرایش کاربران این سازمان را ندارید.');
    }

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, ownerId: true },
      });

      if (!org) {
        throw new NotFoundException(`سازمان با شناسه ${organizationId} یافت نشد.`);
      }

      // دریافت نقش‌های معتبر سازمان
      const orgRoles = await tx.role.findMany({
        where: {
          OR: [{ organizationId }, { isSystemRole: true }],
        },
      });

      for (const item of users) {
        const nationalId = normalizeNationalId(item.nationalId ?? item.nationalCode);
        let user: any = null;

        if (item.id) {
          user = await tx.user.findUnique({ where: { id: item.id } });
        }
        if (!user && item.email) {
          user = await tx.user.findUnique({ where: { email: item.email.trim().toLowerCase() } });
        }
        if (!user && item.username) {
          user = await tx.user.findUnique({ where: { username: item.username.trim() } });
        }

        const fullName = (item.name || item.fullName || '').trim();
        let derivedFirstName = item.firstName;
        let derivedLastName = item.lastName;

        if (!derivedFirstName && fullName) {
          const parts = fullName.split(/\s+/);
          derivedFirstName = parts[0];
          derivedLastName = parts.slice(1).join(' ') || '-';
        }

        const firstName = derivedFirstName || 'کاربر';
        const lastName = derivedLastName || 'جدید';

        // تطبیق وضعیت با مقادیر معتبر Enumهای Prisma
        const isUserActive = item.isActive !== false && item.status !== 'INACTIVE' && item.status !== 'DISABLED';
        const userStatus: 'ACTIVE' | 'DISABLED' = isUserActive ? 'ACTIVE' : 'DISABLED';
        const membershipStatus: 'ACTIVE' | 'SUSPENDED' = isUserActive ? 'ACTIVE' : 'SUSPENDED';
        const isNewUser = !user;
        const previousUser = user
          ? {
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phone: user.phone,
              nationalId: user.nationalId,
              status: user.status,
            }
          : null;

        if (!user) {
          const password = typeof item.password === 'string' ? item.password.trim() : '';
          if (!password) throw new BadRequestException('Password is required.');
          const email = item.email?.trim().toLowerCase() || null;
          const generatedUsername =
            item.username?.trim() ||
            (email ? email.split('@')[0] : null) ||
            `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

          const passwordHash = await bcrypt.hash(password, 12);

          user = await tx.user.create({
            data: {
              username: generatedUsername,
              firstName,
              lastName,
              email,
              phone: item.phone || null,
              nationalId,
              passwordHash,
              status: userStatus,
            },
          });
        } else {
          const updateData: any = {
            firstName,
            lastName,
            ...(item.phone !== undefined && { phone: item.phone }),
            ...(item.nationalId !== undefined || item.nationalCode !== undefined ? { nationalId } : {}),
            status: userStatus,
          };

          if (item.username && item.username.trim() !== user.username) {
            updateData.username = item.username.trim();
          }

          if (typeof item.password === 'string' && item.password.trim().length > 0) {
            const password = item.password.trim();
            if (!password) throw new BadRequestException('Password is required.');
            updateData.passwordHash = await bcrypt.hash(password, 12);
            updateData.tokenVersion = { increment: 1 };
          }

          user = await tx.user.update({
            where: { id: user.id },
            data: updateData,
          });
        }

        const isOrganizationOwner = user.id === org.ownerId;
        if (isOrganizationOwner && userStatus !== 'ACTIVE') {
          throw new BadRequestException('حساب مالک سازمان را نمی‌توان غیرفعال کرد.');
        }

        // ایجاد یا به‌روزرسانی عضویت در سازمان
        const membership = await tx.organizationMember.upsert({
          where: {
            organizationId_userId: {
              organizationId,
              userId: user.id,
            },
          },
          update: {
            status: membershipStatus,
          },
          create: {
            organizationId,
            userId: user.id,
            status: membershipStatus,
            joinedAt: new Date(),
          },
        });

        if (membershipStatus === 'ACTIVE') {
          const existingProfile = await tx.employee.findFirst({
            where: { organizationId, userId: user.id },
            select: { id: true, nationalId: true },
          });
          if (existingProfile && (item.nationalId !== undefined || item.nationalCode !== undefined)) {
            await tx.employee.update({
              where: { id: existingProfile.id },
              data: { nationalId },
            });
          } else if (!existingProfile && nationalId) {
            const matchingProfiles = await tx.employee.findMany({
              where: { organizationId, nationalId, userId: null },
              select: { id: true },
              take: 2,
            });
            if (matchingProfiles.length === 1) {
              await tx.employee.updateMany({
                where: { id: matchingProfiles[0].id, userId: null },
                data: { userId: user.id },
              });
            }
          }
        }

        // تعیین و انتساب نقش‌ها
        const requestedRoles: string[] = [];
        if (Array.isArray(item.roleIds)) {
          requestedRoles.push(...item.roleIds);
        }
        if (item.role) requestedRoles.push(item.role);
        if (item.roleKey) requestedRoles.push(item.roleKey);
        if (Array.isArray(item.roles)) {
          requestedRoles.push(...item.roles);
        }

        // پیدا کردن ID نقش‌های متناظر
        const matchedRoleIds = orgRoles
          .filter(
            (r) =>
              requestedRoles.includes(r.id) ||
              requestedRoles.includes(r.key) ||
              requestedRoles.includes(r.name),
          )
          .map((r) => r.id);

        // اگر نقشی یافت نشد، نقش پیش‌فرض سیستم انتساب می‌یابد
        if (matchedRoleIds.length === 0 && orgRoles.length > 0) {
          const defaultRole = orgRoles.find((r) => r.key === 'USER') || orgRoles[0];
          matchedRoleIds.push(defaultRole.id);
        }

        let roleChanged = false;
        if (!isOrganizationOwner) {
          const previousRoleIds = await tx.memberRole.findMany({
            where: { memberId: membership.id },
            select: { roleId: true },
          });
          const previousRoleIdSet = new Set(previousRoleIds.map(({ roleId }) => roleId));
          const nextRoleIdSet = new Set(matchedRoleIds);
          roleChanged = previousRoleIdSet.size !== nextRoleIdSet.size ||
            [...previousRoleIdSet].some((roleId) => !nextRoleIdSet.has(roleId));

          await tx.memberRole.deleteMany({ where: { memberId: membership.id } });
          if (matchedRoleIds.length > 0) {
            await tx.memberRole.createMany({
              data: Array.from(nextRoleIdSet).map((roleId) => ({
                memberId: membership.id,
                roleId,
              })),
            });
          }
        }

        const changedFields = isNewUser
          ? ['username', 'firstName', 'lastName', 'email', 'phone', 'status', 'roles', ...(nationalId ? ['nationalId'] : [])]
          : [
              ...(previousUser!.username !== user.username ? ['username'] : []),
              ...(previousUser!.firstName !== user.firstName ? ['firstName'] : []),
              ...(previousUser!.lastName !== user.lastName ? ['lastName'] : []),
              ...(previousUser!.email !== user.email ? ['email'] : []),
              ...(previousUser!.phone !== user.phone ? ['phone'] : []),
              ...(previousUser!.nationalId !== user.nationalId ? ['nationalId'] : []),
              ...(previousUser!.status !== user.status ? ['status'] : []),
              ...(roleChanged ? ['roles'] : []),
              ...(typeof item.password === 'string' && item.password.trim().length > 0 ? ['password'] : []),
            ];

        if (changedFields.length > 0) {
          const action = isNewUser
            ? AuditAction.CREATE
            : previousUser!.status !== user.status
              ? user.status === 'ACTIVE' ? AuditAction.ACTIVATE : AuditAction.DISABLE
              : AuditAction.UPDATE;
          await tx.auditLog.create({
            data: {
              organizationId,
              userId: actor.id,
              action,
              entity: 'USER_ACCOUNT',
              entityId: user.id,
              metadata: {
                username: user.username,
                changedFields,
                ownerAccount: isOrganizationOwner,
              },
            },
          });
        }
      }

      return this.getUsers(organizationId, actor);
    });
  }

  async updateOrganizationSettings(
    id: string,
    dto: UpdateOrganizationSettingsDto,
    user: AuthenticatedUser,
  ) {
    const access = await this.getOrganizationAccess(id, user);
    if (!access.canEdit) {
      throw new ForbiddenException('مجوز ویرایش اطلاعات این سازمان را ندارید.');
    }
    const organization = await this.getOrganizationSettings(id);
    if (dto.status !== undefined && organization.ownerId !== user.id) {
      throw new ForbiddenException(
        'فقط مالک سازمان می‌تواند وضعیت سازمان را تغییر دهد.',
      );
    }

    const updatedOrganization = await this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.legalName !== undefined && { legalName: dto.legalName }),
        ...(dto.nationalId !== undefined && { nationalId: dto.nationalId }),
        ...(dto.registrationNumber !== undefined && { registrationNumber: dto.registrationNumber }),
        ...(dto.economicCode !== undefined && { economicCode: dto.economicCode }),
        ...(dto.taxOffice !== undefined && { taxOffice: dto.taxOffice }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.fiscalYearStart !== undefined && { fiscalYearStart: dto.fiscalYearStart }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.logoTone !== undefined && { logoTone: dto.logoTone }),
        ...(dto.logoBackground !== undefined && { logoBackground: dto.logoBackground }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    if (
      dto.logoUrl !== undefined &&
      dto.logoUrl !== organization.logoUrl
    ) {
      await this.logoStorage.remove(organization.logoUrl).catch(() => undefined);
    }

    return updatedOrganization;
  }

  async getBranches(organizationId: string, user: AuthenticatedUser) {
    const access = await this.getOrganizationAccess(organizationId, user);
    if (!access.canView) {
      throw new ForbiddenException('مجوز مشاهده ساختار سازمانی را ندارید.');
    }

    return this.prisma.branch.findMany({
      where: { organizationId },
    });
  }

  async createBranch(dto: CreateBranchDto, user: AuthenticatedUser) {
    const access = await this.getOrganizationAccess(dto.organizationId, user);
    if (!access.canEdit) {
      throw new ForbiddenException('مجوز مدیریت ساختار سازمانی را ندارید.');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException(
        `سازمان با شناسه ${dto.organizationId} یافت نشد.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isMain) {
        await tx.branch.updateMany({
          where: { organizationId: dto.organizationId, isMain: true },
          data: { isMain: false },
        });
      }

      return tx.branch.create({
        data: {
          name: dto.name,
          code: dto.code,
          address: dto.address,
          phone: dto.phone,
          email: dto.email,
          postalCode: dto.postalCode,
          isMain: dto.isMain ?? false,
          isActive: dto.isActive ?? true,
          organizationId: dto.organizationId,
        },
      });
    });
  }

  async updateBranch(
    id: string,
    dto: UpdateBranchDto,
    user: AuthenticatedUser,
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });

    if (!branch) {
      throw new NotFoundException(`شعبه با شناسه ${id} یافت نشد.`);
    }

    const access = await this.getOrganizationAccess(branch.organizationId, user);
    if (!access.canEdit) {
      throw new ForbiddenException('مجوز مدیریت ساختار سازمانی را ندارید.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isMain === true) {
        await tx.branch.updateMany({
          where: {
            organizationId: branch.organizationId,
            isMain: true,
            id: { not: id },
          },
          data: { isMain: false },
        });
      }

      return tx.branch.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.code !== undefined && { code: dto.code }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
          ...(dto.isMain !== undefined && { isMain: dto.isMain }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    });
  }

  async deleteBranch(id: string, user: AuthenticatedUser) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });

    if (!branch) {
      throw new NotFoundException(`شعبه با شناسه ${id} یافت نشد.`);
    }

    const access = await this.getOrganizationAccess(branch.organizationId, user);
    if (!access.canEdit) {
      throw new ForbiddenException('مجوز مدیریت ساختار سازمانی را ندارید.');
    }

    await this.prisma.$transaction([
      this.prisma.department.updateMany({
        where: { branchId: id },
        data: { branchId: null },
      }),
      this.prisma.branch.delete({
        where: { id },
      }),
    ]);

    return { message: 'شعبه با موفقیت حذف شد.', id };
  }

  async getDepartments(organizationId: string, user: AuthenticatedUser) {
    const access = await this.getOrganizationAccess(organizationId, user);
    if (!access.canView) {
      throw new ForbiddenException('مجوز مشاهده ساختار سازمانی را ندارید.');
    }

    return this.prisma.department.findMany({
      where: { organizationId },
      include: { branch: true },
    });
  }

  async createDepartment(dto: CreateDepartmentDto, user: AuthenticatedUser) {
    const access = await this.getOrganizationAccess(dto.organizationId, user);
    if (!access.canEdit) {
      throw new ForbiddenException('مجوز مدیریت ساختار سازمانی را ندارید.');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException(
        `سازمان با شناسه ${dto.organizationId} یافت نشد.`,
      );
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, organizationId: dto.organizationId },
        select: { id: true },
      });

      if (!branch) {
        throw new NotFoundException(
          'شعبه انتخاب‌شده متعلق به این سازمان نیست یا وجود ندارد.',
        );
      }
    }

    return this.prisma.department.create({
      data: {
        name: dto.name,
        code: dto.code,
        isActive: dto.isActive ?? true,
        organizationId: dto.organizationId,
        branchId: dto.branchId,
      },
    });
  }

  async updateDepartment(
    id: string,
    dto: UpdateDepartmentDto,
    user: AuthenticatedUser,
  ) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });

    if (!department) {
      throw new NotFoundException(`دپارتمان با شناسه ${id} یافت نشد.`);
    }

    const access = await this.getOrganizationAccess(department.organizationId, user);
    if (!access.canEdit) {
      throw new ForbiddenException('مجوز مدیریت ساختار سازمانی را ندارید.');
    }

    if (dto.branchId !== undefined && dto.branchId !== null) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: dto.branchId,
          organizationId: department.organizationId,
        },
        select: { id: true },
      });

      if (!branch) {
        throw new NotFoundException(
          'شعبه انتخاب‌شده متعلق به سازمان دپارتمان نیست یا وجود ندارد.',
        );
      }
    }

    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.branchId !== undefined && { branchId: dto.branchId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteDepartment(id: string, user: AuthenticatedUser) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });

    if (!department) {
      throw new NotFoundException(`دپارتمان با شناسه ${id} یافت نشد.`);
    }

    const access = await this.getOrganizationAccess(department.organizationId, user);
    if (!access.canEdit) {
      throw new ForbiddenException('مجوز مدیریت ساختار سازمانی را ندارید.');
    }

    await this.prisma.department.delete({
      where: { id },
    });

    return { message: 'دپارتمان با موفقیت حذف شد.', id };
  }

  async importOrganizationData(
    organizationId: string,
    dto: ImportOrganizationDto,
    user: AuthenticatedUser,
  ) {
    const access = await this.getOrganizationAccess(organizationId, user);
    if (!access.canEdit) {
      throw new ForbiddenException('مجوز ویرایش اطلاعات این سازمان را ندارید.');
    }
    await this.getOrganizationSettings(organizationId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.organization) {
        await tx.organization.update({
          where: { id: organizationId },
          data: {
            ...(dto.organization.name !== undefined && { name: dto.organization.name }),
            ...(dto.organization.legalName !== undefined && { legalName: dto.organization.legalName }),
            ...(dto.organization.nationalId !== undefined && { nationalId: dto.organization.nationalId }),
            ...(dto.organization.registrationNumber !== undefined && { registrationNumber: dto.organization.registrationNumber }),
            ...(dto.organization.economicCode !== undefined && { economicCode: dto.organization.economicCode }),
            ...(dto.organization.taxOffice !== undefined && { taxOffice: dto.organization.taxOffice }),
            ...(dto.organization.phone !== undefined && { phone: dto.organization.phone }),
            ...(dto.organization.email !== undefined && { email: dto.organization.email }),
            ...(dto.organization.website !== undefined && { website: dto.organization.website }),
            ...(dto.organization.address !== undefined && { address: dto.organization.address }),
            ...(dto.organization.postalCode !== undefined && { postalCode: dto.organization.postalCode }),
            ...(dto.organization.currency !== undefined && { currency: dto.organization.currency }),
            ...(dto.organization.fiscalYearStart !== undefined && { fiscalYearStart: dto.organization.fiscalYearStart }),
            ...(dto.organization.logoUrl !== undefined && { logoUrl: dto.organization.logoUrl }),
            ...(dto.organization.logoTone !== undefined && { logoTone: dto.organization.logoTone }),
            ...(dto.organization.logoBackground !== undefined && { logoBackground: dto.organization.logoBackground }),
          },
        });
      }

      const branchIdByName = new Map<string, string>();
      const warnings: string[] = [];

      if (dto.branches && dto.branches.length > 0) {
        const mainBranches = dto.branches.filter((b) => b.isMain === true);
        if (mainBranches.length > 1) {
          throw new ConflictException('فقط یک شعبه می‌تواند به عنوان شعبه اصلی (isMain) مشخص شود.');
        }

        for (const branch of dto.branches) {
          const data = {
            name: branch.name,
            code: branch.code,
            address: branch.address,
            phone: branch.phone,
            email: branch.email,
            postalCode: branch.postalCode,
            isMain: branch.isMain ?? false,
            isActive: branch.isActive ?? true,
          };

          let savedBranch;
          if (branch.id) {
            savedBranch = await tx.branch.upsert({
              where: { id: branch.id },
              update: data,
              create: { ...data, id: branch.id, organizationId },
            });
          } else {
            savedBranch = await tx.branch.upsert({
              where: {
                organizationId_code: {
                  organizationId,
                  code: branch.code,
                },
              },
              update: data,
              create: { ...data, organizationId },
            });
          }
          branchIdByName.set(branch.name, savedBranch.id);
        }

        if (mainBranches.length === 0) {
          const firstBranchId = branchIdByName.values().next().value;
          if (firstBranchId) {
            await tx.branch.update({
              where: { id: firstBranchId },
              data: { isMain: true },
            });
          }
        } else {
          const designatedMainId = branchIdByName.get(mainBranches[0].name);
          if (designatedMainId) {
            await tx.branch.updateMany({
              where: {
                organizationId,
                isMain: true,
                id: { not: designatedMainId },
              },
              data: { isMain: false },
            });
          }
        }
      } else {
        const existing = await tx.branch.findMany({
          where: { organizationId },
          select: { id: true, name: true },
        });
        for (const b of existing) branchIdByName.set(b.name, b.id);
      }

      const resolveBranchId = (
        dept: ImportDepartmentItemDto,
      ): string | null => {
        if (dept.branchId) return dept.branchId;
        if (dept.branchName) {
          const resolved = branchIdByName.get(dept.branchName);
          if (!resolved) {
            warnings.push(
              `شعبه «${dept.branchName}» برای دپارتمان «${dept.name}» یافت نشد؛ دپارتمان بدون انتساب شعبه ذخیره شد.`,
            );
          }
          return resolved ?? null;
        }
        return null;
      };

      if (dto.departments && dto.departments.length > 0) {
        for (const dept of dto.departments) {
          const branchId = resolveBranchId(dept);
          const data = {
            name: dept.name,
            code: dept.code,
            branchId,
            isActive: dept.isActive ?? true,
          };

          if (dept.id) {
            await tx.department.upsert({
              where: { id: dept.id },
              update: data,
              create: { ...data, id: dept.id, organizationId },
            });
          } else {
            await tx.department.upsert({
              where: {
                organizationId_code: {
                  organizationId,
                  code: dept.code,
                },
              },
              update: data,
              create: { ...data, organizationId },
            });
          }
        }
      }

      const result = await tx.organization.findUnique({
        where: { id: organizationId },
        include: {
          branches: true,
          departments: { include: { branch: true } },
        },
      });

      return { ...result, warnings };
    });
  }
}
