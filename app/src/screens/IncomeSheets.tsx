import { useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button, Chip, ChipRow, DateInput, TextInput } from '../ui/primitives';
import { AmountDisplay, NumberPad, minorToRaw, rawToMinor } from '../ui/NumberPad';
import { CurrencyPicker } from './AddSheet';
import { useI18n } from '../i18n';
import { useM } from '../state/ctx';
import { useUI } from '../state/ui';
import { currentHero, receivedMessage } from '../state/helpers';
import { receiveIncome, setCoverUntil, setLateAssumed } from '../data/repo';
import { addDays, convertCurrency, currencyExponent, isValidRate } from '../domain';

export function ReceiveSheet({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  const ev = m.data.ds.events.find((e) => e.id === eventId);
  const [currency, setCurrency] = useState(ev?.currency ?? m.base);
  const exp = currencyExponent(currency);
  const [raw, setRaw] = useState(ev ? minorToRaw(ev.expectedAmount, currencyExponent(ev.currency)) : '');
  const [rate, setRate] = useState(m.data.ws.rates[currency]?.rate ?? '');
  const [pick, setPick] = useState(false);
  if (!ev) return null;
  const foreign = currency !== m.base;
  const amount = rawToMinor(raw, exp);
  const rateOk = !foreign || isValidRate(rate);
  const ok = amount > 0 && rateOk;
  const parts = fmt.parts(0, currency);
  if (pick) return <CurrencyPicker value={currency} onClose={() => setPick(false)} onPick={(c) => { setCurrency(c); setRate(m.data.ws.rates[c]?.rate ?? ''); setPick(false); }} />;
  const save = async () => {
    const r = await receiveIncome(ev.id, { amount, currency, rate: foreign ? rate : undefined, date: m.today });
    const n = await currentHero(m.today);
    ui.toast({ message: receivedMessage(t, (d) => fmt.date(d), fmt.number, ev, m.period.endDate, m.today, n), duration: 6000 });
    onClose();
    if (r.uncertain) ui.openSheet({ kind: 'cover' });
  };
  return (
    <Sheet title={t('inc.differentTitle')} onClose={onClose} tag="receive" actions={<Button block disabled={!ok} why={t('add.amountHint')} onClick={save}>{t('inc.markReceived')}</Button>}>
      <p className="muted">{t('inc.receivedHint')}</p>
      <AmountDisplay raw={raw} symbol={parts.symbol || currency} symbolFirst={parts.symbolFirst} converted={foreign && rateOk && amount > 0 ? t('add.converted', { amount: fmt.money(convertCurrency(amount, currency, m.base, rate), m.base) }) : undefined} />
      <div className="detail-row">
        <button type="button" className="chip" onClick={() => setPick(true)}><span className="chip-label">{currency}</span></button>
      </div>
      {foreign && (
        <div className="field">
          <label className="field-label" htmlFor="rate2">{t('add.rate')}</label>
          <TextInput id="rate2" value={rate} onChange={setRate} inputMode="decimal" placeholder="0.00" />
          <div className="field-hint">{t('add.rateHelp', { base: m.base, foreign: currency })}</div>
        </div>
      )}
      <NumberPad raw={raw} onChange={setRaw} exp={exp} />
    </Sheet>
  );
}

export function CoverSheet({ onClose }: { onClose: () => void }) {
  const m = useM();
  const { t, fmt } = useI18n();
  const ui = useUI();
  const [custom, setCustom] = useState(false);
  const [date, setDate] = useState(addDays(m.today, 30));
  const set = async (d: string) => {
    await setCoverUntil(d);
    ui.toast({ message: `${t('why.mode.cover')} ${fmt.date(d)}`, duration: 4000 });
    onClose();
  };
  return (
    <Sheet title={t('inc.coverTitle')} onClose={onClose} size="medium" tag="cover">
      <p className="muted">{t('card.coverBody')}</p>
      <ChipRow label={t('inc.coverTitle')} wrap>
        <Chip role="button" onClick={() => set(addDays(m.today, 7))}>{t('card.cover.week')}</Chip>
        <Chip role="button" onClick={() => set(addDays(m.today, 14))}>{t('card.cover.twoWeeks')}</Chip>
        <Chip role="button" onClick={() => set(addDays(m.today, 30))}>{t('card.cover.month')}</Chip>
        <Chip role="button" selected={custom} onClick={() => setCustom(true)}>{t('card.cover.pick')}</Chip>
      </ChipRow>
      {custom && (
        <div className="stack">
          <DateInput label={t('card.cover.pick')} value={date} min={addDays(m.today, 1)} onChange={setDate} />
          <Button block onClick={() => set(date)}>{t('common.save')}</Button>
        </div>
      )}
    </Sheet>
  );
}

export function ExpectSheet({ onClose }: { onClose: () => void }) {
  const m = useM();
  const { t } = useI18n();
  const [date, setDate] = useState(m.data.ws.lateAssumedArrival ?? addDays(m.today, 2));
  return (
    <Sheet title={t('card.expectDate')} onClose={onClose} size="medium" tag="expect" actions={<Button block onClick={async () => { await setLateAssumed(date); onClose(); }}>{t('common.save')}</Button>}>
      <DateInput label={t('card.expectDate')} value={date} min={m.today} onChange={setDate} />
    </Sheet>
  );
}
