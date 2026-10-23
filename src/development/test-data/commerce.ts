import type { TestDataContext, TestDataCounts } from './context';
import { fixtureDate, fixtureUserId } from './context';

const accountFixtures = [
  ['بازرگانی نمونهٔ البرز', 'شرکت پخش البرز'],
  ['فناوران آزمایشی سپهر', 'فناوران سپهر'],
  ['توزیع کالای باران', 'بازرگانی باران'],
  ['سازمان داده‌گستر', 'گروه صنعتی آریا'],
  ['فروشگاه نمونهٔ شرق', 'فروشگاه زنجیره‌ای شرق'],
  ['تجهیزات صنعتی آزما', 'تجهیزات صنعتی پارس'],
  ['پخش بهارستان', 'پخش بهارستان'],
  ['راهکارهای نمونهٔ فردا', 'راهکارهای دیجیتال فردا'],
] as const;
const accountNames = accountFixtures.map(([, name]) => name);
const leadStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED', 'NEW', 'CONTACTED', 'QUALIFIED', 'NEW', 'DISQUALIFIED', 'CONTACTED', 'NEW', 'QUALIFIED', 'NEW', 'CONTACTED', 'NEW', 'DISQUALIFIED', 'QUALIFIED', 'NEW', 'CONTACTED', 'NEW'] as const;
const contactFixtures = [
  ['آرمان', 'احمدی', 'مدیر خرید'], ['نگار', 'رضایی', 'مدیر فروش'], ['کیان', 'کریمی', 'مدیر مالی'], ['رها', 'موسوی', 'کارشناس قراردادها'], ['پارسا', 'جعفری', 'مدیر تدارکات'],
  ['سارا', 'حسینی', 'کارشناس فروش سازمانی'], ['بردیا', 'مرادی', 'مدیر انبار'], ['هستی', 'قاسمی', 'کارشناس بازرگانی'], ['امیرعلی', 'محمدی', 'مدیرعامل'], ['ترانه', 'نوری', 'کارشناس مالی'],
] as const;
export const leadFixtureTopics = [
  'شرکت پخش البرز برای تعمیر خط بسته‌بندی ۲۴ عدد بلبرینگ SKF 6205 سفارش می‌دهد',
  'شرکت فناوران سپهر پیش‌فاکتور ۱۲ نمایشگر Dell P2422H برای اتاق کنترل می‌خواهد',
  'بازرگانی باران موجودی ۳۰ کارتریج HP 107A شعبه‌های تهران را استعلام کرده است',
  'گروه صنعتی آریا برای کارگاه مونتاژ ۴۰ صفحه‌کلید Logitech K270 درخواست قیمت داده است',
  'فروشگاه زنجیره‌ای شرق تأمین ۲۰ صندلی ارگونومیک برای شعبه‌های جدید را پیگیری می‌کند',
  'تجهیزات صنعتی پارس خرید ۱۵ ماوس Logitech M185 برای واحد طراحی را بررسی می‌کند',
  'پخش بهارستان درخواست تأمین ۱۲۰ بسته کاغذ A4 برای انبار مرکزی را ثبت کرده است',
  'راهکارهای دیجیتال فردا برای پروژه شبکه ۳۰۰ متر کابل Cat6 نیاز دارد',
  'شرکت پخش البرز قیمت ۶ روتر TP-Link Archer C6 برای توسعه شبکه شعب را می‌خواهد',
  'شرکت فناوران سپهر موجودی ۱۸ تلفن Yealink T31P برای واحد پشتیبانی را پیگیری می‌کند',
  'بازرگانی باران خرید ۲۵ حافظه USB سهند ۳۲ گیگابایتی برای تیم فروش را درخواست کرده است',
  'گروه صنعتی آریا تأمین ۱۰ پایه نمایشگر قابل تنظیم برای میزهای کنترل را بررسی می‌کند',
  'فروشگاه زنجیره‌ای شرق سفارش ۸ الکتروموتور سه‌فاز برای سردخانه‌های شعب را مطرح کرده است',
  'تجهیزات صنعتی پارس برای خط تراشکاری ۶ شافت فولادی C45 با قطر ۴۰ میلی‌متر می‌خواهد',
  'پخش بهارستان استعلام ۵۰ کاسه‌نمد NBR سایز ۳۵×۵۲×۸ برای سرویس پمپ‌ها را فرستاده است',
  'راهکارهای دیجیتال فردا پیشنهاد قیمت ۲۴ سوئیچ شبکه ۲۴ پورت برای ساختمان اداری می‌خواهد',
  'شرکت پخش البرز برای ناوگان انبار ۴۰ متر زنجیر صنعتی 08B سفارش می‌دهد',
  'شرکت فناوران سپهر خرید ۵ کوپلینگ L-110 برای پمپ‌های آب خنک‌کننده را پیگیری می‌کند',
  'بازرگانی باران پیش‌فاکتور ۳ جعبه‌دنده حلزونی برای دستگاه‌های بسته‌بندی درخواست کرده است',
  'گروه صنعتی آریا تأمین ۱۲ ست اورینگ و پکینگ جک هیدرولیک را برای تعمیرات ماهانه بررسی می‌کند',
] as const;
const leadContacts = [
  ['آرمان', 'احمدی'], ['نگار', 'رضایی'], ['کیان', 'کریمی'], ['رها', 'موسوی'], ['پارسا', 'جعفری'],
  ['سارا', 'حسینی'], ['بردیا', 'مرادی'], ['هستی', 'قاسمی'], ['امیرعلی', 'محمدی'], ['ترانه', 'نوری'],
  ['آرین', 'صادقی'], ['یلدا', 'رحیمی'], ['مانی', 'اکبری'], ['مهسا', 'عباسی'], ['سامان', 'کاظمی'],
  ['هلیا', 'جعفری'], ['پویا', 'محمودی'], ['آوا', 'نعمتی'], ['پارسا', 'میرزایی'], ['غزل', 'جعفری'],
] as const;
const leadFixtureCompanies = [
  'شرکت پخش البرز', 'فناوران سپهر', 'بازرگانی باران', 'گروه صنعتی آریا', 'فروشگاه زنجیره‌ای شرق',
  'تجهیزات صنعتی پارس', 'پخش بهارستان', 'راهکارهای دیجیتال فردا', 'شرکت پخش البرز', 'فناوران سپهر',
  'بازرگانی باران', 'گروه صنعتی آریا', 'فروشگاه زنجیره‌ای شرق', 'تجهیزات صنعتی پارس', 'پخش بهارستان',
  'راهکارهای دیجیتال فردا', 'شرکت پخش البرز', 'فناوران سپهر', 'بازرگانی باران', 'گروه صنعتی آریا',
] as const;
const previousAccountNames = [
  'شرکت پخش البرز', 'فناوران سپهر', 'بازرگانی باران', 'گروه صنعتی آریا',
  'فروشگاه زنجیره‌ای شرق', 'تجهیزات صنعتی پارس', 'پخش بهارستان', 'راهکارهای دیجیتال فردا',
] as const;

