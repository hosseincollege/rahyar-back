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
import { Prisma, type Branch, type Role, type User } from '@prisma/client';

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
import { SaveRoleDto } from './save-role.dto';
import { AuthenticatedUser } from '../core/auth/jwt.strategy';
import { OrganizationLogoStorageService } from './company/organization-logo-storage.service';
import { ORGANIZATION_ACCENT_COLORS } from './appearance-palette.backup';

const VISITOR_TIME_ZONE = 'Asia/Tehran';

type SaveUserInput = {
  id?: string;
  nationalId?: string | null;
  nationalCode?: string | null;
  email?: string | null;
  username?: string;
  name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  status?: string;
  password?: string;
  phone?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  roleIds?: string[];
  role?: string | null;
  roleKey?: string | null;
  roles?: Array<
    | string
    | { id?: string; key?: string; name?: string; description?: string | null }
  >;
  department?: string;
  branchName?: string;
  departmentName?: string;
  isSystemUser?: boolean;
};

function isSaveUserRole(
  value: unknown,
): value is NonNullable<SaveUserInput['roles']>[number] {
  if (typeof value === 'string') return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const role = value as Record<string, unknown>;
  const allowedKeys = new Set(['id', 'key', 'name', 'description']);
  return (
    Object.keys(role).every((key) => allowedKeys.has(key)) &&
    ['id', 'key', 'name'].every(
      (key) => role[key] === undefined || typeof role[key] === 'string',
    ) &&
    (role.description === undefined ||
      role.description === null ||
      typeof role.description === 'string')
  );
}

function parseSaveUserInput(value: unknown): SaveUserInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Invalid user entry.');
  }

  const item = value as Record<string, unknown>;
  const allowedFields = new Set([
    'id',
    'nationalId',
    'nationalCode',
    'email',
    'username',
    'name',
    'fullName',
    'firstName',
    'lastName',
    'isActive',
    'isSystemUser',
    'status',
    'password',
    'phone',
    'branchId',
    'departmentId',
    'roleIds',
    'role',
    'roleKey',
    'roles',
    'department',
    'branchName',
    'departmentName',
  ]);
  const unknownField = Object.keys(item).find((key) => !allowedFields.has(key));
  if (unknownField) {
    throw new BadRequestException(`Unknown user field: ${unknownField}.`);
  }
  const requiredStringFields = [
    'id',
    'username',
    'name',
    'fullName',
    'firstName',
    'lastName',
    'status',
    'password',
  ] as const;
  const nullableStringFields = [
    'nationalId',
    'nationalCode',
    'email',
    'phone',
    'branchId',
    'departmentId',
    'role',
    'roleKey',
  ] as const;

  for (const key of requiredStringFields) {
    if (item[key] !== undefined && typeof item[key] !== 'string') {
      throw new BadRequestException(`Invalid user field: ${key}.`);
    }
  }
  for (const key of nullableStringFields) {
    if (
      item[key] !== undefined &&
      item[key] !== null &&
      typeof item[key] !== 'string'
    ) {
      throw new BadRequestException(`Invalid user field: ${key}.`);
    }
  }
  if (typeof item.password === 'string' && item.password.length > 0) {
    const passwordBytes = Buffer.byteLength(item.password, 'utf8');
    if (item.password.length < 8 || passwordBytes > 72) {
      throw new BadRequestException(
        'Password must contain at least 8 characters and no more than 72 UTF-8 bytes.',
      );
    }
  }
  if (item.isActive !== undefined && typeof item.isActive !== 'boolean') {
    throw new BadRequestException('Invalid user field: isActive.');
  }
  if (
    item.isSystemUser !== undefined &&
    typeof item.isSystemUser !== 'boolean'
  ) {
    throw new BadRequestException('Invalid user field: isSystemUser.');
  }
  for (const key of ['department', 'branchName', 'departmentName'] as const) {
    if (item[key] !== undefined && typeof item[key] !== 'string') {
      throw new BadRequestException(`Invalid user field: ${key}.`);
    }
  }
  if (
    item.roleIds !== undefined &&
    (!Array.isArray(item.roleIds) ||
      !item.roleIds.every((roleId) => typeof roleId === 'string'))
  ) {
    throw new BadRequestException('Invalid user field: roleIds.');
  }
  if (
    item.roles !== undefined &&
    (!Array.isArray(item.roles) || !item.roles.every(isSaveUserRole))
  ) {
    throw new BadRequestException('Invalid user field: roles.');
  }

  const optionalText = (key: string) =>
    typeof item[key] === 'string' ? item[key] : undefined;
  const optionalNullableText = (key: string) =>
    typeof item[key] === 'string' || item[key] === null ? item[key] : undefined;
  return {
    id: optionalText('id'),
    nationalId: optionalNullableText('nationalId'),
    nationalCode: optionalNullableText('nationalCode'),
    email: optionalNullableText('email'),
    username: optionalText('username'),
    name: optionalText('name'),
    fullName: optionalText('fullName'),
    firstName: optionalText('firstName'),
    lastName: optionalText('lastName'),
    isActive: typeof item.isActive === 'boolean' ? item.isActive : undefined,
    isSystemUser:
      typeof item.isSystemUser === 'boolean' ? item.isSystemUser : undefined,
    status: optionalText('status'),
    password: optionalText('password'),
    phone: optionalNullableText('phone'),
    branchId: optionalNullableText('branchId'),
    departmentId: optionalNullableText('departmentId'),
    roleIds: Array.isArray(item.roleIds)
      ? item.roleIds.filter(
          (roleId): roleId is string => typeof roleId === 'string',
        )
      : undefined,
    role: optionalNullableText('role'),
    roleKey: optionalNullableText('roleKey'),
    roles: Array.isArray(item.roles)
      ? item.roles.filter(isSaveUserRole)
      : undefined,
    department: optionalText('department'),
    branchName: optionalText('branchName'),
    departmentName: optionalText('departmentName'),
  };
}

function parseSaveRoleInput(value: unknown): SaveRoleDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Invalid role entry.');
  }

  const item = value as Record<string, unknown>;
  const allowedFields = new Set([
    'id',
    'name',
    'key',
    'description',
    'permissions',
  ]);
  const unknownField = Object.keys(item).find(
    (field) => !allowedFields.has(field),
  );
  if (unknownField) {
    throw new BadRequestException(`Unknown role field: ${unknownField}.`);
  }

  if (
    typeof item.name !== 'string' ||
    !item.name.trim() ||
    item.name.trim().length > 120
  ) {
    throw new BadRequestException(
      'Role name must contain 1 to 120 characters.',
    );
  }
  for (const field of ['id', 'key', 'description'] as const) {
    const fieldValue = item[field];
    const maxLength = field === 'description' ? 1000 : 120;
    if (
      fieldValue !== undefined &&
      (typeof fieldValue !== 'string' || fieldValue.length > maxLength)
    ) {
      throw new BadRequestException(`Invalid role field: ${field}.`);
    }
  }
  if (typeof item.key === 'string' && item.key !== item.key.trim()) {
    throw new BadRequestException(
      'Role key cannot contain surrounding spaces.',
    );
  }
  if (
    !Array.isArray(item.permissions) ||
    item.permissions.length > 100 ||
    !item.permissions.every(
      (permission) =>
        typeof permission === 'string' &&
        permission.length > 0 &&
        permission.length <= 120,
    ) ||
    new Set(item.permissions).size !== item.permissions.length
  ) {
    throw new BadRequestException('Invalid role permissions.');
  }

  return {
    ...(typeof item.id === 'string' ? { id: item.id } : {}),
    name: item.name.trim(),
    ...(typeof item.key === 'string' ? { key: item.key } : {}),
    ...(typeof item.description === 'string'
      ? { description: item.description.trim() }
      : {}),
    permissions: item.permissions as string[],
  };
}

