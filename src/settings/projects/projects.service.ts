import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import type { AuthenticatedUser } from '../../core/auth/strategies/jwt.strategy';
import type { ProjectImportItemDto } from './dto/import-projects.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrganizationId(user: AuthenticatedUser, write = false): Promise<string> {
    if (!user.organizationId) {
      throw new BadRequestException('حساب کاربری به سازمان فعالی متصل نیست.');
    }
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      include: {
        organization: { select: { ownerId: true } },
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: { select: { key: true } } } } } },
          },
        },
      },
    });
    if (!membership) throw new ForbiddenException('دسترسی به سازمان فعال نیست.');
    const roles = membership.roles.map(({ role }) => role);
    const isAdmin = membership.organization.ownerId === user.id ||
      roles.some(({ key }) => key === 'SUPER_ADMIN' || key === 'ADMIN');
    const permissions = new Set(roles.flatMap(({ permissions }) => permissions.map(({ permission }) => permission.key)));
    const canEdit = isAdmin || permissions.has('settings.write');
    const canView = canEdit || permissions.has('settings.read');
    if (write ? !canEdit : !canView) {
      throw new ForbiddenException('برای مدیریت پروژه‌ها مجوز کافی ندارید.');
    }
    return user.organizationId;
  }

  private async assertMembersBelongToOrganization(
    userIds: string[],
    organizationId: string,
  ) {
    const uniqueIds = [...new Set(userIds)];
    const memberships = await this.prisma.organizationMember.count({
      where: {
        organizationId,
        userId: { in: uniqueIds },
        status: 'ACTIVE',
      },
    });
    if (memberships !== uniqueIds.length) {
      throw new BadRequestException('همه اعضا باید عضو فعال همین سازمان باشند.');
    }
    return uniqueIds;
  }

  async create(dto: CreateProjectDto, user: AuthenticatedUser) {
    const organizationId = await this.getOrganizationId(user, true);
    const memberIds = await this.assertMembersBelongToOrganization(
      [user.id, ...(dto.memberUserIds || [])],
      organizationId,
    );

    const existing = await this.prisma.project.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException(`پروژه‌ای با کد ${dto.code} قبلاً ثبت شده است.`);
    }

    // اضافه کردن اعضا (کاربر ایجادکننده نیز به طور خودکار اضافه می‌شود)
    return this.prisma.project.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        description: dto.description,
        status: dto.status,
        organizationId,
        members: {
          create: memberIds.map((userId) => ({
            userId,
            role: userId === user.id ? 'MANAGER' : 'MEMBER',
          })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });
  }

  async findAll(user: AuthenticatedUser) {
    const organizationId = await this.getOrganizationId(user);
    return this.prisma.project.findMany({
      where: { organizationId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, firstName: true, lastName: true },
            },
          },
        },
        _count: {
          select: { tickets: true, members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const project = await this.prisma.project.findUnique({
      where: { id, organizationId: await this.getOrganizationId(user) },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        tickets: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            status: true,
            priority: true,
            createdAt: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('پروژه مورد نظر یافت نشد.');
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto, user: AuthenticatedUser) {
    const organizationId = await this.getOrganizationId(user, true);
    const project = await this.prisma.project.findFirst({ where: { id, organizationId } });
    if (!project) throw new NotFoundException('پروژه یافت نشد.');

    // در صورتی که اعضای پروژه ویرایش شده باشند
    if (dto.memberUserIds) {
      const memberIds = await this.assertMembersBelongToOrganization(dto.memberUserIds, organizationId);
      await this.prisma.projectMember.deleteMany({ where: { projectId: id } });
      await this.prisma.projectMember.createMany({
        data: memberIds.map((userId) => ({
          projectId: id,
          userId,
          role: 'MEMBER',
        })),
      });
    }

    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code ? dto.code.toUpperCase() : undefined,
        description: dto.description,
        status: dto.status,
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    const organizationId = await this.getOrganizationId(user, true);
    const project = await this.prisma.project.findFirst({ where: { id, organizationId } });
    if (!project) throw new NotFoundException('پروژه یافت نشد.');

    return this.prisma.project.delete({ where: { id } });
  }

  async import(items: ProjectImportItemDto[], user: AuthenticatedUser) {
    const organizationId = await this.getOrganizationId(user, true);
    const codes = items.map(({ code }) => code.trim().toUpperCase());
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException('کد پروژه در فایل تکراری است.');
    }
    const existing = await this.prisma.project.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });
    if (existing.length) {
      throw new ConflictException(`کد پروژه از قبل ثبت شده است: ${existing.map(({ code }) => code).join(', ')}`);
    }

    const projects = await this.prisma.$transaction(async (tx) => {
      await tx.project.createMany({
        data: items.map((item, index) => ({
          organizationId,
          code: codes[index],
          name: item.name.trim(),
          description: item.description?.trim() || null,
          status: item.status ?? 'ACTIVE',
        })),
      });
      const created = await tx.project.findMany({
        where: { organizationId, code: { in: codes } },
        orderBy: { code: 'asc' },
      });
      await tx.projectMember.createMany({
        data: created.map(({ id }) => ({ projectId: id, userId: user.id, role: 'MANAGER' })),
      });
      return created;
    });
    return { imported: projects.length, projects };
  }
}