export async function seedCommerce(ctx: TestDataContext): Promise<TestDataCounts> {
  const accounts = [] as Array<{ id: string; name: string }>;
  for (const [legacyName, name] of accountFixtures) {
    let existing = await ctx.db.account.findFirst({ where: { organizationId: ctx.organizationId, name }, select: { id: true, name: true } });
    if (!existing && legacyName !== name) {
      const legacy = await ctx.db.account.findFirst({ where: { organizationId: ctx.organizationId, name: legacyName }, select: { id: true } });
      if (legacy) existing = await ctx.db.account.update({ where: { id: legacy.id }, data: { name }, select: { id: true, name: true } });
    }
    accounts.push(existing ?? await ctx.db.account.create({ data: { organizationId: ctx.organizationId, name, industry: 'فناوری و بازرگانی', city: 'تهران', country: 'ایران', ownerId: fixtureUserId(ctx, accounts.length) } }));
  }

  const contacts = [] as Array<{ id: string; firstName: string; lastName: string }>;
  for (let index = 0; index < 10; index += 1) {
    const serial = String(index + 1).padStart(2, '0');
    const email = `contact-${serial}@alvand.example.com`;
    const legacyEmail = `crm-test-${serial}@example.invalid`;
    const [firstName, lastName, jobTitle] = contactFixtures[index];
    let existing = await ctx.db.contact.findFirst({ where: { organizationId: ctx.organizationId, email }, select: { id: true, firstName: true, lastName: true, jobTitle: true } });
    if (!existing) {
      const legacy = await ctx.db.contact.findFirst({ where: { organizationId: ctx.organizationId, email: legacyEmail }, select: { id: true, firstName: true, lastName: true, jobTitle: true } });
      if (legacy) existing = await ctx.db.contact.update({ where: { id: legacy.id }, data: { email, ...(legacy.lastName === `آزمایشی ${serial}` ? { firstName, lastName } : {}), ...(legacy.jobTitle === 'مشتری آزمایشی' ? { jobTitle } : {}) }, select: { id: true, firstName: true, lastName: true, jobTitle: true } });
    }
    if (existing) {
      const oldNames = [['آرمان', 'احمدی'], ['نگار', 'رضایی'], ['کیان', 'کریمی'], ['رها', 'موسوی'], ['پارسا', 'جعفری']] as const;
      const previousName = oldNames[index % oldNames.length];
      const update: { firstName?: string; lastName?: string; jobTitle?: string } = {};
      if (existing.firstName === previousName[0] && existing.lastName === previousName[1]) {
        update.firstName = firstName;
        update.lastName = lastName;
      }
      if (existing.jobTitle === ['مدیر خرید', 'کارشناس فروش', 'مدیر مالی'][index % 3]) update.jobTitle = jobTitle;
      if (Object.keys(update).length) await ctx.db.contact.update({ where: { id: existing.id }, data: update });
      contacts.push(existing);
    } else {
      contacts.push(await ctx.db.contact.create({ data: { organizationId: ctx.organizationId, accountId: accounts[index % accounts.length].id, firstName, lastName, jobTitle, email, phone: `02155510${serial}`, ownerId: ctx.userId } }));
    }
  }

  for (let index = 0; index < leadStatuses.length; index += 1) {
    const serial = String(index + 1).padStart(2, '0');
    const topic = leadFixtureTopics[index];
    const legacyTopic = `سرنخ آزمایشی فروش ${serial}`;
    const previousTopic = `درخواست خرید تجهیزات اداری ${serial}`;
    let existing = await ctx.db.lead.findFirst({ where: { organizationId: ctx.organizationId, topic }, select: { id: true } });
    if (!existing) {
      const legacy = await ctx.db.lead.findFirst({ where: { organizationId: ctx.organizationId, topic: { in: [previousTopic, legacyTopic] } }, select: { id: true, topic: true, firstName: true, lastName: true, companyName: true, jobTitle: true, email: true, disqualifyNotes: true } });
      if (legacy) {
        const legacyEmail = `lead-test-${serial}@example.invalid`;
        existing = await ctx.db.lead.update({ where: { id: legacy.id }, data: {
          topic,
          ...(legacy.firstName === ['آرمان', 'نگار', 'کیان', 'رها'][index % 4] ? { firstName: leadContacts[index][0] } : {}),
          ...(legacy.lastName === `مشتری ${serial}` ? { lastName: ['احمدی', 'رضایی', 'کریمی', 'موسوی'][index % 4] } : {}),
          ...(legacy.lastName === ['احمدی', 'رضایی', 'کریمی', 'موسوی'][index % 4] ? { lastName: leadContacts[index][1] } : {}),
          ...(previousAccountNames.includes(legacy.companyName as typeof previousAccountNames[number]) ? { companyName: leadFixtureCompanies[index] } : {}),
          ...(legacy.jobTitle === 'مسئول خرید' ? { jobTitle: 'مسئول تدارکات' } : {}),
          ...(legacy.email === legacyEmail ? { email: `sales-inquiry-${serial}@alvand.example.com` } : {}),
          ...(legacy.disqualifyNotes === 'نمونه برای آزمون بستن سرنخ' ? { disqualifyNotes: 'بودجه خرید در فصل جاری تصویب نشد.' } : {}),
        }, select: { id: true } });
      }
    }
    if (!existing) {
      await ctx.db.lead.create({ data: {
        topic,
        firstName: leadContacts[index][0],
        lastName: leadContacts[index][1],
        companyName: leadFixtureCompanies[index],
        jobTitle: 'مسئول خرید',
        email: `sales-inquiry-${serial}@alvand.example.com`,
        phone: `02155520${serial}`,
        source: ['وب‌سایت', 'معرفی مشتری', 'نمایشگاه', 'تماس ورودی'][index % 4],
        estimatedRevenue: (index + 1) * 85000000,
        status: leadStatuses[index],
        disqualifyReason: leadStatuses[index] === 'DISQUALIFIED' ? (index % 2 === 0 ? 'NO_BUDGET' : 'UNRESPONSIVE') : null,
        disqualifyNotes: leadStatuses[index] === 'DISQUALIFIED' ? 'بودجه خرید در فصل جاری تصویب نشد.' : null,
        organizationId: ctx.organizationId,
        ownerId: fixtureUserId(ctx, index),
      } });
    }
  }

  const opportunityStates = ['OPEN', 'OPEN', 'WON', 'LOST', 'OPEN', 'WON'] as const;
  for (let index = 0; index < opportunityStates.length; index += 1) {
    const name = ['تأمین تجهیزات اداری شعب', 'توسعه قرارداد پخش منطقه‌ای', 'نوسازی تجهیزات انبار', 'تأمین رایانه‌های سازمانی', 'قرارداد خدمات پس از فروش', 'توسعه فروشگاه آنلاین'][index];
    let existing = await ctx.db.opportunity.findFirst({ where: { organizationId: ctx.organizationId, name }, select: { id: true } });
    if (!existing) {
      const legacyName = `فرصت آزمایشی ${String(index + 1).padStart(2, '0')}`;
      const legacy = await ctx.db.opportunity.findFirst({ where: { organizationId: ctx.organizationId, name: legacyName }, select: { id: true } });
      if (legacy) existing = await ctx.db.opportunity.update({ where: { id: legacy.id }, data: { name }, select: { id: true } });
    }
    if (!existing) await ctx.db.opportunity.create({ data: {
      organizationId: ctx.organizationId,
      name,
      estimatedRevenue: (index + 3) * 125000000,
      actualRevenue: opportunityStates[index] === 'WON' ? (index + 3) * 120000000 : null,
      state: opportunityStates[index],
      stage: (['QUALIFY', 'DEVELOP', 'PROPOSE', 'CLOSE'] as const)[index % 4],
      closeReason: opportunityStates[index] === 'LOST' ? 'رقیب با پیشنهاد مناسب‌تر انتخاب شد' : null,
      estimatedCloseDate: fixtureDate(ctx.now, index - 15),
      actualCloseDate: opportunityStates[index] === 'OPEN' ? null : fixtureDate(ctx.now, index + 1),
      accountId: accounts[index % accounts.length].id,
      contactId: contacts[index % contacts.length].id,
      ownerId: fixtureUserId(ctx, index + 1),
    } });
  }

  return { accounts: accountNames.length, contacts: 10, leads: leadStatuses.length, opportunities: opportunityStates.length };
}
