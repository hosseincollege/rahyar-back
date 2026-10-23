import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [PrismaModule, ProjectsModule],
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
