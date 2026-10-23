import type { Prisma } from '@prisma/client';

export type TestDataContext = {
  db: Prisma.TransactionClient;
  organizationId: string;
  userId: string;
  userIds: string[];
  now: Date;
};

export type TestDataCounts = Record<string, number>;
export type TestDataSeedResult = { recordCounts: TestDataCounts };

export function fixtureDate(now: Date, daysAgo: number) {
  const value = new Date(now);
  value.setUTCDate(value.getUTCDate() - daysAgo);
  value.setUTCHours(9, 0, 0, 0);
  return value;
}

export function fixtureUserId(ctx: TestDataContext, index: number) {
  return ctx.userIds[index % ctx.userIds.length] ?? ctx.userId;
}

export async function ensureFixtureBranchAndDepartment(ctx: TestDataContext) {
  const branch = await ctx.db.branch.upsert({
    where: { organizationId_code: { organizationId: ctx.organizationId, code: 'TEST-CENTRAL' } },
    create: { organizationId: ctx.organizationId, code: 'TEST-CENTRAL', name: 'شعبه مرکزی تهران', address: 'تهران، خیابان ولیعصر، پلاک ۲۴۰' },
    update: {},
  });
  const department = await ctx.db.department.upsert({
    where: { organizationId_code: { organizationId: ctx.organizationId, code: 'TEST-OPS' } },
    create: { organizationId: ctx.organizationId, branchId: branch.id, code: 'TEST-OPS', name: 'واحد عملیات و پشتیبانی' },
    update: {},
  });
  return { branch, department };
}
