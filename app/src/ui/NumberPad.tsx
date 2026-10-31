import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { NUMBER_SPECS, groupDigits, useI18n } from '../i18n';
import { currencyExponent, pow10 } from '../domain';

/** Raw amount strings use '.' as decimal separator internally, e.g. "12.5". */
export function pressKey(raw: string, key: string, exp: number): string {
  if (key === 'back') return raw.slice(0, -1);
  if (key === 'clear') return '';
  if (key === '.') {
    if (exp === 0 || raw.includes('.')) return raw;
    return (raw === '' ? '0' : raw) + '.';
  }
  if (!/^\d$/.test(key)) return raw;
  const [i, f] = raw.split('.');
  if (f !== undefined && f.length >= exp) return raw;
  if (f === undefined && i.replace(/^0+/, '').length >= 9) return raw;
  if (raw === '0') return key;
  return raw + key;
}
export function rawToMinor(raw: string, exp: number): number {
  if (!raw || raw === '.') return 0;
  const [i, f = ''] = raw.split('.');
  return Number(i || '0') * pow10(exp) + Number((f + '0'.repeat(exp)).slice(0, exp) || '0');
}
export function minorToRaw(minor: number, exp: number): string {
  if (minor <= 0) return '';
  const p = pow10(exp);
  const i = Math.floor(minor / p);
  const f = minor % p;
  if (exp === 0 || f === 0) return String(i);
  return `${i}.${String(f).padStart(exp, '0').replace(/0+$/, '')}`;
}
/** Locale-grouped live display of a raw amount (keeps a trailing decimal separator). `group`/`sep` come from the UI language. */
export function formatRaw(raw: string, group: string, sep: string): string {
  const [i = '', f] = raw.split('.');
  const grouped = groupDigits(String(Number(i || '0')), group);
  return f === undefined ? grouped : `${grouped}${sep}${f}`;
}

export function AmountDisplay({ raw, symbol, placeholder = '0', converted, symbolFirst = true, currency }: { raw: string; symbol: string; placeholder?: string; converted?: string; symbolFirst?: boolean; currency?: string }) {
  const { fmt, t, locale } = useI18n();
  const text = raw ? formatRaw(raw, NUMBER_SPECS[locale].group, fmt.decimalSep) : placeholder;
  const long = text.length > 10;
  const num = (
    <span className={`amount-num${raw ? '' : ' is-empty'}${long ? ' is-long' : ''}`} data-amount>
      {text}
    </span>
  );
  const sym = <span className="amount-sym">{symbol}</span>;
  // spoken in the UI language ("4 manat 50 qəpik"), not as raw digits and a symbol
  const spoken = currency ? fmt.moneyName(rawToMinor(raw, currencyExponent(currency)), currency) : `${text} ${symbol}`;
  return (
    <div className="amount-display">
      <div className="amount-line" role="status" aria-live="polite" aria-label={t('add.amountAria', { amount: spoken })}>
        {symbolFirst ? sym : null}
        {num}
        {symbolFirst ? null : sym}
      </div>
      <div className="amount-caret" aria-hidden="true" />
      {converted && <div className="amount-converted muted">{converted}</div>}
    </div>
  );
}

export function NumberPad({ raw, onChange, exp }: { raw: string; onChange: (v: string) => void; exp: number }) {
  const { t, fmt } = useI18n();
  const rawRef = useRef(raw);
  rawRef.current = raw;
  const cb = useRef(onChange);
  cb.current = onChange;
  const holdRef = useRef<number | undefined>(undefined);
  const nudge = useRef<HTMLDivElement>(null);

  const press = (k: string) => {
    const next = pressKey(rawRef.current, k, exp);
    if (next === rawRef.current && k !== 'back') {
      nudge.current?.parentElement?.classList.remove('nudge');
      void nudge.current?.parentElement?.offsetWidth;
      nudge.current?.parentElement?.classList.add('nudge');
    } else if (navigator.vibrate) {
      try {
        navigator.vibrate(8);
      } catch {
        /* optional */
      }
    }
    rawRef.current = next;
    cb.current(next);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === ',' || e.key === '.') press('.');
      else if (e.key === 'Backspace') press('back');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exp]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', exp === 0 ? '00' : '.', '0', 'back'];
  // E-01: a key fires on pointer DOWN, so a fast second tap is never lost because the finger lifted a few pixels away
  // (a click needs down and up on the same element). The click that follows a handled pointer-down is swallowed;
  // keyboard activation (Enter/Space) has no pointer-down and still arrives as a click.
  const pending = useRef<Record<string, number>>({});
  const fire = (k: string) => (k === '00' ? (press('0'), press('0')) : press(k));
  return (
    <div className="pad" role="group" aria-label={t('add.keypad')}>
      <div ref={nudge} hidden />
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          className="pad-key"
          aria-label={k === 'back' ? t('add.deleteKey') : k === '.' ? t('add.decimalKey') : k}
          onClick={() => {
            const at = pending.current[k];
            pending.current[k] = 0;
            if (at && performance.now() - at < 1000) return;
            fire(k);
          }}
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            pending.current[k] = performance.now();
            fire(k);
            if (k === 'back') holdRef.current = window.setTimeout(() => cb.current(''), 450);
          }}
          onPointerCancel={() => {
            pending.current[k] = 0;
            window.clearTimeout(holdRef.current);
          }}
          onPointerUp={() => window.clearTimeout(holdRef.current)}
          onPointerLeave={() => window.clearTimeout(holdRef.current)}
        >
          {k === 'back' ? <Icon name="delete" size={26} /> : k === '.' ? fmt.decimalSep : k}
        </button>
      ))}
    </div>
  );
}
