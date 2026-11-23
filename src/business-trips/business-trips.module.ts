import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { BusinessTripsController } from './business-trips.controller';
import { BusinessTripsService } from './business-trips.service';

@Module({
  imports: [PrismaModule],
  controllers: [BusinessTripsController],
  providers: [BusinessTripsService],
})
export class BusinessTripsModule {}
