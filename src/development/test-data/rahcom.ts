import type { TestDataContext, TestDataSeedResult } from './context';
import { fixtureDate, fixtureUserId } from './context';

const tickets = [
  { subject: 'دسترسی به پنل گزارش‌گیری', description: 'پس از ورود، صفحه گزارش‌گیری برای اعضای تیم مالی باز نمی‌شود. لطفاً دسترسی نقش کاربران بررسی شود.', type: 'SUPPORT' as const, status: 'IN_PROGRESS' as const, priority: 'HIGH' as const, category: 'دسترسی کاربران' },
  { subject: 'خطا هنگام ثبت درخواست خرید', description: 'در زمان ثبت درخواست خرید، پیام خطای اعتبارسنجی نمایش داده می‌شود؛ اطلاعات فرم و زمان رخداد پیوست شده است.', type: 'INCIDENT' as const, status: 'OPEN' as const, priority: 'URGENT' as const, category: 'خرید و تدارکات' },
  { subject: 'افزودن فیلد شماره پیگیری', description: 'لطفاً امکان ثبت شماره پیگیری برای درخواست‌های ارسال‌شده به واحد پشتیبانی اضافه شود.', type: 'REQUEST' as const, status: 'WAITING_FOR_CUSTOMER' as const, priority: 'MEDIUM' as const, category: 'بهبود سامانه' },
  { subject: 'تأخیر در بارگذاری فهرست کاربران', description: 'بارگذاری فهرست کاربران در ساعات پرترافیک بیشتر از حد معمول طول می‌کشد. لطفاً زمان پاسخ بررسی شود.', type: 'SUPPORT' as const, status: 'RESOLVED' as const, priority: 'LOW' as const, category: 'عملکرد سامانه' },
] as const;

export async function seedRahcom(ctx: TestDataContext): Promise<TestDataSeedResult> {
  const maxTicket = await ctx.db.ticket.aggregate({ where: { organizationId: ctx.organizationId }, _max: { ticketNumber: true } });
  let nextNumber = (maxTicket._max.ticketNumber ?? 0) + 1;
  for (let index = 0; index < tickets.length; index += 1) {
    const item = tickets[index];
    const exists = await ctx.db.ticket.findFirst({ where: { organizationId: ctx.organizationId, subject: item.subject }, select: { id: true } });
    if (exists) continue;
    await ctx.db.ticket.create({
      data: {
        organizationId: ctx.organizationId,
        creatorId: fixtureUserId(ctx, index),
        assigneeId: fixtureUserId(ctx, index + 1),
        ticketNumber: nextNumber++,
        ...item,
        visibility: 'INTERNAL',
        dueAt: fixtureDate(ctx.now, index - 4),
        createdAt: fixtureDate(ctx.now, index + 2),
        ...(item.status === 'RESOLVED' ? { resolvedAt: fixtureDate(ctx.now, 1) } : {}),
      },
    });
  }
  return { recordCounts: { tickets: tickets.length } };
}



