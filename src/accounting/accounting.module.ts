/**
 * مسیر فایل:
 * backend/src/accounting/accounting.module.ts
 *
 * هدف:
 * ثبت controller و service ماژول حسابداری.
 */

import { Module } from '@nestjs/common';

import { PrismaModule } from '../core/prisma/prisma.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';

@Module({
  imports: [PrismaModule],
  controllers: [AccountingController],
  providers: [AccountingService],
  exports: [AccountingService],
})
export class AccountingModule {}
