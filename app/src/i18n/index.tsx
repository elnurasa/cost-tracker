import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { en, type Key, type Msg } from './en';
import { az } from './az';
import { tr } from './tr';
import { ru } from './ru';
import type { Locale, Minor } from '../domain';
import { currencyExponent, parseDate } from '../domain';

export type { Key, Msg, Locale };
export const LOCALES: { id: Locale; name: string; tag: string }[] = [
  { id: 'en', name: 'English', tag: 'en' },
  { id: 'ru', name: 'Русский', tag: 'ru' },
  { id: 'tr', name: 'Türkçe', tag: 'tr' },
  { id: 'az', name: 'Azərbaycanca', tag: 'az-Latn' },
];
export const DICTS: Record<Locale, Record<Key, Msg>> = { en, az, tr, ru };
export const tagOf = (l: Locale) => LOCALES.find((x) => x.id === l)!.tag;

export type Params = Record<string, string | number>;

export function translate(locale: Locale, key: Key, params: Params = {}): string {
  let m: Msg = DICTS[locale][key] ?? en[key];
  if (typeof m !== 'string') {
    const n = Number(params.n ?? 0);
    const cat = new Intl.PluralRules(tagOf(locale)).select(n) as 'one' | 'few' | 'many' | 'other';
    m = m[cat] ?? m.other;
  }
  return m.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

export interface Fmt {
  /** normal decimals; trims ".00" unless `fixed` */
  money(minor: Minor, currency: string, o?: { fixed?: boolean; sign?: boolean }): string;
  /** floor to whole major units, no decimals (hero) */
  heroNumber(minor: Minor, currency: string): string;
  parts(minor: Minor, currency: string, o?: { whole?: boolean; fixed?: boolean }): { symbol: string; symbolFirst: boolean; number: string };
  moneyName(minor: Minor, currency: string): string;
  number(n: number): string;
  date(d: string, style?: 'short' | 'long' | 'weekday' | 'monthYear' | 'day'): string;
  relativeDay(d: string, today: string): string;
  /** weekday name for dow 0=Sunday..6=Saturday (robust for Azerbaijani) */
  weekday(dow: number, style?: 'short' | 'long'): string;
  decimalSep: string;
  tag: string;
}

export const AZ_WD_LONG = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'];
export const AZ_WD = ['Baz', 'B.e.', 'Ç.a.', 'Çər', 'C.a.', 'Cüm', 'Şən'];
export const AZ_MON = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avq', 'sen', 'okt', 'noy', 'dek'];
export const AZ_MON_LONG = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];

/**
 * Number conventions per UI language (CLDR; glossary 05 section "Money"). They are applied by our own code instead of
 * Intl.NumberFormat because browsers ship different locale data: Chromium's reduced ICU formats "az" with English
 * separators ("₼ 1,500.50"), while CLDR and the glossary say "1.500,50 ₼". Owning the separators makes every screen,
 * every input and every test agree on every device.
 */
export interface NumberSpec { group: string; decimal: string; symbolAfter: boolean; symbolGap: string }
const NBSP = ' ';
export const NUMBER_SPECS: Record<Locale, NumberSpec> = {
  en: { group: ',', decimal: '.', symbolAfter: false, symbolGap: '' }, // $1,234.50
  az: { group: '.', decimal: ',', symbolAfter: true, symbolGap: NBSP }, // 1.234,50 ₼
  tr: { group: '.', decimal: ',', symbolAfter: false, symbolGap: '' }, // ₺1.234,50
  ru: { group: NBSP, decimal: ',', symbolAfter: true, symbolGap: NBSP }, // 1 234,50 ₽
};

/** Currency names for screen readers, used when the browser has no data for the UI language (Chromium has none for az). */
const AZ_CURRENCY: Record<string, string> = {
  AZN: 'manat', USD: 'ABŞ dolları', EUR: 'avro', TRY: 'türk lirəsi', RUB: 'rus rublu', GBP: 'funt sterlinq', GEL: 'gürcü larisi',
  KZT: 'qazax təngəsi', UZS: 'özbək somu', UAH: 'ukrayna qrivnası', JPY: 'yapon yeni', CNY: 'çin yuanı', AED: 'BƏƏ dirhəmi',
};
/** Minor-unit names (qəpik, kuruş, копейка) so "4,50 ₼" is spoken "4 manat 50 qəpik", the way people say it. */
const AZ_MINOR: Record<string, string> = { AZN: 'qəpik', USD: 'sent', EUR: 'sent', TRY: 'quruş', RUB: 'qəpik' };

