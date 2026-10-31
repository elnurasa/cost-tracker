import { describe, expect, it } from 'vitest';
import {
  CATEGORY_ICON, CATEGORY_KEYS, assignCategoryKeys, categoryFromText, foldText, inferCategoryKey, paymentsByCategory, pastChoices, suggestCategory, suggestIcon,
} from './categories';
import { paymentsOverview } from './payments';
import type { CommitmentRule, InstallmentPlan } from './types';

const base = { createdAt: '', updatedAt: '', deletedAt: null, rev: '', workspaceId: 'w' };
const rule = (o: Partial<CommitmentRule> & Pick<CommitmentRule, 'id' | 'name' | 'envelopeId' | 'amount'>): CommitmentRule => ({
  ...base, currency: 'AZN', frequency: 'monthly', anchorDate: '2026-11-10', dayOfMonth: 10, endDate: null, estimate: false, active: true, skippedDates: [], payee: null, autoPost: false, ...o,
});
const loan = (o: Partial<InstallmentPlan> & Pick<InstallmentPlan, 'id' | 'name' | 'envelopeId' | 'paymentAmount' | 'paymentCount' | 'firstDueDate'>): InstallmentPlan => ({
  ...base, currency: 'AZN', paidBeforeCount: 0, skipped: [], status: 'active', kind: 'loan', waived: [], autoPost: false, ...o,
});

describe('text folding', () => {
  it('is case- and diacritic-insensitive in AZ/TR/RU/EN', () => {
    expect(foldText('İŞIQ')).toBe('isiq');
    expect(foldText('Kirayə')).toBe('kiraye');
    expect(foldText('Doğalgaz Faturası')).toBe('dogalgaz faturasi');
    expect(foldText('Учёба')).toBe('учеба');
    expect(foldText('ŞƏBƏKƏ')).toBe('sebeke');
  });
});

describe('keyword suggestion (AC-CAT-04)', () => {
  const cases: [string, string | null][] = [
    ['qaz', 'utilities'], ['Qaz', 'utilities'], ['QAZ pulu', 'utilities'], ['işıq', 'utilities'], ['Isiq', 'utilities'], ['su', 'utilities'], ['Azərsu', 'utilities'],
    ['Doğalgaz', 'utilities'], ['Elektrik', 'utilities'], ['Электричество', 'utilities'], ['газ', 'utilities'], ['Gas', 'utilities'],
    ['internet', 'phone'], ['İnternet', 'phone'], ['Azercell', 'phone'], ['мобильная связь', 'phone'],
    ['kirayə', 'housing'], ['Ev kirayəsi', 'housing'], ['Kira', 'housing'], ['Аренда', 'housing'], ['Rent', 'housing'], ['ipoteka', 'housing'],
    ['kredit', 'loans'], ['Avtomobil krediti', 'loans'], ['Kredi', 'loans'], ['Кредит', 'loans'], ['Car loan', 'loans'],
    ['taksit', 'installments'], ['Telefon taksiti', 'installments'], ['Рассрочка за телефон', 'installments'],
    ['Netflix', 'subscriptions'], ['Spotify', 'subscriptions'], ['Musiqi abunəliyi', 'subscriptions'], ['Подписка', 'subscriptions'],
    ['sığorta', 'insurance'], ['Avtomobil sığortası', 'insurance'], ['Kasko', 'insurance'], ['ОСАГО', 'insurance'],
    ['bağça', 'education'], ['Uşaq bağçası', 'education'], ['kurs', 'education'], ['İngilis dili kursu', 'education'], ['Детский сад', 'education'],
    // no keyword, a substring only, or ambiguous: never auto-pick
    ['', null], ['   ', null], ['Sushi', null], ['Gasoline', null], ['qazan', null], ['Market', null], ['Netflix and gas', null], ['Internet su', null],
  ];
  it.each(cases)('%s -> %s', (text, want) => {
    expect(categoryFromText(text)).toBe(want);
  });
  it('robust on odd input (no throw)', () => {
    for (const s of ['.', ',', '%%%', '😀', '1234', 'a'.repeat(5000), '\u0000']) expect(() => categoryFromText(s)).not.toThrow();
  });
});

