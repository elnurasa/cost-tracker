import { useEffect, useState, type ReactNode } from 'react';
import { BackHeader, Banner, Button, Chip, ChipRow, Segmented, TextInput, Toggle } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { CurrencyPicker } from './AddSheet';
import { LockSettings } from './Lock';
import { LOCALES, translate, useI18n, type Key } from '../i18n';
import { useM } from '../state/ctx';
import { useUI } from '../state/ui';
import { usePrefs, setPrefs, resetPrefs } from '../state/prefs';
import { canInstall, promptInstall } from '../state/helpers';
import { isCategoryKey } from '../domain/categories';
import { convertBaseCurrency, eraseAll, loadAll, renameIncome, updateEnvelope, updateWorkspace } from '../data/repo';
import { APP_VERSION, BackupError, buildBackup, getRestoreSnapshot, parseBackup, restoreData, summarize, undoRestore, type BackupData } from '../data/backup';
import { buildCsv } from '../data/csv';
import { diffDays, isValidRate, type Locale } from '../domain';

async function saveFile(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const file = new File([blob], name, { type });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function Row({ icon, title, value, onClick }: { icon: string; title: string; value?: string; onClick: () => void }) {
  return (
    <button type="button" className="list-item" onClick={onClick}>
      <span className="tile tile-buffer"><Icon name={icon} size={22} /></span>
      <span className="li-main"><span className="li-title">{title}</span></span>
      {value && <span className="muted">{value}</span>}
      <Icon name="chevron-right" size={20} mirror />
    </button>
  );
}

export function SettingsPage({ sub }: { sub?: string }) {
  const m = useM();
  const ui = useUI();
  const { t, locale } = useI18n();
  const prefs = usePrefs();
  const lastBackup = prefs.lastBackupAt ? diffDays(m.today, prefs.lastBackupAt.slice(0, 10)) : null;
  const heading: Record<string, string> = {
    language: t('settings.language'), currency: t('settings.currency'), appearance: t('settings.appearance'), periods: t('settings.periods'),
    lock: t('settings.lock'), data: t('settings.data'), stats: t('settings.stats'), about: t('settings.about'),
  };
  const back = () => ui.back(sub ? '/settings' : '/today');
  return (
    <main className="page page-settings" id="main">
      <BackHeader title={sub ? heading[sub] ?? t('settings.title') : t('settings.title')} onBack={back} />
      <div className="page-body">
        {prefs.demo && !sub && (
          <Banner action={<Button variant="text" onClick={async () => { await eraseAll(); resetPrefs(); location.hash = ''; location.reload(); }}>{t('settings.sampleErase')}</Button>}>{t('settings.sampleBanner')}</Banner>
        )}
        {!sub && (
          <>
            <h2 className="section-label">{t('settings.general')}</h2>
            <div className="group">
              <Row icon="languages" title={t('settings.language')} value={LOCALES.find((l) => l.id === locale)?.name} onClick={() => ui.go('/settings/language')} />
              <Row icon="banknote" title={t('settings.currency')} value={m.base} onClick={() => ui.go('/settings/currency')} />
              <Row icon="palette" title={t('settings.appearance')} value={t(`settings.theme.${prefs.theme}` as const)} onClick={() => ui.go('/settings/appearance')} />
              <Row icon="calendar-days" title={t('settings.periods')} onClick={() => ui.go('/settings/periods')} />
            </div>
            <h2 className="section-label">{t('settings.privacy')}</h2>
            <div className="group">
              <Row icon="lock" title={t('settings.lock')} value={prefs.lock.enabled ? t('common.on') : t('common.off')} onClick={() => ui.go('/settings/lock')} />
            </div>
            <h2 className="section-label">{t('settings.data')}</h2>
            <div className="group">
              <Row icon="database" title={t('settings.backup')} value={lastBackup === null ? undefined : t('settings.lastBackup', { when: lastBackup === 0 ? t('common.today') : t('common.days', { n: lastBackup }) })} onClick={() => ui.go('/settings/data')} />
              <Row icon="layers" title={t('settings.stats')} onClick={() => ui.go('/settings/stats')} />
            </div>
            <h2 className="section-label">{t('settings.about')}</h2>
            <div className="group">
              <Row icon="info" title={t('settings.about')} onClick={() => ui.go('/settings/about')} />
            </div>
          </>
        )}
        {sub === 'language' && <LanguagePanel />}
        {sub === 'currency' && <CurrencyPanel />}
        {sub === 'appearance' && <AppearancePanel />}
        {sub === 'periods' && <PeriodsPanel />}
        {sub === 'lock' && <LockSettings />}
        {sub === 'data' && <DataPanel />}
        {sub === 'stats' && <StatsPanel />}
        {sub === 'about' && <AboutPanel />}
      </div>
    </main>
  );
}

/**
 * E-20: names the app created (envelopes from the template, "Salary", "Advance") follow the new language; names the
 * person typed or changed stay exactly as they are.
 */
async function translateDefaultNames(m: ReturnType<typeof useM>, from: Locale, to: Locale) {
  const keys = ['home', 'bills', 'installments', 'food', 'groceries', 'transport', 'family', 'fun', 'pocket', 'savings', 'buffer'] as const;
  for (const e of m.data.ds.envelopes) {
    const k = keys.find((x) => translate(from, `env.${x}` as Key) === e.name);
    if (k) await updateEnvelope(e.id, { name: translate(to, `env.${k}` as Key) });
    // a ready-made payment category the app named (e.g. "Kreditlər") follows the language too
    else if (isCategoryKey(e.categoryKey) && translate(from, `cat.${e.categoryKey}` as Key) === e.name) await updateEnvelope(e.id, { name: translate(to, `cat.${e.categoryKey}` as Key) });
  }
  const inc = ['salary', 'advance', 'allowance', 'freelance', 'first', 'second', 'other', 'starting'] as const;
  for (const i of m.data.ds.incomes) {
    const k = inc.find((x) => translate(from, `income.${x}` as Key) === i.name);
    if (k) await renameIncome(i.id, translate(to, `income.${k}` as Key));
  }
}

function LanguagePanel() {
  const { locale, t } = useI18n();
  const m = useM();
  return (
    <div className="group" role="radiogroup" aria-label={t('a11y.languageList')}>
      {LOCALES.map((l) => (
        <button key={l.id} type="button" role="radio" aria-checked={locale === l.id} lang={l.tag} className="list-item" onClick={() => { if (l.id === locale) return; const from = locale; setPrefs({ locale: l.id as Locale }); void updateWorkspace({ locale: l.id as Locale }).then(() => translateDefaultNames(m, from, l.id as Locale)); }}>
          <span className="li-main"><span className="li-title">{l.name}</span></span>
          {locale === l.id && <Icon name="check" size={20} />}
        </button>
      ))}
    </div>
  );
}

function AppearancePanel() {
  const { t } = useI18n();
  const prefs = usePrefs();
  return (
    <div className="stack">
      <Segmented label={t('a11y.theme')} value={prefs.theme} onChange={(v) => setPrefs({ theme: v })} options={[{ id: 'system', label: t('settings.theme.system') }, { id: 'light', label: t('settings.theme.light') }, { id: 'dark', label: t('settings.theme.dark') }]} />
      <Toggle checked={prefs.reduceMotion} onChange={(v) => setPrefs({ reduceMotion: v })} label={t('settings.reduceMotion')} />
      <Toggle checked={prefs.showPocket} onChange={(v) => setPrefs({ showPocket: v })} label={t('settings.hidePocket')} />
      <Toggle checked={prefs.quickSave} onChange={(v) => setPrefs({ quickSave: v })} label={t('settings.quickSave')} help={t('settings.quickSaveHelp')} />
      <Toggle checked={prefs.nudges} onChange={(v) => setPrefs({ nudges: v })} label={t('settings.nudges')} help={t('settings.nudgesHelp')} />
      <Toggle checked={prefs.evening.enabled} onChange={(v) => setPrefs({ evening: { ...prefs.evening, enabled: v }, eveningLog: { ignored: 0, dismissedOn: '' } })} label={t('settings.evening')} help={t('settings.eveningHelp')} />
      {prefs.evening.enabled && (
        <label className="field">
          <span className="field-label">{t('settings.eveningTime')}</span>
          <input className="input" type="time" value={prefs.evening.time} onChange={(e) => e.target.value && setPrefs({ evening: { ...prefs.evening, time: e.target.value } })} aria-label={t('settings.eveningTime')} />
        </label>
      )}
    </div>
  );
}

function PeriodsPanel() {
  const m = useM();
  const { t } = useI18n();
  const cur = m.data.ws.cycleStartDay;
  return (
    <div className="stack">
      <div className="field-label">{t('settings.cycleDay')}</div>
      <ChipRow label={t('settings.cycleDay')} wrap>
        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <Chip key={d} selected={cur === d} onClick={() => void updateWorkspace({ cycleStartDay: d })}>{d}</Chip>)}
        <Chip selected={cur === 'L'} onClick={() => void updateWorkspace({ cycleStartDay: 'L' })}>{t('settings.cycleLast')}</Chip>
      </ChipRow>
      <p className="note">{t('settings.cycleHelp')}</p>
      <Toggle checked={m.data.ws.bridgeBuffer} onChange={(v) => void updateWorkspace({ bridgeBuffer: v })} label={t('settings.bridge')} help={t('why.bridgeToggleHelp')} />
    </div>
  );
}

