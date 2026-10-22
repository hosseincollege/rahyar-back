import type { Prisma } from '@prisma/client';

export type TestDataContext = {
  db: Prisma.TransactionClient;
  organizationId: string;
  userId: string;
  userIds: string[];
  now: Date;
};

export type TestDataCounts = Record<string, number>;
export type TestDataAccountCredential = { name: string; username: string; email: string; password: string; province: string };
export type TestDataSeedResult = { recordCounts: TestDataCounts; accounts?: TestDataAccountCredential[] };

export function fixtureDate(now: Date, daysAgo: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  return new Date(Date.UTC(year, month - 1, day - daysAgo, 9, 0, 0, 0));
}

export function fixtureUserId(ctx: TestDataContext, index: number) {
  return ctx.userIds[index % ctx.userIds.length] ?? ctx.userId;
}

export async function ensureFixtureBranchAndDepartment(ctx: TestDataContext) {
  const branch = await ctx.db.branch.upsert({
    where: { organizationId_code: { organizationId: ctx.organizationId, code: 'DEMO-ESF' } },
    create: { organizationId: ctx.organizationId, code: 'DEMO-ESF', name: 'استان اصفهان', address: 'اصفهان' },
    update: { name: "استان اصفهان", address: "اصفهان" },
  });
  const department = await ctx.db.department.upsert({
    where: { organizationId_code: { organizationId: ctx.organizationId, code: 'DEMO-RAHCOM' } },
    create: { organizationId: ctx.organizationId, branchId: branch.id, code: 'DEMO-RAHCOM', name: 'رهکام' },
    update: { name: "رهکام" },
  });
  return { branch, department };
}

