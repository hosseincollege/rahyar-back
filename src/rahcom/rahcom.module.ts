import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { RahcomController } from './rahcom.controller';
import { RahcomService } from './rahcom.service';

@Module({ imports: [PrismaModule], controllers: [RahcomController], providers: [RahcomService] })
export class RahcomModule {}
