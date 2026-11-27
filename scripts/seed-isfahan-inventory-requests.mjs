import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not configured.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const requests = [
  {
    referenceNumber: 'TEC-038685', requestedAtText: '1405/08/27 09:40 AM',
    requestDescription: 'جایگزین کردن مودم SXT در سامانه 065W13002 بجای مودم B611',
    items: [{ name: 'مودم SXT', quantity: '', unit: '', note: 'جایگزینی مودم B611 در سامانه 065W13002؛ مدل دقیق در متن درخواست مشخص نشده است.' }],
  },
  {
    referenceNumber: 'TEC-038606', requestedAtText: '1405/08/24 09:59 AM',
    requestDescription: 'تعویض پروژکتور 200 معیوب سامانه 047S13005 (سنگ سفید خوانسار)؛ رادار بکاپ برای مراجعه قطعی رادار سامانه 586N13203 موقعیت سه راه لایبید به سمت گلپایگان',
    items: [
      { name: 'پروژکتور 200', quantity: '', unit: '', note: 'تعویض پروژکتور معیوب سامانه 047S13005 (سنگ سفید خوانسار).' },
      { name: 'رادار بکاپ', quantity: '', unit: '', note: 'برای مراجعه قطعی رادار سامانه 586N13203، موقعیت سه راه لایبید به سمت گلپایگان.' },
    ],
  },
  {
    referenceNumber: 'TEC-038538', requestedAtText: '1405/08/19 12:16 PM',
    requestDescription: 'اقلام درخواستی با نوع تامین امانی-فروش',
    items: [
      { name: 'پرژکتور HHB ITS LED - 200w-AC220', code: '057204888', quantity: '1.0', unit: 'عدد', supplyType: 'امانی-فروش', note: 'بابت سامانه 047S13005 (سنگ سفید خوانسار)' },
      { name: 'Mikrotik SXT LTE6 kit', code: '057207043', quantity: '1.0', unit: 'عدد', supplyType: 'امانی-فروش', note: 'مودم بکاپ' },
    ],
  },
];

try {
  const organizations = await prisma.organization.findMany({ select: { id: true, slug: true, ownerId: true } });
  const organization = organizations.find(({ slug }) => slug === 'rahyar') ?? (organizations.length === 1 ? organizations[0] : null);
  if (!organization) throw new Error(`Cannot safely identify the target organization (${organizations.length} organizations found).`);
  for (const request of requests) await prisma.rahcomInventoryRequest.upsert({
    where: { organizationId_referenceNumber: { organizationId: organization.id, referenceNumber: request.referenceNumber } },
    create: { organizationId: organization.id, createdById: organization.ownerId ?? 'system-import', province: 'isfahan', ...request },
    update: {},
  });
  const saved = await prisma.rahcomInventoryRequest.findMany({
    where: { organizationId: organization.id, referenceNumber: { in: requests.map(({ referenceNumber }) => referenceNumber) } },
    select: { referenceNumber: true, status: true, items: true }, orderBy: { referenceNumber: 'asc' },
  });
  console.log(JSON.stringify(saved.map(({ referenceNumber, status, items }) => ({ referenceNumber, status, itemCount: Array.isArray(items) ? items.length : 0 }))));
} finally {
  await prisma.$disconnect();
}
