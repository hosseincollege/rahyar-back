export function normalizeNationalId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalizedDigits = value
    .trim()
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
  const digitsOnly = normalizedDigits.replace(/\D/g, '');
  return digitsOnly || null;
}
