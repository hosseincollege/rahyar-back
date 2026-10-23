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
import { seedSupply } from './test-data/supply';
import type { TestDataContext, TestDataCounts } from './test-data/context';

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
    if (rangeValue !== 'all' && !(rangeValue in ranges)) throw new BadRequestException('بازه زمانی معتبر نیست.');
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
    if (rangeValue !== 'all' && !(rangeValue in ranges)) throw new BadRequestException('بازه زمانی معتبر نیست.');
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
    const runs = await this.prisma.developmentTestDataRun.findMany({ where: { organizationId } });
    const byModule = new Map(runs.map((run) => [run.moduleKey, run]));
    return {
      modules: TEST_DATA_MODULES.map((moduleKey) => {
        const run = byModule.get(moduleKey);
        const legacySupplyRun = moduleKey === 'commerce' ? byModule.get('supply') : undefined;
        const counts = {
          ...((run?.recordCounts ?? {}) as Record<string, number>),
          ...((legacySupplyRun?.recordCounts ?? {}) as Record<string, number>),
        };
        const progressRuns = [run, legacySupplyRun].filter((item) => item !== undefined);
        const applied = Boolean(run && (moduleKey !== 'commerce' || legacySupplyRun));
        return {
          moduleKey,
          applied,
          appliedAt: progressRuns.map((item) => item.appliedAt).sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() ?? null,
          recordCounts: counts,
          totalRecords: Object.values(counts).reduce((total, value) => total + (typeof value === 'number' ? value : 0), 0),
        };
      }),
    };
  }

  async applyTestData(actor: AuthenticatedUser, moduleKeyValue: string) {
    const { organizationId } = await this.requireAdministrator(actor);
    if (!isTestDataModuleKey(moduleKeyValue)) {
      throw new NotFoundException('ماژول دادهٔ آزمایشی پیدا نشد.');
    }
    const moduleKey = moduleKeyValue;
    const organizationUsers = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
        user: { status: 'ACTIVE' },
      },
      orderBy: { user: { username: 'asc' } },
      select: { userId: true },
    });
    const userIds = organizationUsers.map(({ userId }) => userId);
    return this.prisma.$transaction(async (db) => {
      const context: TestDataContext = {
        db,
        organizationId,
        userId: actor.id,
        userIds,
        now: new Date(),
      };
      const crmCounts = await seedTestDataModule(moduleKey, context);
      const inventoryCounts = moduleKey === 'commerce'
        ? await seedSupply(context)
        : null;
      const counts = inventoryCounts ? { ...crmCounts, ...inventoryCounts } : crmCounts;
      const saveProgress = (key: string, recordCounts: TestDataCounts) => db.developmentTestDataRun.upsert({
        where: { organizationId_moduleKey: { organizationId, moduleKey: key } },
        create: { organizationId, appliedById: actor.id, moduleKey: key, recordCounts },
        update: { appliedById: actor.id, recordCounts, appliedAt: new Date() },
      });
      const run = await saveProgress(moduleKey, crmCounts);
      if (inventoryCounts) await saveProgress('supply', inventoryCounts);
      return {
        moduleKey,
        applied: true,
        appliedAt: run.appliedAt.toISOString(),
        recordCounts: counts as TestDataCounts,
        totalRecords: Object.values(counts).reduce((total, value) => total + value, 0),
      };
    }, { maxWait: 15000, timeout: 60000 });
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
      throw new ForbiddenException('انتخاب حساب جاری برای جابه‌جایی مجاز نیست.');
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
      throw new NotFoundException('حساب فعال موردنظر در سازمان پیدا نشد.');
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
      throw new ForbiddenException('حالت جابه‌جایی حساب فعال نیست.');
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
        'حساب اصلی دیگر به این سازمان دسترسی فعال ندارد؛ دوباره وارد شوید.',
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
        'در زمان مشاهده با حساب دیگر، امکان شروع جابه‌جایی تازه وجود ندارد.',
      );
    }
    const administratorId = actor.impersonatedBy ?? actor.id;
    const organizationId = actor.impersonatedBy
      ? actor.impersonationOrganizationId
      : actor.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('حساب به سازمان فعالی متصل نیست.');
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
      throw new ForbiddenException('عضویت فعال در سازمان لازم است.');
    }

    const isAdministrator =
      membership.organization.ownerId === administratorId ||
      membership.roles.some(({ role }) =>
        ['ADMIN', 'SUPER_ADMIN'].includes(role.key.toUpperCase()),
      );
    if (!isAdministrator) {
      throw new ForbiddenException(
        'جابه‌جایی حساب فقط برای مدیران سازمان فعال است.',
      );
    }

    return { organizationId, administratorId };
  }
}
