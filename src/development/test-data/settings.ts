import * as bcrypt from 'bcrypt';
import { ConflictException } from '@nestjs/common';
import type { TestDataContext, TestDataCounts } from './context';

const provinces = [
  ['isfahan', 'اصفهان', 'ESF'], ['tehran', 'تهران', 'THR'], ['east-azerbaijan', 'آذربایجان شرقی', 'AZE'], ['west-azerbaijan', 'آذربایجان غربی', 'AZW'],
  ['ardabil', 'اردبیل', 'ARD'], ['alborz', 'البرز', 'ALB'], ['ilam', 'ایلام', 'ILA'], ['bushehr', 'بوشهر', 'BUS'], ['charmahal-bakhtiari', 'چهارمحال و بختیاری', 'CHB'],
  ['south-khorasan', 'خراسان جنوبی', 'KHS'], ['razavi-khorasan', 'خراسان رضوی', 'KHR'], ['north-khorasan', 'خراسان شمالی', 'KHN'], ['khuzestan', 'خوزستان', 'KHZ'],
  ['zanjan', 'زنجان', 'ZAN'], ['semnan', 'سمنان', 'SEM'], ['sistan-baluchestan', 'سیستان و بلوچستان', 'SIB'], ['fars', 'فارس', 'FAR'], ['qazvin', 'قزوین', 'QAZ'],
  ['qom', 'قم', 'QOM'], ['kurdistan', 'کردستان', 'KOR'], ['kerman', 'کرمان', 'KER'], ['kermanshah', 'کرمانشاه', 'KSH'], ['kohgiluyeh-boyerahmad', 'کهگیلویه و بویراحمد', 'KOB'],
  ['golestan', 'گلستان', 'GOL'], ['gilan', 'گیلان', 'GIL'], ['lorestan', 'لرستان', 'LOR'], ['mazandaran', 'مازندران', 'MAZ'], ['markazi', 'مرکزی', 'MRK'],
  ['hormozgan', 'هرمزگان', 'HOR'], ['hamadan', 'همدان', 'HAM'], ['yazd', 'یزد', 'YAZ'],
] as const;

const previousProvinceUsernames: Partial<Record<(typeof provinces)[number][0], string>> = {
  tehran: 'TAH',
  'east-azerbaijan': 'EAZ',
  'west-azerbaijan': 'WAZ',
  'south-khorasan': 'SKH',
  'razavi-khorasan': 'RKH',
  'north-khorasan': 'NKH',
  khuzestan: 'KHU',
  kurdistan: 'KUR',
  kermanshah: 'KRH',
  'kohgiluyeh-boyerahmad': 'KBY',
  markazi: 'MAR',
};

export async function seedSettings(ctx: TestDataContext): Promise<TestDataCounts> {
  for (const [provinceId, name, username] of provinces) {
    const branchCode = `DEMO-PROVINCE-${provinceId.toUpperCase()}`;
    await ctx.db.branch.upsert({
      where: { organizationId_code: { organizationId: ctx.organizationId, code: branchCode } },
      create: { organizationId: ctx.organizationId, code: branchCode, name, address: name, isMain: provinceId === 'tehran' },
      update: {},
    });

    const email = `${username.toLowerCase()}@test.rahyar.local`;
    const previousUsername = previousProvinceUsernames[provinceId];
    if (previousUsername) {
      const previousUser = await ctx.db.user.findUnique({ where: { username: previousUsername } });
      if (previousUser) {
        if (previousUser.email !== `${previousUsername.toLowerCase()}@test.rahyar.local`) {
          throw new ConflictException(`Cannot rename province account ${previousUsername}: it does not match the generated account.`);
        }
        const renamedAccount = await ctx.db.user.findUnique({ where: { username } });
        if (renamedAccount && renamedAccount.id !== previousUser.id) {
          throw new ConflictException(`Cannot rename province account ${previousUsername}: ${username} is already in use.`);
        }
        await ctx.db.user.update({
          where: { id: previousUser.id },
          data: { username, email, passwordHash: await bcrypt.hash(username, 12) },
        });
      }
    }
    const existing = await ctx.db.user.findUnique({ where: { username } });
    if (existing && existing.email !== email) {
      throw new ConflictException(`Cannot create province account ${username}: the username is already in use.`);
    }

    const user = existing ?? await ctx.db.user.create({
      data: {
        username,
        email,
        firstName: name,
        lastName: 'Rahcom',
        passwordHash: await bcrypt.hash(username, 12),
        status: 'ACTIVE',
      },
    });

    await ctx.db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: ctx.organizationId, userId: user.id } },
      create: {
        organizationId: ctx.organizationId,
        userId: user.id,
        status: 'ACTIVE',
        rahcomProvince: provinceId,
        rahcomSelectedProvince: provinceId,
      },
      update: {
        status: 'ACTIVE',
        rahcomProvince: provinceId,
        rahcomSelectedProvince: provinceId,
      },
    });
  }

  const demoEmail = 'demo@test.rahyar.local';
  const existingDemo = await ctx.db.user.findUnique({ where: { username: 'demo' } });
  if (existingDemo && existingDemo.email !== demoEmail) {
    throw new ConflictException('Cannot create the demo account: the username is already in use.');
  }
  const demoPasswordHash = await bcrypt.hash('demo', 12);
  const demoUser = existingDemo
    ? await ctx.db.user.update({ where: { id: existingDemo.id }, data: { firstName: 'Demo', lastName: 'Rahcom', passwordHash: demoPasswordHash, status: 'ACTIVE' } })
    : await ctx.db.user.create({
      data: { username: 'demo', email: demoEmail, firstName: 'Demo', lastName: 'Rahcom', passwordHash: demoPasswordHash, status: 'ACTIVE' },
    });
  const viewerRole = await ctx.db.role.upsert({
    where: { key_organizationId: { key: 'RAHCOM_VIEWER', organizationId: ctx.organizationId } },
    create: { key: 'RAHCOM_VIEWER', name: 'Rahcom Viewer', description: 'Read-only Rahcom access across provinces', organizationId: ctx.organizationId },
    update: { name: 'Rahcom Viewer', description: 'Read-only Rahcom access across provinces' },
  });
  const demoMembership = await ctx.db.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: ctx.organizationId, userId: demoUser.id } },
    create: { organizationId: ctx.organizationId, userId: demoUser.id, status: 'ACTIVE', rahcomProvince: null, rahcomSelectedProvince: 'all' },
    update: { status: 'ACTIVE', rahcomProvince: null, rahcomSelectedProvince: 'all' },
  });
  await ctx.db.memberRole.deleteMany({ where: { memberId: demoMembership.id } });
  await ctx.db.memberRole.create({ data: { memberId: demoMembership.id, roleId: viewerRole.id } });

  return { branches: provinces.length, accounts: provinces.length + 1 };
}
