/**
 * مسیر فایل:
 * backend/src/accounting/accounting.service.ts
 *
 * هدف:
 * منطق تجاری ماژول حسابداری:
 * - ایجاد فاکتور و محاسبه امن مبلغ‌ها در سرور
 * - فهرست و جزئیات فاکتورهای سازمان جاری
 * - گردش وضعیت و ثبت تاریخچه
 * - ثبت پرداخت و تشخیص تسویه کامل
 *
 * اصل امنیتی:
 * همه queryها به organizationId کاربر لاگین‌شده محدود هستند.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AccountingInvoiceStatus,
  AccountingPriority,
  AuditAction,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../core/prisma/prisma.service';

import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RegisterInvoicePaymentDto } from './dto/register-invoice-payment.dto';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { randomBytes } from 'node:crypto';

type CurrentAuthUser = {
  id: string;
  organizationId: string;
};

type InvoiceListQuery = {
  search?: string;
  status?: AccountingInvoiceStatus;
  priority?: AccountingPriority;
  moduleType?: string;
  branchId?: string;
  departmentId?: string;
  vendorOnly?: boolean;
};


const invoiceInclude = {
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
    },
  },
  branch: {
    select: {
      id: true,
      name: true,
    },
  },
  department: {
    select: {
      id: true,
      name: true,
    },
  },
  lineItems: {
    orderBy: {
      createdAt: 'asc',
    },
  },
  payments: {
    orderBy: {
      paidAt: 'desc',
    },
  },
  statusHistory: {
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      actedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
        },
      },
    },
  },
} satisfies Prisma.AccountingInvoiceInclude;

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccounts(user: CurrentAuthUser) {
    await this.requireView(user);
    return this.prisma.accountingAccount.findMany({
      where: { organizationId: user.organizationId }, orderBy: { code: 'asc' },
    });
  }

  async createAccount(user: CurrentAuthUser, dto: CreateAccountDto) {
    await this.requireManage(user);
    return this.prisma.accountingAccount.create({ data: {
      organizationId: user.organizationId, code: dto.code.trim(), name: dto.name.trim(),
      type: dto.type, isActive: dto.isActive ?? true,
    } });
  }

  async getVouchers(user: CurrentAuthUser) {
    await this.requireView(user);
    return this.prisma.accountingVoucher.findMany({
      where: { organizationId: user.organizationId },
      include: { lines: { include: { account: { select: { id: true, code: true, name: true } } } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 200,
    });
  }

  async createVoucher(user: CurrentAuthUser, dto: CreateVoucherDto) {
    await this.requireManage(user);
    if (!dto.description?.trim()) {
      throw new BadRequestException('\u0634\u0631\u062d \u0633\u0646\u062f \u0627\u0644\u0632\u0627\u0645\u06cc \u0627\u0633\u062a.');
    }
    if (!Array.isArray(dto.lines) || dto.lines.length < 2) {
      throw new BadRequestException('\u0633\u0646\u062f \u0628\u0627\u06cc\u062f \u062d\u062f\u0627\u0642\u0644 \u062f\u0648 \u0631\u062f\u06cc\u0641 \u062f\u0627\u0634\u062a\u0647 \u0628\u0627\u0634\u062f.');
    }
    const cents = (amount: number) => {
      if (!Number.isFinite(amount) || amount < 0) return null;
      const scaled = amount * 100;
      if (!Number.isSafeInteger(Math.round(scaled)) || Math.abs(scaled - Math.round(scaled)) > 1e-7) return null;
      return Math.round(scaled);
    };
    const debitCents: number[] = [];
    const creditCents: number[] = [];
    for (const line of dto.lines) {
      const debit = cents(Number(line.debit));
      const credit = cents(Number(line.credit));
      if (debit === null || credit === null || (debit > 0) === (credit > 0)) {
        throw new BadRequestException('\u0647\u0631 \u0631\u062f\u06cc\u0641 \u0628\u0627\u06cc\u062f \u0641\u0642\u0637 \u06cc\u06a9 \u0645\u0628\u0644\u063a \u0645\u062b\u0628\u062a \u0628\u062f\u0647\u06a9\u0627\u0631 \u06cc\u0627 \u0628\u0633\u062a\u0627\u0646\u06a9\u0627\u0631 \u062f\u0627\u0634\u062a\u0647 \u0628\u0627\u0634\u062f.');
      }
      debitCents.push(debit);
      creditCents.push(credit);
    }
    const debitTotal = debitCents.reduce((sum, amount) => sum + amount, 0);
    const creditTotal = creditCents.reduce((sum, amount) => sum + amount, 0);
    if (!Number.isSafeInteger(debitTotal) || !Number.isSafeInteger(creditTotal) || debitTotal <= 0 || debitTotal !== creditTotal) {
      throw new BadRequestException('\u062c\u0645\u0639 \u0628\u062f\u0647\u06a9\u0627\u0631 \u0648 \u0628\u0633\u062a\u0627\u0646\u06a9\u0627\u0631 \u0633\u0646\u062f \u0628\u0627\u06cc\u062f \u0628\u0631\u0627\u0628\u0631 \u0628\u0627\u0634\u062f.');
    }
    const accountIds = [...new Set(dto.lines.map((line) => line.accountId))];
    const accounts = await this.prisma.accountingAccount.findMany({
      where: { organizationId: user.organizationId, isActive: true, id: { in: accountIds } }, select: { id: true },
    });
    if (accounts.length !== accountIds.length) throw new BadRequestException('همه حساب‌های انتخاب‌شده فعال و متعلق به سازمان جاری نیستند.');
    const number = `JV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
    return this.prisma.accountingVoucher.create({ data: {
      organizationId: user.organizationId, createdById: user.id, number,
      date: new Date(dto.date), description: dto.description.trim(),
      lines: { create: dto.lines.map((line) => ({
        accountId: line.accountId, description: line.description?.trim() || null,
        debit: line.debit, credit: line.credit,
      })) },
    }, include: { lines: { include: { account: { select: { id: true, code: true, name: true } } } } } });
  }

  async postVoucher(user: CurrentAuthUser, id: string) {
    await this.requireManage(user);
    const voucher = await this.prisma.accountingVoucher.findFirst({
      where: { id, organizationId: user.organizationId }, include: { lines: true },
    });
    if (!voucher) throw new NotFoundException('سند حسابداری یافت نشد.');
    if (voucher.status !== 'DRAFT') throw new BadRequestException('این سند قبلاً ثبت نهایی شده است.');
    const debitCents = voucher.lines.reduce((sum, line) => sum + Math.round(Number(line.debit) * 100), 0);
    const creditCents = voucher.lines.reduce((sum, line) => sum + Math.round(Number(line.credit) * 100), 0);
    if (voucher.lines.length < 2 || !Number.isSafeInteger(debitCents) || !Number.isSafeInteger(creditCents) || debitCents <= 0 || debitCents !== creditCents || voucher.lines.some((line) => (Number(line.debit) > 0) === (Number(line.credit) > 0))) {
      throw new BadRequestException('برای ثبت نهایی، حداقل دو ردیف و توازن بدهکار و بستانکار لازم است.');
    }
    const posted = await this.prisma.accountingVoucher.updateMany({
      where: { id, organizationId: user.organizationId, status: 'DRAFT' },
      data: { status: 'POSTED' },
    });
    if (posted.count !== 1) throw new ConflictException('سند هم‌زمان توسط کاربر دیگری ثبت شده است.');
    return this.prisma.accountingVoucher.findFirstOrThrow({
      where: { id, organizationId: user.organizationId },
      include: { lines: { include: { account: { select: { id: true, code: true, name: true } } } } },
    });
  }

  async getLedger(user: CurrentAuthUser, accountId?: string) {
    await this.requireView(user);
    if (accountId) {
      const account = await this.prisma.accountingAccount.findFirst({ where: { id: accountId, organizationId: user.organizationId } });
      if (!account) throw new NotFoundException('حساب یافت نشد.');
    }
    return this.prisma.accountingVoucherLine.findMany({
      where: { voucher: { organizationId: user.organizationId, status: 'POSTED' }, ...(accountId ? { accountId } : {}) },
      include: { account: { select: { id: true, code: true, name: true, type: true } }, voucher: { select: { id: true, number: true, date: true, description: true } } },
      orderBy: { voucher: { date: 'desc' } }, take: 500,
    });
  }

  async getPayments(user: CurrentAuthUser) {
    await this.requireView(user);
    return this.prisma.accountingInvoicePayment.findMany({
      where: { invoice: { organizationId: user.organizationId } },
      include: { invoice: { select: { id: true, documentNumber: true, title: true, vendorName: true, currency: true } } },
      orderBy: { paidAt: 'desc' }, take: 500,
    });
  }

  async getTrialBalance(user: CurrentAuthUser) {
    await this.requireView(user);
    const [accounts, balances] = await Promise.all([
      this.prisma.accountingAccount.findMany({ where: { organizationId: user.organizationId }, orderBy: { code: 'asc' } }),
      this.prisma.accountingVoucherLine.groupBy({
        by: ['accountId'],
        where: { voucher: { organizationId: user.organizationId, status: 'POSTED' } },
        _sum: { debit: true, credit: true },
      }),
    ]);
    const byAccount = new Map(balances.map((balance) => [balance.accountId, balance._sum]));
    const rows = accounts.map((account) => {
      const balance = byAccount.get(account.id);
      return { id: account.id, code: account.code, name: account.name, type: account.type, debit: Number(balance?.debit ?? 0), credit: Number(balance?.credit ?? 0) };
    });
    return { rows, debitTotal: rows.reduce((sum, row) => sum + row.debit, 0), creditTotal: rows.reduce((sum, row) => sum + row.credit, 0) };
  }

  private async getMembershipAccess(user: CurrentAuthUser) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      select: {
        organization: { select: { ownerId: true } },
        roles: { select: { role: {
          select: { key: true, permissions: { select: { permission: { select: { key: true } } } } },
        } } },
      },
    });
    if (!membership) throw new ForbiddenException('عضویت فعال سازمان برای این عملیات لازم است.');
    const keys = new Set(membership.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.key)));
    const isAdministrator = membership.organization.ownerId === user.id || membership.roles.some(({ role }) => ['ADMIN', 'SUPER_ADMIN'].includes(role.key.toUpperCase()));
    const canManage = isAdministrator || keys.has('accounting.write');
    return { isAdministrator, canManage, canView: canManage || keys.has('accounting.read') };
  }

  async getAccess(user: CurrentAuthUser) {
    const access = await this.getMembershipAccess(user);
    return { canView: access.canView, canManage: access.canManage };
  }

  private async requireView(user: CurrentAuthUser) {
    const access = await this.getMembershipAccess(user);
    if (!access.canView) throw new ForbiddenException('مجوز مشاهده حسابداری را ندارید.');
  }

  private async requireManage(user: CurrentAuthUser) {
    const access = await this.getMembershipAccess(user);
    if (!access.canManage) throw new ForbiddenException('مجوز مدیریت حسابداری را ندارید.');
  }

  async getDashboard(user: CurrentAuthUser) {
    await this.requireView(user);
    const now = new Date();

    const [
      totalInvoices,
      pendingReview,
      approved,
      rejected,
      overdue,
      fullyPaidInvoices,
    ] = await Promise.all([
      this.prisma.accountingInvoice.count({
        where: { organizationId: user.organizationId },
      }),
      this.prisma.accountingInvoice.count({
        where: {
          organizationId: user.organizationId,
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
          organizationId: user.organizationId,
          status: AccountingInvoiceStatus.APPROVED,
        },
      }),
      this.prisma.accountingInvoice.count({
        where: {
          organizationId: user.organizationId,
          status: AccountingInvoiceStatus.REJECTED,
        },
      }),
      this.prisma.accountingInvoice.count({
        where: {
          organizationId: user.organizationId,
          dueDate: { lt: now },
          status: {
            notIn: [
              AccountingInvoiceStatus.COMPLETED,
              AccountingInvoiceStatus.CANCELLED,
              AccountingInvoiceStatus.REJECTED,
            ],
          },
        },
      }),
      this.prisma.accountingInvoice.count({
        where: { organizationId: user.organizationId, status: AccountingInvoiceStatus.COMPLETED },
      }),
    ]);

    return {
      totalInvoices,
      pendingReview,
      approved,
      rejected,
      paid: fullyPaidInvoices,
      overdue,
    };
  }

  async getInvoices(
    user: CurrentAuthUser,
    query: InvoiceListQuery,
  ) {
    await this.requireView(user);
    const where: Prisma.AccountingInvoiceWhereInput = {
      organizationId: user.organizationId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.priority) {
      where.priority = query.priority as Prisma.EnumAccountingPriorityFilter;
    }

    if (query.moduleType) {
      where.moduleType = query.moduleType;
    }

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.vendorOnly) {
      where.vendorName = { not: null };
    }

    if (query.search?.trim()) {
      const search = query.search.trim();

      where.OR = [
        { documentNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { vendorName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const invoices = await this.prisma.accountingInvoice.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return invoices.map((invoice) => this.toListItem(invoice));
  }

  async getInvoiceById(
    user: CurrentAuthUser,
    invoiceId: string,
  ) {
    await this.requireView(user);
    const invoice = await this.findInvoiceOrThrow(
      user.organizationId,
      invoiceId,
    );

    return this.toDetail(invoice);
  }

  async createInvoice(
    user: CurrentAuthUser,
    dto: CreateInvoiceDto,
  ) {
    await this.requireManage(user);
    if (!dto.vendorName?.trim()) {
      throw new BadRequestException('نام تأمین‌کننده الزامی است.');
    }
    if (!dto.lineItems?.length) {
      throw new BadRequestException(
        'حداقل یک ردیف برای فاکتور لازم است.',
      );
    }

    await this.ensureBranchAndDepartmentBelongToOrganization(
      user.organizationId,
      dto.branchId,
      dto.departmentId,
    );

    const normalizedItems = dto.lineItems.map((item, index) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const taxRate = Number(item.taxRate ?? 0);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(
          `تعداد ردیف ${index + 1} باید بیشتر از صفر باشد.`,
        );
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new BadRequestException(
          `قیمت واحد ردیف ${index + 1} معتبر نیست.`,
        );
      }

      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
        throw new BadRequestException(
          `نرخ مالیات ردیف ${index + 1} باید بین صفر تا صد باشد.`,
        );
      }

      const total = this.roundMoney(
        quantity * unitPrice * (1 + taxRate / 100),
      );

      return {
        description: item.description.trim(),
        quantity,
        unitPrice,
        taxRate,
        total,
      };
    });

    const totalAmount = this.roundMoney(
      normalizedItems.reduce((sum, item) => sum + item.total, 0),
    );

    if (totalAmount <= 0) {
      throw new BadRequestException(
        'مبلغ نهایی فاکتور باید بیشتر از صفر باشد.',
      );
    }

    const documentNumber = await this.generateDocumentNumber(
      user.organizationId,
    );

    const invoice = await this.prisma.accountingInvoice.create({
      data: {
        organizationId: user.organizationId,
        createdById: user.id,
        branchId: dto.branchId || null,
        departmentId: dto.departmentId || null,
        documentNumber,
        title: dto.title.trim(),
        vendorName: dto.vendorName?.trim() || null,
        description: dto.description?.trim() || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        currency: dto.currency?.trim().toUpperCase() || 'IRR',
        priority: dto.priority ?? 'MEDIUM',
        status: AccountingInvoiceStatus.PENDING_REVIEW,
        totalAmount,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        lineItems: {
          create: normalizedItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            total: item.total,
          })),
        },
        statusHistory: {
          create: {
            actedById: user.id,
            status: AccountingInvoiceStatus.PENDING_REVIEW,
            note: 'فاکتور ایجاد شد و در انتظار بررسی است.',
          },
        },
      },
      include: invoiceInclude,
    });

    return this.toDetail(invoice);
  }

  async updateInvoiceStatus(
    user: CurrentAuthUser,
    invoiceId: string,
    dto: UpdateInvoiceStatusDto,
  ) {
    await this.requireManage(user);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.accountingInvoice.findFirst({
        where: { id: invoiceId, organizationId: user.organizationId },
        include: { payments: true },
      });
      if (!current) {
        throw new NotFoundException('ÙØ§Ú©ØªÙˆØ± Ù…ÙˆØ±Ø¯Ù†Ø¸Ø± ÛŒØ§ÙØª Ù†Ø´Ø¯ ÛŒØ§ Ø¨Ù‡ Ø³Ø§Ø²Ù…Ø§Ù† Ø´Ù…Ø§ ØªØ¹Ù„Ù‚ Ù†Ø¯Ø§Ø±Ø¯.');
      }
      if (current.status === AccountingInvoiceStatus.COMPLETED || current.status === AccountingInvoiceStatus.CANCELLED) {
        throw new ConflictException('ÙˆØ¶Ø¹ÛŒØª Ù†Ù‡Ø§ÛŒÛŒ ÙØ§Ú©ØªÙˆØ± Ù‚Ø§Ø¨Ù„ ØªØºÛŒÛŒØ± Ù†ÛŒØ³Øª.');
      }
      if (dto.status === AccountingInvoiceStatus.COMPLETED) {
        throw new BadRequestException('ØªÚ©Ù…ÛŒÙ„ ÙØ§Ú©ØªÙˆØ± ØªÙ†Ù‡Ø§ Ø¨Ø§ Ø«Ø¨Øª Ù¾Ø±Ø¯Ø§Ø®Øª Ú©Ø§Ù…Ù„ Ù…Ù…Ú©Ù† Ø§Ø³Øª.');
      }
      if (dto.status === current.status) {
        throw new BadRequestException('ÙˆØ¶Ø¹ÛŒØª Ø¬Ø¯ÛŒØ¯ Ø¨Ø§ ÙˆØ¶Ø¹ÛŒØª ÙØ¹Ù„ÛŒ ÛŒÚ©ÛŒ Ù†ÛŒØ³Øª.');
      }

      const invoice = await tx.accountingInvoice.update({
        where: { id: invoiceId },
        data: {
          status: dto.status,
          statusHistory: {
            create: {
              actedById: user.id,
              status: dto.status,
              note: dto.note?.trim() || null,
            },
          },
        },
        include: invoiceInclude,
      });
      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          action: AuditAction.UPDATE,
          entity: 'ACCOUNTING_INVOICE',
          entityId: invoice.id,
          metadata: {
            invoiceNumber: invoice.documentNumber,
            fromStatus: current.status,
            toStatus: dto.status,
          },
        },
      });
      return this.toDetail(invoice);
    }, { isolationLevel: 'Serializable' });
  }

  async registerInvoicePayment(
    user: CurrentAuthUser,
    invoiceId: string,
    dto: RegisterInvoicePaymentDto,
  ) {
    await this.requireManage(user);
    const newPaymentAmount = Number(dto.paidAmount);
    if (!Number.isFinite(newPaymentAmount) || newPaymentAmount <= 0) {
      throw new BadRequestException('مبلغ پرداخت باید بیشتر از صفر باشد.');
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const invoice = await tx.accountingInvoice.findFirst({
            where: { id: invoiceId, organizationId: user.organizationId },
            include: invoiceInclude,
          });
          if (!invoice) throw new NotFoundException('فاکتور موردنظر یافت نشد یا به سازمان شما تعلق ندارد.');

          if (invoice.status === AccountingInvoiceStatus.CANCELLED) {
            throw new BadRequestException('\u0628\u0631\u0627\u06cc \u0641\u0627\u06a9\u062a\u0648\u0631 \u0644\u063a\u0648\u0634\u062f\u0647 \u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646 \u067e\u0631\u062f\u0627\u062e\u062a \u062b\u0628\u062a \u06a9\u0631\u062f.');
          }

          const alreadyPaid = invoice.payments.reduce(
            (sum, payment) => sum + Number(payment.paidAmount),
            0,
          );
          const totalAmount = Number(invoice.totalAmount);
          const remainingAmount = this.roundMoney(totalAmount - alreadyPaid);
          if (newPaymentAmount > remainingAmount) {
            throw new BadRequestException('مبلغ پرداخت نمی‌تواند بیشتر از مانده فاکتور باشد.');
          }

          const isFullyPaid = this.roundMoney(alreadyPaid + newPaymentAmount) >= totalAmount;
          const payment = await tx.accountingInvoicePayment.create({
            data: {
              invoiceId,
              receivedById: user.id,
              paidAmount: newPaymentAmount,
              paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
              method: dto.method ?? 'BANK_TRANSFER',
              referenceNumber: dto.referenceNumber?.trim() || null,
              note: dto.note?.trim() || null,
              metadata: dto.metadata as Prisma.InputJsonValue | undefined,
            },
          });

          if (isFullyPaid && invoice.status !== AccountingInvoiceStatus.COMPLETED) {
            await tx.accountingInvoice.update({
              where: { id: invoiceId },
              data: {
                status: AccountingInvoiceStatus.COMPLETED,
                statusHistory: {
                  create: {
                    actedById: user.id,
                    status: AccountingInvoiceStatus.COMPLETED,
                    note: 'فاکتور به‌طور کامل تسویه شد.',
                  },
                },
              },
            });
          }

          await tx.auditLog.create({
            data: {
              organizationId: user.organizationId,
              userId: user.id,
              action: AuditAction.CREATE,
              entity: 'ACCOUNTING_PAYMENT',
              entityId: payment.id,
              metadata: {
                invoiceNumber: invoice.documentNumber,
                invoiceSettled: isFullyPaid,
              },
            },
          });

          const updatedInvoice = await tx.accountingInvoice.findFirstOrThrow({
            where: { id: invoiceId, organizationId: user.organizationId },
            include: invoiceInclude,
          });
          return this.toDetail(updatedInvoice);
        }, { isolationLevel: 'Serializable' });
      } catch (error) {
        const isSerializationConflict =
          typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
        if (!isSerializationConflict || attempt === 2) throw error;
      }
    }

    throw new ConflictException();
  }
  private async findInvoiceOrThrow(
    organizationId: string,
    invoiceId: string,
  ) {
    const invoice = await this.prisma.accountingInvoice.findFirst({
      where: {
        id: invoiceId,
        organizationId,
      },
      include: invoiceInclude,
    });

    if (!invoice) {
      throw new NotFoundException(
        'فاکتور موردنظر یافت نشد یا به سازمان شما تعلق ندارد.',
      );
    }

    return invoice;
  }

  private async ensureBranchAndDepartmentBelongToOrganization(
    organizationId: string,
    branchId?: string,
    departmentId?: string,
  ) {
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: branchId,
          organizationId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!branch) {
        throw new BadRequestException(
          'شعبه انتخاب‌شده معتبر نیست یا به سازمان شما تعلق ندارد.',
        );
      }
    }

    if (departmentId) {
      const department = await this.prisma.department.findFirst({
        where: {
          id: departmentId,
          organizationId,
          isActive: true,
        },
        select: {
          id: true,
          branchId: true,
        },
      });

      if (!department) {
        throw new BadRequestException(
          'دپارتمان انتخاب‌شده معتبر نیست یا به سازمان شما تعلق ندارد.',
        );
      }

      if (branchId && department.branchId && department.branchId !== branchId) {
        throw new BadRequestException(
          'دپارتمان انتخاب‌شده به شعبه انتخاب‌شده تعلق ندارد.',
        );
      }
    }
  }

  private async generateDocumentNumber(organizationId: string) {
    const datePart = new Date()
      .toISOString()
      .slice(0, 10)
      .replaceAll('-', '');

    const prefix = `INV-${datePart}-`;

    const count = await this.prisma.accountingInvoice.count({
      where: {
        organizationId,
        documentNumber: {
          startsWith: prefix,
        },
      },
    });

    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toListItem(invoice: {
    id: string;
    documentNumber: string;
    title: string;
    description: string | null;
    moduleType: string;
    status: string;
    priority: string;
    totalAmount: Prisma.Decimal;
    currency: string;
    vendorName: string | null;
    dueDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    branch?: { name: string } | null;
    department?: { name: string } | null;
  }) {
    return {
      id: invoice.id,
      documentNumber: invoice.documentNumber,
      title: invoice.title,
      description: invoice.description,
      moduleType: invoice.moduleType,
      status: invoice.status.toLowerCase(),
      priority: invoice.priority,
      totalAmount: Number(invoice.totalAmount),
      currency: invoice.currency,
      vendorName: invoice.vendorName,
      branchName: invoice.branch?.name ?? null,
      departmentName: invoice.department?.name ?? null,
      dueDate: invoice.dueDate?.toISOString() ?? null,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }

  private toDetail(invoice: Prisma.AccountingInvoiceGetPayload<{
    include: typeof invoiceInclude;
  }>) {
    return {
      ...this.toListItem(invoice),

      createdBy: {
        id: invoice.createdBy.id,
        fullName:
          `${invoice.createdBy.firstName} ${invoice.createdBy.lastName}`.trim() ||
          null,
        username: invoice.createdBy.username,
      },

      assignedTo: null,

      lineItems: invoice.lineItems.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
        total: Number(item.total),
      })),

      statusHistory: invoice.statusHistory.map((history) => ({
        id: history.id,
        status: history.status.toLowerCase(),
        note: history.note,
        actedBy: {
          id: history.actedBy.id,
          fullName:
            `${history.actedBy.firstName} ${history.actedBy.lastName}`.trim() ||
            null,
          username: history.actedBy.username,
        },
        createdAt: history.createdAt.toISOString(),
      })),

      payments: invoice.payments.map((payment) => ({
        id: payment.id,
        paidAmount: Number(payment.paidAmount),
        paidAt: payment.paidAt.toISOString(),
        method: payment.method?.toLowerCase() ?? null,
        referenceNumber: payment.referenceNumber,
        note: payment.note,
        createdAt: payment.createdAt.toISOString(),
      })),

      metadata: invoice.metadata,
    };
  }
}
