import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useI18n } from '../i18n';
import { parseAmountInput } from '../domain';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'text' | 'danger';
  block?: boolean;
  icon?: string;
  why?: string; // reason shown to screen readers when disabled
};
export function Button({ variant = 'primary', block, icon, why, children, className, disabled, onClick, ...rest }: BtnProps) {
  const id = useId();
  return (
    <>
      <button
        {...rest}
        type={rest.type ?? 'button'}
        aria-disabled={disabled || undefined}
        aria-describedby={disabled && why ? id : rest['aria-describedby']}
        onClick={(e) => {
          if (disabled) return;
          onClick?.(e);
        }}
        className={`btn btn-${variant}${block ? ' btn-block' : ''}${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}
      >
        {icon && <Icon name={icon} size={20} />}
        {children}
      </button>
      {disabled && why && (
        <span id={id} className="sr-only">
          {why}
        </span>
      )}
    </>
  );
}

export function IconButton({ icon, label, onClick, className, size = 24, ...rest }: { icon: string; label: string; onClick?: () => void; className?: string; size?: number } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <button type="button" className={`icon-btn${className ? ` ${className}` : ''}`} aria-label={label} title={label} onClick={onClick} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  );
}

export function Chip({ selected, onClick, children, icon, role = 'radio', disabled, className }: { selected?: boolean; onClick?: () => void; children: ReactNode; icon?: string; role?: 'radio' | 'checkbox' | 'button'; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      role={role === 'button' ? undefined : role}
      aria-checked={role === 'button' ? undefined : !!selected}
      aria-pressed={role === 'button' ? !!selected : undefined}
      aria-disabled={disabled || undefined}
      className={`chip${selected ? ' is-selected' : ''}${className ? ` ${className}` : ''}`}
      onClick={disabled ? undefined : onClick}
    >
      {selected && <Icon name="check" size={18} />}
      {icon && !selected && <Icon name={icon} size={18} />}
      <span className="chip-label">{children}</span>
    </button>
  );
}

export function ChipRow({ children, label, wrap }: { children: ReactNode; label?: string; wrap?: boolean }) {
  return (
    <div className={`chip-row${wrap ? ' wrap' : ''}`} role="radiogroup" aria-label={label}>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={`seg${value === o.id ? ' is-selected' : ''}`}
          onClick={() => onChange(o.id)}
          onKeyDown={(e) => {
            const i = options.findIndex((x) => x.id === value);
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') onChange(options[(i + 1) % options.length].id);
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') onChange(options[(i - 1 + options.length) % options.length].id);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, help }: { checked: boolean; onChange: (v: boolean) => void; label: string; help?: string }) {
  const id = useId();
  return (
    <div className="row-setting">
      <div className="row-text">
        <label htmlFor={id} className="row-title">
          {label}
        </label>
        {help && <div className="row-sub">{help}</div>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} className={`switch${checked ? ' on' : ''}`} onClick={() => onChange(!checked)}>
        <span className="switch-knob" />
      </button>
    </div>
  );
}

export function Card({ children, className, tone }: { children: ReactNode; className?: string; tone?: 'info' | 'brand' | 'watch' }) {
  return <section className={`card${tone ? ` card-${tone}` : ''}${className ? ` ${className}` : ''}`}>{children}</section>;
}

export function Banner({ icon = 'info', children, action }: { icon?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="banner" role="status">
      <Icon name={icon} size={20} />
      <span className="banner-text">{children}</span>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <svg width="96" height="24" viewBox="0 0 96 24" aria-hidden="true" className="empty-wave">
        <path d="M2 14 C 14 4, 26 4, 38 12 S 62 20, 72 12 S 88 6, 94 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <h2 className="empty-title">{title}</h2>
      {body && <p className="muted">{body}</p>}
      {action}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="field-control" id={`${id}-wrap`}>
        {children}
      </div>
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export function TextInput({ id, value, onChange, placeholder, type = 'text', inputMode, maxLength, autoFocus, 'aria-label': aria, className }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; inputMode?: 'text' | 'numeric' | 'decimal'; maxLength?: number; autoFocus?: boolean; 'aria-label'?: string; className?: string }) {
  return (
    <input
      id={id}
      className={`input${className ? ` ${className}` : ''}`}
      type={type}
      value={value}
      placeholder={placeholder}
      inputMode={inputMode}
      maxLength={maxLength}
      autoFocus={autoFocus}
      aria-label={aria}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Minor units -> text for an amount field in the UI language ("12,5" in AZ/TR/RU, "12.5" in EN); '' for 0. */
export function amountText(minor: number | null | undefined, exp: number, sep: string): string {
  if (!minor || minor <= 0) return '';
  const p = 10 ** exp;
  const i = Math.floor(minor / p);
  const f = minor % p;
  return exp === 0 || f === 0 ? String(i) : `${i}${sep}${String(f).padStart(exp, '0').replace(/0+$/, '')}`;
}

/**
 * Amount text field (plan rows): keeps what the person typed ("12," while typing) and reports minor units through
 * `parseAmountInput`, which accepts "," and "." as decimal and never throws; empty or half-typed text reports 0.
 */
export function AmountField({ minor, exp, onMinor, 'aria-label': aria, className = 'input amount-input num' }: { minor: number; exp: number; onMinor: (v: number) => void; 'aria-label': string; className?: string }) {
  const { fmt } = useI18n();
  const [text, setText] = useState(() => amountText(minor, exp, fmt.decimalSep));
  const last = useRef(minor);
  // follow outside changes (e.g. "make room" rewrote the plan) without fighting the person's typing
  useEffect(() => {
    if (minor !== last.current) {
      last.current = minor;
      setText(amountText(minor, exp, fmt.decimalSep));
    }
  }, [minor, exp, fmt.decimalSep]);
  return (
    <input
      className={className}
      inputMode="decimal"
      aria-label={aria}
      value={text}
      placeholder="0"
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        const n = parseAmountInput(v, exp) ?? 0;
        last.current = n;
        onMinor(n);
      }}
    />
  );
}

export function DateInput({ value, onChange, max, min, label }: { value: string; onChange: (v: string) => void; max?: string; min?: string; label: string }) {
  return <input className="input" type="date" aria-label={label} value={value} max={max} min={min} onChange={(e) => e.target.value && onChange(e.target.value)} />;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {action}
    </div>
  );
}

export function useAnnounce() {
  const [msg, setMsg] = useState('');
  const t = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(t.current), []);
  return {
    msg,
    say: (m: string) => {
      setMsg('');
      window.clearTimeout(t.current);
      t.current = window.setTimeout(() => setMsg(m), 50);
    },
  };
}

export function BackHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  const { t } = useI18n();
  return (
    <header className="page-header">
      <IconButton icon="chevron-left" label={t('common.back')} onClick={onBack} className="mirror-rtl" />
      <h1 className="page-title">{title}</h1>
      <div className="page-right">{right}</div>
    </header>
  );
}
