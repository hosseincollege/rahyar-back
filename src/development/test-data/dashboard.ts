import type { TestDataContext, TestDataCounts } from './context';
import { fixtureDate, fixtureUserId } from './context';

const announcements = [
  { title: 'برنامه نگهداری سامانه', summary: 'به‌روزرسانی زیرساخت در ساعات کم‌ترافیک انجام می‌شود.', body: 'برای حفظ پایداری خدمات، عملیات نگهداری سامانه پنجشنبه از ساعت ۲۲ تا ۲۳ انجام می‌شود. لطفاً کارهای جاری را پیش از این زمان ذخیره کنید.', category: 'operations', priority: 'high' },
  { title: 'جلسه هماهنگی تیم‌ها', summary: 'مرور درخواست‌های باز و برنامه هفته آینده.', body: 'جلسه هماهنگی تیم‌ها روز یکشنبه ساعت ۹ برگزار می‌شود. مسئولان هر تیم، وضعیت درخواست‌های باز را همراه داشته باشند.', category: 'general', priority: 'normal' },
  { title: 'یادآوری تکمیل اطلاعات سازمان', summary: 'اطلاعات تماس و ساختار تیم‌ها را بررسی کنید.', body: 'لطفاً شماره تماس، نشانی و اعضای تیم خود را در بخش تنظیمات بازبینی و اطلاعات ناقص را تکمیل کنید.', category: 'general', priority: 'normal' },
] as const;

export async function seedDashboard(ctx: TestDataContext): Promise<TestDataCounts> {
  for (let index = 0; index < announcements.length; index += 1) {
    const item = announcements[index];
    const exists = await ctx.db.announcement.findFirst({ where: { organizationId: ctx.organizationId, title: item.title }, select: { id: true } });
    if (exists) continue;
    await ctx.db.announcement.create({
      data: {
        organizationId: ctx.organizationId,
        createdByUserId: fixtureUserId(ctx, index),
        ...item,
        locale: 'fa',
        isActive: true,
        isPinned: index === 0,
        allowLikes: true,
        allowReactions: true,
        allowComments: true,
        allowMentions: true,
        createdAt: fixtureDate(ctx.now, index + 1),
      },
    });
  }

  const entities = ['Announcement', 'Organization', 'Department'];
  for (let index = 0; index < entities.length; index += 1) {
    await ctx.db.auditLog.upsert({
      where: { id: `test-dashboard-activity-${index + 1}` },
      create: {
        id: `test-dashboard-activity-${index + 1}`,
        organizationId: ctx.organizationId,
        userId: fixtureUserId(ctx, index),
        action: 'CREATE',
        entity: entities[index],
        metadata: { source: 'development-test-data' },
        createdAt: fixtureDate(ctx.now, index + 1),
      },
      update: {},
    });
  }

  return { announcements: announcements.length, activities: entities.length };
}
