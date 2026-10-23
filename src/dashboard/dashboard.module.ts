import { Module } from '@nestjs/common';
import { NotificationsModule } from './events/notifications.module';
import { SystemModule } from './system/system.module';

@Module({
  imports: [SystemModule, NotificationsModule],
  exports: [SystemModule, NotificationsModule],
})
export class DashboardModule {}
