import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../core/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../core/auth/jwt.strategy';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { BusinessTripsService } from './business-trips.service';
import { CreateBusinessTripDto } from './create-business-trip.dto';

@Controller('business-trips')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BusinessTripsController {
  constructor(private readonly businessTripsService: BusinessTripsService) {}

  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.businessTripsService.listMine(user);
  }

  @Post()
  create(
    @Body() dto: CreateBusinessTripDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.businessTripsService.create(dto, user);
  }
}