function CurrencyPanel() {
  const m = useM();
  const ui = useUI();
  const { t } = useI18n();
  const [pick, setPick] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [rate, setRate] = useState('');
  const rates = Object.entries(m.data.ws.rates);
  if (pick) return <CurrencyPicker value={m.base} exclude={m.base} onClose={() => setPick(false)} onPick={(c) => { setTarget(c); setPick(false); }} />;
  const convert = async () => {
    if (!target || !isValidRate(rate)) return;
    const ok = await ui.confirm({ title: t('settings.baseTitle'), body: t('settings.baseBody'), confirmLabel: t('settings.baseAction'), cancelLabel: t('common.cancel'), destructive: true });
    if (!ok) return;
    const file = await buildBackup();
    await saveFile(`sakin-before-currency-change-${m.today}.json`, JSON.stringify(file), 'application/json');
    await convertBaseCurrency(target, rate);
    setTarget(null);
    setRate('');
    ui.toast({ message: t('settings.baseDone'), duration: 4000 });
  };
  return (
    <div className="stack">
      <div className="card"><span className="li-sub">{t('settings.currency')}</span><div className="li-title">{m.base}</div><p className="muted">{t('settings.baseHelp')}</p></div>
      {target ? (
        <div className="card stack">
          <p>{t('settings.baseBody')}</p>
          <label className="field-label" htmlFor="br">{t('settings.baseRate', { old: m.base, new: target })}</label>
          <TextInput id="br" value={rate} onChange={setRate} inputMode="decimal" />
          <Button disabled={!isValidRate(rate)} why={t('sys.rateInvalid')} onClick={convert}>{t('settings.baseAction')}</Button>
          <Button variant="text" onClick={() => setTarget(null)}>{t('common.cancel')}</Button>
        </div>
      ) : (
        <Button variant="secondary" block onClick={() => setPick(true)}>{t('settings.changeBase')}</Button>
      )}
      <h2 className="section-label">{t('settings.rates')}</h2>
      <p className="muted">{t('settings.ratesHelp')}</p>
      {rates.length === 0 && <p className="muted">{t('settings.noRates')}</p>}
      {rates.map(([cur, r]) => (
        <RateRow key={cur} cur={cur} rate={r.rate} line={t('settings.rateLine', { foreign: cur, rate: r.rate, base: m.base })} />
      ))}
    </div>
  );
}
function RateRow({ cur, rate, line }: { cur: string; rate: string; line: string }) {
  const m = useM();
  const [v, setV] = useState(rate);
  return (
    <div className="card inline">
      <span className="li-main"><span className="li-title">{line}</span></span>
      <input className="input amount-input num" aria-label={cur} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => isValidRate(v) && v !== rate && void updateWorkspace({ rates: { ...m.data.ws.rates, [cur]: { rate: v, updatedAt: new Date().toISOString() } } })} />
    </div>
  );
}

