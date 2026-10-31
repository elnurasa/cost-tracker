import { useMemo, useState } from 'react';
import { AmountField, BackHeader, Banner, Button, Chip, ChipRow, IconButton, SectionTitle, TextInput, Toggle } from '../ui/primitives';
import { Icon, ENVELOPE_ICONS } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { EnvelopeRow, Money, Progress, barPlan, envView } from '../ui/display';
import { useI18n } from '../i18n';
import { useM } from '../state/ctx';
import { useUI } from '../state/ui';
import { HistoryRow } from './HistoryRow';
import { createEnvelope, savePlan, updateEnvelope } from '../data/repo';
import {
  Engine, diffDays, fitPlanToIncome, floorMajor, makeRoom, withBuffer,
  type Dataset, type Envelope, type EnvelopeKind, type Minor,
} from '../domain';
import type { Model } from '../state/model';

/** Today's number if the current period had this plan. `draftFixed` = ids of fixed envelopes that do not exist yet (created on save). */
export function heroWithPlan(m: Model, planned: Record<string, Minor>, draftFixed: string[] = []): number {
  const lines = m.data.ds.planLines.filter((l) => l.periodId !== m.period.id);
  const now = new Date().toISOString();
  for (const [envelopeId, amount] of Object.entries(planned)) {
    lines.push({ id: `${m.period.id}:${envelopeId}`, periodId: m.period.id, envelopeId, amount, createdAt: now, updatedAt: now, deletedAt: null, rev: '' });
  }
  const drafts: Envelope[] = draftFixed.map((id, i) => ({ id, name: id, icon: 'receipt', kind: 'fixed', order: 10000 + i, archived: false, rolloverRule: 'to_buffer', workspaceId: '', createdAt: now, updatedAt: now, deletedAt: null, rev: '' }));
  const ds: Dataset = { ...m.data.ds, planLines: lines, envelopes: [...m.data.ds.envelopes, ...drafts] };
  const s = new Engine(ds, m.today).snapshotFor(m.period.id);
  return s ? floorMajor(s.safe.leftToday, m.exp) : 0;
}

const GROUPS: EnvelopeKind[] = ['fixed', 'flexible', 'pocket', 'savings', 'buffer'];

