// Path: backend/src/core/app.module.ts
// این فایل ماژول‌های اصلی برنامه NestJS را ثبت می‌کند.

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DevelopmentModule } from '../development/development.module';
import { PrismaModule } from './prisma/prisma.module';
import { SetupModule } from './setup/setup.module';
import { SettingsModule } from '../settings/settings.module';
import { RahcomModule } from '../rahcom/rahcom.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,
    AuthModule,
    SetupModule,
    SettingsModule,
    DevelopmentModule,
    RahcomModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
