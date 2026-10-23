import { Prisma } from '@prisma/client';
import type { TestDataContext, TestDataCounts } from './context';
import { fixtureDate, fixtureUserId } from './context';

const chart = [
  ['1100', 'صندوق اصلی شرکت', 'ASSET'],
  ['1110', 'حساب جاری بانک ملت', 'ASSET'],
  ['2100', 'حساب‌های پرداختنی تجاری', 'LIABILITY'],
  ['3100', 'سرمایه شرکت', 'EQUITY'],
  ['4100', 'درآمد فروش کالا', 'REVENUE'],
  ['6100', 'هزینه‌های اداری و پشتیبانی', 'EXPENSE'],
] as const;
const legacyAccountCodes = ['TEST-1001', 'TEST-1002', 'TEST-2001', 'TEST-3001', 'TEST-4001', 'TEST-5001'] as const;
const legacyAccountNames = ['صندوق آزمایشی', 'بانک آزمایشی', 'حساب‌های پرداختنی آزمایشی', 'سرمایهٔ آزمایشی', 'درآمد فروش آزمایشی', 'هزینهٔ اداری آزمایشی'];

const invoiceStatuses = ['DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PENDING_REVIEW', 'APPROVED', 'SUBMITTED', 'DRAFT'] as const;
const invoiceFixtures = [
  { title: 'فاکتور خرید بلبرینگ SKF 6205 برای خط بسته‌بندی', description: 'خرید ۸ عدد بلبرینگ SKF 6205 برای تعمیر الکتروموتور خط بسته‌بندی؛ تهیه‌شده از فروشگاه قطعات صنعتی شاهپور در بازار شاپور تهران.', vendorName: 'فروشگاه قطعات صنعتی شاهپور', itemDescription: 'بلبرینگ SKF 6205 برای الکتروموتور خط بسته‌بندی', quantity: 8 },
  { title: 'فاکتور خرید شافت فولادی C45 نوار نقاله', description: 'خرید شافت فولادی C45 با قطر ۴۰ میلی‌متر برای نوسازی محور نوار نقاله انبار کرج؛ تأمین از فولاد مرکزی تهران.', vendorName: 'فولاد مرکزی تهران', itemDescription: 'شافت فولادی C45 قطر ۴۰ میلی‌متر برای نوار نقاله', quantity: 2 },
  { title: 'فاکتور خرید کاسه‌نمد پمپ هیدرولیک', description: 'خرید ۲۰ عدد کاسه‌نمد NBR سایز ۳۵×۵۲×۸ برای سرویس پمپ‌های هیدرولیک دستگاه پرس؛ تهیه‌شده از آب‌بند البرز.', vendorName: 'آب‌بند البرز', itemDescription: 'کاسه‌نمد NBR سایز ۳۵×۵۲×۸ برای پمپ هیدرولیک', quantity: 20 },
  { title: 'فاکتور خرید چرخ‌دنده مارپیچ گیربکس خط تولید', description: 'ساخت و خرید یک جفت چرخ‌دنده مارپیچ مدول ۳ برای گیربکس خط تولید؛ سفارش ساخت به دنده‌سازی مهرگان.', vendorName: 'دنده‌سازی مهرگان', itemDescription: 'جفت چرخ‌دنده مارپیچ مدول ۳ گیربکس خط تولید', quantity: 1 },
  { title: 'فاکتور خرید تسمه تایم دستگاه برش', description: 'خرید ۶ تسمه تایم HTD 8M-1200 برای دستگاه برش CNC کارگاه؛ تأمین از تسمه‌سازی نوین.', vendorName: 'تسمه‌سازی نوین', itemDescription: 'تسمه تایم HTD 8M-1200 دستگاه برش CNC', quantity: 6 },
  { title: 'فاکتور خرید یاتاقان UCP 208 فن صنعتی', description: 'خرید ۴ یاتاقان UCP 208 برای تعویض پایه‌های فن مکنده سالن مونتاژ؛ تأمین از یاتاقان‌فروشی قائم.', vendorName: 'یاتاقان‌فروشی قائم', itemDescription: 'یاتاقان UCP 208 پایه فن مکنده سالن مونتاژ', quantity: 4 },
  { title: 'فاکتور خرید زنجیر صنعتی 08B خط مونتاژ', description: 'خرید ۱۵ متر زنجیر صنعتی 08B-1 برای انتقال قطعات در خط مونتاژ؛ سفارش از زنجیر صنعتی پارس.', vendorName: 'زنجیر صنعتی پارس', itemDescription: 'زنجیر صنعتی 08B-1 خط مونتاژ', quantity: 15 },
  { title: 'فاکتور خرید کوپلینگ انعطاف‌پذیر پمپ آب', description: 'خرید ۳ کوپلینگ انعطاف‌پذیر سایز L-110 برای اتصال پمپ‌های آب خنک‌کننده؛ تهیه‌شده از پمپ‌سازان تهران.', vendorName: 'پمپ‌سازان تهران', itemDescription: 'کوپلینگ انعطاف‌پذیر L-110 پمپ آب خنک‌کننده', quantity: 3 },
  { title: 'فاکتور خرید چرخ‌دنده حلزونی گیربکس بسته‌بندی', description: 'خرید یک دست چرخ‌دنده حلزونی برنزی برای گیربکس دستگاه بسته‌بندی شماره ۲؛ ساخت دنده‌سازی مهرگان.', vendorName: 'دنده‌سازی مهرگان', itemDescription: 'دست چرخ‌دنده حلزونی برنزی گیربکس بسته‌بندی شماره ۲', quantity: 1 },
  { title: 'فاکتور خرید اورینگ و پکینگ جک هیدرولیک', description: 'خرید ۱۲ دست اورینگ و پکینگ مقاوم به روغن برای سرویس جک‌های هیدرولیک پرس؛ تهیه از آب‌بند البرز.', vendorName: 'آب‌بند البرز', itemDescription: 'ست اورینگ و پکینگ جک هیدرولیک پرس', quantity: 12 },
  { title: 'فاکتور خرید الکتروموتور سه‌فاز فن مکنده', description: 'خرید یک الکتروموتور سه‌فاز ۳ کیلووات برای جایگزینی موتور فن مکنده سالن تراشکاری؛ تأمین از الکتروصنعت سپهر.', vendorName: 'الکتروصنعت سپهر', itemDescription: 'الکتروموتور سه‌فاز ۳ کیلووات فن مکنده', quantity: 1 },
  { title: 'فاکتور خرید پولی و بوش مخروطی دستگاه تراش', description: 'خرید یک مجموعه پولی و بوش مخروطی سایز ۳۰۲۰ برای انتقال قدرت دستگاه تراش کارگاه مرکزی؛ تهیه از ابزار و قطعات صنعتی شاپور.', vendorName: 'ابزار و قطعات صنعتی شاپور', itemDescription: 'مجموعه پولی و بوش مخروطی سایز ۳۰۲۰ دستگاه تراش', quantity: 1 },
] as const;

