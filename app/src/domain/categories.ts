// Payment categories. Decision (founder-approved): an ENVELOPE IS THE CATEGORY. There is no second tag system: a payment's
// category is the envelope it is paid from, so the plan and the Payments panel always agree.
//
// This module is pure (no React, no DB, no clock). It holds:
// * the ready-made payment categories (fixed envelopes the app can offer but never forces),
// * a local keyword table (EN/AZ/TR/RU, case- and diacritic-insensitive) used to suggest a category while a payment's
//   name or payee is typed, plus "learning" from the person's own earlier choices for the same payee,
// * the inference that gives existing envelopes a stable `categoryKey` (migration; "Kommunal" -> utilities),
// * the per-category totals of the Payments panel's "By category" view.
// Keywords are matching data, not UI text: labels live in the i18n catalogs (`cat.<key>`).
import type { CommitmentRule, DateStr, Envelope, InstallmentPlan, Minor } from './types';
import { addMonthsClamped } from './dates';
import { toBase, type Money, type PaymentSummary } from './payments';

export const CATEGORY_KEYS = ['housing', 'utilities', 'phone', 'loans', 'installments', 'subscriptions', 'insurance', 'education', 'other'] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];
export const isCategoryKey = (x: unknown): x is CategoryKey => typeof x === 'string' && (CATEGORY_KEYS as readonly string[]).includes(x);

/** Icon of a ready-made category envelope (names from src/ui/Icon.tsx ENVELOPE_ICONS). */
export const CATEGORY_ICON: Record<CategoryKey, string> = {
  housing: 'house', utilities: 'zap', phone: 'wifi', loans: 'landmark', installments: 'calendar-clock', subscriptions: 'repeat',
  insurance: 'umbrella', education: 'graduation-cap', other: 'tag',
};

/** Which ready-made categories the payment form offers as "suggested" chips, by payment type (the auto-suggested one is always added). */
export const SUGGESTED_FOR: Record<'loan' | 'bill', CategoryKey[]> = {
  loan: ['loans', 'installments'],
  bill: ['utilities', 'housing', 'phone', 'subscriptions', 'insurance', 'education', 'other'],
};

/** Onboarding template keys that are payment categories (src/domain/planops.ts TEMPLATES). */
export const TEMPLATE_CATEGORY: Record<string, CategoryKey> = { home: 'housing', bills: 'utilities', installments: 'installments' };

// ------------------------------------------------------------------ normalisation and matching

