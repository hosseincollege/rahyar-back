import type { TestDataContext, TestDataSeedResult } from './context';
import { fixtureDate, fixtureUserId } from './context';

export const DEMO_RAHCOM_SYSTEM_CODE_PREFIX = 'DEMO-RAHCOM-';
export const DEMO_RAHCOM_ACTIVITY_PREFIX = 'DEMO-RAHCOM |';

const systems = [
  { province: 'isfahan', systemName: 'نمونه ایستگاه چهارباغ', systemCode: 'DEMO-RAHCOM-ESF-001', latitude: 32.655, longitude: 51.667, details: 'نمونه آزمایشی برای نمایش سامانه در مرکز استان.', electricityBillId: 'DEMO-ESF-001', simIp: '192.0.2.11', radarIp: '192.0.2.12', cameraIp: '192.0.2.13', pcIp: '192.0.2.14', routerIp: '192.0.2.15', laptopIp: null },
  { province: 'isfahan', systemName: 'نمونه ایستگاه کاشان', systemCode: 'DEMO-RAHCOM-ESF-002', latitude: 33.985, longitude: 51.41, details: 'نمونه آزمایشی با اطلاعات ارتباطی کامل.', electricityBillId: 'DEMO-ESF-002', simIp: '192.0.2.21', radarIp: null, cameraIp: '192.0.2.22', pcIp: '192.0.2.23', routerIp: '192.0.2.24', laptopIp: null },
  { province: 'tehran', systemName: 'نمونه ایستگاه مرکزی تهران', systemCode: 'DEMO-RAHCOM-THR-001', latitude: 35.6892, longitude: 51.389, details: 'نمونه آزمایشی برای بررسی جست‌وجو و مسیر‌یابی.', electricityBillId: 'DEMO-THR-001', simIp: '192.0.2.31', radarIp: '192.0.2.32', cameraIp: '192.0.2.33', pcIp: null, routerIp: '192.0.2.34', laptopIp: null },
  { province: 'fars', systemName: 'نمونه ایستگاه شیراز', systemCode: 'DEMO-RAHCOM-FAR-001', latitude: 29.5918, longitude: 52.5837, details: 'نمونه آزمایشی در استان فارس.', electricityBillId: 'DEMO-FAR-001', simIp: '192.0.2.41', radarIp: null, cameraIp: '192.0.2.42', pcIp: '192.0.2.43', routerIp: '192.0.2.44', laptopIp: '192.0.2.45' },
  { province: 'khorasan-razavi', systemName: 'نمونه ایستگاه مشهد', systemCode: 'DEMO-RAHCOM-RKH-001', latitude: 36.297, longitude: 59.606, details: 'نمونه آزمایشی در استان خراسان رضوی.', electricityBillId: 'DEMO-RKH-001', simIp: '192.0.2.51', radarIp: '192.0.2.52', cameraIp: null, pcIp: '192.0.2.53', routerIp: '192.0.2.54', laptopIp: null },
  { province: 'east-azerbaijan', systemName: 'نمونه ایستگاه تبریز', systemCode: 'DEMO-RAHCOM-EAZ-001', latitude: 38.08, longitude: 46.2919, details: 'نمونه آزمایشی در استان آذربایجان شرقی.', electricityBillId: 'DEMO-EAZ-001', simIp: '192.0.2.61', radarIp: '192.0.2.62', cameraIp: '192.0.2.63', pcIp: '192.0.2.64', routerIp: null, laptopIp: null },
] as const;

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
  const savedSystems: Array<{ id: string; systemName: string; systemCode: string; province: string }> = [];
  for (const system of systems) {
    const saved = await ctx.db.rahcomSystem.upsert({
      where: { organizationId_province_systemCode: { organizationId: ctx.organizationId, province: system.province, systemCode: system.systemCode } },
      create: { organizationId: ctx.organizationId, ...system },
      update: {},
    });
    savedSystems.push(saved);
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
      update: {},
    });
  }

  return { recordCounts: { systems: systems.length, activities: activities.length } };
}
