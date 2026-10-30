import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import type { AuthenticatedUser } from '../core/auth/strategies/jwt.strategy';
import { SystemService } from './system.service';

@Controller('system')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('status')
  getStatus() {
    return this.systemService.getStatus();
  }

  @Get('activity')
  getActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    return this.systemService.getRecentActivity(user, limit ? Number(limit) : 5);
  }
}
