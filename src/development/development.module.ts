import { Module } from '@nestjs/common';
import { AuthModule } from '../core/auth/auth.module';
import { PrismaModule } from '../core/prisma/prisma.module';
import { DevelopmentController } from './development.controller';
import { DevelopmentService } from './development.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [DevelopmentController],
  providers: [DevelopmentService],
})
export class DevelopmentModule {}
