import type { TestDataContext, TestDataSeedResult } from './context';
import { fixtureDate, fixtureUserId } from './context';
import { rahcomSystems } from './rahcom-systems';

function canonicalTestAxis(axis: string | null | undefined, latitude: number, longitude: number) {
  const value = (axis ?? '').trim();
  const text = value.toLocaleLowerCase('fa').replace(/[\u200c\s\-–—_]/g, '');
  const has = (...parts: string[]) => parts.some((part) => text.includes(part.toLocaleLowerCase('fa').replace(/[\u200c\s\-–—_]/g, '')));
  if (has('شهرضا-سمیرم', 'شهرضا-آباده', 'اصفهان-صفاشهر', 'صفاشهر')) return 'محور شهرضا، سمیرم و آباده';
  if (has('نائین-اردستان', 'اردستان-نائین')) return 'ترانزیت ۷۱؛ نائین و اردستان';
  if (has('اصفهان-فرودگاه', 'قهجاورستان')) return 'محور اصفهان، فرودگاه و قهجاورستان';
  if (has('حبیبآباد-اردستان', 'حبیب آباد-اردستان')) return 'محور حبیب‌آباد، کمشچه، اردستان و کاشان';
  if (has('قم-اصفهان', 'اصفهان-قم1', 'آزادراه امیرکبیر')) return 'آزادراه امیرکبیر';
  if (has('قم-کاشان-نائین')) return 'جاده قدیم قم، کاشان و نائین';
  if (has('اصفهان-نایین', 'اصفهان-نائین', 'نایین-انارک-خور', 'خور-طبس', 'یزد-نوگنبد')) return 'محور نائین، خور و بیابانک و یزد';
  if (has('اصفهان-قم-دلیجان', 'دلیجان-اصفهان', 'دلیجان اصفهان')) return 'محور شاهین‌شهر، نطنز، کاشان و قم';
  if (has('موته-گلپایگان', 'میمه-موته-گلپایگان', 'آزادراه شهید کاظمی')) return 'محور شاهین‌شهر، میمه و گلپایگان';
  if (has('نجف آباد فولادشهر', 'نجفآبادفولادشهر')) return 'محور شاهین‌شهر، نجف‌آباد و فولادشهر';
  if (has('فولادشهر-شهرکرد', 'تیران-سامان-شهرکرد')) return 'محور فولادشهر و شهرکرد';
  if (has('دامنه-خوانسار-خمین')) return 'محور نجف‌آباد، تیران، خوانسار و خمین';
  if (has('نجف آباد-الیگودرز', 'نجفآباد-الیگودرز')) {
    if (latitude < 32.75 && longitude > 50.7) return 'محور نجف‌آباد، تیران، خوانسار و خمین';
    return 'محور داران، بویین‌میاندشت و الیگودرز';
  }
  if (has('اصفهان-قم', 'قم-اصفهان')) return 'آزادراه امیرکبیر';
  if (has('کاشان')) return 'جاده قدیم قم، کاشان و نائین';
  if (has('سمیرم')) return 'محور شهرضا، سمیرم و آباده';
  if (has('نائین', 'نایین', 'خور', 'انارک', 'اردستان', 'یزد', 'نوگنبد')) return 'محور نائین، خور و بیابانک و یزد';
  if (has('گلپایگان', 'خوانسار', 'خمین', 'الیگودرز', 'داران')) return 'محور نجف‌آباد، تیران، خوانسار و خمین';
  if (has('شهرکرد')) return 'محور فولادشهر و شهرکرد';
  return value || null;
}

const systems = rahcomSystems.map((system) => ({
  ...system,
  axis: canonicalTestAxis(system.axis, system.latitude, system.longitude),
}));
export const DEMO_RAHCOM_SYSTEM_CODE_PREFIX = 'DEMO-RAHCOM-';
export const DEMO_RAHCOM_ACTIVITY_PREFIX = 'DEMO-RAHCOM |';
export const DEMO_RAHCOM_SYSTEM_CODES = systems.map(({ systemCode }) => systemCode);
const activities = [
  { key: 'visit-esf-1', systemIndex: 0, daysAgo: 0, description: 'بازدید برنامه‌ریزی‌شده؛ وضعیت برق و ارتباط شبکه بررسی شد.', accompaniedBy: 'کارشناس برق', handedOverTo: 'مسئول شیفت' },
  { key: 'visit-esf-2', systemIndex: 1, daysAgo: 1, description: 'تنظیم مجدد تجهیزات ارتباطی و ثبت نتیجهٔ آزمون اتصال.', accompaniedBy: 'کارشناس شبکه', handedOverTo: null },
  { key: 'visit-thr-1', systemIndex: 2, daysAgo: 2, description: 'بازدید دوره‌ای و بررسی سلامت دوربین‌ها.', accompaniedBy: null, handedOverTo: 'مرکز پایش' },
  { key: 'visit-far-1', systemIndex: 3, daysAgo: 4, description: 'تعویض کابل معیوب و آزمون مجدد تجهیزات.', accompaniedBy: 'کارشناس نگهداری', handedOverTo: null },
  { key: 'visit-rkh-1', systemIndex: 4, daysAgo: 7, description: 'بازدید میدانی؛ موردی برای پیگیری ثبت نشد.', accompaniedBy: null, handedOverTo: null },
  { key: 'email-1', systemIndex: null, daysAgo: 0, activityType: 'EMAIL_SENT', quantity: 12, description: 'ارسال گزارش روزانه برای واحدهای منطقه‌ای.' },
  { key: 'email-2', systemIndex: null, daysAgo: 1, activityType: 'EMAIL_SENT', quantity: 8, description: 'ارسال برنامهٔ بازدیدهای هفتگی.' },
  { key: 'other-1', systemIndex: null, daysAgo: 2, activityType: 'OTHER', quantity: 3, description: 'ثبت سه درخواست پیگیری تجهیزات.' },
] as const;

