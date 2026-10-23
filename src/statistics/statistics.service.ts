import { ForbiddenException, Injectable } from '@nestjs/common';
import { AccountingInvoiceStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../core/auth/strategies/jwt.strategy';
import { PrismaService } from '../core/prisma/prisma.service';

type ReportPeriod = 'THIS_MONTH' | 'LAST_QUARTER' | 'YEAR_TO_DATE';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(user: AuthenticatedUser, requestedPeriod?: string) {
    if (!user?.organizationId) {
      throw new ForbiddenException('کاربر به سازمان فعالی دسترسی ندارد.');
    }

    const period: ReportPeriod =
      requestedPeriod === 'LAST_QUARTER' || requestedPeriod === 'YEAR_TO_DATE'
        ? requestedPeriod
        : 'THIS_MONTH';
    const { from, to } = this.getDateRange(period);
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: user.organizationId,
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
    if (!membership)
      throw new ForbiddenException('عضویت فعال سازمان لازم است.');

    const roles = membership.roles.map(({ role }) => role);
    const keys = new Set(
      roles.flatMap((role) =>
        role.permissions.map(({ permission }) => permission.key),
      ),
    );
    const administrator =
      membership.organization.ownerId === user.id ||
      roles.some((role) =>
        ['ADMIN', 'SUPER_ADMIN'].includes(role.key.toUpperCase()),
      );
    const canSeeAccounting =
      administrator ||
      keys.has('accounting.read') ||
      keys.has('accounting.write');
    const canSeeHr =
      administrator ||
      [...keys].some(
        (key) =>
          key === 'hr.read' ||
          key === 'hr.write' ||
          key.startsWith('hr.employees.') ||
          key.startsWith('hr.payroll.'),
      );
    const canSeeInventory =
      administrator ||
      keys.has('inventory.read') ||
      keys.has('inventory.write');
    const canSeeSales = administrator || keys.has('reports.sales.read');

    const [accounting, humanResources, inventory, sales] = await Promise.all([
      canSeeAccounting
        ? this.getAccounting(user.organizationId, from, to)
        : null,
      canSeeHr ? this.getHumanResources(user.organizationId, from, to) : null,
      canSeeInventory ? this.getInventory(user.organizationId, from, to) : null,
      canSeeSales ? this.getSales(user.organizationId, from, to) : null,
    ]);

    return {
      period,
      range: { from: from.toISOString(), to: to.toISOString() },
      accounting,
      humanResources,
      inventory,
      sales,
    };
  }

  private getDateRange(period: ReportPeriod) {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    if (period === 'YEAR_TO_DATE')
      return { from: new Date(now.getFullYear(), 0, 1), to: end };
    if (period === 'LAST_QUARTER') {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const to = new Date(now.getFullYear(), quarterStartMonth, 1);
      return {
        from: new Date(now.getFullYear(), quarterStartMonth - 3, 1),
        to,
      };
    }
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: end };
  }

  private async getAccounting(organizationId: string, from: Date, to: Date) {
    const [invoiceCount, pending, overdue] = await Promise.all([
      this.prisma.accountingInvoice.count({
        where: { organizationId, createdAt: { gte: from, lt: to } },
      }),
      this.prisma.accountingInvoice.count({
        where: {
          organizationId,
          status: {
            in: [
              AccountingInvoiceStatus.PENDING_REVIEW,
              AccountingInvoiceStatus.SUBMITTED,
            ],
          },
        },
      }),
      this.prisma.accountingInvoice.count({
        where: {
          organizationId,
          dueDate: { lt: new Date() },
          status: {
            notIn: [
              AccountingInvoiceStatus.COMPLETED,
              AccountingInvoiceStatus.CANCELLED,
              AccountingInvoiceStatus.REJECTED,
            ],
          },
        },
      }),
    ]);
    return { invoiceCount, pendingReview: pending, overdue };
  }

  private async getHumanResources(
    organizationId: string,
    from: Date,
    to: Date,
  ) {
    const [activeEmployees, hiresInPeriod] = await Promise.all([
      this.prisma.employee.count({
        where: { organizationId, status: 'ACTIVE' },
      }),
      this.prisma.employee.count({
        where: { organizationId, hiredAt: { gte: from, lt: to } },
      }),
    ]);
    return { activeEmployees, hiresInPeriod };
  }

  private async getInventory(organizationId: string, from: Date, to: Date) {
    const [products, movementsInPeriod] = await Promise.all([
      this.prisma.product.findMany({
        where: { organizationId, isActive: true },
        select: {
          minStockLevel: true,
          balances: { select: { quantity: true } },
        },
      }),
      this.prisma.inventoryMovement.count({
        where: { organizationId, createdAt: { gte: from, lt: to } },
      }),
    ]);
    return {
      activeProducts: products.length,
      lowStockProducts: products.filter(
        (product) =>
          product.balances.reduce(
            (sum, balance) => sum + balance.quantity,
            0,
          ) <= product.minStockLevel,
      ).length,
      movementsInPeriod,
    };
  }

  private async getSales(organizationId: string, from: Date, to: Date) {
    const [leadsInPeriod, openOpportunities] = await Promise.all([
      this.prisma.lead.count({
        where: { organizationId, createdAt: { gte: from, lt: to } },
      }),
      this.prisma.opportunity.count({
        where: { organizationId, state: 'OPEN' },
      }),
    ]);
    return { leadsInPeriod, openOpportunities };
  }
}
