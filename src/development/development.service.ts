import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedUser } from '../core/auth/strategies/jwt.strategy';
import { PrismaService } from '../core/prisma/prisma.service';
import { isTestDataModuleKey, seedTestDataModule, TEST_DATA_MODULES } from './test-data';
import type { TestDataContext } from './test-data/context';
import { DEMO_RAHCOM_ACTIVITY_PREFIX, DEMO_RAHCOM_SYSTEM_CODE_PREFIX, DEMO_RAHCOM_SYSTEM_CODES } from './test-data/rahcom';
import { DEMO_SETTINGS_ACCOUNT_PREFIX, DEMO_SETTINGS_BRANCH_CODES, DEMO_SETTINGS_DEPARTMENT_CODES } from './test-data/settings';

@Injectable()
export class DevelopmentService {
  private readonly logger = new Logger(DevelopmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private siteVisitsAvailable() {
    return process.env.VERCEL === '1' && process.env.VERCEL_ENV !== 'development';
  }

  async getSiteVisits(actor: AuthenticatedUser, rangeValue = '7d', pageValue = '1', search = '') {
    await this.requireAdministrator(actor);
    if (!this.siteVisitsAvailable()) return { available: false, summary: null, visitors: [], page: 1, pageSize: 25, totalVisitors: 0 };
    const ranges = { '7d': 7, '30d': 30, '90d': 90 } as const;
    if (rangeValue !== 'all' && !(rangeValue in ranges)) throw new BadRequestException('Ø¨Ø§Ø²Ù‡ Ø²Ù…Ø§Ù†ÛŒ Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª.');
    const page = Math.max(1, Math.min(10000, Number.parseInt(pageValue, 10) || 1));
    const since = rangeValue === 'all' ? undefined : new Date(Date.now() - ranges[rangeValue as keyof typeof ranges] * 86400000);
    const where = { ...(since ? { startedAt: { gte: since } } : {}), ...(search.trim() ? { ipAddress: { contains: search.trim().slice(0, 100) } } : {}) };
    const onlineSince = new Date(Date.now() - 5 * 60_000);
    const [groups, totalGroups, sessionCount, pageViewCount, activeIpGroups] = await Promise.all([
      this.prisma.visitorSession.groupBy({ by: ['ipAddress'], where, _count: { _all: true }, _max: { lastSeenAt: true }, orderBy: { _max: { lastSeenAt: 'desc' } }, skip: (page - 1) * 25, take: 25 }),
      this.prisma.visitorSession.groupBy({ by: ['ipAddress'], where, _count: { _all: true }, orderBy: { _max: { lastSeenAt: 'desc' } }, take: 100000 }),
      this.prisma.visitorSession.count({ where }),
      this.prisma.visitorPageView.count({ where: { session: where } }),
      this.prisma.visitorSession.groupBy({ by: ['ipAddress'], where: { ...where, lastSeenAt: { gte: onlineSince } }, _count: { _all: true }, orderBy: { _max: { lastSeenAt: 'desc' } }, take: 100000 }),
    ]);
    const ips = groups.map((group) => group.ipAddress);
    const sessions = ips.length ? await this.prisma.visitorSession.findMany({ where: { ...where, ipAddress: { in: ips } }, select: { id: true, ipAddress: true, lastSeenAt: true }, take: 20000 }) : [];
    const sessionIds = sessions.map(({ id }) => id);
    const pages = sessionIds.length ? await this.prisma.visitorPageView.findMany({ where: { sessionId: { in: sessionIds } }, select: { sessionId: true, moduleKey: true, durationSeconds: true } }) : [];
    const pageStats = new Map<string, { count: number; seconds: number; modules: Set<string> }>();
    for (const view of pages) {
      const stat = pageStats.get(view.sessionId) ?? { count: 0, seconds: 0, modules: new Set<string>() };
      stat.count += 1; stat.seconds += view.durationSeconds; stat.modules.add(view.moduleKey); pageStats.set(view.sessionId, stat);
    }
    const sessionStats = new Map<string, { visits: number; pageViews: number; seconds: number; modules: Set<string> }>();
    for (const session of sessions) {
      const stat = sessionStats.get(session.ipAddress) ?? { visits: 0, pageViews: 0, seconds: 0, modules: new Set<string>() };
      const pageStat = pageStats.get(session.id);
      stat.visits += 1; stat.pageViews += pageStat?.count ?? 0; stat.seconds += pageStat?.seconds ?? 0;
      pageStat?.modules.forEach((module) => stat.modules.add(module));
      sessionStats.set(session.ipAddress, stat);
    }
    return {
      available: true,
      summary: { onlineVisitors: activeIpGroups.length, uniqueIps: totalGroups.length, sessions: sessionCount, pageViews: pageViewCount },
      visitors: groups.map((group) => {
        const stat = sessionStats.get(group.ipAddress);
        const latest = group._max.lastSeenAt;
        return { ipAddress: group.ipAddress, visits: group._count._all, pageViews: stat?.pageViews ?? 0, durationSeconds: stat?.seconds ?? 0, modules: [...(stat?.modules ?? [])], lastSeenAt: latest?.toISOString() ?? null, online: Boolean(latest && latest.getTime() >= Date.now() - 5 * 60_000) };
      }),
      page, pageSize: 25, totalVisitors: totalGroups.length,
    };
  }

  async getSiteVisitorDetails(actor: AuthenticatedUser, ipAddress: string, rangeValue = '7d') {
    await this.requireAdministrator(actor);
    if (!this.siteVisitsAvailable()) return { available: false, sessions: [] };
    const ranges = { '7d': 7, '30d': 30, '90d': 90 } as const;
    if (rangeValue !== 'all' && !(rangeValue in ranges)) throw new BadRequestException('Ø¨Ø§Ø²Ù‡ Ø²Ù…Ø§Ù†ÛŒ Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª.');
    const since = rangeValue === 'all' ? undefined : new Date(Date.now() - ranges[rangeValue as keyof typeof ranges] * 86400000);
    const sessions = await this.prisma.visitorSession.findMany({
      where: { ipAddress: ipAddress.slice(0, 100), ...(since ? { startedAt: { gte: since } } : {}) },
      orderBy: { startedAt: 'desc' }, take: 500,
      select: { id: true, startedAt: true, lastSeenAt: true, endedAt: true, pageViews: { orderBy: { enteredAt: 'asc' }, select: { path: true, moduleKey: true, enteredAt: true, leftAt: true, durationSeconds: true } } },
    });
    return { available: true, sessions: sessions.map((session) => ({ ...session, startedAt: session.startedAt.toISOString(), lastSeenAt: session.lastSeenAt.toISOString(), endedAt: session.endedAt?.toISOString() ?? null, pageViews: session.pageViews.map((view) => ({ ...view, enteredAt: view.enteredAt.toISOString(), leftAt: view.leftAt?.toISOString() ?? null })) })) };
  }

  async getTestDataStatus(actor: AuthenticatedUser) {
    const { organizationId } = await this.requireAdministrator(actor);
    const canRefreshTestData = this.testDataResetAllowed() && await this.isFirstOwner(actor.id, organizationId);
    const [runSettings, rahcomSystems, rahcomActivities, branches, departments, teams, accounts, preferences] = await Promise.all([
      this.prisma.developmentTestDataRun.findMany({ where: { organizationId }, select: { moduleKey: true, appliedAt: true } }),
      this.prisma.rahcomSystem.count({ where: { organizationId, OR: [{ systemCode: { startsWith: DEMO_RAHCOM_SYSTEM_CODE_PREFIX } }, { systemCode: { in: DEMO_RAHCOM_SYSTEM_CODES } }] } }),
      this.prisma.rahcomActivity.count({ where: { organizationId, description: { startsWith: DEMO_RAHCOM_ACTIVITY_PREFIX } } }),
      this.prisma.branch.count({ where: { organizationId, code: { in: DEMO_SETTINGS_BRANCH_CODES } } }),
      this.prisma.department.count({ where: { organizationId, code: { in: DEMO_SETTINGS_DEPARTMENT_CODES } } }),
      this.prisma.departmentTeam.count({ where: { organizationId, code: 'DEMO-TEAM', department: { code: { in: DEMO_SETTINGS_DEPARTMENT_CODES } } } }),
      this.prisma.user.count({ where: { username: { startsWith: DEMO_SETTINGS_ACCOUNT_PREFIX }, memberships: { some: { organizationId } } } }),
      this.prisma.userPreference.count({ where: { user: { username: { startsWith: DEMO_SETTINGS_ACCOUNT_PREFIX }, memberships: { some: { organizationId } } } } }),
    ]);
    const byModule = new Map(runSettings.map((run) => [run.moduleKey, run]));
    const countsByModule: Record<string, Record<string, number>> = {
      rahcom: { systems: rahcomSystems, activities: rahcomActivities },
      settings: { branches, departments, teams, accounts, preferences },
    };
    return {
      canRefreshTestData,
      modules: TEST_DATA_MODULES.map((moduleKey) => {
        const run = byModule.get(moduleKey);
        const recordCounts = countsByModule[moduleKey] ?? {};
        const totalRecords = Object.values(recordCounts).reduce((total, value) => total + value, 0);
        return {
          moduleKey,
          applied: totalRecords > 0,
          appliedAt: totalRecords > 0 ? run?.appliedAt.toISOString() ?? null : null,
          recordCounts,
          totalRecords,
        };
      }),
    };
  }


  async applyTestData(actor: AuthenticatedUser, moduleKeyValue: string) {
    const { organizationId } = await this.requireAdministrator(actor);
    if (!isTestDataModuleKey(moduleKeyValue)) {
      throw new NotFoundException('Module test data was not found.');
    }
    const moduleKey = moduleKeyValue;
    const organizationUsers = await this.prisma.organizationMember.findMany({
      where: { organizationId, status: 'ACTIVE', organization: { status: 'ACTIVE' }, user: { status: 'ACTIVE' } },
      orderBy: { user: { username: 'asc' } },
      select: { userId: true },
    });
    const userIds = organizationUsers.map(({ userId }) => userId);
    return this.prisma.$transaction(async (db) => {
      const context: TestDataContext = { db, organizationId, userId: actor.id, userIds, now: new Date() };
      const result = await seedTestDataModule(moduleKey, context);
      const recordCounts = result.recordCounts;
      const run = await db.developmentTestDataRun.upsert({
        where: { organizationId_moduleKey: { organizationId, moduleKey } },
        create: { organizationId, appliedById: actor.id, moduleKey, recordCounts },
        update: { appliedById: actor.id, recordCounts, appliedAt: new Date() },
      });
      return {
        moduleKey,
        applied: true,
        appliedAt: run.appliedAt.toISOString(),
        recordCounts,
        totalRecords: Object.values(recordCounts).reduce((total, value) => total + value, 0),
        ...(result.accounts ? { accounts: result.accounts } : {}),
      };
    }, { maxWait: 15000, timeout: 60000 });
  }

  async resetAndSeedTestData(actor: AuthenticatedUser) {
    if (!this.testDataResetAllowed()) {
      throw new ForbiddenException('Test-data refresh is available only in local development.');
    }
    if (actor.impersonatedBy) {
      throw new ForbiddenException('Test-data refresh is unavailable while switching accounts.');
    }
    const { organizationId } = await this.requireAdministrator(actor);
    if (!(await this.isFirstOwner(actor.id, organizationId))) {
      throw new ForbiddenException('Only the original Owner can refresh test data.');
    }
    return this.prisma.$transaction(async (db) => {
      const removedActivities = await db.rahcomActivity.deleteMany({
        where: { organizationId, description: { startsWith: DEMO_RAHCOM_ACTIVITY_PREFIX } },
      });
      const removedLegacySystems = await db.rahcomSystem.deleteMany({
        where: { organizationId, systemCode: { startsWith: DEMO_RAHCOM_SYSTEM_CODE_PREFIX } },
      });
      await db.developmentTestDataRun.deleteMany({
        where: { organizationId, moduleKey: { in: [...TEST_DATA_MODULES] } },
      });

      const now = new Date();
      const context: TestDataContext = { db, organizationId, userId: actor.id, userIds: [actor.id], now };
      const settings = await seedTestDataModule('settings', context);
      const activeMembers = await db.organizationMember.findMany({
        where: { organizationId, status: 'ACTIVE', user: { status: 'ACTIVE' } },
        orderBy: { user: { username: 'asc' } },
        select: { userId: true },
      });
      const rahcom = await seedTestDataModule('rahcom', {
        ...context,
        userIds: activeMembers.map(({ userId }) => userId),
      });
      const seeded = { settings, rahcom } as const;
      const modules: Array<{
        moduleKey: (typeof TEST_DATA_MODULES)[number];
        applied: boolean;
        appliedAt: string;
        recordCounts: Record<string, number>;
        totalRecords: number;
      }> = [];
      for (const moduleKey of TEST_DATA_MODULES) {
        const recordCounts = seeded[moduleKey].recordCounts;
        const run = await db.developmentTestDataRun.create({
          data: { organizationId, appliedById: actor.id, moduleKey, recordCounts },
        });
        modules.push({
          moduleKey,
          applied: true,
          appliedAt: run.appliedAt.toISOString(),
          recordCounts,
          totalRecords: Object.values(recordCounts).reduce((total, count) => total + count, 0),
        });
      }
      return {
        modules,
        accounts: settings.accounts ?? [],
        removedTestActivities: removedActivities.count,
        removedLegacyTestSystems: removedLegacySystems.count,
      };
    }, { maxWait: 15000, timeout: 120000 });
  }


  async listAccounts(actor: AuthenticatedUser) {
    const { organizationId, administratorId } = await this.requireAdministrator(actor, true);
    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
        user: { status: 'ACTIVE', id: { notIn: [actor.id, administratorId] } },
      },
      orderBy: { user: { username: 'asc' } },
      take: 200,
      select: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      accounts: memberships.map(({ user }) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim() || user.username,
      })),
    };
  }

  async switchAccount(actor: AuthenticatedUser, targetUserId: string) {
    const { organizationId, administratorId } = await this.requireAdministrator(actor, true);
    if (targetUserId === actor.id || targetUserId === administratorId) {
      throw new ForbiddenException('Ø§Ù†ØªØ®Ø§Ø¨ Ø­Ø³Ø§Ø¨ Ø¬Ø§Ø±ÛŒ Ø¨Ø±Ø§ÛŒ Ø¬Ø§Ø¨Ù‡â€ŒØ¬Ø§ÛŒÛŒ Ù…Ø¬Ø§Ø² Ù†ÛŒØ³Øª.');
    }

    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: targetUserId,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
        user: { status: 'ACTIVE' },
      },
      select: {
        organizationId: true,
        user: { select: { id: true, username: true } },
      },
    });
    if (!membership) {
      throw new NotFoundException('Ø­Ø³Ø§Ø¨ ÙØ¹Ø§Ù„ Ù…ÙˆØ±Ø¯Ù†Ø¸Ø± Ø¯Ø± Ø³Ø§Ø²Ù…Ø§Ù† Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯.');
    }

    this.logger.warn(
      `Account view started: actor=${administratorId} target=${membership.user.id} organization=${organizationId}`,
    );

    return {
      access_token: this.jwtService.sign({
        sub: membership.user.id,
        username: membership.user.username,
        organizationId,
        impersonatedBy: administratorId,
        impersonationOrganizationId: organizationId,
      }),
    };
  }

  async getImpersonationContext(user: AuthenticatedUser) {
    if (!user.impersonatedBy) return { isImpersonating: false as const };

    const [actor, target] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: user.impersonatedBy },
        select: { id: true, username: true, firstName: true, lastName: true },
      }),
      this.prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, username: true, firstName: true, lastName: true },
      }),
    ]);

    return {
      isImpersonating: true as const,
      actor: actor
        ? {
            id: actor.id,
            username: actor.username,
            name: `${actor.firstName} ${actor.lastName}`.trim() || actor.username,
          }
        : null,
      target: target
        ? {
            id: target.id,
            username: target.username,
            name: `${target.firstName} ${target.lastName}`.trim() || target.username,
          }
        : null,
    };
  }

  async stopImpersonation(user: AuthenticatedUser) {
    const actorId = user.impersonatedBy;
    const organizationId = user.impersonationOrganizationId;
    if (!actorId || !organizationId) {
      throw new ForbiddenException('Ø­Ø§Ù„Øª Ø¬Ø§Ø¨Ù‡â€ŒØ¬Ø§ÛŒÛŒ Ø­Ø³Ø§Ø¨ ÙØ¹Ø§Ù„ Ù†ÛŒØ³Øª.');
    }

    const [actor, membership] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: actorId, status: 'ACTIVE' },
        select: { id: true, username: true },
      }),
      this.prisma.organizationMember.findFirst({
        where: {
          userId: actorId,
          organizationId,
          status: 'ACTIVE',
          organization: { status: 'ACTIVE' },
        },
        select: { organizationId: true },
      }),
    ]);
    if (!actor || !membership) {
      throw new UnauthorizedException(
        'Ø­Ø³Ø§Ø¨ Ø§ØµÙ„ÛŒ Ø¯ÛŒÚ¯Ø± Ø¨Ù‡ Ø§ÛŒÙ† Ø³Ø§Ø²Ù…Ø§Ù† Ø¯Ø³ØªØ±Ø³ÛŒ ÙØ¹Ø§Ù„ Ù†Ø¯Ø§Ø±Ø¯Ø› Ø¯ÙˆØ¨Ø§Ø±Ù‡ ÙˆØ§Ø±Ø¯ Ø´ÙˆÛŒØ¯.',
      );
    }

    this.logger.warn(
      `Account view ended: actor=${actor.id} target=${user.id} organization=${organizationId}`,
    );

    return {
      access_token: this.jwtService.sign({
        sub: actor.id,
        username: actor.username,
        organizationId,
      }),
    };
  }

  private async requireAdministrator(actor: AuthenticatedUser, allowImpersonation = false) {
    if (actor.impersonatedBy && !allowImpersonation) {
      throw new ForbiddenException(
        'Ø¯Ø± Ø²Ù…Ø§Ù† Ù…Ø´Ø§Ù‡Ø¯Ù‡ Ø¨Ø§ Ø­Ø³Ø§Ø¨ Ø¯ÛŒÚ¯Ø±ØŒ Ø§Ù…Ú©Ø§Ù† Ø´Ø±ÙˆØ¹ Ø¬Ø§Ø¨Ù‡â€ŒØ¬Ø§ÛŒÛŒ ØªØ§Ø²Ù‡ ÙˆØ¬ÙˆØ¯ Ù†Ø¯Ø§Ø±Ø¯.',
      );
    }
    const administratorId = actor.impersonatedBy ?? actor.id;
    const organizationId = actor.impersonatedBy
      ? actor.impersonationOrganizationId
      : actor.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Ø­Ø³Ø§Ø¨ Ø¨Ù‡ Ø³Ø§Ø²Ù…Ø§Ù† ÙØ¹Ø§Ù„ÛŒ Ù…ØªØµÙ„ Ù†ÛŒØ³Øª.');
    }

    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: administratorId,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      select: {
        organization: { select: { ownerId: true } },
        roles: { select: { role: { select: { key: true } } } },
      },
    });
    if (!membership) {
      const ownedOrganization = await this.prisma.organization.findFirst({
        where: { id: organizationId, ownerId: administratorId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!ownedOrganization) {
        throw new ForbiddenException('Ø¹Ø¶ÙˆÛŒØª ÙØ¹Ø§Ù„ Ø¯Ø± Ø³Ø§Ø²Ù…Ø§Ù† Ù„Ø§Ø²Ù… Ø§Ø³Øª.');
      }
      return { organizationId, administratorId };
    }

    const isAdministrator =
      membership.organization.ownerId === administratorId ||
      membership.roles.some(({ role }) =>
        ['ADMIN', 'SUPER_ADMIN'].includes(role.key.toUpperCase()),
      );
    if (!isAdministrator) {
      throw new ForbiddenException(
        'Ø¬Ø§Ø¨Ù‡â€ŒØ¬Ø§ÛŒÛŒ Ø­Ø³Ø§Ø¨ ÙÙ‚Ø· Ø¨Ø±Ø§ÛŒ Ù…Ø¯ÛŒØ±Ø§Ù† Ø³Ø§Ø²Ù…Ø§Ù† ÙØ¹Ø§Ù„ Ø§Ø³Øª.',
      );
    }

    return { organizationId, administratorId };
  }

  private async isFirstOwner(userId: string, organizationId: string) {
    const [firstSystemUser, organization] = await Promise.all([
      this.prisma.user.findFirst({ where: { isSystemUser: true }, orderBy: { createdAt: 'asc' }, select: { id: true } }),
      this.prisma.organization.findUnique({ where: { id: organizationId }, select: { ownerId: true } }),
    ]);
    return firstSystemUser?.id === userId && organization?.ownerId === userId;
  }

  private testDataResetAllowed() {
    return process.env.NODE_ENV === 'development' && !process.env.VERCEL;
  }
}