describe('suggestCategory: learning and ambiguity', () => {
  const past = [
    { name: 'Gas', payee: 'Azəriqaz', envelopeId: 'eBills' },
    { name: 'Lessons', payee: 'Mr. Smith', envelopeId: 'eKids' },
    { name: 'Card', payee: 'My bank', envelopeId: 'eLoans' },
    { name: 'Loan', payee: 'My bank', envelopeId: 'eInst' },
  ];
  it('an earlier choice for the same payee wins over keywords (case/diacritics ignored)', () => {
    expect(suggestCategory({ name: 'Anything', payee: 'azeriqaz', past })).toEqual({ envelopeId: 'eBills', source: 'payee' });
    expect(suggestCategory({ name: 'Piano', payee: 'MR. SMITH', past })).toEqual({ envelopeId: 'eKids', source: 'payee' });
  });
  it('a payee that went to different envelopes before is not used; then the name decides', () => {
    expect(suggestCategory({ name: 'kredit', payee: 'My bank', past })).toEqual({ key: 'loans', source: 'keyword' });
    expect(suggestCategory({ name: 'Something', payee: 'My bank', past })).toBeNull();
  });
  it('the same name as before is used when the payee is new', () => {
    expect(suggestCategory({ name: 'lessons', payee: '', past })).toEqual({ envelopeId: 'eKids', source: 'name' });
  });
  it('an archived or missing envelope is not suggested', () => {
    expect(suggestCategory({ name: 'x', payee: 'Mr. Smith', past, validEnvelope: (id) => id !== 'eKids' })).toBeNull();
  });
  it('keywords from name and payee must agree; loans/installments outrank product words', () => {
    expect(suggestCategory({ name: 'Qaz', payee: 'Azəriqaz' })).toEqual({ key: 'utilities', source: 'keyword' });
    expect(suggestCategory({ name: 'Internet', payee: 'Azərsu' })).toBeNull();
    expect(suggestCategory({ name: 'Kredit', payee: 'Azercell' })).toEqual({ key: 'loans', source: 'keyword' });
    expect(suggestCategory({ name: '', payee: 'Netflix' })).toEqual({ key: 'subscriptions', source: 'keyword' });
  });
  it('pastChoices drops deleted payments', () => {
    const r = [rule({ id: 'a', name: 'Gas', envelopeId: 'e1', amount: 1, payee: 'G' }), rule({ id: 'b', name: 'Old', envelopeId: 'e2', amount: 1, deletedAt: 'x' })];
    expect(pastChoices(r, []).map((p) => p.envelopeId)).toEqual(['e1']);
  });
});

describe('existing envelopes get a stable key (migration, AC-CAT-03)', () => {
  it('maps template names in every language and icons; never twice', () => {
    expect(inferCategoryKey({ name: 'Kommunal', icon: 'receipt', kind: 'fixed' })).toBe('utilities');
    expect(inferCategoryKey({ name: 'Faturalar', icon: 'receipt', kind: 'fixed' })).toBe('utilities');
    expect(inferCategoryKey({ name: 'Счета', icon: 'receipt', kind: 'fixed' })).toBe('utilities');
    expect(inferCategoryKey({ name: 'Ev', icon: 'house', kind: 'fixed' })).toBe('housing');
    expect(inferCategoryKey({ name: 'Taksitlər', icon: 'calendar-clock', kind: 'fixed' })).toBe('installments');
    expect(inferCategoryKey({ name: 'My stuff', icon: 'landmark', kind: 'fixed' })).toBe('loans');
    expect(inferCategoryKey({ name: 'Netflix', icon: 'receipt', kind: 'fixed' })).toBe('subscriptions');
    expect(inferCategoryKey({ name: 'Kommunal', icon: 'receipt', kind: 'flexible' })).toBeNull();
    expect(inferCategoryKey({ name: 'Car', icon: 'car', kind: 'fixed' })).toBeNull();
    const keys = assignCategoryKeys([
      { id: 'a', name: 'Bills', icon: 'receipt', kind: 'fixed', order: 2 },
      { id: 'b', name: 'Kommunal', icon: 'receipt', kind: 'fixed', order: 1 },
      { id: 'c', name: 'Rent', icon: 'house', kind: 'fixed', order: 3, categoryKey: 'housing' },
      { id: 'd', name: 'Home', icon: 'house', kind: 'fixed', order: 4 },
      { id: 'e', name: 'Gone', icon: 'landmark', kind: 'fixed', order: 5, deletedAt: 'x' },
    ]);
    expect(keys).toEqual({ b: 'utilities' }); // a: utilities taken by b (lower order); c already has one; d: housing taken; e deleted
  });
  it('every ready-made category has an icon', () => {
    for (const k of CATEGORY_KEYS) expect(CATEGORY_ICON[k]).toBeTruthy();
  });
  it('icon for a new envelope follows its name', () => {
    expect(suggestIcon('Qaz')).toBe('zap');
    expect(suggestIcon('Kafe')).toBe('coffee');
    expect(suggestIcon('Taksi')).toBe('bus');
    expect(suggestIcon('Hədiyyələr')).toBe('gift');
    expect(suggestIcon('Zzz')).toBeNull();
  });
});

