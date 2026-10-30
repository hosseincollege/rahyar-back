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
  isfahan: ['\u0627\u0635\u0641\u0647\u0627\u0646'], tehran: ['\u062a\u0647\u0631\u0627\u0646'], 'east-azerbaijan': ['\u0622\u0630\u0631\u0628\u0627\u06cc\u062c\u0627\u0646 \u0634\u0631\u0642\u06cc'], 'west-azerbaijan': ['\u0622\u0630\u0631\u0628\u0627\u06cc\u062c\u0627\u0646 \u063a\u0631\u0628\u06cc'],
  ardabil: ['\u0627\u0631\u062f\u0628\u06cc\u0644'], alborz: ['\u0627\u0644\u0628\u0631\u0632'], ilam: ['\u0627\u06cc\u0644\u0627\u0645'], bushehr: ['\u0628\u0648\u0634\u0647\u0631'], 'charmahal-bakhtiari': ['\u0686\u0647\u0627\u0631\u0645\u062d\u0627\u0644 \u0648 \u0628\u062e\u062a\u06cc\u0627\u0631\u06cc'],
  'south-khorasan': ['\u062e\u0631\u0627\u0633\u0627\u0646 \u062c\u0646\u0648\u0628\u06cc'], 'razavi-khorasan': ['\u062e\u0631\u0627\u0633\u0627\u0646 \u0631\u0636\u0648\u06cc'], 'north-khorasan': ['\u062e\u0631\u0627\u0633\u0627\u0646 \u0634\u0645\u0627\u0644\u06cc'], khuzestan: ['\u062e\u0648\u0632\u0633\u062a\u0627\u0646'],
  zanjan: ['\u0632\u0646\u062c\u0627\u0646'], semnan: ['\u0633\u0645\u0646\u0627\u0646'], 'sistan-baluchestan': ['\u0633\u06cc\u0633\u062a\u0627\u0646 \u0648 \u0628\u0644\u0648\u0686\u0633\u062a\u0627\u0646', '\u0633\u064a\u0633\u062a\u0627\u0646 \u0648 \u0628\u0644\u0648\u0686\u0633\u062a\u0627\u0646'], fars: ['\u0641\u0627\u0631\u0633'], qazvin: ['\u0642\u0632\u0648\u06cc\u0646', '\u0642\u0632\u0648\u064a\u0646'],
  qom: ['\u0642\u0645'], kurdistan: ['\u06a9\u0631\u062f\u0633\u062a\u0627\u0646'], kerman: ['\u06a9\u0631\u0645\u0627\u0646', '\u06a9\u0631\u0645\u0627\u0646 \u062c\u0646\u0648\u0628'], kermanshah: ['\u06a9\u0631\u0645\u0627\u0646\u0634\u0627\u0647'], 'kohgiluyeh-boyerahmad': ['\u06a9\u0647\u06af\u06cc\u0644\u0648\u06cc\u0647 \u0648 \u0628\u0648\u06cc\u0631\u0627\u062d\u0645\u062f'],
  golestan: ['\u06af\u0644\u0633\u062a\u0627\u0646'], gilan: ['\u06af\u06cc\u0644\u0627\u0646'], lorestan: ['\u0644\u0631\u0633\u062a\u0627\u0646'], mazandaran: ['\u0645\u0627\u0632\u0646\u062f\u0631\u0627\u0646'], markazi: ['\u0645\u0631\u06a9\u0632\u06cc'], hormozgan: ['\u0647\u0631\u0645\u0632\u06af\u0627\u0646'],
  hamadan: ['\u0647\u0645\u062f\u0627\u0646'], yazd: ['\u06cc\u0632\u062f'],
};

const normalizeProvinceLabel = (value: string) => value.trim().replace(/^\u0627\u0633\u062a\u0627\u0646\s*/, '').replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\u200c\s\-]/g, '');
const provinceIdsByLabel = new Map(Object.entries(provinceLabels).flatMap(([id, labels]) => labels.map((label) => [normalizeProvinceLabel(label), id] as const)));

export function rahcomProvinceIdFromLabel(value: string) {
  return provinceIdsByLabel.get(normalizeProvinceLabel(value)) ?? null;
}

export function isRahcomProvinceId(value: string) {
  return Object.prototype.hasOwnProperty.call(provinceLabels, value);
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
