import { describe, expect, it } from 'vitest';
import type { CommitmentRule, InstallmentPlan, Transaction } from './types';
import { dataset, env, event, income, period, planLines, tx } from './testkit';
import { Engine } from './engine';
import {
  loanStatus, paymentsOverview, payeeSuggestions, reservationsFor, ruleStatus, splitLoanPayment, amountIn, loanTotal,
} from './payments';
import { postingsDue, commitmentsDue } from './schedule';
import { parseAmountInput } from './money';

const NOW = '2026-04-01T00:00:00.000Z';
const b = (id: string) => ({ id, createdAt: NOW, updatedAt: NOW, deletedAt: null, rev: '0' });
const loan = (extra: Partial<InstallmentPlan> = {}): InstallmentPlan => ({
  ...b('L'), workspaceId: 'w', name: 'Car loan', envelopeId: 'inst', currency: 'AZN', paymentAmount: 10000, paymentCount: 6,
  firstDueDate: '2026-01-10', paidBeforeCount: 0, skipped: [], status: 'active', kind: 'loan', autoPost: false, ...extra,
});
const rule = (extra: Partial<CommitmentRule> = {}): CommitmentRule => ({
  ...b('R'), workspaceId: 'w', name: 'Gas', envelopeId: 'bills', amount: 3000, currency: 'AZN', frequency: 'monthly',
  anchorDate: '2026-01-03', dayOfMonth: 3, endDate: null, estimate: false, active: true, skippedDates: [], autoPost: false, ...extra,
});
const pay = (id: string, n: number | null, date: string, amount: number, extra: Partial<Transaction> = {}) =>
  tx(id, 'inst', date, amount, { source: 'installment', installmentId: 'L', installmentNo: n, ...extra });
const rpay = (id: string, due: string, date: string, amount: number) =>
  tx(id, 'bills', date, amount, { source: 'recurring', recurringRuleId: 'R', occurrenceDate: due, occKey: `R:${due}` });

