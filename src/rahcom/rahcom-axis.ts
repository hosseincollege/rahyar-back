export const defaultIsfahanAxes = [
  'محور شهرضا و سمیرم',
  'محور نائین و خور و بیابانک',
  'محور اردستان',
  'محور اصفهان و مرکزی',
  'محور نطنز و کاشان',
  'محور تیران و فریدون‌شهر',
  'محور گلپایگان و داران',
  'محور میمه',
] as const;

const provinceLabels: Record<string, string[]> = {
  isfahan: ['اصفهان'], tehran: ['تهران'], 'east-azerbaijan': ['آذربایجان شرقی'], 'west-azerbaijan': ['آذربایجان غربی'],
  ardabil: ['اردبیل'], alborz: ['البرز'], ilam: ['ایلام'], bushehr: ['بوشهر'], 'charmahal-bakhtiari': ['چهارمحال و بختیاری'],
  'south-khorasan': ['خراسان جنوبی'], 'razavi-khorasan': ['خراسان رضوی'], 'north-khorasan': ['خراسان شمالی'], khuzestan: ['خوزستان'],
  zanjan: ['زنجان'], semnan: ['سمنان'], 'sistan-baluchestan': ['سیستان و بلوچستان', 'سيستان و بلوچستان'], fars: ['فارس'], qazvin: ['قزوین', 'قزوين'],
  qom: ['قم'], kurdistan: ['کردستان'], kerman: ['کرمان', 'کرمان جنوب'], kermanshah: ['کرمانشاه'], 'kohgiluyeh-boyerahmad': ['کهگیلویه و بویراحمد'],
  golestan: ['گلستان'], gilan: ['گیلان'], lorestan: ['لرستان'], mazandaran: ['مازندران'], markazi: ['مرکزی'], hormozgan: ['هرمزگان'],
  hamadan: ['همدان'], yazd: ['یزد'],
};

const normalizeProvinceLabel = (value: string) => value.trim().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\s\-]/g, '');
const provinceIdsByLabel = new Map(Object.entries(provinceLabels).flatMap(([id, labels]) => labels.map((label) => [normalizeProvinceLabel(label), id] as const)));

export function rahcomProvinceIdFromLabel(value: string) {
  return provinceIdsByLabel.get(normalizeProvinceLabel(value)) ?? null;
}

const normalize = (value: string) => value.toLocaleLowerCase('fa').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\s\-–—_،؛,.]/g, '');
const includesAny = (value: string, parts: string[]) => parts.some((part) => value.includes(normalize(part)));

export function canonicalRahcomAxisForProvince(province: string, axis: string | null | undefined) {
  const value = (axis ?? '').trim();
  if (!value || province !== 'isfahan') return value;
  if ((defaultIsfahanAxes as readonly string[]).includes(value)) return value;
  const text = normalize(value);

  if (includesAny(text, ['قم-کاشان-نائین', 'اصفهان-قم-دلیجان', 'قم-اصفهان', 'اصفهان-قم', 'دلیجان-اصفهان', 'دلیجان اصفهان', 'نطنز', 'کاشان'])) return defaultIsfahanAxes[4];
  if (includesAny(text, ['شهرضا', 'سمیرم', 'آباده', 'صفاشهر', 'میمند'])) return defaultIsfahanAxes[0];
  if (includesAny(text, ['نائین', 'نایین', 'انارک', 'خور', 'طبس', 'یزد', 'نوگنبد', 'اردستان-نائین', 'نائین-اردستان', 'ترانزیت ۷۱'])) return defaultIsfahanAxes[1];
  if (includesAny(text, ['حبیب‌آباد', 'حبیب آباد', 'کمشه', 'اردستان', 'مهاباد'])) return defaultIsfahanAxes[2];
  if (includesAny(text, ['فرودگاه', 'قهجاورستان', 'نجف‌آباد فولادشهر', 'نجف آباد فولادشهر', 'فولادشهر-شهرکرد', 'تیران-سامان-شهرکرد', 'آزادراه شهید کاظمی'])) return defaultIsfahanAxes[3];
  if (includesAny(text, ['نجف‌آباد-الیگودرز', 'نجف آباد-الیگودرز', 'تیران', 'داران-بویین', 'بویین'])) return defaultIsfahanAxes[5];
  if (includesAny(text, ['موته', 'میمه'])) return defaultIsfahanAxes[7];
  if (includesAny(text, ['دامنه-خوانسار-خمین', 'خوانسار', 'گلپایگان', 'خمین'])) return defaultIsfahanAxes[6];
  return value;
}
