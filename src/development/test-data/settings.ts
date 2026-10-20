import type { TestDataContext, TestDataCounts } from './context';
import { fixtureUserId } from './context';

const branches = [
  ['TEST-CENTRAL', 'شعبه مرکزی تهران', 'تهران، خیابان ولیعصر، پلاک ۲۴۰'],
  ['TEST-NORTH', 'شعبه کرج', 'کرج، بلوار شهید بهشتی، پلاک ۸۵'],
  ['TEST-SOUTH', 'شعبه اصفهان', 'اصفهان، خیابان چهارباغ بالا، پلاک ۱۲۰'],
] as const;
const departments = [
  ['TEST-OPS', 'عملیات و پشتیبانی', 0],
  ['TEST-SALES', 'فروش سازمانی', 1],
  ['TEST-FIN', 'مالی و حسابداری', 0],
  ['TEST-HR', 'منابع انسانی', 0],
  ['TEST-SUPPORT', 'خدمات مشتریان', 2],
] as const;

export async function seedSettings(ctx: TestDataContext): Promise<TestDataCounts> {
  await ctx.db.organizationSettings.upsert({
    where: { organizationId: ctx.organizationId },
    create: {
      organizationId: ctx.organizationId,
      accentPreset: 'blue',
      accentLightColor: '#60a5fa',
      accentDarkColor: '#3b82f6',
      backgroundStyle: 'GRAY',
      calendar: 'persian',
      timezone: 'Asia/Tehran',
    },
    update: {},
  });

  const savedBranches = [] as Array<{ id: string }>;
  for (const [code, name, address] of branches) {
    const legacyBranch = code === 'TEST-CENTRAL'
      ? { name: 'شعبهٔ آزمایشی مرکزی', address: 'تهران، خیابان نمونه' }
      : code === 'TEST-NORTH'
        ? { name: 'شعبهٔ آزمایشی شمال', address: 'تهران، منطقهٔ شمال' }
        : { name: 'شعبهٔ آزمایشی جنوب', address: 'تهران، منطقهٔ جنوب' };
    const branch = await ctx.db.branch.upsert({
      where: { organizationId_code: { organizationId: ctx.organizationId, code } },
      create: { organizationId: ctx.organizationId, code, name, address, isMain: code === 'TEST-CENTRAL' },
      update: {},
      select: { id: true, name: true, address: true },
    });
    if (branch.name === legacyBranch.name && branch.address === legacyBranch.address) {
      await ctx.db.branch.update({ where: { id: branch.id }, data: { name, address } });
    }
    savedBranches.push(branch);
  }
  for (const [code, name, branchIndex] of departments) {
    const legacyName = ({ 'TEST-OPS': 'واحد عملیات آزمایشی', 'TEST-SALES': 'واحد فروش آزمایشی', 'TEST-FIN': 'واحد مالی آزمایشی', 'TEST-HR': 'واحد منابع انسانی آزمایشی', 'TEST-SUPPORT': 'واحد پشتیبانی آزمایشی' } as Record<string, string>)[code];
    const department = await ctx.db.department.upsert({
      where: { organizationId_code: { organizationId: ctx.organizationId, code } },
      create: { organizationId: ctx.organizationId, branchId: savedBranches[branchIndex].id, code, name },
      update: {},
      select: { id: true, name: true },
    });
    if (department.name === legacyName) await ctx.db.department.update({ where: { id: department.id }, data: { name } });
  }

  const announcements = [
    ['برنامه نگهداری سامانه در پنجشنبه شب', 'به‌روزرسانی زیرساخت از ساعت ۲۲ تا ۲۳ انجام می‌شود؛ لطفاً عملیات مالی را پیش از این زمان ثبت کنید.'],
    ['دوره آموزشی سامانه فروش', 'کارگاه کار با فرایند ثبت سفارش و پیگیری مشتریان روز دوشنبه ساعت ۱۰ در شعبه کرج برگزار می‌شود.'],
    ['مهلت ارسال اسناد پایان دوره مالی', 'واحدهای مالی تا پایان روز ۲۵ اسفند اسناد هزینه و درآمد را برای بررسی نهایی ارسال کنند.'],
  ] as const;
  for (let index = 0; index < announcements.length; index += 1) {
    const [title, body] = announcements[index];
    const legacyTitles = ['اطلاعیهٔ آزمایشی: نگهداری سامانه', 'اطلاعیهٔ آزمایشی: برنامهٔ آموزش', 'اطلاعیهٔ آزمایشی: پایان دورهٔ مالی'];
    let existing = await ctx.db.announcement.findFirst({ where: { organizationId: ctx.organizationId, title }, select: { id: true } });
    if (!existing) {
      const legacy = await ctx.db.announcement.findFirst({ where: { organizationId: ctx.organizationId, title: legacyTitles[index] }, select: { id: true, summary: true, body: true } });
      if (legacy) existing = await ctx.db.announcement.update({ where: { id: legacy.id }, data: {
        title,
        ...(legacy.summary === 'اطلاعیهٔ ساختگی برای آزمایش محیط توسعه' ? { summary: 'اطلاع‌رسانی سازمانی درباره برنامه‌های جاری شرکت' } : {}),
        ...([{ body: 'نمونهٔ اطلاعیهٔ فعال و سنجش نمایش اعلان‌ها.' }, { body: 'نمونهٔ اطلاعیه برای آزمون متن و دسته‌بندی.' }, { body: 'یادآوری نمونه برای آزمون اطلاعیه‌های مهم.' }][index].body === legacy.body ? { body } : {}),
      }, select: { id: true } });
    }
    if (!existing) await ctx.db.announcement.create({ data: {
      organizationId: ctx.organizationId,
      createdByUserId: fixtureUserId(ctx, index),
      title,
      summary: 'اطلاع‌رسانی سازمانی درباره برنامه‌های جاری شرکت',
      body,
      locale: 'fa',
      category: ['general', 'training', 'finance'][index],
      priority: index === 2 ? 'high' : 'normal',
      isPinned: index === 0,
      isActive: true,
      allowLikes: true,
      allowReactions: true,
      allowComments: true,
      allowMentions: true,
      branchId: index === 1 ? savedBranches[1].id : null,
    } });
  }
  return { organizationSettings: 1, branches: branches.length, departments: departments.length, announcements: announcements.length };
}
