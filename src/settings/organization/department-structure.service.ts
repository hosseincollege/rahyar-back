import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Employee } from '@prisma/client';

import type { AuthenticatedUser } from '../../core/auth/strategies/jwt.strategy';
import { PrismaService } from '../../core/prisma/prisma.service';
import { SettingsService } from '../settings.service';
import {
  CreateDepartmentTeamDto,
  UpdateDepartmentTeamDto,
} from './dto/department-structure.dto';

const employeeSummarySelect = (organizationId: string) =>
  ({
    id: true,
    employeeCode: true,
    firstName: true,
    lastName: true,
    jobTitle: true,
    status: true,
    departmentId: true,
    managerId: true,
    manager: {
      select: { id: true, firstName: true, lastName: true, jobTitle: true },
    },
    user: {
      select: {
        memberships: {
          where: { organizationId, status: 'ACTIVE' },
          select: {
            roles: {
              select: { role: { select: { key: true, name: true } } },
            },
          },
        },
      },
    },
  }) satisfies Prisma.EmployeeSelect;

type EmployeeSummaryRecord = Prisma.EmployeeGetPayload<{
  select: ReturnType<typeof employeeSummarySelect>;
}>;

@Injectable()
export class DepartmentStructureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  private async authorizeDepartment(
    departmentId: string,
    user: AuthenticatedUser,
    edit = false,
  ) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, organizationId: true, branchId: true },
    });

    if (!department) {
      throw new NotFoundException('دپارتمان موردنظر پیدا نشد.');
    }

    const access = await this.settingsService.getOrganizationAccess(
      department.organizationId,
      user,
    );
    if (edit ? !access.canEdit : !access.canView) {
      throw new ForbiddenException(
        edit
          ? 'مجوز مدیریت ساختار سازمانی را ندارید.'
          : 'مجوز مشاهده ساختار سازمانی را ندارید.',
      );
    }

    return department;
  }

  private employeeSummary(employee: EmployeeSummaryRecord) {
    const { user, ...details } = employee;
    const roles =
      user?.memberships.flatMap((membership) =>
        membership.roles.map(({ role }) => ({ key: role.key, name: role.name })),
      ) ?? [];

    return { ...details, roles };
  }

  async getOverview(departmentId: string, user: AuthenticatedUser) {
    const department = await this.authorizeDepartment(departmentId, user);
    const employeeSelect = employeeSummarySelect(department.organizationId);
    const result = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
        branch: { select: { id: true, name: true } },
        manager: { select: employeeSelect },
        employees: {
          where: { organizationId: department.organizationId },
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
          select: employeeSelect,
        },
        teams: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            code: true,
            manager: { select: employeeSelect },
            members: {
              orderBy: { assignedAt: 'asc' },
              select: { employee: { select: employeeSelect } },
            },
          },
        },
      },
    });

    if (!result) throw new NotFoundException('دپارتمان موردنظر پیدا نشد.');

    return {
      id: result.id,
      name: result.name,
      code: result.code,
      isActive: result.isActive,
      branch: result.branch,
      manager: result.manager ? this.employeeSummary(result.manager) : null,
      employees: result.employees.map((employee) =>
        this.employeeSummary(employee),
      ),
      teams: result.teams.map((team) => ({
        id: team.id,
        name: team.name,
        code: team.code,
        manager: team.manager ? this.employeeSummary(team.manager) : null,
        members: team.members.map(({ employee }) =>
          this.employeeSummary(employee),
        ),
        memberCount: team.members.length,
      })),
    };
  }

  async getAvailableEmployees(departmentId: string, user: AuthenticatedUser) {
    const department = await this.authorizeDepartment(departmentId, user, true);
    const employees = await this.prisma.employee.findMany({
      where: {
        organizationId: department.organizationId,
        departmentId: null,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: employeeSummarySelect(department.organizationId),
    });

    return employees.map((employee) => this.employeeSummary(employee));
  }

  async setDepartmentManager(
    departmentId: string,
    managerEmployeeId: string | null | undefined,
    user: AuthenticatedUser,
  ) {
    const department = await this.authorizeDepartment(departmentId, user, true);
    if (managerEmployeeId) {
      await this.requireDepartmentEmployee(
        department.organizationId,
        departmentId,
        managerEmployeeId,
      );
    }

    await this.prisma.department.update({
      where: { id: departmentId },
      data: { managerEmployeeId: managerEmployeeId || null },
    });
    return this.getOverview(departmentId, user);
  }

  async assignEmployee(
    departmentId: string,
    employeeId: string,
    user: AuthenticatedUser,
  ) {
    const department = await this.authorizeDepartment(departmentId, user, true);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId: department.organizationId },
      select: { id: true, departmentId: true, branchId: true },
    });

    if (!employee) throw new NotFoundException('کارمند موردنظر پیدا نشد.');
    if (employee.departmentId && employee.departmentId !== departmentId) {
      throw new ConflictException(
        'این کارمند از قبل عضو دپارتمان دیگری است؛ انتقال باید از پروندهٔ پرسنلی انجام شود.',
      );
    }

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        departmentId,
        branchId: department.branchId ?? employee.branchId,
      },
    });
    return this.getOverview(departmentId, user);
  }

  async removeEmployee(
    departmentId: string,
    employeeId: string,
    user: AuthenticatedUser,
  ) {
    const department = await this.authorizeDepartment(departmentId, user, true);
    await this.requireDepartmentEmployee(
      department.organizationId,
      departmentId,
      employeeId,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.departmentTeamMember.deleteMany({
        where: { employeeId, team: { departmentId } },
      });
      await tx.departmentTeam.updateMany({
        where: { departmentId, managerEmployeeId: employeeId },
        data: { managerEmployeeId: null },
      });
      await tx.department.updateMany({
        where: { id: departmentId, managerEmployeeId: employeeId },
        data: { managerEmployeeId: null },
      });
      await tx.employee.updateMany({
        where: { organizationId: department.organizationId, managerId: employeeId },
        data: { managerId: null },
      });
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          departmentId: null,
          managerId: null,
          ...(department.branchId && { branchId: null }),
        },
      });
    });

    return this.getOverview(departmentId, user);
  }

  async setEmployeeManager(
    departmentId: string,
    employeeId: string,
    managerId: string | null | undefined,
    user: AuthenticatedUser,
  ) {
    const department = await this.authorizeDepartment(departmentId, user, true);
    await this.requireDepartmentEmployee(
      department.organizationId,
      departmentId,
      employeeId,
    );

    if (managerId) {
      if (managerId === employeeId) {
        throw new BadRequestException('کارمند نمی‌تواند مدیر مستقیم خودش باشد.');
      }
      await this.requireDepartmentEmployee(
        department.organizationId,
        departmentId,
        managerId,
      );
      await this.ensureNoReportingCycle(employeeId, managerId, department.organizationId);
    }

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { managerId: managerId || null },
    });
    return this.getOverview(departmentId, user);
  }

  async createTeam(
    departmentId: string,
    dto: CreateDepartmentTeamDto,
    user: AuthenticatedUser,
  ) {
    const department = await this.authorizeDepartment(departmentId, user, true);
    const employeeIds = [...new Set(dto.employeeIds ?? [])];
    if (dto.managerEmployeeId && !employeeIds.includes(dto.managerEmployeeId)) {
      employeeIds.push(dto.managerEmployeeId);
    }
    await this.validateTeamEmployees(
      department.organizationId,
      departmentId,
      employeeIds,
      dto.managerEmployeeId,
    );

    try {
      const team = await this.prisma.departmentTeam.create({
        data: {
          organizationId: department.organizationId,
          departmentId,
          name: dto.name.trim(),
          code: dto.code.trim(),
          managerEmployeeId: dto.managerEmployeeId || null,
          members: {
            create: employeeIds.map((employeeId) => ({ employeeId })),
          },
        },
        select: { id: true },
      });
      return this.getOverview(departmentId, user).then((overview) => ({
        ...overview,
        savedTeamId: team.id,
      }));
    } catch (error) {
      this.handleTeamError(error);
    }
  }

  async updateTeam(
    teamId: string,
    dto: UpdateDepartmentTeamDto,
    user: AuthenticatedUser,
  ) {
    const team = await this.prisma.departmentTeam.findUnique({
      where: { id: teamId },
      include: { members: { select: { employeeId: true } } },
    });
    if (!team) throw new NotFoundException('تیم موردنظر پیدا نشد.');
    const department = await this.authorizeDepartment(team.departmentId, user, true);
    const employeeIds =
      dto.employeeIds === undefined
        ? team.members.map((member) => member.employeeId)
        : [...new Set(dto.employeeIds)];
    const managerEmployeeId =
      dto.managerEmployeeId === undefined
        ? team.managerEmployeeId
        : dto.managerEmployeeId;

    if (managerEmployeeId && !employeeIds.includes(managerEmployeeId)) {
      throw new BadRequestException('سرپرست تیم باید عضو همان تیم باشد.');
    }
    await this.validateTeamEmployees(
      department.organizationId,
      team.departmentId,
      employeeIds,
      managerEmployeeId,
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.departmentTeam.update({
          where: { id: teamId },
          data: {
            ...(dto.name !== undefined && { name: dto.name.trim() }),
            ...(dto.code !== undefined && { code: dto.code.trim() }),
            ...(dto.managerEmployeeId !== undefined && {
              managerEmployeeId: dto.managerEmployeeId || null,
            }),
          },
        });
        if (dto.employeeIds !== undefined) {
          await tx.departmentTeamMember.deleteMany({ where: { teamId } });
          if (employeeIds.length) {
            await tx.departmentTeamMember.createMany({
              data: employeeIds.map((employeeId) => ({ teamId, employeeId })),
              skipDuplicates: true,
            });
          }
        }
      });
    } catch (error) {
      this.handleTeamError(error);
    }

    return this.getOverview(team.departmentId, user);
  }

  async deleteTeam(teamId: string, user: AuthenticatedUser) {
    const team = await this.prisma.departmentTeam.findUnique({
      where: { id: teamId },
      select: { id: true, departmentId: true },
    });
    if (!team) throw new NotFoundException('تیم موردنظر پیدا نشد.');
    await this.authorizeDepartment(team.departmentId, user, true);
    await this.prisma.departmentTeam.delete({ where: { id: teamId } });
    return this.getOverview(team.departmentId, user);
  }

  private async requireDepartmentEmployee(
    organizationId: string,
    departmentId: string,
    employeeId: string,
  ): Promise<Employee> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, departmentId },
    });
    if (!employee) {
      throw new BadRequestException(
        'کارمند باید عضو همین دپارتمان و سازمان باشد.',
      );
    }
    return employee;
  }

  private async validateTeamEmployees(
    organizationId: string,
    departmentId: string,
    employeeIds: string[],
    managerEmployeeId?: string | null,
  ) {
    if (employeeIds.length) {
      const count = await this.prisma.employee.count({
        where: {
          id: { in: employeeIds },
          organizationId,
          departmentId,
        },
      });
      if (count !== employeeIds.length) {
        throw new BadRequestException(
          'همهٔ اعضای تیم باید عضو همین دپارتمان باشند.',
        );
      }
    }

    if (managerEmployeeId && !employeeIds.includes(managerEmployeeId)) {
      throw new BadRequestException('سرپرست تیم باید عضو همان تیم باشد.');
    }
  }

  private async ensureNoReportingCycle(
    employeeId: string,
    managerId: string,
    organizationId: string,
  ) {
    const visited = new Set<string>();
    let currentId: string | null = managerId;

    while (currentId) {
      if (currentId === employeeId || visited.has(currentId)) {
        throw new BadRequestException('این انتساب باعث ایجاد چرخه در سلسله‌مراتب می‌شود.');
      }
      visited.add(currentId);
      const current: { managerId: string | null } | null =
        await this.prisma.employee.findFirst({
          where: { id: currentId, organizationId },
          select: { managerId: true },
        });
      currentId = current?.managerId ?? null;
    }
  }

  private handleTeamError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('کد این تیم در دپارتمان تکراری است.');
    }
    throw error;
  }
}
