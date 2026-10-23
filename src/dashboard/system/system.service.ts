import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { performance } from 'node:perf_hooks';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthenticatedUser } from '../../core/auth/strategies/jwt.strategy';

export type RecordActivityInput = {
  organizationId: string;
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonObject;
};

@Injectable()
export class SystemService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus() {
    const checkedAt = new Date().toISOString();
    const api = { status: 'online' as const, uptimeSeconds: Math.floor(process.uptime()) };
    const startedAt = performance.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        checkedAt,
        api,
        database: {
          status: 'online' as const,
          latencyMs: Math.round(performance.now() - startedAt),
        },
      };
    } catch {
      return {
        checkedAt,
        api,
        database: {
          status: 'offline' as const,
          latencyMs: null,
        },
      };
    }
  }

  async getRecentActivity(user: AuthenticatedUser, requestedLimit = 5) {
    if (!user.organizationId) return [];
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 20)
      : 5;

    const entries = await this.prisma.auditLog.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
    });

    return entries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      metadata: entry.metadata,
      createdAt: entry.createdAt,
      user: entry.user
        ? {
            id: entry.user.id,
            name: [entry.user.firstName, entry.user.lastName].filter(Boolean).join(' ') || entry.user.username,
          }
        : null,
    }));
  }

  recordActivity(input: RecordActivityInput) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        metadata: input.metadata,
      },
    });
  }
}
