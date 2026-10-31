import { useState } from 'react';
import { BackHeader, Button, EmptyState, SectionTitle, Toggle } from '../ui/primitives';
import { NumberPad, minorToRaw, rawToMinor } from '../ui/NumberPad';
import { IncomeRowsEditor, newRowId, useScheduleLabel, type IncomeDraft } from './IncomeRows';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Money } from '../ui/display';
import { CurrencyPicker } from './AddSheet';
import { useI18n } from '../i18n';
import { useM } from '../state/ctx';
import { useUI } from '../state/ui';
import { currentHero, receivedMessage } from '../state/helpers';
import { receiveIncome, saveIncome, setIncomeDeleted, undoReceive } from '../data/repo';
import { addDays, currencyExponent, diffDays, isEarlyIncome, type Income } from '../domain';

export function IncomePage() {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  const evs = m.data.ds.events;
  const next = evs.filter((e) => e.status === 'expected' && e.expectedDate && e.expectedDate >= addDaysStr(m.today, -14)).sort((a, b) => ((a.expectedDate ?? '') < (b.expectedDate ?? '') ? -1 : 1));
  const first = next[0];
  const firstInc = m.data.ds.incomes.find((i) => i.id === first?.incomeId);
  const past = evs.filter((e) => e.status === 'received').sort((a, b) => ((a.receivedDate ?? '') < (b.receivedDate ?? '') ? 1 : -1)).slice(0, 8);
  const s = m.snap;
  const groups = (['fixed', 'flexible', 'pocket', 'savings', 'buffer'] as const).map((k) => ({
    k, total: m.byKind(k).reduce((a, e) => a + (s.alloc[e.id] ?? 0), 0),
  }));
  const planTotal = Math.max(1, groups.reduce((a, g) => a + g.total, 0));
  const mark = async (id: string, amount: number, currency: string, rate: string) => {
    const r = await receiveIncome(id, { amount, currency, rate: currency === m.base ? undefined : rate, date: m.today });
    const n = await currentHero(m.today);
    ui.toast({ message: receivedMessage(t, (d) => fmt.date(d), fmt.number, evs.find((e) => e.id === id), m.period.endDate, m.today, n), duration: 6000, action: { label: t('common.undo'), run: () => void undoReceive(id) } });
    if (r.uncertain) ui.openSheet({ kind: 'cover' });
  };
  const schedLabel = useScheduleLabel();
  const describe = (i: Income) => schedLabel(i.schedule);
  return (
    <main className="page" id="main">
      <BackHeader title={t('inc.title')} onBack={() => ui.back('/plan')} />
      <div className="page-body">
        {first && firstInc ? (
          <>
            <div className="primary-number">
              <span className="pn-label">{t('inc.next')} · {firstInc.name}</span>
              <span className="pn-value"><Money minor={first.expectedBase} currency={m.base} /></span>
              <span className="pn-sub">{t('inc.expectedOn', { date: fmt.date(first.expectedDate ?? m.today) })} · {diffDays(first.expectedDate ?? m.today, m.today) > 0 ? t('inc.inDays', { n: diffDays(first.expectedDate ?? m.today, m.today) }) : t('common.today')}</span>
            </div>
            <Button block onClick={() => mark(first.id, first.expectedAmount, first.currency, first.rate)}>{t('inc.markReceived')}</Button>
          </>
        ) : (
          <EmptyState title={t('inc.none')} action={<Button onClick={() => ui.openSheet({ kind: 'income-edit' })}>{t('inc.add')}</Button>} />
        )}

        {/* E-08: a pay marked early is visibly waiting for its own period */}
        {evs.filter((e) => isEarlyIncome(e) && (e.expectedDate ?? '') > m.period.endDate).map((e) => (
          <p key={e.id} className="note">{t('why.earlyIncome', { name: m.data.ds.incomes.find((i) => i.id === e.incomeId)?.name ?? t('income.other'), date: fmt.date(addDays(m.period.endDate, 1)) })}</p>
        ))}
        <SectionTitle>{t('inc.split')}</SectionTitle>
        <div className="split-bar" role="img" aria-label={groups.map((g) => `${t(`plan.group.${g.k}` as const)} ${fmt.money(g.total, m.base)}`).join(', ')}>
          {groups.map((g) => (g.total > 0 ? <span key={g.k} className={`split split-${g.k}`} style={{ flexGrow: g.total / planTotal }} /> : null))}
        </div>
        <div className="group">
          {groups.filter((g) => g.total > 0 || g.k === 'buffer').map((g) => (
            <div key={g.k} className="list-item static">
              <span className={`swatch split-${g.k}`} />
              <span className="li-main"><span className="li-title">{t(`plan.group.${g.k}` as const)}</span>{g.k === 'buffer' && <span className="li-sub">{t('plan.restHelp')}</span>}</span>
              <Money minor={g.total} currency={m.base} />
            </div>
          ))}
        </div>

        <SectionTitle>{t('inc.payDays')}</SectionTitle>
        <div className="group">
          {m.data.ds.incomes.filter((i) => i.active).map((i) => (
            <button key={i.id} type="button" className="list-item" onClick={() => ui.openSheet({ kind: 'income-edit', id: i.id })}>
              <span className="tile tile-income"><Icon name="banknote" size={22} /></span>
              <span className="li-main"><span className="li-title">{i.name}</span><span className="li-sub">{describe(i)}</span></span>
              <Money minor={i.expectedAmount} currency={i.currency} />
            </button>
          ))}
        </div>
        <Button variant="secondary" icon="plus" onClick={() => ui.openSheet({ kind: 'income-edit' })}>{t('inc.add')}</Button>

        {next.length > 1 && (
          <>
            <SectionTitle>{t('inc.status.expected')}</SectionTitle>
            <div className="group">
              {next.slice(1, 4).map((e) => (
                <div key={e.id} className="list-item static">
                  <span className="li-main"><span className="li-title">{m.data.ds.incomes.find((i) => i.id === e.incomeId)?.name}</span><span className="li-sub">{fmt.date(e.expectedDate ?? m.today, 'weekday')}</span></span>
                  <Money minor={e.expectedBase} currency={m.base} />
                </div>
              ))}
            </div>
          </>
        )}
        {past.length > 0 && (
          <>
            <SectionTitle>{t('inc.past')}</SectionTitle>
            <div className="group">
              {past.map((e) => (
                <div key={e.id} className="list-item static">
                  <span className="li-main"><span className="li-title">{m.data.ds.incomes.find((i) => i.id === e.incomeId)?.name ?? t('income.starting')}</span><span className="li-sub">{fmt.date(e.receivedDate ?? m.today, 'weekday')}</span></span>
                  <Money minor={e.receivedBase ?? 0} currency={m.base} sign />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
const addDaysStr = (d: string, n: number) => {
  const t = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

export function IncomeEditSheet({ id, onClose }: { id?: string; onClose: () => void }) {
  const m = useM();
  const ui = useUI();
  const { t } = useI18n();
  const inc = id ? m.data.ds.incomes.find((i) => i.id === id) : undefined;
  // the same row editor as onboarding step 1 (name, amount on the number pad, schedule with the day grid)
  const [rows, setRows] = useState<IncomeDraft[]>(() => [{
    id: inc?.id ?? newRowId(), name: inc?.name ?? t('income.other'), kind: inc?.kind ?? 'other',
    raw: inc ? minorToRaw(inc.expectedAmount, currencyExponent(inc.currency)) : '', schedule: inc?.schedule ?? { type: 'monthly', day: 20 },
  }]);
  const row = rows[0];
  const [currency, setCurrency] = useState(inc?.currency ?? m.base);
  const exp = currencyExponent(currency);
  const regular = row.schedule.type !== 'none' && row.schedule.type !== 'once';
  const [steady, setSteady] = useState((inc?.reliability ?? 'steady') === 'steady');
  const [pick, setPick] = useState(false);
  const minor = rawToMinor(row.raw, exp);
  const valid = row.name.trim().length > 0 && minor > 0;
  if (pick) return <CurrencyPicker value={currency} onClose={() => setPick(false)} onPick={(c) => { setCurrency(c); setPick(false); }} />;
  const save = async () => {
    await saveIncome({ ...(inc ? { id: inc.id } : {}), name: row.name.trim(), expectedAmount: minor, currency, schedule: row.schedule, reliability: steady && regular ? 'steady' : 'uncertain', kind: inc?.kind ?? 'other' }, m.today);
    ui.toast({ message: t('sys.saved'), duration: 3000 });
    onClose();
  };
  const remove = async () => {
    if (!inc) return;
    await setIncomeDeleted(inc.id, m.today);
    onClose();
  };
  return (
    <Sheet title={inc ? t('inc.edit') : t('inc.add')} onClose={onClose} tag="income-edit" actions={<Button block disabled={!valid} why={t('onboard.amountHint')} onClick={save}>{t('common.save')}</Button>}>
      <IncomeRowsEditor rows={rows} active={row.id} onActive={() => undefined} onChange={setRows} currency={currency} single />
      <div className="inc-foot">
        <button type="button" className="chip" aria-label={t('add.currency')} onClick={() => setPick(true)}><span className="chip-label">{currency}</span></button>
      </div>
      <NumberPad raw={row.raw} exp={exp} onChange={(v) => setRows([{ ...row, raw: v }])} />
      {regular && <Toggle checked={steady} onChange={setSteady} label={t('inc.reliability')} help={steady ? t('inc.steady') : t('inc.uncertain')} />}
      {inc && <Button variant="danger" block onClick={remove}>{t('common.remove')}</Button>}
    </Sheet>
  );
}