describe('By category totals (AC-CAT-05)', () => {
  const today = '2026-11-01';
  const rules = [
    rule({ id: 'm', name: 'Music', envelopeId: 'subs', amount: 800 }),
    rule({ id: 'v', name: 'Video', envelopeId: 'subs', amount: 2400, anchorDate: '2026-11-20', dayOfMonth: 20 }),
    rule({ id: 'w', name: 'Cleaning', envelopeId: 'home', amount: 1000, frequency: 'weekly', anchorDate: '2026-11-02', dayOfMonth: null }),
    rule({ id: 'y', name: 'Domain', envelopeId: 'subs', amount: 1200, frequency: 'yearly', anchorDate: '2027-03-01', dayOfMonth: null }),
    rule({ id: 'o', name: 'Car insurance', envelopeId: 'ins', amount: 45000, frequency: 'once', anchorDate: '2026-12-05', dayOfMonth: null }),
    rule({ id: 'p', name: 'Paused', envelopeId: 'subs', amount: 999, active: false, pausedAt: '2026-10-01' }),
  ];
  const plans = [loan({ id: 'l', name: 'Car loan', envelopeId: 'loans', paymentAmount: 28500, paymentCount: 36, firstDueDate: '2024-06-12', paidBeforeCount: 30 })];
  const o = paymentsOverview({ rules, plans, txns: [], today, firstStart: '2026-10-25', to: '2026-11-24', periodStart: '2026-10-25', periodEnd: '2026-11-24' });
  const rows = paymentsByCategory(o.items, rules, plans, today);
  const by = (id: string) => rows.find((r) => r.envelopeId === id)!;
  it('subscriptions: 8 + 24 a month = 32, a year 384 (+ a yearly 12 = 1 a month); a paused one counts but adds nothing', () => {
    expect(by('subs').perMonth).toBe(800 + 2400 + 100);
    expect(by('subs').perYear).toBe((800 + 2400) * 12 + 1200);
    expect(by('subs').count).toBe(4);
    expect(by('subs').recurring).toBe(true);
  });
  it('weekly is x52/12 a month and x52 a year', () => {
    expect(by('home').perMonth).toBe(Math.round((1000 * 52) / 12));
    expect(by('home').perYear).toBe(52000);
  });
  it('a loan counts its monthly payment and only what is left in the next 12 months (6 payments)', () => {
    expect(by('loans').perMonth).toBe(28500);
    expect(by('loans').perYear).toBe(6 * 28500);
  });
  it('a one-time payment is shown apart, not as a monthly amount', () => {
    expect(by('ins')).toMatchObject({ perMonth: 0, perYear: 0, oneTime: 45000, recurring: false, count: 1 });
  });
  it('sorted by the monthly total', () => {
    expect(rows.map((r) => r.envelopeId)).toEqual(['loans', 'home', 'subs', 'ins']);
  });
  it('the totals match the payments in the list exactly (every item belongs to exactly one category)', () => {
    expect(rows.reduce((s, r) => s + r.count, 0)).toBe(o.items.length);
  });
});
