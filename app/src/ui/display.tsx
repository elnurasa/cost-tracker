import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { useI18n } from '../i18n';
import type { Model } from '../state/model';
import type { Envelope, EnvRow } from '../domain';

export function Money({ minor, currency, className, whole, fixed, sign }: { minor: number; currency: string; className?: string; whole?: boolean; fixed?: boolean; sign?: boolean }) {
  const { fmt } = useI18n();
  const neg = minor < 0;
  const p = fmt.parts(Math.abs(minor), currency, { whole, fixed });
  const sym = <span className="sym">{p.symbol}</span>;
  return (
    <span className={`num money${className ? ` ${className}` : ''}`} data-amount>
      {neg ? '−' : sign && minor > 0 ? '+' : ''}
      {p.symbolFirst && sym}
      {p.number}
      {!p.symbolFirst && sym}
    </span>
  );
}

export function Horizon({ days, total }: { days: number; total: number }) {
  const dots = Math.min(Math.max(days, 1), 14);
  return (
    <div className="horizon" aria-hidden="true">
      <svg viewBox="0 0 320 28" preserveAspectRatio="none" width="100%" height="28">
        <path d="M0 16 C 40 4, 80 4, 120 14 S 200 26, 240 14 S 300 6, 320 12" fill="none" stroke="var(--color-hero-line)" strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="horizon-dots">
        {Array.from({ length: dots }, (_, i) => (
          <span key={i} className={`dot${i === 0 ? ' now' : ''}`} />
        ))}
      </div>
      <span className="sr-only">{total}</span>
    </div>
  );
}

export type EnvState = 'ok' | 'watch' | 'over' | 'none';
export interface EnvView {
  left: number;
  overAmt: number;
  state: EnvState;
  planned: number;
  spent: number;
}
export function envView(m: Model, e: Envelope, r: EnvRow): EnvView {
  const waiting = m.snap.R === 0;
  const left = waiting ? r.planned + r.rolloverIn + r.tIn - r.tOut - r.spent : r.available;
  const overAmt = Math.max(0, -left);
  let state: EnvState = 'none';
  if (e.kind === 'flexible') {
    if (overAmt > 0) state = 'over';
    else if (r.planned <= 0) state = 'none';
    else {
      const pace = m.periodDays.elapsed / m.periodDays.total;
      state = r.spent / r.planned > pace + 0.02 ? 'watch' : 'ok';
    }
  }
  return { left, overAmt, state, planned: r.planned, spent: r.spent };
}

/** Bar scale: the plan, or (when overspent against what is actually available) the available amount, so the hatched overspend always shows. */
export const barPlan = (v: EnvView) => (v.state === 'over' ? Math.max(1, v.spent - v.overAmt, 0) : v.planned);

export function Progress({ spent, plan, pace, tall, label }: { spent: number; plan: number; pace: number; tall?: boolean; label?: string }) {
  const frac = plan > 0 ? Math.min(1, spent / plan) : 0;
  const over = plan > 0 && spent > plan;
  const overFrac = over ? Math.min(0.25, (spent - plan) / plan) : 0;
  const total = 1 + (over ? 0.25 : 0);
  const state = over ? 'over' : plan > 0 && spent / plan > pace + 0.02 ? 'watch' : 'ok';
  return (
    <div className={`bar${tall ? ' bar-tall' : ''}${plan <= 0 ? ' bar-empty' : ''}`} aria-hidden={label ? undefined : true} role={label ? 'meter' : undefined} aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? plan : undefined} aria-valuenow={label ? spent : undefined} aria-valuetext={label} aria-label={label}>
      <div className="bar-track">
        <div className={`bar-fill ${state}`} style={{ width: `${(frac / total) * 100}%` }} />
        {over && <div className="bar-over" style={{ insetInlineStart: `${(1 / total) * 100}%`, width: `${(overFrac / total) * 100}%` }} />}
        {plan > 0 && <div className="bar-pace" style={{ insetInlineStart: `${Math.min(1, pace) * (1 / total) * 100}%` }} />}
      </div>
    </div>
  );
}

// E-13: a "plus" next to a shortfall read as "add"; the over state uses the move icon (the way out)
export const STATUS_ICON: Record<EnvState, string> = { ok: 'circle-check', watch: 'trending-up', over: 'arrow-left-right', none: 'info' };

export function EnvelopeRow({ m, e, onClick, due }: { m: Model; e: Envelope; onClick: () => void; due?: string }) {
  const { t, fmt } = useI18n();
  const r = m.snap.rows[e.id];
  if (!r) return null;
  const v = envView(m, e, r);
  const pace = m.periodDays.elapsed / m.periodDays.total;
  const kindClass = e.kind;
  const money = (x: number) => fmt.moneyName(x, m.base);
  const statusWord = v.state === 'over' ? t('row.over', { amount: fmt.money(v.overAmt, m.base) }) : v.state === 'watch' ? t('row.ahead') : v.state === 'ok' ? t('row.onPlan') : '';
  let aria = e.kind === 'pocket' || e.kind === 'buffer' || e.kind === 'savings'
    ? t('row.ariaPocket', { name: e.name, left: money(v.left) })
    : t('row.aria', { name: e.name, left: money(v.left), plan: money(v.planned), status: statusWord || t('row.noPlan') });
  if (e.kind === 'pocket' && v.left <= 0) aria = `${e.name}. ${t('row.emptyPocket', { date: fmt.date(m.snap.horizon.nextDate) })}`;
  let middle: ReactNode = null;
  if (e.kind === 'flexible') {
    middle =
      v.planned > 0 ? (
        <>
          <Progress spent={v.spent} plan={barPlan(v)} pace={pace} />
          <span className="env-sub">
            <span>{t('row.ofPlan', { amount: fmt.money(v.planned, m.base) })}</span>
            {statusWord && (
              <span className={`status ${v.state}`}>
                <Icon name={STATUS_ICON[v.state]} size={16} />
                {statusWord}
              </span>
            )}
          </span>
        </>
      ) : (
        <span className="env-sub">{t('row.noPlan')}</span>
      );
  } else if (e.kind === 'fixed') {
    middle = <span className="env-sub">{due ? t('row.due', { date: fmt.date(due) }) : v.spent > 0 ? t('row.paid') : t('row.ofPlan', { amount: fmt.money(v.planned, m.base) })}</span>;
  } else if (e.kind === 'pocket') {
    middle = <span className="env-sub">{v.left <= 0 ? t('row.emptyPocket', { date: fmt.date(m.snap.horizon.nextDate) }) : t('env.pocketHelp')}</span>;
  } else if (e.kind === 'buffer') {
    middle = <span className="env-sub">{t('env.bufferHelp')}</span>;
  }
  return (
    <button type="button" className={`env-row env-${kindClass}`} onClick={onClick} aria-label={aria}>
      <span className={`tile tile-${kindClass}`}>
        <Icon name={e.icon} size={22} />
      </span>
      <span className="env-main">
        <span className="env-name">{e.name}</span>
        {middle}
      </span>
      <span className="env-amount">
        {/* E-13: no big negative numeral; nothing is left, and the status line says how much is short */}
        <Money minor={v.state === 'over' ? 0 : v.left} currency={m.base} />
      </span>
    </button>
  );
}
