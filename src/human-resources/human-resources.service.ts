/**
 * مسیر فایل:
 * backend/src/human-resources/human-resources.service.ts
 *
 * منطق تجاری ماژول منابع انسانی:
 * - مدیریت کارکنان (با قابلیت ایجاد هم‌زمان حساب کاربری، عضویت سازمانی و انتساب نقش‌ها در تراکنش دیتابیس)
 * - مدیریت درخواست‌های مرخصی
 * - ثبت تاریخچه تغییر وضعیت مرخصی
 * - اعمال کامل محدوده سازمان جاری
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import {
  AttendanceStatus,
  EmployeeStatus,
  EmploymentType,
  LeaveRequestStatus,
  LeaveType,
  PayrollStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from '../core/prisma/prisma.service';
import { normalizeNationalId } from '../core/national-id';
import { NotificationsService } from '../dashboard/events/notifications.service';
import type { LocalizedNotificationText } from '../dashboard/events/notifications.service';

import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreateBusinessTripRequestDto } from './dto/create-business-trip-request.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateLeaveRequestStatusDto } from './dto/update-leave-request-status.dto';
import { SaveAttendanceDto } from './dto/save-attendance.dto';
import { SavePayrollDto } from './dto/save-payroll.dto';
import { UpdatePayrollStatusDto } from './dto/update-payroll-status.dto';

type CurrentAuthUser = {
  id: string;
  organizationId: string | null;
};

type EmployeeFilters = {
  search?: string;
  status?: EmployeeStatus;
  employmentType?: EmploymentType;
  branchId?: string;
  departmentId?: string;
};

type LeaveRequestFilters = {
  employeeId?: string;
  status?: LeaveRequestStatus;
  leaveType?: LeaveType;
};

const tripNotificationText = {
  requested: {
    title: { fa: 'درخواست مأموریت جدید', en: 'New business trip request', ar: 'طلب مهمة عمل جديد', 'zh-CN': '新的出差申请', fr: 'Nouvelle demande de déplacement', es: 'Nueva solicitud de viaje de trabajo', de: 'Neuer Dienstreiseantrag', ru: 'Новая заявка на командировку', ja: '新しい出張申請', 'pt-BR': 'Nova solicitação de viagem a trabalho' },
    body: (destination: string): LocalizedNotificationText => ({ fa: `درخواست مأموریت به مقصد ${destination} برای بررسی ثبت شد.`, en: `A business trip request to ${destination} is waiting for review.`, ar: `طلب مهمة عمل إلى ${destination} بانتظار المراجعة.`, 'zh-CN': `前往${destination}的出差申请正在等待审核。`, fr: `Une demande de déplacement vers ${destination} attend votre examen.`, es: `Una solicitud de viaje de trabajo a ${destination} está pendiente de revisión.`, de: `Ein Dienstreiseantrag nach ${destination} wartet auf Prüfung.`, ru: `Заявка на командировку в ${destination} ожидает рассмотрения.`, ja: `${destination}への出張申請が審査待ちです。`, 'pt-BR': `Uma solicitação de viagem a trabalho para ${destination} aguarda análise.` }),
  },
  reviewed: {
    title: { fa: 'به‌روزرسانی درخواست مأموریت', en: 'Business trip request updated', ar: 'تم تحديث طلب مهمة العمل', 'zh-CN': '出差申请已更新', fr: 'Demande de déplacement mise à jour', es: 'Solicitud de viaje actualizada', de: 'Dienstreiseantrag aktualisiert', ru: 'Заявка на командировку обновлена', ja: '出張申請が更新されました', 'pt-BR': 'Solicitação de viagem atualizada' },
    body: (destination: string, status: LeaveRequestStatus): LocalizedNotificationText => {
      const state = {
        fa: { APPROVED: 'تأیید شد', REJECTED: 'رد شد', CANCELLED: 'لغو شد' }, en: { APPROVED: 'approved', REJECTED: 'rejected', CANCELLED: 'cancelled' }, ar: { APPROVED: 'تمت الموافقة عليها', REJECTED: 'تم رفضها', CANCELLED: 'تم إلغاؤها' }, 'zh-CN': { APPROVED: '已批准', REJECTED: '已拒绝', CANCELLED: '已取消' }, fr: { APPROVED: 'approuvée', REJECTED: 'refusée', CANCELLED: 'annulée' }, es: { APPROVED: 'aprobada', REJECTED: 'rechazada', CANCELLED: 'cancelada' }, de: { APPROVED: 'genehmigt', REJECTED: 'abgelehnt', CANCELLED: 'storniert' }, ru: { APPROVED: 'одобрена', REJECTED: 'отклонена', CANCELLED: 'отменена' }, ja: { APPROVED: '承認', REJECTED: '却下', CANCELLED: 'キャンセル' }, 'pt-BR': { APPROVED: 'aprovada', REJECTED: 'recusada', CANCELLED: 'cancelada' },
      };
      return { fa: `درخواست مأموریت به مقصد ${destination} ${state.fa[status]}.`, en: `The business trip request to ${destination} was ${state.en[status]}.`, ar: `طلب مهمة العمل إلى ${destination} ${state.ar[status]}.`, 'zh-CN': `前往${destination}的出差申请${state['zh-CN'][status]}。`, fr: `La demande de déplacement vers ${destination} a été ${state.fr[status]}.`, es: `La solicitud de viaje a ${destination} fue ${state.es[status]}.`, de: `Der Dienstreiseantrag nach ${destination} wurde ${state.de[status]}.`, ru: `Заявка на командировку в ${destination} ${state.ru[status]}.`, ja: `${destination}への出張申請は${state.ja[status]}されました。`, 'pt-BR': `A solicitação de viagem para ${destination} foi ${state['pt-BR'][status]}.` };
    },
  },
} as const;

@Injectable()
export class HumanResourcesService {
  private readonly logger = new Logger(HumanResourcesService.name);
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  /**
   * اطمینان از وجود سازمان فعال برای کاربر جاری
   */
  private getOrganizationId(user: CurrentAuthUser): string {
    if (!user.organizationId) {
      throw new BadRequestException(
        'کاربر به هیچ سازمان فعالی دسترسی ندارد.',
      );
    }

    return user.organizationId;
  }

  private async getWorkDate(organizationId: string, instant: Date): Promise<Date> {
    const settings = await this.prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { timezone: true },
    });
    let dateText: string;
    try {
      dateText = new Intl.DateTimeFormat('en-CA', {
        timeZone: settings?.timezone || 'Asia/Tehran',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(instant);
    } catch {
      dateText = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(instant);
    }
    return new Date(`${dateText}T00:00:00.000Z`);
  }

  private async getMembershipAccess(user: CurrentAuthUser) {
    const organizationId = this.getOrganizationId(user);
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
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
                permissions: { select: { permission: { select: { key: true } } } },
              },
            },
          },
        },
      },
    });

    if (!membership) throw new ForbiddenException('عضویت فعال سازمان برای این عملیات لازم است.');
    const permissionKeys = new Set(membership.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.key),
    ));
    const isAdministrator = membership.organization.ownerId === user.id || membership.roles.some(
      ({ role }) => ['ADMIN', 'SUPER_ADMIN'].includes(role.key.toUpperCase()),
    );
    const canManage = isAdministrator || permissionKeys.has('hr.write');
    const canReadAll = canManage || permissionKeys.has('hr.read');
    const canManageEmployees = canManage || permissionKeys.has('hr.employees.write');
    const canViewEmployees = canReadAll || canManageEmployees || permissionKeys.has('hr.employees.read');
    const canManageLeaves = canManage || permissionKeys.has('hr.leaves.write') || permissionKeys.has('hr.leaves.approve');
    const canViewLeaves = canReadAll || canManageLeaves || permissionKeys.has('hr.leaves.read');
    const canManageAttendance = canManage || permissionKeys.has('hr.attendance.write');
    const canViewAttendance = canReadAll || canManageAttendance || permissionKeys.has('hr.attendance.read');
    const canManagePayroll = canManage || permissionKeys.has('hr.payroll.write');
    const canViewPayroll = canReadAll || canManagePayroll || permissionKeys.has('hr.payroll.read');
    const employee = await this.prisma.employee.findFirst({
      where: { organizationId, userId: user.id },
      select: { id: true },
    });

    return {
      organizationId, isAdministrator, canManage, canReadAll,
      canManageEmployees, canViewEmployees, canManageLeaves, canViewLeaves,
      canManageAttendance, canViewAttendance, canManagePayroll, canViewPayroll,
      employeeId: employee?.id ?? null,
    };
  }

  async getAccess(user: CurrentAuthUser) {
    const access = await this.getMembershipAccess(user);
    const { canReadAll, canManage, employeeId } = access;
    return {
      canViewOrganization: canReadAll,
      canViewEmployees: access.canViewEmployees,
      canManageEmployees: access.canManageEmployees,
      canViewLeaves: access.canViewLeaves,
      canManageLeaves: access.canManageLeaves,
      canReviewLeave: access.canManageLeaves,
      canViewAttendance: access.canViewAttendance,
      canManageAttendance: access.canManageAttendance,
      canViewPayroll: access.canViewPayroll,
      canManagePayroll: access.canManagePayroll,
      canManage,
      canRequestLeave: Boolean(employeeId),
      employeeId,
    };
  }

  async getReferenceData(user: CurrentAuthUser) {
    const access = await this.getMembershipAccess(user);
    if (!access.canManageEmployees && !access.canManageAttendance && !access.canManagePayroll) {
      throw new ForbiddenException('برای دریافت فهرست‌های منابع انسانی مجوز کافی ندارید.');
    }
    const [branches, departments, managers, members] = await Promise.all([
      this.prisma.branch.findMany({
        where: { organizationId: access.organizationId, isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.department.findMany({
        where: { organizationId: access.organizationId, isActive: true },
        select: { id: true, name: true, code: true, branchId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.employee.findMany({
        where: { organizationId: access.organizationId, status: { not: EmployeeStatus.TERMINATED } },
        select: { id: true, employeeCode: true, firstName: true, lastName: true, jobTitle: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
      access.canManageEmployees ? this.prisma.organizationMember.findMany({
        where: {
          organizationId: access.organizationId,
          status: 'ACTIVE',
          organization: { status: 'ACTIVE' },
          user: { status: UserStatus.ACTIVE, employeeProfiles: { none: { organizationId: access.organizationId } } },
        },
        select: { user: { select: { id: true, username: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      }) : Promise.resolve([]),
    ]);
    return {
      branches,
      departments,
      managers,
      employees: managers,
      availableUsers: members.map(({ user: member }) => member),
    };
  }

  async getAttendance(user: CurrentAuthUser, requestedDate?: string) {
    const access = await this.getMembershipAccess(user);
    if (!access.canViewAttendance && !access.employeeId) {
      throw new ForbiddenException('مجوز مشاهدهٔ حضور و غیاب را ندارید.');
    }
    const dateText = requestedDate || new Date().toISOString().slice(0, 10);
    const workDate = new Date(`${dateText}T00:00:00.000Z`);
    if (Number.isNaN(workDate.getTime()) || workDate.toISOString().slice(0, 10) !== dateText) {
      throw new BadRequestException('تاریخ حضور و غیاب معتبر نیست.');
    }
    return this.prisma.attendanceRecord.findMany({
      where: {
        organizationId: access.organizationId,
        workDate,
        ...(access.canViewAttendance ? {} : { employeeId: access.employeeId! }),
      },
      include: {
        employee: {
          select: {
            id: true, employeeCode: true, firstName: true, lastName: true,
            jobTitle: true, branch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ employee: { firstName: 'asc' } }, { employee: { lastName: 'asc' } }],
    });
  }

  async saveAttendance(user: CurrentAuthUser, dto: SaveAttendanceDto) {
    const access = await this.getMembershipAccess(user);
    if (!access.canManageAttendance) throw new ForbiddenException('مجوز ثبت حضور و غیاب را ندارید.');
    const workDate = new Date(`${dto.workDate.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(workDate.getTime())) throw new BadRequestException('تاریخ حضور و غیاب معتبر نیست.');
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId: access.organizationId, status: { not: EmployeeStatus.TERMINATED } },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('کارمند فعال در سازمان جاری پیدا نشد.');
    const checkInAt = this.parseDate(dto.checkInAt, 'checkInAt');
    const checkOutAt = this.parseDate(dto.checkOutAt, 'checkOutAt');
    if (checkInAt && checkOutAt && checkOutAt <= checkInAt) {
      throw new BadRequestException('زمان خروج باید بعد از زمان ورود باشد.');
    }
    try {
      return await this.prisma.attendanceRecord.upsert({
        where: { employeeId_workDate: { employeeId: employee.id, workDate } },
        create: {
          organizationId: access.organizationId,
          employeeId: employee.id,
          workDate,
          checkInAt,
          checkOutAt,
          status: dto.status ?? AttendanceStatus.PRESENT,
          note: dto.note?.trim() || null,
          recordedById: user.id,
        },
        update: {
          checkInAt,
          checkOutAt,
          status: dto.status ?? AttendanceStatus.PRESENT,
          note: dto.note?.trim() || null,
          recordedById: user.id,
        },
        include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async checkIn(user: CurrentAuthUser) {
    const access = await this.getMembershipAccess(user);
    if (!access.employeeId) throw new ForbiddenException('برای ثبت ورود، پروندهٔ کارمندی متصل به حساب لازم است.');
    const employee = await this.prisma.employee.findFirst({
      where: { id: access.employeeId, organizationId: access.organizationId, status: { not: EmployeeStatus.TERMINATED } },
      select: { id: true },
    });
    if (!employee) throw new ForbiddenException('پروندهٔ کاربری برای ثبت ورود فعال نیست.');
    const now = new Date();
    const workDate = await this.getWorkDate(access.organizationId, now);
    const current = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
    });
    if (current?.checkInAt) throw new ConflictException('ورود امروز قبلاً ثبت شده است.');
    return this.prisma.attendanceRecord.upsert({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
      create: { organizationId: access.organizationId, employeeId: employee.id, workDate, checkInAt: now, status: AttendanceStatus.PRESENT, recordedById: user.id },
      update: { checkInAt: now, status: current?.status ?? AttendanceStatus.PRESENT, recordedById: user.id },
    });
  }

  async checkOut(user: CurrentAuthUser) {
    const access = await this.getMembershipAccess(user);
    if (!access.employeeId) throw new ForbiddenException('برای ثبت خروج، پروندهٔ کارمندی متصل به حساب لازم است.');
    const now = new Date();
    const workDate = await this.getWorkDate(access.organizationId, now);
    const current = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_workDate: { employeeId: access.employeeId, workDate } },
    });
    if (!current?.checkInAt) throw new BadRequestException('ابتدا باید ورود امروز را ثبت کنید.');
    if (current.checkOutAt) throw new ConflictException('خروج امروز قبلاً ثبت شده است.');
    if (now <= current.checkInAt) throw new BadRequestException('زمان خروج باید بعد از زمان ورود باشد.');
    return this.prisma.attendanceRecord.update({ where: { id: current.id }, data: { checkOutAt: now, recordedById: user.id } });
  }

  async getPayroll(user: CurrentAuthUser, period?: string) {
    const access = await this.getMembershipAccess(user);
    if (!access.canViewPayroll && !access.employeeId) {
      throw new ForbiddenException('مجوز مشاهدهٔ فیش حقوقی را ندارید.');
    }
    if (period && !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new BadRequestException('دورهٔ حقوق باید با قالب YYYY-MM باشد.');
    }
    return this.prisma.payrollRecord.findMany({
      where: {
        organizationId: access.organizationId,
        ...(period ? { period } : {}),
        ...(access.canViewPayroll ? {} : { employeeId: access.employeeId! }),
      },
      include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, jobTitle: true, branch: { select: { name: true } }, department: { select: { name: true } } } } },
      orderBy: [{ period: 'desc' }, { employee: { firstName: 'asc' } }],
    });
  }

  async savePayroll(user: CurrentAuthUser, dto: SavePayrollDto) {
    const access = await this.getMembershipAccess(user);
    if (!access.canManagePayroll) throw new ForbiddenException('مجوز مدیریت حقوق و دستمزد را ندارید.');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(dto.period)) throw new BadRequestException('دورهٔ حقوق معتبر نیست.');
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId: access.organizationId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('کارمند در سازمان جاری پیدا نشد.');
    const baseSalary = new Prisma.Decimal(dto.baseSalary);
    const overtime = new Prisma.Decimal(dto.overtime ?? 0);
    const allowances = new Prisma.Decimal(dto.allowances ?? 0);
    const deductions = new Prisma.Decimal(dto.deductions ?? 0);
    const netAmount = baseSalary.add(overtime).add(allowances).sub(deductions);
    if (netAmount.lessThan(0)) throw new BadRequestException('کسورات نمی‌تواند از مجموع دریافتی بیشتر باشد.');
    const current = await this.prisma.payrollRecord.findUnique({
      where: { employeeId_period: { employeeId: employee.id, period: dto.period } },
      select: { id: true, status: true },
    });
    if (current && current.status !== PayrollStatus.DRAFT) {
      throw new ConflictException('فقط فیش پیش‌نویس قابل ویرایش است.');
    }
    const data = {
      currency: dto.currency ?? 'IRR', baseSalary, overtime, allowances, deductions,
      netAmount, note: dto.note?.trim() || null,
    };
    return current
      ? this.prisma.payrollRecord.update({ where: { id: current.id }, data, include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } } })
      : this.prisma.payrollRecord.create({
          data: { ...data, organizationId: access.organizationId, employeeId: employee.id, period: dto.period, createdById: user.id },
          include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
        });
  }

  async updatePayrollStatus(user: CurrentAuthUser, payrollId: string, dto: UpdatePayrollStatusDto) {
    const access = await this.getMembershipAccess(user);
    if (!access.canManagePayroll) throw new ForbiddenException('مجوز تأیید یا پرداخت حقوق را ندارید.');
    const record = await this.prisma.payrollRecord.findFirst({
      where: { id: payrollId, organizationId: access.organizationId },
      select: { id: true, status: true },
    });
    if (!record) throw new NotFoundException('فیش حقوقی در سازمان جاری پیدا نشد.');
    if (record.status === PayrollStatus.DRAFT && dto.status === PayrollStatus.APPROVED) {
      return this.prisma.payrollRecord.update({ where: { id: record.id }, data: { status: PayrollStatus.APPROVED, approvedById: user.id, approvedAt: new Date() } });
    }
    if (record.status === PayrollStatus.APPROVED && dto.status === PayrollStatus.PAID) {
      return this.prisma.payrollRecord.update({ where: { id: record.id }, data: { status: PayrollStatus.PAID, paidAt: new Date() } });
    }
    throw new BadRequestException('تغییر وضعیت فیش حقوقی با این ترتیب مجاز نیست.');
  }

  /**
   * تبدیل رشته تاریخ به Date معتبر
   */
  private parseDate(
    value: string | null | undefined,
    fieldName: string,
  ): Date | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        `مقدار فیلد ${fieldName} تاریخ معتبر نیست.`,
      );
    }

    return date;
  }

  /**
   * محاسبه مدت مرخصی برحسب دقیقه
   */
  private calculateDurationMinutes(
    startAt: Date,
    endAt: Date,
  ): number {
    const durationMilliseconds =
      endAt.getTime() - startAt.getTime();

    if (durationMilliseconds <= 0) {
      throw new BadRequestException(
        'تاریخ پایان مرخصی باید بعد از تاریخ شروع باشد.',
      );
    }

    const durationMinutes = Math.ceil(
      durationMilliseconds / (1000 * 60),
    );

    if (durationMinutes <= 0) {
      throw new BadRequestException(
        'مدت مرخصی باید بیشتر از صفر دقیقه باشد.',
      );
    }

    return durationMinutes;
  }

  /**
   * مدیریت خطاهای محدودیت Prisma
   */
  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
    ) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'رکوردی با یکی از مقادیر یکتا (مانند کد پرسنلی یا نام کاربری) از قبل وجود دارد.',
        );
      }

      if (error.code === 'P2025') {
        throw new NotFoundException(
          'رکورد موردنظر پیدا نشد.',
        );
      }

      if (error.code === 'P2003') {
        throw new BadRequestException(
          'یکی از ارتباطات ارجاع‌شده معتبر نیست.',
        );
      }
    }

    throw error;
  }

  /**
   * بررسی تعلق کاربر، شعبه یا دپارتمان به سازمان جاری
   */
  private async validateEmployeeRelations(
    organizationId: string,
    dto: {
      userId?: string | null;
      branchId?: string | null;
      departmentId?: string | null;
      managerId?: string | null;
    },
    employeeId?: string,
  ): Promise<void> {
    if (dto.userId) {
      const membership =
        await this.prisma.organizationMember.findFirst({
          where: {
            userId: dto.userId,
            organizationId,
            status: 'ACTIVE',
          },
          select: {
            id: true,
          },
        });

      if (!membership) {
        throw new BadRequestException(
          'کاربر انتخاب‌شده عضو فعال سازمان جاری نیست.',
        );
      }

      const alreadyLinked = await this.prisma.employee.findFirst({
        where: {
          organizationId,
          userId: dto.userId,
          ...(employeeId ? { id: { not: employeeId } } : {}),
        },
        select: { id: true },
      });
      if (alreadyLinked) {
        throw new ConflictException('\u0627\u06cc\u0646 \u062d\u0633\u0627\u0628 \u0642\u0628\u0644\u0627\u064b \u0628\u0647 \u067e\u0631\u0648\u0646\u062f\u0647\u0654 \u067e\u0631\u0633\u0646\u0644\u06cc \u062f\u06cc\u06af\u0631\u06cc \u062f\u0631 \u0627\u06cc\u0646 \u0633\u0627\u0632\u0645\u0627\u0646 \u0648\u0635\u0644 \u0634\u062f\u0647 \u0627\u0633\u062a.');
      }
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: dto.branchId,
          organizationId,
        },
        select: {
          id: true,
        },
      });

      if (!branch) {
        throw new BadRequestException(
          'شعبه انتخاب‌شده متعلق به سازمان جاری نیست.',
        );
      }
    }

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: {
          id: dto.departmentId,
          organizationId,
        },
        select: {
          id: true,
        },
      });

      if (!department) {
        throw new BadRequestException(
          'دپارتمان انتخاب‌شده متعلق به سازمان جاری نیست.',
        );
      }
    }

    if (dto.managerId) {
      const manager = await this.prisma.employee.findFirst({
        where: {
          id: dto.managerId,
          organizationId,
        },
        select: {
          id: true,
        },
      });

      if (!manager) {
        throw new BadRequestException(
          'مدیر مستقیم انتخاب‌شده متعلق به سازمان جاری نیست.',
        );
      }
    }
  }

  /**
   * داشبورد منابع انسانی
   */
  async getDashboard(user: CurrentAuthUser) {
    const { organizationId, canReadAll, employeeId } = await this.getMembershipAccess(user);
    if (!canReadAll) {
      if (!employeeId) {
        return {
          employees: { total: 0, active: 0, onLeave: 0, terminated: 0 },
          leaveRequests: { total: 0, pending: 0, approved: 0, rejected: 0 },
        };
      }
      const [employee, counts] = await Promise.all([
        this.prisma.employee.findUnique({ where: { id: employeeId }, select: { status: true } }),
        this.prisma.leaveRequest.groupBy({
          by: ['status'], where: { organizationId, employeeId }, _count: { _all: true },
        }),
      ]);
      const leaveCounts = new Map(counts.map(({ status, _count }) => [status, _count._all]));
      return {
        employees: { total: 1, active: employee?.status === EmployeeStatus.ACTIVE ? 1 : 0, onLeave: employee?.status === EmployeeStatus.ON_LEAVE ? 1 : 0, terminated: employee?.status === EmployeeStatus.TERMINATED ? 1 : 0 },
        leaveRequests: {
          total: counts.reduce((total, item) => total + item._count._all, 0),
          pending: leaveCounts.get(LeaveRequestStatus.PENDING) ?? 0,
          approved: leaveCounts.get(LeaveRequestStatus.APPROVED) ?? 0,
          rejected: leaveCounts.get(LeaveRequestStatus.REJECTED) ?? 0,
        },
      };
    }

    const [
      totalEmployees,
      activeEmployees,
      onLeaveEmployees,
      terminatedEmployees,
      totalLeaveRequests,
      pendingLeaveRequests,
      approvedLeaveRequests,
      rejectedLeaveRequests,
    ] = await Promise.all([
      this.prisma.employee.count({
        where: {
          organizationId,
        },
      }),

      this.prisma.employee.count({
        where: {
          organizationId,
          status: EmployeeStatus.ACTIVE,
        },
      }),

      this.prisma.employee.count({
        where: {
          organizationId,
          status: EmployeeStatus.ON_LEAVE,
        },
      }),

      this.prisma.employee.count({
        where: {
          organizationId,
          status: EmployeeStatus.TERMINATED,
        },
      }),

      this.prisma.leaveRequest.count({
        where: {
          organizationId,
        },
      }),

      this.prisma.leaveRequest.count({
        where: {
          organizationId,
          status: LeaveRequestStatus.PENDING,
        },
      }),

      this.prisma.leaveRequest.count({
        where: {
          organizationId,
          status: LeaveRequestStatus.APPROVED,
        },
      }),

      this.prisma.leaveRequest.count({
        where: {
          organizationId,
          status: LeaveRequestStatus.REJECTED,
        },
      }),
    ]);

    return {
      employees: {
        total: totalEmployees,
        active: activeEmployees,
        onLeave: onLeaveEmployees,
        terminated: terminatedEmployees,
      },
      leaveRequests: {
        total: totalLeaveRequests,
        pending: pendingLeaveRequests,
        approved: approvedLeaveRequests,
        rejected: rejectedLeaveRequests,
      },
    };
  }

  /**
   * فهرست کارکنان
   */
  async getEmployees(
    user: CurrentAuthUser,
    filters: EmployeeFilters = {},
  ) {
    const { organizationId, canViewEmployees, employeeId } = await this.getMembershipAccess(user);

    const where: Prisma.EmployeeWhereInput = {
      organizationId,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.employmentType) {
      where.employmentType = filters.employmentType;
    }

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters.departmentId) {
      where.departmentId = filters.departmentId;
    }

    if (filters.search?.trim()) {
      const search = filters.search.trim();

      where.OR = [
        {
          employeeCode: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          firstName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          nationalId: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          phone: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (!canViewEmployees) {
      if (!employeeId) return [];
      where.id = employeeId;
    }

    return this.prisma.employee.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
        branch: true,
        department: true,
      },
      orderBy: [
        {
          firstName: 'asc',
        },
        {
          lastName: 'asc',
        },
      ],
    });
  }

  /**
   * جزئیات یک کارمند
   */
  async getEmployeeById(
    user: CurrentAuthUser,
    employeeId: string,
  ) {
    const { organizationId, canViewEmployees, canViewLeaves, employeeId: ownEmployeeId } = await this.getMembershipAccess(user);
    if (!canViewEmployees && ownEmployeeId !== employeeId) {
      throw new ForbiddenException('برای مشاهده پروندهٔ این کارمند مجوز ندارید.');
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        organizationId,
      },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
        branch: true,
        department: true,
        leaveRequests: canViewLeaves ? {
          include: {
            reviewedBy: { select: { id: true, username: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
            statusHistory: {
              include: {
                actedBy: { select: { id: true, username: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
          orderBy: {
            startAt: 'desc',
          },
        } : false,
      },
    });

    if (!employee) {
      throw new NotFoundException(
        'کارمند موردنظر پیدا نشد.',
      );
    }

    return employee;
  }

  /**
   * ایجاد کارمند (با پشتیبانی از ساخت هم‌زمان حساب کاربری)
   */
  async createEmployee(
    user: CurrentAuthUser,
    dto: CreateEmployeeDto,
  ) {
    const { organizationId, canManageEmployees } = await this.getMembershipAccess(user);
    if (!canManageEmployees) throw new ForbiddenException('مجوز مدیریت پرونده‌های کارکنان را ندارید.');

    // اعتبارسنجی اولیه شعبه، دپارتمان و کاربر در صورت ارسال
    if (!dto.createAccount && dto.userId) {
      await this.validateEmployeeRelations(organizationId, {
        userId: dto.userId,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        managerId: dto.managerId,
      });
    } else {
      await this.validateEmployeeRelations(organizationId, {
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        managerId: dto.managerId,
      });
    }

    const hiredAt = this.parseDate(
      dto.hiredAt,
      'hiredAt',
    );

    if (!hiredAt) {
      throw new BadRequestException(
        'تاریخ استخدام الزامی است.',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        let assignedUserId: string | null = dto.userId ?? null;
        let nationalId = normalizeNationalId(dto.nationalId);
        if (!assignedUserId && nationalId) {
          const matchingUsers = await tx.user.findMany({
            where: {
              nationalId,
              memberships: { some: { organizationId, status: 'ACTIVE' } },
              employeeProfiles: { none: { organizationId } },
            },
            select: { id: true },
            take: 2,
          });
          if (matchingUsers.length > 1) {
            throw new ConflictException('چند حساب کاربری با این کد ملی در سازمان پیدا شد؛ اتصال را دستی انجام دهید.');
          }
          assignedUserId = matchingUsers[0]?.id ?? null;
        }

        // در صورت درخواست ایجاد حساب کاربری هم‌زمان
        if (dto.createAccount && !assignedUserId) {
          const accountUsername = dto.username?.trim();
          if (!accountUsername) {
            throw new BadRequestException('برای ایجاد حساب، نام کاربری الزامی است.');
          }

          if (!dto.password || dto.password.length < 6) {
            throw new BadRequestException('کلمه عبور باید حداقل ۶ کاراکتر باشد.');
          }

          // بررسی تکراری نبودن نام کاربری یا ایمیل/موبایل
          const conflictConditions: Prisma.UserWhereInput[] = [
            { username: accountUsername },
          ];

          if (dto.email?.trim()) {
            conflictConditions.push({ email: dto.email.trim() });
          }

          if (dto.phone?.trim()) {
            conflictConditions.push({ phone: dto.phone.trim() });
          }

          const existingUser = await tx.user.findFirst({
            where: {
              OR: conflictConditions,
            },
          });

          if (existingUser) {
            throw new ConflictException(
              'نام کاربری، ایمیل یا شماره موبایل واردشده قبلاً در سیستم ثبت شده است.',
            );
          }

          const passwordHash = await bcrypt.hash(dto.password, 12);

          // ساخت کاربر
          const newUser = await tx.user.create({
            data: {
              username: accountUsername,
              firstName: dto.firstName,
              lastName: dto.lastName,
              email: dto.email?.trim() || null,
              phone: dto.phone?.trim() || null,
              nationalId,
              passwordHash,
              status: UserStatus.ACTIVE,
            },
          });

          assignedUserId = newUser.id;

          // عضویت در سازمان جاری
          const membership = await tx.organizationMember.create({
            data: {
              organizationId,
              userId: newUser.id,
              status: 'ACTIVE',
            },
          });

          // انتساب نقش‌ها در صورت ارسال
          if (dto.roleIds && dto.roleIds.length > 0) {
            const validRoles = await tx.role.findMany({
              where: {
                id: { in: dto.roleIds },
                OR: [
                  { organizationId },
                  { scope: 'SYSTEM' },
                ],
              },
              select: { id: true },
            });

            if (validRoles.length > 0) {
              await tx.memberRole.createMany({
                data: validRoles.map((role) => ({
                  memberId: membership.id,
                  roleId: role.id,
                })),
                skipDuplicates: true,
              });
            }
          }
        }

        // ایجاد رکورد نهایی کارمند
        if (assignedUserId) {
          const linkedUser = await tx.user.findFirst({
            where: {
              id: assignedUserId,
              memberships: { some: { organizationId, status: 'ACTIVE' } },
            },
            select: { id: true, nationalId: true },
          });
          if (!linkedUser) {
            throw new BadRequestException('\u062d\u0633\u0627\u0628 \u06a9\u0627\u0631\u0628\u0631\u06cc \u0645\u062a\u0639\u0644\u0642 \u0628\u0647 \u0633\u0627\u0632\u0645\u0627\u0646 \u0641\u0639\u0627\u0644 \u0646\u06cc\u0633\u062a.');
          }
          const accountNationalId = normalizeNationalId(linkedUser.nationalId);
          if (nationalId && accountNationalId && nationalId !== accountNationalId) {
            throw new ConflictException('Ú©Ø¯ Ù…Ù„ÛŒ Ù¾Ø±ÙˆÙ†Ø¯Ù‡ Ø¨Ø§ Ú©Ø¯ Ù…Ù„ÛŒ Ø­Ø³Ø§Ø¨ Ú©Ø§Ø±Ø¨Ø±ÛŒ Ù‡Ù…Ø®ÙˆØ§Ù†ÛŒ Ù†Ø¯Ø§Ø±Ø¯.');
          }
          nationalId = nationalId ?? accountNationalId;
          if (nationalId && !accountNationalId) {
            await tx.user.update({ where: { id: linkedUser.id }, data: { nationalId } });
          }
        }

        return tx.employee.create({
          data: {
            organizationId,
            employeeCode: dto.employeeCode,
            userId: assignedUserId,
            branchId: dto.branchId ?? null,
            departmentId: dto.departmentId ?? null,
            managerId: dto.managerId ?? null,
            firstName: dto.firstName,
            lastName: dto.lastName,
            nationalId,
            phone: dto.phone ?? null,
            email: dto.email ?? null,
            jobTitle: dto.jobTitle ?? null,
            employmentType: dto.employmentType ?? EmploymentType.FULL_TIME,
            status: dto.status ?? EmployeeStatus.ACTIVE,
            hiredAt,
            birthDate: this.parseDate(dto.birthDate, 'birthDate'),
            address: dto.address ?? null,
            emergencyPhone: dto.emergencyPhone ?? null,
            notes: dto.notes ?? null,
          },
          include: {
            user: { select: { id: true, username: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
            branch: true,
            department: true,
          },
        });
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  /**
   * ویرایش کارمند
   */
  async updateEmployee(
    user: CurrentAuthUser,
    employeeId: string,
    dto: UpdateEmployeeDto,
  ) {
    const { organizationId, canManageEmployees, employeeId: ownEmployeeId } = await this.getMembershipAccess(user);
    const isSelfService = !canManageEmployees && ownEmployeeId === employeeId;
    if (!canManageEmployees && !isSelfService) throw new ForbiddenException('مجوز ویرایش پروندهٔ این کارمند را ندارید.');
    if (isSelfService) {
      const allowedFields = new Set(['phone', 'email', 'address', 'emergencyPhone']);
      const requestedFields = Object.keys(dto).filter((key) => (dto as Record<string, unknown>)[key] !== undefined);
      if (requestedFields.some((key) => !allowedFields.has(key))) {
        throw new ForbiddenException('در خودخدمتی فقط اطلاعات تماس قابل ویرایش است.');
      }
    }

    const existingEmployee =
      await this.prisma.employee.findFirst({
        where: {
          id: employeeId,
          organizationId,
        },
        select: {
          id: true,
          userId: true,
          nationalId: true,
        },
      });

    if (!existingEmployee) {
      throw new NotFoundException(
        'کارمند موردنظر پیدا نشد.',
      );
    }

    if (dto.managerId === employeeId) {
      throw new BadRequestException('کارمند نمی‌تواند مدیر مستقیم خودش باشد.');
    }

    await this.validateEmployeeRelations(
      organizationId,
      dto,
      employeeId,
    );

    const data: Prisma.EmployeeUncheckedUpdateInput = {};

    if (dto.employeeCode !== undefined) {
      data.employeeCode = dto.employeeCode;
    }

    if (dto.userId !== undefined) {
      data.userId = dto.userId;
    }

    if (dto.branchId !== undefined) {
      data.branchId = dto.branchId;
    }

    if (dto.departmentId !== undefined) {
      data.departmentId = dto.departmentId;
    }

    if (dto.managerId !== undefined) {
      data.managerId = dto.managerId;
    }

    if (dto.firstName !== undefined) {
      data.firstName = dto.firstName;
    }

    if (dto.lastName !== undefined) {
      data.lastName = dto.lastName;
    }

    if (dto.nationalId !== undefined) {
      const nationalId = normalizeNationalId(dto.nationalId);
      data.nationalId = nationalId;
      if (dto.userId === undefined && !existingEmployee.userId && nationalId) {
        const matchingUsers = await this.prisma.user.findMany({
          where: {
            nationalId,
            memberships: { some: { organizationId, status: 'ACTIVE' } },
            employeeProfiles: { none: { organizationId } },
          },
          select: { id: true },
          take: 2,
        });
        if (matchingUsers.length > 1) {
          throw new ConflictException('چند حساب کاربری با این کد ملی در سازمان پیدا شد؛ اتصال را دستی انجام دهید.');
        }
        if (matchingUsers[0]) data.userId = matchingUsers[0].id;
      }
    }

    if (dto.phone !== undefined) {
      data.phone = dto.phone;
    }

    if (dto.email !== undefined) {
      data.email = dto.email;
    }

    if (dto.jobTitle !== undefined) {
      data.jobTitle = dto.jobTitle;
    }

    if (dto.employmentType !== undefined) {
      data.employmentType = dto.employmentType;
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    if (dto.hiredAt !== undefined) {
      const hiredAt = this.parseDate(
        dto.hiredAt,
        'hiredAt',
      );

      if (!hiredAt) {
        throw new BadRequestException(
          'تاریخ استخدام معتبر نیست.',
        );
      }

      data.hiredAt = hiredAt;
    }

    if (dto.terminatedAt !== undefined) {
      data.terminatedAt = this.parseDate(
        dto.terminatedAt,
        'terminatedAt',
      );
    }

    if (dto.birthDate !== undefined) {
      data.birthDate = this.parseDate(
        dto.birthDate,
        'birthDate',
      );
    }

    if (dto.address !== undefined) {
      data.address = dto.address;
    }

    if (dto.emergencyPhone !== undefined) {
      data.emergencyPhone = dto.emergencyPhone;
    }

    if (dto.notes !== undefined) {
      data.notes = dto.notes;
    }

    const targetUserId = typeof data.userId === 'string'
      ? data.userId
      : dto.userId !== undefined
        ? dto.userId
        : existingEmployee.userId;
    let nationalIdToSetOnUser: string | null = null;
    if (targetUserId) {
      const linkedUser = await this.prisma.user.findFirst({
        where: {
          id: targetUserId,
          memberships: { some: { organizationId, status: 'ACTIVE' } },
        },
        select: { id: true, nationalId: true },
      });
      if (!linkedUser) {
        throw new BadRequestException('\u062d\u0633\u0627\u0628 \u06a9\u0627\u0631\u0628\u0631\u06cc \u0645\u062a\u0639\u0644\u0642 \u0628\u0647 \u0633\u0627\u0632\u0645\u0627\u0646 \u0641\u0639\u0627\u0644 \u0646\u06cc\u0633\u062a.');
      }
      const accountNationalId = normalizeNationalId(linkedUser.nationalId);
      const employeeNationalId = data.nationalId !== undefined
        ? normalizeNationalId(data.nationalId as string | null)
        : normalizeNationalId(existingEmployee.nationalId);
      if (employeeNationalId && accountNationalId && employeeNationalId !== accountNationalId) {
        throw new ConflictException('\u06a9\u062f \u0645\u0644\u06cc \u067e\u0631\u0648\u0646\u062f\u0647 \u0628\u0627 \u06a9\u062f \u0645\u0644\u06cc \u062d\u0633\u0627\u0628 \u06a9\u0627\u0631\u0628\u0631\u06cc \u0647\u0645\u062e\u0648\u0627\u0646\u06cc \u0646\u062f\u0627\u0631\u062f.');
      }
      const synchronizedNationalId = employeeNationalId ?? accountNationalId;
      if (synchronizedNationalId && data.nationalId === undefined) {
        data.nationalId = synchronizedNationalId;
      }
      if (synchronizedNationalId && !accountNationalId) {
        nationalIdToSetOnUser = synchronizedNationalId;
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (targetUserId && nationalIdToSetOnUser) {
          await tx.user.update({ where: { id: targetUserId }, data: { nationalId: nationalIdToSetOnUser } });
        }
        return tx.employee.update({
          where: { id: employeeId },
          data,
          include: {
            user: { select: { id: true, username: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
            branch: true,
            department: true,
          },
        });
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  /**
   * فهرست درخواست‌های مرخصی
   */
  async getLeaveRequests(
    user: CurrentAuthUser,
    filters: LeaveRequestFilters = {},
  ) {
    const { organizationId, canViewLeaves, employeeId: ownEmployeeId } = await this.getMembershipAccess(user);

    const where: Prisma.LeaveRequestWhereInput = {
      organizationId,
    };

    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }
    if (!canViewLeaves) {
      if (!ownEmployeeId || (filters.employeeId && filters.employeeId !== ownEmployeeId)) return [];
      where.employeeId = ownEmployeeId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.leaveType) {
      where.leaveType = filters.leaveType;
    }

    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          include: {
            branch: true,
            department: true,
          },
        },
        reviewedBy: { select: { id: true, username: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
        statusHistory: {
          include: {
            actedBy: { select: { id: true, username: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * جزئیات درخواست مرخصی
   */
  async getLeaveRequestById(
    user: CurrentAuthUser,
    leaveRequestId: string,
  ) {
    const { organizationId, canViewLeaves, employeeId: ownEmployeeId } = await this.getMembershipAccess(user);

    const leaveRequest =
      await this.prisma.leaveRequest.findFirst({
        where: {
          id: leaveRequestId,
          organizationId,
        },
        include: {
          employee: {
            include: {
              user: { select: { id: true, username: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
              branch: true,
              department: true,
            },
          },
          reviewedBy: { select: { id: true, username: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
          statusHistory: {
            include: {
              actedBy: { select: { id: true, username: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });

    if (!leaveRequest) {
      throw new NotFoundException(
        'درخواست مرخصی موردنظر پیدا نشد.',
      );
    }

    if (!canViewLeaves && leaveRequest.employeeId !== ownEmployeeId) {
      throw new ForbiddenException('مجوز مشاهدهٔ این درخواست مرخصی را ندارید.');
    }

    return leaveRequest;
  }

  /**
   * ایجاد درخواست مرخصی
   */
  async createLeaveRequest(
    user: CurrentAuthUser,
    dto: CreateLeaveRequestDto,
  ) {
    const { organizationId, canManageLeaves, employeeId: ownEmployeeId } = await this.getMembershipAccess(user);
    if (!canManageLeaves && (!ownEmployeeId || dto.employeeId !== ownEmployeeId)) {
      throw new ForbiddenException('فقط می‌توانید برای خودتان درخواست مرخصی ثبت کنید.');
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        id: dto.employeeId,
        organizationId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!employee) {
      throw new NotFoundException(
        'کارمند موردنظر در سازمان جاری پیدا نشد.',
      );
    }

    if (employee.status === EmployeeStatus.TERMINATED) {
      throw new BadRequestException(
        'برای کارمند خاتمه‌یافته نمی‌توان درخواست مرخصی ثبت کرد.',
      );
    }

    const startAt = this.parseDate(
      dto.startAt,
      'startAt',
    );

    const endAt = this.parseDate(
      dto.endAt,
      'endAt',
    );

    if (!startAt || !endAt) {
      throw new BadRequestException(
        'تاریخ شروع و پایان مرخصی الزامی است.',
      );
    }

    const durationMinutes =
      this.calculateDurationMinutes(
        startAt,
        endAt,
      );

    const overlappingRequest =
      await this.prisma.leaveRequest.findFirst({
        where: {
          organizationId,
          employeeId: dto.employeeId,
          status: {
            in: [
              LeaveRequestStatus.PENDING,
              LeaveRequestStatus.APPROVED,
            ],
          },
          startAt: {
            lt: endAt,
          },
          endAt: {
            gt: startAt,
          },
        },
        select: {
          id: true,
        },
      });

    if (overlappingRequest) {
      throw new ConflictException(
        'برای این کارمند در بازه زمانی انتخاب‌شده، درخواست مرخصی دیگری وجود دارد.',
      );
    }

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const leaveRequest =
            await transaction.leaveRequest.create({
              data: {
                organizationId,
                employeeId: dto.employeeId,
                leaveType: dto.leaveType,
                status: LeaveRequestStatus.PENDING,
                startAt,
                endAt,
                durationMinutes,
                reason: dto.reason?.trim() || null,
              },
            });

          await transaction.leaveRequestStatusHistory.create({
            data: {
              leaveRequestId: leaveRequest.id,
              actedById: user.id,
              status: LeaveRequestStatus.PENDING,
            },
          });

          return transaction.leaveRequest.findUnique({
            where: {
              id: leaveRequest.id,
            },
            include: {
              employee: {
                include: {
                  branch: true,
                  department: true,
                },
              },
              statusHistory: {
                include: {
                  actedBy: { select: { id: true, username: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
                },
                orderBy: {
                  createdAt: 'desc',
                },
              },
            },
          });
        },
      );
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  /**
   * تغییر وضعیت درخواست مرخصی
   */
  async updateLeaveRequestStatus(
    user: CurrentAuthUser,
    leaveRequestId: string,
    dto: UpdateLeaveRequestStatusDto,
  ) {
    const { organizationId, canManageLeaves, employeeId: ownEmployeeId } = await this.getMembershipAccess(user);

    const existingRequest =
      await this.prisma.leaveRequest.findFirst({
        where: {
          id: leaveRequestId,
          organizationId,
        },
        select: {
          id: true,
          status: true,
          employeeId: true,
        },
      });

    if (!existingRequest) {
      throw new NotFoundException(
        'درخواست مرخصی موردنظر پیدا نشد.',
      );
    }

    const isOwnCancellation = !canManageLeaves && existingRequest.employeeId === ownEmployeeId && dto.status === LeaveRequestStatus.CANCELLED;
    if (!canManageLeaves && !isOwnCancellation) {
      throw new ForbiddenException('برای بررسی یا تغییر وضعیت درخواست مرخصی مجوز ندارید.');
    }
    if (isOwnCancellation && existingRequest.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException('فقط درخواست در انتظار را می‌توانید لغو کنید.');
    }

    if (
      existingRequest.status ===
      LeaveRequestStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'وضعیت درخواست لغوشده قابل تغییر نیست.',
      );
    }

    if (
      existingRequest.status ===
      LeaveRequestStatus.REJECTED &&
      dto.status === LeaveRequestStatus.APPROVED
    ) {
      throw new BadRequestException(
        'درخواست ردشده مستقیماً قابل تأیید نیست.',
      );
    }

    const updateData: Prisma.LeaveRequestUncheckedUpdateInput =
      {
        status: dto.status,
        reviewerNote: dto.reviewerNote ?? null,
        reviewedById: user.id,
        reviewedAt: new Date(),
        cancelledAt:
          dto.status === LeaveRequestStatus.CANCELLED
            ? new Date()
            : null,
      };

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          await transaction.leaveRequest.update({
            where: {
              id: leaveRequestId,
            },
            data: updateData,
          });

          await transaction.leaveRequestStatusHistory.create({
            data: {
              leaveRequestId,
              actedById: user.id,
              status: dto.status,
              note: dto.reviewerNote ?? null,
            },
          });

          return transaction.leaveRequest.findFirst({
            where: {
              id: leaveRequestId,
              organizationId,
            },
            include: {
              employee: {
                include: {
              user: { select: { id: true, username: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
                  branch: true,
                  department: true,
                },
              },
              reviewedBy: { select: { id: true, username: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
              statusHistory: {
                include: {
                  actedBy: { select: { id: true, username: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
                },
                orderBy: {
                  createdAt: 'desc',
                },
              },
            },
          });
        },
      );
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async getBusinessTripRequests(user: CurrentAuthUser, status?: LeaveRequestStatus) {
    const { organizationId, canViewLeaves, employeeId } = await this.getMembershipAccess(user);
    if (!canViewLeaves && !employeeId) return [];
    return this.prisma.businessTripRequest.findMany({
      where: { organizationId, ...(status ? { status } : {}), ...(!canViewLeaves ? { employeeId: employeeId! } : {}) },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, jobTitle: true, branch: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } } },
        reviewedBy: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async notifyTripReviewers(request: { id: string; organizationId: string; destination: string }) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { organizationId: request.organizationId, status: 'ACTIVE', organization: { status: 'ACTIVE' } },
      select: { userId: true, roles: { select: { role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } } } }, organization: { select: { ownerId: true } } },
    });
    const recipients = memberships.filter((membership) => membership.userId === membership.organization.ownerId || membership.roles.some(({ role }) => ['ADMIN', 'SUPER_ADMIN'].includes(role.key.toUpperCase()) || role.permissions.some(({ permission }) => ['hr.write', 'hr.leaves.approve'].includes(permission.key)))).map(({ userId }) => userId);
    const outcomes = await Promise.allSettled(recipients.map((recipientUserId) => this.notifications.createForUser({
      organizationId: request.organizationId, recipientUserId, source: 'human-resources', eventKey: 'hr.business_trip.requested',
      title: tripNotificationText.requested.title, body: tripNotificationText.requested.body(request.destination), href: '/hr/leaves',
      metadata: { requestId: request.id, requestType: 'business-trip' },
    })));
    outcomes.forEach((outcome) => { if (outcome.status === 'rejected') this.logger.warn(`Could not notify a business trip reviewer: ${String(outcome.reason)}`); });
  }

  private async notifyTripEmployee(request: { id: string; organizationId: string; employee: { userId: string | null }; destination: string }, status: 'APPROVED' | 'REJECTED' | 'CANCELLED') {
    if (!request.employee.userId) return;
    try {
      await this.notifications.createForUser({
        organizationId: request.organizationId, recipientUserId: request.employee.userId, source: 'human-resources', eventKey: 'hr.business_trip.reviewed',
        title: tripNotificationText.reviewed.title, body: tripNotificationText.reviewed.body(request.destination, status), href: '/hr/leaves',
        metadata: { requestId: request.id, requestType: 'business-trip', status },
      });
    } catch (error) {
      this.logger.warn(`Could not notify employee about business trip ${request.id}: ${String(error)}`);
    }
  }

  async createBusinessTripRequest(user: CurrentAuthUser, dto: CreateBusinessTripRequestDto) {
    const access = await this.getMembershipAccess(user);
    if (!access.employeeId) throw new ForbiddenException('برای ثبت درخواست مأموریت، پروندهٔ کارمندی باید به حساب متصل باشد.');
    if (!dto.destination.trim() || !dto.purpose.trim()) throw new BadRequestException('مقصد و هدف مأموریت را وارد کنید.');
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (startAt >= endAt) throw new BadRequestException('زمان پایان مأموریت باید بعد از زمان شروع باشد.');
    const created = await this.prisma.businessTripRequest.create({
      data: {
        organizationId: access.organizationId, employeeId: access.employeeId,
        destination: dto.destination.trim(), purpose: dto.purpose.trim(), startAt, endAt,
        estimatedCost: dto.estimatedCost == null ? null : new Prisma.Decimal(dto.estimatedCost),
        currency: dto.currency?.toUpperCase() || 'IRR',
      },
      include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
    });
    await this.notifyTripReviewers(created).catch((error) => this.logger.warn(`Could not notify business trip reviewers: ${String(error)}`));
    return created;
  }

  async updateBusinessTripRequestStatus(user: CurrentAuthUser, requestId: string, dto: UpdateLeaveRequestStatusDto) {
    const access = await this.getMembershipAccess(user);
    const request = await this.prisma.businessTripRequest.findFirst({ where: { id: requestId, organizationId: access.organizationId } });
    if (!request) throw new NotFoundException('درخواست مأموریت پیدا نشد.');
    const isOwnCancellation = !access.canManageLeaves && request.employeeId === access.employeeId && dto.status === LeaveRequestStatus.CANCELLED;
    if (!access.canManageLeaves && !isOwnCancellation) throw new ForbiddenException('مجوز بررسی درخواست‌های مأموریت را ندارید.');
    if (isOwnCancellation && request.status !== LeaveRequestStatus.PENDING) throw new BadRequestException('فقط درخواست در انتظار بررسی قابل لغو است.');
    if (!isOwnCancellation && request.status !== LeaveRequestStatus.PENDING) throw new BadRequestException('فقط درخواست در انتظار بررسی قابل تغییر وضعیت است.');
    if (dto.status === LeaveRequestStatus.DRAFT) throw new BadRequestException('وضعیت پیش‌نویس برای این درخواست مجاز نیست.');
    const updated = await this.prisma.businessTripRequest.update({
      where: { id: request.id },
      data: {
        status: dto.status,
        reviewerNote: dto.reviewerNote?.trim() || null,
        reviewedById: isOwnCancellation ? null : user.id,
        reviewedAt: isOwnCancellation ? null : new Date(),
        cancelledAt: dto.status === LeaveRequestStatus.CANCELLED ? new Date() : null,
      },
      include: { employee: { select: { id: true, userId: true, employeeCode: true, firstName: true, lastName: true } } },
    });
    if (!isOwnCancellation) await this.notifyTripEmployee(updated, dto.status as 'APPROVED' | 'REJECTED' | 'CANCELLED');
    return updated;
  }
}