function assertRolePermissionDelegation(
  canManageAllPermissions: boolean,
  grantablePermissionKeys: Set<string>,
  currentPermissionKeys: Set<string>,
  requestedPermissionKeys: string[],
) {
  if (canManageAllPermissions) return;

  const requested = new Set(requestedPermissionKeys);
  const affectedPermissions = new Set([...currentPermissionKeys, ...requested]);
  const unauthorizedChange = [...affectedPermissions].some(
    (permissionKey) =>
      !grantablePermissionKeys.has(permissionKey) &&
      currentPermissionKeys.has(permissionKey) !== requested.has(permissionKey),
  );
  if (unauthorizedChange) {
    throw new ForbiddenException(
      'Only permissions already assigned to the current user can be granted or changed.',
    );
  }
}

function parseShellVisibility(value: unknown): Prisma.InputJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Invalid shell visibility settings.');
  }

  const parsed: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'boolean') {
      parsed[key] = entry;
      continue;
    }
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      parsed[key] = parseShellVisibility(entry);
      continue;
    }
    throw new BadRequestException(`Invalid shell visibility value: ${key}.`);
  }
  return parsed;
}

function normalizeOrganizationAccent<T extends { accentPreset: string }>(
  settings: T,
) {
  if (settings.accentPreset === 'custom') return settings;
  const preset =
    settings.accentPreset in ORGANIZATION_ACCENT_COLORS
      ? (settings.accentPreset as keyof typeof ORGANIZATION_ACCENT_COLORS)
      : 'blue';
  const [accentLightColor, accentDarkColor] =
    ORGANIZATION_ACCENT_COLORS[preset];
  return {
    ...settings,
    accentPreset: preset,
    accentLightColor,
    accentDarkColor,
  };
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
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function startOfZonedDay(
  year: number,
  month: number,
  day: number,
  reference: Date,
) {
  const localNow = zonedDateParts(reference);
  const localNowAsUtc = Date.UTC(
    localNow.year,
    localNow.month - 1,
    localNow.day,
    localNow.hour,
    localNow.minute,
    localNow.second,
  );
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

  private async serializableStructureWrite<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        throw new ConflictException(
          'ساختار سازمانی هم‌زمان تغییر کرده است. فهرست را تازه‌سازی و دوباره تلاش کنید.',
        );
      throw error;
    }
  }

  /** آمار بازدیدکنندگان بر اساس روزهای تقویمی تهران و حضور در پنج دقیقه اخیر. */
  async getPublicStats() {
    if (!this.isVercelRuntime())
      return {
        enabled: false,
        daily: 0,
        weekly: 0,
        monthly: 0,
        yearly: 0,
        online: 0,
        today: 0,
        week: 0,
        month: 0,
        year: 0,
      };
    const now = new Date();
    const { year, month, day } = zonedDateParts(now);
    const todayStart = startOfZonedDay(year, month, day, now);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const daysSinceSaturday = (weekday + 1) % 7;
    const saturday = new Date(
      Date.UTC(year, month - 1, day - daysSinceSaturday),
    );
    const weekStart = startOfZonedDay(
      saturday.getUTCFullYear(),
      saturday.getUTCMonth() + 1,
      saturday.getUTCDate(),
      now,
    );
    const monthStart = startOfZonedDay(year, month, 1, now);
    const yearStart = startOfZonedDay(year, 1, 1, now);
    const onlineSince = new Date(now.getTime() - 5 * 60 * 1000);

    const [visitCounts, online] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          daily: bigint;
          weekly: bigint;
          monthly: bigint;
          yearly: bigint;
        }>
      >(Prisma.sql`SELECT
        COUNT(DISTINCT "ipAddress") FILTER (WHERE "createdAt" >= ${todayStart}) AS daily,
        COUNT(DISTINCT "ipAddress") FILTER (WHERE "createdAt" >= ${weekStart}) AS weekly,
        COUNT(DISTINCT "ipAddress") FILTER (WHERE "createdAt" >= ${monthStart}) AS monthly,
        COUNT(DISTINCT "ipAddress") AS yearly
        FROM "visits"
        WHERE "createdAt" >= ${yearStart}`),
      this.prisma.visitorPresence.count({
        where: { lastSeenAt: { gte: onlineSince } },
      }),
    ]);
    const [visitCountsRow] = visitCounts;
    const daily = Number(visitCountsRow?.daily ?? 0n);
    const weekly = Number(visitCountsRow?.weekly ?? 0n);
    const monthly = Number(visitCountsRow?.monthly ?? 0n);
    const yearly = Number(visitCountsRow?.yearly ?? 0n);

    return {
      enabled: true,
      daily,
      weekly,
      monthly,
      yearly,
      online,
      today: daily,
      week: weekly,
      month: monthly,
      year: yearly,
    };
  }

  private isVercelRuntime() {
    return (
      process.env.VERCEL === '1' && process.env.VERCEL_ENV !== 'development'
    );
  }

  /**
   * ثبت بازدید کاربر با IP
   */
  async trackVisit(ipAddress: string, userAgent?: string) {
    if (!this.isVercelRuntime()) return { success: true, enabled: false };
    const normalizedIpAddress = ipAddress.slice(0, 100);
    const now = new Date();
    const { year, month, day } = zonedDateParts(now);
    const dayStart = startOfZonedDay(year, month, day, now);

    await this.prisma.$transaction(async (tx) => {
      // Serialize same-IP visit checks across app instances so concurrent
      // page requests cannot create duplicate rows for the same Tehran day.
      await tx.$queryRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${normalizedIpAddress}, 0))
      `);
      const existingVisit = await tx.visit.findFirst({
        where: {
          ipAddress: normalizedIpAddress,
          createdAt: { gte: dayStart },
        },
        select: { id: true },
      });
      if (existingVisit) return;

      await tx.visit.create({
        data: {
          ipAddress: normalizedIpAddress,
          userAgent: userAgent ? userAgent.slice(0, 500) : null,
        },
      });
    });
    return { success: true };
  }

  async trackVisitorPresence(
    visitorId: string,
    userAgent: string | undefined,
    ipAddress: string,
    input?: {
      sessionId?: string;
      pageViewId?: string;
      path?: string;
      event?: 'ENTER' | 'HEARTBEAT' | 'EXIT';
    },
  ) {
    if (!this.isVercelRuntime()) return { success: true, enabled: false };
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        visitorId,
      )
    ) {
      throw new BadRequestException('شناسه بازدیدکننده معتبر نیست.');
    }
    await this.prisma.$transaction(async (tx) => {
      if (input?.sessionId && input.pageViewId && input.path && input.event) {
        const sessionId = input.sessionId;
        const pageViewId = input.pageViewId;
        const path = input.path.slice(0, 500);
        const moduleKey = path.split('/').filter(Boolean)[0] || 'home';
        const now = new Date();
        const [existingSession, existingPageView] = await Promise.all([
          tx.visitorSession.findUnique({
            where: { id: sessionId },
            select: { visitorId: true },
          }),
          input.event === 'ENTER'
            ? tx.visitorPageView.findUnique({
                where: { id: pageViewId },
                select: { sessionId: true },
              })
            : Promise.resolve(null),
        ]);
        if (existingSession && existingSession.visitorId !== visitorId) {
          throw new BadRequestException(
            'شناسه جلسه به این بازدیدکننده تعلق ندارد.',
          );
        }
        if (existingPageView && existingPageView.sessionId !== sessionId) {
          throw new BadRequestException('شناسه صفحه به این جلسه تعلق ندارد.');
        }

        if (!existingSession) {
          await tx.visitorSession.create({
            data: {
              id: sessionId,
              visitorId,
              ipAddress: ipAddress.slice(0, 100),
              userAgent: userAgent?.slice(0, 500) ?? null,
              startedAt: now,
              lastSeenAt: now,
            },
          });
        } else {
          await tx.visitorSession.updateMany({
            where: { id: sessionId, visitorId },
            data: {
              ipAddress: ipAddress.slice(0, 100),
              lastSeenAt: now,
              userAgent: userAgent?.slice(0, 500) ?? null,
              endedAt: input.event === 'EXIT' ? now : null,
            },
          });
        }

        if (input.event === 'ENTER') {
          if (!existingPageView) {
            await tx.visitorPageView.create({
              data: {
                id: pageViewId,
                sessionId,
                path,
                moduleKey,
                enteredAt: now,
                lastSeenAt: now,
              },
            });
          }
        } else {
          const current = await tx.visitorPageView.findFirst({
            where: { id: pageViewId, sessionId, session: { visitorId } },
            select: { lastSeenAt: true },
          });
          if (current) {
            const seconds = Math.max(
              0,
              Math.min(
                60,
                Math.floor(
                  (now.getTime() - current.lastSeenAt.getTime()) / 1000,
                ),
              ),
            );
            await tx.visitorPageView.updateMany({
              where: { id: pageViewId, sessionId, session: { visitorId } },
              data: {
                lastSeenAt: now,
                durationSeconds: { increment: seconds },
                ...(input.event === 'EXIT' ? { leftAt: now } : {}),
              },
            });
          }
        }
      }

      await tx.visitorPresence.upsert({
        where: { visitorId },
        create: { visitorId, userAgent: userAgent?.slice(0, 500) ?? null },
        update: {
          lastSeenAt: new Date(),
          userAgent: userAgent?.slice(0, 500) ?? null,
        },
      });
    });

    return { success: true };
  }

  async createOrganization(
    dto: CreateOrganizationDto,
    user: AuthenticatedUser,
  ) {
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
                key: true,
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
          canViewSharedSettings: true,
          canEdit: true,
          canViewUsers: true,
          canManageUsers: true,
          canViewRoles: true,
          canManageRoles: true,
          canViewRahcom: true,
          canManageRahcom: true,
          permissionKeys: [],
          isAdmin: true,
        };
      }
      return {
        canView: false,
        canViewSharedSettings: false,
        canEdit: false,
        canViewUsers: false,
        canManageUsers: false,
        canViewRoles: false,
        canManageRoles: false,
        canViewRahcom: false,
        canManageRahcom: false,
        permissionKeys: [],
        isAdmin: false,
      };
    }

    const isOwner = membership.organization.ownerId === user.id;
    const permissions = new Set(
      membership.roles.flatMap((memberRole) =>
        memberRole.role.permissions.map((item) => item.permission.key),
      ),
    );
    const isDemoUser = membership.roles.some(
      ({ role }) => role.key.toUpperCase() === 'DEMO_USER',
    );
    const isRahcomViewer = membership.roles.some(
      ({ role }) => role.key.toUpperCase() === 'RAHCOM_VIEWER',
    );
    const isOrganizationAdmin = membership.roles.some(({ role }) =>
      ['ADMIN', 'SUPER_ADMIN'].includes(role.key.toUpperCase()),
    );
    const canEdit = isOwner || permissions.has('settings.write');
    const canView = canEdit || permissions.has('settings.read');
    const canManageRahcom = isOwner || isOrganizationAdmin;
    const canManageUsers = canManageRahcom || permissions.has('users.write');
    const canViewUsers = canManageUsers || permissions.has('users.read');
    const canManageRoles = canManageRahcom || permissions.has('roles.write');
    const canViewRoles = canManageRoles || permissions.has('roles.read');
    const hasRahcomProvince =
      canManageRahcom || isDemoUser
        ? false
        : await this.hasRahcomProvinceAssignment(id, user.id);
    const canViewRahcom =
      canManageRahcom || isDemoUser || isRahcomViewer || hasRahcomProvince;
    return {
      canView,
      canViewSharedSettings: true,
      canEdit,
      canViewUsers,
      canManageUsers,
      canViewRoles,
      canManageRoles,
      canViewRahcom,
      canManageRahcom,
      permissionKeys: [...permissions],
      isAdmin: canManageRahcom,
    };
  }

  private async hasRahcomProvinceAssignment(
    organizationId: string,
    userId: string,
  ) {
    try {
      const membership = await this.prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
        select: { rahcomProvince: true },
      });
      return Boolean(membership?.rahcomProvince);
    } catch (error) {
      // Keep organization settings available until the province-scope migration is applied.
      if ((error as { code?: string })?.code === 'P2022') return false;
      throw error;
    }
  }

  async getShellVisibility(id: string, user: AuthenticatedUser) {
    const access = await this.getOrganizationAccess(id, user);
    if (!access.canViewSharedSettings)
      throw new ForbiddenException('Organization access denied.');
    const settings = await this.prisma.organizationSettings.findUnique({
      where: { organizationId: id },
      select: { shellVisibility: true },
    });
    return { shellVisibility: settings?.shellVisibility ?? {} };
  }

  async updateShellVisibility(
    id: string,
    shellVisibility: Record<string, unknown>,
    user: AuthenticatedUser,
  ) {
    const access = await this.getOrganizationAccess(id, user);
    if (!access.canEdit)
      throw new ForbiddenException('Organization edit access denied.');
    const validatedShellVisibility = parseShellVisibility(shellVisibility);
    const settings = await this.prisma.organizationSettings.upsert({
      where: { organizationId: id },
      create: { organizationId: id, shellVisibility: validatedShellVisibility },
      update: { shellVisibility: validatedShellVisibility },
      select: { shellVisibility: true },
    });
    return { shellVisibility: settings.shellVisibility ?? {} };
  }

  async getOrganizationAppearance(id: string, user: AuthenticatedUser) {
    const access = await this.getOrganizationAccess(id, user);
    if (!access.canViewSharedSettings) {
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

    return {
      ...normalizeOrganizationAccent(settings),
      canEdit: access.canEdit,
    };
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

    const appearance =
      dto.accentPreset === 'custom'
        ? dto
        : {
            ...dto,
            accentLightColor:
              ORGANIZATION_ACCENT_COLORS[
                dto.accentPreset as keyof typeof ORGANIZATION_ACCENT_COLORS
              ][0],
            accentDarkColor:
              ORGANIZATION_ACCENT_COLORS[
                dto.accentPreset as keyof typeof ORGANIZATION_ACCENT_COLORS
              ][1],
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
        organization: {
          select: {
            name: true,
            logoUrl: true,
            logoTone: true,
            logoBackground: true,
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('کاربر عضو این سازمان فعال نیست.');
    }

    return membership.organization;
  }

  async getPublicBranding(organizationId?: string) {
    return this.prisma.organization.findFirst({
      where: {
        status: 'ACTIVE',
        ...(organizationId ? { id: organizationId } : {}),
      },
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

  async getRoles(organizationId: string, user: AuthenticatedUser) {
    const access = await this.getOrganizationAccess(organizationId, user);
    if (!access.canViewRoles && !access.canManageUsers) {
      throw new ForbiddenException();
    }

    return this.listRoles(
      organizationId,
      access.canViewRoles,
      new Set(access.permissionKeys ?? []),
      access.canManageRahcom,
    );
  }

  private async listRoles(
    organizationId: string,
    canViewRolePermissions: boolean,
    assignablePermissionKeys: Set<string> = new Set(),
    canAssignAllRoles = false,
  ) {
    const roles = await this.prisma.role.findMany({
      where: {
        OR: [{ organizationId }, { isSystemRole: true }],
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
      canAssignToUsers:
        canAssignAllRoles ||
        role.permissions.every(({ permission }) =>
          assignablePermissionKeys.has(permission.key),
        ),
      permissions: canViewRolePermissions
        ? role.permissions.map((rp) => rp.permission.key)
        : [],
    }));
  }

  async saveRoles(
    organizationId: string,
    rolesDto: unknown[],
    user: AuthenticatedUser,
  ) {
    if (!Array.isArray(rolesDto) || rolesDto.length > 200) {
      throw new BadRequestException('Invalid roles payload.');
    }
    const validatedRoles = rolesDto.map(parseSaveRoleInput);

    const access = await this.getOrganizationAccess(organizationId, user);
    if (!access.canManageRoles) {
      throw new ForbiddenException();
    }
    const grantablePermissionKeys = new Set(access.permissionKeys ?? []);

    const saveRolesTransaction = this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });

      if (!org) {
        throw new NotFoundException(
          `سازمان با شناسه ${organizationId} یافت نشد.`,
        );
      }

      const currentRoles = await tx.role.findMany({
        where: { organizationId, isSystemRole: false },
        select: { id: true, key: true },
      });
      const currentRoleKeys = new Map(
        currentRoles.map((role) => [role.id, role.key]),
      );
      const seenRoleNames = new Set<string>();
      const seenRoleKeys = new Set<string>();
      for (const item of validatedRoles) {
        const currentKey = item.id ? currentRoleKeys.get(item.id) : undefined;
        if (item.id && !currentKey) {
          throw new BadRequestException(
            'Role does not belong to this organization.',
          );
        }
        const normalizedName = item.name
          .normalize('NFKC')
          .trim()
          .replace(/\s+/g, ' ')
          .toLocaleLowerCase();
        const requestedKey =
          currentKey ||
          item.key ||
          item.name.trim().toLowerCase().replace(/\s+/g, '_');
        const normalizedKey = requestedKey.normalize('NFKC').toUpperCase();
        if (
          seenRoleNames.has(normalizedName) ||
          seenRoleKeys.has(normalizedKey)
        ) {
          throw new BadRequestException(
            'Role names and keys must be unique within the organization.',
          );
        }
        seenRoleNames.add(normalizedName);
        seenRoleKeys.add(normalizedKey);
      }

      const requestedPermissionKeys = [
        ...new Set(validatedRoles.flatMap((role) => role.permissions)),
      ];
      if (requestedPermissionKeys.length > 0) {
        const knownPermissions = await tx.permission.findMany({
          where: { key: { in: requestedPermissionKeys } },
          select: { key: true },
        });
        const knownPermissionKeys = new Set(
          knownPermissions.map(({ key }) => key),
        );
        const unknownPermissionKeys = requestedPermissionKeys.filter(
          (key) => !knownPermissionKeys.has(key),
        );
        if (unknownPermissionKeys.length > 0) {
          throw new BadRequestException(
            `Unknown permission keys: ${unknownPermissionKeys.join(', ')}`,
          );
        }
      }

      const processedRoleIds: string[] = [];

      for (const item of validatedRoles) {
        const roleKey =
          item.key || item.name.trim().toLowerCase().replace(/\s+/g, '_');

        if (
          !item.id &&
          ['ADMIN', 'SUPER_ADMIN'].includes(roleKey.trim().toUpperCase()) &&
          !access.canManageRahcom
        ) {
          throw new ForbiddenException(
            'Only an organization administrator can create administrator roles.',
          );
        }

        let role: Role;

        if (item.id) {
          const existing = await tx.role.findFirst({
            where: { id: item.id, organizationId, isSystemRole: false },
            select: {
              id: true,
              key: true,
              name: true,
              description: true,
              permissions: {
                select: { permission: { select: { key: true } } },
              },
            },
          });
          if (!existing) {
            throw new BadRequestException();
          }
          assertRolePermissionDelegation(
            access.canManageRahcom,
            grantablePermissionKeys,
            new Set(
              existing.permissions.map(({ permission }) => permission.key),
            ),
            item.permissions ?? [],
          );
          if (
            ['ADMIN', 'SUPER_ADMIN'].includes(existing.key.toUpperCase()) &&
            !access.canManageRahcom
          ) {
            const existingPermissions = new Set(
              existing.permissions.map(({ permission }) => permission.key),
            );
            const requestedPermissions = new Set(item.permissions ?? []);
            const permissionsChanged =
              existingPermissions.size !== requestedPermissions.size ||
              [...existingPermissions].some(
                (key) => !requestedPermissions.has(key),
              );
            if (
              item.name !== existing.name ||
              (item.description?.trim() || null) !==
                (existing.description?.trim() || null) ||
              permissionsChanged
            ) {
              throw new ForbiddenException(
                'Only an organization administrator can edit administrator roles.',
              );
            }
          }
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
              isSystemRole: false,
            },
          });

          if (!existingRole) {
            const systemRole = await tx.role.findFirst({
              where: { organizationId, key: roleKey, isSystemRole: true },
              select: { id: true },
            });
            if (systemRole) {
              throw new BadRequestException(
                'System roles cannot be edited through the custom role editor.',
              );
            }
          }

          const existingPermissions = existingRole
            ? await tx.rolePermission.findMany({
                where: { roleId: existingRole.id },
                select: { permission: { select: { key: true } } },
              })
            : [];
          assertRolePermissionDelegation(
            access.canManageRahcom,
            grantablePermissionKeys,
            new Set(
              existingPermissions.map(({ permission }) => permission.key),
            ),
            item.permissions ?? [],
          );

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

      const rolesToDelete = await tx.role.findMany({
        where: {
          organizationId,
          isSystemRole: false,
          id: { notIn: processedRoleIds },
        },
        select: { id: true, _count: { select: { members: true } } },
      });
      if (rolesToDelete.some((role) => role._count.members > 0)) {
        throw new BadRequestException();
      }

      await tx.role.deleteMany({
        where: {
          organizationId,
          isSystemRole: false,
          id: { notIn: processedRoleIds },
        },
      });
    });
    await saveRolesTransaction.catch((error: unknown) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'کلید یا نام نقش هم‌زمان ثبت شده است. فهرست نقش‌ها را تازه‌سازی کنید.',
        );
      throw error;
    });
    // The caller was authorized before the transaction. Read the committed
    // result with that authorization snapshot so removing their own role does
    // not turn a successful write into an apparent API failure.
    return this.listRoles(
      organizationId,
      access.canViewRoles,
      new Set(access.permissionKeys ?? []),
      access.canManageRahcom,
    );
  }

  async getUsers(organizationId: string, user: AuthenticatedUser) {
    const access = await this.getOrganizationAccess(organizationId, user);
    if (!access.canViewUsers) {
      throw new ForbiddenException('مجوز مشاهده کاربران این سازمان را ندارید.');
    }

    return this.listUsers(organizationId);
  }

  private async listUsers(organizationId: string) {
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

    const userIds = users.map((u) => u.id);
    const employeeProfiles = await this.prisma.employee.findMany({
      where: { organizationId, userId: { in: userIds } },
      select: {
        userId: true,
        branchId: true,
        departmentId: true,
        branch: { select: { name: true } },
        department: { select: { name: true } },
      },
    });
    const employeeByUser = new Map(
      employeeProfiles.map((employee) => [employee.userId, employee]),
    );

    return users.map((u) => {
      const membership = u.memberships[0];
      const primaryRole = membership?.roles?.[0]?.role;
      const roleName = primaryRole?.name || 'USER';
      const roleKey = primaryRole?.key || 'USER';
      const fullName =
        `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;

      return {
        id: u.id,
        username: u.username,
        name: fullName,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        nationalId: u.nationalId,
        status:
          u.status === 'ACTIVE' && membership?.status === 'ACTIVE'
            ? 'ACTIVE'
            : 'DISABLED',
        isSystemUser: u.isSystemUser,
        role: roleName,
        roleKey: roleKey,
        roles: membership?.roles?.map((r) => r.role.key) || [roleKey],
        branchId: employeeByUser.get(u.id)?.branchId ?? null,
        branchName: employeeByUser.get(u.id)?.branch?.name ?? null,
        departmentId: employeeByUser.get(u.id)?.departmentId ?? null,
        department: employeeByUser.get(u.id)?.department?.name ?? 'عمومی',
        isActive: u.status === 'ACTIVE' && membership?.status === 'ACTIVE',
      };
    });
  }

  /**
   * پیاده‌سازی متد saveUsers برای ذخیره/درون‌ریزی مطمئن کاربران با پشتیبانی از کلمه عبور و نام کاربری دلخواه
   */
  async saveUsers(
    organizationId: string,
    users: unknown[],
    actor: AuthenticatedUser,
  ) {
    if (!Array.isArray(users) || users.length > 500) {
      throw new BadRequestException(
        'حداکثر ۵۰۰ حساب را در هر درخواست ذخیره یا درون‌ریزی کنید.',
      );
    }
    const parsedUsers = users.map(parseSaveUserInput);
    const seenUserIds = new Set<string>();
    const seenEmails = new Set<string>();
    const seenUsernames = new Set<string>();
    for (const item of parsedUsers) {
      const id = item.id?.trim();
      const email = item.email?.trim().toLowerCase();
      const username = item.username?.trim();
      if (id && seenUserIds.has(id)) {
        throw new ConflictException(
          'شناسهٔ حساب در فایل چند بار تکرار شده است.',
        );
      }
      if (email && seenEmails.has(email)) {
        throw new ConflictException('ایمیل در فایل چند بار تکرار شده است.');
      }
      if (username && seenUsernames.has(username)) {
        throw new ConflictException(
          'نام کاربری در فایل چند بار تکرار شده است.',
        );
      }
      if (id) seenUserIds.add(id);
      if (email) seenEmails.add(email);
      if (username) seenUsernames.add(username);
    }

    const access = await this.getOrganizationAccess(organizationId, actor);
    if (!access.canManageUsers) {
      throw new ForbiddenException('مجوز ویرایش کاربران این سازمان را ندارید.');
    }

    const saveUsersTransaction = this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, ownerId: true },
      });

      if (!org) {
        throw new NotFoundException(
          `سازمان با شناسه ${organizationId} یافت نشد.`,
        );
      }

      // دریافت نقش‌های معتبر سازمان
      const orgRoles = await tx.role.findMany({
        where: {
          OR: [{ organizationId }, { isSystemRole: true }],
        },
      });

      let newUsersInRequest = 0;
      for (const item of parsedUsers) {
        const nationalId = normalizeNationalId(
          item.nationalId ?? item.nationalCode,
        );
        let user: User | null = null;

        if (item.id) {
          user = await tx.user.findUnique({ where: { id: item.id } });
        }
        if (!user && item.email) {
          user = await tx.user.findUnique({
            where: { email: item.email.trim().toLowerCase() },
          });
        }
        if (!user && item.username) {
          user = await tx.user.findUnique({
            where: { username: item.username.trim() },
          });
        }

        const previousMembership = user
          ? await tx.organizationMember.findUnique({
              where: {
                organizationId_userId: { organizationId, userId: user.id },
              },
              select: {
                status: true,
                roles: {
                  select: { roleId: true, role: { select: { key: true } } },
                },
              },
            })
          : null;

        if (user && !previousMembership) {
          throw new ConflictException(
            'این حساب عضو این سازمان نیست. برای افزودن حساب موجود، ابتدا فرایند دعوت و پذیرش را کامل کنید.',
          );
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
        const isUserActive =
          item.isActive !== false &&
          item.status !== 'INACTIVE' &&
          item.status !== 'DISABLED';
        const userStatus: 'ACTIVE' | 'DISABLED' = isUserActive
          ? 'ACTIVE'
          : 'DISABLED';
        const membershipStatus: 'ACTIVE' | 'SUSPENDED' = isUserActive
          ? 'ACTIVE'
          : 'SUSPENDED';
        const isNewUser = !user;
        if (isNewUser && ++newUsersInRequest > 50) {
          throw new BadRequestException(
            'در هر درخواست حداکثر ۵۰ حساب تازه بسازید.',
          );
        }
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

        const previouslyHadAdministratorRole = Boolean(
          previousMembership?.roles.some(({ role }) =>
            ['ADMIN', 'SUPER_ADMIN'].includes(role.key.toUpperCase()),
          ),
        );
        if (user && previouslyHadAdministratorRole && !access.canManageRahcom) {
          const requestedUsername = item.username?.trim() || user.username;
          const requestedEmail =
            item.email == null
              ? user.email
              : item.email.trim().toLowerCase() || null;
          const requestedPhone =
            item.phone === undefined ? user.phone : item.phone || null;
          const requestedNationalId =
            item.nationalId === undefined && item.nationalCode === undefined
              ? user.nationalId
              : nationalId;
          const changesAdministratorAccount =
            requestedUsername !== user.username ||
            firstName !== user.firstName ||
            lastName !== user.lastName ||
            requestedEmail !== user.email ||
            requestedPhone !== user.phone ||
            requestedNationalId !== user.nationalId ||
            userStatus !== user.status ||
            membershipStatus !== previousMembership?.status ||
            (typeof item.password === 'string' && item.password.length > 0);
          if (changesAdministratorAccount) {
            throw new ForbiddenException(
              'Only an organization administrator can edit administrator accounts.',
            );
          }
        }

        if (!user) {
          const password =
            typeof item.password === 'string' ? item.password : '';
          if (!password) throw new BadRequestException('Password is required.');
          const email = item.email?.trim().toLowerCase() || null;
          const requestedUsername = item.username?.trim();
          const generatedUsernameBase =
            requestedUsername ||
            (email ? email.split('@')[0] : null) ||
            `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          let generatedUsername = generatedUsernameBase;
          if (!requestedUsername) {
            let suffix = 2;
            while (
              await tx.user.findUnique({
                where: { username: generatedUsername },
                select: { id: true },
              })
            ) {
              generatedUsername = `${generatedUsernameBase}_${suffix}`;
              suffix += 1;
            }
          }

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
          const updateData: Prisma.UserUpdateInput = {
            firstName,
            lastName,
            ...(item.phone !== undefined && { phone: item.phone }),
            ...(item.nationalId !== undefined || item.nationalCode !== undefined
              ? { nationalId }
              : {}),
          };

          if (item.username && item.username.trim() !== user.username) {
            const requestedUsername = item.username.trim();
            const usernameOwner = await tx.user.findUnique({
              where: { username: requestedUsername },
              select: { id: true },
            });
            if (usernameOwner && usernameOwner.id !== user.id) {
              throw new ConflictException('نام کاربری قبلاً استفاده شده است.');
            }
            updateData.username = requestedUsername;
          }

          if (item.email !== undefined) {
            const requestedEmail = item.email?.trim().toLowerCase() || null;
            if (requestedEmail !== user.email && requestedEmail) {
              const emailOwner = await tx.user.findUnique({
                where: { email: requestedEmail },
                select: { id: true },
              });
              if (emailOwner && emailOwner.id !== user.id) {
                throw new ConflictException(
                  'این ایمیل قبلاً برای حساب دیگری ثبت شده است.',
                );
              }
            }
            updateData.email = requestedEmail;
          }

          if (typeof item.password === 'string' && item.password.length > 0) {
            updateData.passwordHash = await bcrypt.hash(item.password, 12);
            updateData.tokenVersion = { increment: 1 };
          }

          user = await tx.user.update({
            where: { id: user.id },
            data: updateData,
          });
        }

        const isOrganizationOwner = user.id === org.ownerId;
        if (isOrganizationOwner && userStatus !== 'ACTIVE') {
          throw new BadRequestException(
            'حساب مالک سازمان را نمی‌توان غیرفعال کرد.',
          );
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
            select: {
              id: true,
              nationalId: true,
              branchId: true,
              departmentId: true,
            },
          });
          if (previouslyHadAdministratorRole && !access.canManageRahcom) {
            const requestedBranchId =
              item.branchId === undefined
                ? (existingProfile?.branchId ?? null)
                : item.branchId || null;
            const requestedDepartmentId =
              item.departmentId === undefined
                ? (existingProfile?.departmentId ?? null)
                : item.departmentId || null;
            if (
              requestedBranchId !== (existingProfile?.branchId ?? null) ||
              requestedDepartmentId !== (existingProfile?.departmentId ?? null)
            ) {
              throw new ForbiddenException(
                'Only an organization administrator can edit administrator accounts.',
              );
            }
          }
          if (
            existingProfile &&
            (item.nationalId !== undefined || item.nationalCode !== undefined)
          ) {
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
          const profile = await tx.employee.findFirst({
            where: { organizationId, userId: user.id },
            select: { id: true },
          });
          let assignedBranchId = item.branchId || null;
          const assignedDepartmentId = item.departmentId || null;
          if (assignedDepartmentId) {
            const department = await tx.department.findFirst({
              where: { id: assignedDepartmentId, organizationId },
              select: { id: true, branchId: true },
            });
            if (
              !department ||
              (assignedBranchId &&
                department.branchId &&
                department.branchId !== assignedBranchId)
            )
              throw new BadRequestException(
                'واحد انتخاب‌شده با دفتر انتخابی سازگار نیست.',
              );
            if (!assignedBranchId) assignedBranchId = department.branchId;
          }
          if (
            assignedBranchId &&
            !(await tx.branch.findFirst({
              where: { id: assignedBranchId, organizationId },
              select: { id: true },
            }))
          )
            throw new BadRequestException('دفتر انتخاب‌شده معتبر نیست.');
          if (!profile && (item.branchId || item.departmentId)) {
            const employeeCode = `USR-${user.id.slice(-12).toUpperCase()}`;
            await tx.employee.create({
              data: {
                organizationId,
                userId: user.id,
                employeeCode,
                firstName,
                lastName,
                nationalId: nationalId || null,
                email: user.email,
                phone: user.phone,
                hiredAt: new Date(),
                branchId: assignedBranchId,
                departmentId: assignedDepartmentId,
              },
            });
          } else if (
            profile &&
            (item.branchId !== undefined || item.departmentId !== undefined)
          ) {
            await tx.employee.update({
              where: { id: profile.id },
              data: {
                branchId: assignedBranchId,
                departmentId: assignedDepartmentId,
              },
            });
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
          for (const role of item.roles) {
            if (typeof role === 'string') requestedRoles.push(role);
            else
              requestedRoles.push(
                ...[role.id, role.key, role.name].filter((key): key is string =>
                  Boolean(key),
                ),
              );
          }
        }

        // پیدا کردن ID نقش‌های متناظر
        const roleReferences = requestedRoles
          .map((reference) => reference.trim())
          .filter(Boolean);
        const matchesByReference = roleReferences.map((reference) => ({
          reference,
          roles: orgRoles.filter(
            (role) =>
              reference === role.id ||
              reference === role.key ||
              reference === role.name,
          ),
        }));
        const invalidRoleReference = matchesByReference.find(
          ({ roles }) => roles.length !== 1,
        );
        if (invalidRoleReference) {
          throw new BadRequestException(
            `Unknown or ambiguous role: ${invalidRoleReference.reference}.`,
          );
        }
        const matchedRoleIds = [
          ...new Set(
            matchesByReference.flatMap(({ roles }) =>
              roles.map(({ id }) => id),
            ),
          ),
        ];

        const includesAdministratorRole = orgRoles.some(
          (role) =>
            matchedRoleIds.includes(role.id) &&
            ['ADMIN', 'SUPER_ADMIN'].includes(role.key.toUpperCase()),
        );
        const previousRoleIdSet = new Set(
          previousMembership?.roles.map(({ roleId }) => roleId) ?? [],
        );
        const nextRoleIdSet = new Set(matchedRoleIds);
        const roleAssignmentChanged =
          previousRoleIdSet.size !== nextRoleIdSet.size ||
          [...previousRoleIdSet].some((roleId) => !nextRoleIdSet.has(roleId));
        if (
          (includesAdministratorRole || previouslyHadAdministratorRole) &&
          roleAssignmentChanged &&
          !access.canManageRahcom
        ) {
          throw new ForbiddenException(
            'Only an organization administrator can assign administrator roles.',
          );
        }

        // اگر نقشی یافت نشد، نقش پیش‌فرض سیستم انتساب می‌یابد
        if (matchedRoleIds.length === 0 && orgRoles.length > 0) {
          const defaultRole = orgRoles.find(
            (role) => role.key.toUpperCase() === 'USER',
          );
          if (defaultRole) {
            matchedRoleIds.push(defaultRole.id);
            nextRoleIdSet.add(defaultRole.id);
          }
        }

        if (!access.canManageRahcom) {
          const changedRoleIds = new Set([
            ...[...previousRoleIdSet].filter(
              (roleId) => !nextRoleIdSet.has(roleId),
            ),
            ...[...nextRoleIdSet].filter(
              (roleId) => !previousRoleIdSet.has(roleId),
            ),
          ]);
          const changedRolePermissions = changedRoleIds.size
            ? await tx.rolePermission.findMany({
                where: { roleId: { in: [...changedRoleIds] } },
                select: { permission: { select: { key: true } } },
              })
            : [];
          const unmanageablePermission = changedRolePermissions.find(
            ({ permission }) =>
              !access.permissionKeys?.includes(permission.key),
          );
          if (unmanageablePermission) {
            throw new ForbiddenException(
              'Only roles limited to permissions held by the current user can be changed.',
            );
          }
        }

        let roleChanged = false;
        if (!isOrganizationOwner) {
          roleChanged =
            previousRoleIdSet.size !== nextRoleIdSet.size ||
            [...previousRoleIdSet].some((roleId) => !nextRoleIdSet.has(roleId));

          await tx.memberRole.deleteMany({
            where: { memberId: membership.id },
          });
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
          ? [
              'username',
              'firstName',
              'lastName',
              'email',
              'phone',
              'status',
              'roles',
              ...(nationalId ? ['nationalId'] : []),
            ]
          : [
              ...(previousUser!.username !== user.username ? ['username'] : []),
              ...(previousUser!.firstName !== user.firstName
                ? ['firstName']
                : []),
              ...(previousUser!.lastName !== user.lastName ? ['lastName'] : []),
              ...(previousUser!.email !== user.email ? ['email'] : []),
              ...(previousUser!.phone !== user.phone ? ['phone'] : []),
              ...(previousUser!.nationalId !== user.nationalId
                ? ['nationalId']
                : []),
              ...(previousMembership?.status !== membershipStatus
                ? ['membershipStatus']
                : []),
              ...(roleChanged ? ['roles'] : []),
              ...(typeof item.password === 'string' && item.password.length > 0
                ? ['password']
                : []),
            ];

        if (changedFields.length > 0) {
          const action = isNewUser
            ? AuditAction.CREATE
            : previousMembership?.status !== membershipStatus
              ? membershipStatus === 'ACTIVE'
                ? AuditAction.ACTIVATE
                : AuditAction.DISABLE
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
    });
    await saveUsersTransaction.catch((error: unknown) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'ایمیل، نام کاربری یا کد پرسنلی هم‌زمان ثبت شده است. فهرست کاربران را تازه‌سازی کنید.',
        );
      throw error;
    });
    // A write may change the actor's effective users.read/users.write grants.
    // Return the committed state under the authorization already checked above.
    return this.listUsers(organizationId);
  }

  async removeOrganizationUser(
    organizationId: string,
    userId: string,
    actor: AuthenticatedUser,
  ) {
    const access = await this.getOrganizationAccess(organizationId, actor);
    if (!access.canManageUsers) throw new ForbiddenException();

    await this.prisma.$transaction(async (tx) => {
      const [organization, membership] = await Promise.all([
        tx.organization.findUnique({
          where: { id: organizationId },
          select: { ownerId: true },
        }),
        tx.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId, userId } },
          select: {
            id: true,
            userId: true,
            user: { select: { username: true, isSystemUser: true } },
            roles: { select: { role: { select: { key: true } } } },
          },
        }),
      ]);
      if (!membership) throw new NotFoundException();
      if (membership.user.isSystemUser || organization?.ownerId === userId) {
        throw new BadRequestException();
      }
      if (
        !access.canManageRahcom &&
        membership.roles.some(({ role }) =>
          ['ADMIN', 'SUPER_ADMIN'].includes(role.key.toUpperCase()),
        )
      ) {
        throw new ForbiddenException(
          'Only an organization administrator can remove administrator accounts.',
        );
      }

      await tx.organizationMember.delete({ where: { id: membership.id } });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actor.id,
          action: AuditAction.DELETE,
          entity: 'ORGANIZATION_MEMBER',
          entityId: membership.userId,
          metadata: { username: membership.user.username },
        },
      });
    });

    return this.listUsers(organizationId);
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
        ...(dto.registrationNumber !== undefined && {
          registrationNumber: dto.registrationNumber,
        }),
        ...(dto.economicCode !== undefined && {
          economicCode: dto.economicCode,
        }),
        ...(dto.taxOffice !== undefined && { taxOffice: dto.taxOffice }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.fiscalYearStart !== undefined && {
          fiscalYearStart: dto.fiscalYearStart,
        }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.logoTone !== undefined && { logoTone: dto.logoTone }),
        ...(dto.logoBackground !== undefined && {
          logoBackground: dto.logoBackground,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    if (dto.logoUrl !== undefined && dto.logoUrl !== organization.logoUrl) {
      await this.logoStorage
        .remove(organization.logoUrl)
        .catch(() => undefined);
    }

    return updatedOrganization;
  }

  async getBranches(organizationId: string, user: AuthenticatedUser) {
    const access = await this.getOrganizationAccess(organizationId, user);
    if (!access.canView && !access.canManageUsers) {
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

    return this.serializableStructureWrite(async (tx) => {
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

    const access = await this.getOrganizationAccess(
      branch.organizationId,
      user,
    );
    if (!access.canEdit) {
      throw new ForbiddenException('مجوز مدیریت ساختار سازمانی را ندارید.');
    }

    return this.serializableStructureWrite(async (tx) => {
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
        where: { id, organizationId: branch.organizationId },
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

    const access = await this.getOrganizationAccess(
      branch.organizationId,
      user,
    );
    if (!access.canEdit) {
      throw new ForbiddenException('مجوز مدیریت ساختار سازمانی را ندارید.');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const [employeeCount, invoiceCount] = await Promise.all([
          tx.employee.count({ where: { branchId: id } }),
          tx.accountingInvoice.count({ where: { branchId: id } }),
        ]);
        if (employeeCount > 0 || invoiceCount > 0) {
          throw new ConflictException(
            '\u0627\u06cc\u0646 \u0634\u0639\u0628\u0647 \u0628\u0647 \u06a9\u0627\u0631\u0645\u0646\u062f \u06cc\u0627 \u0633\u0646\u062f \u0645\u0627\u0644\u06cc \u0645\u062a\u0635\u0644 \u0627\u0633\u062a. \u0627\u0628\u062a\u062f\u0627 \u0627\u0631\u062a\u0628\u0627\u0637 \u06a9\u0627\u0631\u0645\u0646\u062f\u0627\u0646 \u0631\u0627 \u062d\u0630\u0641 \u06a9\u0646\u06cc\u062f \u0648 \u0628\u0631\u0627\u06cc \u0633\u0646\u062f\u0647\u0627\u06cc \u0645\u0627\u0644\u06cc \u0627\u0632 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644\u200c\u06a9\u0631\u062f\u0646 \u0634\u0639\u0628\u0647 \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u06a9\u0646\u06cc\u062f.',
          );
        }

        await tx.department.updateMany({
          where: { branchId: id, organizationId: branch.organizationId },
          data: { branchId: null },
        });
        await tx.branch.delete({
          where: { id, organizationId: branch.organizationId },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          '\u062d\u0630\u0641 \u0634\u0639\u0628\u0647 \u0628\u0647\u200c\u062f\u0644\u06cc\u0644 \u0627\u0631\u062a\u0628\u0627\u0637 \u0628\u0627 \u0633\u0627\u06cc\u0631 \u0627\u0637\u0644\u0627\u0639\u0627\u062a \u0627\u0645\u06a9\u0627\u0646\u200c\u067e\u0630\u06cc\u0631 \u0646\u06cc\u0633\u062a. \u0634\u0639\u0628\u0647 \u0631\u0627 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644 \u06a9\u0646\u06cc\u062f.',
        );
      }
      throw error;
    }

    return { message: 'شعبه با موفقیت حذف شد.', id };
  }

  async getDepartments(organizationId: string, user: AuthenticatedUser) {
    const access = await this.getOrganizationAccess(organizationId, user);
    if (!access.canView && !access.canManageUsers) {
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

    const access = await this.getOrganizationAccess(
      department.organizationId,
      user,
    );
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

    return this.prisma.$transaction(async (tx) => {
      const updatedDepartment = await tx.department.update({
        where: { id, organizationId: department.organizationId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.code !== undefined && { code: dto.code }),
          ...(dto.branchId !== undefined && { branchId: dto.branchId }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      if (dto.branchId) {
        await tx.employee.updateMany({
          where: {
            organizationId: department.organizationId,
            departmentId: id,
          },
          data: { branchId: dto.branchId },
        });
      }

      return updatedDepartment;
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

    const access = await this.getOrganizationAccess(
      department.organizationId,
      user,
    );
    if (!access.canEdit) {
      throw new ForbiddenException('مجوز مدیریت ساختار سازمانی را ندارید.');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const [employeeCount, invoiceCount] = await Promise.all([
          tx.employee.count({ where: { departmentId: id } }),
          tx.accountingInvoice.count({ where: { departmentId: id } }),
        ]);
        if (employeeCount > 0 || invoiceCount > 0) {
          throw new ConflictException(
            '\u0627\u06cc\u0646 \u062f\u067e\u0627\u0631\u062a\u0645\u0627\u0646 \u0628\u0647 \u06a9\u0627\u0631\u0645\u0646\u062f \u06cc\u0627 \u0633\u0646\u062f \u0645\u0627\u0644\u06cc \u0645\u062a\u0635\u0644 \u0627\u0633\u062a. \u0627\u0628\u062a\u062f\u0627 \u0627\u0631\u062a\u0628\u0627\u0637 \u06a9\u0627\u0631\u0645\u0646\u062f\u0627\u0646 \u0631\u0627 \u062d\u0630\u0641 \u06a9\u0646\u06cc\u062f \u0648 \u0628\u0631\u0627\u06cc \u0633\u0646\u062f\u0647\u0627\u06cc \u0645\u0627\u0644\u06cc \u0627\u0632 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644\u200c\u06a9\u0631\u062f\u0646 \u062f\u067e\u0627\u0631\u062a\u0645\u0627\u0646 \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u06a9\u0646\u06cc\u062f.',
          );
        }
        await tx.department.delete({
          where: { id, organizationId: department.organizationId },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          '\u062d\u0630\u0641 \u062f\u067e\u0627\u0631\u062a\u0645\u0627\u0646 \u0628\u0647\u200c\u062f\u0644\u06cc\u0644 \u0627\u0631\u062a\u0628\u0627\u0637 \u0628\u0627 \u0633\u0627\u06cc\u0631 \u0627\u0637\u0644\u0627\u0639\u0627\u062a \u0627\u0645\u06a9\u0627\u0646\u200c\u067e\u0630\u06cc\u0631 \u0646\u06cc\u0633\u062a. \u062f\u067e\u0627\u0631\u062a\u0645\u0627\u0646 \u0631\u0627 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644 \u06a9\u0646\u06cc\u062f.',
        );
      }
      throw error;
    }

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

    const branchNames = new Set<string>();
    const branchCodes = new Set<string>();
    for (const branch of dto.branches ?? []) {
      const name = branch.name?.trim();
      const code = branch.code?.trim();
      if (!name || !code) {
        throw new BadRequestException('Branch names and codes are required.');
      }
      if (branchNames.has(name) || branchCodes.has(code)) {
        throw new ConflictException(
          'Branch names and codes must be unique within the import file.',
        );
      }
      branchNames.add(name);
      branchCodes.add(code);
    }

    const departmentCodes = new Set<string>();
    for (const department of dto.departments ?? []) {
      const code = department.code?.trim();
      if (!code) {
        throw new BadRequestException('Department codes are required.');
      }
      if (departmentCodes.has(code)) {
        throw new ConflictException(
          'Department codes must be unique within the import file.',
        );
      }
      departmentCodes.add(code);
    }

    return this.serializableStructureWrite(async (tx) => {
      if (dto.organization) {
        await tx.organization.update({
          where: { id: organizationId },
          data: {
            ...(dto.organization.name !== undefined && {
              name: dto.organization.name,
            }),
            ...(dto.organization.legalName !== undefined && {
              legalName: dto.organization.legalName,
            }),
            ...(dto.organization.nationalId !== undefined && {
              nationalId: dto.organization.nationalId,
            }),
            ...(dto.organization.registrationNumber !== undefined && {
              registrationNumber: dto.organization.registrationNumber,
            }),
            ...(dto.organization.economicCode !== undefined && {
              economicCode: dto.organization.economicCode,
            }),
            ...(dto.organization.taxOffice !== undefined && {
              taxOffice: dto.organization.taxOffice,
            }),
            ...(dto.organization.phone !== undefined && {
              phone: dto.organization.phone,
            }),
            ...(dto.organization.email !== undefined && {
              email: dto.organization.email,
            }),
            ...(dto.organization.website !== undefined && {
              website: dto.organization.website,
            }),
            ...(dto.organization.address !== undefined && {
              address: dto.organization.address,
            }),
            ...(dto.organization.postalCode !== undefined && {
              postalCode: dto.organization.postalCode,
            }),
            ...(dto.organization.currency !== undefined && {
              currency: dto.organization.currency,
            }),
            ...(dto.organization.fiscalYearStart !== undefined && {
              fiscalYearStart: dto.organization.fiscalYearStart,
            }),
            ...(dto.organization.logoUrl !== undefined && {
              logoUrl: dto.organization.logoUrl,
            }),
            ...(dto.organization.logoTone !== undefined && {
              logoTone: dto.organization.logoTone,
            }),
            ...(dto.organization.logoBackground !== undefined && {
              logoBackground: dto.organization.logoBackground,
            }),
          },
        });
      }

      const branchIdByName = new Map<string, string>();
      const warnings: string[] = [];

      if (dto.branches && dto.branches.length > 0) {
        const mainBranches = dto.branches.filter((b) => b.isMain === true);
        if (mainBranches.length > 1) {
          throw new ConflictException(
            'فقط یک شعبه می‌تواند به عنوان شعبه اصلی (isMain) مشخص شود.',
          );
        }

        for (const branch of dto.branches) {
          const data = {
            name: branch.name.trim(),
            code: branch.code.trim(),
            address: branch.address,
            phone: branch.phone,
            email: branch.email,
            postalCode: branch.postalCode,
            ...(branch.isMain !== undefined && { isMain: branch.isMain }),
            ...(branch.isActive !== undefined && {
              isActive: branch.isActive,
            }),
          };

          let savedBranch: Branch;
          if (branch.id) {
            const existingBranch = await tx.branch.findFirst({
              where: { id: branch.id, organizationId },
              select: { id: true },
            });
            savedBranch = existingBranch
              ? await tx.branch.update({
                  where: { id: existingBranch.id },
                  data,
                })
              : await tx.branch.upsert({
                  where: {
                    organizationId_code: {
                      organizationId,
                      code: branch.code.trim(),
                    },
                  },
                  update: data,
                  create: {
                    ...data,
                    isMain: branch.isMain ?? false,
                    isActive: branch.isActive ?? true,
                    organizationId,
                  },
                });
          } else {
            savedBranch = await tx.branch.upsert({
              where: {
                organizationId_code: {
                  organizationId,
                  code: branch.code.trim(),
                },
              },
              update: data,
              create: {
                ...data,
                isMain: branch.isMain ?? false,
                isActive: branch.isActive ?? true,
                organizationId,
              },
            });
          }
          branchIdByName.set(branch.name.trim(), savedBranch.id);
        }

        if (mainBranches.length === 0) {
          const firstBranchId = [...branchIdByName.values()][0];
          if (firstBranchId) {
            await tx.branch.updateMany({
              where: {
                organizationId,
                isMain: true,
                id: { not: firstBranchId },
              },
              data: { isMain: false },
            });
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

      const organizationBranchIds = new Set(
        (
          await tx.branch.findMany({
            where: { organizationId },
            select: { id: true },
          })
        ).map(({ id }) => id),
      );

      const resolveBranchId = (
        dept: ImportDepartmentItemDto,
      ): string | null => {
        if (dept.branchId) {
          if (!organizationBranchIds.has(dept.branchId)) {
            throw new BadRequestException(
              'شعبه انتخاب‌شده متعلق به این سازمان نیست یا وجود ندارد.',
            );
          }
          return dept.branchId;
        }
        if (dept.branchName?.trim()) {
          const resolved = branchIdByName.get(dept.branchName.trim());
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
            name: dept.name.trim(),
            code: dept.code.trim(),
            branchId,
            ...(dept.isActive !== undefined && {
              isActive: dept.isActive,
            }),
          };

          if (dept.id) {
            const existingDepartment = await tx.department.findFirst({
              where: { id: dept.id, organizationId },
              select: { id: true },
            });
            if (existingDepartment) {
              await tx.department.update({
                where: { id: existingDepartment.id },
                data,
              });
            } else {
              await tx.department.upsert({
                where: {
                  organizationId_code: {
                    organizationId,
                    code: dept.code.trim(),
                  },
                },
                update: data,
                create: {
                  ...data,
                  isActive: dept.isActive ?? true,
                  organizationId,
                },
              });
            }
          } else {
            await tx.department.upsert({
              where: {
                organizationId_code: {
                  organizationId,
                  code: dept.code.trim(),
                },
              },
              update: data,
              create: {
                ...data,
                isActive: dept.isActive ?? true,
                organizationId,
              },
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