export function PlanPage() {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  const [editing, setEditing] = useState(false);
  const planned0 = useMemo(() => Object.fromEntries(m.envelopes.filter((e) => e.kind !== 'buffer').map((e) => [e.id, m.snap.rows[e.id]?.planned ?? 0])), [m]);
  const [draft, setDraft] = useState<Record<string, Minor>>(planned0);
  const [also, setAlso] = useState(true);
  const [last, setLast] = useState<string | null>(null);
  const s = m.snap;
  const draftSum = Object.values(draft).reduce((a, b) => a + b, 0);
  const bufferLine = Math.max(0, s.pInc - draftSum);
  const over = Math.max(0, draftSum - s.pInc);
  const view = editing ? { over, rest: bufferLine } : { over: s.overPlanned, rest: s.alloc[m.buffer.id] ?? 0 };
  const left = m.envelopes
    .filter((e) => e.kind === 'flexible' || e.kind === 'pocket' || e.kind === 'buffer')
    .reduce((a, e) => a + envView(m, e, s.rows[e.id]).left, 0);
  const daysLeft = diffDays(m.period.endDate, m.today) + 1;
  const nextEv = m.data.ds.events.filter((e) => e.status === 'expected' && e.expectedDate && e.expectedDate >= m.today).sort((a, b) => ((a.expectedDate ?? '') < (b.expectedDate ?? '') ? -1 : 1))[0];
  const nextInc = m.data.ds.incomes.find((i) => i.id === nextEv?.incomeId);
  const still = m.payments.stillToPay;

  const startEdit = () => { setDraft(planned0); setEditing(true); };
  const setAmt = (id: string, n: number) => {
    setDraft((d) => ({ ...d, [id]: n }));
    setLast(id);
  };
  const takeRoom = () => {
    const r = makeRoom({ amount: over, targetId: '__none__', planned: draft, bufferAlloc: 0, envelopes: m.envelopes, spent: Object.fromEntries(Object.entries(s.rows).map(([k, v]) => [k, v.spent])) });
    const nd = { ...r.newAlloc };
    delete nd.__none__;
    setDraft(nd);
  };
  const save = async () => {
    const was = floorMajor(s.safe.leftToday, m.exp);
    const now = heroWithPlan(m, draft);
    await savePlan(m.period.id, draft, also);
    setEditing(false);
    ui.toast({ message: now !== was ? t('plan.heroChange', { n: fmt.number(now), was: fmt.number(was) }) : t('plan.saved'), duration: 5000 });
  };

  return (
    <main className="page" id="main">
      <header className="page-header">
        <h1 className="page-title">{t('plan.title')}</h1>
        <div className="page-right">
          {!editing ? <Button variant="text" onClick={startEdit}>{t('plan.edit')}</Button> : <Button variant="text" onClick={() => setEditing(false)}>{t('common.cancel')}</Button>}
          {ui.wide ? null : <IconButton icon="settings" label={t('nav.settings')} onClick={() => ui.go('/settings')} />}
        </div>
      </header>
      <div className="page-body">
        <div className="primary-number">
          <span className="pn-label">{t('plan.left')}</span>
          <span className="pn-value"><Money minor={Math.max(0, left)} currency={m.base} /></span>
          <span className="pn-sub">{t('plan.of', { amount: fmt.money(s.pInc, m.base), days: t('common.days', { n: daysLeft }) })}</span>
        </div>
        {s.waitingForPayday && <Banner>{t('plan.waiting')}</Banner>}
        {nextEv && nextInc && (
          <button type="button" className="card card-link" onClick={() => ui.go('/income')}>
            <span className="tile tile-income"><Icon name="banknote" size={22} /></span>
            <span className="li-main">
              <span className="li-sub">{t('plan.nextIncome')}</span>
              <span className="li-title">{nextInc.name} · <Money minor={nextEv.expectedBase} currency={m.base} /> · {fmt.date(nextEv.expectedDate ?? m.today)}</span>
            </span>
            <Icon name="chevron-right" size={20} mirror />
          </button>
        )}
        {view.over > 0 && (
          <Banner action={!editing ? <Button variant="text" onClick={() => ui.openSheet({ kind: 'fit' })}>{t('plan.fit')}</Button> : undefined}>
            {t('plan.over', { amount: fmt.money(view.over, m.base) })}
          </Banner>
        )}
        {editing && over > 0 && last && (
          <div className="card card-info">
            <p>{t('plan.makeRoomBody', { amount: fmt.money(over, m.base) })}</p>
            <Button onClick={takeRoom}>{t('plan.makeRoomTake')}</Button>
            <Button variant="text" onClick={() => ui.openSheet({ kind: 'fit' })}>{t('plan.fit')}</Button>
          </div>
        )}
        {GROUPS.map((k) => {
          const list = m.byKind(k);
          if (list.length === 0) return null;
          const total = k === 'buffer' ? view.rest : list.reduce((a, e) => a + (editing ? draft[e.id] ?? 0 : s.rows[e.id]?.planned ?? 0), 0);
          return (
            <section key={k} aria-label={t(`plan.group.${k}` as const)}>
              <SectionTitle action={<span className="muted num"><Money minor={total} currency={m.base} /></span>}>{t(`plan.group.${k}` as const)}</SectionTitle>
              <div className="group">
                {list.map((e) =>
                  editing && k !== 'buffer' ? (
                    <div key={e.id} className="list-item static edit-row">
                      <span className={`tile tile-${e.kind}`}><Icon name={e.icon} size={22} /></span>
                      <span className="li-main"><span className="li-title">{e.name}</span></span>
                      <AmountField minor={draft[e.id] ?? 0} exp={m.exp} aria-label={e.name} onMinor={(n) => setAmt(e.id, n)} />
                    </div>
                  ) : (
                    <EnvelopeRow key={e.id} m={m} e={e} onClick={() => ui.go(`/envelope/${e.id}`)} due={m.upcoming.find((u) => u.envelopeId === e.id && u.date <= m.period.endDate)?.date} />
                  ),
                )}
              </div>
            </section>
          );
        })}
        {editing ? (
          <div className="stack">
            <p className="note">{t('plan.rest', { amount: fmt.money(bufferLine, m.base) })} · {t('plan.restHelp')}</p>
            <Toggle checked={also} onChange={setAlso} label={t('plan.alsoNext')} />
            <Button block onClick={save}>{t('plan.save')}</Button>
          </div>
        ) : (
          <>
            <div className="btn-row">
              <Button variant="secondary" icon="plus" onClick={() => ui.openSheet({ kind: 'envelope-new' })}>{t('plan.newEnvelope')}</Button>
              <Button variant="secondary" icon="arrow-left-right" onClick={() => ui.openSheet({ kind: 'move' })}>{t('hero.moveMoney')}</Button>
            </div>
            <SectionTitle>{t('today.comingUp')}</SectionTitle>
            <button type="button" className="card card-link" onClick={() => ui.go('/payments')}>
              <span className="li-main">
                <span className="li-sub">{t('pay.stillToPay')}</span>
                <span className="li-title"><Money minor={still} currency={m.base} /></span>
              </span>
              <Icon name="chevron-right" size={20} mirror />
            </button>
            {m.engine.periods.length > 1 && (
              <button type="button" className="card card-link" onClick={() => ui.go(`/past/${m.engine.periods[m.engine.periods.length - 2].id}`)}>
                <span className="li-main"><span className="li-title">{t('plan.pastPeriods')}</span></span>
                <Icon name="chevron-right" size={20} mirror />
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// ------------------------------------------------------------------ envelope detail

export function EnvelopeDetail({ id }: { id: string }) {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  const e = m.env(id);
  if (!e) {
    return (
      <main className="page" id="main">
        <BackHeader title={t('plan.title')} onBack={() => ui.back('/plan')} />
      </main>
    );
  }
  const r = m.snap.rows[e.id];
  const v = envView(m, e, r);
  const pace = m.periodDays.elapsed / m.periodDays.total;
  const txs = m.data.ds.transactions.filter((x) => x.envelopeId === e.id && x.date >= m.period.startDate && x.date <= m.period.endDate).sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1));
  const earlier = m.engine.periods.filter((p) => p.id !== m.period.id).slice(-6).reverse();
  const overspent = e.kind === 'flexible' && v.overAmt > 0;
  const days = Math.max(1, m.snap.safe.H);
  const status = v.state === 'over' ? t('row.overPlan', { amount: fmt.money(v.overAmt, m.base) }) : v.state === 'watch' ? t('row.ahead') : v.state === 'ok' ? t('row.onPlan') : '';
  const meterText = t('a11y.progress', { spent: fmt.moneyName(v.spent, m.base), plan: fmt.moneyName(v.planned, m.base), day: m.periodDays.elapsed, total: m.periodDays.total });
  return (
    <main className="page" id="main">
      <BackHeader
        title={e.name}
        onBack={() => ui.back('/plan')}
        right={<IconButton icon="ellipsis" label={t('a11y.menu')} onClick={() => ui.openSheet({ kind: 'envelope-edit', id: e.id })} />}
      />
      <div className="page-body">
        <div className="primary-number">
          <span className="pn-label">{overspent ? t('env.detail.overBy') : t('env.detail.left')}</span>
          <span className="pn-value"><Money minor={overspent ? v.overAmt : Math.max(0, v.left)} currency={m.base} /></span>
          {overspent && <span className="pn-sub">{t('row.overPlan', { amount: fmt.money(v.overAmt, m.base) })}</span>}
        </div>
        {e.kind === 'flexible' && v.planned > 0 && (
          <>
            <Progress spent={v.spent} plan={barPlan(v)} pace={pace} tall label={meterText} />
            <p className="note">{t('env.detail.spentOf', { spent: fmt.money(v.spent, m.base), plan: fmt.money(v.planned, m.base) })}</p>
            {status && <p className={`status ${v.state}`}><Icon name={v.state === 'over' ? 'arrow-left-right' : v.state === 'watch' ? 'trending-up' : 'circle-check'} size={16} />{status}</p>}
            {!overspent && <p className="note">{t('env.detail.perDay', { amount: fmt.money(Math.floor(Math.max(0, v.left) / days), m.base), days: t('common.days', { n: days }) })}</p>}
          </>
        )}
        {e.kind === 'pocket' && <p className="note">{t('env.pocketHelp')}</p>}
        {e.kind === 'buffer' && <p className="note">{t('env.bufferHelp')}</p>}
        {e.kind === 'savings' && <p className="note">{t('env.savingsHelp')}</p>}
        {e.kind === 'fixed' && <p className="note">{t('row.ofPlan', { amount: fmt.money(v.planned, m.base) })} · {t('env.detail.spentOf', { spent: fmt.money(v.spent, m.base), plan: fmt.money(v.planned, m.base) })}</p>}
        <div className="stack">
          {overspent ? (
            <>
              <Button block onClick={() => ui.openSheet({ kind: 'move', to: e.id })}>{t('env.detail.moveFrom')}</Button>
              <Button block variant="secondary" onClick={() => ui.openSheet({ kind: 'add', envelopeId: e.id })}>{t('env.detail.addTo', { name: e.name })}</Button>
            </>
          ) : (
            <>
              {e.kind !== 'buffer' && <Button block onClick={() => ui.openSheet({ kind: 'add', envelopeId: e.id })}>{e.kind === 'fixed' ? t('env.detail.markPaid') : t('env.detail.addTo', { name: e.name })}</Button>}
              <div className="btn-row">
                <Button variant="secondary" onClick={() => ui.openSheet({ kind: 'move', to: e.id })}>{t('env.detail.move')}</Button>
                {e.kind !== 'buffer' && <Button variant="secondary" onClick={() => ui.go('/plan')}>{t('plan.edit')}</Button>}
              </div>
            </>
          )}
        </div>
        <SectionTitle>{t('env.detail.thisPeriod')}</SectionTitle>
        {txs.length === 0 ? <p className="muted pad-x">{t('env.detail.nothing')}</p> : <div className="group">{txs.slice(0, 20).map((x) => <HistoryRow key={x.id} tx={x} />)}</div>}
        {earlier.length > 0 && (
          <>
            <SectionTitle>{t('env.detail.earlier')}</SectionTitle>
            <div className="group">
              {earlier.map((p) => {
                const row = m.engine.snapshotFor(p.id)?.rows[e.id];
                if (!row) return null;
                return (
                  <button key={p.id} type="button" className="list-item" onClick={() => ui.go(`/past/${p.id}`)}>
                    <span className="li-main">
                      <span className="li-title">{fmt.date(p.startDate)} – {fmt.date(p.endDate)}</span>
                      <span className="li-sub">{t('review.spentOf', { spent: fmt.money(row.spent, m.base), plan: fmt.money(row.planned, m.base) })}</span>
                    </span>
                    <Icon name="chevron-right" size={20} mirror />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// ------------------------------------------------------------------ envelope sheets

export function EnvelopeSheet({ id, onClose }: { id?: string; onClose: () => void }) {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  const e = id ? m.env(id) : undefined;
  const [name, setName] = useState(e?.name ?? '');
  const [icon, setIcon] = useState(e?.icon ?? 'wallet');
  const [kind, setKind] = useState<EnvelopeKind>(e?.kind ?? 'flexible');
  const locked = e && (e.kind === 'buffer' || e.kind === 'pocket');
  const save = async () => {
    try {
      if (e) {
        await updateEnvelope(e.id, { name: name.trim() || e.name, icon, ...(kind !== e.kind && !locked ? { kind } : {}) });
      } else {
        await createEnvelope({ name: name.trim(), icon, kind });
      }
      onClose();
    } catch (err) {
      ui.toast({ message: err instanceof Error && err.message === 'bills' ? t('plan.moveFirst') : t('sys.saveFail') });
    }
  };
  const archive = async () => {
    if (!e) return;
    const bal = m.snap.rows[e.id]?.available ?? 0;
    if (bal !== 0) {
      ui.toast({ message: t('env.detail.archiveMove'), duration: 5000 });
      ui.openSheet({ kind: 'move', from: e.id });
      return;
    }
    try {
      await updateEnvelope(e.id, { archived: true });
      ui.toast({ message: t('env.detail.archived') });
      onClose();
      ui.go('/plan');
    } catch {
      ui.toast({ message: t('sys.saveFail') });
    }
  };
  void fmt;
  return (
    <Sheet title={e ? t('env.detail.edit') : t('env.new.title')} onClose={onClose} tag="envelope" actions={<Button block disabled={!name.trim()} why={t('onboard.amountHint')} onClick={save}>{e ? t('common.save') : t('env.new.create')}</Button>}>
      <div className="field">
        <label className="field-label" htmlFor="en">{t('env.new.name')}</label>
        <TextInput id="en" value={name} onChange={setName} maxLength={30} autoFocus={!e} />
        {!e && <div className="field-hint">{t('env.explainer')}</div>}
      </div>
      {!locked && (
        <div>
          <div className="field-label">{t('env.new.kind')}</div>
          <ChipRow label={t('env.new.kind')} wrap>
            {(['flexible', 'fixed', 'savings'] as const).map((k) => (
              <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>{t(`kind.${k}` as const)}</Chip>
            ))}
          </ChipRow>
        </div>
      )}
      <div>
        <div className="field-label">{t('env.detail.icon')}</div>
        <div className="icon-grid" role="radiogroup" aria-label={t('env.detail.icon')}>
          {ENVELOPE_ICONS.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={icon === n} aria-label={n} className={`icon-pick${icon === n ? ' is-selected' : ''}`} onClick={() => setIcon(n)}>
              <Icon name={n} size={22} />
            </button>
          ))}
        </div>
      </div>
      {e && !locked && <Button variant="danger" block onClick={archive}>{t('env.detail.archive')}</Button>}
      {e?.kind === 'pocket' && (
        <p className="note">{t('env.pocketHelp')}</p>
      )}
    </Sheet>
  );
}

export function FitSheet({ onClose }: { onClose: () => void }) {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  const [includePocket, setIncludePocket] = useState(false);
  const planned = useMemo(() => Object.fromEntries(m.envelopes.filter((e) => e.kind !== 'buffer').map((e) => [e.id, m.snap.rows[e.id]?.planned ?? 0])), [m]);
  const spent = useMemo(() => Object.fromEntries(Object.entries(m.snap.rows).map(([k, v]) => [k, v.spent])), [m]);
  const over = withBuffer(planned, m.envelopes, m.snap.pInc).overPlanned;
  const r = useMemo(() => fitPlanToIncome({ over, planned, envelopes: m.envelopes, spent, includePocket }), [over, planned, m.envelopes, spent, includePocket]);
  const was = floorMajor(m.snap.safe.leftToday, m.exp);
  const now = useMemo(() => heroWithPlan(m, r.newAlloc), [m, r]);
  const apply = async () => {
    await savePlan(m.period.id, r.newAlloc, false);
    ui.toast({ message: now !== was ? t('plan.heroChange', { n: fmt.number(now), was: fmt.number(was) }) : t('plan.saved') });
    onClose();
  };
  return (
    <Sheet title={t('plan.fit')} onClose={onClose} size="medium" tag="fit" actions={<Button block onClick={apply}>{t('common.confirm')}</Button>}>
      <p>{t('plan.over', { amount: fmt.money(over, m.base) })}</p>
      <p className="muted">{t('plan.fitPreview', { amount: fmt.money(over - r.short, m.base) })}</p>
      {now !== was && <p className="note">{t('plan.heroChange', { n: fmt.number(now), was: fmt.number(was) })}</p>}
      {r.short > 0 && <p className="note">{t('plan.fitShort', { amount: fmt.money(r.short, m.base) })}</p>}
      {m.pocket && <Chip role="checkbox" selected={includePocket} onClick={() => setIncludePocket((v) => !v)}>{t('plan.fitIncludeShare')}</Chip>}
    </Sheet>
  );
}

export type { Envelope };
