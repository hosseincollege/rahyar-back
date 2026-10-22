import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import type { TestDataContext, TestDataSeedResult } from './context';

const branches = [
  { code: 'DEMO-THR', name: 'شعبه نمونه تهران', address: 'تهران، خیابان ولیعصر' },
  { code: 'DEMO-ESF', name: 'شعبه نمونه اصفهان', address: 'اصفهان، چهارباغ' },
  { code: 'DEMO-SHI', name: 'شعبه نمونه شیراز', address: 'شیراز، بلوار کریم‌خان' },
  { code: 'DEMO-MSH', name: 'شعبه نمونه مشهد', address: 'مشهد، خیابان احمدآباد' },
];
const departments = [
  { code: 'DEMO-OPS', name: 'عملیات و پشتیبانی' },
  { code: 'DEMO-SALES', name: 'فروش و ارتباط با مشتری' },
  { code: 'DEMO-FIN', name: 'مالی و حسابداری' },
  { code: 'DEMO-HR', name: 'منابع انسانی' },
];
const demoAccounts = [
  { key: 'ops', name: 'آرمان احمدی', branch: 0, department: 0 },
  { key: 'sales', name: 'مریم رضایی', branch: 1, department: 1 },
  { key: 'finance', name: 'نیما کریمی', branch: 2, department: 2 },
  { key: 'hr', name: 'سارا محمدی', branch: 3, department: 3 },
];

export const DEMO_SETTINGS_ACCOUNT_PREFIX = 'demo_settings_';
export const DEMO_SETTINGS_BRANCH_CODES = branches.map(({ code }) => code);
export const DEMO_SETTINGS_DEPARTMENT_CODES = departments.map(({ code }) => code);

export async function seedSettings(ctx: TestDataContext): Promise<TestDataSeedResult> {
  const savedBranches: Array<{ id: string }> = [];
  for (const [index, branch] of branches.entries()) {
    savedBranches.push(await ctx.db.branch.upsert({
      where: { organizationId_code: { organizationId: ctx.organizationId, code: branch.code } },
      create: { organizationId: ctx.organizationId, ...branch, isMain: index === 0 },
      update: {},
      select: { id: true },
    }));
  }
  const savedDepartments: Array<{ id: string }> = [];
  for (const [index, department] of departments.entries()) {
    savedDepartments.push(await ctx.db.department.upsert({
      where: { organizationId_code: { organizationId: ctx.organizationId, code: department.code } },
      create: { organizationId: ctx.organizationId, branchId: savedBranches[index].id, ...department },
      update: {},
      select: { id: true },
    }));
  }
  for (const [index, department] of departments.entries()) {
    await ctx.db.departmentTeam.upsert({
      where: { departmentId_code: { departmentId: savedDepartments[index].id, code: 'DEMO-TEAM' } },
      create: { organizationId: ctx.organizationId, departmentId: savedDepartments[index].id, code: 'DEMO-TEAM', name: `تیم نمونه ${department.name}` },
      update: {},
    });
  }
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
        if (!currentMembership.branchId || !currentMembership.departmentId) {
          await ctx.db.organizationMember.update({ where: { id: currentMembership.id }, data: { branchId: savedBranches[account.branch].id, departmentId: savedDepartments[account.department].id } });
        }
      } else {
        const membership = await ctx.db.organizationMember.create({
          data: { organizationId: ctx.organizationId, userId, status: 'ACTIVE', branchId: savedBranches[account.branch].id, departmentId: savedDepartments[account.department].id },
        });
        membershipId = membership.id;
      }
    } else {
      password = `Rh-${randomBytes(12).toString('base64url')}-9a`;
      const user = await ctx.db.user.create({ data: { username, email, firstName: account.name.split(' ')[0], lastName: account.name.split(' ')[1], passwordHash: await bcrypt.hash(password, 10), status: 'ACTIVE', isSystemUser: false }, select: { id: true } });
      userId = user.id;
      const membership = await ctx.db.organizationMember.create({ data: { organizationId: ctx.organizationId, userId, status: 'ACTIVE', branchId: savedBranches[account.branch].id, departmentId: savedDepartments[account.department].id } });
      membershipId = membership.id;
    }
    await ctx.db.memberRole.deleteMany({ where: { memberId: membershipId, roleId: { not: role.id } } });
    await ctx.db.memberRole.createMany({ data: [{ memberId: membershipId, roleId: role.id }], skipDuplicates: true });
    await ctx.db.userPreference.upsert({ where: { userId }, create: { userId, locale: 'fa', calendar: 'persian' }, update: {} });
    if (password) accounts.push({ name: account.name, username, email, password, province: branches[account.branch].name });
  }
  return { recordCounts: { branches: branches.length, departments: departments.length, teams: departments.length, accounts: demoAccounts.length, preferences: demoAccounts.length }, ...(accounts.length ? { accounts } : {}) };
}
