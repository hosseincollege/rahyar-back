// backend/src/core/setup/setup.controller.ts

import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('setup')
export class SetupController {
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
      console.error('[setup.status] database error', error);

      return {
        hasUsers: true,
        isFirstInstall: false,
      };
    }
  }
}
