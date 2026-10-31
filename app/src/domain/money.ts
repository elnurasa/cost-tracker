import type { Currency, Minor } from './types';

const EXP: Record<string, number> = { JPY: 0, KRW: 0, VND: 0, CLP: 0, ISK: 0, UGX: 0, PYG: 0, KWD: 3, BHD: 3, OMR: 3, JOD: 3, TND: 3 };
export const currencyExponent = (c: Currency): number => EXP[c] ?? 2;
export const pow10 = (e: number) => 10 ** e;

const RATE_SCALE = 100000000n;
export function parseRate(rate: string): bigint | null {
  const s = rate.trim().replace(',', '.');
  if (!/^\d+(\.\d{0,8})?$/.test(s)) return null;
  const [i, f = ''] = s.split('.');
  const r = BigInt(i) * RATE_SCALE + BigInt((f + '00000000').slice(0, 8));
  return r > 0n ? r : null;
}
export const isValidRate = (rate: string) => parseRate(rate) !== null;

/** amountBase = round_half_up(amount * rate), exact (BigInt). rate = base units per 1 foreign unit. */
export function convertMinor(amount: Minor, rate: string, fromExp: number, toExp: number): Minor {
  const r = parseRate(rate);
  if (r === null) throw new Error('invalid rate');
  let num = BigInt(Math.abs(amount)) * r;
  let den = RATE_SCALE;
  const de = toExp - fromExp;
  if (de > 0) num *= 10n ** BigInt(de);
  else if (de < 0) den *= 10n ** BigInt(-de);
  const q = (num * 2n + den) / (2n * den);
  return amount < 0 ? -Number(q) : Number(q);
}
export const convertCurrency = (amount: Minor, from: Currency, to: Currency, rate: string): Minor =>
  from === to ? amount : convertMinor(amount, rate, currencyExponent(from), currencyExponent(to));

/** Largest-remainder distribution of `total` over `weights`. Ties go to the lowest index. */
export function distribute(total: Minor, weights: number[]): Minor[] {
  const out = weights.map(() => 0);
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sumW <= 0) return out;
  const T = BigInt(total);
  const S = BigInt(sumW);
  const rems: { i: number; rem: bigint }[] = [];
  let given = 0;
  weights.forEach((w, i) => {
    const num = T * BigInt(w);
    const q = Number(num / S);
    out[i] = q;
    given += q;
    rems.push({ i, rem: num % S });
  });
  let left = total - given;
  rems.sort((a, b) => (a.rem === b.rem ? a.i - b.i : a.rem > b.rem ? -1 : 1));
  for (let k = 0; left > 0 && k < rems.length; k++, left--) out[rems[k].i] += 1;
  return out;
}
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const roundUpTo = (amount: Minor, step: Minor): Minor => (step <= 0 ? amount : Math.ceil(amount / step) * step);
export const roundNearestTo = (amount: Minor, step: Minor): Minor => (step <= 0 ? amount : Math.round(amount / step) * step);
/** Hero rounding: floor to whole major units. */
export const floorMajor = (amount: Minor, exp: number): number => Math.floor(Math.max(0, amount) / pow10(exp));

/**
 * Typed amount text -> "1234.5" (dot decimal, no grouping). Accepts both "," and "." as the decimal separator, because
 * Azerbaijani, Turkish and Russian typists use "," and many phone keyboards only offer ".". Rules: spaces are grouping;
 * when both marks appear, the last one is the decimal and the other is grouping ("1.500,50", "1,500.50"); a mark that
 * appears more than once is grouping ("1.500.000"); a single mark is the decimal ("4,50", "4.50").
 */
export function normalizeAmountText(text: string): string {
  let s = text.trim().replace(/[\s  ']/g, '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  // grouping is only grouping when it splits the whole part into threes ("1.500.000"); "1,2,3" is not an amount
  const grouped = (whole: string, g: string) => new RegExp(`^\\d{1,3}(\\${g}\\d{3})+$`).test(whole);
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    const grp = dec === '.' ? ',' : '.';
    const at = s.lastIndexOf(dec);
    const whole = s.slice(0, at);
    if (!grouped(whole, grp)) return 'x';
    s = `${whole.split(grp).join('')}.${s.slice(at + 1)}`;
  } else {
    const mark = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : null;
    if (mark) {
      const count = s.split(mark).length - 1;
      if (count > 1 && !grouped(s, mark)) return 'x';
      s = count > 1 ? s.split(mark).join('') : s.replace(mark, '.');
    }
  }
  return s;
}

/**
 * User-typed amount -> integer minor units, or null when the text is not a complete positive amount yet
 * ("", ".", ",", "1,2,3", "abc", too many decimals, absurdly large). Never throws and never returns NaN, so a
 * half-typed field disables Save instead of crashing a BigInt conversion further down.
 */
export function parseAmountInput(text: string, exp: number): Minor | null {
  const s = normalizeAmountText(text);
  if (!/^\d*(\.\d*)?$/.test(s) || !/\d/.test(s)) return null;
  const [i, f = ''] = s.split('.');
  if (f.length > exp) return null;
  if (i.replace(/^0+/, '').length > 12) return null;
  const v = Number(i || '0') * pow10(exp) + Number((f + '0'.repeat(exp)).slice(0, exp) || '0');
  return Number.isSafeInteger(v) && v > 0 ? v : null;
}
