// Payments panel: where the money goes (payee), what kind of payment it is, and "pay as I go" accounting for loans
// and bills. All numbers come from domain/payments.ts (pure); this file only renders and calls data/repo.
import { useMemo, useState, type ReactNode } from 'react';
import { BackHeader, Button, Chip, ChipRow, DateInput, EmptyState, IconButton, Segmented, SectionTitle, TextInput, Toggle } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Money } from '../ui/display';
import { minorToRaw } from '../ui/NumberPad';
import { CurrencyPicker } from './AddSheet';
import { heroWithPlan } from './Plan';
import { NewEnvelopeSheet, type NewEnvelopeDraft } from './EnvelopeInline';
import { useI18n } from '../i18n';
import { useM } from '../state/ctx';
import { useUI } from '../state/ui';
import type { Model } from '../state/model';
import {
  atomic, capturePlan, deleteRule, ensureEnvelope, undoPaymentSave, type PaymentSaveUndo, endInstallment, pauseRule, recordPayment, reopenInstallment, resumeRule, saveInstallment, savePlan, saveRule,
  setAutoPost, skipInstallmentPayment, skipRuleOccurrence, undoPayment, unskipInstallmentPayment, unskipRuleOccurrence, updateWorkspace,
} from '../data/repo';
import {
  addMonthsClamped, currencyExponent, diffDays, floorMajor, isValidRate, loanDueDate, makeRoom, parseAmountInput, payeeSuggestions,
  paymentsByCategory, reservationsFor, toBase, type CommitmentRule, type DateStr, type Envelope, type InstallmentPlan, type PayGroup, type PaymentSummary, type PayOcc, type RowState,
  CATEGORY_ICON, SUGGESTED_FOR, pastChoices, suggestCategory, type CategoryKey,
} from '../domain';

type Filter = 'all' | 'loans' | 'repeating' | 'once';
type View = 'date' | 'category';
// kept while the app is open, like other per-tab view state (By date is the default on every launch)
let lastFilter: Filter = 'all';
let lastView: View = 'date';
let lastEnv: string | null = null;
/** Bidi-isolated amount inside a sentence (RTL-safe: the number never reorders around the words). */
const iso = (s: string) => `\u2066${s}\u2069`;

const ICON: Record<PaymentSummary['type'], string> = { loan: 'landmark', installment: 'calendar-clock', repeating: 'repeat', once: 'calendar-days' };

function useTypeLabel() {
  const { t } = useI18n();
  return (x: Pick<PaymentSummary, 'type' | 'frequency'>) =>
    x.type === 'loan' ? t('pay.type.loan') : x.type === 'installment' ? t('pay.type.installment') : x.type === 'once' ? t('pay.type.once')
      : t(x.frequency === 'weekly' ? 'pay.type.weekly' : x.frequency === 'biweekly' ? 'pay.type.biweekly' : x.frequency === 'yearly' ? 'pay.type.yearly' : 'pay.type.monthly');
}
function useStateLabel() {
  const { t } = useI18n();
  return (s: RowState) => t(`pay.state.${s}` as const);
}
function useWhen() {
  const { t, fmt } = useI18n();
  const m = useM();
  return (state: RowState, date: DateStr | null, paidDate?: DateStr | null): string => {
    if (!date) return '';
    if (state === 'paid') return t('pay.paidOn', { date: fmt.date(paidDate ?? date) });
    if (state === 'waiting') {
      const n = diffDays(m.today, date);
      return n > 0 ? t('pay.sinceDue', { n }) : t('pay.dueToday');
    }
    if (date === m.today) return t('pay.dueToday');
    return t('pay.due', { date: fmt.date(date) });
  };
}

const sum = (xs: PaymentSummary[]) => xs.length;
function matches(f: Filter, x: PaymentSummary) {
  return f === 'all' || (f === 'loans' ? x.type === 'loan' || x.type === 'installment' : f === 'once' ? x.type === 'once' : x.type === 'repeating');
}

/** Slim repaid bar. Screen readers get the numbers as text from the row instead (aria-hidden). */
function Repaid({ progress }: { progress: number }) {
  return (
    <div className="bar pay-bar" aria-hidden="true">
      <div className="bar-track"><div className="bar-fill ok" style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} /></div>
    </div>
  );
}

// ------------------------------------------------------------------ list

const isFilter = (f: string | undefined): f is Filter => f === 'all' || f === 'loans' || f === 'repeating' || f === 'once';

export function PaymentsList({ selected, wide, filter: routeFilter }: { selected?: string; wide?: boolean; filter?: string }) {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  const [filter, setFilterState] = useState<Filter>(isFilter(routeFilter) ? routeFilter : lastFilter);
  const setFilter = (f: Filter) => { lastFilter = f; setFilterState(f); };
  const [view, setViewState] = useState<View>(routeFilter === 'category' ? 'category' : isFilter(routeFilter) ? 'date' : lastView);
  const [envFilter, setEnvState] = useState<string | null>(routeFilter === 'category' ? null : lastEnv);
  const setView = (v: View) => { lastView = v; lastEnv = null; setViewState(v); setEnvState(null); };
  const setEnv = (id: string | null) => { lastEnv = id; setEnvState(id); };
  const o = m.payments;
  const byEnv = view === 'category' && envFilter ? envFilter : null;
  const items = byEnv ? o.items.filter((x) => x.envelopeId === byEnv) : o.items.filter((x) => matches(filter, x));
  const groups: PayGroup[] = ['waiting', 'period', 'later', 'done'];
  const nextItem = o.next ? o.items.find((x) => x.id === o.next!.refId) : undefined;
  const status = [
    o.waitingCount > 0 ? t('pay.status.waiting', { n: o.waitingCount }) : t('pay.status.clear'),
    nextItem && o.next ? t('pay.status.next', { name: nextItem.name, date: fmt.date(o.next.dueDate) }) : '',
  ].filter(Boolean).join(' · ');
  return (
    <div className="stack pay-list">
      <div className="primary-number">
        <span className="pn-label">{t('pay.stillToPay')}</span>
        <span className={wide ? 'pn-value pn-compact' : 'pn-value'}><Money minor={o.stillToPay} currency={m.base} /></span>
        <span className="pn-sub" role="status">{status}</span>
      </div>
      {o.items.length === 0 ? (
        <EmptyState title={t('pay.empty.title')} body={t('pay.empty.body')} action={<Button icon="plus" onClick={() => ui.openSheet({ kind: 'pay-new' })}>{t('pay.new')}</Button>} />
      ) : (
        <>
          <Segmented
            label={t('pay.view')}
            value={view}
            onChange={setView}
            options={[{ id: 'date', label: t('pay.view.date') }, { id: 'category', label: t('pay.view.category') }]}
          />
          {view === 'category' && !byEnv ? <CategoryList onOpen={setEnv} /> : (
          <>
          {view === 'date' ? (
            // type filter as light chips under the view switch, so the screen does not stack two heavy segmented bars
            <ChipRow label={t('pay.filter')}>
              {(['all', 'loans', 'repeating', 'once'] as const).map((f) => <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>{t(`pay.filter.${f}` as const)}</Chip>)}
            </ChipRow>
          ) : (
            <div className="cat-filter">
              <Button variant="text" icon="chevron-left" className="mirror-rtl" onClick={() => setEnv(null)}>{t('pay.cat.all')}</Button>
              <h2 className="cat-filter-title">{t('pay.cat.in', { name: m.env(byEnv)?.name ?? t('cat.other') })}</h2>
            </div>
          )}
          {byEnv && items.length === 0 && <p className="muted pad-x">{t('pay.cat.empty')}</p>}
          {groups.map((g) => {
            const xs = items.filter((x) => x.group === g);
            if (!sum(xs)) return null;
            return (
              <section key={g} aria-labelledby={`pg-${g}`}>
                <div className="section-title"><h2 id={`pg-${g}`}>{t(`pay.group.${g}` as const)}</h2></div>
                <div className="group">{xs.map((x) => <PaymentRow key={`${x.ref}${x.id}`} x={x} selected={selected === x.id} />)}</div>
              </section>
            );
          })}
          </>
          )}
          <Button variant="secondary" icon="plus" onClick={() => ui.openSheet({ kind: 'pay-new' })}>{t('pay.new')}</Button>
        </>
      )}
    </div>
  );
}

