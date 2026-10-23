import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

/**
 * Cross-module reporting endpoints, scoped to the authenticated organization
 * and filtered by the user's existing module permissions.
 */
@Module({
  imports: [PrismaModule],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
