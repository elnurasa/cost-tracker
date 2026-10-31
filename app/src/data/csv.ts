import type { CommitmentRule, Envelope, InstallmentPlan, Minor, Transaction } from '../domain';
import { currencyExponent } from '../domain';

export const CSV_COLUMNS = ['id', 'date', 'type', 'amount', 'currency', 'rate', 'amount_base', 'base_currency', 'envelope', 'merchant', 'note', 'source', 'status', 'payee', 'payment_type', 'category'] as const;
/** payment_type values (machine format): once | repeating | loan | installment, empty for everyday entries.
 * category: the envelope's stable category key (housing, utilities, phone, loans, installments, subscriptions, insurance, education, other),
 * empty for envelopes that are not a payment category. The envelope column keeps the person's own envelope name. */

/** Integer minor units -> plain decimal with dot separator. */
export function decimalString(minor: Minor, exp: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  if (exp === 0) return `${sign}${abs}`;
  const p = 10 ** exp;
  return `${sign}${Math.floor(abs / p)}.${String(abs % p).padStart(exp, '0')}`;
}
function cell(v: string, delim: string): string {
  // RFC 4180 quoting; also neutralise spreadsheet formula injection
  let s = v;
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return s.includes(delim) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvOptions {
  semicolon: boolean;
  from?: string;
  to?: string;
  baseCurrency: string;
  envelopes: Envelope[];
  rules?: Pick<CommitmentRule, 'id' | 'frequency' | 'payee'>[];
  plans?: Pick<InstallmentPlan, 'id' | 'kind' | 'payee'>[];
}
export function buildCsv(txs: Transaction[], o: CsvOptions): string {
  const delim = o.semicolon ? ';' : ',';
  const names = new Map(o.envelopes.map((e) => [e.id, e.name]));
  const cats = new Map(o.envelopes.map((e) => [e.id, e.categoryKey ?? '']));
  const rows = txs
    .filter((t) => !t.deletedAt && (!o.from || t.date >= o.from) && (!o.to || t.date <= o.to))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt < b.createdAt ? -1 : 1));
  const rules = new Map((o.rules ?? []).map((r) => [r.id, r]));
  const plans = new Map((o.plans ?? []).map((p) => [p.id, p]));
  const payment = (t: Transaction): [string, string] => {
    const r = t.recurringRuleId ? rules.get(t.recurringRuleId) : undefined;
    if (r) return [r.payee ?? '', r.frequency === 'once' ? 'once' : 'repeating'];
    const p = t.installmentId ? plans.get(t.installmentId) : undefined;
    if (p) return [p.payee ?? '', p.kind === 'loan' ? 'loan' : 'installment'];
    return ['', ''];
  };
  const lines = [CSV_COLUMNS.join(delim)];
  for (const t of rows) {
    lines.push(
      [
        t.id, t.date, t.type, decimalString(t.amount, currencyExponent(t.currency)), t.currency, t.rate,
        decimalString(t.amountBase, currencyExponent(o.baseCurrency)), o.baseCurrency, t.envelopeId ? names.get(t.envelopeId) ?? '' : '',
        t.merchant ?? '', t.note ?? '', t.source, t.status, ...payment(t), t.envelopeId ? cats.get(t.envelopeId) ?? '' : '',
      ].map((c) => cell(String(c), delim)).join(delim),
    );
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
