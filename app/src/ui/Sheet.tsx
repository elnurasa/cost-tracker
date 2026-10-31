import { useEffect, useRef, type ReactNode } from 'react';
import { IconButton } from './primitives';
import { useI18n } from '../i18n';
import { useUI } from '../state/ui';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

let openModals = 0; // body scroll lock is released only when the last modal closes (sheet -> dialog hand-offs)
function useModal(ref: React.RefObject<HTMLElement | null>, onClose: () => void, focusTitle: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    focusTitle.current?.focus();
    openModals += 1;
    document.body.classList.add('modal-open');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && ref.current) {
        const els = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null || x === document.activeElement);
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === focusTitle.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      openModals = Math.max(0, openModals - 1);
      if (openModals === 0) document.body.classList.remove('modal-open');
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function Sheet({ title, onClose, children, actions, size = 'tall', headerExtra, tag }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode; size?: 'tall' | 'medium'; headerExtra?: ReactNode; tag?: string }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const drag = useRef<{ y: number; t: number } | null>(null);
  useModal(ref, onClose, titleRef);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, t: Date.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    ref.current.style.transform = `translateY(${dy}px)`;
  };
  const onUp = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return;
    const dy = e.clientY - drag.current.y;
    const v = dy / Math.max(1, Date.now() - drag.current.t);
    drag.current = null;
    ref.current.style.transform = '';
    if (dy > ref.current.offsetHeight * 0.3 || (dy > 40 && v > 0.6)) onClose();
  };

  return (
    <div className="sheet-layer">
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className={`sheet sheet-${size}`} role="dialog" aria-modal="true" aria-labelledby="sheet-title" data-sheet={tag}>
        <div className="sheet-grab" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-hidden="true">
          <span />
        </div>
        <div className="sheet-head">
          <h2 id="sheet-title" className="sheet-title" tabIndex={-1} ref={titleRef}>
            {title}
          </h2>
          {headerExtra}
          <IconButton icon="x" label={t('common.close')} onClick={onClose} />
        </div>
        <div className="sheet-body">{children}</div>
        {actions && <div className="sheet-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog() {
  const { confirmState } = useUI();
  if (!confirmState) return null;
  return <ConfirmInner c={confirmState} />;
}
function ConfirmInner({ c }: { c: NonNullable<ReturnType<typeof useUI>['confirmState']> }) {
  const ref = useRef<HTMLDivElement>(null);
  const safeRef = useRef<HTMLButtonElement>(null);
  useModal(ref, () => c.resolve(false), safeRef);
  return (
    <div className="dialog-layer">
      <div className="scrim" onClick={() => c.resolve(false)} aria-hidden="true" />
      <div ref={ref} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-body">
        <h2 id="dlg-title" className="dialog-title">
          {c.title}
        </h2>
        <p id="dlg-body">{c.body}</p>
        <button ref={safeRef} type="button" className="btn btn-primary btn-block" onClick={() => c.resolve(false)}>
          {c.cancelLabel}
        </button>
        <button type="button" className={`btn btn-text btn-block${c.destructive ? ' btn-danger-text' : ''}`} onClick={() => c.resolve(true)}>
          {c.confirmLabel}
        </button>
      </div>
    </div>
  );
}

export function ToastHost() {
  const { toastState, dismissToast } = useUI();
  if (!toastState) return null;
  const t = toastState;
  return (
    <div className="toast-wrap">
      <div className="toast" role="status" key={t.id}>
        <span className="toast-msg">{t.message}</span>
        {t.action && (
          <button
            type="button"
            className="toast-action"
            onClick={() => {
              const run = t.action!.run;
              dismissToast();
              run();
            }}
          >
            {t.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
