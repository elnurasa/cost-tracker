import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Chip, ChipRow, DateInput, IconButton, Segmented } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { formatRaw, rawToMinor } from '../ui/NumberPad';
import { LOCALES, NUMBER_SPECS, azDay, translate, useI18n, type Key } from '../i18n';
import { addDays, currencyExponent, dayOfWeek, type Income, type OnboardIncome, type Schedule } from '../domain';

/**
 * The income row editor, shared by onboarding step 1 and the Income screen, so adding or editing an income looks and
 * works the same everywhere. Every row has the same rank: name, amount, schedule. The amount of the ACTIVE row is typed
 * on the app's number pad (one pad, the active row is highlighted); every row can be made active with one tap.
 */
export interface IncomeDraft {
  id: string;
  name: string;
  kind: Income['kind'];
  /** pad raw string, '.' decimal ("12.5") */
  raw: string;
  schedule: Schedule;
}
export type Preset = 'monthly' | 'twice' | 'biweekly' | 'weekly' | 'varies';

let seq = 0;
export const newRowId = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

export function presetRows(p: Preset, name: (k: Key) => string, today: string): IncomeDraft[] {
  const row = (kind: Income['kind'], nameKey: Key, schedule: Schedule): IncomeDraft => ({ id: newRowId(), name: name(nameKey), kind, raw: '', schedule });
  switch (p) {
    case 'monthly': return [row('salary', 'income.salary', { type: 'monthly', day: 5 })];
    case 'twice': return [row('salary', 'income.salary', { type: 'monthly', day: 5 }), row('advance', 'income.advance', { type: 'monthly', day: 20 })];
    case 'biweekly': return [row('salary', 'income.salary', { type: 'biweekly', refDate: today })];
    case 'weekly': return [row('allowance', 'income.allowance', { type: 'weekly', weekday: dayOfWeek(today) })];
    case 'varies': return [row('freelance', 'income.freelance', { type: 'none' })];
  }
}
/** Keeps the old frequency id for copy (titles) and analytics: what the list looks like. */
export function presetOf(rows: IncomeDraft[]): Preset {
  if (rows.every((r) => r.schedule.type === 'none' || r.schedule.type === 'once')) return 'varies';
  if (rows.length === 1 && rows[0].schedule.type === 'weekly') return 'weekly';
  if (rows.length === 1 && rows[0].schedule.type === 'biweekly') return 'biweekly';
  return rows.filter((r) => r.schedule.type === 'monthly').length >= 2 ? 'twice' : 'monthly';
}
export const toOnboardIncomes = (rows: IncomeDraft[], exp: number): OnboardIncome[] =>
  rows.map((r) => ({ name: r.name, kind: r.kind, amount: rawToMinor(r.raw, exp), schedule: r.schedule }));

export function useScheduleLabel() {
  const { t, fmt, locale } = useI18n();
  return (s: Schedule): string => {
    if (s.type === 'monthly') return s.day === 'L' || s.day >= 29 ? t('inc.lastDay') : t('inc.monthlyOn', { day: locale === 'az' ? azDay(s.day) : s.day });
    if (s.type === 'weekly') return t('inc.weeklyOn', { weekday: fmt.weekday(s.weekday, 'long') });
    if (s.type === 'biweekly') return t('inc.biweekly', { date: fmt.date(s.refDate) });
    if (s.type === 'once') return t('inc.onceOn', { date: fmt.date(s.date) });
    return t('inc.adHoc');
  };
}

