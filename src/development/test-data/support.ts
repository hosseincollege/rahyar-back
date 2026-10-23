import type { TestDataContext, TestDataCounts } from './context';
import { fixtureDate, fixtureUserId } from './context';

const ticketStatuses = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED', 'CANCELLED', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'OPEN', 'RESOLVED', 'OPEN', 'CLOSED', 'IN_PROGRESS', 'OPEN', 'CANCELLED', 'WAITING_FOR_CUSTOMER', 'OPEN', 'RESOLVED', 'OPEN'] as const;
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const types = ['SUPPORT', 'INCIDENT', 'REQUEST', 'QUESTION', 'COMPLAINT'] as const;
const ticketFixtures = [
  ['کمبود ۴ بلبرینگ SKF 6205 در سفارش تعمیر خط بسته‌بندی شرکت پخش البرز', 'در رسید انبار ۲۰ بلبرینگ ثبت شده اما فاکتور شرکت پخش البرز ۲۴ عدد نشان می‌دهد؛ چهار قلم باقی‌مانده با فروشگاه قطعات صنعتی شاهپور پیگیری شود.'],
  ['فعال‌سازی دسترسی پرتال سفارش‌ها برای کارشناس فروش فناوران سپهر', 'کارشناس فروش فناوران سپهر برای مشاهده سفارش‌های تحویل‌نشده به نقش «پیگیری سفارش» نیاز دارد؛ دسترسی واحد فروش و سطح مشاهده اطلاعات مشتری بررسی شود.'],
  ['قطع‌ووصلی شبکه انبار کرج هنگام ثبت حواله خروج', 'از ساعت ۸ تا ۹:۳۰ ارتباط رایانه‌های انبار کرج با سامانه قطع‌و‌وصل شده و ثبت حواله خروج بلبرینگ‌ها دوبار ناموفق مانده است؛ گزارش سوئیچ طبقه همکف بررسی شود.'],
  ['اختلاف فروش شعبه اصفهان در گزارش ماهانه با دفتر مالی', 'گزارش فروش اردیبهشت شعبه اصفهان ۱۸٬۴۵۰٬۰۰۰ ریال بیشتر از خروجی دفتر مالی است؛ برگشت فاکتورهای ۲۱ و ۲۳ اردیبهشت با سند حسابداری تطبیق داده شود.'],
  ['پیگیری تحویل سفارش ۴۸۲۱ کاغذ A4 برای فروشگاه زنجیره‌ای شرق', 'سفارش ۱۲۰ بسته کاغذ A4 هنوز در وضعیت «آماده ارسال» است؛ زمان بارگیری از انبار مرکزی تهران و تاریخ تحویل به شعبه کرج اعلام شود.'],
  ['مغایرت سریال نمایشگرهای تحویل‌شده به گروه صنعتی آریا', 'فاکتور گروه صنعتی آریا شامل ۱۲ نمایشگر Dell P2422H است اما دو شماره سریال روی برگه تحویل ثبت نشده؛ تصویر فاکتور و رسید بارگیری تطبیق داده شود.'],
  ['خطای ورود کارشناس تدارکات تجهیزات صنعتی پارس به سامانه', 'کارشناس تدارکات پس از تغییر رمز با پیام «حساب فعال نیست» روبه‌رو می‌شود؛ وضعیت عضویت سازمانی و تاریخ آخرین ورود بررسی شود.'],
  ['کندی ثبت درخواست خرید در پرتال پخش بهارستان', 'ثبت درخواست خرید ۵۰ کارتریج HP 107A بیش از ۳۰ ثانیه طول می‌کشد؛ زمان پاسخ API و لاگ صف خرید در بازه ۱۰ تا ۱۱ بررسی شود.'],
  ['اصلاح نشانی تحویل کابل شبکه برای پروژه راهکارهای دیجیتال فردا', 'نشانی سفارش ۳۰۰ متر کابل Cat6 به انبار قدیمی ثبت شده است؛ پیش از صدور حواله، نشانی تحویل به ساختمان اداری خیابان مطهری تغییر کند.'],
  ['عدم نمایش دو فاکتور خرید در حساب کاربری شرکت پخش البرز', 'فاکتورهای AP-1405-018 و AP-1405-019 پس از تأیید مالی در پرتال شرکت پخش البرز دیده نمی‌شوند؛ سطح دسترسی اسناد و وضعیت انتشار بررسی شود.'],
  ['درخواست بازیابی فایل پیش‌فاکتور روترهای فناوران سپهر', 'فایل پیش‌فاکتور ۶ روتر TP-Link Archer C6 از پیوست درخواست حذف شده است؛ نسخه ثبت‌شده در بایگانی خرید بازیابی و به پرونده افزوده شود.'],
  ['خطای محاسبه مالیات فاکتور کاسه‌نمدهای بازرگانی باران', 'در فاکتور ۵۰ کاسه‌نمد NBR نرخ مالیات برای یک ردیف صفر ثبت شده است؛ محاسبه سطرها با نرخ مصوب و جمع کل فاکتور دوباره بررسی شود.'],
  ['عدم تطبیق موجودی تلفن‌های Yealink شعب فروشگاه زنجیره‌ای شرق', 'کارت انبار ۱۸ تلفن Yealink T31P نشان می‌دهد اما شمارش فیزیکی ۱۶ دستگاه است؛ حواله انتقال بین شعب و رسید مرجوعی هفته گذشته بررسی شود.'],
  ['دسترسی مشاهده گزارش تحویل برای مدیر گروه صنعتی آریا', 'مدیر خرید گروه صنعتی آریا باید وضعیت تحویل سفارش‌ها را ببیند اما منوی گزارش ارسال برایش نمایش داده نمی‌شود؛ نقش پرتال مشتری بازبینی شود.'],
  ['ثبت دوباره سفارش صندلی‌های تجهیزات صنعتی پارس پس از قطع شبکه', 'پس از قطع اتصال، سفارش ۲۰ صندلی ارگونومیک دو بار ارسال شده است؛ یک سفارش نگه داشته شود و نسخه تکراری پیش از صدور فاکتور لغو شود.'],
  ['تأخیر در ارسال حافظه‌های USB سفارش پخش بهارستان', 'سفارش ۲۵ حافظه USB سهند ۳۲ گیگابایتی از موعد ارسال گذشته است؛ موجودی انبار مرکزی و برنامه بارگیری شرکت حمل بررسی شود.'],
  ['نمایش مبلغ ناخالص به‌جای مبلغ خالص در گزارش فروش شعبه البرز', 'در خروجی CSV فروش خرداد شرکت پخش البرز، مبلغ ناخالص به ستون مبلغ خالص منتقل شده است؛ نگاشت ستون‌ها و تخفیف فاکتورهای مرجوعی بررسی شود.'],
  ['عدم دریافت اعلان تغییر وضعیت سفارش توسط فناوران سپهر', 'وضعیت سفارش ۷۳۱۲ به «ارسال‌شده» تغییر کرده اما اعلان پرتال به فناوران سپهر نرسیده است؛ ثبت رویداد و صف ارسال پیام بررسی شود.'],
  ['درخواست اصلاح شماره شبا در پرونده تأمین‌کننده بازرگانی باران', 'شماره شبای ثبت‌شده در پرونده بازرگانی باران با گواهی بانکی جدید مطابقت ندارد؛ مدارک پیوست و تأیید واحد مالی پیش از پرداخت بررسی شود.'],
  ['خطای چاپ رسید تحویل قطعات خط مونتاژ گروه صنعتی آریا', 'رسید تحویل ۴۰ متر زنجیر صنعتی 08B در چاپگر انبار بدون نام تحویل‌گیرنده صادر می‌شود؛ قالب چاپ و فیلد مسئول تحویل بازبینی شود.'],
] as const;
const previousTicketSubjects = [
  'عدم تطبیق تعداد اقلام در سفارش سازمانی', 'درخواست فعال‌سازی دسترسی به پرتال مشتریان', 'کندی شبکه در شعبه کرج',
  'اصلاح گزارش فروش ماهانه', 'پیگیری وضعیت ارسال سفارش شماره ۴۸۲۱',
] as const;
const previousCustomerNames = ['شرکت پخش البرز', 'فناوران سپهر', 'بازرگانی باران', 'گروه صنعتی آریا'] as const;
const previousTicketDescriptions = [
  'مشتری اعلام کرده تعداد اقلام فاکتور با محموله تحویل‌شده مطابقت ندارد؛ لطفاً سفارش و رسید انبار بررسی شود.',
  'کاربر واحد فروش برای مشاهده وضعیت سفارش‌های مشتریان سازمانی به دسترسی پرتال نیاز دارد.',
  'در ساعات ابتدایی روز ارتباط چند کاربر شعبه کرج با سامانه قطع و وصل می‌شود؛ گزارش شبکه پیوست پرونده است.',
  'جمع فروش شعبه اصفهان در گزارش ماهانه با خروجی دفتر مالی اختلاف دارد؛ بازه اول تا پایان ماه بررسی شود.',
  'مشتری درباره زمان تحویل سفارش خود پیگیری کرده است؛ آخرین وضعیت ارسال و زمان تقریبی اعلام شود.',
] as const;
const previousInitialTicketMessage = 'پرونده دریافت شد؛ موضوع با واحد مربوطه بررسی و نتیجه در همین درخواست اعلام می‌شود.';
const initialTicketMessage = (subject: string) => `درخواست «${subject}» ثبت شد و برای پیگیری به واحد مربوط ارجاع داده شد.`;

