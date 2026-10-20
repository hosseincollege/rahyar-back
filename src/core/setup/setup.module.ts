/**
 * @file src/core/setup/setup.module.ts
 * @type backend
 * @description ماژول بررسی وضعیت نصب اولیه و راه‌اندازی سیستم ERP Pro
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SetupController } from './setup.controller';

@Module({
  /**
   * PrismaModule برای دسترسی به PrismaService
   * در SetupController استفاده می‌شود.
   */
  imports: [PrismaModule],

  /**
   * کنترلر endpointهای مربوط به setup
   */
  controllers: [SetupController],
})
export class SetupModule {}
