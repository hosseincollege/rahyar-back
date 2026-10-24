// backend/src/settings/settings.controller.ts

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';

import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { CurrentUser } from '../core/auth/decorators/current-user.decorator';
import { Public } from '../core/auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../core/auth/strategies/jwt.strategy';

import { SettingsService } from './settings.service';

import { CreateOrganizationDto } from './company/dto/create-organization.dto';
import { UpdateOrganizationSettingsDto } from './company/dto/update-organization-settings.dto';
import { UpdateOrganizationAppearanceDto } from './company/dto/update-organization-appearance.dto';

import { CreateBranchDto } from './organization/dto/create-branch.dto';
import { UpdateBranchDto } from './organization/dto/update-branch.dto';

import { CreateDepartmentDto } from './organization/dto/create-department.dto';
import { UpdateDepartmentDto } from './organization/dto/update-department.dto';

import { ImportOrganizationDto } from './company/dto/import-organization.dto';
import { SaveRoleDto } from './roles/dto/save-role.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('public-branding')
  @Header('Cache-Control', 'no-store, max-age=0')
  async getPublicBranding(@Query('organizationId') organizationId?: string) {
    return this.settingsService.getPublicBranding(organizationId);
  }

  /**
   * دریافت آمار بازدیدکنندگان عمومی (بدون نیاز به احراز هویت)
   */
  @Public()
  @Get('public-stats')
  @Header('Cache-Control', 'no-store, max-age=0')
  async getPublicStats() {
    return this.settingsService.getPublicStats();
  }

  /**
   * ثبت یک بازدید جدید بر اساس IP (عمومی)
   */
  @Public()
  @Post('public-track')
  async trackPublicVisit(@Req() req: Request) {
    const forwarded = req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0] : null) ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const userAgent = (req.headers['user-agent'] as string) || undefined;
    return this.settingsService.trackVisit(ip.trim(), userAgent);
  }

  @Public()
  @Post('public-presence')
  async trackPublicPresence(
    @Body() body: { visitorId?: string; sessionId?: string; pageViewId?: string; path?: string; event?: 'ENTER' | 'HEARTBEAT' | 'EXIT' },
    @Req() req: Request,
  ) {
    if (!body.visitorId) {
      throw new BadRequestException('شناسه بازدیدکننده الزامی است.');
    }
    if (body.path && (!body.path.startsWith('/') || body.path.length > 500)) throw new BadRequestException('مسیر صفحه معتبر نیست.');
    if (body.event && !['ENTER', 'HEARTBEAT', 'EXIT'].includes(body.event)) throw new BadRequestException('نوع رویداد معتبر نیست.');
    const forwarded = req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0] : null) || req.socket.remoteAddress || 'unknown';
    return this.settingsService.trackVisitorPresence(
      body.visitorId,
      (req.headers['user-agent'] as string) || undefined,
      ip.trim(),
      body,
    );
  }

  @Post('organization')
  async createOrganization(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: any,
  ) {
    return this.settingsService.createOrganization(dto, user);
  }

  @Get('organization/:id')
  async getOrganization(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('شناسه سازمان نامعتبر است.');
    }
    return this.settingsService.getOrganization(id.trim(), user);
  }

  @Get('organization/:id/access')
  async getOrganizationAccess(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('شناسه سازمان نامعتبر است.');
    }
    return this.settingsService.getOrganizationAccess(id.trim(), user);
  }

  @Get('organization/:id/appearance')
  async getOrganizationAppearance(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('شناسه سازمان نامعتبر است.');
    }
    return this.settingsService.getOrganizationAppearance(id.trim(), user);
  }

  @Put('organization/:id/appearance')
  async updateOrganizationAppearance(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationAppearanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('شناسه سازمان نامعتبر است.');
    }
    return this.settingsService.updateOrganizationAppearance(
      id.trim(),
      dto,
      user,
    );
  }

  @Get('organization/:id/branding')
  async getOrganizationBranding(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('شناسه سازمان نامعتبر است.');
    }
    return this.settingsService.getOrganizationBranding(id.trim(), user);
  }

  @Put('organization/:id')
  async updateOrganization(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('شناسه سازمان نامعتبر است.');
    }
    return this.settingsService.updateOrganizationSettings(
      id.trim(),
      dto,
      user,
    );
  }

  @Post('organization/:id/logo')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async uploadOrganizationLogo(
    @Param('id') id: string,
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('شناسه سازمان نامعتبر است.');
    }
    if (!file) {
      throw new BadRequestException('فایل لوگو انتخاب نشده است.');
    }

    return this.settingsService.uploadOrganizationLogo(id.trim(), file, user);
  }

  @Post('organization/import')
  async importOrganizationGeneral(
    @Body() dto: ImportOrganizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const organizationId = user.organizationId ?? undefined;

    if (!organizationId || organizationId.trim() === '') {
      throw new BadRequestException(
        'شناسه سازمان معتبری برای کاربر یافت نشد. لطفاً ابتدا سازمان را ایجاد کنید یا وارد یک سازمان فعال شوید.',
      );
    }

    return this.settingsService.importOrganizationData(
      organizationId.trim(),
      dto,
      user,
    );
  }

  @Get('roles/:organizationId')
  async getRoles(@Param('organizationId') organizationId: string) {
    if (!organizationId || organizationId.trim() === '') {
      throw new BadRequestException('شناسه سازمان نامعتبر است.');
    }

    return this.settingsService.getRoles(organizationId.trim());
  }

  @Put('roles/:organizationId')
  async saveRoles(
    @Param('organizationId') organizationId: string,
    @Body() roles: SaveRoleDto[],
  ) {
    if (!organizationId || organizationId.trim() === '') {
      throw new BadRequestException('شناسه سازمان نامعتبر است.');
    }

    const payload = Array.isArray(roles) ? roles : (roles as any)?.roles || [];
    return this.settingsService.saveRoles(organizationId.trim(), payload);
  }

  @Get('branches/:organizationId')
  async getBranches(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!organizationId || organizationId.trim() === '') {
      throw new BadRequestException('شناسه سازمان نامعتبر است.');
    }

    return this.settingsService.getBranches(organizationId.trim(), user);
  }

  @Post('branches')
  async createBranch(
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!dto.organizationId || dto.organizationId.trim() === '') {
      throw new BadRequestException('شناسه سازمان برای ایجاد شعبه الزامی است.');
    }

    return this.settingsService.createBranch(dto, user);
  }

  @Put('branches/:id')
  async updateBranch(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('شناسه شعبه نامعتبر است.');
    }

    return this.settingsService.updateBranch(id.trim(), dto, user);
  }

  @Delete('branches/:id')
  async deleteBranch(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('شناسه شعبه نامعتبر است.');
    }

    return this.settingsService.deleteBranch(id.trim(), user);
  }

  @Get('departments/:organizationId')
  async getDepartments(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!organizationId || organizationId.trim() === '') {
      throw new BadRequestException('شناسه سازمان نامعتبر است.');
    }

    return this.settingsService.getDepartments(organizationId.trim(), user);
  }

  @Post('departments')
  async createDepartment(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!dto.organizationId || dto.organizationId.trim() === '') {
      throw new BadRequestException(
        'شناسه سازمان برای ایجاد دپارتمان الزامی است.',
      );
    }

    return this.settingsService.createDepartment(dto, user);
  }

  @Put('departments/:id')
  async updateDepartment(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('شناسه دپارتمان نامعتبر است.');
    }

    return this.settingsService.updateDepartment(id.trim(), dto, user);
  }

  @Delete('departments/:id')
  async deleteDepartment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('شناسه دپارتمان نامعتبر است.');
    }

    return this.settingsService.deleteDepartment(id.trim(), user);
  }

  @Get('users/:organizationId')
  async getUsers(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!organizationId || organizationId.trim() === '') {
      throw new BadRequestException('شناسه سازمان نامعتبر است.');
    }

    return this.settingsService.getUsers(organizationId.trim(), user);
  }

  /**
   * ذخیره و درون‌ریزی کاربران سازمان
   */
  @Put('users/:organizationId')
  async saveUsers(
    @Param('organizationId') organizationId: string,
    @Body() usersPayload: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!organizationId || organizationId.trim() === '') {
      throw new BadRequestException('شناسه سازمان نامعتبر است.');
    }

    // استخراج ایمن لیست کاربران چه به صورت آرایه مستقیم و چه آبجکت
    let usersList: any[] = [];
    if (Array.isArray(usersPayload)) {
      usersList = usersPayload;
    } else if (usersPayload && Array.isArray(usersPayload.users)) {
      usersList = usersPayload.users;
    } else if (usersPayload && Array.isArray(usersPayload.data)) {
      usersList = usersPayload.data;
    }

    return this.settingsService.saveUsers(
      organizationId.trim(),
      usersList,
      user,
    );
  }

}