function DataPanel() {
  const m = useM();
  const ui = useUI();
  const { t, fmt, locale } = useI18n();
  const prefs = usePrefs();
  const [pass, setPass] = useState('');
  const [withPass, setWithPass] = useState(false);
  const [snap, setSnap] = useState<string | null>(null);
  const [needPass, setNeedPass] = useState<string | null>(null);
  const [restorePass, setRestorePass] = useState('');
  const semicolon = prefs.csvSemicolon ?? ['tr', 'az', 'ru'].includes(locale);
  useEffect(() => void getRestoreSnapshot().then((s) => setSnap(s?.createdAt ?? null)), []);

  const backup = async () => {
    try {
      const file = await buildBackup(pass || undefined);
      await saveFile(`sakin-backup-${m.today}.json`, JSON.stringify(file), 'application/json');
      setPrefs({ lastBackupAt: new Date().toISOString() });
      ui.toast({ message: t('sys.backedUp'), duration: 4000 });
    } catch {
      ui.toast({ message: t('sys.saveFail') });
    }
  };
  const csv = async () => {
    const d = await loadAll();
    if (!d) return;
    await saveFile(`sakin-${m.today}.csv`, buildCsv(d.allTx, { semicolon, baseCurrency: d.ws.baseCurrency, envelopes: d.ds.envelopes, rules: d.rules, plans: d.installments }), 'text/csv;charset=utf-8');
    ui.toast({ message: t('sys.exported'), duration: 3000 });
  };
  const doRestore = async (text: string, passphrase?: string) => {
    try {
      const { data } = await parseBackup(text, passphrase);
      const s = summarize(data as BackupData);
      const ok = await ui.confirm({
        title: t('settings.restoreConfirmTitle'),
        body: t('settings.restoreConfirmBody', { entries: t('common.entries', { n: s.entries }), from: s.from ? fmt.date(s.from) : '-', to: s.to ? fmt.date(s.to) : '-' }),
        confirmLabel: t('settings.restoreAction'), cancelLabel: t('common.cancel'), destructive: true,
      });
      if (!ok) return;
      await restoreData(data);
      setNeedPass(null);
      setSnap(new Date().toISOString());
      ui.toast({ message: t('settings.restoreDone'), duration: 5000, action: { label: t('settings.undoRestore'), run: () => void undoRestore() } });
    } catch (e) {
      const code = e instanceof BackupError ? e.code : 'structure';
      if (code === 'needs-passphrase') {
        setNeedPass(text);
        return;
      }
      ui.toast({ message: code === 'storage' ? t('sys.storageFull') : code === 'write' ? t('sys.saveFail') : code === 'newer' ? t('sys.newerBackup') : code === 'checksum' ? t('sys.badChecksum') : code === 'passphrase' ? t('sys.wrongPassphrase') : t('sys.invalidBackup', { brand: t('brand.name') }), duration: 6000 });
    }
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    await doRestore(await f.text());
  };
  const days = prefs.lastBackupAt ? diffDays(m.today, prefs.lastBackupAt.slice(0, 10)) : null;
  return (
    <div className="stack">
      <p className="note">{prefs.lastBackupAt ? t('settings.lastBackup', { when: days === 0 ? t('common.today') : fmt.date(prefs.lastBackupAt.slice(0, 10)) }) : t('settings.noBackup')}</p>
      {/* E-18: the action first; the optional password is one tap away, not in the way */}
      <div className="card stack">
        <p className="muted">{t('settings.backupHelp')}</p>
        <Button block icon="download" onClick={backup}>{t('settings.backup')}</Button>
        <button type="button" className="text-link" aria-expanded={withPass} onClick={() => setWithPass((v) => !v)}>{t('settings.protectWithPass')}</button>
        {withPass && (
          <>
            <label className="field-label" htmlFor="pp">{t('settings.passphrase')}</label>
            <TextInput id="pp" type="password" value={pass} onChange={setPass} />
            <p className="note">{t('settings.passphraseHelp')}</p>
          </>
        )}
      </div>
      <div className="card stack">
        <h2 className="card-title">{t('settings.exportCsv')}</h2>
        <Toggle checked={semicolon} onChange={(v) => setPrefs({ csvSemicolon: v })} label={t('settings.csvExcel')} />
        <Button block variant="secondary" icon="file-text" onClick={csv}>{t('settings.exportCsv')}</Button>
      </div>
      <div className="card stack">
        <h2 className="card-title">{t('settings.restore')}</h2>
        <label className="btn btn-secondary btn-block file-btn">
          <Icon name="upload" size={20} />
          {t('settings.restore')}
          <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {needPass && (
          <div className="stack">
            <p className="note">{t('sys.needPassphrase')}</p>
            <TextInput type="password" value={restorePass} onChange={setRestorePass} aria-label={t('settings.passphrase')} />
            <Button onClick={() => void doRestore(needPass, restorePass)}>{t('common.continue')}</Button>
          </div>
        )}
        {snap && <Button variant="text" block onClick={async () => { await undoRestore(); setSnap(null); ui.toast({ message: t('settings.undoRestoreDone') }); }}>{t('settings.undoRestore')}</Button>}
      </div>
      <p className="note">{prefs.persistResult === 'granted' ? t('settings.persist') : prefs.persistResult === 'denied' ? t('settings.persistNo') : ''}</p>
      <Button variant="danger" block onClick={async () => {
        const ok = await ui.confirm({ title: t('settings.eraseTitle'), body: t('settings.eraseBody'), confirmLabel: t('settings.eraseAction'), cancelLabel: t('common.cancel'), destructive: true });
        if (!ok) return;
        await eraseAll();
        resetPrefs();
        location.hash = '';
        location.reload();
      }}>{t('settings.eraseAll')}</Button>
    </div>
  );
}

