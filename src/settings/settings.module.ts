// Path: backend/src/settings/settings.module.ts
// این ماژول ارائه‌دهنده‌ها، کنترلر و وابستگی‌های مربوط به تنظیمات عمومی سیستم را پیکربندی می‌کند.

import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { OrganizationLogoStorageService } from './company/organization-logo-storage.service';
import { DepartmentStructureController } from './organization/department-structure.controller';
import { DepartmentStructureService } from './organization/department-structure.service';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController, DepartmentStructureController],
  providers: [
    SettingsService,
    OrganizationLogoStorageService,
    DepartmentStructureService,
  ],
  exports: [SettingsService],
})
export class SettingsModule {}
