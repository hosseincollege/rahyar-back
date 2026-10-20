import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import type { TestDataContext, TestDataSeedResult } from './context';

const provinces = [
  ['THR', 'تهران'], ['ALB', 'البرز'], ['ESF', 'اصفهان'], ['EAZ', 'آذربایجان شرقی'], ['WAZ', 'آذربایجان غربی'],
  ['ARD', 'اردبیل'], ['BUS', 'بوشهر'], ['CHB', 'چهارمحال و بختیاری'], ['SKH', 'خراسان جنوبی'], ['RKH', 'خراسان رضوی'],
  ['NKH', 'خراسان شمالی'], ['KHU', 'خوزستان'], ['ZAN', 'زنجان'], ['SEM', 'سمنان'], ['SIS', 'سیستان و بلوچستان'],
  ['FAR', 'فارس'], ['QAZ', 'قزوین'], ['QOM', 'قم'], ['KRD', 'کردستان'], ['KRM', 'کرمان'], ['KSH', 'کرمانشاه'],
  ['KBD', 'کهگیلویه و بویراحمد'], ['GIL', 'گیلان'], ['GOL', 'گلستان'], ['LOR', 'لرستان'], ['MZN', 'مازندران'],
  ['MKZ', 'مرکزی'], ['HRZ', 'هرمزگان'], ['HMD', 'همدان'], ['YAZ', 'یزد'], ['ILM', 'ایلام'],
] as const;

const firstNames = ['آرمان', 'مریم', 'نیما', 'سارا', 'امیر', 'نگار', 'رضا', 'الهام', 'کیان', 'نازنین'];
const lastNames = ['احمدی', 'رضایی', 'کریمی', 'محمدی', 'حسینی', 'جعفری', 'موسوی', 'صادقی', 'مرادی', 'قاسمی'];
const legacyDepartments = ['TEST-OPS', 'TEST-SALES', 'TEST-FIN', 'TEST-HR', 'TEST-SUPPORT'];

export async function seedSettings(ctx: TestDataContext): Promise<TestDataSeedResult> {
  await ctx.db.organizationSettings.upsert({
    where: { organizationId: ctx.organizationId },
    create: { organizationId: ctx.organizationId, accentPreset: 'blue', accentLightColor: '#60a5fa', accentDarkColor: '#3b82f6', backgroundStyle: 'GRAY', calendar: 'persian', timezone: 'Asia/Tehran' },
    update: {},
  });

  const legacyCodes = [['TEST-CENTRAL', 'THR'], ['TEST-NORTH', 'ALB'], ['TEST-SOUTH', 'ESF']] as const;
  for (const [legacyCode, provinceCode] of legacyCodes) {
    const current = await ctx.db.branch.findUnique({ where: { organizationId_code: { organizationId: ctx.organizationId, code: `IR-${provinceCode}` } }, select: { id: true } });
    if (!current) await ctx.db.branch.updateMany({ where: { organizationId: ctx.organizationId, code: legacyCode }, data: { code: `IR-${provinceCode}` } });
  }

  await ctx.db.departmentTeam.deleteMany({
    where: {
      organizationId: ctx.organizationId,
      department: { code: { in: legacyDepartments } },
      members: { none: {} },
      accountMemberships: { none: {} },
    },
  });
  await ctx.db.department.deleteMany({
    where: {
      organizationId: ctx.organizationId,
      code: { in: legacyDepartments },
      employees: { none: {} },
      accountingInvoices: { none: {} },
      memberships: { none: {} },
      teams: { none: {} },
    },
  });

  const savedBranches: Array<{ id: string; code: string; name: string }> = [];
  for (const [code, name] of provinces) {
    const branch = await ctx.db.branch.upsert({
      where: { organizationId_code: { organizationId: ctx.organizationId, code: `IR-${code}` } },
      create: { organizationId: ctx.organizationId, code: `IR-${code}`, name: `استان ${name}`, isMain: code === 'THR' },
      update: { name: `استان ${name}` },
      select: { id: true, code: true, name: true },
    });
    savedBranches.push(branch);
  }

  const role = await ctx.db.role.upsert({
    where: { key_organizationId: { key: 'USER', organizationId: ctx.organizationId } },
    create: { organizationId: ctx.organizationId, name: 'کاربر', key: 'USER', description: 'حساب کاربری نمونه', scope: 'ORGANIZATION', isSystemRole: true },
    update: {},
    select: { id: true },
  });
  const accounts: NonNullable<TestDataSeedResult['accounts']> = [];
  for (let provinceIndex = 0; provinceIndex < savedBranches.length; provinceIndex += 1) {
    const branch = savedBranches[provinceIndex];
    const provinceCode = branch.code.replace('IR-', '').toLowerCase();
    for (let accountIndex = 0; accountIndex < 2; accountIndex += 1) {
      const sequence = accountIndex + 1;
      const username = `demo_${ctx.organizationId.slice(-10).toLowerCase()}_${provinceCode}_${String(sequence).padStart(2, '0')}`;
      const firstName = firstNames[(provinceIndex * 2 + accountIndex) % firstNames.length];
      const lastName = lastNames[(provinceIndex + accountIndex * 3) % lastNames.length];
      const name = `${firstName} ${lastName}`;
      const password = `Rh-${randomBytes(12).toString('base64url')}-9a`;
      const passwordHash = await bcrypt.hash(password, 10);
      const existing = await ctx.db.user.findUnique({
        where: { username },
        select: { id: true, memberships: { where: { organizationId: ctx.organizationId }, select: { id: true } } },
      });
      if (existing && existing.memberships.length === 0) {
        throw new Error(`Test account username is already used outside this organization: ${username}`);
      }
      const user = existing
        ? await ctx.db.user.update({ where: { id: existing.id }, data: { firstName, lastName, passwordHash, status: 'ACTIVE', isSystemUser: false } })
        : await ctx.db.user.create({ data: { username, firstName, lastName, passwordHash, status: 'ACTIVE', isSystemUser: false } });
      const membership = await ctx.db.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: ctx.organizationId, userId: user.id } },
        create: { organizationId: ctx.organizationId, userId: user.id, status: 'ACTIVE', branchId: branch.id },
        update: { status: 'ACTIVE', branchId: branch.id, departmentId: null, teamId: null },
        select: { id: true },
      });
      await ctx.db.memberRole.createMany({ data: [{ memberId: membership.id, roleId: role.id }], skipDuplicates: true });
      accounts.push({ name, username, password, province: branch.name });
    }
  }

  return { recordCounts: { provinces: provinces.length, accounts: accounts.length }, accounts };
}