export async function seedAccounting(ctx: TestDataContext): Promise<TestDataCounts> {
  const accounts = await Promise.all(chart.map(async ([code, name, type], index) => {
    let account = await ctx.db.accountingAccount.findUnique({ where: { organizationId_code: { organizationId: ctx.organizationId, code } } });
    if (!account) {
      const legacy = await ctx.db.accountingAccount.findUnique({ where: { organizationId_code: { organizationId: ctx.organizationId, code: legacyAccountCodes[index] } } });
      if (legacy) account = legacy.name === name || legacy.name === legacyAccountNames[index]
        ? await ctx.db.accountingAccount.update({ where: { id: legacy.id }, data: { code, ...(legacy.name === legacyAccountNames[index] ? { name } : {}) } })
        : legacy;
    }
    return account ?? ctx.db.accountingAccount.create({ data: { organizationId: ctx.organizationId, code, name, type } });
  }));

  for (let index = 0; index < invoiceStatuses.length; index += 1) {
    const serial = String(index + 1).padStart(3, '0');
    const fixture = invoiceFixtures[index];
    const amount = new Prisma.Decimal((index + 1) * 12500000);
    const documentNumber = `AP-1405-${serial}`;
    const legacyDocumentNumber = `TEST-INV-${serial}`;
    let invoice = await ctx.db.accountingInvoice.findUnique({
      where: { organizationId_documentNumber: { organizationId: ctx.organizationId, documentNumber } },
      select: { id: true, status: true, title: true, description: true, vendorName: true },
    });
    if (!invoice) {
      const legacyInvoice = await ctx.db.accountingInvoice.findUnique({
        where: { organizationId_documentNumber: { organizationId: ctx.organizationId, documentNumber: legacyDocumentNumber } },
        select: { id: true, status: true, title: true, description: true, vendorName: true },
      });
      if (legacyInvoice) {
        const previousTitles = [`فاکتور خرید کالا ${serial}`, `فاکتور آزمایشی ${serial}`];
        invoice = previousTitles.includes(legacyInvoice.title)
          ? await ctx.db.accountingInvoice.update({ where: { id: legacyInvoice.id }, data: { documentNumber }, select: { id: true, status: true, title: true, description: true, vendorName: true } })
          : legacyInvoice;
      }
    }
    invoice ??= await ctx.db.accountingInvoice.upsert({
      where: { organizationId_documentNumber: { organizationId: ctx.organizationId, documentNumber } },
      create: {
        organizationId: ctx.organizationId,
        createdById: fixtureUserId(ctx, index),
        documentNumber,
        title: fixture.title,
        description: fixture.description,
        vendorName: fixture.vendorName,
        status: invoiceStatuses[index],
        priority: (['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const)[index % 4],
        totalAmount: amount,
        currency: 'IRR',
        dueDate: fixtureDate(ctx.now, index - 10),
        lineItems: { create: [{ description: fixture.itemDescription, quantity: fixture.quantity, unitPrice: amount.div(fixture.quantity), taxRate: 9, total: amount }] },
        statusHistory: { create: [{ actedById: fixtureUserId(ctx, index + 1), status: invoiceStatuses[index], note: `مدارک خرید ${fixture.itemDescription} از ${fixture.vendorName} برای بررسی ثبت شد.` }] },
      },
      update: {},
      select: { id: true, status: true, title: true, description: true, vendorName: true },
    });
    const previousTitles = [`فاکتور خرید کالا ${serial}`, `فاکتور آزمایشی ${serial}`];
    const previousVendors = [
      ['تأمین تجهیزات آریا', 'تأمین‌گر نمونهٔ آریا'],
      ['فناوران سپهر', 'شرکت آزمایشی سپهر'],
      ['بازرگانی داده‌نما', 'فروشگاه داده‌نما'],
    ][index % 3];
    const invoiceTextUpdate: { title?: string; description?: string; vendorName?: string } = {};
    if (previousTitles.includes(invoice.title)) invoiceTextUpdate.title = fixture.title;
    if (['دادهٔ آزمایشی برای بررسی گردش کار حسابداری', 'خرید تجهیزات و ملزومات موردنیاز شعب و واحدهای سازمانی.'].includes(invoice.description ?? '')) invoiceTextUpdate.description = fixture.description;
    if (previousVendors.includes(invoice.vendorName ?? '')) invoiceTextUpdate.vendorName = fixture.vendorName;
    if (Object.keys(invoiceTextUpdate).length) await ctx.db.accountingInvoice.update({ where: { id: invoice.id }, data: invoiceTextUpdate });
    await ctx.db.accountingInvoiceLineItem.updateMany({ where: { invoiceId: invoice.id, description: { in: [`قلم آزمایشی ${serial}`, 'تجهیزات و ملزومات اداری'] } }, data: { description: fixture.itemDescription, quantity: fixture.quantity, unitPrice: amount.div(fixture.quantity) } });
    await ctx.db.accountingInvoiceStatusHistory.updateMany({ where: { invoiceId: invoice.id, note: { in: ['ثبت اولیهٔ دادهٔ آزمایشی', 'فاکتور برای بررسی و تأیید در سامانه ثبت شد.'] } }, data: { note: `مدارک خرید ${fixture.itemDescription} از ${fixture.vendorName} برای بررسی ثبت شد.` } });
    if (invoice.status === 'COMPLETED') {
      const payment = await ctx.db.accountingInvoicePayment.upsert({
        where: { id: `fixture-payment-${ctx.organizationId}-${serial}` },
        create: { id: `fixture-payment-${ctx.organizationId}-${serial}`, invoiceId: invoice.id, receivedById: fixtureUserId(ctx, index + 2), paidAmount: amount, method: 'BANK_TRANSFER', referenceNumber: `PAY-1405-${serial}`, note: 'تسویه از طریق حواله بانکی.' },
        update: {},
        select: { id: true, note: true, referenceNumber: true },
      });
      if (payment.note === 'پرداخت آزمایشی' || payment.referenceNumber === `TEST-PAY-${serial}`) {
        await ctx.db.accountingInvoicePayment.update({ where: { id: payment.id }, data: { ...(payment.note === 'پرداخت آزمایشی' ? { note: 'تسویه از طریق حواله بانکی.' } : {}), ...(payment.referenceNumber === `TEST-PAY-${serial}` ? { referenceNumber: `PAY-1405-${serial}` } : {}) } });
      }
    }
  }

  for (let index = 0; index < 6; index += 1) {
    const serial = String(index + 1).padStart(3, '0');
    const number = `JV-1405-${serial}`;
    const cash = accounts[0];
    const offset = accounts[index % 2 === 0 ? 5 : 4];
    let voucher = await ctx.db.accountingVoucher.findUnique({ where: { organizationId_number: { organizationId: ctx.organizationId, number } }, select: { id: true, description: true } });
    if (!voucher) {
      const legacyVoucher = await ctx.db.accountingVoucher.findUnique({ where: { organizationId_number: { organizationId: ctx.organizationId, number: `TEST-VCH-${serial}` } }, select: { id: true, description: true } });
      if (legacyVoucher) {
        const legacyDescription = `سند آزمایشی ${serial} برای آزمون دفتر روزنامه`;
        voucher = legacyVoucher.description === legacyDescription || legacyVoucher.description === `ثبت خرید تجهیزات اداری شماره ${serial}`
          ? await ctx.db.accountingVoucher.update({ where: { id: legacyVoucher.id }, data: { number }, select: { id: true, description: true } })
          : legacyVoucher;
      }
    }
    voucher ??= await ctx.db.accountingVoucher.upsert({
      where: { organizationId_number: { organizationId: ctx.organizationId, number } },
      create: {
        organizationId: ctx.organizationId,
        createdById: fixtureUserId(ctx, index),
        number,
        date: fixtureDate(ctx.now, index * 4),
        description: `ثبت پرداخت خرید ${invoiceFixtures[index % invoiceFixtures.length].itemDescription}`,
        status: index < 3 ? 'POSTED' : 'DRAFT',
        lines: { create: [
          { accountId: cash.id, description: `بهای ${invoiceFixtures[index % invoiceFixtures.length].itemDescription}`, debit: 1000000 + index * 250000, credit: 0 },
          { accountId: offset.id, description: 'پرداخت از حساب بانکی', debit: 0, credit: 1000000 + index * 250000 },
        ] },
      },
      update: {},
      select: { id: true, description: true },
    });
    const legacyDescription = `سند آزمایشی ${serial} برای آزمون دفتر روزنامه`;
    const oldVoucherDescription = `ثبت خرید تجهیزات اداری شماره ${serial}`;
    const voucherFixture = invoiceFixtures[index % invoiceFixtures.length];
    if (voucher.description === legacyDescription || voucher.description === oldVoucherDescription) await ctx.db.accountingVoucher.update({ where: { id: voucher.id }, data: { description: `ثبت پرداخت خرید ${voucherFixture.itemDescription}` } });
    await ctx.db.accountingVoucherLine.updateMany({ where: { voucherId: voucher.id, description: { in: ['بدهکار آزمایشی', 'بهای خرید تجهیزات', `بهای ${voucherFixture.itemDescription}`] } }, data: { description: `بهای ${voucherFixture.itemDescription}` } });
    await ctx.db.accountingVoucherLine.updateMany({ where: { voucherId: voucher.id, description: 'بستانکار آزمایشی' }, data: { description: 'پرداخت از حساب بانکی' } });
  }

  return { accounts: chart.length, invoices: invoiceStatuses.length, vouchers: 6, voucherLines: 12 };
}
