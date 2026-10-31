import { describe, expect, it } from 'vitest';
import { en, type Msg } from './en';
import { az } from './az';
import { tr } from './tr';
import { ru } from './ru';
import { makeFmt, translate, AZ_MON, AZ_MON_LONG, AZ_WD, AZ_WD_LONG } from './index';

const locales = { az, tr, ru } as const;
const all = { en, az, tr, ru } as const;
const keys = Object.keys(en) as (keyof typeof en)[];
const forms = (m: Msg): string[] => (typeof m === 'string' ? [m] : Object.values(m).filter((x): x is string => typeof x === 'string'));
const vars = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]))].sort();

describe('placeholders and plurals (strict)', () => {
  it('every plural FORM carries the same variables as English', () => {
    for (const l of ['az', 'tr', 'ru'] as const) {
      for (const k of keys) {
        const want = vars(forms(en[k]).join(' '));
        for (const f of forms(all[l][k])) expect(vars(f), `${l}:${k} "${f}"`).toEqual(want);
      }
    }
  });
  it('plural keys always include {n} in every form', () => {
    for (const l of ['en', 'az', 'tr', 'ru'] as const) {
      for (const k of keys) {
        const m = all[l][k] as Msg;
        if (typeof m === 'string') continue;
        for (const f of Object.values(m)) expect(f, `${l}:${k}`).toContain('{n}');
      }
    }
  });
  it('Russian plural forms are correct for 1, 2, 5, 11, 21, 22, 25, 101, 111, 112', () => {
    const want: Record<number, [string, string]> = {
      1: ['день', 'запись'],
      2: ['дня', 'записи'],
      5: ['дней', 'записей'],
      11: ['дней', 'записей'],
      21: ['день', 'запись'],
      22: ['дня', 'записи'],
      25: ['дней', 'записей'],
      101: ['день', 'запись'],
      111: ['дней', 'записей'],
      112: ['дней', 'записей'],
    };
    for (const [n, [day, entry]] of Object.entries(want)) {
      expect(translate('ru', 'common.days', { n: Number(n) }), `days ${n}`).toBe(`${n} ${day}`);
      expect(translate('ru', 'common.entries', { n: Number(n) }), `entries ${n}`).toBe(`${n} ${entry}`);
    }
    expect(translate('ru', 'hero.daysTo', { n: 21 })).toBe('21 день до следующего дохода');
    expect(translate('ru', 'hero.daysTo', { n: 3 })).toBe('3 дня до следующего дохода');
    expect(translate('ru', 'row.overdue', { n: 12 })).toBe('Просрочено на 12 дней');
    expect(translate('ru', 'inc.inDays', { n: 24 })).toBe('через 24 дня');
  });
  it('English singular/plural and AZ/TR (no inflection after numerals)', () => {
    expect(translate('en', 'common.days', { n: 1 })).toBe('1 day');
    expect(translate('en', 'common.days', { n: 2 })).toBe('2 days');
    for (const n of [1, 2, 5, 11, 21]) {
      expect(translate('az', 'common.days', { n })).toBe(`${n} gün`);
      expect(translate('tr', 'common.days', { n })).toBe(`${n} gün`);
    }
  });
  it('no counted noun hides in a non-plural string with {n} (would break Russian/English agreement)', () => {
    // {n} followed by a Cyrillic or English noun is only allowed when it is a number-of-total pattern.
    for (const k of keys) {
      for (const [l, re] of [
        ['ru', /\{n\}\s+(?!из\b|по\b|с\b)[а-яё]{3,}/],
        ['en', /\{n\}\s+(days?|entries|entry|payments?|tries|digits?|weeks?|months?)\b/],
      ] as const) {
        const m = all[l][k] as Msg;
        if (typeof m !== 'string') continue;
        expect(re.test(m), `${l}:${k} "${m}" needs a plural object or rewording`).toBe(false);
      }
    }
  });
});

