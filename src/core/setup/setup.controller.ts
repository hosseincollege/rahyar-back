// backend/src/core/setup/setup.controller.ts

import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('setup')
export class SetupController {
  private readonly logger = new Logger(SetupController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('status')
  async getStatus() {
    try {
      const userCount = await this.prisma.user.count();

      return {
        hasUsers: userCount > 0,
        isFirstInstall: userCount === 0,
      };
    } catch (error) {
      this.logger.error('Unable to read initial setup status from the database', error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException('وضعیت ثبت‌نام به‌دلیل خطای اتصال پایگاه داده قابل بررسی نیست.');
    }
  }
}
