import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../core/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../core/auth/strategies/jwt.strategy';
import { StatisticsService } from './statistics.service';

@Controller(['statistics', 'reports'])
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('overview')
  getOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('period') period?: string,
  ) {
    return this.statisticsService.getOverview(user, period);
  }
}
