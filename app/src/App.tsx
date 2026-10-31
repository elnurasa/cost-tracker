import { Component, Suspense, lazy, useEffect, useMemo, useRef, type ComponentType, type ReactNode } from 'react';
import type { Locale } from './domain';
import { I18nProvider, translate, useI18n } from './i18n';
import { UIProvider, routeTab, useUI } from './state/ui';
import { useModel } from './state/model';
import { ModelProvider, useM } from './state/ctx';
import { usePrefs, setPrefs, getPrefs } from './state/prefs';
import { runMaintenance, eraseAll } from './data/repo';
import { useLocked, useShield } from './data/lock';
import { Icon } from './ui/Icon';
import { Button, IconButton } from './ui/primitives';
import { ConfirmDialog, ToastHost } from './ui/Sheet';
import { Onboarding, detectLocale } from './screens/Onboarding';
import { EnvelopeList, HeroPanel, TodayFeed, TodayPage, WhySheet } from './screens/Today';
import { EnvelopeDetail, EnvelopeSheet, FitSheet, PlanPage } from './screens/Plan';
import { AddSheet, MoveSheet } from './screens/AddSheet';
import { CoverSheet, ExpectSheet, ReceiveSheet } from './screens/IncomeSheets';
import { LockScreen, LockSetupSheet, PrivacyShield } from './screens/Lock';
import { resetPrefs } from './state/prefs';
import { StorageWatch } from './state/StorageWatch';

/**
 * Code splitting: the rarely used screens load on demand. They are all in the service-worker precache, so they also
 * open offline; the first visit after install fetches nothing extra from the network.
 */
const named = <M extends Record<string, unknown>, K extends keyof M>(load: () => Promise<M>, key: K) =>
  lazy(() => load().then((m) => ({ default: m[key] as ComponentType<any> }))) as unknown as M[K]; // eslint-disable-line @typescript-eslint/no-explicit-any
const HistoryPage = named(() => import('./screens/History'), 'HistoryPage');
const SettingsPage = named(() => import('./screens/Settings'), 'SettingsPage');
const IncomePage = named(() => import('./screens/Income'), 'IncomePage');
const IncomeEditSheet = named(() => import('./screens/Income'), 'IncomeEditSheet');
const PaymentsPage = named(() => import('./screens/Payments'), 'PaymentsPage');
const PaymentsPane = named(() => import('./screens/Payments'), 'PaymentsPane');
const PaymentsPick = named(() => import('./screens/Payments'), 'PaymentsPick');
const PaymentDetailPage = named(() => import('./screens/Payments'), 'PaymentDetailPage');
const PaySheet = named(() => import('./screens/Payments'), 'PaySheet');
const PaymentFormSheet = named(() => import('./screens/Payments'), 'PaymentFormSheet');
const ReviewPage = named(() => import('./screens/Review'), 'ReviewPage');
const PastPeriodPage = named(() => import('./screens/Review'), 'PastPeriodPage');

class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  render() {
    if (!this.state.err) return this.props.children;
    const loc = getPrefs().locale ?? detectLocale();
    return (
      <div className="fatal" role="alert">
        <svg width="96" height="24" viewBox="0 0 96 24" aria-hidden="true"><path d="M2 14 C 14 4, 26 4, 38 12 S 62 20, 72 12 S 88 6, 94 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        <h1>{translate(loc, 'sys.errorTitle')}</h1>
        <p>{translate(loc, 'sys.error')}</p>
        <button type="button" className="btn btn-primary" onClick={() => location.reload()}>{translate(loc, 'sys.reload')}</button>
        {import.meta.env.DEV && <p className="caption">{this.state.err.message.slice(0, 80)}</p>}
      </div>
    );
  }
}

export default function App() {
  return (
    <Boundary>
      <UIProvider>
        <Root />
      </UIProvider>
    </Boundary>
  );
}

function useDocumentAttrs(locale: string) {
  const prefs = usePrefs();
  useEffect(() => {
    const el = document.documentElement;
    el.lang = locale === 'az' ? 'az' : locale;
    el.dir = 'ltr';
    // identity follows the locale rule: "Pul Planım" in Azerbaijani, "Sakin" elsewhere (tab title, home-screen title on iOS, search snippet)
    const brand = translate(locale as Locale, 'brand.name');
    document.title = brand;
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', brand);
    document.querySelector('meta[name="description"]')?.setAttribute('content', `${brand}. ${translate(locale as Locale, 'brand.tagline')}`);
    if (prefs.theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', prefs.theme);
    if (prefs.reduceMotion) el.setAttribute('data-motion', 'reduce');
    else el.removeAttribute('data-motion');
    // keep the browser/status-bar colour in step with a manually chosen theme
    const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m, i) => {
      if (prefs.theme === 'system') {
        m.setAttribute('content', i === 0 ? '#0F6B63' : '#12302C');
        m.setAttribute('media', i === 0 ? '(prefers-color-scheme: light)' : '(prefers-color-scheme: dark)');
      } else {
        m.removeAttribute('media');
        m.setAttribute('content', dark ? '#12302C' : '#0F6B63');
      }
    });
  }, [locale, prefs.theme, prefs.reduceMotion]);
}

