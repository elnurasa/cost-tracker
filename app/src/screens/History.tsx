import { useMemo, useState } from 'react';
import { Button, Chip, ChipRow, DateInput, EmptyState, IconButton } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Money } from '../ui/display';
import { useI18n } from '../i18n';
import { useM } from '../state/ctx';
import { useUI } from '../state/ui';
import type { EnvelopeTransfer } from '../domain';
import { HistoryRow } from './HistoryRow';
import { buildItems, filterItems, flatten, fold, signedSpend, type HItem } from './HistoryQuery';
import { VirtualList } from './HistoryVirtual';

export { fold, HistoryRow };
/** Above this many rows the list is windowed (small lists keep plain DOM with sticky day headers). */
const VIRTUAL_FROM = 120;

function MoveRow({ tr }: { tr: EnvelopeTransfer }) {
  const m = useM();
  const { t } = useI18n();
  return (
    <div className="list-item static">
      <span className="tile tile-buffer"><Icon name="arrow-left-right" size={22} /></span>
      <span className="li-main">
        <span className="li-title">{t('history.moved', { from: m.env(tr.fromEnvelopeId)?.name ?? '', to: m.env(tr.toEnvelopeId)?.name ?? '' })}</span>
      </span>
      <Money minor={tr.amount} currency={m.base} />
    </div>
  );
}

type PeriodFilter = 'this' | 'last' | 'all' | 'range';

