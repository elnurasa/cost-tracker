import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sheet } from '../ui/Sheet';
import { Button, Chip, ChipRow, DateInput, IconButton, Segmented, TextInput } from '../ui/primitives';
import { AmountDisplay, NumberPad, minorToRaw, rawToMinor } from '../ui/NumberPad';
import { Icon } from '../ui/Icon';
import { Money } from '../ui/display';
import { useI18n, tagOf } from '../i18n';
import { useM } from '../state/ctx';
import { useUI } from '../state/ui';
import { patchWithTransaction, rollbackPatch } from '../state/model';
import { getPrefs, setPrefs } from '../state/prefs';
import {
  addTransaction, deleteTransaction, ensureEnvelope, moveMoney, receiveIncome, restoreTransaction, setTransferDeleted, undoExpenseWithEnvelope, updateTransaction,
} from '../data/repo';
import { NewEnvelopeSheet, type NewEnvelopeDraft } from './EnvelopeInline';

/** The add sheet's inline "+ New envelope" (day-to-day by default) is created together with the entry. */
const NEW_ENV = '__new_envelope__';
import { Engine, addDays, convertCurrency, currencyExponent, isValidRate, planMove, pow10, previewHeroParts, sourceCap, suggestMove, type Envelope, type Transaction } from '../domain';
import { envView } from '../ui/display';

// ------------------------------------------------------------------ currency picker

