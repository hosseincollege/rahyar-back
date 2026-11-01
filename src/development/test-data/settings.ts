import type { TestDataContext, TestDataCounts } from './context';
const provinces = [
  ['isfahan', 'اصفهان'], ['tehran', 'تهران'], ['east-azerbaijan', 'آذربایجان شرقی'], ['west-azerbaijan', 'آذربایجان غربی'],
  ['ardabil', 'اردبیل'], ['alborz', 'البرز'], ['ilam', 'ایلام'], ['bushehr', 'بوشهر'], ['charmahal-bakhtiari', 'چهارمحال و بختیاری'],
  ['south-khorasan', 'خراسان جنوبی'], ['razavi-khorasan', 'خراسان رضوی'], ['north-khorasan', 'خراسان شمالی'], ['khuzestan', 'خوزستان'],
  ['zanjan', 'زنجان'], ['semnan', 'سمنان'], ['sistan-baluchestan', 'سیستان و بلوچستان'], ['fars', 'فارس'], ['qazvin', 'قزوین'],
  ['qom', 'قم'], ['kurdistan', 'کردستان'], ['kerman', 'کرمان'], ['kermanshah', 'کرمانشاه'], ['kohgiluyeh-boyerahmad', 'کهگیلویه و بویراحمد'],
  ['golestan', 'گلستان'], ['gilan', 'گیلان'], ['lorestan', 'لرستان'], ['mazandaran', 'مازندران'], ['markazi', 'مرکزی'],
  ['hormozgan', 'هرمزگان'], ['hamadan', 'همدان'], ['yazd', 'یزد'],
] as const;
const branches = provinces.map(([provinceId, name]) => ({
  code: `DEMO-PROVINCE-${provinceId.toUpperCase()}`,
  name,
  address: name,
}));
export async function seedSettings(ctx: TestDataContext): Promise<TestDataCounts> {
  for (const { code, name, address } of branches) {
    await ctx.db.branch.upsert({
      where: { organizationId_code: { organizationId: ctx.organizationId, code } },
      create: { organizationId: ctx.organizationId, code, name, address, isMain: code === 'DEMO-PROVINCE-TEHRAN' },
      update: {},
    });
  }
  return { branches: branches.length };
}