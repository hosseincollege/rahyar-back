import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import type { TestDataContext, TestDataSeedResult } from './context';

const branches = [
  { code: 'DEMO-ESF', name: 'استان اصفهان', address: 'اصفهان' },
];
const department = { code: 'DEMO-RAHCOM', name: 'رهکام' };
const legacyDepartmentCodes = ['DEMO-OPS', 'DEMO-SALES', 'DEMO-FIN', 'DEMO-HR'];
const demoAccounts = [
  { key: 'ops', name: 'آرمان احمدی', branch: 0 },
  { key: 'sales', name: 'مریم رضایی', branch: 0 },
  { key: 'finance', name: 'نیما کریمی', branch: 0 },
  { key: 'hr', name: 'سارا محمدی', branch: 0 },
];

export const DEMO_SETTINGS_ACCOUNT_PREFIX = 'demo_settings_';
export const DEMO_SETTINGS_BRANCH_CODES = branches.map(({ code }) => code);
export const DEMO_SETTINGS_DEPARTMENT_CODES = [department.code, ...legacyDepartmentCodes];

export async function seedSettings(ctx: TestDataContext): Promise<TestDataSeedResult> {
  const savedBranches: Array<{ id: string }> = [];
  for (const [index, branch] of branches.entries()) {
    savedBranches.push(await ctx.db.branch.upsert({
      where: { organizationId_code: { organizationId: ctx.organizationId, code: branch.code } },
      create: { organizationId: ctx.organizationId, ...branch, isMain: true },
      update: { name: branch.name, address: branch.address, isMain: true },
      select: { id: true },
    }));
  }
  const rahcomDepartment = await ctx.db.department.upsert({
    where: { organizationId_code: { organizationId: ctx.organizationId, code: department.code } },
    create: { organizationId: ctx.organizationId, branchId: savedBranches[0].id, ...department },
    update: { branchId: savedBranches[0].id, name: department.name },
    select: { id: true },
  });
  const role = await ctx.db.role.upsert({
    where: { key_organizationId: { key: 'DEMO_USER', organizationId: ctx.organizationId } },
    create: { organizationId: ctx.organizationId, name: 'کاربر نمونه', key: 'DEMO_USER', description: 'نقش کم‌دسترسی برای حساب‌های نمایشی', scope: 'ORGANIZATION', isSystemRole: false },
    update: {},
    select: { id: true },
  });
  const permissions = await Promise.all([
    ctx.db.permission.upsert({ where: { key: 'settings.read' }, create: { key: 'settings.read', name: 'مشاهده تنظیمات سازمان' }, update: {}, select: { id: true } }),
    ctx.db.permission.upsert({ where: { key: 'rahcom.write' }, create: { key: 'rahcom.write', name: 'مدیریت اطلاعات رهکام' }, update: {}, select: { id: true } }),
  ]);
  await ctx.db.rolePermission.deleteMany({ where: { roleId: role.id } });
  await ctx.db.rolePermission.createMany({ data: permissions.map(({ id }) => ({ roleId: role.id, permissionId: id })), skipDuplicates: true });
  const accounts: NonNullable<TestDataSeedResult['accounts']> = [];
  for (const account of demoAccounts) {
    const username = `${DEMO_SETTINGS_ACCOUNT_PREFIX}${ctx.organizationId.slice(-8).toLowerCase()}_${account.key}`;
    const email = `${username}@demo.invalid`;
    const existing = await ctx.db.user.findUnique({ where: { username }, select: { id: true, email: true, memberships: { where: { organizationId: ctx.organizationId }, select: { id: true, branchId: true, departmentId: true } } } });
    if (existing && existing.memberships.length === 0 && existing.email !== email) {
      throw new Error(`Demo account username is already used outside this organization: ${username}`);
    }
    let userId: string;
    let membershipId: string;
    let password: string | undefined;
    if (existing) {
      userId = existing.id;
      if (!existing.email) await ctx.db.user.update({ where: { id: existing.id }, data: { email } });
      const currentMembership = existing.memberships[0];
      if (currentMembership) {
        membershipId = currentMembership.id;
        await ctx.db.organizationMember.update({ where: { id: currentMembership.id }, data: { branchId: savedBranches[account.branch].id, departmentId: rahcomDepartment.id, teamId: null } });
      } else {
        const membership = await ctx.db.organizationMember.create({
          data: { organizationId: ctx.organizationId, userId, status: 'ACTIVE', branchId: savedBranches[account.branch].id, departmentId: rahcomDepartment.id },
        });
        membershipId = membership.id;
      }
    } else {
      password = `Rh-${randomBytes(12).toString('base64url')}-9a`;
      const user = await ctx.db.user.create({ data: { username, email, firstName: account.name.split(' ')[0], lastName: account.name.split(' ')[1], passwordHash: await bcrypt.hash(password, 10), status: 'ACTIVE', isSystemUser: false }, select: { id: true } });
      userId = user.id;
      const membership = await ctx.db.organizationMember.create({ data: { organizationId: ctx.organizationId, userId, status: 'ACTIVE', branchId: savedBranches[account.branch].id, departmentId: rahcomDepartment.id } });
      membershipId = membership.id;
    }
    await ctx.db.memberRole.deleteMany({ where: { memberId: membershipId, roleId: { not: role.id } } });
    await ctx.db.memberRole.createMany({ data: [{ memberId: membershipId, roleId: role.id }], skipDuplicates: true });
    await ctx.db.userPreference.upsert({ where: { userId }, create: { userId, locale: 'fa', calendar: 'persian' }, update: {} });
    if (password) accounts.push({ name: account.name, username, email, password, province: branches[account.branch].name });
  }
  const legacyDepartments = await ctx.db.department.findMany({ where: { organizationId: ctx.organizationId, code: { in: legacyDepartmentCodes } }, select: { id: true } });
  const legacyDepartmentIds = legacyDepartments.map(({ id }) => id);
  if (legacyDepartmentIds.length) {
    await ctx.db.organizationMember.updateMany({ where: { organizationId: ctx.organizationId, departmentId: { in: legacyDepartmentIds } }, data: { departmentId: rahcomDepartment.id, teamId: null } });
    await ctx.db.employee.updateMany({ where: { organizationId: ctx.organizationId, departmentId: { in: legacyDepartmentIds } }, data: { departmentId: rahcomDepartment.id } });
    await ctx.db.accountingInvoice.updateMany({ where: { organizationId: ctx.organizationId, departmentId: { in: legacyDepartmentIds } }, data: { departmentId: rahcomDepartment.id } });
    await ctx.db.departmentTeam.deleteMany({ where: { organizationId: ctx.organizationId, departmentId: { in: legacyDepartmentIds } } });
    await ctx.db.department.deleteMany({ where: { organizationId: ctx.organizationId, id: { in: legacyDepartmentIds } } });
  }
  const legacyBranches = await ctx.db.branch.findMany({
    where: { organizationId: ctx.organizationId, code: { in: ['DEMO-THR', 'DEMO-SHI', 'DEMO-MSH'] } },
    select: { id: true },
  });
  const legacyBranchIds = legacyBranches.map(({ id }) => id);
  if (legacyBranchIds.length) {
    const mainBranchId = savedBranches[0].id;
    await ctx.db.organizationMember.updateMany({ where: { organizationId: ctx.organizationId, branchId: { in: legacyBranchIds } }, data: { branchId: mainBranchId } });
    await ctx.db.employee.updateMany({ where: { organizationId: ctx.organizationId, branchId: { in: legacyBranchIds } }, data: { branchId: mainBranchId } });
    await ctx.db.accountingInvoice.updateMany({ where: { organizationId: ctx.organizationId, branchId: { in: legacyBranchIds } }, data: { branchId: mainBranchId } });
    await ctx.db.announcement.updateMany({ where: { organizationId: ctx.organizationId, branchId: { in: legacyBranchIds } }, data: { branchId: mainBranchId } });
    await ctx.db.department.updateMany({ where: { organizationId: ctx.organizationId, branchId: { in: legacyBranchIds } }, data: { branchId: mainBranchId } });
    await ctx.db.branch.deleteMany({ where: { organizationId: ctx.organizationId, id: { in: legacyBranchIds } } });
  }
  return { recordCounts: { branches: branches.length, departments: 1, teams: 0, accounts: demoAccounts.length, preferences: demoAccounts.length }, ...(accounts.length ? { accounts } : {}) };
}