describe('loan accounting from real payments', () => {
  it('fresh loan: total, nothing paid, waiting vs scheduled by date', () => {
    const s = loanStatus(loan(), [], '2026-02-15');
    expect(s.total).toBe(60000);
    expect(s.paid).toBe(0);
    expect(s.remaining).toBe(60000);
    expect(s.paymentsLeft).toBe(6);
    expect(s.occurrences.map((o) => o.state)).toEqual(['waiting', 'waiting', 'scheduled', 'scheduled', 'scheduled', 'scheduled']);
    expect(s.payoffDate).toBe('2026-06-10');
    expect(s.next?.n).toBe(1);
  });
  it('payments already made count as paid, without transactions', () => {
    const s = loanStatus(loan({ paidBeforeCount: 2 }), [], '2026-02-15');
    expect(s.paid).toBe(20000);
    expect(s.remaining).toBe(40000);
    expect(s.occurrences.slice(0, 2).every((o) => o.state === 'paid' && o.before)).toBe(true);
    expect(s.waiting).toHaveLength(0);
  });
  it('partial payment: occurrence is paid with the actual amount, the difference stays owed as a smaller last payment', () => {
    const s = loanStatus(loan(), [pay('t1', 1, '2026-01-10', 7000)], '2026-01-20');
    expect(s.occurrences[0]).toMatchObject({ state: 'paid', amount: 7000 });
    expect(s.paid).toBe(7000);
    expect(s.remaining).toBe(53000);
    // 5 full payments + 3,000 at the end
    expect(s.occurrences.filter((o) => o.state !== 'paid').map((o) => o.amount)).toEqual([10000, 10000, 10000, 10000, 10000, 3000]);
    expect(s.payoffDate).toBe('2026-07-10');
  });
  it('extra payment shortens the term (same monthly amount) and moves payoff earlier', () => {
    const before = loanStatus(loan(), [pay('t1', 1, '2026-01-10', 10000)], '2026-01-20');
    const after = loanStatus(loan(), [pay('t1', 1, '2026-01-10', 10000), pay('x', null, '2026-01-20', 25000)], '2026-01-20');
    expect(before.paymentsLeft).toBe(5);
    expect(after.remaining).toBe(25000);
    expect(after.extraPaid).toBe(25000);
    expect(after.paymentsLeft).toBe(3);
    expect(after.occurrences.filter((o) => o.state === 'scheduled').map((o) => o.amount)).toEqual([10000, 10000, 5000]);
    expect(after.payoffDate! < before.payoffDate!).toBe(true);
    expect(after.payoffDate).toBe('2026-04-10');
  });
  it('overpay beyond what is left is capped; the rest is a normal expense', () => {
    expect(splitLoanPayment(25000, 30000)).toEqual({ toLoan: 25000, rest: 5000 });
    expect(splitLoanPayment(25000, 10000)).toEqual({ toLoan: 10000, rest: 0 });
    expect(splitLoanPayment(0, 500)).toEqual({ toLoan: 0, rest: 500 });
    // even if a bigger amount is linked by hand, remaining never goes below zero and the loan is done
    const s = loanStatus(loan({ paymentCount: 2 }), [pay('a', 1, '2026-01-10', 10000), pay('b', null, '2026-01-11', 15000)], '2026-01-12');
    expect(s.remaining).toBe(0);
    expect(s.done).toBe(true);
    expect(s.paymentsLeft).toBe(0);
  });
  it('skip keeps the amount owed: one more payment at the end', () => {
    const s = loanStatus(loan({ skipped: [2] }), [pay('t1', 1, '2026-01-10', 10000)], '2026-02-20');
    expect(s.occurrences[1]).toMatchObject({ n: 2, state: 'skipped' });
    expect(s.remaining).toBe(50000);
    expect(s.paymentsLeft).toBe(5);
    expect(s.payoffDate).toBe('2026-07-10');
  });
  it('waived occurrences (pre-v3 skip meaning) are not owed', () => {
    const p = loan({ skipped: [2], waived: [2] });
    expect(loanTotal(p)).toBe(50000);
    const s = loanStatus(p, [pay('t1', 1, '2026-01-10', 10000)], '2026-02-20');
    expect(s.remaining).toBe(40000);
    expect(s.payoffDate).toBe('2026-06-10');
  });
  it('early pay: paying the next one before its due date marks it paid', () => {
    const s = loanStatus(loan(), [pay('t1', 1, '2026-01-05', 10000)], '2026-01-05');
    expect(s.occurrences[0]).toMatchObject({ state: 'paid', paidDate: '2026-01-05' });
    expect(s.next?.n).toBe(2);
  });
  it('deleted (undone) payments do not count', () => {
    const s = loanStatus(loan(), [pay('t1', 1, '2026-01-10', 10000, { deletedAt: NOW })], '2026-01-20');
    expect(s.paid).toBe(0);
    expect(s.waiting.map((o) => o.n)).toEqual([1]);
  });
  it('multi-currency: a USD loan is counted in USD even when a payment was entered in the base currency', () => {
    const p = loan({ currency: 'USD', paymentAmount: 10000 });
    const t = pay('t1', 1, '2026-01-10', 17000, { currency: 'AZN', amountBase: 17000 });
    const s = loanStatus(p, [t], '2026-01-20', { base: 'AZN', rates: { USD: { rate: '1.7' } } });
    expect(s.occurrences[0].amount).toBe(10000);
    expect(amountIn(pay('t2', 2, '2026-02-10', 10000, { currency: 'USD', amountBase: 17000 }), 'USD')).toBe(10000);
  });
  it('interest share, contract share method (no rate)', () => {
    const p = loan({ paymentCount: 12, paymentAmount: 10000, principal: 100000 });
    const s = loanStatus(p, [pay('t1', 1, '2026-01-10', 10000)], '2026-01-20');
    expect(s.interest).toMatchObject({ method: 'share', interestTotal: 20000, interestPaid: 1667, principalPaid: 8333, principalLeft: 91667 });
  });
  it('interest share, simple monthly amortization with a rate; extras repay the balance only', () => {
    const p = loan({ paymentCount: 12, paymentAmount: 10000, principal: 100000, interestRate: 24 });
    const s = loanStatus(p, [pay('t1', 1, '2026-01-10', 10000), pay('x', null, '2026-01-15', 5000)], '2026-01-20');
    // month 1: interest = 100000 * 24 / 1200 = 2000, principal 8000; extra 5000 -> balance 87000
    expect(s.interest).toMatchObject({ method: 'rate', interestPaid: 2000, principalPaid: 13000, principalLeft: 87000 });
    expect(loanStatus(loan(), [], '2026-01-01').interest).toBeNull();
  });
  it('cancelled plans stop scheduling', () => {
    const s = loanStatus(loan({ status: 'cancelled' }), [pay('t1', 1, '2026-01-10', 10000)], '2026-03-20');
    expect(s.paymentsLeft).toBe(0);
  });
});