function StatsPanel() {
  const m = useM();
  const { t } = useI18n();
  const prefs = usePrefs();
  const days = new Set(m.data.ds.transactions.filter((x) => x.source === 'manual').map((x) => x.date)).size;
  const inPeriod = m.data.ds.transactions.filter((x) => x.date >= m.period.startDate && x.date <= m.period.endDate && x.source === 'manual').length;
  const Stat = ({ label, value }: { label: string; value: ReactNode }) => <div className="list-item static"><span className="li-main"><span className="li-title">{label}</span></span><span className="num">{value}</span></div>;
  return (
    <div className="stack">
      <div className="group">
        <Stat label={t('settings.statsDays')} value={days} />
        <Stat label={t('settings.statsPeriod')} value={inPeriod} />
        <Stat label={t('settings.statsBackup')} value={prefs.lastBackupAt ? prefs.lastBackupAt.slice(0, 10) : '-'} />
      </div>
      <Toggle checked={prefs.telemetryOptIn === true} onChange={(v) => setPrefs({ telemetryOptIn: v })} label={t('settings.telemetry')} help={t('settings.telemetryHelp')} />
    </div>
  );
}

function AboutPanel() {
  const { t } = useI18n();
  const [can, setCan] = useState(canInstall());
  useEffect(() => { const id = setInterval(() => setCan(canInstall()), 1000); return () => clearInterval(id); }, []);
  return (
    <div className="stack">
      <div className="card"><h2 className="card-title">{t('brand.name')}</h2><p className="muted">{t('brand.tagline')}</p><p>{t('settings.privacyLine')}</p></div>
      {can && <Button block icon="download" onClick={() => void promptInstall()}>{t('settings.install')}</Button>}
      <p className="muted">{t('settings.installHelp')}</p>
      <p className="muted">{t('settings.version', { v: APP_VERSION })}</p>
    </div>
  );
}