export async function seedSupport(ctx: TestDataContext): Promise<TestDataCounts> {
  const projectStatuses = ['ACTIVE', 'ACTIVE', 'ON_HOLD', 'COMPLETED'] as const;
  const previousProjectNames = [
    'بهینه‌سازی فرایند ثبت سفارش',
    'راه‌اندازی پرتال خدمات مشتریان',
    'نوسازی زیرساخت شعب',
    'استقرار گزارش‌های مالی',
  ] as const;
  const projectNames = [
    ['سفارش‌ها', 'یکپارچه‌سازی ثبت سفارش و پیگیری تحویل برای مشتریان سازمانی.'],
    ['پرتال پشتیبانی', 'طراحی پرتال خدمات و انتقال درخواست‌های مشتریان به گردش کار واحد پشتیبانی.'],
    ['زیرساخت شعب', 'ارتقای تجهیزات شبکه و آماده‌سازی زیرساخت شعب تهران و کرج.'],
    ['گزارش مالی', 'تجمیع گزارش‌های درآمد، هزینه و جریان نقدینگی برای پایان دوره مالی.'],
  ] as const;
  const projects = [] as Array<{ id: string }>;
  for (let index = 0; index < projectNames.length; index += 1) {
    const serial = String(index + 1).padStart(3, '0');
    const code = `PRJ-${ctx.organizationId.toUpperCase()}-${serial}`;
    const [name, description] = projectNames[index];
    const project = await ctx.db.project.upsert({
      where: { code },
      create: { organizationId: ctx.organizationId, code, name, description, status: projectStatuses[index] },
      update: {},
      select: { id: true, name: true },
    });
    if (project.name === previousProjectNames[index]) {
      await ctx.db.project.update({ where: { id: project.id }, data: { name } });
    }
    projects.push(project);
    const memberIds = ctx.userIds.length ? ctx.userIds : [ctx.userId];
    for (let memberIndex = 0; memberIndex < memberIds.length; memberIndex += 1) {
      await ctx.db.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId: memberIds[memberIndex] } },
        create: { projectId: project.id, userId: memberIds[memberIndex], role: memberIndex === 0 ? 'MANAGER' : 'MEMBER' },
        update: {},
      });
    }
  }

  for (let index = 0; index < ticketStatuses.length; index += 1) {
    const ticketNumber = 970001 + index;
    const status = ticketStatuses[index];
    const [subject, description] = ticketFixtures[index];
    const ticketKey = { organizationId_ticketNumber: { organizationId: ctx.organizationId, ticketNumber } };
    const existing = await ctx.db.ticket.findUnique({ where: ticketKey, select: { id: true, subject: true, description: true, projectId: true } });
    if (existing) {
      const legacySubject = `درخواست آزمایشی پشتیبانی ${String(index + 1).padStart(2, '0')}`;
      const legacyDescription = `شرح نمونه برای بررسی فهرست، جزئیات، فیلترها و گردش کار پشتیبانی. مورد ${index + 1} از ۲۰.`;
      const previousSubject = `${previousTicketSubjects[index % previousTicketSubjects.length]} - ${previousCustomerNames[Math.floor(index / previousTicketSubjects.length)]}`;
      const previousDescription = previousTicketDescriptions[index % previousTicketDescriptions.length];
      const fixtureOwned = (existing.subject === legacySubject && existing.description === legacyDescription) || (existing.subject === previousSubject && existing.description === previousDescription);
      if (fixtureOwned) {
        await ctx.db.ticket.update({ where: { id: existing.id }, data: { subject, description, projectId: existing.projectId ?? projects[index % projects.length].id } });
        await ctx.db.ticketMessage.updateMany({
          where: { ticketId: existing.id, body: { in: ['پیام اولیهٔ آزمایشی برای بررسی گفت‌وگوی تیکت.', previousInitialTicketMessage] } },
          data: { body: initialTicketMessage(subject) },
        });
      }
      continue;
    }
    await ctx.db.ticket.create({
      data: {
        organizationId: ctx.organizationId,
        creatorId: fixtureUserId(ctx, index),
        assigneeId: index % 3 === 0 ? null : fixtureUserId(ctx, index + 1),
        ticketNumber,
        projectId: projects[index % projects.length].id,
        subject,
        description,
        type: types[index % types.length],
        status,
        priority: priorities[index % priorities.length],
        visibility: index % 4 === 0 ? 'CUSTOMER' : 'INTERNAL',
        category: ['حساب کاربری', 'پرداخت', 'انبار', 'گزارش'][index % 4],
        dueAt: fixtureDate(ctx.now, index - 3),
        resolution: status === 'RESOLVED' || status === 'CLOSED' ? 'اطلاعات سفارش با رسید انبار تطبیق داده شد و نتیجه برای مشتری ارسال شد.' : null,
        resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? fixtureDate(ctx.now, 1) : null,
        closedAt: status === 'CLOSED' ? fixtureDate(ctx.now, 1) : null,
        messages: { create: [{ authorId: fixtureUserId(ctx, index + 2), body: initialTicketMessage(subject), isInternal: index % 2 === 0 }] },
      },
    });
  }
  return { projects: projects.length, tickets: ticketStatuses.length, ticketMessages: ticketStatuses.length };
}
