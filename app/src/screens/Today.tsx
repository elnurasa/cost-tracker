import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button, Card, EmptyState, IconButton, SectionTitle, Toggle } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { EnvelopeRow, Horizon, Money } from '../ui/display';
import { useI18n } from '../i18n';
import { useM } from '../state/ctx';
import { useUI } from '../state/ui';
import { dismissCard, nudgeActed, nudgeNotNow, isDismissed, usePrefs, setPrefs } from '../state/prefs';
import { eveningActed, eveningNotNow, useEveningDue } from '../state/evening';
import { applyUpdate, canInstall, currentHero, receivedMessage, isUpdateReady, onInstallChange, promptInstall, swSubs } from '../state/helpers';
import { confirmPending, receiveIncome, updateWorkspace } from '../data/repo';
import { addDays, diffDays, floorMajor, isEarlyIncome, type IncomeEvent } from '../domain';
import { HistoryRow } from './HistoryRow';

// ------------------------------------------------------------------ hero

export function HeroPanel({ compact }: { compact?: boolean }) {
  const m = useM();
  const { t, fmt } = useI18n();
  const ui = useUI();
  const s = m.snap.safe;
  const hero = floorMajor(s.leftToday, m.exp);
  const p = fmt.parts(hero * 10 ** m.exp, m.base, { whole: true });
  const daysText = s.mode === 'cover' ? t('hero.daysCover', { n: s.H }) : t('hero.daysTo', { n: s.H });
  // E-06: an envelope that is short gets a way out from the hero too (not only from the toast)
  const short = m.byKind('flexible').map((e) => ({ e, a: m.snap.available[e.id] ?? 0 })).filter((x) => x.a < 0).sort((a, b) => a.a - b.a)[0]?.e;
  const spent = fmt.money(s.spentTodayFlex, m.base);
  const aria = t('hero.aria', { amount: fmt.moneyName(hero * 10 ** m.exp, m.base), spent: fmt.moneyName(Math.max(0, s.spentTodayFlex), m.base), days: t('common.days', { n: s.H }) });
  if (s.state === 'no_flexible') {
    return (
      <div className="hero hero-noflex">
        <Card>
          <h2 className="card-title">{t('hero.noFlexTitle')}</h2>
          <p className="muted">{t('hero.noFlexBody')}</p>
          <Button onClick={() => ui.openSheet({ kind: 'envelope-new' })}>{t('hero.noFlexAction')}</Button>
        </Card>
      </div>
    );
  }
  let sub: ReactNode;
  if (s.state === 'used_up') sub = t('hero.usedUp', { date: fmt.date(s.nextDate) });
  else if (s.state === 'past_today') sub = t('hero.tomorrow', { amount: fmt.money(s.tomorrow, m.base) });
  else if (s.state === 'last_day') sub = t('hero.lastDay');
  else sub = s.spentTodayFlex > 0 ? t('hero.spentToday', { amount: spent }) : t('hero.nothingSpent');
  return (
    <section className={`hero${compact ? ' hero-compact' : ''}`} aria-label={t('hero.label')}>
      <p className="hero-label">{t('hero.label')}</p>
      <button type="button" className="hero-number-btn" onClick={() => ui.openSheet({ kind: 'why' })} aria-label={aria}>
        <span className="hero-number" data-amount>
          {p.symbolFirst && <span className="hero-sym">{p.symbol}</span>}
          <span key={hero} className="hero-value">{p.number}</span>
          {!p.symbolFirst && <span className="hero-sym">{p.symbol}</span>}
        </span>
      </button>
      <p className="hero-sub" aria-live="polite">{sub}</p>
      <div className="hero-line">
        <Horizon days={s.H} total={s.H} />
        <span className="hero-days">{daysText}</span>
      </div>
      <div className="hero-actions">
        <button type="button" className="hero-link" onClick={() => ui.openSheet({ kind: 'why' })}>
          {t('hero.why')} <Icon name="chevron-right" size={18} mirror />
        </button>
      </div>
      {(s.state === 'used_up' || (hero === 0 && short)) && (
        <div className="hero-actions">
          <button type="button" className="hero-pill" onClick={() => ui.openSheet({ kind: 'move', to: short?.id })}>{t('hero.moveMoney')}</button>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ why sheet

export function WhySheet({ onClose }: { onClose: () => void }) {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  const s = m.snap.safe;
  const flexNames = m.byKind('flexible').map((e) => e.name).join(', ');
  const hero = floorMajor(s.leftToday, m.exp);
  const [open, setOpen] = useState(false);
  const mo = (x: number) => fmt.money(x, m.base, { fixed: true });
  const notes: string[] = [];
  if (m.snap.reserved > 0) notes.push(t('why.reserved', { amount: fmt.money(m.snap.reserved, m.base) }));
  // E-05: the first, partial period is planned from the money you had then, not from the monthly income
  if (m.period.scaledFirstPeriod && m.engine.periods[0]?.id === m.period.id) notes.push(t('why.firstPeriod', { amount: fmt.money(m.snap.R, m.base) }));
  // E-08: a pay that came early waits for its own period
  for (const ev of m.data.ds.events) {
    if (ev.status === 'received' && isEarlyIncome(ev) && (ev.expectedDate ?? '') > m.period.endDate) {
      notes.push(t('why.earlyIncome', { name: m.data.ds.incomes.find((i) => i.id === ev.incomeId)?.name ?? t('income.other'), date: fmt.date(addDays(m.period.endDate, 1)) }));
    }
  }
  if (s.bridged) notes.push(t(s.mode === 'late' ? 'why.bridge' : 'why.bridgeWaiting'));
  if (s.cover > 0 && s.netDeficit === 0) notes.push(t('why.covered', { amount: fmt.money(s.cover, m.base) }));
  if (s.netDeficit > 0) notes.push(t('why.coveredSome', { amount: fmt.money(s.netDeficit, m.base) }));
  notes.push(t('why.rounded'));
  const p = fmt.parts(hero * 10 ** m.exp, m.base, { whole: true });
  return (
    <Sheet
      title={t('why.title')}
      onClose={onClose}
      size="medium"
      tag="why"
      actions={
        <>
          <Button block onClick={onClose}>{t('common.gotIt')}</Button>
          <Button variant="text" block onClick={() => { onClose(); ui.go('/plan'); }}>{t('plan.edit')}</Button>
        </>
      }
    >
      <p className="why-big" data-amount>
        <span>{p.symbolFirst ? `${p.symbol}${p.number}` : `${p.number} ${p.symbol}`}</span>
      </p>
      {/* E-16: a short receipt, one operation per line, only the result is bold */}
      <dl className="why-list why-receipt">
        <div className="why-row">
          <dt>{t('why.pool')}<span className="row-sub">{flexNames}</span></dt>
          <dd className="num">{mo(s.poolStart)}</dd>
        </div>
        <div className="why-row">
          <dt><span className="why-op" aria-hidden="true">÷</span>{t('why.days', { date: fmt.date(s.nextDate) })}</dt>
          <dd className="num">{s.H}</dd>
        </div>
        <div className="why-row">
          <dt><span className="why-op" aria-hidden="true">=</span>{t('why.perDayRow')}</dt>
          <dd className="num">{mo(s.allowance)}</dd>
        </div>
        {s.spentTodayFlex > 0 && (
          <div className="why-row">
            <dt><span className="why-op" aria-hidden="true">−</span>{t('why.spentRow')}</dt>
            <dd className="num">{mo(s.spentTodayFlex)}</dd>
          </div>
        )}
        <div className="why-row why-total">
          <dt><span className="why-op" aria-hidden="true">=</span>{t('why.leftRow')}</dt>
          <dd className="num">{mo(s.leftToday)}</dd>
        </div>
      </dl>
      <ul className="why-notes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
        <li className="why-tomorrow">{t('why.tomorrowGrows')}</li>
      </ul>
      <button type="button" className="text-link" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{t('why.change')}</button>
      {open && (
        <Toggle
          checked={m.data.ws.bridgeBuffer}
          onChange={(v) => void updateWorkspace({ bridgeBuffer: v })}
          label={t('why.bridgeToggle')}
          help={t('why.bridgeToggleHelp')}
        />
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------------ cards

function useSyncedFlags() {
  const install = useSyncExternalStore((f) => onInstallChange(f), () => canInstall(), () => false);
  const update = useSyncExternalStore((f) => { swSubs.add(f); return () => swSubs.delete(f); }, () => isUpdateReady(), () => false);
  return { install, update };
}

function CardBox({ children }: { children: ReactNode }) {
  return <Card tone="info" className="nudge-card">{children}</Card>;
}

export function IncomeCard({ ev, late }: { ev: IncomeEvent; late: boolean }) {
  const m = useM();
  const { t, fmt } = useI18n();
  const ui = useUI();
  const inc = m.data.ds.incomes.find((i) => i.id === ev.incomeId);
  const yes = async () => {
    const r = await receiveIncome(ev.id, { amount: ev.expectedAmount, currency: ev.currency, rate: ev.currency === m.base ? undefined : ev.rate, date: m.today });
    const n = await currentHero(m.today);
    ui.toast({ message: receivedMessage(t, (d) => fmt.date(d), fmt.number, ev, m.period.endDate, m.today, n), duration: 6000 });
    if (r.uncertain) ui.openSheet({ kind: 'cover' });
  };
  return (
    <CardBox>
      <p className="card-text">{late ? t('card.late') : t('card.incomeDue', { name: inc?.name ?? t('income.other') })}</p>
      <div className="btn-row">
        <Button onClick={yes}>{late ? t('card.itArrived') : t('card.yesAmount', { amount: fmt.money(ev.expectedBase, m.base) })}</Button>
        <Button variant="secondary" onClick={() => ui.openSheet({ kind: 'receive', eventId: ev.id, different: true })}>{t('card.different')}</Button>
        {late ? (
          <Button variant="text" onClick={() => ui.openSheet({ kind: 'expect' })}>{t('card.lateAction')}</Button>
        ) : (
          <Button variant="text" onClick={() => dismissCard(`inc:${ev.id}`, 1)}>{t('card.notYet')}</Button>
        )}
      </div>
    </CardBox>
  );
}

export function TodayCard() {
  const m = useM();
  const { t, fmt } = useI18n();
  const ui = useUI();
  const prefs = usePrefs();
  const flags = useSyncedFlags();
  const live = m.data.ds;
  const manualCount = live.transactions.filter((x) => x.source === 'manual' && x.type === 'expense').length;
  const days = new Set(live.transactions.filter((x) => x.source === 'manual').map((x) => x.date));
  const eveningDue = useEveningDue(prefs, m.today, live.transactions);
  const card = useMemo<ReactNode>(() => {
    const ok = (id: string) => !isDismissed(prefs, id);
    const steady = new Set(live.incomes.filter((i) => i.reliability === 'steady').map((i) => i.id));
    // 1. income due today or late
    const due = live.events
      .filter((e) => e.status === 'expected' && e.expectedDate && e.expectedDate <= m.today && diffDays(m.today, e.expectedDate) <= 14 && steady.has(e.incomeId))
      .sort((a, b) => ((a.expectedDate ?? '') < (b.expectedDate ?? '') ? -1 : 1));
    const first = due[0];
    if (first) {
      const late = (first.expectedDate ?? m.today) < m.today;
      if (late || ok(`inc:${first.id}`)) return <IncomeCard key={first.id} ev={first} late={late} />;
    }
    if (m.snap.horizon.mode === 'late' && !first) {
      return (
        <CardBox>
          <p className="card-text">{t('card.late')}</p>
          <div className="btn-row">
            <Button onClick={() => ui.openSheet({ kind: 'add', mode: 'income' })}>{t('card.itArrived')}</Button>
            <Button variant="text" onClick={() => ui.openSheet({ kind: 'expect' })}>{t('card.lateAction')}</Button>
          </div>
        </CardBox>
      );
    }
    // 2. period review
    if (m.closing.length > 0 && ok('review')) {
      return (
        <CardBox>
          <p className="card-text">{t('card.review')}</p>
          <div className="btn-row">
            <Button onClick={() => { nudgeActed('review'); ui.go('/review'); }}>{t('card.reviewAction')}</Button>
            <Button variant="text" onClick={() => dismissCard('review', 1)}>{t('common.notNow')}</Button>
          </div>
        </CardBox>
      );
    }
    // 3. estimates
    const pend = live.transactions.find((x) => x.status === 'pending');
    if (pend && ok(`est:${pend.id}`)) {
      return (
        <CardBox>
          <p className="card-text">{t('card.estimate', { name: pend.note ?? '' })}</p>
          <div className="btn-row">
            <Button onClick={() => void confirmPending(pend.id)}>{t('card.estimateConfirm', { amount: fmt.money(pend.amountBase, m.base) })}</Button>
            <Button variant="secondary" onClick={() => ui.openSheet({ kind: 'edit', txId: pend.id })}>{t('common.edit')}</Button>
          </div>
        </CardBox>
      );
    }
    // cover-until ask (no steady income and no cover date)
    if (m.snap.horizon.mode === 'period_end' && ok('cover')) {
      return (
        <CardBox>
          <p className="card-text">{t('card.cover')}</p>
          <p className="muted">{t('card.coverBody')}</p>
          <div className="btn-row">
            <Button variant="secondary" onClick={() => ui.openSheet({ kind: 'cover' })}>{t('card.cover.pick')}</Button>
          </div>
        </CardBox>
      );
    }
    if (m.snap.waitingForPayday && m.snap.safe.bridged) {
      return (
        <CardBox>
          <p className="card-text">{t('card.waiting')}</p>
        </CardBox>
      );
    }
    if (!prefs.nudges) return null;
    // coach on day 1
    if (manualCount === 0 && !prefs.coachDone && !prefs.demo) {
      return (
        <CardBox>
          <p className="card-text">{t('onboard.revealBody')}</p>
          <p className="card-text strong">{t('card.firstExpense')}</p>
        </CardBox>
      );
    }
    // evening reminder (opt-in, in-app only; AC-NUD-05)
    if (eveningDue) {
      return (
        <CardBox>
          <p className="card-text">{t('card.evening')}</p>
          <div className="btn-row">
            <Button onClick={() => { eveningActed(); ui.openSheet({ kind: 'add' }); }}>{t('card.eveningAction')}</Button>
            <Button variant="text" onClick={() => eveningNotNow(m.today)}>{t('common.notNow')}</Button>
          </div>
        </CardBox>
      );
    }
    // catch-up: 3 consecutive days without entries
    const last3 = [0, 1, 2].map((i) => addDays(m.today, -i));
    if (manualCount >= 3 && last3.every((d) => !days.has(d)) && diffDays(m.today, prefs.firstOpenAt.slice(0, 10)) >= 3 && ok('catchup')) {
      return (
        <CardBox>
          <p className="card-text">{t('card.catchUp')}</p>
          <div className="btn-row">
            <Button onClick={() => { nudgeActed('catchup'); ui.openSheet({ kind: 'add' }); }}>{t('card.catchUpAction')}</Button>
            <Button variant="text" onClick={() => nudgeNotNow('catchup', 7)}>{t('common.notNow')}</Button>
            <Button variant="text" onClick={() => dismissCard('catchup', 3650)}>{t('card.stop')}</Button>
          </div>
        </CardBox>
      );
    }
    // backup
    const lastB = prefs.lastBackupAt;
    if (live.transactions.length >= 20 && (!lastB || diffDays(m.today, lastB.slice(0, 10)) >= 30) && ok('backup')) {
      return (
        <CardBox>
          <p className="card-text">{t('card.backup')}</p>
          <div className="btn-row">
            <Button onClick={() => ui.go('/settings/data')}>{t('card.backupAction')}</Button>
            <Button variant="text" onClick={() => dismissCard('backup', 30)}>{t('common.notNow')}</Button>
          </div>
        </CardBox>
      );
    }
    // lock suggestion
    if (manualCount >= 3 && !prefs.lock.enabled && !prefs.demo && ok('lock')) {
      return (
        <CardBox>
          <p className="card-text">{t('card.lock')}</p>
          <div className="btn-row">
            <Button onClick={() => { nudgeActed('lock'); ui.go('/settings/lock'); }}>{t('card.lockAction')}</Button>
            <Button variant="text" onClick={() => nudgeNotNow('lock', 3)}>{t('common.notNow')}</Button>
          </div>
        </CardBox>
      );
    }
    if (flags.install && manualCount >= 1 && ok('install')) {
      return (
        <CardBox>
          <p className="card-text">{t('card.install', { brand: t('brand.name') })}</p>
          <div className="btn-row">
            <Button onClick={() => void promptInstall()}>{t('card.installAction')}</Button>
            <Button variant="text" onClick={() => dismissCard('install', 30)}>{t('common.notNow')}</Button>
          </div>
        </CardBox>
      );
    }
    if (prefs.telemetryOptIn === null && diffDays(m.today, prefs.firstOpenAt.slice(0, 10)) >= 3 && ok('telemetry')) {
      return (
        <CardBox>
          <p className="card-text">{t('card.telemetry')}</p>
          <div className="btn-row">
            <Button onClick={() => setPrefs({ telemetryOptIn: true })}>{t('card.telemetryYes')}</Button>
            <Button variant="text" onClick={() => setPrefs({ telemetryOptIn: false })}>{t('common.notNow')}</Button>
          </div>
        </CardBox>
      );
    }
    return null;
  }, [m, prefs, flags.install, t, fmt, ui, live, manualCount, days, eveningDue]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {flags.update && (
        <CardBox>
          <p className="card-text">{t('sys.updateReady')}</p>
          <div className="btn-row"><Button onClick={applyUpdate}>{t('common.update')}</Button></div>
        </CardBox>
      )}
      {card}
    </>
  );
}

// ------------------------------------------------------------------ lists

export function EnvelopeList({ limit, all }: { limit?: number; all?: boolean }) {
  const m = useM();
  const ui = useUI();
  const prefs = usePrefs();
  const { t } = useI18n();
  const list = useMemo(() => {
    const since = addDays(m.today, -14);
    const freq = new Map<string, number>();
    for (const x of m.data.ds.transactions) if (x.envelopeId && x.date >= since) freq.set(x.envelopeId, (freq.get(x.envelopeId) ?? 0) + 1);
    let base = m.envelopes.filter((e) => (all || (e.kind !== 'buffer' && e.kind !== 'savings')) && (e.kind !== 'pocket' || prefs.showPocket));
    if (limit) {
      const pocket = base.find((e) => e.kind === 'pocket');
      const others = base.filter((e) => e.kind !== 'pocket').sort((a, b) => (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0) || a.order - b.order);
      base = [...others.slice(0, limit), ...(pocket ? [pocket] : [])];
    }
    return base;
  }, [m, limit, all, prefs.showPocket]);
  return (
    <div>
      <SectionTitle action={limit ? <Button variant="text" onClick={() => ui.go('/plan')}>{t('today.seeAllEnvelopes')}</Button> : undefined}>{t('today.envelopes')}</SectionTitle>
      <div className="group">
        {list.map((e) => (
          <EnvelopeRow key={e.id} m={m} e={e} onClick={() => ui.go(`/envelope/${e.id}`)} due={dueFor(m, e.id)} />
        ))}
      </div>
    </div>
  );
}
function dueFor(m: ReturnType<typeof useM>, envId: string): string | undefined {
  return m.upcoming.find((u) => u.envelopeId === envId && u.date <= m.period.endDate)?.date;
}

export function ComingUp({ limit = 3 }: { limit?: number }) {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  // waiting ("I paid" not tapped yet) first, then what falls due this period; same source as the Payments panel
  const items = m.payments.items.filter((x) => x.group === 'waiting' || x.group === 'period').slice(0, limit);
  return (
    <div>
      <SectionTitle action={<Button variant="text" onClick={() => ui.go('/payments')}>{t('today.seeAllPayments')}</Button>}>{t('today.comingUp')}</SectionTitle>
      {items.length === 0 ? (
        <p className="muted pad-x">{t('today.nothingComing')}</p>
      ) : (
        <div className="group">
          {items.map((u) => (
            <button key={`${u.ref}${u.id}`} type="button" className="list-item" onClick={() => ui.go(`/payments/${u.ref}/${u.id}`)}>
              <span className="tile tile-fixed"><Icon name={u.ref === 'loan' ? 'calendar-clock' : 'receipt'} size={22} /></span>
              <span className="li-main">
                <span className="li-title">{u.name}{u.loan && u.next?.n ? ` · ${u.next.n}` : ''}</span>
                <span className="li-sub">{u.group === 'waiting' ? t('pay.state.waiting') : u.date ? fmt.date(u.date, 'weekday') : ''}</span>
              </span>
              <Money minor={u.amount} currency={u.currency} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ pages

export function TodayHeader() {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  return (
    <header className="today-header">
      <span className="today-date">{fmt.date(m.today, 'weekday')}</span>
      <IconButton icon="settings" label={t('nav.settings')} onClick={() => ui.go('/settings')} />
    </header>
  );
}

export function TodayPage() {
  const { t } = useI18n();
  return (
    <main className="page page-today" id="main">
      <h1 className="sr-only">{t('nav.today')}</h1>
      <div className="hero-wrap">
        <TodayHeader />
        <HeroPanel />
      </div>
      <div className="page-body">
        <TodayCard />
        <EnvelopeList limit={3} />
        <ComingUp />
      </div>
    </main>
  );
}

/** Tablet right pane for the Today destination. */
export function TodayFeed() {
  const m = useM();
  const { t } = useI18n();
  const ui = useUI();
  const today = m.data.ds.transactions.filter((x) => x.date === m.today).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return (
    <main className="page page-feed" id="main">
      <header className="page-header"><h1 className="page-title">{t('nav.today')}</h1></header>
      <div className="page-body">
        <TodayCard />
        <SectionTitle>{t('today.feed')}</SectionTitle>
        {today.length === 0 ? (
          <EmptyState title={t('today.noExpenses')} action={<Button onClick={() => ui.openSheet({ kind: 'add' })}>{t('nav.add')}</Button>} />
        ) : (
          <div className="group">{today.map((x) => <HistoryRow key={x.id} tx={x} />)}</div>
        )}
        <ComingUp limit={5} />
      </div>
    </main>
  );
}