export function HistoryPage() {
  const m = useM();
  const { t, fmt, locale } = useI18n();
  const ui = useUI();
  const [q, setQ] = useState('');
  const [envs, setEnvs] = useState<string[]>([]);
  const [per, setPer] = useState<PeriodFilter>('this');
  const [range, setRange] = useState<{ from: string; to: string }>({ from: m.period.startDate, to: m.today });
  const [types, setTypes] = useState<string[]>([]);
  const [autoOnly, setAutoOnly] = useState<'auto' | 'manual' | null>(null);
  const [sheet, setSheet] = useState<'envelope' | 'period' | 'more' | null>(null);
  const [limit, setLimit] = useState(60);

  const lastPeriod = useMemo(() => {
    const ps = m.engine.periods;
    const i = ps.findIndex((p) => p.id === m.period.id);
    return i > 0 ? ps[i - 1] : null;
  }, [m]);

  const items = useMemo<HItem[]>(
    () => buildItems(m.data.ds.transactions, m.data.ds.transfers, (id) => m.env(id)?.name ?? '', m.base),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m.data.ds.transactions, m.data.ds.transfers, m.allEnvelopes, m.base],
  );

  const [from, to] = useMemo<[string, string]>(() => {
    if (per === 'all') return ['0000-01-01', '9999-12-31'];
    if (per === 'last' && lastPeriod) return [lastPeriod.startDate, lastPeriod.endDate];
    if (per === 'range') return [range.from, range.to];
    return [m.period.startDate, m.period.endDate];
  }, [per, lastPeriod, range, m.period]);

  const needle = fold(q.trim());
  const filtered = useMemo(() => filterItems(items, { from, to, envs, types, autoOnly, needle }), [items, from, to, envs, types, autoOnly, needle]);
  const spent = useMemo(() => filtered.reduce((sum, it) => (it.kind === 'tx' ? sum + signedSpend(it.tx) : sum), 0), [filtered]);
  const hasFilter = !!needle || envs.length > 0 || per !== 'this' || types.length > 0 || !!autoOnly;
  const virtual = filtered.length > VIRTUAL_FROM;
  const visible = virtual ? filtered : filtered.slice(0, limit);
  const rows = useMemo(() => flatten(visible), [visible]);
  const groups = useMemo(() => {
    const g: { date: string; rows: HItem[]; total: number }[] = [];
    for (const r of rows) {
      if (r.kind === 'head') g.push({ date: r.date, rows: [], total: r.total });
      else g[g.length - 1].rows.push(r.item);
    }
    return g;
  }, [rows]);
  const dayLabel = (date: string) => (date === m.today ? t('common.today') : date === addDay(m.today, -1) ? t('common.yesterday') : fmt.date(date, 'weekday'));
  const clear = () => { setQ(''); setEnvs([]); setPer('this'); setTypes([]); setAutoOnly(null); };
  const perLabel = per === 'this' ? t('history.period.this') : per === 'last' ? t('history.period.last') : per === 'all' ? t('history.period.all') : `${fmt.date(range.from)} – ${fmt.date(range.to)}`;
  void locale;

  return (
    <main className="page" id="main">
      <header className="page-header">
        <h1 className="page-title">{t('history.title')}</h1>
      </header>
      <div className="page-body">
        <div className="primary-number">
          <span className="pn-label">{hasFilter ? t('history.spentView') : t('history.spentPeriod')}</span>
          <span className="pn-value"><Money minor={spent} currency={m.base} /></span>
        </div>
        <div className="search">
          <Icon name="search" size={20} />
          <input className="search-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('history.search')} aria-label={t('history.search')} />
          {q && <IconButton icon="x" label={t('common.clear')} onClick={() => setQ('')} />}
        </div>
        <div className="chip-row">
          <button type="button" className={`chip${envs.length ? ' is-selected' : ''}`} onClick={() => setSheet('envelope')}><span className="chip-label">{envs.length ? `${t('add.envelope')} · ${envs.length}` : t('history.filter.envelope')}</span><Icon name="chevron-down" size={16} /></button>
          <button type="button" className={`chip${per !== 'this' ? ' is-selected' : ''}`} onClick={() => setSheet('period')}><span className="chip-label">{perLabel}</span><Icon name="chevron-down" size={16} /></button>
          <button type="button" className={`chip${types.length || autoOnly ? ' is-selected' : ''}`} onClick={() => setSheet('more')}><span className="chip-label">{t('history.filter.more')}</span><Icon name="chevron-down" size={16} /></button>
        </div>
        {filtered.length === 0 ? (
          items.length === 0 ? (
            <EmptyState title={t('history.empty')} body={t('history.emptyBody')} action={<Button onClick={() => ui.openSheet({ kind: 'add' })}>{t('nav.add')}</Button>} />
          ) : (
            <EmptyState title={t('history.noMatch')} action={<Button variant="secondary" onClick={clear}>{t('history.clearFilters')}</Button>} />
          )
        ) : (
          <>
            {virtual ? (
              <VirtualList
                rows={rows}
                rowKey={(r) => r.key}
                estimate={(r) => (r.kind === 'head' ? 44 : 64)}
                render={(r) =>
                  r.kind === 'head' ? (
                    <h2 className="day-head" style={{ position: 'static' }}>
                      <span>{dayLabel(r.date)}</span>
                      {r.total !== 0 && <span className="muted"><Money minor={r.total} currency={m.base} /></span>}
                    </h2>
                  ) : (
                    <div style={{ background: 'var(--color-surface)', borderRadius: `${r.first ? 'var(--radius-lg)' : 0} ${r.first ? 'var(--radius-lg)' : 0} ${r.last ? 'var(--radius-lg)' : 0} ${r.last ? 'var(--radius-lg)' : 0}`, overflow: 'hidden' }}>
                      {r.item.kind === 'tx' ? <HistoryRow tx={r.item.tx} /> : <MoveRow tr={r.item.tr} />}
                    </div>
                  )
                }
              />
            ) : (
              groups.map((g) => (
                <section key={g.date} className="day-group" aria-label={fmt.date(g.date, 'long')}>
                  <h2 className="day-head">
                    <span>{dayLabel(g.date)}</span>
                    {g.total !== 0 && <span className="muted"><Money minor={g.total} currency={m.base} /></span>}
                  </h2>
                  <div className="group">
                    {g.rows.map((it) => (it.kind === 'tx' ? <HistoryRow key={it.tx.id} tx={it.tx} /> : <MoveRow key={it.tr.id} tr={it.tr} />))}
                  </div>
                </section>
              ))
            )}
            {!virtual && filtered.length > limit && <Button variant="secondary" block onClick={() => setLimit((l) => l + 80)}>{t('history.loadMore')}</Button>}
          </>
        )}
      </div>

      {sheet === 'envelope' && (
        <Sheet title={t('history.filter.envelope')} onClose={() => setSheet(null)} size="medium" tag="filter-env" actions={<Button block onClick={() => setSheet(null)}>{t('common.done')}</Button>}>
          <ChipRow label={t('add.envelope')} wrap>
            {m.allEnvelopes.map((e) => (
              <Chip key={e.id} role="checkbox" selected={envs.includes(e.id)} onClick={() => setEnvs((x) => (x.includes(e.id) ? x.filter((i) => i !== e.id) : [...x, e.id]))}>{e.name}</Chip>
            ))}
          </ChipRow>
        </Sheet>
      )}
      {sheet === 'period' && (
        <Sheet title={t('history.period.this')} onClose={() => setSheet(null)} size="medium" tag="filter-period" actions={<Button block onClick={() => setSheet(null)}>{t('common.done')}</Button>}>
          <ChipRow label={t('history.period.this')} wrap>
            <Chip selected={per === 'this'} onClick={() => setPer('this')}>{t('history.period.this')}</Chip>
            {lastPeriod && <Chip selected={per === 'last'} onClick={() => setPer('last')}>{t('history.period.last')}</Chip>}
            <Chip selected={per === 'all'} onClick={() => setPer('all')}>{t('history.period.all')}</Chip>
            <Chip selected={per === 'range'} onClick={() => setPer('range')}>{t('history.period.range')}</Chip>
          </ChipRow>
          {per === 'range' && (
            <div className="stack">
              <label className="field-label">{t('history.from')}</label>
              <DateInput label={t('history.from')} value={range.from} max={range.to} onChange={(v) => setRange((r) => ({ ...r, from: v }))} />
              <label className="field-label">{t('history.to')}</label>
              <DateInput label={t('history.to')} value={range.to} min={range.from} onChange={(v) => setRange((r) => ({ ...r, to: v }))} />
            </div>
          )}
        </Sheet>
      )}
      {sheet === 'more' && (
        <Sheet title={t('history.filter.more')} onClose={() => setSheet(null)} size="medium" tag="filter-more" actions={<Button block onClick={() => setSheet(null)}>{t('common.done')}</Button>}>
          <div className="field-label">{t('history.type')}</div>
          <ChipRow label={t('history.type')} wrap>
            {(['expense', 'income', 'move'] as const).map((k) => (
              <Chip key={k} role="checkbox" selected={types.includes(k)} onClick={() => setTypes((x) => (x.includes(k) ? x.filter((i) => i !== k) : [...x, k]))}>{t(`history.type.${k}` as const)}</Chip>
            ))}
          </ChipRow>
          <div className="field-label">{t('history.source')}</div>
          <ChipRow label={t('history.source')} wrap>
            <Chip selected={autoOnly === 'manual'} onClick={() => setAutoOnly(autoOnly === 'manual' ? null : 'manual')}>{t('history.source.manual')}</Chip>
            <Chip selected={autoOnly === 'auto'} onClick={() => setAutoOnly(autoOnly === 'auto' ? null : 'auto')}>{t('history.source.auto')}</Chip>
          </ChipRow>
          <Button variant="text" onClick={clear}>{t('history.clearFilters')}</Button>
        </Sheet>
      )}
    </main>
  );
}
function addDay(d: string, n: number) {
  const t = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
