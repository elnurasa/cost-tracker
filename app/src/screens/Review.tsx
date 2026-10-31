import { BackHeader, Button, Chip, ChipRow, EmptyState } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { Money } from '../ui/display';
import { useI18n } from '../i18n';
import { useM } from '../state/ctx';
import { useUI } from '../state/ui';
import { dismissCard } from '../state/prefs';
import { confirmAllClosing, setRolloverAction } from '../data/repo';
import { addDays, type Envelope } from '../domain';

export function ReviewPage() {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  const target = m.closing[m.closing.length - 1];
  if (!target) {
    return (
      <main className="page" id="main">
        <BackHeader title={t('review.title')} onBack={() => ui.back('/today')} />
        <div className="page-body"><EmptyState title={t('review.nothing')} action={<Button onClick={() => ui.go('/today')}>{t('nav.today')}</Button>} /></div>
      </main>
    );
  }
  const lefts = m.engine.leftovers(target.id);
  const snap = m.engine.snapshotFor(target.id)!;
  const rows = lefts
    .map((l) => ({ ...l, env: m.env(l.envelopeId) ?? m.allEnvelopes.find((e) => e.id === l.envelopeId)! }))
    .filter((r) => r.env && r.leftover !== 0);
  const total = rows.reduce((a, r) => a + Math.max(0, r.leftover), 0);
  const spent = snap.spentTotal;
  const planned = Object.entries(snap.rows).filter(([id]) => m.env(id)?.kind !== 'buffer').reduce((a, [, r]) => a + r.planned, 0);
  const biggest = Object.entries(snap.rows).sort((a, b) => b[1].spent - a[1].spent)[0];
  const confirm = async () => {
    await confirmAllClosing(m.today);
    ui.toast({ message: t('review.done'), duration: 5000 });
    ui.go('/today');
  };
  const label = (e: Envelope) => e.name;
  return (
    <main className="page" id="main">
      <BackHeader title={t('review.title')} onBack={() => ui.back('/today')} />
      <div className="page-body">
        <svg className="review-wave" viewBox="0 0 320 28" width="100%" height="28" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 16 C 40 4, 80 4, 120 14 S 200 26, 240 14 S 300 6, 320 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <p className="muted">{t('review.madeIt', { date: fmt.date(addDays(target.endDate, 1)) })}</p>
        <div className="primary-number">
          <span className="pn-label">{t('review.leftOver')}</span>
          <span className="pn-value"><Money minor={total} currency={m.base} /></span>
        </div>
        <p className="muted">{t('review.sentence')}</p>
        <div className="group">
          {rows.map((r) => (
            <div key={r.envelopeId} className="list-item static col">
              <span className="li-row">
                <span className={`tile tile-${r.env.kind}`}><Icon name={r.env.icon} size={22} /></span>
                <span className="li-main"><span className="li-title">{label(r.env)}</span></span>
                <Money minor={r.leftover} currency={m.base} />
              </span>
              {r.env.kind !== 'buffer' && (
                <ChipRow label={label(r.env)}>
                  <Chip selected={r.action === 'carry'} onClick={() => void setRolloverAction(target.id, r.envelopeId, 'carry')}>{t('review.keep')}</Chip>
                  <Chip selected={r.action === 'to_buffer'} onClick={() => void setRolloverAction(target.id, r.envelopeId, 'to_buffer')}>{t('review.toBuffer')}</Chip>
                </ChipRow>
              )}
            </div>
          ))}
        </div>
        <p className="note">{t('review.spentOf', { spent: fmt.money(spent, m.base), plan: fmt.money(planned, m.base) })}{biggest && biggest[1].spent > 0 ? ` · ${t('review.biggest', { name: m.allEnvelopes.find((e) => e.id === biggest[0])?.name ?? '' })}` : ''}</p>
        {m.closing.length > 1 && <p className="note">{t('review.several')}</p>}
        <div className="stack">
          <Button block onClick={confirm}>{t('review.confirm')}</Button>
          <Button variant="secondary" block onClick={() => ui.go('/plan')}>{t('review.editPlan')}</Button>
          <Button variant="text" block onClick={() => { dismissCard('review', 1); ui.go('/today'); }}>{t('review.skip')}</Button>
        </div>
        <p className="muted">{t('review.autoNote')}</p>
      </div>
    </main>
  );
}

export function PastPeriodPage({ id }: { id: string }) {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  const p = m.engine.periods.find((x) => x.id === id);
  const snap = p ? m.engine.snapshotFor(p.id) : undefined;
  const periods = m.engine.periods.filter((x) => x.id !== m.period.id);
  return (
    <main className="page" id="main">
      <BackHeader title={t('plan.pastPeriods')} onBack={() => ui.back('/plan')} />
      <div className="page-body">
        {periods.length === 0 && <p className="muted">{t('plan.noPeriods')}</p>}
        <ChipRow label={t('plan.pastPeriods')} wrap>
          {periods.slice().reverse().map((x) => (
            <Chip key={x.id} selected={x.id === id} onClick={() => ui.go(`/past/${x.id}`)}>{fmt.date(x.startDate)}</Chip>
          ))}
        </ChipRow>
        {p && snap && (
          <>
            <p className="muted">{t('plan.periodRange', { from: fmt.date(p.startDate), to: fmt.date(p.endDate) })}</p>
            <div className="primary-number">
              <span className="pn-label">{t('history.spentPeriod')}</span>
              <span className="pn-value"><Money minor={snap.spentTotal} currency={m.base} /></span>
            </div>
            <div className="group">
              {m.allEnvelopes.filter((e) => e.kind !== 'buffer' && (snap.rows[e.id]?.planned || snap.rows[e.id]?.spent)).map((e) => {
                const r = snap.rows[e.id];
                return (
                  <div key={e.id} className="list-item static">
                    <span className={`tile tile-${e.kind}`}><Icon name={e.icon} size={22} /></span>
                    <span className="li-main"><span className="li-title">{e.name}</span><span className="li-sub">{t('plan.planned')} {fmt.money(r.planned, m.base)} · {t('plan.spent')} {fmt.money(r.spent, m.base)}</span></span>
                    <Money minor={r.available} currency={m.base} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