export async function seedRahcom(ctx: TestDataContext): Promise<TestDataSeedResult> {
  const legacySystems = await ctx.db.rahcomSystem.findMany({
    where: { organizationId: ctx.organizationId, systemCode: { startsWith: DEMO_RAHCOM_SYSTEM_CODE_PREFIX } },
    orderBy: { systemCode: 'asc' },
    select: { id: true, systemCode: true },
  });
  const savedSystems: Array<{ id: string; systemName: string; systemCode: string; province: string }> = [];
  const reusedLegacyIds = new Set<string>();
  for (const [index, system] of systems.entries()) {
    const existing = await ctx.db.rahcomSystem.findUnique({
      where: { organizationId_province_systemCode: { organizationId: ctx.organizationId, province: system.province, systemCode: system.systemCode } },
    });
    const legacy = legacySystems[index];
    if (existing) {
      const refreshed = await ctx.db.rahcomSystem.update({
        where: { id: existing.id },
        data: {
          systemName: system.systemName,
          axis: system.axis,
          latitude: system.latitude,
          longitude: system.longitude,
        },
      });
      if (legacy && legacy.id !== existing.id) {
        await ctx.db.rahcomActivity.updateMany({
          where: { organizationId: ctx.organizationId, systemId: legacy.id },
          data: { systemId: refreshed.id, systemNameSnapshot: refreshed.systemName, systemCodeSnapshot: refreshed.systemCode, provinceSnapshot: refreshed.province },
        });
        await ctx.db.rahcomSystem.delete({ where: { id: legacy.id } });
        reusedLegacyIds.add(legacy.id);
      }
      savedSystems.push(refreshed);
    } else if (legacy) {
      const updated = await ctx.db.rahcomSystem.update({ where: { id: legacy.id }, data: system });
      reusedLegacyIds.add(legacy.id);
      savedSystems.push(updated);
    } else {
      const created = await ctx.db.rahcomSystem.create({ data: { organizationId: ctx.organizationId, ...system } });
      savedSystems.push(created);
    }
  }
  for (const legacy of legacySystems) {
    if (reusedLegacyIds.has(legacy.id)) continue;
    const linkedActivities = await ctx.db.rahcomActivity.count({ where: { organizationId: ctx.organizationId, systemId: legacy.id } });
    if (linkedActivities === 0) await ctx.db.rahcomSystem.delete({ where: { id: legacy.id } });
  }

  for (let index = 0; index < activities.length; index += 1) {
    const item = activities[index];
    const system = item.systemIndex === null ? null : savedSystems[item.systemIndex];
    const description = `${DEMO_RAHCOM_ACTIVITY_PREFIX} ${item.description}`;
    const record = {
      organizationId: ctx.organizationId,
      createdById: fixtureUserId(ctx, index),
      systemId: system?.id ?? null,
      systemNameSnapshot: system?.systemName ?? null,
      systemCodeSnapshot: system?.systemCode ?? null,
      provinceSnapshot: system?.province ?? null,
      activityDate: fixtureDate(ctx.now, item.daysAgo),
      activityType: 'activityType' in item ? item.activityType : 'SYSTEM_VISIT',
      quantity: 'quantity' in item ? item.quantity : 1,
      description,
      accompaniedBy: 'accompaniedBy' in item ? item.accompaniedBy : null,
      handedOverTo: 'handedOverTo' in item ? item.handedOverTo : null,
      performedBy: 'ثبت آزمایشی رهکام',
      createdAt: fixtureDate(ctx.now, item.daysAgo),
    };
    await ctx.db.rahcomActivity.upsert({
      where: { id: `demo-rahcom-${ctx.organizationId}-${item.key}` },
      create: { id: `demo-rahcom-${ctx.organizationId}-${item.key}`, ...record },
      update: record,
    });
  }

  return { recordCounts: { systems: systems.length, activities: activities.length } };
}
