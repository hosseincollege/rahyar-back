import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LeadStatus } from '@prisma/client';

import { CurrentUser } from '../core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../core/auth/strategies/jwt.strategy';
import {
  CreateAccountDto,
  CreateContactDto,
  CreateLeadDto,
  DisqualifyLeadDto,
  UpdateAccountDto,
  UpdateContactDto,
  UpdateLeadStatusDto,
} from './dto/crm.dto';
import { CrmCustomersService } from './crm-customers.service';

@Controller('crm')
@UseGuards(JwtAuthGuard)
export class CrmController {
  constructor(private readonly crm: CrmCustomersService) {}

  @Get('accounts')
  findAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.crm.findAllAccounts(this.organizationId(user));
  }

  @Post('accounts')
  createAccount(
    @Body() dto: CreateAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crm.createAccount(this.organizationId(user), user.id, dto);
  }

  @Get('accounts/:id')
  findAccount(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.crm.findAccountById(this.organizationId(user), id);
  }

  @Patch('accounts/:id')
  updateAccount(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crm.updateAccount(this.organizationId(user), id, dto);
  }

  @Get('contacts')
  findContacts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('accountId') accountId?: string,
  ) {
    return this.crm.findAllContacts(this.organizationId(user), accountId);
  }

  @Post('contacts')
  createContact(
    @Body() dto: CreateContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crm.createContact(this.organizationId(user), user.id, dto);
  }

  @Get('contacts/:id')
  findContact(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.crm.findContactById(this.organizationId(user), id);
  }

  @Patch('contacts/:id')
  updateContact(
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crm.updateContact(this.organizationId(user), id, dto);
  }

  @Get('leads')
  findLeads(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status', new ParseEnumPipe(LeadStatus, { optional: true }))
    status?: LeadStatus,
  ) {
    return this.crm.findAllLeads(this.organizationId(user), status);
  }

  @Post('leads')
  createLead(
    @Body() dto: CreateLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crm.createLead(this.organizationId(user), user.id, dto);
  }

  @Get('leads/:id')
  findLead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.crm.findLeadById(this.organizationId(user), id);
  }

  @Patch('leads/:id/status')
  updateLeadStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLeadStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crm.updateLeadStatus(this.organizationId(user), id, dto);
  }

  @Post('leads/:id/qualify')
  qualifyLead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.crm.qualifyLead(this.organizationId(user), user.id, id);
  }

  @Post('leads/:id/disqualify')
  disqualifyLead(
    @Param('id') id: string,
    @Body() dto: DisqualifyLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crm.disqualifyLead(this.organizationId(user), id, dto);
  }

  @Get('opportunities')
  findOpportunities(@CurrentUser() user: AuthenticatedUser) {
    return this.crm.findAllOpportunities(this.organizationId(user));
  }

  private organizationId(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException(
        'برای استفاده از CRM ابتدا باید کاربر عضو یک سازمان فعال باشد.',
      );
    }
    return user.organizationId;
  }
}
