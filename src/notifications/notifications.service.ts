import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';
import type { AuthenticatedUser } from '../core/auth/strategies/jwt.strategy';
import { SystemService } from '../system/system.service';
import type { CreateAnnouncementCommentDto, CreateAnnouncementDto } from './dto/create-announcement.dto';

export type LocalizedNotificationText = Record<
  'fa' | 'en' | 'ar' | 'zh-CN' | 'fr' | 'es' | 'de' | 'ru' | 'ja' | 'pt-BR',
  string
>;

export type CreateNotificationInput = {
  organizationId: string;
  recipientUserId: string;
  source: string;
  eventKey: string;
  title: LocalizedNotificationText;
  body?: LocalizedNotificationText;
  href?: string;
  metadata?: Prisma.InputJsonObject;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService, private readonly system: SystemService) {}

  async getAnnouncementAccess(user: AuthenticatedUser) {
    if (!user.organizationId) return { canManage: false };
    const membership = await this.prisma.organizationMember.findFirst({
      where: { organizationId: user.organizationId, userId: user.id, status: 'ACTIVE' },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } }, organization: { select: { ownerId: true } } },
    });
    if (!membership) return { canManage: false };
    const keys = membership.roles.flatMap((item) => item.role.permissions.map((rp) => rp.permission.key));
    const isOrganizationSuperAdmin = membership.roles.some(
      ({ role }) => role.key === 'SUPER_ADMIN',
    );
    const [branches, mentionUsers] = await Promise.all([
      this.prisma.branch.findMany({ where: { organizationId: user.organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.organizationMember.findMany({ where: { organizationId: user.organizationId, status: 'ACTIVE' }, select: { user: { select: { id: true, username: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'asc' } }),
    ]);
    return {
      canManage:
        membership.organization.ownerId === user.id ||
        isOrganizationSuperAdmin ||
        keys.includes('announcements.write') ||
        keys.includes('settings.write'),
      branches,
      mentionUsers: mentionUsers.map(({ user: member }) => member),
    };
  }

  async listAnnouncements(user: AuthenticatedUser, management = false) {
    if (!user.organizationId) return [];
    if (management && !(await this.getAnnouncementAccess(user)).canManage) throw new ForbiddenException('Announcement management permission is required.');
    const rows = await this.prisma.announcement.findMany({
      where: { organizationId: user.organizationId, isActive: true, ...(management ? {} : { OR: [{ branchId: null }, { branch: { employees: { some: { userId: user.id, status: 'ACTIVE' } } } }] }) },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        notifications: { where: { recipientUserId: user.id }, select: { id: true, readAt: true }, take: 1 },
        branch: { select: { id: true, name: true } },
        reactions: { select: { id: true, userId: true, emoji: true } },
        comments: { orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, firstName: true, lastName: true } }, mentions: { select: { userId: true } } } },
      },
    });
    return rows.map(({ notifications, ...row }) => ({ ...row, notificationId: notifications[0]?.id ?? null, readAt: notifications[0]?.readAt ?? null,
      reactions: Object.entries(row.reactions.reduce<Record<string, { count: number; reacted: boolean }>>((result, reaction) => { const item = result[reaction.emoji] ?? { count: 0, reacted: false }; item.count += 1; item.reacted ||= reaction.userId === user.id; result[reaction.emoji] = item; return result; }, {})).map(([emoji, value]) => ({ emoji, ...value })),
    }));
  }

  async createAnnouncement(user: AuthenticatedUser, dto: CreateAnnouncementDto) {
    const access = await this.getAnnouncementAccess(user);
    if (!access.canManage || !user.organizationId) throw new ForbiddenException('Announcement management permission is required.');
    if (dto.branchId && !await this.prisma.branch.findFirst({ where: { id: dto.branchId, organizationId: user.organizationId, isActive: true }, select: { id: true } })) throw new NotFoundException('Branch was not found.');
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId: user.organizationId, status: 'ACTIVE', organization: { status: 'ACTIVE' } },
      select: { userId: true },
    });
    const recipients = dto.branchId
      ? await this.prisma.employee.findMany({ where: { organizationId: user.organizationId, branchId: dto.branchId, status: 'ACTIVE', userId: { in: members.map(({ userId }) => userId) } }, select: { userId: true } })
      : members;
    const recipientUserIds = [...new Set(recipients.flatMap(({ userId }) => userId ? [userId] : []))];
    const announcement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({ data: {
        organizationId: user.organizationId!, createdByUserId: user.id, title: dto.title,
        summary: dto.summary || null, body: dto.body, locale: dto.locale ?? 'fa',
        category: dto.category ?? 'general', priority: dto.priority ?? 'normal', isPinned: dto.isPinned ?? false,
        allowLikes: dto.allowLikes ?? true, allowReactions: dto.allowReactions ?? true, allowComments: dto.allowComments ?? true, allowMentions: dto.allowMentions ?? true, branchId: dto.branchId ?? null,
      } });
      if (recipientUserIds.length) await tx.notification.createMany({ data: recipientUserIds.map((userId) => ({
        organizationId: user.organizationId!, recipientUserId: userId, source: 'announcements',
        eventKey: 'announcement.published', announcementId: created.id,
        title: { [created.locale]: created.title }, body: { [created.locale]: created.summary || created.body },
        href: '/settings/announcements', metadata: { category: created.category, priority: created.priority, isPinned: created.isPinned },
      })) });
      return created;
    });
    await this.system.recordActivity({ organizationId: user.organizationId, userId: user.id, action: AuditAction.CREATE, entity: 'ANNOUNCEMENT', entityId: announcement.id, metadata: { title: announcement.title, category: announcement.category } });
    return { ...announcement, recipientCount: recipientUserIds.length };
  }

  async updateAnnouncement(user: AuthenticatedUser, id: string, dto: CreateAnnouncementDto) {
    const access = await this.getAnnouncementAccess(user);
    if (!access.canManage || !user.organizationId) throw new ForbiddenException('Announcement management permission is required.');
    const old = await this.prisma.announcement.findFirst({ where: { id, organizationId: user.organizationId, isActive: true } });
    if (!old) throw new NotFoundException('Announcement was not found.');
    if (dto.branchId && !await this.prisma.branch.findFirst({ where: { id: dto.branchId, organizationId: user.organizationId }, select: { id: true } })) throw new NotFoundException('Branch was not found.');
    return this.prisma.announcement.update({ where: { id }, data: {
      title: dto.title, summary: dto.summary || null, body: dto.body, locale: dto.locale, category: dto.category, priority: dto.priority,
      isPinned: dto.isPinned ?? false, allowLikes: dto.allowLikes ?? true, allowReactions: dto.allowReactions ?? true,
      allowComments: dto.allowComments ?? true, allowMentions: dto.allowMentions ?? true, branchId: dto.branchId ?? null,
    } });
  }

  private async visibleAnnouncement(user: AuthenticatedUser, id: string) {
    if (!user.organizationId) throw new NotFoundException('Announcement was not found.');
    const membership = await this.prisma.organizationMember.findFirst({ where: { organizationId: user.organizationId, userId: user.id, status: 'ACTIVE', organization: { status: 'ACTIVE' } }, select: { id: true } });
    if (!membership) throw new NotFoundException('Announcement was not found.');
    const item = await this.prisma.announcement.findFirst({ where: { id, organizationId: user.organizationId, isActive: true } });
    if (!item) throw new NotFoundException('Announcement was not found.');
    if (item.branchId && !await this.prisma.employee.findFirst({ where: { organizationId: user.organizationId, userId: user.id, branchId: item.branchId, status: 'ACTIVE' }, select: { id: true } })) throw new NotFoundException('Announcement was not found.');
    return item;
  }

  async toggleReaction(user: AuthenticatedUser, id: string, emoji: string) {
    const item = await this.visibleAnnouncement(user, id);
    const likeEmoji = emoji === '👍';
    if ((likeEmoji && !item.allowLikes) || (!likeEmoji && !item.allowReactions) || !['👍', '❤️', '😂', '🎉', '👏'].includes(emoji)) throw new ForbiddenException('This reaction is disabled.');
    const existing = await this.prisma.announcementReaction.findUnique({ where: { announcementId_userId_emoji: { announcementId: id, userId: user.id, emoji } } });
    if (existing) { await this.prisma.announcementReaction.delete({ where: { id: existing.id } }); return { active: false }; }
    await this.prisma.announcementReaction.create({ data: { announcementId: id, userId: user.id, emoji } });
    return { active: true };
  }

  async addComment(user: AuthenticatedUser, id: string, dto: CreateAnnouncementCommentDto) {
    const item = await this.visibleAnnouncement(user, id);
    if (!item.allowComments) throw new ForbiddenException('Comments are disabled.');
    const ids = [...new Set(dto.mentionedUserIds ?? [])];
    if (ids.length && !item.allowMentions) throw new ForbiddenException('Mentions are disabled.');
    const active = await this.prisma.organizationMember.findMany({ where: { organizationId: item.organizationId, userId: { in: ids }, status: 'ACTIVE', ...(item.branchId ? { user: { employeeProfiles: { some: { organizationId: item.organizationId, branchId: item.branchId, status: 'ACTIVE' } } } } : {}) }, select: { userId: true } });
    if (active.length !== ids.length) throw new NotFoundException('Mentioned user was not found.');
    const comment = await this.prisma.announcementComment.create({ data: { announcementId: id, userId: user.id, body: dto.body.trim(), mentions: { create: ids.map((userId) => ({ userId })) }, }, include: { user: { select: { firstName: true, lastName: true } }, mentions: { select: { userId: true } } } });
    const targets = ids.filter((userId) => userId !== user.id);
    if (targets.length) await this.prisma.notification.createMany({ data: targets.map((recipientUserId) => ({ organizationId: item.organizationId, recipientUserId, source: 'announcements', eventKey: 'announcement.mentioned', announcementId: id, title: { fa: 'شما در یک اطلاعیه منشن شدید', en: 'You were mentioned in an announcement', ar: 'تمت الإشارة إليك في إعلان', 'zh-CN': '您在公告中被提及', fr: 'Vous avez été mentionné dans une annonce', es: 'Te mencionaron en un anuncio', de: 'Sie wurden in einer Mitteilung erwähnt', ru: 'Вас упомянули в объявлении', ja: 'お知らせであなたがメンションされました', 'pt-BR': 'Você foi mencionado em um comunicado' }, body: { fa: item.title, en: item.title, ar: item.title, 'zh-CN': item.title, fr: item.title, es: item.title, de: item.title, ru: item.title, ja: item.title, 'pt-BR': item.title }, href: '/settings/announcements', metadata: { announcementId: id, commentId: comment.id } })) });
    return comment;
  }

  async deleteComment(user: AuthenticatedUser, id: string, commentId: string) {
    const item = await this.visibleAnnouncement(user, id);
    const access = await this.getAnnouncementAccess(user);
    const comment = await this.prisma.announcementComment.findFirst({ where: { id: commentId, announcementId: id } });
    if (!comment) throw new NotFoundException('Comment was not found.');
    if (!access.canManage && comment.userId !== user.id) throw new ForbiddenException('Cannot delete this comment.');
    await this.prisma.announcementComment.delete({ where: { id: commentId } });
    return { deleted: true };
  }

  async archiveAnnouncement(user: AuthenticatedUser, id: string) {
    const access = await this.getAnnouncementAccess(user);
    if (!access.canManage || !user.organizationId) throw new ForbiddenException('Announcement management permission is required.');
    const existing = await this.prisma.announcement.findFirst({ where: { id, organizationId: user.organizationId, isActive: true } });
    if (!existing) throw new NotFoundException('Announcement was not found.');
    const updated = await this.prisma.announcement.update({ where: { id }, data: { isActive: false } });
    await this.system.recordActivity({ organizationId: user.organizationId, userId: user.id, action: AuditAction.UPDATE, entity: 'ANNOUNCEMENT', entityId: id, metadata: { title: existing.title, archived: true } });
    return updated;
  }

  /** Module services should call this to persist a localized notification for one active organization member. */
  async createForUser(input: CreateNotificationInput) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: input.organizationId,
        userId: input.recipientUserId,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new NotFoundException('Notification recipient is not an active organization member.');
    }

    return this.prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        recipientUserId: input.recipientUserId,
        source: input.source,
        eventKey: input.eventKey,
        title: input.title as Prisma.InputJsonValue,
        body: input.body as Prisma.InputJsonValue | undefined,
        href: input.href,
        metadata: input.metadata,
      },
    });
  }

  async list(user: AuthenticatedUser, options: { unreadOnly?: boolean; limit?: number; cursor?: string } = {}) {
    const organizationId = user.organizationId;
    if (!organizationId) return { items: [], unreadCount: 0 };

    const requestedLimit = Number.isFinite(options.limit) ? options.limit ?? 50 : 50;
    const limit = Math.min(Math.max(requestedLimit, 1), 100);
    const baseWhere = {
      organizationId,
      recipientUserId: user.id,
      ...(options.unreadOnly ? { readAt: null } : {}),
    };
    const cursorRecord = options.cursor
      ? await this.prisma.notification.findFirst({
          where: {
            id: options.cursor,
            organizationId,
            recipientUserId: user.id,
          },
          select: { id: true, createdAt: true },
        })
      : null;
    const where = {
      ...baseWhere,
      ...(cursorRecord
        ? {
            OR: [
              { createdAt: { lt: cursorRecord.createdAt } },
              {
                createdAt: cursorRecord.createdAt,
                id: { lt: cursorRecord.id },
              },
            ],
          }
        : {}),
    };

    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
      this.prisma.notification.count({
        where: { organizationId, recipientUserId: user.id, readAt: null },
      }),
    ]);

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;
    return {
      items: pageItems,
      unreadCount,
      nextCursor: hasMore ? pageItems[pageItems.length - 1]?.id ?? null : null,
    };
  }

  async getSummary(user: AuthenticatedUser) {
    const organizationId = user.organizationId;
    if (!organizationId) return { items: [], unreadCount: 0, unreadBySource: {} };

    const where = { organizationId, recipientUserId: user.id };
    const [items, unreadCount, unreadBySource] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.notification.count({
        where: { ...where, readAt: null },
      }),
      this.prisma.notification.groupBy({
        by: ['source'],
        where: { ...where, readAt: null },
        _count: { _all: true },
      }),
    ]);

    return {
      items,
      unreadCount,
      unreadBySource: Object.fromEntries(unreadBySource.map(({ source, _count }) => [source, _count._all])),
    };
  }

  async markRead(user: AuthenticatedUser, id: string) {
    const where = {
      id,
      organizationId: user.organizationId ?? '',
      recipientUserId: user.id,
    };
    const item = await this.prisma.notification.findFirst({ where });
    if (!item) throw new NotFoundException('Notification was not found.');

    if (!item.readAt) {
      return this.prisma.notification.update({
        where: { id: item.id },
        data: { readAt: new Date() },
      });
    }

    return item;
  }

  async markAllRead(user: AuthenticatedUser) {
    if (!user.organizationId) return { updated: 0 };

    const result = await this.prisma.notification.updateMany({
      where: {
        organizationId: user.organizationId,
        recipientUserId: user.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  }
}
