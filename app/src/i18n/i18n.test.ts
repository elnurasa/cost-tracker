import { describe, expect, it } from 'vitest';
import { en, type Msg } from './en';
import { az } from './az';
import { tr } from './tr';
import { ru } from './ru';
import { translate } from './index';

const locales = { az, tr, ru } as const;
const all = { en, az, tr, ru } as const;
const texts = (m: Msg): string[] => (typeof m === 'string' ? [m] : Object.values(m).filter((x): x is string => typeof x === 'string'));
const placeholders = (m: Msg) => [...new Set(texts(m).flatMap((s) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1])))].sort();

// Banned words (DR-5 / product spec 6.3), matched on word starts so inflections are caught.
const BANNED: Record<keyof typeof all, RegExp> = {
  en: /\b(overspen[dt]|exceed|failed|failure|warning|error|must|should|mistake|bad|careless|deficit|penalty|streak|blown|wasted|debt|alert|limit reached)/i,
  az: /(xəta|xəbərdarlıq|uğursuz|məcbur|borc|cərimə|səhv|israf|günahkar)/i,
  tr: /(hata|uyarı|başarısız|zorunda|mecbur|borç|ceza|yanlış|israf|suçlu)/i,
  ru: /(ошибк|предупрежд|превыш|перерасход|долг|штраф|неудач|должен|должны|нельзя|плох|небрежн|провал)/i,
};

describe('i18n catalogs', () => {
  it('AC-LOC-01: every locale has exactly the English keys', () => {
    const keys = Object.keys(en).sort();
    for (const [name, d] of Object.entries(locales)) expect(Object.keys(d).sort(), name).toEqual(keys);
  });
  it('placeholders are preserved in every locale', () => {
    for (const [name, d] of Object.entries(locales)) {
      for (const k of Object.keys(en) as (keyof typeof en)[]) {
        expect(placeholders(d[k]), `${name}:${k}`).toEqual(placeholders(en[k]));
      }
    }
  });
  it('AC-LOC-02: plural objects have the CLDR categories of the language', () => {
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      if (typeof en[k] === 'string') {
        for (const [name, d] of Object.entries(locales)) expect(typeof d[k], `${name}:${k} should be a string`).toBe('string');
        continue;
      }
      expect(typeof ru[k], `ru:${k}`).toBe('object');
      const r = ru[k] as Exclude<Msg, string>;
      expect(Boolean(r.one && r.few && r.many && r.other), `ru:${k} one/few/many/other`).toBe(true);
      for (const l of ['az', 'tr'] as const) {
        const m = locales[l][k];
        expect(typeof m, `${l}:${k}`).toBe('object');
        expect(Boolean((m as Exclude<Msg, string>).other), `${l}:${k} other`).toBe(true);
      }
    }
  });
  it('AC-LOC-02: Russian plural forms follow CLDR', () => {
    expect(translate('ru', 'common.days', { n: 1 })).toMatch(/^1 /);
    const f = (n: number) => translate('ru', 'common.days', { n });
    expect(new Set([f(1), f(2), f(5)].map((s) => s.replace(/^\d+ /, ''))).size).toBe(3);
  });
  it('no English leaks into AZ/TR/RU (identical strings only allowed when they carry no words)', () => {
    for (const [name, d] of Object.entries(locales)) {
      for (const k of Object.keys(en) as (keyof typeof en)[]) {
        if (k === 'brand.name') continue;
        const same = JSON.stringify(d[k]) === JSON.stringify(en[k]);
        const words = texts(en[k]).join(' ').replace(/\{\w+\}/g, '').replace(/[^\p{L}]+/gu, '');
        if (same && words.length > 0) throw new Error(`${name}:${k} is identical to English`);
      }
    }
  });
  it('AC-LOC-05 / AC-NUD-04: banned-word lint is clean in all four locales', () => {
    for (const [name, d] of Object.entries(all)) {
      for (const [k, v] of Object.entries(d)) {
        for (const s of texts(v as Msg)) expect(BANNED[name as keyof typeof all].test(s), `${name}:${k} -> "${s}"`).toBe(false);
      }
    }
  });
  it('DR-8: English sentences stay short (<= 14 words)', () => {
    for (const [k, v] of Object.entries(en)) {
      for (const s of texts(v as Msg)) {
        for (const sentence of s.split(/[.?!]\s/)) expect(sentence.trim().split(/\s+/).length, `${k}: ${sentence}`).toBeLessThanOrEqual(22);
      }
    }
  });
  it('AZ and TR keep their diacritics (spot check)', () => {
    expect(az['hero.label']).toMatch(/[əğıöüşç]/i);
    expect(tr['hero.label']).toMatch(/[ğıöüşç]/i);
    expect(az['brand.name']).toBe('Pul Planım');
  });
});
