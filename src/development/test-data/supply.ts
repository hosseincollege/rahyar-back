import type { TestDataContext, TestDataCounts } from './context';
import { fixtureDate } from './context';

const warehouseFixtures = [
  ['WH-TEH-01', 'انبار مرکزی تهران', 'تهران'],
  ['WH-KRJ-01', 'انبار مواد اولیه کرج', 'کرج'],
  ['WH-QAZ-01', 'مرکز توزیع قزوین', 'قزوین'],
] as const;
const legacyWarehouseCodes = ['TEST-MAIN', 'TEST-RAW', 'TEST-TRANSIT'] as const;
export const productFixtures = [
  ['IT-LEN-E14', 'رایانه همراه Lenovo ThinkPad E14', 'دستگاه', 4],
  ['MON-DELL-P2422H', 'نمایشگر Dell P2422H، ۲۴ اینچ', 'عدد', 5],
  ['KB-LOG-K270', 'صفحه‌کلید بی‌سیم Logitech K270', 'عدد', 10],
  ['MS-LOG-M185', 'ماوس بی‌سیم Logitech M185', 'عدد', 10],
  ['PAPER-A4-500', 'کاغذ تحریر A4، بسته ۵۰۰ برگی', 'بسته', 12],
  ['TON-HP-107A', 'کارتریج لیزری HP 107A', 'عدد', 3],
  ['CHR-ARIA-ERG', 'صندلی اداری ارگونومیک مدل آریا', 'عدد', 2],
  ['TEL-YEA-T31P', 'تلفن تحت شبکه Yealink T31P', 'عدد', 5],
  ['CAB-CAT6', 'کابل شبکه Cat6', 'متر', 20],
  ['RTR-TPL-C6', 'روتر بی‌سیم TP-Link Archer C6', 'عدد', 2],
  ['USB-SAH-32', 'حافظه USB سهند، ۳۲ گیگابایت', 'عدد', 8],
  ['STAND-MON-ADJ', 'پایه نمایشگر قابل تنظیم', 'عدد', 3],
] as const;
export const legacyProductSkus = Array.from({ length: productFixtures.length }, (_, index) => `TEST-SKU-${String(index + 1).padStart(3, '0')}`);
const legacyProductNames = ['لپ‌تاپ نمونهٔ سازمانی', 'نمایشگر آزمایشی ۲۴ اینچ', 'صفحه‌کلید نمونه', 'ماوس آزمایشی', 'کاغذ اداری آزمایشی', 'کارتریج نمونه', 'صندلی اداری آزمایشی', 'تلفن سازمانی نمونه', 'کابل شبکهٔ آزمایشی', 'روتر نمونهٔ آزمایشی', 'فلش حافظهٔ آزمایشی', 'پایهٔ نمایشگر نمونه'];
const movementTypes = ['RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT'] as const;
const previousMovementNotes = ['رسید خرید تجهیزات از تأمین‌کننده آریا.', 'تحویل اقلام به واحد فناوری اطلاعات.', 'انتقال موجودی به مرکز توزیع قزوین.', 'اصلاح شمارش دوره‌ای انبار.'] as const;
const movementNotes = [
  'رسید ۱ دستگاه Lenovo ThinkPad E14 از شرکت رایان‌گستر به انبار مرکزی تهران ثبت شد.',
  'تحویل ۲ دستگاه نمایشگر Dell P2422H به اتاق کنترل واحد فناوری اطلاعات ثبت شد.',
  'انتقال ۳ صفحه‌کلید Logitech K270 از انبار مرکزی تهران به انبار مواد اولیه کرج انجام شد.',
  'پس از شمارش قفسه لوازم جانبی، موجودی ۴ ماوس Logitech M185 اصلاح شد.',
  'رسید ۵ بسته کاغذ A4 از پخش بهارستان به انبار مرکزی تهران ثبت شد.',
  'تحویل ۶ کارتریج HP 107A برای سرویس چاپگرهای واحد مالی انجام شد.',
  'انتقال ۷ صندلی ارگونومیک آریا از انبار مرکزی تهران به انبار کرج ثبت شد.',
  'موجودی ۸ تلفن Yealink T31P پس از تطبیق با صورت‌جلسه تحویل اصلاح شد.',
  'رسید ۹ متر کابل Cat6 از فروشگاه شبکه‌گستر به انبار مرکزی تهران ثبت شد.',
  'تحویل ۱۰ روتر TP-Link Archer C6 برای راه‌اندازی شبکه شعبه اصفهان انجام شد.',
  'انتقال ۱۱ حافظه USB سهند ۳۲ گیگابایتی از انبار مرکزی تهران به انبار کرج ثبت شد.',
  'شمارش موجودی ۱۲ پایه نمایشگر قابل تنظیم در قفسه تجهیزات اداری اصلاح شد.',
] as const;
export const movementReferenceNumbers = Array.from({ length: 12 }, (_, index) => `MOV-1405-${String(index + 1).padStart(3, '0')}`);

