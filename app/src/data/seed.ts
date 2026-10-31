import { addTransaction, completeOnboarding, ensureEnvelope, recordPayment, runMaintenance, saveInstallment, savePlan, saveRule, loadAll, type OnboardingPayload } from './repo';
import { Engine, addDays, addMonthsClamped, makeRoom, parseDate, reservationsFor, toBase, todayLocal, type Currency, type DateStr, type Locale, type Minor, type Region } from '../domain';
import { CATEGORY_ICON, type CategoryKey } from '../domain/categories';

export interface DemoNotes {
  coffee: string; market: string; bus: string; lunch: string; rent: string; phone: string; pharmacy: string; gift: string; cinema: string; taxi: string;
  // Payments panel sample (optional so older callers keep working; generic names, never real brands)
  carLoan?: string; bank?: string; phoneStore?: string; landlord?: string; electricity?: string; power?: string; gas?: string; gasCo?: string;
  water?: string; waterCo?: string; internet?: string; isp?: string; insurance?: string; insurer?: string;
  music?: string; musicCo?: string; video?: string; videoCo?: string;
}

/**
 * The plan of the current period sets aside what the sample's payments need (due and still unpaid, plus what was already
 * paid from it), with the same "make room" rule the payment form uses: Buffer first, then day-to-day envelopes.
 */
async function fundPayments(today: DateStr) {
  const d = (await loadAll())!;
  const eng = new Engine(d.ds, today);
  const period = eng.currentPeriod();
  const snap = eng.current();
  if (!period || !snap) return;
  const money = { base: d.ws.baseCurrency, rates: d.ws.rates };
  const need: Record<string, Minor> = {};
  for (const r of reservationsFor(d.rules, d.installments, d.ds.transactions, period.startDate, period.endDate, eng.periods[0]?.startDate ?? period.startDate, today, money)) {
    need[r.envelopeId] = (need[r.envelopeId] ?? 0) + toBase(r.amount, r.currency, money);
  }
  const live = d.ds.envelopes.filter((e) => !e.archived);
  let planned: Record<string, Minor> = Object.fromEntries(live.filter((e) => e.kind !== 'buffer').map((e) => [e.id, snap.rows[e.id]?.planned ?? 0]));
  const buffer = live.find((e) => e.kind === 'buffer');
  let bufferAlloc = buffer ? snap.alloc[buffer.id] ?? 0 : 0;
  const spent = Object.fromEntries(Object.entries(snap.rows).map(([k, v]) => [k, v.spent]));
  for (const e of live.filter((x) => x.kind === 'fixed')) {
    const short = (need[e.id] ?? 0) + Math.max(0, spent[e.id] ?? 0) - (planned[e.id] ?? 0);
    if (short <= 0) continue;
    const r = makeRoom({ amount: short, targetId: e.id, planned, bufferAlloc, envelopes: live, spent });
    planned = r.newAlloc;
    bufferAlloc -= r.fromBuffer;
  }
  await savePlan(period.id, planned, true);
}

/**
 * "Try with sample data": a clearly labelled, made-up workspace (twice-a-month pay, a rent rule and a phone installment)
 * whose last pay day was 8 days ago, so the app opens populated.
 */
/** Rough size of everyday prices relative to Azerbaijan (AZN = 1) so sample figures look realistic in each currency. */
const SCALE: Record<string, number> = { AZN: 1, USD: 0.6, EUR: 0.55, GBP: 0.47, TRY: 20, RUB: 55, KZT: 280, GEL: 1.6, UAH: 24 };