const FOLD: Record<string, string> = { ə: 'e', ı: 'i', ё: 'е', й: 'и', ß: 'ss', ł: 'l', ø: 'o', œ: 'oe', æ: 'ae' };
/** Lowercase, no diacritics, Azerbaijani/Turkish/Russian letters folded ("İşıq" -> "isiq", "Ödəniş" -> "odenis", "ёлка" -> "елка"). */
export function foldText(s: string): string {
  return s
    .toLocaleLowerCase('tr') // dotted/dotless I first (İ -> i, I -> ı), then fold ı -> i
    .replace(/[əıёйßłøœæ]/g, (c) => FOLD[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
const tokens = (s: string): string[] => foldText(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * Keyword table. A keyword of 3 letters or fewer must be a whole word ("su", "qaz", "tv"); a longer one also matches as a word
 * prefix ("kirayə" -> "kirayəsi", "подписк" -> "подписка"). Multi-word keywords match consecutive words.
 * `strong` categories (loans, installments) win over product words: "Telefon taksiti" is an installment, not a phone bill.
 */
const KEYWORDS: Record<Exclude<CategoryKey, 'other'>, string[]> = {
  housing: [
    'rent', 'mortgage', 'landlord', 'building fee', 'hoa', 'housing', 'apartment', 'flat rent',
    'kirayə', 'kirə', 'ipoteka', 'ev sahibi', 'mənzil', 'bina haqqı', 'mtk', 'ev kirayəsi',
    'kira', 'konut', 'aidat', 'site aidatı', 'ev kirası',
    'аренда', 'квартплата', 'ипотека', 'арендодатель', 'квартира', 'жильё',
  ],
  utilities: [
    'electricity', 'electric', 'power', 'gas', 'water', 'utility', 'utilities', 'heating', 'bills',
    'işıq', 'elektrik', 'qaz', 'su', 'kommunal', 'istilik', 'azərişıq', 'azəriqaz', 'azərsu', 'qaz pulu', 'su pulu', 'işıq pulu',
    'doğalgaz', 'dogalgaz', 'suyu', 'ısınma', 'faturalar', 'elektrik faturası',
    'свет', 'электричество', 'электроэнергия', 'газ', 'газа', 'вода', 'воду', 'коммунальн', 'жкх', 'отопление', 'счета',
  ],
  phone: [
    'internet', 'mobile', 'cell', 'tv', 'cable', 'broadband', 'wifi', 'phone bill', 'telephone',
    'mobil', 'telefon', 'kabel', 'azercell', 'bakcell', 'baktelecom', 'katv', 'iptv',
    'cep', 'turkcell', 'vodafone', 'türk telekom', 'superonline', 'digiturk',
    'интернет', 'мобильн', 'телефон', 'связь', 'тв', 'телевидение', 'мтс', 'билайн', 'мегафон', 'ростелеком',
  ],
  loans: [
    'loan', 'credit', 'bank loan', 'car loan',
    'kredit', 'ssuda', 'bank krediti',
    'kredi', 'ihtiyaç kredisi', 'taşıt kredisi',
    'кредит', 'займ', 'заём', 'автокредит',
  ],
  installments: [
    'installment', 'instalment', 'payment plan', 'bnpl',
    'taksit', 'birkart', 'tamkart', 'albalı',
    'taksitli',
    'рассрочк',
  ],
  subscriptions: [
    'subscription', 'netflix', 'spotify', 'youtube', 'icloud', 'google one', 'disney', 'hbo', 'prime video', 'apple music', 'apple tv', 'music',
    'video', 'streaming', 'app store', 'google play', 'chatgpt', 'xbox', 'playstation', 'deezer',
    'abunə', 'abunəlik', 'musiqi',
    'abonelik', 'üyelik', 'müzik', 'exxen', 'blutv',
    'подписк', 'музык', 'видео', 'кинопоиск', 'яндекс плюс', 'okko', 'ivi',
  ],
  insurance: [
    'insurance', 'insur', 'policy',
    'sığorta', 'kasko', 'icbari',
    'sigorta', 'trafik sigortası',
    'страхов', 'осаго', 'каско', 'полис',
  ],
  education: [
    'school', 'course', 'tuition', 'kindergarten', 'nursery', 'tutor', 'university', 'daycare', 'lesson', 'classes',
    'məktəb', 'kurs', 'bağça', 'uşaq bağçası', 'repetitor', 'universitet', 'təhsil', 'dərs',
    'okul', 'kreş', 'anaokulu', 'dershane', 'üniversite', 'eğitim', 'özel ders',
    'школ', 'курс', 'садик', 'детский сад', 'репетитор', 'университет', 'обучение', 'учеба', 'учёба', 'секци',
  ],
};
const STRONG = new Set<CategoryKey>(['loans', 'installments']);
const KW: { key: CategoryKey; parts: string[] }[] = Object.entries(KEYWORDS).flatMap(([key, list]) =>
  list.map((k) => ({ key: key as CategoryKey, parts: tokens(k) })).filter((x) => x.parts.length > 0),
);

function partMatches(token: string, kw: string, last: boolean): boolean {
  if (!last || kw.length <= 3) return token === kw;
  return token.startsWith(kw);
}
/** Every category whose keyword occurs in the text. */
export function matchCategories(text: string): Set<CategoryKey> {
  const ts = tokens(text);
  const out = new Set<CategoryKey>();
  if (!ts.length) return out;
  for (const { key, parts } of KW) {
    for (let i = 0; i + parts.length <= ts.length; i++) {
      if (parts.every((p, j) => partMatches(ts[i + j], p, j === parts.length - 1))) {
        out.add(key);
        break;
      }
    }
  }
  return out;
}
/** One category, or null when there is none or it is ambiguous. Loans/installments outrank product words. */
export function categoryFromText(text: string): CategoryKey | null {
  const hit = matchCategories(text);
  if (hit.size === 0) return null;
  const strong = [...hit].filter((k) => STRONG.has(k));
  if (strong.length === 1) return strong[0];
  if (strong.length > 1) return null;
  return hit.size === 1 ? [...hit][0] : null;
}

// ------------------------------------------------------------------ suggestion while typing

export interface PastChoice { name: string; payee?: string | null; envelopeId: string; updatedAt?: string }
export type CategorySuggestion =
  | { envelopeId: string; source: 'payee' | 'name' }
  | { key: CategoryKey; source: 'keyword' }
  | null;

function uniqueEnvelope(past: PastChoice[], pick: (p: PastChoice) => string, value: string, valid?: (id: string) => boolean): string | null {
  const v = foldText(value).trim();
  if (!v) return null;
  const ids = new Set(past.filter((p) => foldText(pick(p)).trim() === v && (!valid || valid(p.envelopeId))).map((p) => p.envelopeId));
  return ids.size === 1 ? [...ids][0] : null;
}

/**
 * Suggest a category for a payment from its name and payee.
 * 1. The person's own earlier choice for the same payee (then the same name) wins, when it was always the same envelope.
 * 2. Otherwise the keyword table; name and payee must not point at different categories.
 * Ambiguous input gives null: the form then never auto-picks.
 */
export function suggestCategory(i: { name: string; payee?: string | null; past?: PastChoice[]; validEnvelope?: (id: string) => boolean }): CategorySuggestion {
  const past = i.past ?? [];
  const byPayee = uniqueEnvelope(past, (p) => p.payee ?? '', i.payee ?? '', i.validEnvelope);
  if (byPayee) return { envelopeId: byPayee, source: 'payee' };
  const byName = uniqueEnvelope(past, (p) => p.name, i.name, i.validEnvelope);
  if (byName) return { envelopeId: byName, source: 'name' };
  const nameHits = matchCategories(i.name);
  const a = categoryFromText(i.name);
  if (nameHits.size > 0 && !a) return null; // the name itself is ambiguous
  const b = categoryFromText(i.payee ?? '');
  if (a && b && a !== b && !(STRONG.has(a) && !STRONG.has(b))) return null;
  const key = a ?? b;
  return key ? { key, source: 'keyword' } : null;
}

/** Past choices from the saved payments (newest first), for `suggestCategory`. */
export function pastChoices(rules: Pick<CommitmentRule, 'name' | 'payee' | 'envelopeId' | 'deletedAt' | 'updatedAt'>[], plans: Pick<InstallmentPlan, 'name' | 'payee' | 'envelopeId' | 'deletedAt' | 'updatedAt'>[]): PastChoice[] {
  return [...rules, ...plans]
    .filter((x) => !x.deletedAt)
    .map((x) => ({ name: x.name, payee: x.payee ?? null, envelopeId: x.envelopeId, updatedAt: x.updatedAt }))
    .sort((a, b) => ((a.updatedAt ?? '') < (b.updatedAt ?? '') ? 1 : -1));
}

// ------------------------------------------------------------------ icons for a new envelope

const ICON_WORDS: [string, string[]][] = [
  ['shopping-basket', ['food', 'grocer', 'market', 'bazar', 'ərzaq', 'yemək', 'market', 'gıda', 'mutfak', 'еда', 'продукт']],
  ['coffee', ['coffee', 'cafe', 'kafe', 'qəhvə', 'kahve', 'кофе', 'кафе']],
  ['utensils', ['restaurant', 'restoran', 'lunch', 'nahar', 'öğle', 'ресторан', 'обед']],
  ['bus', ['transport', 'bus', 'metro', 'taxi', 'taksi', 'nəqliyyat', 'avtobus', 'ulaşım', 'otobüs', 'транспорт', 'автобус', 'такси', 'метро']],
  ['fuel', ['fuel', 'petrol', 'benzin', 'yanacaq', 'akaryakıt', 'бензин', 'топливо']],
  ['car', ['car', 'auto', 'maşın', 'avtomobil', 'araba', 'araç', 'машин', 'авто']],
  ['pill', ['pharmacy', 'aptek', 'eczane', 'dərman', 'ilaç', 'аптек', 'лекарств']],
  ['heart-pulse', ['health', 'doctor', 'sağlamlıq', 'həkim', 'sağlık', 'doktor', 'здоров', 'врач']],
  ['gift', ['gift', 'present', 'hədiyyə', 'hediye', 'подар']],
  ['shirt', ['clothes', 'clothing', 'geyim', 'paltar', 'giyim', 'kıyafet', 'одежд']],
  ['baby', ['kid', 'child', 'baby', 'uşaq', 'körpə', 'çocuk', 'bebek', 'дет', 'ребен', 'ребён']],
  ['paw-print', ['pet', 'dog', 'cat', 'heyvan', 'pişik', 'evcil', 'köpek', 'kedi', 'питом', 'собак', 'кошк']],
  ['plane', ['travel', 'trip', 'holiday', 'vacation', 'səyahət', 'tətil', 'seyahat', 'tatil', 'путешеств', 'отпуск']],
  ['gamepad-2', ['game', 'oyun', 'игр']],
  ['sparkles', ['fun', 'əyləncə', 'eğlence', 'развлеч', 'beauty', 'gözəllik', 'güzellik', 'красот']],
  ['book-open', ['book', 'kitab', 'kitap', 'книг']],
  ['wrench', ['repair', 'təmir', 'tamir', 'ремонт']],
  ['bike', ['sport', 'gym', 'idman', 'spor', 'спорт', 'фитнес']],
  ['piggy-bank', ['saving', 'yığım', 'birikim', 'накоплен', 'копил']],
];
const ICON_KW = ICON_WORDS.flatMap(([icon, list]) => list.map((k) => ({ icon, parts: tokens(k) })));
/** Icon suggested for a new envelope from its name: a category icon first, then everyday words; null = keep the default. */
export function suggestIcon(name: string): string | null {
  const key = categoryFromText(name) ?? inferByTemplateName(name);
  if (key) return CATEGORY_ICON[key];
  const ts = tokens(name);
  for (const { icon, parts } of ICON_KW) {
    for (let i = 0; i + parts.length <= ts.length; i++) if (parts.every((p, j) => partMatches(ts[i + j], p, j === parts.length - 1))) return icon;
  }
  return null;
}

// ------------------------------------------------------------------ existing envelopes -> category key (migration)

/** Names the app's own templates gave category envelopes in EN/AZ/TR/RU (so "Kommunal", "Ev", "Taksitlər" map without guessing). */
const TEMPLATE_NAMES: Record<string, CategoryKey> = Object.fromEntries(
  ([
    ['housing', ['home', 'ev', 'дом', 'housing', 'mənzil', 'konut', 'жилье']],
    ['utilities', ['bills', 'kommunal', 'faturalar', 'счета', 'utilities', 'коммунальные']],
    ['installments', ['installments', 'taksitlər', 'taksitler', 'рассрочки']],
    ['loans', ['loans', 'kreditlər', 'krediler', 'кредиты']],
    ['phone', ['phone & internet', 'phone and internet', 'telefon və internet', 'telefon ve internet', 'связь и интернет']],
    ['subscriptions', ['subscriptions', 'abunəliklər', 'abonelikler', 'подписки']],
    ['insurance', ['insurance', 'sığorta', 'sigorta', 'страховка']],
    ['education', ['education & kids', 'education and kids', 'təhsil və uşaqlar', 'eğitim ve çocuk', 'учёба и дети', 'учеба и дети']],
    ['other', ['other', 'digər', 'diğer', 'другое']],
  ] as [CategoryKey, string[]][]).flatMap(([k, names]) => names.map((n) => [tokens(n).join(' '), k])),
);
function inferByTemplateName(name: string): CategoryKey | null {
  return TEMPLATE_NAMES[tokens(name).join(' ')] ?? null;
}
const ICON_CATEGORY: Record<string, CategoryKey> = {
  house: 'housing', receipt: 'utilities', zap: 'utilities', droplets: 'utilities', 'calendar-clock': 'installments', landmark: 'loans', wifi: 'phone',
  smartphone: 'phone', repeat: 'subscriptions', umbrella: 'insurance', 'graduation-cap': 'education',
};

/** Category of an existing FIXED envelope from its name (template names, then keywords), then its icon. Null when unsure. */
export function inferCategoryKey(e: Pick<Envelope, 'name' | 'icon' | 'kind'>): CategoryKey | null {
  if (e.kind !== 'fixed') return null;
  return inferByTemplateName(e.name) ?? categoryFromText(e.name) ?? ICON_CATEGORY[e.icon] ?? null;
}

/**
 * Gives envelopes without a key the inferred one, never twice: a key already used (or claimed by an envelope earlier in
 * `order`) is not given again. Pure; returns the key per envelope id for the ones that change.
 */
export function assignCategoryKeys(envs: (Pick<Envelope, 'id' | 'name' | 'icon' | 'kind' | 'order'> & { categoryKey?: string | null; deletedAt?: string | null })[]): Record<string, CategoryKey> {
  const taken = new Set<CategoryKey>();
  for (const e of envs) if (!e.deletedAt && isCategoryKey(e.categoryKey)) taken.add(e.categoryKey);
  const out: Record<string, CategoryKey> = {};
  for (const e of [...envs].sort((a, b) => a.order - b.order)) {
    if (e.deletedAt || isCategoryKey(e.categoryKey)) continue;
    const k = inferCategoryKey(e);
    if (k && !taken.has(k)) {
      taken.add(k);
      out[e.id] = k;
    }
  }
  return out;
}

// ------------------------------------------------------------------ Payments panel: "By category"

export interface CategoryTotal {
  envelopeId: string;
  /** every payment in this envelope (finished ones too) */
  count: number;
  /** monthly equivalent of the active repeating payments and loans, base currency */
  perMonth: Minor;
  /** what the active repeating payments and loans come to over the next 12 months, base currency */
  perYear: Minor;
  /** unpaid one-time payments, base currency */
  oneTime: Minor;
  /** at least one active repeating payment or loan */
  recurring: boolean;
}

const PER_YEAR: Record<CommitmentRule['frequency'], number> = { once: 0, weekly: 52, biweekly: 26, monthly: 12, yearly: 1 };

/**
 * One row per envelope that has payments. Monthly = repeating amounts per month (weekly x 52 / 12, yearly / 12, ...) plus the
 * monthly payment of active loans; yearly = the same repeating amounts x their yearly count, plus what active loans still
 * have due in the next 12 months (a loan ending sooner counts only what is left). Paused or finished items are counted but
 * add nothing. Sorted by the monthly total, then one-time, then name order of the envelopes given.
 */
export function paymentsByCategory(items: PaymentSummary[], rules: CommitmentRule[], plans: InstallmentPlan[], today: DateStr, money?: Money, envelopeOrder: string[] = []): CategoryTotal[] {
  const rows = new Map<string, CategoryTotal>();
  const row = (id: string) => {
    let r = rows.get(id);
    if (!r) rows.set(id, (r = { envelopeId: id, count: 0, perMonth: 0, perYear: 0, oneTime: 0, recurring: false }));
    return r;
  };
  const yearEnd = addMonthsClamped(today, 12);
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  const planById = new Map(plans.map((p) => [p.id, p]));
  for (const x of items) {
    const r = row(x.envelopeId);
    r.count++;
    const active = x.group !== 'done' && x.state !== 'paused' && x.state !== 'ended';
    if (!active) continue;
    if (x.ref === 'rule') {
      const rule = ruleById.get(x.id);
      if (!rule) continue;
      const amt = toBase(rule.amount, rule.currency, money);
      if (rule.frequency === 'once') {
        r.oneTime += (x.waiting.length ? x.waiting : x.next ? [x.next] : []).reduce((s, o) => s + toBase(o.amount, rule.currency, money), 0);
        continue;
      }
      const n = PER_YEAR[rule.frequency];
      r.perMonth += Math.round((amt * n) / 12);
      r.perYear += amt * n;
      r.recurring = true;
    } else {
      const p = planById.get(x.id);
      if (!p || !x.loan) continue;
      r.perMonth += toBase(x.next?.amount ?? p.paymentAmount, p.currency, money);
      r.perYear += x.loan.occurrences
        .filter((o) => (o.state === 'waiting' || o.state === 'scheduled') && o.dueDate < yearEnd)
        .reduce((s, o) => s + toBase(o.amount, p.currency, money), 0);
      r.recurring = true;
    }
  }
  const pos = (id: string) => {
    const i = envelopeOrder.indexOf(id);
    return i < 0 ? Infinity : i;
  };
  return [...rows.values()].sort((a, b) => b.perMonth - a.perMonth || b.oneTime - a.oneTime || pos(a.envelopeId) - pos(b.envelopeId));
}