describe('repeating and one-time payments', () => {
  const w = { today: '2026-03-05', firstStart: '2026-01-01', to: '2026-04-30' };
  it('confirm mode: due dates wait until paid; paid uses the actual amount; this-year total', () => {
    const s = ruleStatus(rule(), [rpay('a', '2026-01-03', '2026-01-04', 2800), rpay('b', '2026-02-03', '2026-02-03', 3400)], w);
    expect(s.occurrences.map((o) => `${o.dueDate}:${o.state}`)).toEqual(['2026-01-03:paid', '2026-02-03:paid', '2026-03-03:waiting', '2026-04-03:scheduled']);
    expect(s.occurrences[1].amount).toBe(3400);
    expect(s.waiting).toHaveLength(1);
    expect(s.paidThisYear).toBe(6200);
    expect(s.history.map((h) => h.txId)).toEqual(['b', 'a']);
  });
  it('skip removes the wait; early pay settles the next one', () => {
    const s = ruleStatus(rule({ skippedDates: ['2026-03-03'] }), [rpay('a', '2026-04-03', '2026-03-05', 3000)], { ...w, firstStart: '2026-03-01' });
    expect(s.waiting).toHaveLength(0);
    expect(s.occurrences.find((o) => o.dueDate === '2026-04-03')?.state).toBe('paid');
    expect(s.next?.dueDate).toBe('2026-05-03');
  });
  it('nothing older than the first period waits', () => {
    expect(ruleStatus(rule(), [], { ...w, firstStart: '2026-03-01' }).waiting.map((o) => o.dueDate)).toEqual(['2026-03-03']);
  });
  it('one-time payment is done once paid; paused rules do not wait', () => {
    const once = rule({ frequency: 'once', anchorDate: '2026-03-01', dayOfMonth: null });
    expect(ruleStatus(once, [], w).waiting).toHaveLength(1);
    expect(ruleStatus(once, [rpay('a', '2026-03-01', '2026-03-02', 3000)], w).done).toBe(true);
    expect(ruleStatus(rule({ active: false }), [], w).waiting).toHaveLength(0);
    expect(ruleStatus(rule({ pausedAt: '2026-02-01' }), [], w).waiting.map((o) => o.dueDate)).toEqual(['2026-01-03']);
  });
});

describe('auto mode and migration of existing data', () => {
  it('rules and plans without autoPost (data from before v3) keep posting automatically', () => {
    const legacyRule = { ...rule() } as CommitmentRule;
    delete legacyRule.autoPost;
    const legacyPlan = { ...loan() } as InstallmentPlan;
    delete legacyPlan.autoPost;
    delete legacyPlan.kind;
    const due = postingsDue([legacyRule], [legacyPlan], new Set(), '2026-02-15');
    expect(due.filter((d) => d.kind === 'recurring').map((d) => d.occurrenceDate)).toEqual(['2026-01-03', '2026-02-03']);
    expect(due.filter((d) => d.kind === 'installment').map((d) => d.installmentNo)).toEqual([1, 2]);
  });
  it('confirm mode never posts by itself; auto mode posts from autoFrom on', () => {
    expect(postingsDue([rule()], [loan()], new Set(), '2026-02-15')).toEqual([]);
    const due = postingsDue([rule({ autoPost: true, autoFrom: '2026-02-01' })], [], new Set(), '2026-03-15');
    expect(due.map((d) => d.occurrenceDate)).toEqual(['2026-02-03', '2026-03-03']);
  });
  it('auto-posted loan payments follow the real schedule (extra payment shortens it)', () => {
    const p = loan({ autoPost: true, paymentCount: 3 });
    const txs = [pay('x', null, '2026-01-01', 15000)];
    const due = postingsDue([], [p], new Set(), '2026-06-30', txs);
    expect(due.map((d) => d.amount)).toEqual([10000, 5000]);
  });
});

describe('panel overview', () => {
  const plans = [loan({ paidBeforeCount: 1 })];
  const rules = [
    rule(),
    rule({ id: 'W', name: 'Water', amount: 1500, anchorDate: '2026-03-20', dayOfMonth: 20 }),
    rule({ id: 'I', name: 'Car insurance', frequency: 'once', anchorDate: '2026-06-01', dayOfMonth: null, amount: 40000, payee: 'Insurer' }),
  ];
  const txns = [rpay('a', '2026-02-03', '2026-02-03', 3000), pay('p2', 2, '2026-02-10', 10000)];
  const o = paymentsOverview({ rules, plans, txns, today: '2026-03-05', firstStart: '2026-02-01', to: '2026-04-04', periodStart: '2026-03-05', periodEnd: '2026-04-04', base: 'AZN', rates: {} });
  it('groups waiting / this period / later', () => {
    const g = Object.fromEntries(o.items.map((x) => [x.name, x.group]));
    expect(g).toEqual({ Gas: 'waiting', 'Car loan': 'period', Water: 'period', 'Car insurance': 'later' });
    expect(o.waitingCount).toBe(1);
  });
  it('still to pay this period = waiting + scheduled before the period end (in base currency)', () => {
    // gas 3,000 (waiting) + loan #3 on 03-10 10,000 + water on 03-20 1,500 (+ Gas 04-03 3,000)
    expect(o.stillToPay).toBe(3000 + 10000 + 1500 + 3000);
    expect(o.next?.dueDate).toBe('2026-03-10');
  });
  it('payee suggestions: previous payees, most used first, case-insensitive', () => {
    expect(payeeSuggestions([{ payee: 'City Gas', deletedAt: null }, { payee: 'city gas', deletedAt: null }, { payee: 'Bank', deletedAt: null }], [], '')).toEqual(['City Gas', 'Bank']);
    expect(payeeSuggestions([{ payee: 'City Gas', deletedAt: null }], [], 'gas')).toEqual(['City Gas']);
  });
});

