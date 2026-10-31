import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type Route =
  | { name: 'today' }
  | { name: 'plan' }
  | { name: 'history' }
  | { name: 'settings'; sub?: string }
  | { name: 'envelope'; id: string }
  | { name: 'income' }
  | { name: 'payments'; filter?: string }
  | { name: 'payment'; ref: 'rule' | 'loan'; id: string }
  | { name: 'review' }
  | { name: 'past'; id: string };

export function parseHash(h: string): Route {
  const parts = h.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'plan': return { name: 'plan' };
    case 'history': return { name: 'history' };
    case 'settings': return { name: 'settings', sub: parts[1] };
    case 'envelope': return parts[1] ? { name: 'envelope', id: parts[1] } : { name: 'plan' };
    case 'income': return { name: 'income' };
    // the old "Coming up" page (#/coming, #/coming/installments) is now the Payments panel
    case 'coming': return { name: 'payments', filter: parts[1] === 'installments' ? 'loans' : parts[1] === 'repeating' ? 'repeating' : parts[1] === 'once' ? 'once' : undefined };
    case 'payments':
      if ((parts[1] === 'rule' || parts[1] === 'loan') && parts[2]) return { name: 'payment', ref: parts[1], id: parts[2] };
      return { name: 'payments', filter: parts[1] };
    case 'review': return { name: 'review' };
    case 'past': return parts[1] ? { name: 'past', id: parts[1] } : { name: 'plan' };
    default: return { name: 'today' };
  }
}
export const routeTab = (r: Route): 'today' | 'plan' | 'payments' | 'history' | 'settings' =>
  r.name === 'today' ? 'today' : r.name === 'history' ? 'history' : r.name === 'settings' ? 'settings' : r.name === 'payments' || r.name === 'payment' ? 'payments' : 'plan';

export type SheetState =
  | { kind: 'add'; envelopeId?: string; mode?: 'expense' | 'income' | 'move'; moveTo?: string }
  | { kind: 'edit'; txId: string }
  | { kind: 'why' }
  | { kind: 'move'; to?: string; from?: string }
  | { kind: 'receive'; eventId: string; different?: boolean }
  | { kind: 'cover' }
  | { kind: 'expect' }
  | { kind: 'envelope-new' }
  | { kind: 'envelope-edit'; id: string }
  | { kind: 'pay-new'; type?: 'once' | 'repeating' | 'loan' }
  | { kind: 'pay-edit'; ref: 'rule' | 'loan'; id: string }
  | { kind: 'pay-confirm'; ref: 'rule' | 'loan'; id: string; dueDate?: string; n?: number | null; extra?: boolean }
  | { kind: 'income-edit'; id?: string }
  | { kind: 'fit' }
  | { kind: 'lock-setup' }
  | { kind: 'filters'; which: 'envelope' | 'period' | 'more' };

export interface ToastSpec {
  message: string;
  action?: { label: string; run: () => void };
  duration?: number;
  onExpire?: () => void;
}
export interface ConfirmSpec {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}

interface UI {
  route: Route;
  go: (path: string) => void;
  back: (fallback?: string) => void;
  sheet: SheetState | null;
  openSheet: (s: SheetState) => void;
  closeSheet: () => void;
  toast: (t: ToastSpec) => void;
  toastState: (ToastSpec & { id: number }) | null;
  dismissToast: () => void;
  confirm: (c: ConfirmSpec) => Promise<boolean>;
  confirmState: (ConfirmSpec & { resolve: (v: boolean) => void }) | null;
  wide: boolean;
}
const Ctx = createContext<UI | null>(null);

export function UIProvider({ children, wideQuery = '(min-width: 840px)' }: { children: ReactNode; wideQuery?: string }) {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [toastState, setToast] = useState<(ToastSpec & { id: number }) | null>(null);
  const [confirmState, setConfirm] = useState<UI['confirmState']>(null);
  const [wide, setWide] = useState(() => window.matchMedia(wideQuery).matches);
  const timer = useRef<number | undefined>(undefined);
  const idRef = useRef(0);
  const depth = useRef(0);
  const routeRef = useRef(route);
  routeRef.current = route;
  const toastRef = useRef(toastState);
  toastRef.current = toastState;

  useEffect(() => {
    const on = () => {
      // '' -> '#/today' (what onboarding does a moment after the data appears) is the same screen: keep an already opened sheet
      const next = parseHash(location.hash);
      if (JSON.stringify(next) === JSON.stringify(routeRef.current)) return;
      routeRef.current = next;
      setRoute(next);
      setSheet(null);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    const mq = window.matchMedia(wideQuery);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [wideQuery]);

  const go = useCallback((path: string) => {
    const target = `#${path.startsWith('/') ? path : `/${path}`}`;
    if (location.hash === target) setRoute(parseHash(target));
    else {
      depth.current += 1;
      location.hash = target;
    }
  }, []);
  const back = useCallback((fallback = '/today') => {
    if (depth.current > 0) {
      depth.current -= 1;
      history.back();
    } else go(fallback);
  }, [go]);
  const dismissToast = useCallback(() => {
    window.clearTimeout(timer.current);
    const cur = toastRef.current;
    setToast(null);
    cur?.onExpire?.();
  }, []);
  const toast = useCallback((t: ToastSpec) => {
    window.clearTimeout(timer.current);
    toastRef.current?.onExpire?.();
    const id = ++idRef.current;
    setToast({ ...t, id });
    timer.current = window.setTimeout(() => {
      setToast((c) => (c && c.id === id ? null : c));
      t.onExpire?.();
    }, t.duration ?? 6000);
  }, []);
  const confirm = useCallback(
    (c: ConfirmSpec) => new Promise<boolean>((resolve) => setConfirm({ ...c, resolve: (v) => { setConfirm(null); resolve(v); } })),
    [],
  );
  const value = useMemo<UI>(
    () => ({
      route, go, back, sheet, openSheet: setSheet, closeSheet: () => setSheet(null), toast, toastState, dismissToast, confirm, confirmState, wide,
    }),
    [route, go, back, sheet, toast, toastState, dismissToast, confirm, confirmState, wide],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useUI(): UI {
  const c = useContext(Ctx);
  if (!c) throw new Error('UIProvider missing');
  return c;
}