describe('typography and register', () => {
  it('no stray spacing, straight double quotes in RU, or Latin/Cyrillic cross-leaks', () => {
    const latinOk = /PIN|CSV|Excel|QR/g;
    for (const l of ['en', 'az', 'tr', 'ru'] as const) {
      for (const k of keys) {
        for (const s of forms(all[l][k])) {
          expect(s, `${l}:${k} trim`).toBe(s.trim());
          expect(/ {2,}/.test(s), `${l}:${k} double space`).toBe(false);
          expect(/\s[.,;:!?]/.test(s), `${l}:${k} space before punctuation`).toBe(false);
          if (l === 'ru' && k !== 'brand.name') {
            expect(/"/.test(s), `ru:${k} use guillemets «»`).toBe(false);
            const stripped = s.replace(/\{\w+\}/g, '').replace(latinOk, '');
            expect(/[A-Za-z]/.test(stripped), `ru:${k} Latin letters in "${s}"`).toBe(false);
          } else if (l !== 'en') {
            expect(/[Ѐ-ӿ]/.test(s), `${l}:${k} Cyrillic leak`).toBe(false);
          }
        }
      }
    }
  });
  it('RU uses polite "вы" (no informal ты-forms) and AZ uses "siz" (no "sən"-forms)', () => {
    const ruInformal = /(^|[^а-яё])(ты|тебя|тебе|тобой|твой|твоё|твоя|твои|твоих|твоим|твою|можешь|хочешь|ждёшь|забудешь|потратишь|добавь|нажми|введи|выбери|укажи|смотри|делай|храни|сделай|сотри|потяни|подожди|попробуй|скажи|получил|дошёл|забыл|вводил)([^а-яё]|$)/i;
    const azInformal = /(sən|səni|sənin|sənə|bilərsən|alırsan|istəyirsən|gözləyirsən|unutmusan|əlində|(?<![a-zçəğıöşü])aldın|çatdın|xərclədiyin|saxladığın|işlətdiyin)(?![a-zçəğıöşü])/i;
    for (const k of keys) {
      for (const s of forms(ru[k])) expect(ruInformal.test(s), `ru:${k} "${s}"`).toBe(false);
      for (const s of forms(az[k])) expect(azInformal.test(s), `az:${k} "${s}"`).toBe(false);
    }
  });
  it('Turkish does not put apostrophes on envelope nouns (Yedek\'ini, Birikim\'den)', () => {
    for (const k of keys) for (const s of forms(tr[k])) expect(/(Yedek|Birikim|payım)'/.test(s), `tr:${k} "${s}"`).toBe(false);
  });
  it('envelope glossary is used consistently', () => {
    expect(az['env.pocket']).toBe('Mənim payım');
    expect(az['env.buffer']).toBe('Ehtiyat');
    expect(tr['env.buffer']).toBe('Yedek');
    expect(ru['env.buffer']).toBe('Запас');
    expect(ru['env.pocket']).toBe('Моя доля');
    expect(az['env.explainer']).toMatch(/Zərf/);
    expect(tr['env.explainer']).toMatch(/Zarf/);
    expect(ru['env.explainer']).toMatch(/Конверт/);
  });
});

describe('length budgets (UI constraints)', () => {
  const max = (m: Msg) => Math.max(...forms(m).map((s) => s.length));
  const TAB = /^nav\.(today|plan|history|settings|payments)$/;
  const HERO = /^(hero\.label|onboard\.revealTitle)$/;
  const BUTTON =
    /^(common\.(?!offlineNote|newVersion|perMonth|days|entries|offline$|loading)|(card|onboard|hero)\.\w*Action$|card\.(yesAmount|different|notYet|itArrived|thumb|stop|telemetryYes|cover\.)|onboard\.(start|looksGood|startEmpty|sample$|freq\.)|add\.seg\.|add\.save(Income|Edit)?$|move\.action|coming\.tab\.|inc\.sched\.|history\.type\.|history\.period\.|lock\.delay\.|settings\.theme\.|review\.(keep|toBuffer|confirm|edit|skip)$|hero\.moveMoney|nav\.addShort|pay\.(filter\.|iPaid$|payExtra|skipThis|end$|reopen|pause$|resume$|save$|new$|fromAdd|state\.|type\.|loanKind\.(loan|installment)$))/;
  it('tab labels are at most 10 characters in every language', () => {
    for (const l of ['en', 'az', 'tr', 'ru'] as const) for (const k of keys) if (TAB.test(k)) expect(max(all[l][k]), `${l}:${k}`).toBeLessThanOrEqual(10);
  });
  it('hero label is at most 30 characters', () => {
    for (const l of ['en', 'az', 'tr', 'ru'] as const) for (const k of keys) if (HERO.test(k)) expect(max(all[l][k]), `${l}:${k}`).toBeLessThanOrEqual(30);
  });
  it('button / chip / segment labels are at most 26 characters', () => {
    for (const l of ['en', 'az', 'tr', 'ru'] as const) for (const k of keys) if (BUTTON.test(k)) expect(max(all[l][k]), `${l}:${k} "${forms(all[l][k])[0]}"`).toBeLessThanOrEqual(26);
  });
  it('no translation is more than 2.6x its English length (strings over 12 chars)', () => {
    for (const l of ['az', 'tr', 'ru'] as const) {
      for (const k of keys) {
        const e = max(en[k]);
        if (e < 12) continue;
        expect(max(locales[l][k]) / e, `${l}:${k}`).toBeLessThanOrEqual(2.6);
      }
    }
  });
  it('average length stays within 15% of English per language', () => {
    const total = (d: Record<string, Msg>) => keys.reduce((a, k) => a + max(d[k]), 0);
    const base = total(en);
    for (const l of ['az', 'tr', 'ru'] as const) expect(total(locales[l]) / base, l).toBeLessThanOrEqual(1.15);
  });
});

describe('date and number formatting', () => {
  // 2026-10-05 is a Monday
  // E-12: full month and weekday names ("5 noy" and "B.e." read as codes); weekday in lower case inside the phrase
  it('Azerbaijani never falls back to "M10" and uses month/day names from the built-in table', () => {
    const f = makeFmt('az');
    expect(f.date('2026-10-05')).toBe('5 oktyabr');
    expect(f.date('2026-10-05', 'weekday')).toBe('5 oktyabr, bazar ertəsi');
    expect(f.date('2026-10-05', 'long')).toBe('5 oktyabr 2026, bazar ertəsi');
    expect(f.date('2026-10-05', 'monthYear')).toBe('oktyabr 2026');
    for (let m = 1; m <= 12; m++) {
      const s = f.date(`2026-${String(m).padStart(2, '0')}-15`);
      expect(s).not.toMatch(/M\d|\d{2}\s*$/);
      expect(s).toBe(`15 ${AZ_MON_LONG[m - 1]}`);
      expect(f.date(`2026-${String(m).padStart(2, '0')}-15`, 'monthYear')).toBe(`${AZ_MON_LONG[m - 1]} 2026`);
    }
    expect(AZ_MON).toHaveLength(12);
    expect(AZ_MON_LONG).toHaveLength(12);
    expect(AZ_WD).toHaveLength(7);
    expect(AZ_WD_LONG).toHaveLength(7);
  });
  it('weekday() names (0 = Sunday)', () => {
    expect(makeFmt('az').weekday(0, 'long')).toBe('Bazar');
    expect(makeFmt('az').weekday(5, 'long')).toBe('Cümə');
    expect(makeFmt('az').weekday(1, 'short')).toBe('B.e.');
    expect(makeFmt('en').weekday(1, 'long')).toBe('Monday');
    expect(makeFmt('ru').weekday(1, 'long').toLowerCase()).toBe('понедельник');
    expect(makeFmt('tr').weekday(1, 'long')).toBe('Pazartesi');
  });
  it('TR, RU and EN produce real month names (no numeric fallbacks)', () => {
    expect(makeFmt('en').date('2026-10-05')).toMatch(/Oct/);
    expect(makeFmt('tr').date('2026-10-05')).toMatch(/Eki/);
    expect(makeFmt('ru').date('2026-10-05')).toMatch(/окт/);
    expect(makeFmt('tr').date('2026-10-05', 'monthYear')).toBe('Ekim 2026');
    expect(makeFmt('ru').date('2026-10-05', 'monthYear')).toMatch(/октябрь 2026/);
    expect(makeFmt('en').date('2026-10-05', 'monthYear')).toBe('October 2026');
  });
  it('currency symbols: AZ and RU after the number, TR and EN before', () => {
    const norm = (s: string) => s.replace(/[  ]/g, ' ');
    expect(norm(makeFmt('az').money(123450, 'AZN'))).toMatch(/^1[.\s]?234,50 ₼$/);
    expect(norm(makeFmt('ru').money(123450, 'RUB'))).toBe('1 234,50 ₽');
    expect(makeFmt('tr').money(123450, 'TRY')).toBe('₺1.234,50');
    expect(makeFmt('en').money(123450, 'USD')).toBe('$1,234.50');
    expect(makeFmt('tr').heroNumber(123450, 'TRY')).toBe('1.234');
  });
  it('relativeDay uses the localized word for today', () => {
    expect(makeFmt('az').relativeDay('2026-10-05', '2026-10-05')).toBe('Bu gün');
    expect(makeFmt('ru').relativeDay('2026-10-05', '2026-10-05')).toBe('Сегодня');
  });
});

// E-03: separators are owned by the app (Chromium's reduced ICU printed "₼ 1,500.50" for az); these must hold on every engine
describe('locale number conventions (E-03)', () => {
  const nb = (s: string) => s.replace(/ /g, ' ');
  it('AZ: dot grouping, comma decimal, symbol after the number with a no-break space', () => {
    const f = makeFmt('az');
    expect(f.money(150000, 'AZN')).toBe('1.500 ₼');
    expect(f.money(450, 'AZN')).toBe('4,50 ₼');
    expect(f.money(150000, 'AZN', { fixed: true })).toBe('1.500,00 ₼');
    expect(f.money(-250, 'AZN')).toBe('−2,50 ₼');
    expect(f.heroNumber(123456789, 'AZN')).toBe('1.234.567');
    expect(f.decimalSep).toBe(',');
    expect(f.parts(1316, 'AZN')).toEqual({ symbol: '₼', symbolFirst: false, number: '13,16' });
    expect(f.number(1500)).toBe('1.500');
  });
  it('TR, RU and EN keep their own conventions', () => {
    expect(makeFmt('tr').money(150050, 'TRY')).toBe('₺1.500,50');
    expect(nb(makeFmt('ru').money(150050, 'RUB'))).toBe('1 500,50 ₽');
    expect(makeFmt('en').money(150050, 'USD')).toBe('$1,500.50');
    expect(makeFmt('en').money(150050, 'AZN')).toBe('₼1,500.50');
    expect(makeFmt('ru').heroNumber(1234500, 'RUB')).toBe('12 345');
    expect(makeFmt('tr').decimalSep).toBe(',');
    expect(makeFmt('en').decimalSep).toBe('.');
  });
  it('currencies without a symbol get a space, zero-decimal currencies have no decimals', () => {
    expect(nb(makeFmt('en').money(500, 'GEL'))).toMatch(/^(₾|GEL )5$/);
    expect(makeFmt('az').money(1500, 'JPY')).toBe('1.500 ¥');
  });
  it('screen-reader names are in the UI language, never English, for Azerbaijani', () => {
    const s = makeFmt('az').moneyName(450, 'AZN');
    expect(s).toMatch(/manat/i);
    expect(s).not.toMatch(/Azerbaijani|manats/);
    expect(makeFmt('ru').moneyName(150000, 'AZN')).toMatch(/маната?/);
    expect(makeFmt('az').moneyName(-100, 'AZN')).toMatch(/^mənfi /);
  });
  it('the number pad shows what you typed in the locale format', async () => {
    const { formatRaw } = await import('../ui/NumberPad');
    expect(formatRaw('1500.5', '.', ',')).toBe('1.500,5');
    expect(formatRaw('12.', '.', ',')).toBe('12,');
    expect(formatRaw('1234567', ' ', ',')).toBe('1 234 567');
  });
});