describe('reservations keep money set aside while a payment waits', () => {
  it('a waiting confirm-mode bill from the previous period is reserved again in the next one; auto ones are not', () => {
    const res = reservationsFor([rule()], [], [], '2026-03-05', '2026-04-04', '2026-02-01', '2026-03-05');
    expect(res.map((r) => r.date)).toEqual(['2026-02-03', '2026-03-03', '2026-04-03'].filter((d) => d >= '2026-02-01'));
    const auto = reservationsFor([rule({ autoPost: true })], [], [], '2026-03-05', '2026-04-04', '2026-02-01', '2026-03-05');
    expect(auto.map((r) => r.date)).toEqual(['2026-04-03']);
  });
  it('commitmentsDue uses the real loan schedule', () => {
    const due = commitmentsDue([], [loan()], [pay('x', null, '2026-01-01', 55000)] as Transaction[], '2026-01-01', '2026-12-31');
    expect(due.map((d) => d.amount)).toEqual([5000]);
  });
});

describe('safe-to-spend and confirming reserved payments', () => {
  // AZN, salary 1,000 received; bills envelope reserves gas 30 for this period
  const mk = (txs: Transaction[]) => {
    const envelopes = [env('bills', 'fixed', 0), env('food', 'flexible', 1), env('buffer', 'buffer', 2)];
    const ds = dataset({
      envelopes, incomes: [income('sal')], events: [event('e1', 'sal', '2026-03-05', 100000, '2026-03-05'), event('e2', 'sal', '2026-04-05', 100000)],
      periods: [period('p', '2026-03-05', '2026-04-04')], planLines: planLines('p', { bills: 3000, food: 60000 }), transactions: txs,
    });
    return new Engine(ds, '2026-03-10').current()!;
  };
  it('the hero is the same before and after "I paid" for a reserved payment', () => {
    const waiting = mk([]);
    const paid = mk([rpay('a', '2026-03-03', '2026-03-10', 3000)]);
    expect(paid.safe.leftToday).toBe(waiting.safe.leftToday);
    expect(paid.safe.pool).toBe(waiting.safe.pool);
  });
  it('while it waits, the reserved money is not counted as spendable', () => {
    const s = mk([]);
    expect(s.reserved).toBe(3000);
    expect(s.safe.flexPool).toBe(60000);
  });
  it('paying less leaves the rest in the bills envelope; paying more is covered by the Buffer first', () => {
    const less = mk([rpay('a', '2026-03-03', '2026-03-10', 2500)]);
    expect(less.available.bills).toBe(500);
    const more = mk([rpay('a', '2026-03-03', '2026-03-10', 3600)]);
    expect(more.safe.D).toBe(600);
    expect(more.safe.netDeficit).toBe(0); // Buffer (1,000 - 630 = 370) covers it
    expect(more.safe.leftToday).toBe(mk([]).safe.leftToday);
  });
  it('money is conserved: everything available = received - spent', () => {
    const s = mk([rpay('a', '2026-03-03', '2026-03-10', 3600)]);
    expect(Object.values(s.available).reduce((a, b) => a + b, 0)).toBe(100000 - 3600);
  });
});

describe('amount input never crashes (E-02)', () => {
  it.each([['', null], ['.', null], [',', null], ['1,2,3', null], ['abc', null], ['0', null], ['1.234', null], ['-5', null], ['99999999999999', null]])('"%s" -> %s', (s, want) => {
    expect(parseAmountInput(s, 2)).toBe(want);
  });
  it.each([['12', 1200], ['12,5', 1250], ['12.50', 1250], ['.5', 50], ['7,', 700], ['1 200', 120000]])('"%s" -> %s', (s, want) => {
    expect(parseAmountInput(s, 2)).toBe(want);
  });
  it('zero-decimal currencies', () => {
    expect(parseAmountInput('1500', 0)).toBe(1500);
    expect(parseAmountInput('15.5', 0)).toBeNull();
  });
});