/** "By category": one row per envelope with payments (envelope = category). Monthly total, yearly for repeating ones. */
function CategoryList({ onOpen }: { onOpen: (envelopeId: string) => void }) {
  const m = useM();
  const { t, fmt } = useI18n();
  const rows = useMemo(
    () => paymentsByCategory(m.payments.items, m.data.rules, m.data.installments, m.today, { base: m.base, rates: m.data.ws.rates }, m.allEnvelopes.map((e) => e.id)),
    [m],
  );
  const money = (v: number) => fmt.money(v, m.base);
  return (
    <section aria-labelledby="pc-title">
      <h2 id="pc-title" className="sr-only">{t('pay.view.category')}</h2>
      <div className="group">
        {rows.map((r) => {
          const e = m.env(r.envelopeId);
          const name = e?.name ?? t('cat.other');
          const count = t('pay.cat.count', { n: r.count });
          const once = r.oneTime > 0 ? t('pay.cat.oneTime', { amount: iso(money(r.oneTime)) }) : '';
          const aria = [name, r.recurring ? t('pay.cat.monthAria', { amount: money(r.perMonth) }) : '', r.recurring ? t('pay.cat.perYear', { amount: money(r.perYear) }) : '', once, count].filter(Boolean).join('. ');
          return (
            <button key={r.envelopeId} type="button" className="list-item cat-row" onClick={() => onOpen(r.envelopeId)} aria-label={aria}>
              <span className={`tile tile-${e?.kind ?? 'fixed'}`}><Icon name={e?.icon ?? 'tag'} size={22} /></span>
              <span className="li-main">
                <span className="li-title">{name}</span>
                <span className="li-sub">{[count, r.recurring ? once : ''].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="cat-end" aria-hidden="true">
                {r.recurring ? (
                  <>
                    <span className="li-amount num">{t('pay.cat.perMonth', { amount: iso(money(r.perMonth)) })}</span>
                    <span className="li-sub">{t('pay.cat.perYear', { amount: iso(money(r.perYear)) })}</span>
                  </>
                ) : <span className="li-amount num">{once || money(0)}</span>}
              </span>
              <Icon name="chevron-right" size={20} mirror />
            </button>
          );
        })}
      </div>
      <p className="note pad-x">{t('pay.cat.help')}</p>
    </section>
  );
}

function PaymentRow({ x, selected }: { x: PaymentSummary; selected?: boolean }) {
  const ui = useUI();
  const { t, fmt } = useI18n();
  const typeLabel = useTypeLabel();
  const stateLabel = useStateLabel();
  const when = useWhen();
  const occ = x.waiting[0] ?? x.next;
  const lastPaid = x.rule?.history[0]?.date ?? null;
  const dateText = x.state === 'paid' && x.loan?.done ? t('pay.allRepaid') : when(x.state, x.date, x.state === 'paid' ? lastPaid : null);
  const sub = [x.payee, typeLabel(x), x.autoPost && x.group !== 'done' ? t('pay.auto') : null].filter(Boolean).join(' · ');
  return (
    <div className={`pay-row${selected ? ' is-selected' : ''}`}>
      <button type="button" className="pay-row-main" onClick={() => ui.go(`/payments/${x.ref}/${x.id}`)} aria-current={selected ? 'true' : undefined}>
        <span className="tile tile-fixed"><Icon name={ICON[x.type]} size={22} /></span>
        <span className="li-main">
          <span className="li-title">{x.name}</span>
          <span className="li-sub">{sub}</span>
          {x.loan && (
            <>
              <Repaid progress={x.loan.progress} />
              <span className="li-sub">{t('pay.left', { amount: fmt.money(x.loan.remaining, x.currency) })}</span>
              <span className="sr-only">{t('pay.repaidAria', { paid: fmt.money(x.loan.paid, x.currency), total: fmt.money(x.loan.total, x.currency) })}</span>
            </>
          )}
        </span>
        <span className="pay-row-end">
          <Money minor={x.amount} currency={x.currency} className="li-amount" />
          {dateText && <span className="li-sub">{dateText}</span>}
          <span className={`pill ${x.state}`}>{stateLabel(x.state)}</span>
        </span>
      </button>
      {x.group === 'waiting' && occ && (
        <div className="pay-row-actions">
          <Button variant="secondary" onClick={() => ui.openSheet({ kind: 'pay-confirm', ref: x.ref, id: x.id, dueDate: occ.dueDate, n: occ.n })} aria-label={t('pay.iPaidFor', { name: x.name })}>
            {t('pay.iPaid')}
          </Button>
          {x.waiting.length > 1 && <span className="li-sub">{t('pay.waitingCount', { n: x.waiting.length })}</span>}
        </div>
      )}
    </div>
  );
}

export function PaymentsPage({ filter }: { filter?: string }) {
  const ui = useUI();
  const { t } = useI18n();
  return (
    <main className="page" id="main">
      <header className="page-header">
        <h1 className="page-title">{t('pay.title')}</h1>
        <div className="page-right"><IconButton icon="plus" label={t('pay.new')} onClick={() => ui.openSheet({ kind: 'pay-new' })} /></div>
      </header>
      <div className="page-body"><PaymentsList filter={filter} /></div>
    </main>
  );
}

/** Tablet: the list lives in the left pane; the right pane shows the selected payment. */
export function PaymentsPane({ selected }: { selected?: string }) {
  const { t } = useI18n();
  return (
    <aside className="pane-left pay-pane" aria-label={t('pay.title')}>
      <div className="pane-left-list"><PaymentsList selected={selected} wide /></div>
    </aside>
  );
}
export function PaymentsPick() {
  const { t } = useI18n();
  const ui = useUI();
  return (
    <main className="page" id="main">
      <header className="page-header"><h1 className="page-title">{t('pay.title')}</h1></header>
      <div className="page-body"><EmptyState title={t('pay.pickOne')} action={<Button icon="plus" onClick={() => ui.openSheet({ kind: 'pay-new' })}>{t('pay.new')}</Button>} /></div>
    </main>
  );
}

// ------------------------------------------------------------------ detail

export function PaymentDetailPage({ refKind, id }: { refKind: 'rule' | 'loan'; id: string }) {
  const m = useM();
  const ui = useUI();
  const { t } = useI18n();
  const x = m.payments.items.find((i) => i.ref === refKind && i.id === id);
  return (
    <main className="page" id="main">
      <BackHeader title={x?.name ?? t('pay.title')} onBack={() => ui.back('/payments')} right={x ? <IconButton icon="pencil" label={t('common.edit')} onClick={() => ui.openSheet({ kind: 'pay-edit', ref: x.ref, id: x.id })} /> : undefined} />
      <div className="page-body">{x ? (x.loan ? <LoanDetail x={x} /> : <RuleDetail x={x} />) : <EmptyState title={t('pay.pickOne')} />}</div>
    </main>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function OccRow({ o, label, currency, onSkipUndo }: { o: PayOcc; label: string; currency: string; onSkipUndo?: () => void }) {
  const stateLabel = useStateLabel();
  const when = useWhen();
  const { t } = useI18n();
  return (
    <div className="list-item static">
      <span className="li-main">
        <span className="li-title">{label}</span>
        <span className="li-sub">{o.before ? t('pay.before') : when(o.state, o.dueDate, o.paidDate)}</span>
      </span>
      {o.amount > 0 && <Money minor={o.amount} currency={currency} className="li-amount" />}
      <span className={`pill ${o.state}`}>{stateLabel(o.state)}</span>
      {o.state === 'skipped' && onSkipUndo && <Button variant="text" onClick={onSkipUndo}>{t('common.undo')}</Button>}
    </div>
  );
}

function AutoToggle({ x }: { x: PaymentSummary }) {
  const m = useM();
  const { t } = useI18n();
  return <Toggle checked={x.autoPost} onChange={(v) => void setAutoPost(x.ref, x.id, v, m.today)} label={t('pay.autoToggle')} help={t('pay.autoHelp')} />;
}

function LoanDetail({ x }: { x: PaymentSummary }) {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  const typeLabel = useTypeLabel();
  const p = m.data.installments.find((i) => i.id === x.id)!;
  const s = x.loan!;
  const cur = x.currency;
  const next = s.waiting[0] ?? s.next;
  const money = (v: number) => fmt.money(v, cur);
  const [allRows, setAllRows] = useState(false);
  const before = s.occurrences.filter((o) => o.before);
  const rest = s.occurrences.filter((o) => !o.before);
  const skip = async () => {
    if (!next?.n) return;
    await skipInstallmentPayment(p.id, next.n);
    ui.toast({ message: t('pay.skippedLoan'), duration: 6000, action: { label: t('common.undo'), run: () => void unskipInstallmentPayment(p.id, next.n!) } });
  };
  const end = async () => {
    await endInstallment(p.id);
    ui.toast({ message: t('pay.ended'), duration: 6000, action: { label: t('common.undo'), run: () => void reopenInstallment(p.id) } });
  };
  const history = [
    ...s.occurrences.filter((o) => o.state === 'paid' && o.txIds.length).map((o) => ({ id: o.txIds[0], date: o.paidDate ?? o.dueDate, amount: o.amount, label: t('pay.paymentNo', { n: o.n ?? 0 }) })),
    ...s.extras.map((e) => ({ id: e.txId, date: e.date, amount: e.amount, label: t('pay.extraRow') })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div className="stack">
      <p className="li-sub">{[x.payee, typeLabel(x)].filter(Boolean).join(' · ')}</p>
      <div className="primary-number">
        <span className="pn-label">{t('pay.leftToRepay')}</span>
        <span className={ui.wide ? 'pn-value pn-compact' : 'pn-value'}><Money minor={s.remaining} currency={cur} /></span>
        <Repaid progress={s.progress} />
        <span className="pn-sub">{t('pay.repaidAria', { paid: money(s.paid), total: money(s.total) })}</span>
      </div>
      <dl className="facts card">
        {next && <Fact label={t('pay.next')}>{money(next.amount)} · {fmt.date(next.dueDate)}</Fact>}
        <Fact label={t('pay.totalToRepay')}>{money(s.total)}</Fact>
        <Fact label={t('pay.paidSoFar')}>{money(s.paid)}</Fact>
        {s.done ? <Fact label={t('pay.leftToRepay')}>{t('pay.allRepaid')}</Fact> : (
          <>
            <Fact label={t('pay.paymentsLeft', { n: s.paymentsLeft })}>{s.payoffDate ? t('pay.payoff', { month: fmt.date(s.payoffDate, 'monthYear') }) : ''}</Fact>
          </>
        )}
        {s.interest && (
          <>
            <Fact label={t('pay.borrowed')}>{money(s.interest.principal)}</Fact>
            <Fact label={t('pay.interestTotal')}>{money(s.interest.interestTotal)}</Fact>
            <Fact label={t('pay.interestPaid')}>{money(s.interest.interestPaid)}</Fact>
            <Fact label={t('pay.principalLeft')}>{money(s.interest.principalLeft)}</Fact>
          </>
        )}
      </dl>
      {s.interest && <p className="note">{t(s.interest.method === 'rate' ? 'pay.interestRateNote' : 'pay.interestShareNote')}</p>}
      {p.status === 'active' && !s.done && (
        <div className="stack">
          {next && <Button block onClick={() => ui.openSheet({ kind: 'pay-confirm', ref: 'loan', id: p.id, dueDate: next.dueDate, n: next.n })}>{t('pay.iPaid')}</Button>}
          <div className="btn-row">
            <Button variant="secondary" icon="plus" onClick={() => ui.openSheet({ kind: 'pay-confirm', ref: 'loan', id: p.id, extra: true })}>{t('pay.payExtra')}</Button>
            {next && <Button variant="secondary" onClick={skip}>{t('pay.skipThis')}</Button>}
          </div>
          <p className="note">{x.autoPost ? t('pay.autoNote') : t('pay.waitingNote')}</p>
        </div>
      )}
      {p.status !== 'cancelled' && !s.done && <AutoToggle x={x} />}
      <SectionTitle>{t('pay.timeline')}</SectionTitle>
      <div className="group">
        {before.length > 0 && (
          <div className="list-item static">
            <span className="li-main"><span className="li-title">{before.length === 1 ? t('pay.paymentNo', { n: 1 }) : `${t('pay.paymentNo', { n: 1 })}–${before.length}`}</span><span className="li-sub">{t('pay.before')}</span></span>
            <Money minor={s.paidBeforeAmount} currency={cur} className="li-amount" />
            <span className="pill paid">{t('pay.state.paid')}</span>
          </div>
        )}
        {(allRows ? rest : rest.slice(0, 8)).map((o) => (
          <OccRow key={o.n} o={o} currency={cur} label={t('pay.paymentNo', { n: o.n ?? 0 })} onSkipUndo={!(p.waived ?? []).includes(o.n ?? 0) ? () => void unskipInstallmentPayment(p.id, o.n ?? 0) : undefined} />
        ))}
        {!allRows && rest.length > 8 && <button type="button" className="list-item" onClick={() => setAllRows(true)}><span className="li-main"><span className="li-title">{t('common.showMore')}</span></span><Icon name="chevron-down" size={20} /></button>}
      </div>
      <SectionTitle>{t('pay.history')}</SectionTitle>
      {history.length === 0 ? <p className="muted pad-x">{t('pay.noHistory')}</p> : (
        <div className="group">
          {history.map((h) => (
            <button key={h.id} type="button" className="list-item" onClick={() => ui.openSheet({ kind: 'edit', txId: h.id })}>
              <span className="li-main"><span className="li-title">{h.label}</span><span className="li-sub">{fmt.date(h.date, 'weekday')}</span></span>
              <Money minor={h.amount} currency={cur} className="li-amount" />
            </button>
          ))}
        </div>
      )}
      <div className="btn-row">
        <Button variant="secondary" icon="pencil" onClick={() => ui.openSheet({ kind: 'pay-edit', ref: 'loan', id: p.id })}>{t('common.edit')}</Button>
        {p.status === 'active' && !s.done && <Button variant="text" onClick={end}>{t('pay.end')}</Button>}
        {p.status === 'cancelled' && <Button variant="text" onClick={() => void reopenInstallment(p.id)}>{t('pay.reopen')}</Button>}
      </div>
    </div>
  );
}

function RuleDetail({ x }: { x: PaymentSummary }) {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  const typeLabel = useTypeLabel();
  const r = m.data.rules.find((i) => i.id === x.id)!;
  const s = x.rule!;
  const next = s.waiting[0] ?? s.next;
  const skip = async () => {
    if (!next) return;
    await skipRuleOccurrence(r.id, next.dueDate);
    ui.toast({ message: t('pay.skipped'), duration: 6000, action: { label: t('common.undo'), run: () => void unskipRuleOccurrence(r.id, next.dueDate) } });
  };
  const remove = async () => {
    const ok = await ui.confirm({ title: t('pay.removeTitle'), body: t('pay.removeBody'), confirmLabel: t('common.remove'), cancelLabel: t('common.cancel'), destructive: true });
    if (!ok) return;
    await deleteRule(r.id);
    ui.toast({ message: t('pay.removed'), duration: 6000 });
    ui.go('/payments');
  };
  const shown = s.occurrences.filter((o) => o.state !== 'paid' || o.dueDate >= addMonthsClamped(m.today, -3));
  return (
    <div className="stack">
      <p className="li-sub">{[x.payee, typeLabel(x)].filter(Boolean).join(' · ')}</p>
      <div className="primary-number">
        <span className="pn-label">{s.done ? t('pay.state.paid') : t('pay.nextAmount')}</span>
        <span className={ui.wide ? 'pn-value pn-compact' : 'pn-value'}><Money minor={next?.amount ?? s.history[0]?.amount ?? r.amount} currency={x.currency} /></span>
        {next && <span className="pn-sub">{x.state === 'paused' ? t('pay.state.paused') : (next.state === 'waiting' ? `${t('pay.state.waiting')} · ` : '') + fmt.date(next.dueDate, 'weekday')}</span>}
      </div>
      <dl className="facts card">
        <Fact label={t('pay.paidThisYear')}>{fmt.money(s.paidThisYear, x.currency)}</Fact>
        <Fact label={t('pay.envelope')}>{m.env(r.envelopeId)?.name ?? ''}</Fact>
      </dl>
      {r.active && !s.done && next && (
        <div className="stack">
          <Button block onClick={() => ui.openSheet({ kind: 'pay-confirm', ref: 'rule', id: r.id, dueDate: next.dueDate })}>{t('pay.iPaid')}</Button>
          <Button variant="secondary" block onClick={skip}>{t('pay.skipThis')}</Button>
          <p className="note">{x.autoPost ? t('pay.autoNote') : t('pay.waitingNote')}</p>
        </div>
      )}
      {r.active && !s.done && <AutoToggle x={x} />}
      {shown.length > 0 && (
        <>
          <SectionTitle>{t('pay.timeline')}</SectionTitle>
          <div className="group">
            {shown.map((o) => <OccRow key={o.dueDate} o={o} currency={x.currency} label={fmt.date(o.dueDate, 'weekday')} onSkipUndo={() => void unskipRuleOccurrence(r.id, o.dueDate)} />)}
          </div>
        </>
      )}
      <SectionTitle>{t('pay.history')}</SectionTitle>
      {s.history.length === 0 ? <p className="muted pad-x">{t('pay.noHistory')}</p> : (
        <div className="group">
          {s.history.map((h) => (
            <button key={h.txId} type="button" className="list-item" onClick={() => ui.openSheet({ kind: 'edit', txId: h.txId })}>
              <span className="li-main"><span className="li-title">{fmt.date(h.date, 'weekday')}</span>{h.dueDate && h.dueDate !== h.date && <span className="li-sub">{t('pay.due', { date: fmt.date(h.dueDate) })}</span>}</span>
              <Money minor={h.amount} currency={h.currency} className="li-amount" />
            </button>
          ))}
        </div>
      )}
      <div className="btn-row">
        <Button variant="secondary" icon="pencil" onClick={() => ui.openSheet({ kind: 'pay-edit', ref: 'rule', id: r.id })}>{t('common.edit')}</Button>
        {!s.done && r.frequency !== 'once' && (r.active
          ? <Button variant="secondary" onClick={async () => { await pauseRule(r.id, m.today); ui.toast({ message: t('pay.paused'), duration: 3000 }); }}>{t('pay.pause')}</Button>
          : <Button variant="secondary" onClick={async () => { await resumeRule(r.id, m.today); ui.toast({ message: t('pay.resumed'), duration: 3000 }); }}>{t('pay.resume')}</Button>)}
        <Button variant="text" onClick={remove}>{t('common.remove')}</Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ "I paid" / "Pay extra"

export function PaySheet({ refKind, id, dueDate, n, extra, onClose }: { refKind: 'rule' | 'loan'; id: string; dueDate?: string; n?: number | null; extra?: boolean; onClose: () => void }) {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  const x = m.payments.items.find((i) => i.ref === refKind && i.id === id);
  const occ = x ? [...(x.rule?.occurrences ?? []), ...(x.loan?.occurrences ?? [])].find((o) => (refKind === 'loan' ? o.n === n : o.dueDate === dueDate)) : undefined;
  const currency = x?.currency ?? m.base;
  const exp = currencyExponent(currency);
  const planned = extra ? 0 : occ?.amount ?? x?.amount ?? 0;
  const [raw, setRaw] = useState(planned > 0 ? minorToRaw(planned, exp).replace('.', fmt.decimalSep) : '');
  const [date, setDate] = useState(m.today);
  const [envId, setEnvId] = useState(x?.envelopeId ?? '');
  const [note, setNote] = useState('');
  const knownRate = currency === m.base ? '1' : m.data.ws.rates[currency]?.rate ?? '';
  const [rate, setRate] = useState(knownRate);
  const [busy, setBusy] = useState(false);
  if (!x) return null;
  const amount = parseAmountInput(raw, exp);
  const rateOk = currency === m.base || isValidRate(rate);
  const remaining = x.loan?.remaining ?? Infinity;
  const over = amount !== null && x.loan && amount > remaining ? amount - remaining : 0;
  const envs = m.envelopes.filter((e) => e.kind !== 'buffer');
  const envChips = [...envs.filter((e) => e.kind === 'fixed'), ...envs.filter((e) => e.kind !== 'fixed' && e.id === envId)];
  const save = async () => {
    if (amount === null || busy || !rateOk || !envId) return;
    setBusy(true);
    try {
      const res = await recordPayment({ ref: refKind, id, dueDate: extra ? undefined : occ?.dueDate ?? dueDate, n: extra ? null : occ?.n ?? n ?? null, amount, date, envelopeId: envId, note: note.trim() || null, rate: currency === m.base ? undefined : rate }, m.today);
      const left = x.loan ? Math.max(0, x.loan.remaining - (amount - res.rest)) : 0;
      const message = res.already ? t('pay.already') : res.rest > 0 ? t('pay.doneRest', { amount: fmt.money(res.rest, currency) }) : extra ? t('pay.extraDone', { amount: fmt.money(left, currency) }) : t('pay.done', { amount: fmt.money(amount, currency), name: x.name });
      ui.toast({ message, duration: 8000, action: res.already ? undefined : { label: t('common.undo'), run: () => void undoPayment(res.txIds, m.today) } });
      onClose();
    } catch {
      ui.toast({ message: t('sys.saveFail') });
    } finally {
      setBusy(false);
    }
  };
  const why = amount === null ? t('onboard.amountHint') : undefined;
  return (
    <Sheet title={extra ? t('pay.payExtra') : t('pay.iPaidFor', { name: x.name })} onClose={onClose} tag="pay-confirm"
      actions={<Button block disabled={amount === null || !rateOk || !envId || busy} why={why} onClick={save}>{t('pay.save')}</Button>}>
      {extra ? <p className="note">{t('pay.extraHelp')}</p> : occ && occ.dueDate > m.today ? <p className="note">{t('pay.early')}</p> : null}
      <div className="field">
        <label className="field-label" htmlFor="pay-amt">{t('pay.amountPaid')}</label>
        <div className="inline">
          <TextInput id="pay-amt" value={raw} onChange={setRaw} inputMode="decimal" placeholder="0" autoFocus={extra} />
          <span className="chip chip-static" aria-hidden="true"><span className="chip-label">{currency}</span></span>
        </div>
        {!extra && planned > 0 && <div className="field-hint">{t('pay.planned', { amount: fmt.money(planned, currency) })}</div>}
        {x.loan && (over > 0 || extra) && <div className="field-hint" aria-live="polite">{t('pay.capHint', { amount: fmt.money(remaining, currency) })}</div>}
      </div>
      {currency !== m.base && !knownRate && (
        <div className="field">
          <label className="field-label" htmlFor="pay-rate">{t('pay.rateNeeded')}</label>
          <TextInput id="pay-rate" value={rate} onChange={setRate} inputMode="decimal" />
          <div className="field-hint">{t('add.rateHelp', { base: m.base, foreign: currency })}</div>
        </div>
      )}
      <div className="field">
        <label className="field-label" htmlFor="pay-date">{t('pay.paidDate')}</label>
        <DateInput label={t('pay.paidDate')} value={date} max={m.today} onChange={setDate} />
      </div>
      <div>
        <div className="field-label">{t('pay.envelope')}</div>
        <ChipRow label={t('pay.envelope')} wrap>
          {envChips.map((e) => <Chip key={e.id} selected={envId === e.id} onClick={() => setEnvId(e.id)}>{e.name}</Chip>)}
        </ChipRow>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="pay-note">{t('pay.note')} ({t('common.optional')})</label>
        <TextInput id="pay-note" value={note} onChange={setNote} maxLength={120} />
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------------ new / edit

type Kind = 'once' | 'repeating' | 'loan';

/**
 * The envelope chooser picks one of: an existing envelope, a ready-made category that does not exist yet (created on save),
 * or a new envelope typed inline (created on save). Envelope = category: there is no other category field.
 */
type Sel = { t: 'env'; id: string } | { t: 'cat'; key: CategoryKey } | { t: 'new' };
const sameSel = (a: Sel, b: Sel) => a.t === b.t && (a.t !== 'env' || a.id === (b as { id: string }).id) && (a.t !== 'cat' || a.key === (b as { key: CategoryKey }).key);

function useCategoryChoice(m: Model) {
  const fixed = m.byKind('fixed');
  /** live envelope that holds a category key (archived ones come back on save instead of a duplicate) */
  const liveFor = (k: CategoryKey): Envelope | undefined => m.envelopes.find((e) => e.categoryKey === k);
  const selFor = (k: CategoryKey): Sel => {
    const e = liveFor(k);
    return e ? { t: 'env', id: e.id } : { t: 'cat', key: k };
  };
  // envelopes made before categories existed (no key): the old icon-based defaults still apply
  const legacyBills = fixed.find((e) => e.icon === 'receipt') ?? fixed.find((e) => e.categoryKey !== 'installments' && e.categoryKey !== 'loans') ?? fixed[0];
  const typeDefault = (kind: Kind, loanKind: 'installment' | 'loan'): Sel => {
    if (kind === 'loan') return selFor(loanKind === 'loan' ? 'loans' : 'installments');
    const u = liveFor('utilities') ?? legacyBills;
    return u ? { t: 'env', id: u.id } : { t: 'cat', key: 'utilities' };
  };
  return { fixed, liveFor, selFor, typeDefault };
}

export function PaymentFormSheet({ type, editRef, editId, onClose }: { type?: Kind; editRef?: 'rule' | 'loan'; editId?: string; onClose: () => void }) {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  const rule = editRef === 'rule' ? m.data.rules.find((r) => r.id === editId) : undefined;
  const plan = editRef === 'loan' ? m.data.installments.find((p) => p.id === editId) : undefined;
  const editing = !!(rule || plan);
  const initialKind: Kind | undefined = plan ? 'loan' : rule ? (rule.frequency === 'once' ? 'once' : 'repeating') : type;
  const [kind, setKind] = useState<Kind | undefined>(initialKind);
  const cats = useCategoryChoice(m);
  const { fixed } = cats;
  const nextMonth = addMonthsClamped(m.today, 1);
  const toRaw = (v: number | null | undefined, c: string) => (v ? minorToRaw(v, currencyExponent(c)).replace('.', fmt.decimalSep) : '');
  const [loanKind, setLoanKind] = useState<'installment' | 'loan'>(plan?.kind === 'loan' ? 'loan' : 'installment');
  const [name, setName] = useState(rule?.name ?? plan?.name ?? '');
  const [payee, setPayee] = useState(rule?.payee ?? plan?.payee ?? '');
  const [currency, setCurrency] = useState(rule?.currency ?? plan?.currency ?? m.base);
  const [raw, setRaw] = useState(toRaw(rule?.amount ?? plan?.paymentAmount, rule?.currency ?? plan?.currency ?? m.base));
  const [count, setCount] = useState(plan?.paymentCount ?? 12);
  const [first, setFirst] = useState<DateStr>(rule?.anchorDate ?? plan?.firstDueDate ?? nextMonth);
  const [paidBefore, setPaidBefore] = useState(plan?.paidBeforeCount ?? 0);
  const [freq, setFreq] = useState<CommitmentRule['frequency']>(rule?.frequency && rule.frequency !== 'once' ? rule.frequency : 'monthly');
  const [principalRaw, setPrincipalRaw] = useState(toRaw(plan?.principal, plan?.currency ?? m.base));
  const [rateRaw, setRateRaw] = useState(plan?.interestRate != null ? String(plan.interestRate).replace('.', fmt.decimalSep) : '');
  const [auto, setAuto] = useState(editing ? (rule ?? plan)!.autoPost !== false : false);
  // what the person tapped (null = follow the suggestion / the type default); editing starts from the saved envelope
  const [picked, setPicked] = useState<Sel | null>(editing ? { t: 'env', id: (rule ?? plan)!.envelopeId } : null);
  const [draftNew, setDraftNew] = useState<NewEnvelopeDraft | null>(null);
  const [inline, setInline] = useState(false);
  const [pick, setPick] = useState(false);
  const [step, setStep] = useState<'form' | 'room'>('form');
  const knownRate = currency === m.base ? '1' : m.data.ws.rates[currency]?.rate ?? '';
  const [fxRaw, setFxRaw] = useState(knownRate);
  const exp = currencyExponent(currency);
  const minor = parseAmountInput(raw, exp);
  const principal = principalRaw.trim() ? parseAmountInput(principalRaw, exp) : null;
  const rateNum = rateRaw.trim() ? Number(rateRaw.replace(',', '.')) : null;
  const rateBad = rateNum !== null && !(Number.isFinite(rateNum) && rateNum >= 0 && rateNum <= 1000);
  const principalBad = principalRaw.trim() !== '' && principal === null;
  const fxOk = currency === m.base || isValidRate(knownRate || fxRaw);
  const valid = name.trim().length > 0 && minor !== null && fxOk && !rateBad && !principalBad;
  void fixed;
  // auto-suggest from the name / payee (keyword table + the person's own earlier choices); never when ambiguous, never while editing
  const suggestion = useMemo(() => {
    if (editing || !kind) return null;
    const s = suggestCategory({ name, payee, past: pastChoices(m.data.rules, m.data.installments), validEnvelope: (id) => m.envelopes.some((e) => e.id === id && e.kind !== 'buffer') });
    // a loan form only takes loan/installment keywords ("Telefon" in a store installment stays an installment)
    if (s && 'key' in s && kind === 'loan' && s.key !== 'loans' && s.key !== 'installments') return null;
    return s;
  }, [editing, kind, name, payee, m]);
  const autoSel: Sel | null = kind ? (suggestion ? ('envelopeId' in suggestion ? { t: 'env', id: suggestion.envelopeId } : cats.selFor(suggestion.key)) : cats.typeDefault(kind, loanKind)) : null;
  const sel: Sel | null = picked ?? autoSel;
  const target = sel?.t === 'env' ? sel.id : undefined;
  const newName = sel?.t === 'cat' ? t(`cat.${sel.key}` as const) : sel?.t === 'new' ? draftNew?.name ?? '' : null;
  const effRate = currency === m.base ? '1' : knownRate || fxRaw || '1';

  // allocation the target fixed envelope needs this period (every commitment, paid or not), to offer "make room"
  const need = useMemo(() => {
    if (!kind || minor === null) return 0;
    const tid = target ?? '__new__';
    const base = { createdAt: '', updatedAt: '', deletedAt: null, rev: '', workspaceId: '' };
    const draftRule: CommitmentRule | null = kind === 'loan' ? null : { ...base, id: rule?.id ?? '__d__', name, envelopeId: tid, amount: minor, currency, frequency: kind === 'once' ? 'once' : freq, anchorDate: first, dayOfMonth: kind === 'repeating' && freq === 'monthly' ? Number(first.slice(8, 10)) : null, endDate: null, estimate: false, active: true, skippedDates: rule?.skippedDates ?? [], autoPost: auto };
    const draftPlan: InstallmentPlan | null = kind === 'loan' ? { ...base, id: plan?.id ?? '__d__', name, envelopeId: tid, currency, paymentAmount: minor, paymentCount: count, firstDueDate: first, paidBeforeCount: paidBefore, skipped: plan?.skipped ?? [], waived: plan?.waived ?? [], status: 'active', autoPost: auto } : null;
    const rules = [...m.data.rules.filter((r) => r.id !== draftRule?.id), ...(draftRule ? [draftRule] : [])];
    const plans = [...m.data.installments.filter((p) => p.id !== draftPlan?.id), ...(draftPlan ? [draftPlan] : [])];
    const res = reservationsFor(rules, plans, m.data.ds.transactions, m.period.startDate, m.period.endDate, m.engine.periods[0]?.startDate ?? m.period.startDate, m.today, { base: m.base, rates: m.data.ws.rates })
      .filter((d) => d.envelopeId === tid);
    // money already spent from the envelope this period still counts as needed (it was paid from this plan line)
    const spent = target ? m.snap.rows[target]?.spent ?? 0 : 0;
    const rates = { ...m.data.ws.rates, [currency]: { rate: effRate, updatedAt: '' } };
    return res.reduce((a, d) => a + toBase(d.amount, d.currency, { base: m.base, rates }), 0) + spent;
  }, [kind, minor, target, name, currency, freq, first, count, paidBefore, auto, rule, plan, m, effRate]);
  const planned = useMemo(() => Object.fromEntries(m.envelopes.filter((e) => e.kind !== 'buffer').map((e) => [e.id, m.snap.rows[e.id]?.planned ?? 0])), [m]);
  const targetKey = target ?? '__new__';
  const shortage = Math.max(0, need - (target ? planned[target] ?? 0 : 0));
  const room = useMemo(() => {
    if (shortage <= 0) return null;
    return makeRoom({ amount: shortage, targetId: targetKey, planned, bufferAlloc: m.snap.alloc[m.buffer.id] ?? 0, envelopes: m.envelopes, spent: Object.fromEntries(Object.entries(m.snap.rows).map(([k, v]) => [k, v.spent])) });
  }, [targetKey, shortage, planned, m]);
  const was = floorMajor(m.snap.safe.leftToday, m.exp);
  const now = useMemo(() => (room ? heroWithPlan(m, room.newAlloc, target ? [] : ['__new__']) : was), [room, m, target, was]);

  if (inline) {
    return <NewEnvelopeSheet kind="fixed" initial={draftNew} onCancel={() => setInline(false)} onDone={(r) => {
      if ('existingId' in r) {
        setPicked({ t: 'env', id: r.existingId });
        ui.toast({ message: t('env.inline.exists'), duration: 4000 });
      } else {
        setDraftNew(r.draft);
        setPicked({ t: 'new' });
      }
      setInline(false);
    }} />;
  }
  if (pick) return <CurrencyPicker value={currency} onClose={() => setPick(false)} onPick={(c) => { setCurrency(c); setFxRaw(m.data.ws.rates[c]?.rate ?? ''); setPick(false); }} />;

  if (!kind) {
    const opt = (k: Kind, icon: string, title: string, help: string) => (
      <button type="button" className="option-card" onClick={() => setKind(k)}>
        <span className="tile tile-fixed"><Icon name={icon} size={22} /></span>
        <span className="li-main"><span className="li-title">{title}</span><span className="li-sub">{help}</span></span>
        <Icon name="chevron-right" size={20} mirror />
      </button>
    );
    return (
      <Sheet title={t('pay.pickType')} onClose={onClose} size="medium" tag="pay-type">
        <div className="stack" role="list">
          <div role="listitem">{opt('repeating', 'repeat', t('pay.kind.repeating'), t('pay.kind.repeatingHelp'))}</div>
          <div role="listitem">{opt('loan', 'landmark', t('pay.kind.loan'), t('pay.kind.loanHelp'))}</div>
          <div role="listitem">{opt('once', 'calendar-days', t('pay.kind.once'), t('pay.kind.onceHelp'))}</div>
        </div>
      </Sheet>
    );
  }

  const persist = async (takeRoom: boolean) => {
    if (minor === null || !sel) return;
    let undo: PaymentSaveUndo | null = null;
    let createdName: string | null = null;
    try {
      await atomic(async () => {
        const planBefore = await capturePlan(m.period.id);
        let tid = target;
        let createdEnvelopeId: string | null = null;
        let unarchivedEnvelopeId: string | null = null;
        if (!tid) {
          // a suggested category or an inline new envelope becomes real now, together with the payment (one undo)
          const r = sel.t === 'cat'
            ? await ensureEnvelope({ name: t(`cat.${sel.key}` as const), icon: CATEGORY_ICON[sel.key], kind: 'fixed', categoryKey: sel.key })
            : await ensureEnvelope({ name: draftNew?.name || t('cat.other'), icon: draftNew?.icon ?? 'receipt', kind: 'fixed' });
          tid = r.envelope.id;
          if (r.created) createdEnvelopeId = tid;
          if (r.unarchived) unarchivedEnvelopeId = tid;
          if (r.created || r.unarchived) createdName = r.envelope.name;
        }
        if (takeRoom && room) {
          const na = { ...room.newAlloc };
          if (na.__new__ !== undefined) {
            na[tid] = na.__new__;
            delete na.__new__;
          }
          await savePlan(m.period.id, na, true);
        }
        if (currency !== m.base && !knownRate && isValidRate(fxRaw)) {
          await updateWorkspace({ rates: { ...m.data.ws.rates, [currency]: { rate: fxRaw, updatedAt: new Date().toISOString() } } });
        }
        const common = { name: name.trim(), payee: payee.trim() || null, envelopeId: tid, currency, autoPost: auto, autoFrom: auto ? (editing && (rule ?? plan)?.autoPost !== false ? (rule ?? plan)?.autoFrom ?? null : m.today) : null };
        let savedId: string | undefined;
        if (kind === 'loan') {
          savedId = (await saveInstallment({ ...(plan ? { id: plan.id } : {}), ...common, kind: loanKind, paymentAmount: minor, paymentCount: count, firstDueDate: first, paidBeforeCount: Math.min(paidBefore, count), principal: principal ?? null, interestRate: rateNum }, m.today)).id;
        } else {
          savedId = (await saveRule({ ...(rule ? { id: rule.id } : {}), ...common, amount: minor, frequency: kind === 'once' ? 'once' : freq, anchorDate: first, dayOfMonth: kind === 'repeating' && freq === 'monthly' ? Number(first.slice(8, 10)) : null }, m.today))?.id;
        }
        if (savedId) undo = { ref: kind === 'loan' ? 'loan' : 'rule', id: savedId, before: rule ?? plan ?? null, plan: planBefore, createdEnvelopeId, unarchivedEnvelopeId };
      });
      const u = undo as PaymentSaveUndo | null;
      const action = u ? { label: t('common.undo'), run: () => void undoPaymentSave(u).then(() => ui.toast({ message: t('pay.cat.undone'), duration: 3000 })) } : undefined;
      const newBit = createdName ? t('pay.cat.newNamed', { name: createdName }) : '';
      if (takeRoom && room) {
        // E-09: never 'now 0 (was 0)'; an unchanged number gets the 'stays' wording
        const msg = room.fromBuffer >= shortage ? t('plan.makeRoomDoneSame', { n: fmt.number(was) }) : now === was ? t('plan.makeRoomDoneStays', { n: fmt.number(now), moved: fmt.money(shortage - room.fromBuffer, m.base) }) : t('plan.makeRoomDone', { n: fmt.number(now), was: fmt.number(was), moved: fmt.money(shortage - room.fromBuffer, m.base) });
        ui.toast({ message: newBit ? `${msg} ${newBit}` : msg, duration: 8000, action });
      } else ui.toast({ message: createdName ? t('pay.cat.savedNew', { name: createdName }) : t('pay.saved'), duration: createdName ? 8000 : 6000, action });
      onClose();
    } catch {
      ui.toast({ message: t('sys.saveFail') });
    }
  };
  const submit = () => {
    if (!valid || !sel || (sel.t === 'new' && !draftNew)) return;
    if (shortage > 0 && room) setStep('room');
    else void persist(false);
  };

  if (step === 'room' && room) {
    const covered = room.fromBuffer >= shortage;
    return (
      <Sheet title={t('plan.makeRoomTitle')} onClose={onClose} size="medium" tag="make-room"
        actions={<>
          <Button block onClick={() => persist(true)}>{covered ? t('common.confirm') : t('plan.makeRoomTake')}</Button>
          <Button variant="text" block onClick={() => persist(false)}>{t('plan.makeRoomKeep')}</Button>
        </>}>
        <p>{t('plan.makeRoomBody', { amount: fmt.money(shortage, m.base) })}</p>
        {!target && newName && <p className="note">{t('pay.cat.roomNew', { name: newName, amount: fmt.money(shortage, m.base) })}</p>}
        <p className="note">{covered ? t('plan.makeRoomBuffer', { n: fmt.number(was) }) : now === was ? t('plan.makeRoomPreviewStays', { n: fmt.number(now) }) : t('plan.makeRoomPreviewChange', { n: fmt.number(now), was: fmt.number(was) })}</p>
        <p className="muted">{t('plan.makeRoomSavedEither')}</p>
        {room.short > 0 && <><p className="note">{t('plan.makeRoomShort', { amount: fmt.money(room.short, m.base) })}</p><p className="muted">{t('plan.makeRoomShortHelp')}</p></>}
      </Sheet>
    );
  }

  const suggestions = payeeSuggestions(m.data.rules, m.data.installments, payee).slice(0, 5);
  const lastDue = kind === 'loan' ? loanDueDate({ firstDueDate: first }, count) : first;
  const title = editing ? t('pay.editTitle') : kind === 'loan' ? t('pay.kind.loan') : kind === 'once' ? t('pay.kind.once') : t('pay.kind.repeating');
  const stepper = (label: string, value: number, set: (n: number) => void, min: number, max: number, chips?: number[]) => (
    <div>
      <div className="field-label" id={`st-${label}`}>{label}</div>
      <div className="stepper" role="group" aria-labelledby={`st-${label}`}>
        <IconButton icon="minus" label={t('a11y.decrease')} onClick={() => set(Math.max(min, value - 1))} />
        <span className="stepper-value num" aria-live="polite">{value}</span>
        <IconButton icon="plus" label={t('a11y.increase')} onClick={() => set(Math.min(max, value + 1))} />
      </div>
      {chips && <ChipRow label={label}>{chips.map((n) => <Chip key={n} selected={value === n} onClick={() => set(n)}>{n}</Chip>)}</ChipRow>}
    </div>
  );
  return (
    <Sheet title={title} onClose={onClose} tag="pay-form" actions={<Button block disabled={!valid} why={t('onboard.amountHint')} onClick={submit}>{t('pay.save')}</Button>}>
      {kind === 'loan' && (
        <div>
          <div className="field-label">{t('pay.loanKind')}</div>
          <div className="option-pair" role="radiogroup" aria-label={t('pay.loanKind')}>
            {(['installment', 'loan'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={loanKind === k} className={`option-card small${loanKind === k ? ' is-selected' : ''}`} onClick={() => setLoanKind(k)}>
                <span className="li-main"><span className="li-title">{t(`pay.loanKind.${k}` as const)}</span><span className="li-sub">{t(`pay.loanKind.${k}Help` as const)}</span></span>
                {loanKind === k && <Icon name="check" size={20} />}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="field"><label className="field-label" htmlFor="pf-name">{t('pay.name')}</label><TextInput id="pf-name" value={name} onChange={setName} maxLength={40} /></div>
      <div className="field">
        <label className="field-label" htmlFor="pf-payee">{t('pay.payee')} ({t('common.optional')})</label>
        <input id="pf-payee" className="input" value={payee} maxLength={60} list="pf-payees" autoComplete="off" onChange={(e) => setPayee(e.target.value)} aria-describedby="pf-payee-hint" />
        <datalist id="pf-payees">{payeeSuggestions(m.data.rules, m.data.installments).map((p) => <option key={p} value={p} />)}</datalist>
        <div className="field-hint" id="pf-payee-hint">{t('pay.payeeHint')}</div>
        {suggestions.length > 0 && (
          <ChipRow label={t('pay.payeeEarlier')}>
            {suggestions.map((s) => <Chip key={s} role="button" onClick={() => setPayee(s)}>{s}</Chip>)}
          </ChipRow>
        )}
      </div>
      <div className="field">
        <label className="field-label" htmlFor="pf-amt">{kind === 'loan' ? t('pay.monthly') : t('pay.amount')}</label>
        <div className="inline">
          <TextInput id="pf-amt" value={raw} onChange={setRaw} inputMode="decimal" placeholder="0" />
          <button type="button" className="chip" onClick={() => setPick(true)} aria-label={`${t('add.currency')}: ${currency}`}><span className="chip-label">{currency}</span></button>
        </div>
      </div>
      {currency !== m.base && !knownRate && (
        <div className="field"><label className="field-label" htmlFor="pf-fx">{t('add.rate')}</label><TextInput id="pf-fx" value={fxRaw} onChange={setFxRaw} inputMode="decimal" /><div className="field-hint">{t('add.rateHelp', { base: m.base, foreign: currency })}</div></div>
      )}
      {kind === 'repeating' && (
        <div>
          <div className="field-label">{t('coming.freq')}</div>
          <ChipRow label={t('coming.freq')} wrap>
            {(['monthly', 'weekly', 'biweekly', 'yearly'] as const).map((f) => <Chip key={f} selected={freq === f} onClick={() => setFreq(f)}>{t(`coming.freq.${f}` as const)}</Chip>)}
          </ChipRow>
        </div>
      )}
      <div className="field">
        <label className="field-label">{kind === 'loan' ? t('pay.firstDue') : kind === 'once' ? t('pay.dueDate') : t('pay.nextDueDate')}</label>
        <DateInput label={kind === 'loan' ? t('pay.firstDue') : kind === 'once' ? t('pay.dueDate') : t('pay.nextDueDate')} value={first} onChange={setFirst} />
      </div>
      {kind === 'loan' && (
        <>
          {stepper(t('pay.count'), count, setCount, 1, 360, [6, 12, 24, 36])}
          {stepper(t('pay.alreadyPaid'), paidBefore, (v) => setPaidBefore(Math.min(v, count - 1)), 0, Math.max(0, count - 1))}
          {minor !== null && <p className="note" aria-live="polite">{t('pay.summaryLoan', { total: fmt.money(minor * count, currency), month: fmt.date(lastDue, 'monthYear') })}</p>}
          <div className="field">
            <label className="field-label" htmlFor="pf-principal">{t('pay.principal')} ({t('common.optional')})</label>
            <TextInput id="pf-principal" value={principalRaw} onChange={setPrincipalRaw} inputMode="decimal" placeholder="0" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="pf-rate">{t('pay.rate')} ({t('common.optional')})</label>
            <TextInput id="pf-rate" value={rateRaw} onChange={setRateRaw} inputMode="decimal" placeholder="0" />
            <div className="field-hint">{t('pay.optionalInfo')}</div>
          </div>
        </>
      )}
      <EnvelopeChooser m={m} kind={kind} sel={sel} picked={!!picked} suggestion={suggestion} payee={payee} draftNew={draftNew}
        onPick={setPicked} onNew={() => setInline(true)} newName={newName} />
      <Toggle checked={auto} onChange={setAuto} label={t('pay.autoToggle')} help={t('pay.autoHelp')} />
    </Sheet>
  );
}

// ------------------------------------------------------------------ envelope chooser (envelope = category)

function EnvelopeChooser({ m, kind, sel, picked, suggestion, payee, draftNew, onPick, onNew, newName }: {
  m: Model; kind: Kind; sel: Sel | null; picked: boolean; suggestion: ReturnType<typeof suggestCategory>; payee: string; draftNew: NewEnvelopeDraft | null;
  onPick: (s: Sel) => void; onNew: () => void; newName: string | null;
}) {
  const { t } = useI18n();
  const fixed = m.byKind('fixed');
  const shown: Envelope[] = [...fixed];
  if (sel?.t === 'env' && !shown.some((e) => e.id === sel.id)) {
    const e = m.env(sel.id);
    if (e) shown.push(e);
  }
  // ready-made categories you do not have yet: offered as lighter chips, created only when used
  const keys = [...SUGGESTED_FOR[kind === 'loan' ? 'loan' : 'bill']];
  if (sel?.t === 'cat' && !keys.includes(sel.key)) keys.unshift(sel.key);
  const missing = keys.filter((k) => !m.envelopes.some((e) => e.categoryKey === k));
  const is = (s: Sel) => !!sel && sameSel(sel, s);
  const auto = !picked && suggestion;
  const hint = [
    auto ? ('envelopeId' in suggestion ? (suggestion.source === 'payee' && payee.trim() ? t('pay.cat.learned', { payee: payee.trim() }) : t('pay.cat.learnedName')) : t('pay.cat.suggested')) : '',
    sel?.t === 'cat' ? `${t(`cat.${sel.key}.ex` as const)}. ${t('pay.cat.willCreate')}` : sel?.t === 'new' ? t('pay.cat.willCreate') : '',
  ].filter(Boolean).join(' ');
  return (
    <div>
      <div className="field-label" id="pf-env-label">{t('pay.envelope')}</div>
      <div className="chip-row wrap env-chooser" role="radiogroup" aria-labelledby="pf-env-label" aria-describedby="pf-env-hint">
        {shown.map((e) => (
          <Chip key={e.id} selected={is({ t: 'env', id: e.id })} onClick={() => onPick({ t: 'env', id: e.id })} className={auto && is({ t: 'env', id: e.id }) ? 'is-auto' : undefined}>{e.name}</Chip>
        ))}
        {draftNew && (
          <SuggestChip selected={is({ t: 'new' })} icon={draftNew.icon} label={draftNew.name} aria={t('pay.cat.newChip', { name: draftNew.name })} onClick={() => onPick({ t: 'new' })} />
        )}
        {missing.map((k) => (
          <SuggestChip key={k} selected={is({ t: 'cat', key: k })} auto={!!auto && is({ t: 'cat', key: k })} icon={CATEGORY_ICON[k]} label={t(`cat.${k}` as const)} aria={t('pay.cat.newChip', { name: t(`cat.${k}` as const) })} onClick={() => onPick({ t: 'cat', key: k })} />
        ))}
        <button type="button" className="chip chip-new" onClick={onNew} aria-haspopup="dialog"><Icon name="plus" size={18} /><span className="chip-label">{t('plan.newEnvelope')}</span></button>
      </div>
      <p className="field-hint env-hint" id="pf-env-hint" aria-live="polite">
        {auto && <><span className="sug-badge">{t('pay.cat.suggestedLabel')}</span>{' '}</>}
        {(sel?.t === 'cat' || sel?.t === 'new') && newName && <span className="sr-only">{newName}: </span>}
        {hint}
      </p>
    </div>
  );
}

function SuggestChip({ selected, auto, icon, label, aria, onClick }: { selected: boolean; auto?: boolean; icon: string; label: string; aria: string; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={selected} aria-label={aria} className={`chip chip-suggested${selected ? ' is-selected' : ''}${auto ? ' is-auto' : ''}`} onClick={onClick}>
      <Icon name={selected ? 'check' : icon} size={18} />
      <span className="chip-label">{label}</span>
    </button>
  );
}