export async function seedDemo(o: {
  names: OnboardingPayload['names'];
  notes: DemoNotes;
  locale: Locale;
  region: Region;
  currency: Currency;
  today?: DateStr;
  /** names of the ready-made payment categories in the workspace language (cat.*) */
  catNames?: Partial<Record<CategoryKey, string>>;
}): Promise<void> {
  const today = o.today ?? todayLocal();
  const payday = addDays(today, -8);
  const k = SCALE[o.currency] ?? 1;
  // whole major units, rounded to a "price-like" step (5 for big scales, 0.10 otherwise)
  const px = (azn100: number) => (k >= 10 ? Math.round((azn100 * k) / 100 / 5) * 500 : Math.round((azn100 * k) / 10) * 10);
  const names = { ...o.names, income: { ...o.names.income, first: o.names.income.salary, second: o.names.income.advance } };
  const p = parseDate(payday);
  const second = addDays(payday, 15);
  await completeOnboarding({
    input: {
      today: payday, freq: 'twice', amount: px(110000), day: p.d, amount2: px(50000), day2: parseDate(second).d, nextPayDate: null, exp: 2,
    },
    locale: o.locale, region: o.region === 'GLOBAL' ? 'AZ' : o.region, currency: o.currency, moneyNow: px(110000), names,
    // a plan a person with these payments would make: bills sized to what they cost, room left for the loan and subscriptions
    amounts: {
      home: px(38000), bills: px(10000), installments: px(8500), food: px(32000), groceries: px(32000), transport: px(10000), family: px(6000),
      fun: px(8000), pocket: px(8000), savings: px(6000),
    },
  });
  await runMaintenance(payday);
  const d = (await loadAll())!;
  const env = (name: string) => d.ds.envelopes.find((e) => e.name === name)?.id ?? d.ds.envelopes.find((e) => e.kind === 'flexible')!.id;
  const food = env(o.names.envelope.food ?? o.names.envelope.groceries);
  const transport = env(o.names.envelope.transport);
  const fun = env(o.names.envelope.fun);
  const bills = env(o.names.envelope.bills);
  const home = env(o.names.envelope.home);
  const pocket = d.ds.envelopes.find((e) => e.kind === 'pocket')!.id;
  const at = (n: number) => addDays(payday, n);
  const plan: [number, string, number, string][] = [
    [1, food, px(2240), o.notes.market], [1, transport, px(60), o.notes.bus], [2, food, px(580), o.notes.lunch], [2, pocket, px(450), o.notes.coffee],
    [3, transport, px(400), o.notes.taxi], [4, food, px(1560), o.notes.market], [4, fun, px(1400), o.notes.cinema], [5, pocket, px(420), o.notes.coffee],
    [5, food, px(450), o.notes.lunch], [6, bills, px(2450), o.notes.pharmacy], [6, transport, px(60), o.notes.bus], [7, food, px(2130), o.notes.market],
    [7, fun, px(1500), o.notes.gift], [8, pocket, px(380), o.notes.coffee],
  ];
  for (const [n, envelopeId, amount, note] of plan) {
    if (at(n) > today) continue;
    await addTransaction({ type: 'expense', date: at(n), amount, currency: o.currency, envelopeId, note }, today);
  }
  const rentDay = at(1);
  const N = o.notes;
  const day = (d: DateStr) => parseDate(d).d;
  // rent goes out by standing order: automatic
  await saveRule({ name: N.rent, payee: N.landlord ?? null, envelopeId: home, amount: px(38000), frequency: 'monthly', anchorDate: rentDay, dayOfMonth: day(rentDay), autoPost: true }, today);
  // payment categories are envelopes: the template already has Housing (home), Utilities (bills) and Installments; the others
  // are created the way the payment form creates them (one envelope per category, never a duplicate)
  const cat = async (key: CategoryKey) => (await ensureEnvelope({ name: o.catNames?.[key] ?? key, icon: CATEGORY_ICON[key], kind: 'fixed', categoryKey: key })).envelope.id;
  const instEnv = await cat('installments');
  // a phone bought on taksit: 6 monthly payments, 2 already paid before the user started, the 3rd falls due in 5 days
  const nextDue = addDays(today, 5);
  await saveInstallment({ name: N.phone, payee: N.phoneStore ?? null, kind: 'installment', envelopeId: instEnv, paymentAmount: px(8500), paymentCount: 6, firstDueDate: addMonthsClamped(nextDue, -2), paidBeforeCount: 2, autoPost: false }, today);
  if (N.carLoan) {
    // a bank loan (kredit): 36 x 150, 10 paid before, borrowed 4,400 at 16 % a year, next payment in 12 days
    const loanNext = addDays(today, 12);
    await saveInstallment({
      name: N.carLoan, payee: N.bank ?? null, kind: 'loan', envelopeId: await cat('loans'), paymentAmount: px(15000), paymentCount: 36, firstDueDate: addMonthsClamped(loanNext, -10),
      paidBeforeCount: 10, principal: px(440000), interestRate: 16, autoPost: false,
    }, today);
  }
  if (N.electricity && N.gas && N.water && N.internet) {
    // utilities wait for "I paid": electricity already confirmed (a little under the estimate), gas waiting since 2 days, water later
    const elec = at(2);
    await saveRule({ name: N.electricity, payee: N.power ?? null, envelopeId: bills, amount: px(3500), frequency: 'monthly', anchorDate: elec, dayOfMonth: day(elec), autoPost: false }, today);
    await saveRule({ name: N.gas, payee: N.gasCo ?? null, envelopeId: bills, amount: px(2800), frequency: 'monthly', anchorDate: addDays(today, -2), dayOfMonth: day(addDays(today, -2)), autoPost: false }, today);
    await saveRule({ name: N.water, payee: N.waterCo ?? null, envelopeId: bills, amount: px(900), frequency: 'monthly', anchorDate: addDays(today, 10), dayOfMonth: day(addDays(today, 10)), autoPost: false }, today);
    await saveRule({ name: N.internet, payee: N.isp ?? null, envelopeId: await cat('phone'), amount: px(2500), frequency: 'monthly', anchorDate: addDays(today, 3), dayOfMonth: day(addDays(today, 3)), autoPost: true }, today);
    const all = (await loadAll())!;
    const er = all.rules.find((r) => r.name === N.electricity);
    if (er) await recordPayment({ ref: 'rule', id: er.id, dueDate: elec, amount: px(3460), date: at(3), envelopeId: bills }, today);
  }
  if (N.music && N.video) {
    // two subscriptions: 8 + 24 a month (the By category view shows 32 a month, 384 a year); paid by card automatically
    const sub = await cat('subscriptions');
    await saveRule({ name: N.music, payee: N.musicCo ?? null, envelopeId: sub, amount: px(800), frequency: 'monthly', anchorDate: addDays(today, 6), dayOfMonth: day(addDays(today, 6)), autoPost: true }, today);
    await saveRule({ name: N.video, payee: N.videoCo ?? null, envelopeId: sub, amount: px(2400), frequency: 'monthly', anchorDate: addDays(today, 15), dayOfMonth: day(addDays(today, 15)), autoPost: true }, today);
  }
  if (N.insurance) {
    // one-time, next period: shows under "Later" and as a one-time amount in its category, no money set aside yet
    const due = addDays(today, 35);
    await saveRule({ name: N.insurance, payee: N.insurer ?? null, envelopeId: await cat('insurance'), amount: px(45000), frequency: 'once', anchorDate: due, dayOfMonth: null, autoPost: false }, today);
  }
  await runMaintenance(today);
  await fundPayments(today);
}