export async function seedSupply(ctx: TestDataContext): Promise<TestDataCounts> {
  const warehouses = [] as Array<{ id: string; code: string }>;
  for (let index = 0; index < warehouseFixtures.length; index += 1) {
    const [code, name, location] = warehouseFixtures[index];
    const previousNames = ['انبار آزمایشی مرکزی', 'انبار آزمایشی مواد اولیه', 'انبار آزمایشی در مسیر'];
    let warehouse = await ctx.db.warehouse.findUnique({ where: { organizationId_code: { organizationId: ctx.organizationId, code } }, select: { id: true, code: true, name: true } });
    if (!warehouse) {
      const legacy = await ctx.db.warehouse.findUnique({ where: { organizationId_code: { organizationId: ctx.organizationId, code: legacyWarehouseCodes[index] } }, select: { id: true, code: true, name: true } });
      if (legacy) warehouse = legacy.name === name || legacy.name === previousNames[index]
        ? await ctx.db.warehouse.update({ where: { id: legacy.id }, data: { code, ...(legacy.name === previousNames[index] ? { name } : {}) }, select: { id: true, code: true, name: true } })
        : legacy;
    }
    warehouse ??= await ctx.db.warehouse.create({ data: { organizationId: ctx.organizationId, code, name, location }, select: { id: true, code: true, name: true } });
    if (warehouse.name === previousNames[index]) warehouse = await ctx.db.warehouse.update({ where: { id: warehouse.id }, data: { name }, select: { id: true, code: true, name: true } });
    warehouses.push(warehouse);
  }
  const products = [] as Array<{ id: string; sku: string }>;
  for (let index = 0; index < productFixtures.length; index += 1) {
    const [sku, name, unit, minStockLevel] = productFixtures[index];
    let product = await ctx.db.product.findUnique({ where: { organizationId_sku: { organizationId: ctx.organizationId, sku } }, select: { id: true, sku: true, name: true } });
    if (!product) {
      const legacy = await ctx.db.product.findUnique({ where: { organizationId_sku: { organizationId: ctx.organizationId, sku: legacyProductSkus[index] } }, select: { id: true, sku: true, name: true } });
      if (legacy) product = legacy.name === name || legacy.name === legacyProductNames[index]
        ? await ctx.db.product.update({ where: { id: legacy.id }, data: { sku, ...(legacy.name === legacyProductNames[index] ? { name } : {}) }, select: { id: true, sku: true, name: true } })
        : legacy;
    }
    product ??= await ctx.db.product.create({ data: { organizationId: ctx.organizationId, sku, name, unit, minStockLevel }, select: { id: true, sku: true, name: true } });
    if (product.name === legacyProductNames[index]) product = await ctx.db.product.update({ where: { id: product.id }, data: { name }, select: { id: true, sku: true, name: true } });
    products.push(product);
  }

  let balanceCount = 0;
  for (let index = 0; index < products.length; index += 1) {
    for (let warehouseIndex = 0; warehouseIndex < warehouses.length; warehouseIndex += 1) {
      const quantity = ((index * 7 + warehouseIndex * 5) % 31);
      await ctx.db.inventoryBalance.upsert({
        where: { productId_warehouseId: { productId: products[index].id, warehouseId: warehouses[warehouseIndex].id } },
        create: { productId: products[index].id, warehouseId: warehouses[warehouseIndex].id, quantity },
        update: {},
      });
      balanceCount += 1;
    }
  }

  for (let index = 0; index < 12; index += 1) {
    const referenceNumber = movementReferenceNumbers[index];
    let existing = await ctx.db.inventoryMovement.findFirst({ where: { organizationId: ctx.organizationId, referenceNumber }, select: { id: true } });
    if (!existing) {
      const legacyReference = `TEST-MOV-${String(index + 1).padStart(3, '0')}`;
      const legacyMovement = await ctx.db.inventoryMovement.findFirst({ where: { organizationId: ctx.organizationId, referenceNumber: legacyReference }, select: { id: true, notes: true } });
      if (legacyMovement) {
        const previousNote = `گردش آزمایشی شمارهٔ ${index + 1} برای بررسی ثبت و پیگیری موجودی`;
        existing = previousMovementNotes.includes(legacyMovement.notes as typeof previousMovementNotes[number]) || legacyMovement.notes === previousNote
          ? await ctx.db.inventoryMovement.update({ where: { id: legacyMovement.id }, data: { referenceNumber }, select: { id: true } })
          : legacyMovement;
      }
    }
    if (existing) {
      const current = await ctx.db.inventoryMovement.findUnique({ where: { id: existing.id }, select: { notes: true } });
      const legacyNote = `گردش آزمایشی شمارهٔ ${index + 1} برای بررسی ثبت و پیگیری موجودی`;
      if (current?.notes === legacyNote || previousMovementNotes.includes(current?.notes as typeof previousMovementNotes[number])) {
        await ctx.db.inventoryMovement.update({ where: { id: existing.id }, data: { notes: movementNotes[index] } });
      }
      continue;
    }
    const type = movementTypes[index % movementTypes.length];
    await ctx.db.inventoryMovement.create({ data: {
      organizationId: ctx.organizationId,
      type,
      referenceNumber,
      fromWarehouseId: type === 'ISSUE' || type === 'TRANSFER' ? warehouses[0].id : null,
      toWarehouseId: type === 'RECEIPT' || type === 'TRANSFER' ? warehouses[type === 'TRANSFER' ? 1 : 0].id : null,
      notes: movementNotes[index],
      createdAt: fixtureDate(ctx.now, index + 1),
      items: { create: [{ productId: products[index % products.length].id, quantity: index + 1 }] },
    } });
  }
  return { warehouses: warehouses.length, products: products.length, balances: balanceCount, movements: 12 };
}