export function IncomeRowsEditor({ rows, active, onActive, onChange, currency, single }: {
  rows: IncomeDraft[]; active: string; onActive: (id: string, reveal?: boolean) => void; onChange: (rows: IncomeDraft[]) => void;
  currency: string; single?: boolean;
}) {
  const { t, fmt, locale } = useI18n();
  const { symbol: currencySymbol, symbolFirst } = fmt.parts(0, currency);
  const exp = currencyExponent(currency);
  const label = useScheduleLabel();
  const [sched, setSched] = useState<string | null>(null);
  const set = (id: string, patch: Partial<IncomeDraft>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const editing = rows.find((r) => r.id === sched);
  const shown = (raw: string) => {
    const n = raw ? formatRaw(raw, NUMBER_SPECS[locale].group, fmt.decimalSep) : '0';
    return symbolFirst ? `${currencySymbol}${n}` : `${n} ${currencySymbol}`;
  };
  return (
    <div className="inc-rows" role="list">
      {rows.map((r, i) => {
        const on = r.id === active;
        return (
          <div key={r.id} role="listitem" className={`inc-row${on ? ' is-active' : ''}`}>
            <div className="inc-row-top">
              <input
                className="input inc-name"
                value={r.name}
                maxLength={30}
                aria-label={t('inc.rowName', { n: i + 1 })}
                onFocus={() => onActive(r.id, false)}
                onChange={(e) => set(r.id, { name: e.target.value })}
              />
              <button
                type="button"
                className={`inc-amount num${r.raw ? '' : ' is-empty'}`}
                aria-pressed={on}
                aria-label={t('inc.amountFor', { name: r.name || t('income.other'), amount: fmt.moneyName(rawToMinor(r.raw, exp), currency) })}
                onClick={() => onActive(r.id)}
              >
                {shown(r.raw)}
              </button>
              {!single && rows.length > 1 && (
                <IconButton icon="x" label={t('inc.removeRow', { name: r.name || t('income.other') })} onClick={() => {
                  const next = rows.filter((x) => x.id !== r.id);
                  onChange(next);
                  if (on) onActive(next[0].id);
                }} />
              )}
            </div>
            <button type="button" className="chip inc-sched" onClick={() => { onActive(r.id); setSched(r.id); }} aria-label={`${t('inc.scheduleTitle')}: ${label(r.schedule)}`}>
              <Icon name="calendar-days" size={18} />
              <span className="chip-label">{label(r.schedule)}</span>
              <Icon name="chevron-right" size={16} mirror />
            </button>
          </div>
        );
      })}
      {/* portal: a sheet inside a sheet must not inherit the parent's transform */}
      {editing && createPortal(<ScheduleSheet value={editing.schedule} onClose={() => setSched(null)} onPick={(s) => { set(editing.id, { schedule: s }); setSched(null); }} />, document.body)}
    </div>
  );
}

const TYPES = ['monthly', 'weekly', 'biweekly', 'none'] as const;

export function ScheduleSheet({ value, onPick, onClose }: { value: Schedule; onPick: (s: Schedule) => void; onClose: () => void }) {
  const { t, fmt } = useI18n();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [type, setType] = useState<(typeof TYPES)[number]>(value.type === 'once' ? 'none' : value.type);
  const [day, setDay] = useState<number | 'L'>(value.type === 'monthly' ? value.day : 5);
  const [weekday, setWeekday] = useState(value.type === 'weekly' ? value.weekday : 5);
  const [ref, setRef] = useState(value.type === 'biweekly' ? value.refDate : todayStr);
  const [once, setOnce] = useState(value.type === 'once' ? value.date : '');
  const result: Schedule = type === 'monthly' ? { type, day } : type === 'weekly' ? { type, weekday } : type === 'biweekly' ? { type, refDate: ref } : once ? { type: 'once', date: once } : { type: 'none' };
  return (
    <Sheet title={t('inc.scheduleTitle')} onClose={onClose} tag="schedule" actions={<Button block onClick={() => onPick(result)}>{t('common.done')}</Button>}>
      <Segmented label={t('inc.schedule')} value={type} onChange={setType} options={TYPES.map((k) => ({ id: k, label: t(`inc.sched.${k}` as Key) }))} />
      {type === 'monthly' && (
        <div>
          <div className="field-label" id="dg">{t('inc.day')}</div>
          <div className="day-grid" role="radiogroup" aria-labelledby="dg">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <button key={d} type="button" role="radio" aria-checked={day === d} className={`day-cell num${day === d ? ' is-selected' : ''}`} onClick={() => setDay(d)}>{d}</button>
            ))}
            <button type="button" role="radio" aria-checked={day === 'L'} className={`day-cell day-last${day === 'L' ? ' is-selected' : ''}`} onClick={() => setDay('L')}>{t('settings.cycleLast')}</button>
          </div>
          {typeof day === 'number' && day >= 29 && <p className="field-hint">{t('inc.monthEndHint')}</p>}
        </div>
      )}
      {type === 'weekly' && (
        <ChipRow label={t('inc.weekday')} wrap>
          {[1, 2, 3, 4, 5, 6, 0].map((w) => <Chip key={w} selected={weekday === w} onClick={() => setWeekday(w)}>{fmt.weekday(w, 'long')}</Chip>)}
        </ChipRow>
      )}
      {type === 'biweekly' && (
        <div className="field"><div className="field-label">{t('onboard.nextPayday')}</div><DateInput label={t('onboard.nextPayday')} value={ref} min={addDays(todayStr, -13)} onChange={setRef} /></div>
      )}
      {type === 'none' && (
        <div className="field"><div className="field-label">{t('onboard.nextPaymentOpt')}</div><DateInput label={t('onboard.nextPaymentOpt')} value={once} min={addDays(todayStr, 1)} onChange={setOnce} /></div>
      )}
    </Sheet>
  );
}

const NAME_KEYS = ['income.salary', 'income.advance', 'income.allowance', 'income.freelance', 'income.other'] as const;
/** Default names follow a language switch on the welcome screen; a name the person typed stays as typed. */
export function retranslateRows(rows: IncomeDraft[], to: (k: Key) => string): IncomeDraft[] {
  return rows.map((r) => {
    const k = NAME_KEYS.find((key) => LOCALES.some((l) => translate(l.id, key) === r.name));
    return k ? { ...r, name: to(k) } : r;
  });
}
