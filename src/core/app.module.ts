// Path: backend/src/core/app.module.ts
// این فایل ماژول‌های اصلی برنامه NestJS را ثبت می‌کند.

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AccountingModule } from '../accounting/accounting.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommerceModule } from '../commerce/commerce.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { DevelopmentModule } from '../development/development.module';
import { HumanResourcesModule } from '../human-resources/human-resources.module';
import { PrismaModule } from './prisma/prisma.module';
import { SetupModule } from './setup/setup.module';
import { StatisticsModule } from '../statistics/statistics.module';
import { SettingsModule } from '../settings/settings.module';
import { SupportModule } from '../support/support.module';
import { RahcomModule } from '../rahcom/rahcom.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,
    AuthModule,
    SetupModule,
    AccountingModule,
    CommerceModule,
    HumanResourcesModule,
    StatisticsModule,
    SettingsModule,
    SupportModule,
    DashboardModule,
    DevelopmentModule,
    RahcomModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
