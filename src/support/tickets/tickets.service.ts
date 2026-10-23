// src/support/tickets/tickets.service.ts

/**
 * @file backend/src/support/tickets/tickets.service.ts
 * @description سرویس مدیریت تیکت‌ها و پرونده‌های پشتیبانی (Case Management) منطبق بر استانداردهای Dynamics CRM.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto, ResolveTicketDto } from './dto/update-ticket.dto';
import { TicketStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../core/auth/strategies/jwt.strategy';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService, private projects: ProjectsService) {}

  async create(createTicketDto: CreateTicketDto, user: AuthenticatedUser) {
    const project = await this.projects.assertSupportProjectAccess(user, createTicketDto.projectId, true);
    const lastTicket = await this.prisma.ticket.aggregate({
      where: { organizationId: project.organizationId },
      _max: {
        ticketNumber: true,
      },
    });

    const nextTicketNumber = (lastTicket._max.ticketNumber || 0) + 1;

    return this.prisma.ticket.create({
      data: {
        organizationId: project.organizationId,
        projectId: project.id,
        ticketNumber: nextTicketNumber,
        subject: createTicketDto.subject,
        description: createTicketDto.description,
        type: createTicketDto.type,
        priority: createTicketDto.priority || 'MEDIUM',
        visibility: createTicketDto.visibility,
        category: createTicketDto.category,
        dueAt: createTicketDto.dueAt
          ? new Date(createTicketDto.dueAt)
          : undefined,
        creatorId: user.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findAll(
    user: AuthenticatedUser,
    filters: {
      status?: string;
      priority?: string;
      search?: string;
      accountId?: string;
      contactId?: string;
      projectId?: string;
    } = {},
  ) {
    const { status, priority, search, accountId, contactId, projectId } = filters;
    const accessibleProjects = await this.projects.findSupportProjects(user);
    if (projectId) await this.projects.assertSupportProjectAccess(user, projectId);

    return this.prisma.ticket.findMany({
      where: {
        organizationId: user.organizationId,
        AND: [
          projectId
            ? { projectId }
            : {
                OR: [
                  { projectId: { in: accessibleProjects.map(({ id }) => id) } },
                  { projectId: null, creatorId: user.id },
                ],
              },
          status ? { status: status as any } : {},
          priority ? { priority: priority as any } : {},
          accountId ? { accountId } : {},
          contactId ? { contactId } : {},
          search
            ? {
                OR: [
                  { subject: { contains: search, mode: 'insensitive' } },
                  { description: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {},
        ],
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            messages: true,
            childTickets: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOneForUser(id: string, user: AuthenticatedUser) {
    await this.projects.findSupportProjects(user);
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, organizationId: user.organizationId },
      select: { id: true, projectId: true, creatorId: true },
    });
    if (!ticket) throw new NotFoundException('تیکت مورد نظر یافت نشد.');
    if (ticket.projectId) {
      await this.projects.assertSupportProjectAccess(user, ticket.projectId);
    } else if (ticket.creatorId !== user.id) {
      throw new NotFoundException('تیکت مورد نظر یافت نشد.');
    }
    return this.findOne(id);
  }

  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        parentTicket: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
          },
        },
        childTickets: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            status: true,
          },
        },
        messages: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`تیکت با کد ${id} یافت نشد.`);
    }

    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto) {
    await this.findOne(id);

    return this.prisma.ticket.update({
      where: { id },
      data: {
        ...dto,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        targetResolveAt: dto.targetResolveAt
          ? new Date(dto.targetResolveAt)
          : undefined,
      },
    });
  }

  /**
   * شبیه‌سازی فرآیند Resolve Case در Dynamics CRM
   */
  async resolve(id: string, dto: ResolveTicketDto) {
    const ticket = await this.findOne(id);

    if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('این تیکت قبلاً حل یا بسته شده است.');
    }

    return this.prisma.ticket.update({
      where: { id },
      data: {
        status: TicketStatus.RESOLVED,
        resolution: dto.resolution,
        billableHours: dto.billableHours,
        resolvedAt: new Date(),
      },
    });
  }

  /**
   * شبیه‌سازی فرآیند ادغام پرونده‌ها (Merge Cases) در Dynamics CRM:
   * تیکت‌های فرزند به تیکت اصلی متصل شده و وضعیت آن‌ها به روز می‌شود.
   */
  async mergeTickets(targetTicketId: string, sourceTicketIds: string[]) {
    await this.findOne(targetTicketId);

    return this.prisma.ticket.updateMany({
      where: {
        id: { in: sourceTicketIds },
      },
      data: {
        parentTicketId: targetTicketId,
        status: TicketStatus.CLOSED,
        resolution: `ادغام شده با تیکت اصلی شماره هدف`,
      },
    });
  }
}
