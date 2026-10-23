import { Module } from '@nestjs/common';

import { PrismaModule } from '../core/prisma/prisma.module';
import { CrmController } from './crm.controller';
import { CrmCustomersService } from './crm-customers.service';
import { InventoryModule } from './inventory/inventory.module';

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [CrmController],
  providers: [CrmCustomersService],
})
export class CommerceModule {}