/** Groups the digits of a non-negative integer string. */
export function groupDigits(int: string, group: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, group);
}

const symbolCache = new Map<string, string>();
/** Narrow currency symbol (₼, ₺, ₽, $, €); falls back to the ISO code. Taken from English data, which every engine ships. */
export function currencySymbol(cur: string): string {
  let s = symbolCache.get(cur);
  if (s === undefined) {
    try {
      s = new Intl.NumberFormat('en', { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? cur;
    } catch {
      s = cur;
    }
    symbolCache.set(cur, s);
  }
  return s;
}

/** Formats |minor| as a plain locale number with `digits` decimals (exact integer arithmetic, no float rounding). */
export function formatMinorNumber(minor: Minor, exp: number, digits: number, spec: NumberSpec): string {
  const abs = Math.abs(Math.trunc(minor));
  const p = 10 ** exp;
  const int = Math.floor(abs / p);
  const frac = abs % p;
  const head = groupDigits(String(int), spec.group);
  if (digits <= 0 || exp === 0) return head;
  return `${head}${spec.decimal}${String(frac).padStart(exp, '0').slice(0, digits)}`;
}

export function makeFmt(locale: Locale): Fmt {
  const tag = tagOf(locale);
  const spec = NUMBER_SPECS[locale];
  const cache = new Map<string, Intl.NumberFormat>();
  const nameFmt = (cur: string, digits: number) => {
    const k = `${cur}|${digits}`;
    let f = cache.get(k);
    if (!f) {
      try {
        f = new Intl.NumberFormat(tag, { style: 'currency', currency: cur, currencyDisplay: 'name', minimumFractionDigits: digits, maximumFractionDigits: digits });
      } catch {
        f = new Intl.NumberFormat(tag, { minimumFractionDigits: digits, maximumFractionDigits: digits });
      }
      cache.set(k, f);
    }
    return f;
  };
  // does this engine really have currency names in the UI language? (Chromium answers "Azerbaijani manats" for az)
  const ownNames = (() => {
    try {
      const probe = new Intl.NumberFormat(tag, { style: 'currency', currency: 'USD', currencyDisplay: 'name' }).format(2);
      return locale === 'en' || !/dollars/i.test(probe);
    } catch {
      return false;
    }
  })();
  const dateFmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, opts);
  const toDate = (s: string) => {
    const p = parseDate(s);
    return new Date(p.y, p.m - 1, p.d);
  };
  const withSymbol = (num: string, cur: string) => {
    const sym = currencySymbol(cur);
    // a code instead of a symbol ("GEL 5") always gets a space so it does not glue to the digits
    const gap = spec.symbolGap || (/^[A-Z]{3}$/.test(sym) ? NBSP : '');
    return spec.symbolAfter ? `${num}${gap}${sym}` : `${sym}${gap}${num}`;
  };
  const fmt: Fmt = {
    tag,
    decimalSep: spec.decimal,
    money(minor, cur, o = {}) {
      const exp = currencyExponent(cur);
      const whole = minor % 10 ** exp === 0;
      const digits = o.fixed || !whole ? exp : 0;
      const s = withSymbol(formatMinorNumber(minor, exp, digits, spec), cur);
      return minor < 0 ? `−${s}` : o.sign && minor > 0 ? `+${s}` : s;
    },
    heroNumber(minor, cur) {
      const exp = currencyExponent(cur);
      return groupDigits(String(Math.floor(Math.max(0, minor) / 10 ** exp)), spec.group);
    },
    parts(minor, cur, o = {}) {
      const exp = currencyExponent(cur);
      const whole = o.whole ?? minor % 10 ** exp === 0;
      const digits = o.fixed ? exp : whole ? 0 : exp;
      const abs = Math.abs(minor);
      const value = o.whole ? Math.floor(abs / 10 ** exp) * 10 ** exp : abs;
      return { symbol: currencySymbol(cur), symbolFirst: !spec.symbolAfter, number: formatMinorNumber(value, exp, digits, spec) };
    },
    moneyName(minor, cur) {
      const exp = currencyExponent(cur);
      const abs = Math.abs(minor);
      const neg = minor < 0 ? `${translate(locale, 'a11y.minus')} ` : '';
      if (ownNames) return neg + nameFmt(cur, abs % 10 ** exp === 0 ? 0 : exp).format(abs / 10 ** exp);
      // no locale data (az in Chromium): "4 manat 50 qəpik", spoken in the UI language
      const int = Math.floor(abs / 10 ** exp);
      const frac = abs % 10 ** exp;
      const name = (locale === 'az' ? AZ_CURRENCY[cur] : undefined) ?? cur;
      const minorName = locale === 'az' ? AZ_MINOR[cur] : undefined;
      if (frac === 0) return `${neg}${groupDigits(String(int), spec.group)} ${name}`;
      if (minorName) return `${neg}${groupDigits(String(int), spec.group)} ${name} ${frac} ${minorName}`;
      return `${neg}${formatMinorNumber(abs, exp, exp, spec)} ${name}`;
    },
    number: (n) => {
      const neg = n < 0 ? '−' : '';
      const a = Math.abs(n);
      const int = Math.trunc(a);
      const fracStr = String(a).includes('.') ? String(a).split('.')[1] : '';
      return `${neg}${groupDigits(String(int), spec.group)}${fracStr ? spec.decimal + fracStr.slice(0, 3) : ''}`;
    },
    date(d, style = 'short') {
      const dt = toDate(d);
      if (locale === 'az') {
        // full month and weekday names (E-12: "5 noy" and "B.e." read as codes); weekday lower-case inside a phrase
        const p = parseDate(d);
        const wd = AZ_WD_LONG[dt.getDay()].toLowerCase();
        const mon = AZ_MON_LONG[p.m - 1];
        switch (style) {
          case 'long': return `${p.d} ${mon} ${p.y}, ${wd}`;
          case 'weekday': return `${p.d} ${mon}, ${wd}`;
          case 'monthYear': return `${AZ_MON_LONG[p.m - 1]} ${p.y}`;
          case 'day': return String(p.d);
          default: return `${p.d} ${mon}`;
        }
      }
      switch (style) {
        case 'long': return dateFmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(dt);
        case 'weekday': return dateFmt({ weekday: 'short', day: 'numeric', month: 'short' }).format(dt);
        case 'monthYear': return dateFmt({ month: 'long', year: 'numeric' }).format(dt);
        case 'day': return dateFmt({ day: 'numeric' }).format(dt);
        default: return dateFmt({ day: 'numeric', month: 'short' }).format(dt);
      }
    },
    weekday(dow, style = 'short') {
      const i = ((dow % 7) + 7) % 7;
      if (locale === 'az') return style === 'long' ? AZ_WD_LONG[i] : AZ_WD[i];
      return dateFmt({ weekday: style }).format(new Date(2024, 0, 7 + i));
    },
    relativeDay(d, today) {
      return d === today ? translate(locale, 'common.today') : fmt.date(d, 'weekday');
    },
  };
  return fmt;
}

interface Ctx {
  locale: Locale;
  t: (key: Key, params?: Params) => string;
  fmt: Fmt;
}
/**
 * Dev only: hot-reloading this module would create a NEW context object while mounted components still read the old one
 * ("I18nProvider missing"). Pin one context on globalThis so provider and consumers always agree; production has no such hook.
 */
const pin = globalThis as unknown as { __sakinI18nCtx?: React.Context<Ctx | null> };
const I18nCtx: React.Context<Ctx | null> = (import.meta.env.DEV && pin.__sakinI18nCtx) || createContext<Ctx | null>(null);
if (import.meta.env.DEV) pin.__sakinI18nCtx = I18nCtx;

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const fmt = useMemo(() => makeFmt(locale), [locale]);
  const t = useCallback((key: Key, params?: Params) => translate(locale, key, params), [locale]);
  const value = useMemo(() => ({ locale, t, fmt }), [locale, t, fmt]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}
export function useI18n(): Ctx {
  const c = useContext(I18nCtx);
  if (!c) {
    // dev resilience: during a hot update a consumer can render for a moment before its provider; fall back to English instead of crashing
    if (import.meta.env.DEV) return devFallback();
    throw new Error('I18nProvider missing');
  }
  return c;
}

let fallback: Ctx | null = null;
function devFallback(): Ctx {
  return (fallback ??= { locale: 'en', t: (key, params) => translate('en', key, params), fmt: makeFmt('en') });
}

/** Azerbaijani genitive suffix after a day number, by the last pronounced word: 1-i, 2-si, 3-ü, 6-sı, 9-u, 10-u, 20-si, 30-u. */
export function azDay(d: number): string {
  const last = d % 10;
  const tens: Record<number, string> = { 10: 'u', 20: 'si', 30: 'u' };
  const ones: Record<number, string> = { 1: 'i', 2: 'si', 3: 'ü', 4: 'ü', 5: 'i', 6: 'sı', 7: 'si', 8: 'i', 9: 'u' };
  return `${d}-${last === 0 ? tens[d] ?? 'u' : ones[last]}`;
}
