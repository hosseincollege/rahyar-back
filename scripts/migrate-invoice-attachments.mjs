import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not defined in the environment');

const root = path.resolve(process.env.RAHYAR_STORAGE_ROOT || path.resolve(process.cwd(), '..', 'Rahyar Storage'));
const provinceCodes = {
  isfahan: 'ESF', tehran: 'THR', 'east-azerbaijan': 'AZE', 'west-azerbaijan': 'AZW',
  ardabil: 'ARD', alborz: 'ALB', ilam: 'ILA', bushehr: 'BUS', 'charmahal-bakhtiari': 'CHB',
  'south-khorasan': 'KHS', 'razavi-khorasan': 'KHR', 'north-khorasan': 'KHN', khuzestan: 'KHZ',
  zanjan: 'ZAN', semnan: 'SEM', 'sistan-baluchestan': 'SIB', fars: 'FAR', qazvin: 'QAZ',
  qom: 'QOM', kurdistan: 'KOR', kerman: 'KER', kermanshah: 'KSH',
  'kohgiluyeh-boyerahmad': 'KOB', golestan: 'GOL', gilan: 'GIL', lorestan: 'LOR',
  mazandaran: 'MAZ', markazi: 'MRK', hormozgan: 'HOR', hamadan: 'HAM', yazd: 'YAZ',
};
const categoryFolders = {
  INVOICE: 'Invoices', PAYMENT_RECEIPT: 'Payment Receipts', START_PHOTO: 'Work Start',
  END_PHOTO: 'Work End', OTHER: 'Other',
};
const extensionFor = (mimeType) => ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' })[mimeType] || '.bin';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

try {
  const legacy = await prisma.rahcomInvoiceAttachment.findMany({
    where: { storagePath: null, content: { not: null } },
    select: { id: true, province: true, invoiceNumber: true, category: true, originalName: true, mimeType: true, content: true },
  });
  let migrated = 0;
  for (const attachment of legacy) {
    const provinceCode = provinceCodes[attachment.province] || attachment.province.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
    const categoryFolder = categoryFolders[attachment.category] || 'Other';
    const invoiceNumber = attachment.invoiceNumber.replace(/[^A-Za-z0-9_-]/g, '-') || 'invoice';
    const originalStem = path.basename(attachment.originalName, path.extname(attachment.originalName))
      .normalize('NFKC').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'image';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${invoiceNumber}_${attachment.category.toLowerCase()}_${timestamp}_${randomUUID().slice(0, 8)}_${originalStem}${extensionFor(attachment.mimeType)}`;
    const storagePath = path.posix.join(provinceCode, categoryFolder, fileName);
    const absolutePath = path.resolve(root, ...storagePath.split('/'));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, Buffer.from(attachment.content), { flag: 'wx' });
    try {
      await prisma.rahcomInvoiceAttachment.update({
        where: { id: attachment.id },
        data: { storagePath, content: null },
      });
    } catch (error) {
      await rm(absolutePath, { force: true });
      throw error;
    }
    migrated += 1;
  }
  console.log(`Moved ${migrated} invoice attachment(s) into ${root}.`);
} finally {
  await prisma.$disconnect();
}
