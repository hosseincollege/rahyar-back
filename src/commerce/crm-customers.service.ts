import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeadStatus } from '@prisma/client';

import { PrismaService } from '../core/prisma/prisma.service';
import {
  CreateAccountDto,
  CreateContactDto,
  CreateLeadDto,
  DisqualifyLeadDto,
  UpdateAccountDto,
  UpdateContactDto,
  UpdateLeadStatusDto,
} from './dto/crm.dto';

@Injectable()
export class CrmCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async createAccount(
    organizationId: string,
    ownerId: string,
    dto: CreateAccountDto,
  ) {
    return this.prisma.account.create({
      data: { ...dto, organizationId, ownerId },
    });
  }

  async findAllAccounts(organizationId: string) {
    return this.prisma.account.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { contacts: true, opportunities: true, cases: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAccountById(organizationId: string, id: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, organizationId },
      include: {
        contacts: true,
        opportunities: true,
        cases: true,
        activities: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!account) {
      throw new NotFoundException('شرکت یا مشتری پیدا نشد.');
    }
    return account;
  }

  async updateAccount(
    organizationId: string,
    id: string,
    dto: UpdateAccountDto,
  ) {
    await this.findAccountById(organizationId, id);
    return this.prisma.account.update({ where: { id }, data: dto });
  }

  async createContact(
    organizationId: string,
    ownerId: string,
    dto: CreateContactDto,
  ) {
    await this.assertAccountInOrganization(organizationId, dto.accountId);
    return this.prisma.contact.create({
      data: { ...dto, organizationId, ownerId },
    });
  }

  async findAllContacts(organizationId: string, accountId?: string) {
    if (accountId) {
      await this.findAccountById(organizationId, accountId);
    }

    return this.prisma.contact.findMany({
      where: { organizationId, ...(accountId ? { accountId } : {}) },
      include: { account: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findContactById(organizationId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, organizationId },
      include: {
        account: true,
        opportunities: true,
        cases: true,
      },
    });

    if (!contact) {
      throw new NotFoundException('مخاطب پیدا نشد.');
    }
    return contact;
  }

  async updateContact(
    organizationId: string,
    id: string,
    dto: UpdateContactDto,
  ) {
    await this.findContactById(organizationId, id);
    await this.assertAccountInOrganization(organizationId, dto.accountId);
    return this.prisma.contact.update({ where: { id }, data: dto });
  }

  async createLead(
    organizationId: string,
    ownerId: string,
    dto: CreateLeadDto,
  ) {
    return this.prisma.lead.create({
      data: { ...dto, organizationId, ownerId },
    });
  }

  async findAllLeads(organizationId: string, status?: LeadStatus) {
    return this.prisma.lead.findMany({
      where: { organizationId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLeadById(organizationId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId },
      include: { activities: { orderBy: { createdAt: 'desc' } } },
    });

    if (!lead) {
      throw new NotFoundException('سرنخ پیدا نشد.');
    }
    return lead;
  }

  async updateLeadStatus(
    organizationId: string,
    id: string,
    dto: UpdateLeadStatusDto,
  ) {
    const lead = await this.findLeadById(organizationId, id);
    const allowed =
      lead.status === LeadStatus.NEW && dto.status === LeadStatus.CONTACTED;

    if (!allowed && lead.status !== dto.status) {
      throw new BadRequestException(
        'تغییر وضعیت این سرنخ از مسیر مجاز امکان‌پذیر نیست.',
      );
    }

    return this.prisma.lead.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async qualifyLead(organizationId: string, ownerId: string, leadId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Claim the lead inside the transaction so parallel requests cannot
      // create duplicate accounts, contacts, and opportunities.
      const claimed = await tx.lead.updateMany({
        where: {
          id: leadId,
          organizationId,
          status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED] },
        },
        data: { status: LeadStatus.QUALIFIED },
      });

      if (claimed.count !== 1) {
        const exists = await tx.lead.findFirst({
          where: { id: leadId, organizationId },
          select: { id: true },
        });
        if (!exists) {
          throw new NotFoundException('سرنخ پیدا نشد.');
        }
        throw new BadRequestException(
          'فقط سرنخ جدید یا تماس‌گرفته‌شده قابل تبدیل است.',
        );
      }

      const lead = await tx.lead.findFirstOrThrow({
        where: { id: leadId, organizationId },
      });

      let accountId: string | null = null;
      if (lead.companyName?.trim()) {
        const account = await tx.account.create({
          data: {
            name: lead.companyName.trim(),
            phone: lead.phone,
            email: lead.email,
            organizationId,
            ownerId,
          },
        });
        accountId = account.id;
      }

      const contact = await tx.contact.create({
        data: {
          firstName: lead.firstName?.trim() ?? '',
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          jobTitle: lead.jobTitle,
          accountId,
          organizationId,
          ownerId,
        },
      });

      const opportunity = await tx.opportunity.create({
        data: {
          name: lead.topic,
          estimatedRevenue: lead.estimatedRevenue,
          accountId,
          contactId: contact.id,
          organizationId,
          ownerId,
        },
      });

      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          convertedAccountId: accountId,
          convertedContactId: contact.id,
          convertedOppId: opportunity.id,
        },
      });

      return {
        lead: updatedLead,
        account: accountId ? { id: accountId, name: lead.companyName } : null,
        contact: {
          id: contact.id,
          name: `${contact.firstName} ${contact.lastName}`.trim(),
        },
        opportunity: { id: opportunity.id, name: opportunity.name },
      };
    });
  }

  async disqualifyLead(
    organizationId: string,
    leadId: string,
    dto: DisqualifyLeadDto,
  ) {
    const changed = await this.prisma.lead.updateMany({
      where: {
        id: leadId,
        organizationId,
        status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED] },
      },
      data: {
        status: LeadStatus.DISQUALIFIED,
        disqualifyReason: dto.reason,
        disqualifyNotes: dto.notes,
      },
    });

    if (changed.count !== 1) {
      const exists = await this.prisma.lead.findFirst({
        where: { id: leadId, organizationId },
        select: { id: true },
      });
      if (!exists) {
        throw new NotFoundException('سرنخ پیدا نشد.');
      }
      throw new BadRequestException(
        'فقط سرنخ جدید یا تماس‌گرفته‌شده قابل رد کردن است.',
      );
    }

    return this.findLeadById(organizationId, leadId);
  }

  async findAllOpportunities(organizationId: string) {
    return this.prisma.opportunity.findMany({
      where: { organizationId },
      include: {
        account: { select: { id: true, name: true } },
        contact: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertAccountInOrganization(
    organizationId: string,
    accountId?: string,
  ) {
    if (!accountId) {
      return;
    }

    const account = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId },
      select: { id: true },
    });

    if (!account) {
      throw new BadRequestException(
        'حساب انتخاب‌شده در این سازمان وجود ندارد.',
      );
    }
  }
}