const COMMON = ['AZN', 'TRY', 'USD', 'EUR', 'RUB', 'GBP', 'GEL', 'KZT', 'UZS', 'UAH'];
export function allCurrencies(): string[] {
  try {
    const f = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (f) return f('currency');
  } catch {
    /* fall through */
  }
  return COMMON;
}
export function CurrencyPicker({ value, onPick, onClose, exclude }: { value?: string; onPick: (c: string) => void; onClose: () => void; exclude?: string }) {
  const { t, locale } = useI18n();
  const m = useM();
  const [q, setQ] = useState('');
  const names = useMemo(() => {
    try {
      return new Intl.DisplayNames([tagOf(locale)], { type: 'currency' });
    } catch {
      return null;
    }
  }, [locale]);
  const list = useMemo(() => {
    const top = [m.base, ...Object.keys(m.data.ws.rates), ...COMMON];
    const all = [...new Set([...top, ...allCurrencies()])].filter((c) => c !== exclude);
    const ql = q.trim().toLowerCase();
    return all.filter((c) => !ql || c.toLowerCase().includes(ql) || (names?.of(c) ?? '').toLowerCase().includes(ql)).slice(0, 80);
  }, [q, m, names, exclude]);
  return (
    <Sheet title={t('add.currency')} onClose={onClose} size="tall" tag="currency">
      <TextInput value={q} onChange={setQ} placeholder={t('sys.searchCurrency')} aria-label={t('sys.searchCurrency')} />
      <ul className="list" role="listbox" aria-label={t('add.currency')}>
        {list.map((c) => (
          <li key={c}>
            <button type="button" role="option" aria-selected={c === value} className="list-item" onClick={() => onPick(c)}>
              <span className="li-main">
                <span className="li-title">{c}</span>
                <span className="li-sub">{names?.of(c) ?? ''}</span>
              </span>
              {c === value && <Icon name="check" size={20} />}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

// ------------------------------------------------------------------ move form

export function MoveForm({ initialTo, initialFrom, onDone }: { initialTo?: string; initialFrom?: string; onDone: () => void }) {
  const m = useM();
  const { t, fmt } = useI18n();
  const ui = useUI();
  const sug = useMemo(() => suggestMove(m.snap, m.allEnvelopes, m.exp, initialTo), [m.snap, m.allEnvelopes, m.exp, initialTo]);
  const [to, setTo] = useState<string | null>(initialTo ?? sug.toId);
  const [from, setFrom] = useState<string | null>(initialFrom ?? sug.fromId);
  const [amount, setAmount] = useState<number>(sug.amount);
  const [typing, setTyping] = useState(false);
  const [pick, setPick] = useState<'to' | 'from' | null>(null);
  const [useRest, setUseRest] = useState(true);
  const step = 10 * pow10(m.exp);
  const cap = sourceCap(m.snap, m.allEnvelopes, from);
  const capped = cap !== null && amount > cap;
  // E-06: when the chosen source cannot cover it, offer the next sources (4.8 order) in the same sheet
  const plan = useMemo(() => (to && from ? planMove(m.snap, m.allEnvelopes, to, from, amount) : { parts: [], rest: 0 }), [m.snap, m.allEnvelopes, to, from, amount]);
  const extra = capped ? plan.parts.filter((p) => p.from !== from) : [];
  const parts = capped && useRest ? plan.parts : from && to ? [{ from, amount: cap !== null ? Math.min(amount, cap) : amount }] : [];
  const total = parts.reduce((x, p) => x + p.amount, 0);
  const preview = useMemo(() => (to && total > 0 ? previewHeroParts(m.data.ds, m.today, m.period.id, parts, to, m.exp) : null), [m, to, total, JSON.stringify(parts)]); // eslint-disable-line react-hooks/exhaustive-deps
  const now = Math.floor(m.snap.safe.leftToday / pow10(m.exp));
  const fromEnv = m.env(from);
  const toEnv = m.env(to);
  const valid = !!to && !!from && to !== from && total > 0;
  const av = (id: string) => m.snap.available[id] ?? 0;
  const save = async () => {
    if (!valid || !to) return;
    const done: string[] = [];
    for (const p of parts) if (p.amount > 0) done.push((await moveMoney({ periodId: m.period.id, from: p.from, to, amount: p.amount }, m.today)).id);
    const names = parts.map((p) => m.env(p.from)?.name ?? '').join(', ');
    const stillShort = Math.max(0, -(av(to) + total));
    ui.toast({
      message: t('move.done', { amount: fmt.money(total, m.base), from: names, to: toEnv?.name ?? '' }) + (stillShort > 0 && toEnv?.kind === 'flexible' ? ` ${t('move.stillShort', { amount: fmt.money(stillShort, m.base) })}` : ''),
      duration: 8000,
      action: { label: t('common.undo'), run: () => void Promise.all(done.map((id) => setTransferDeleted(id, true))) },
    });
    onDone();
  };
  const envField = (which: 'to' | 'from', id: string | null) => {
    const e = m.env(id);
    return (
      <button type="button" className="list-item move-field" onClick={() => setPick(which)} aria-haspopup="dialog">
        <span className="li-main">
          <span className="li-sub">{t(which === 'to' ? 'move.to' : 'move.from')}</span>
          <span className="li-title">{e?.name ?? t('move.pick')}</span>
        </span>
        {e && <Money minor={av(e.id)} currency={m.base} />}
        <Icon name="chevron-right" size={20} mirror />
      </button>
    );
  };
  return (
    <div className="stack">
      <div className="group">
        {envField('to', to)}
        {envField('from', from)}
      </div>
      <div className="stepper">
        <IconButton icon="minus" label={t('move.minus', { step: fmt.money(step, m.base) })} onClick={() => setAmount(Math.max(0, amount - step))} />
        <button type="button" className="stepper-value" onClick={() => setTyping((v) => !v)} aria-expanded={typing}>
          <Money minor={total || amount} currency={m.base} fixed />
        </button>
        <IconButton icon="plus" label={t('move.plus', { step: fmt.money(step, m.base) })} onClick={() => setAmount(amount + step)} />
      </div>
      {typing && <MoveTyper amount={amount} exp={m.exp} onChange={setAmount} />}
      {capped && fromEnv && <p className="note">{t('move.capShort', { source: fromEnv.name, amount: fmt.money(cap ?? 0, m.base) })}</p>}
      {capped && extra.length > 0 && (
        <Chip role="checkbox" selected={useRest} onClick={() => setUseRest((v) => !v)}>
          {t('move.restFrom', { amount: fmt.money(extra.reduce((x, p) => x + p.amount, 0), m.base), source: extra.map((p) => m.env(p.from)?.name ?? '').join(', ') })}
        </Chip>
      )}
      {capped && (plan.rest > 0 || extra.length === 0) && (
        <p className="note">{t('move.noSpare', { amount: fmt.money(useRest ? plan.rest : amount - (cap ?? 0), m.base) })}</p>
      )}
      {preview !== null && <p className="note" aria-live="polite">{t(preview === now ? 'move.previewSame' : 'move.preview', { n: fmt.number(preview) })}</p>}
      <Button block disabled={!valid} onClick={save}>{t('move.action', { amount: fmt.money(total, m.base) })}</Button>
      {pick && createPortal(
        <Sheet title={t(pick === 'to' ? 'move.to' : 'move.from')} onClose={() => setPick(null)} tag="move-pick">
          <ul className="list">
            {m.envelopes.filter((e) => e.id !== (pick === 'to' ? from : to)).map((e) => (
              <li key={e.id}>
                <button type="button" className="list-item" onClick={() => { if (pick === 'to') setTo(e.id); else setFrom(e.id); setPick(null); }}>
                  <span className={`tile tile-${e.kind}`}><Icon name={e.icon} size={22} /></span>
                  <span className="li-main"><span className="li-title">{e.name}</span></span>
                  <Money minor={av(e.id)} currency={m.base} />
                  {e.id === (pick === 'to' ? to : from) && <Icon name="check" size={20} />}
                </button>
              </li>
            ))}
          </ul>
        </Sheet>,
        document.body,
      )}
    </div>
  );
}
function MoveTyper({ amount, exp, onChange }: { amount: number; exp: number; onChange: (n: number) => void }) {
  const [raw, setRaw] = useState(minorToRaw(amount, exp));
  const { fmt } = useI18n();
  return (
    <div>
      <AmountDisplay raw={raw} symbol="" />
      <NumberPad raw={raw} exp={exp} onChange={(v) => { setRaw(v); onChange(rawToMinor(v, exp)); }} />
      <span className="sr-only">{fmt.decimalSep}</span>
    </div>
  );
}

export function MoveSheet({ to, from, onClose }: { to?: string; from?: string; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Sheet title={t('move.title')} onClose={onClose} size="tall" tag="move">
      <MoveForm initialTo={to} initialFrom={from} onDone={onClose} />
    </Sheet>
  );
}

// ------------------------------------------------------------------ add / edit

interface Draft { raw: string; envelopeId: string | null; note: string; currency: string; ts: number }
const DRAFT_KEY = 'sakin.draft';
const readDraft = (): Draft | null => {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
    return d && Date.now() - d.ts < 86400000 ? d : null;
  } catch {
    return null;
  }
};
const writeDraft = (d: Draft | null) => {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
};

export function AddSheet({ envelopeId, mode: initialMode, moveTo, editTx, onClose }: { envelopeId?: string; mode?: 'expense' | 'income' | 'move'; moveTo?: string; editTx?: Transaction; onClose: () => void }) {
  const m = useM();
  const { t, fmt } = useI18n();
  const ui = useUI();
  const prefs = getPrefs();
  const editing = !!editTx;
  const draft = useMemo(() => (editing || envelopeId ? null : readDraft()), [editing, envelopeId]);
  const spendable = useMemo(() => m.envelopes.filter((e) => e.kind !== 'buffer'), [m.envelopes]);

  const defaultEnv = useMemo(() => {
    if (editTx?.envelopeId) return editTx.envelopeId;
    if (envelopeId) return envelopeId;
    if (draft?.envelopeId) return draft.envelopeId;
    const last = prefs.lastEnvelopeId && spendable.find((e) => e.id === prefs.lastEnvelopeId);
    if (last) return last.id;
    return (spendable.find((e) => e.kind === 'flexible') ?? spendable[0])?.id ?? null;
  }, [editTx, envelopeId, draft, prefs.lastEnvelopeId, spendable]);

  const [mode, setMode] = useState<'expense' | 'income' | 'move'>(editTx ? (editTx.type === 'income' ? 'income' : 'expense') : initialMode ?? 'expense');
  const [raw, setRaw] = useState(editTx ? minorToRaw(editTx.amount, currencyExponent(editTx.currency)) : draft?.raw ?? '');
  const [envId, setEnvId] = useState<string | null>(defaultEnv);
  const [currency, setCurrency] = useState(editTx?.currency ?? draft?.currency ?? m.base);
  const [rate, setRate] = useState(editTx && editTx.currency !== m.base ? editTx.rate : '');
  const [date, setDate] = useState(editTx?.date ?? m.today);
  const [note, setNote] = useState(editTx?.note ?? draft?.note ?? '');
  const [refund, setRefund] = useState(editTx?.type === 'refund');
  const [payment, setPayment] = useState<'cash' | 'card' | 'other' | null>(editTx?.payment ?? null);
  const [more, setMore] = useState(false);
  const [picker, setPicker] = useState<'env' | 'cur' | 'new' | null>(null);
  const [newEnv, setNewEnv] = useState<NewEnvelopeDraft | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const foreign = currency !== m.base;
  const exp = currencyExponent(currency);
  const stored = m.data.ws.rates[currency]?.rate ?? '';
  useEffect(() => {
    if (foreign && !rate && stored && !editTx) setRate(stored);
    if (!foreign) setRate('');
  }, [foreign, stored, currency]); // eslint-disable-line react-hooks/exhaustive-deps

  const amount = rawToMinor(raw, exp);
  const rateOk = !foreign || isValidRate(rate);
  const baseAmt = foreign && rateOk && amount > 0 ? convertCurrency(amount, currency, m.base, rate) : amount;

  // chips: preselected first, then frequent (30 days), then pocket, capped at 6
  const chips = useMemo(() => {
    const since = addDays(m.today, -30);
    const freq = new Map<string, number>();
    for (const tx of m.data.ds.transactions) if (tx.type === 'expense' && tx.envelopeId && tx.date >= since) freq.set(tx.envelopeId, (freq.get(tx.envelopeId) ?? 0) + 1);
    const ordered = [...spendable].sort((a, b) => (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0));
    const out: Envelope[] = [];
    const push = (e?: Envelope) => e && !out.includes(e) && out.push(e);
    push(spendable.find((e) => e.id === defaultEnv));
    ordered.slice(0, 4).forEach(push);
    push(spendable.find((e) => e.kind === 'pocket'));
    return out.slice(0, 6);
  }, [spendable, m, defaultEnv]);

  const incomeEvents = useMemo(
    () => m.data.ds.events.filter((e) => e.status === 'expected' && e.expectedDate && e.expectedDate <= addDays(m.today, 7) && e.expectedDate >= addDays(m.today, -14)).slice(0, 3),
    [m],
  );

  const env = envId === NEW_ENV ? undefined : m.env(envId);
  const envName = envId === NEW_ENV ? newEnv?.name ?? '' : env?.name ?? '';
  const canSave = amount > 0 && rateOk && (mode === 'income' || !!envId) && !busy;
  const hint = amount <= 0 ? t('add.amountHint') : !rateOk ? t('add.rateNeeded') : '';

  const close = () => {
    if (!editing && raw) {
      writeDraft({ raw, envelopeId: envId === NEW_ENV ? null : envId, note, currency, ts: Date.now() });
      ui.toast({ message: t('add.draftSaved'), duration: 3000 });
    }
    onClose();
  };

  /** Creates the inline new envelope (flexible, plan 0: no money moves, the hero does not change) right before the entry. */
  const resolveEnv = async (): Promise<{ id: string | null; created: string | null }> => {
    if (envId !== NEW_ENV) return { id: envId, created: null };
    if (!newEnv) return { id: null, created: null };
    const r = await ensureEnvelope({ name: newEnv.name, icon: newEnv.icon, kind: 'flexible', categoryKey: null });
    return { id: r.envelope.id, created: r.created ? r.envelope.id : null };
  };
  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      if (editTx) {
        const target = mode === 'income' ? { id: null, created: null } : await resolveEnv();
        await updateTransaction(editTx.id, { type: mode === 'income' ? 'income' : refund ? 'refund' : 'expense', amount, currency, rate: foreign ? rate : '1', date, envelopeId: mode === 'income' ? null : target.id, note: note || null, payment }, m.today);
        ui.toast({ message: t('add.updated'), duration: 3000 });
        onClose();
        return;
      }
      if (mode === 'income') {
        let created: string | null = null;
        if (eventId) {
          await receiveIncome(eventId, { amount, currency, rate: foreign ? rate : undefined, date: m.today });
        } else {
          const tx = await addTransaction({ type: 'income', date, amount, currency, rate: foreign ? rate : undefined, envelopeId: null, note: note || null }, m.today);
          created = tx.id;
        }
        ui.toast({ message: t('inc.received'), action: created ? { label: t('common.undo'), run: () => void deleteTransaction(created!, m.today) } : undefined, duration: 6000 });
        writeDraft(null);
        onClose();
        return;
      }
      const type = refund ? 'refund' : 'expense';
      const inPeriod = date >= m.period.startDate && date <= m.period.endDate;
      const target = await resolveEnv();
      // single update: the row is shown from memory the moment it is built; the live query then confirms it from the database
      // (not for a brand-new envelope: the model does not know it until the live query brings it)
      const tx = await addTransaction({ type, date, amount, currency, rate: foreign ? rate : undefined, envelopeId: target.id, note: note || null, payment }, m.today, (row) => { if (inPeriod && !target.created) patchWithTransaction(row); });
      setPrefs({ lastEnvelopeId: target.id });
      writeDraft(null);
      if (target.created) {
        ui.toast({ message: `${t('add.saved', { amount: fmt.money(amount, currency), envelope: envName })} ${t('pay.cat.newNamed', { name: envName })}`, duration: 8000, action: { label: t('common.undo'), run: () => void undoExpenseWithEnvelope(tx.id, target.created, m.today) } });
        onClose();
        return;
      }
      // overspend toast (never blocks): compare the envelope balance after this entry
      let message = t('add.saved', { amount: fmt.money(amount, currency), envelope: env?.name ?? '' });
      let extra: { label: string; run: () => void } | undefined;
      const row = env ? m.snap.rows[env.id] : undefined;
      if (env && row && env.kind === 'flexible' && type === 'expense') {
        const before = envView(m, env, row).left;
        const after = before - baseAmt;
        if (after < 0) {
          const over = -after;
          message = t('add.savedOver', { envelope: env.name, amount: fmt.money(over, m.base) });
          // suggest from the state AFTER this expense (4.8: a flexible envelope with spare money first, then Buffer, then Savings)
          const afterSnap = new Engine({ ...m.data.ds, transactions: [...m.data.ds.transactions, tx] }, m.today).snapshotFor(m.period.id) ?? m.snap;
          const sug = suggestMove(afterSnap, m.allEnvelopes, m.exp, env.id);
          const srcName = m.env(sug.fromId)?.name;
          if (srcName) extra = { label: t('add.moveFrom', { amount: fmt.money(over, m.base), source: srcName }), run: () => ui.openSheet({ kind: 'move', to: env.id, from: sug.fromId ?? undefined }) };
        }
      }
      if (!getPrefs().firstExpenseShown) {
        setPrefs({ firstExpenseShown: true, coachDone: true });
        message += ` ${t('add.firstTime')}`;
      }
      ui.toast({
        message,
        duration: extra ? 8000 : 6000,
        action: extra ?? { label: t('common.undo'), run: () => void deleteTransaction(tx.id, m.today) },
      });
      onClose();
      void navigator.storage?.persist?.().then((ok) => setPrefs({ persistResult: ok ? 'granted' : 'denied' })).catch(() => undefined);
    } catch (e) {
      rollbackPatch();
      ui.toast({ message: e instanceof Error && e.message === 'rate-required' ? t('add.rateNeeded') : t('sys.saveFail'), duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editTx) return;
    await deleteTransaction(editTx.id, m.today);
    ui.toast({ message: t('add.removed'), duration: 6000, action: { label: t('common.undo'), run: () => void restoreTransaction(editTx.id, m.today) } });
    onClose();
  };

  if (picker === 'cur') return <CurrencyPicker value={currency} onClose={() => setPicker(null)} onPick={(c) => { setCurrency(c); setRate(m.data.ws.rates[c]?.rate ?? ''); setPicker(null); }} />;
  if (picker === 'new') {
    return <NewEnvelopeSheet kind="flexible" initial={newEnv} onCancel={() => setPicker(null)} onDone={(r) => {
      if ('existingId' in r) {
        setEnvId(r.existingId);
        ui.toast({ message: t('env.inline.exists'), duration: 4000 });
      } else {
        setNewEnv(r.draft);
        setEnvId(NEW_ENV);
      }
      setPicker(null);
    }} />;
  }
  if (picker === 'env') {
    return (
      <Sheet title={t('add.allEnvelopes')} onClose={() => setPicker(null)} tag="envpick">
        <ul className="list">
          {spendable.map((e) => (
            <li key={e.id}>
              <button type="button" className="list-item" onClick={() => { setEnvId(e.id); setPicker(null); }}>
                <span className={`tile tile-${e.kind}`}><Icon name={e.icon} size={22} /></span>
                <span className="li-main"><span className="li-title">{e.name}</span></span>
                {e.id === envId && <Icon name="check" size={20} />}
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="list-item" onClick={() => setPicker('new')} aria-haspopup="dialog">
              <span className="tile tile-flexible"><Icon name="plus" size={22} /></span>
              <span className="li-main"><span className="li-title">{t('plan.newEnvelope')}</span></span>
            </button>
          </li>
        </ul>
      </Sheet>
    );
  }

  const title = editing ? t('add.titleEdit') : mode === 'income' ? t('add.titleIncome') : mode === 'move' ? t('move.title') : t('add.titleExpense');
  const parts = fmt.parts(0, currency);
  const saveLabel = editing ? t('add.saveEdit') : mode === 'income' ? t('add.saveIncome') : t('add.save', { envelope: envName || '…' });
  const envRow = env ? m.snap.rows[env.id] : undefined;

  return (
    <Sheet
      title={title}
      onClose={close}
      tag="add"
      actions={
        mode === 'move' ? undefined : (
          <>
            <p className="hint" id="save-hint" aria-live="polite">{hint || ' '}</p>
            <Button block disabled={!canSave} why={hint} onClick={save}>{saveLabel}</Button>
            {editing && <Button variant="danger" block onClick={remove}>{t('common.delete')}</Button>}
          </>
        )
      }
    >
      {!editing && (
        <Segmented
          label={title}
          value={mode}
          onChange={(v) => { setMode(v); setEventId(null); }}
          options={[{ id: 'expense', label: t('add.seg.expense') }, { id: 'income', label: t('add.seg.income') }, { id: 'move', label: t('add.seg.move') }]}
        />
      )}
      {mode === 'move' ? (
        <MoveForm initialTo={moveTo} onDone={onClose} />
      ) : (
        <>
          <AmountDisplay raw={raw} currency={currency} symbol={parts.symbol || currency} symbolFirst={parts.symbolFirst} converted={foreign && rateOk && amount > 0 ? t('add.converted', { amount: fmt.money(baseAmt, m.base) }) : undefined} />
          {mode === 'expense' || (editing && mode !== 'income') ? (
            <>
              <ChipRow label={t('add.envelope')}>
                {newEnv && (
                  <Chip selected={envId === NEW_ENV} onClick={() => setEnvId(NEW_ENV)} className="chip-suggested" icon={newEnv.icon}>{newEnv.name}</Chip>
                )}
                {chips.map((e) => (
                  <Chip key={e.id} selected={e.id === envId} onClick={() => { setEnvId(e.id); if (prefs.quickSave && amount > 0 && !editing) void saveWith(e.id); }}>{e.name}</Chip>
                ))}
                <Chip role="button" onClick={() => setPicker('env')}>{t('add.allEnvelopes')}</Chip>
                <button type="button" className="chip chip-new" onClick={() => setPicker('new')} aria-haspopup="dialog"><Icon name="plus" size={18} /><span className="chip-label">{t('plan.newEnvelope')}</span></button>
              </ChipRow>
              {envId === NEW_ENV && newEnv && <p className="note">{t('pay.cat.willCreate')}</p>}
              {env && envRow && env.kind !== 'pocket' && (
                <p className="note">{env.name} · {t('row.left', { amount: fmt.money(envView(m, env, envRow).left, m.base) })}</p>
              )}
            </>
          ) : (
            <ChipRow label={t('add.incomeSource')}>
              {incomeEvents.map((ev) => {
                const inc = m.data.ds.incomes.find((i) => i.id === ev.incomeId);
                return (
                  <Chip key={ev.id} selected={eventId === ev.id} onClick={() => { setEventId(ev.id); setRaw(minorToRaw(ev.expectedAmount, currencyExponent(ev.currency))); setCurrency(ev.currency); }}>{inc?.name ?? t('income.other')}</Chip>
                );
              })}
              <Chip selected={eventId === null} onClick={() => setEventId(null)}>{t('add.adHoc')}</Chip>
            </ChipRow>
          )}
          <div className="detail-row">
            <button type="button" className="chip" onClick={() => setPicker('cur')} aria-label={`${t('add.currency')}: ${currency}`}><span className="chip-label">{currency}</span></button>
            <button type="button" className="chip" onClick={() => setMore((v) => !v)} aria-expanded={more}><Icon name="pencil" size={18} /><span className="chip-label">{date === m.today ? t('common.today') : fmt.date(date)} · {note ? note : t('add.noteShort')}</span></button>
            {!editing && mode === 'expense' && <button type="button" className="chip" onClick={() => ui.openSheet({ kind: 'pay-new' })}><Icon name="receipt" size={18} /><span className="chip-label">{t('pay.fromAdd')}</span></button>}
          </div>
          {foreign && (
            <div className="field">
              <label className="field-label" htmlFor="rate">{t('add.rate')}</label>
              <TextInput id="rate" value={rate} onChange={setRate} inputMode="decimal" placeholder="0.00" />
              <div className="field-hint">{t('add.rateHelp', { base: m.base, foreign: currency })}</div>
            </div>
          )}
          {(more || editing) && (
            <div className="stack">
              <div className="field">
                <label className="field-label" htmlFor="d">{t('add.date')}</label>
                <DateInput value={date} max={m.today} onChange={setDate} label={t('add.date')} />
              </div>
              <TextInput value={note} onChange={setNote} placeholder={t('add.note')} aria-label={t('add.note')} maxLength={120} />
              {mode === 'expense' && (
                <>
                  <ChipRow label={t('add.payment')}>
                    {(['cash', 'card', 'other'] as const).map((p) => (
                      <Chip key={p} selected={payment === p} onClick={() => setPayment(payment === p ? null : p)}>{t(p === 'cash' ? 'add.cash' : p === 'card' ? 'add.card' : 'add.other')}</Chip>
                    ))}
                  </ChipRow>
                  <Chip role="checkbox" selected={refund} onClick={() => setRefund((v) => !v)}>{t('add.refund')}</Chip>
                </>
              )}
            </div>
          )}
          <NumberPad raw={raw} onChange={setRaw} exp={exp} />
        </>
      )}
    </Sheet>
  );

  async function saveWith(id: string) {
    setEnvId(id);
    setBusy(true);
    try {
      const tx = await addTransaction({ type: 'expense', date, amount, currency, rate: foreign ? rate : undefined, envelopeId: id, note: note || null, payment }, m.today);
      setPrefs({ lastEnvelopeId: id });
      writeDraft(null);
      ui.toast({ message: t('add.saved', { amount: fmt.money(amount, currency), envelope: m.env(id)?.name ?? '' }), duration: 6000, action: { label: t('common.undo'), run: () => void deleteTransaction(tx.id, m.today) } });
      onClose();
    } catch {
      ui.toast({ message: t('sys.saveFail') });
    } finally {
      setBusy(false);
    }
  }
}