function Root() {
  const state = useModel();
  const prefs = usePrefs();
  const locked = useLocked();
  const shield = useShield();
  const locale = prefs.locale ?? (!state.loading && !state.empty ? state.m.data.ws.locale : detectLocale());
  useDocumentAttrs(locale);
  useEffect(() => {
    setPrefs({ openCount: prefs.openCount + 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const today = state.loading || state.empty ? null : state.m.today;
  const running = useRef(false);
  useEffect(() => {
    const run = async () => {
      if (running.current) return;
      running.current = true;
      try {
        await runMaintenance();
      } finally {
        running.current = false;
      }
    };
    void run();
    const onVis = () => !document.hidden && void run();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [today]);

  if (state.loading) return <div className="splash" aria-busy="true" role="status"><div className="sk-hero"><div className="sk sk-line" /><div className="sk sk-num" /><div className="sk sk-line w70" /></div><div className="sk sk-card" /><div className="sk sk-card" /><span className="sr-only">{translate(detectLocale(), 'common.loading')}</span></div>;
  if (state.empty) return <Onboarding />;
  return (
    <I18nProvider locale={locale}>
      <ModelProvider m={state.m}>
        {prefs.lock.enabled && locked ? <LockScreen /> : <Shell />}
        {shield && prefs.lock.enabled && <PrivacyShield />}
        <ConfirmDialog />
        <ToastHost />
        <StorageWatch />
      </ModelProvider>
    </I18nProvider>
  );
}

function TabBar() {
  const { t } = useI18n();
  const ui = useUI();
  const prefs = usePrefs();
  const m = useM();
  const cur = routeTab(ui.route);
  const manual = m.data.ds.transactions.some((x) => x.source === 'manual' && x.type === 'expense');
  const item = (id: 'today' | 'plan' | 'payments' | 'history', icon: string, label: string) => (
    <a key={id} href={`#/${id}`} className={`tab${cur === id ? ' is-current' : ''}`} aria-current={cur === id ? 'page' : undefined}>
      <Icon name={icon} size={24} />
      <span>{label}</span>
    </a>
  );
  return (
    <nav className="tabbar" aria-label={t('nav.main')}>
      {item('today', 'wallet', t('nav.today'))}
      {item('plan', 'layers', t('nav.plan'))}
      <button type="button" className={`fab${!prefs.coachDone && !manual ? ' fab-coach' : ''}`} aria-label={t('nav.add')} onClick={() => ui.openSheet({ kind: 'add', envelopeId: addTarget(ui.route, m) })}>
        <Icon name="plus" size={28} />
      </button>
      {item('payments', 'receipt', t('nav.payments'))}
      {item('history', 'history', t('nav.history'))}
    </nav>
  );
}

/** E-21: '+' on an envelope page records into that envelope (not the last-used one). */
const addTarget = (r: ReturnType<typeof useUI>['route'], m: ReturnType<typeof useM>): string | undefined => {
  if (r.name !== 'envelope') return undefined;
  const e = m.env(r.id);
  return e && e.kind !== 'buffer' && !e.archived ? e.id : undefined;
};

function Rail() {
  const { t } = useI18n();
  const ui = useUI();
  const m = useM();
  const cur = routeTab(ui.route);
  const link = (id: 'today' | 'plan' | 'payments' | 'history' | 'settings', icon: string, label: string) => (
    <a key={id} href={`#/${id}`} className={`tab${cur === id ? ' is-current' : ''}`} aria-current={cur === id ? 'page' : undefined}>
      <Icon name={icon} size={24} />
      <span>{label}</span>
    </a>
  );
  return (
    <nav className="rail" aria-label={t('nav.main')}>
      <button type="button" className="rail-add" onClick={() => ui.openSheet({ kind: 'add', envelopeId: addTarget(ui.route, m) })} aria-label={t('nav.add')}>
        <Icon name="plus" size={24} />
        <span>{t('nav.addShort')}</span>
      </button>
      {link('today', 'wallet', t('nav.today'))}
      {link('plan', 'layers', t('nav.plan'))}
      {link('payments', 'receipt', t('nav.payments'))}
      {link('history', 'history', t('nav.history'))}
      {link('settings', 'settings', t('nav.settings'))}
    </nav>
  );
}

function OfflineBadge() {
  const { t } = useI18n();
  const [show, setShow] = useStateLazy();
  useEffect(() => {
    let id: number | undefined;
    const on = () => {
      setShow(true);
      window.clearTimeout(id);
      id = window.setTimeout(() => setShow(false), 4000);
    };
    window.addEventListener('offline', on);
    window.addEventListener('online', on);
    return () => {
      window.removeEventListener('offline', on);
      window.removeEventListener('online', on);
      window.clearTimeout(id);
    };
  }, [setShow]);
  if (!show) return null;
  return (
    <div className="offline-badge" role="status">
      <Icon name="cloud-off" size={20} />
      <span>{navigator.onLine ? t('common.on') : t('common.offline')}</span>
      {!navigator.onLine && <span className="sr-only">{t('common.offlineNote')}</span>}
    </div>
  );
}
import { useState } from 'react';
const useStateLazy = () => useState(false);

function Shell() {
  const m = useM();
  const ui = useUI();
  const { t } = useI18n();
  const prefs = usePrefs();
  const { route, wide, sheet, closeSheet } = ui;
  const tabbarRoutes = ['today', 'plan', 'payments', 'payment', 'history', 'envelope'];
  const showTabbar = !wide && tabbarRoutes.includes(route.name);
  const paymentsRoute = route.name === 'payments' || route.name === 'payment';
  const showLeft = wide && route.name !== 'settings' && !paymentsRoute;
  // E-04: every screen opens at the top (the browser kept the previous screen's offset, e.g. onboarding -> Today hid the hero)
  const routeKey = JSON.stringify(route);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll('.pane-right, .pane-left-list').forEach((el) => (el.scrollTop = 0));
  }, [routeKey]);

  const content = useMemo(() => {
    switch (route.name) {
      case 'today': return wide ? <TodayFeed /> : <TodayPage />;
      case 'plan': return <PlanPage />;
      case 'history': return <HistoryPage />;
      case 'settings': return <SettingsPage sub={route.sub} />;
      case 'envelope': return <EnvelopeDetail id={route.id} />;
      case 'income': return <IncomePage />;
      case 'payments': return wide ? <PaymentsPick /> : <PaymentsPage filter={route.filter} />;
      case 'payment': return <PaymentDetailPage refKind={route.ref} id={route.id} />;
      case 'review': return <ReviewPage />;
      case 'past': return <PastPeriodPage id={route.id} />;
    }
  }, [route, wide]);

  let sheetEl: ReactNode = null;
  if (sheet) {
    switch (sheet.kind) {
      case 'add': sheetEl = <AddSheet envelopeId={sheet.envelopeId} mode={sheet.mode} moveTo={sheet.moveTo} onClose={closeSheet} />; break;
      case 'edit': {
        const tx = m.data.allTx.find((x) => x.id === sheet.txId);
        sheetEl = tx ? <AddSheet editTx={tx} onClose={closeSheet} /> : null;
        break;
      }
      case 'why': sheetEl = <WhySheet onClose={closeSheet} />; break;
      case 'move': sheetEl = <MoveSheet to={sheet.to} from={sheet.from} onClose={closeSheet} />; break;
      case 'receive': sheetEl = <ReceiveSheet eventId={sheet.eventId} onClose={closeSheet} />; break;
      case 'cover': sheetEl = <CoverSheet onClose={closeSheet} />; break;
      case 'expect': sheetEl = <ExpectSheet onClose={closeSheet} />; break;
      case 'envelope-new': sheetEl = <EnvelopeSheet onClose={closeSheet} />; break;
      case 'envelope-edit': sheetEl = <EnvelopeSheet id={sheet.id} onClose={closeSheet} />; break;
      case 'pay-new': sheetEl = <PaymentFormSheet type={sheet.type} onClose={closeSheet} />; break;
      case 'pay-edit': sheetEl = <PaymentFormSheet editRef={sheet.ref} editId={sheet.id} onClose={closeSheet} />; break;
      case 'pay-confirm': sheetEl = <PaySheet refKind={sheet.ref} id={sheet.id} dueDate={sheet.dueDate} n={sheet.n} extra={sheet.extra} onClose={closeSheet} />; break;
      case 'income-edit': sheetEl = <IncomeEditSheet id={sheet.id} onClose={closeSheet} />; break;
      case 'fit': sheetEl = <FitSheet onClose={closeSheet} />; break;
      case 'lock-setup': sheetEl = <LockSetupSheet onClose={closeSheet} />; break;
      default: sheetEl = null;
    }
  }

  return (
    <div className={`app${wide ? ' is-wide' : ''}`}>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>{t('sys.skipLink')}</a>
      <OfflineBadge />
      {wide && <Rail />}
      <div className="panes">
        {prefs.demo && (
          <div className="demo-strip" role="status">
            <Icon name="info" size={18} />
            <span>{t('settings.sampleBanner')}</span>
            <Button variant="text" onClick={async () => { await eraseAll(); resetPrefs(); location.hash = ''; location.reload(); }}>{t('settings.sampleErase')}</Button>
          </div>
        )}
        {wide && paymentsRoute && <Suspense fallback={null}><PaymentsPane selected={route.name === 'payment' ? route.id : undefined} /></Suspense>}
        {showLeft && (
          <aside className="pane-left" aria-label={t('today.envelopes')}>
            <HeroPanel compact />
            <div className="pane-left-list"><EnvelopeList all /></div>
          </aside>
        )}
        <div className="pane-right" tabIndex={-1}><Suspense fallback={<div className="splash" aria-busy="true" />}>{content}</Suspense></div>
      </div>
      {showTabbar && <TabBar />}
      <Suspense fallback={null}>{sheetEl}</Suspense>
      <IconButtonSpacer />
    </div>
  );
}
const IconButtonSpacer = () => null;
export { IconButton };
