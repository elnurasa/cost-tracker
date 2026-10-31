import { useEffect, useMemo, useState } from 'react';
import { AmountField, Button, Chip, ChipRow, TextInput } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { AmountDisplay, NumberPad, minorToRaw, rawToMinor } from '../ui/NumberPad';
import { LOCALES, useI18n, I18nProvider, translate, type Key } from '../i18n';
import { getPrefs, setPrefs } from '../state/prefs';
import { completeOnboarding, runMaintenance } from '../data/repo';
import { seedDemo } from '../data/seed';
import { CATEGORY_KEYS } from '../domain/categories';
import {
  addDays, currencyExponent, currencyForRegion, firstPeriod, monthlyFigure, regionFor, scaleAmounts, suggestMoneyNow, sum, templateAmounts, templateFor, todayLocal,
  type Frequency, type Locale, type OnboardInput, type Region,
} from '../domain';
import { useUI } from '../state/ui';
import { IncomeRowsEditor, newRowId, retranslateRows, presetOf, presetRows, toOnboardIncomes, type IncomeDraft, type Preset } from './IncomeRows';

export function detectLocale(): Locale {
  const list = (navigator.languages?.length ? navigator.languages : [navigator.language || 'en']).map((x) => x.toLowerCase());
  for (const l of list) {
    if (l.startsWith('az')) return 'az';
    if (l.startsWith('tr')) return 'tr';
    if (l.startsWith('ru')) return 'ru';
    if (l.startsWith('en')) return 'en';
  }
  return 'en';
}
/** Region + default currency from browser language, time zone and country; the user can change the currency. */
export function detectRegion(): { region: Region; currency: string } {
  let country: string | null = null;
  try {
    country = new Intl.Locale(navigator.language).maximize().region ?? null;
  } catch {
    /* ignore */
  }
  let tz: string | null = null;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* ignore */
  }
  const lang = detectLocale();
  const region = regionFor(country, tz);
  // Time zone and UI language outrank a generic en-US browser default.
  if (region === 'AZ') return { region, currency: 'AZN' };
  if (region === 'TR') return { region, currency: 'TRY' };
  if (lang === 'az') return { region: 'AZ', currency: 'AZN' };
  if (lang === 'tr') return { region: 'TR', currency: 'TRY' };
  if (lang === 'ru' && region === 'GLOBAL') return { region: 'CIS', currency: 'RUB' };
  return { region, currency: currencyForRegion(country, region) };
}

export function namesFor(locale: Locale): { envelope: Record<string, string>; income: Record<string, string>; starting: string; workspace: string } {
  const g = (k: Key) => translate(locale, k);
  return {
    envelope: {
      home: g('env.home'), bills: g('env.bills'), installments: g('env.installments'), food: g('env.food'), groceries: g('env.groceries'),
      transport: g('env.transport'), family: g('env.family'), fun: g('env.fun'), pocket: g('env.pocket'), savings: g('env.savings'), buffer: g('env.buffer'),
    },
    income: { salary: g('income.salary'), advance: g('income.advance'), allowance: g('income.allowance'), freelance: g('income.freelance'), first: g('income.first'), second: g('income.second') },
    starting: g('income.starting'),
    workspace: g('workspace.name'),
  };
}

type Step = 0 | 1 | 2 | 3;

export function Onboarding() {
  const prefs = getPrefs();
  const [locale, setLocale] = useState<Locale>(prefs.locale ?? detectLocale());
  return (
    <I18nProvider locale={locale}>
      <OnboardingInner locale={locale} setLocale={(l) => { setLocale(l); setPrefs({ locale: l }); }} />
    </I18nProvider>
  );
}

function OnboardingInner({ locale, setLocale }: { locale: Locale; setLocale: (l: Locale) => void }) {
  const { t, fmt } = useI18n();
  const ui = useUI();
  const det = useMemo(detectRegion, []);
  const [region] = useState<Region>(det.region);
  const [currency, setCurrency] = useState(det.currency);
  const [step, setStep] = useState<Step>(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]); // E-04: each step (and Today after it) starts at the top
  const today = todayLocal();
  const exp = currencyExponent(currency);

  // the income list (equal-rank rows; presets only pre-fill it)
  const [incomes, setIncomes] = useState<IncomeDraft[]>(() => presetRows('monthly', t, today));
  const [activeId, setActiveId] = useState<string>(() => incomes[0].id);
  useEffect(() => setIncomes((rs) => retranslateRows(rs, t)), [locale]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = incomes.find((r) => r.id === activeId) ?? incomes[0];
  const freq: Frequency = presetOf(incomes);
  const setActiveRaw = (v: string) => setIncomes((rs) => rs.map((r) => (r.id === active.id ? { ...r, raw: v } : r)));
  const applyPreset = (p: Preset) => {
    // keep amounts already typed, in order, so switching a preset never throws work away
    const next = presetRows(p, t, today).map((r, i) => ({ ...r, raw: incomes[i]?.raw ?? '' }));
    setIncomes(next);
    setActiveId(next[0].id);
  };
  // the pad edits the active row: bring it into view when another row is picked
  const activate = (id: string, reveal = true) => {
    setActiveId(id);
    if (reveal) requestAnimationFrame(() => document.querySelector('.ob-income .pad')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };
  const addRow = () => {
    const r: IncomeDraft = { id: newRowId(), name: t('income.other'), kind: 'other', raw: '', schedule: { type: 'monthly', day: 20 } };
    setIncomes((rs) => [...rs, r]);
    activate(r.id);
  };
  const [moneyRaw, setMoneyRaw] = useState('');
  const [pickCur, setPickCur] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [moreRows, setMoreRows] = useState(false);

  const list = toOnboardIncomes(incomes, exp);
  const input: OnboardInput = { today, freq, amount: list[0]?.amount ?? 0, day: 5, amount2: 0, day2: 20, nextPayDate: null, exp, incomes: list };
  const monthly = monthlyFigure(input);
  const mn = suggestMoneyNow(input);
  const tpl = templateFor(region);
  const baseAmounts = useMemo(() => templateAmounts(tpl, monthly, exp), [tpl, monthly, exp]);
  const plan = { ...baseAmounts, ...amounts };
  const planSum = sum(tpl.map((i) => plan[i.key] ?? 0));
  const rest = Math.max(0, monthly - planSum);
  // every row needs an amount (a row left at 0 is a forgotten one); remove it with its x
  const canStep1 = list.length > 0 && list.every((r) => r.amount > 0);

  const nameOf = (key: string) => t(`env.${key}` as Key);
  // E-05: when the first period is a partial one, Today shows these rows scaled to the money you have now (spec 5.1 O3)
  const moneyNow = rawToMinor(moneyRaw, exp);
  const scaledFirst = !(mn.justPaid && moneyNow === mn.prefill) && monthly > 0 && moneyNow > 0 && moneyNow < monthly;
  const fp = firstPeriod(input, !scaledFirst);
  const planKey = tpl.map((i) => plan[i.key] ?? 0).join(',');
  const scaled = useMemo(() => (scaledFirst ? scaleAmounts(Object.fromEntries(tpl.map((i) => [i.key, plan[i.key] ?? 0])), moneyNow, monthly) : {}), [scaledFirst, tpl, planKey, moneyNow, monthly]); // eslint-disable-line react-hooks/exhaustive-deps
  // E-07: the question follows the frequency ("salary" only for monthly pay)
  const salaried = freq === 'monthly' || freq === 'twice';
  const incomeTitle = freq === 'varies' ? t('onboard.aboutMonth') : salaried ? t('onboard.incomeTitle') : t('onboard.incomeTitleEach');
  const moneyTitle = freq === 'varies' ? t('onboard.moneyTitleVaries') : salaried ? t('onboard.moneyTitle') : t('onboard.moneyTitleNext');
  // E-14 / DR-9: at most 7 rows at first; the rows that do not fit everyone open on request
  const OPTIONAL = ['installments', 'family'];
  const hidden = tpl.filter((i) => OPTIONAL.includes(i.key));
  const rows = moreRows || tpl.length <= 7 ? tpl : tpl.filter((i) => !OPTIONAL.includes(i.key));
  const parts = fmt.parts(0, currency);

  const finish = async (useEmpty: boolean) => {
    setBusy(true);
    try {
      const moneyNow = rawToMinor(moneyRaw, exp);
      await completeOnboarding({ input, locale, region, currency, moneyNow, names: namesFor(locale), amounts: useEmpty ? undefined : amounts, empty: useEmpty });
      setPrefs({ locale, coachDone: false, firstOpenAt: new Date().toISOString() });
      await runMaintenance(todayLocal());
      navigator.storage?.persist?.().then((ok) => setPrefs({ persistResult: ok ? 'granted' : 'denied' })).catch(() => undefined);
      ui.go('/today');
    } finally {
      setBusy(false);
    }
  };
  const sample = async () => {
    setBusy(true);
    try {
      const n = (k: Key) => translate(locale, k);
      await seedDemo({
        names: namesFor(locale), locale, region, currency,
        notes: { coffee: n('demo.coffee'), market: n('demo.market'), bus: n('demo.bus'), lunch: n('demo.lunch'), rent: n('demo.rent'), phone: n('demo.phone'), pharmacy: n('demo.pharmacy'), gift: n('demo.gift'), cinema: n('demo.cinema'), taxi: n('demo.taxi'),
          carLoan: n('demo.carLoan'), bank: n('demo.bank'), phoneStore: n('demo.phoneStore'), landlord: n('demo.landlord'), electricity: n('demo.electricity'),
          power: n('demo.power'), gas: n('demo.gas'), gasCo: n('demo.gasCo'), water: n('demo.water'), waterCo: n('demo.waterCo'), internet: n('demo.internet'),
          isp: n('demo.isp'), insurance: n('demo.insurance'), insurer: n('demo.insurer'), music: n('demo.music'), musicCo: n('demo.musicCo'),
          video: n('demo.video'), videoCo: n('demo.videoCo') },
        catNames: Object.fromEntries(CATEGORY_KEYS.map((k) => [k, n(`cat.${k}` as Key)])),
      });
      setPrefs({ locale, demo: true, coachDone: true, firstExpenseShown: true });
      ui.go('/today');
    } finally {
      setBusy(false);
    }
  };

  if (pickCur) return <CurrencyPickerStandalone value={currency} onPick={(c) => { setCurrency(c); setPickCur(false); setIncomes((rs) => rs.map((r) => ({ ...r, raw: '' }))); }} onClose={() => setPickCur(false)} />;

  const header = (n: number) => (
    <div className="ob-head">
      {step > 0 ? (
        <button type="button" className="icon-btn" aria-label={t('common.back')} onClick={() => setStep((s) => (s - 1) as Step)}><Icon name="chevron-left" mirror /></button>
      ) : <span />}
      {n > 0 && <span className="muted">{t('onboard.step', { n, total: 4 })}</span>}
    </div>
  );

  return (
    <main className="onboarding" id="main">
      {step === 0 && (
        <div className="ob-col ob-welcome">
          <div className="ob-brand">
            <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true"><rect width="72" height="72" rx="20" fill="var(--color-brand)" /><path d="M12 42 C 22 28, 32 28, 40 38 S 56 50, 62 36" fill="none" stroke="var(--color-text-on-brand)" strokeWidth="3.5" strokeLinecap="round" /><circle cx="46" cy="24" r="4.5" fill="var(--color-text-on-brand)" /></svg>
            <h1 className="ob-title">{t('brand.name')}</h1>
            <p className="ob-tag">{t('onboard.welcomeTitle')}</p>
            <p className="muted">{t('onboard.welcomeBody')}</p>
          </div>
          <ChipRow label={t("onboard.language")} wrap>
            {LOCALES.map((l) => <Chip key={l.id} selected={locale === l.id} onClick={() => setLocale(l.id)}><span lang={l.tag}>{l.name}</span></Chip>)}
          </ChipRow>
          <div className="stack">
            <Button block onClick={() => setStep(1)}>{t('onboard.start')}</Button>
            <Button block variant="secondary" disabled={busy} onClick={sample}>{t('onboard.sample')}</Button>
            <p className="muted center">{t('onboard.privacy')}</p>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="ob-col ob-income">
          {header(1)}
          <h1 className="ob-q">{incomeTitle}</h1>
          <ChipRow label={t('onboard.howOften')}>
            {(['monthly', 'twice', 'biweekly', 'weekly', 'varies'] as const).map((f) => <Chip key={f} selected={freq === f} onClick={() => applyPreset(f)}>{t(`onboard.freq.${f}` as Key)}</Chip>)}
          </ChipRow>
          <IncomeRowsEditor rows={incomes} active={active.id} onActive={activate} onChange={setIncomes} currency={currency} />
          <div className="inc-foot">
            <Button variant="text" icon="plus" onClick={addRow}>{t('inc.addAnother')}</Button>
            <button type="button" className="chip" aria-label={t('onboard.currency')} onClick={() => setPickCur(true)}><span className="chip-label">{currency}</span></button>
          </div>
          {list.length > 1 && <p className="note inc-total">{t('inc.totalMonth', { amount: fmt.money(monthly, currency) })}</p>}
          <p className="pad-for" aria-hidden="true">{t('inc.typingFor', { name: active.name || t('income.other') })}</p>
          <NumberPad raw={active.raw} onChange={setActiveRaw} exp={exp} />
          {!canStep1 && <p className="hint" role="status">{t('onboard.amountHint')}</p>}
          <div className="ob-actions">
            <Button block disabled={!canStep1} why={t('onboard.amountHint')} onClick={() => { setMoneyRaw(minorToRaw(mn.prefill, exp)); setStep(2); }}>{t('common.continue')}</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="ob-col">
          {header(2)}
          <h1 className="ob-q">{moneyTitle}</h1>
          <AmountDisplay raw={moneyRaw} symbol={parts.symbol || currency} symbolFirst={parts.symbolFirst} currency={currency} />
          <p className="muted center">{t('onboard.moneyHint')}</p>
          <NumberPad raw={moneyRaw} onChange={setMoneyRaw} exp={exp} />
          <div className="ob-actions">
            <Button block disabled={rawToMinor(moneyRaw, exp) <= 0} why={t('onboard.amountHint')} onClick={() => setStep(3)}>{t('common.continue')}</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="ob-col">
          {header(3)}
          <h1 className="ob-q">{t('onboard.planTitle')}</h1>
          <p className="muted">{scaledFirst ? t('onboard.planScaled', { date: fmt.date(addDays(fp.endDate, 1)), amount: fmt.money(moneyNow, currency) }) : t('onboard.planHint')}</p>
          <div className="group">
            {rows.map((it) => (
              <div key={it.key} className="list-item static edit-row">
                <span className={`tile tile-${it.kind}`}><Icon name={it.icon} size={22} /></span>
                <span className="li-main">
                  <span className="li-title">{nameOf(it.key)}</span>
                  {scaledFirst && <span className="li-sub">{t('onboard.rowFirst', { amount: fmt.money(scaled[it.key] ?? 0, currency) })}</span>}
                </span>
                <AmountField minor={plan[it.key] ?? 0} exp={exp} aria-label={nameOf(it.key)} onMinor={(n) => setAmounts((x) => ({ ...x, [it.key]: n }))} />
              </div>
            ))}
          </div>
          {rows.length < tpl.length && (
            <button type="button" className="text-link" aria-expanded={false} onClick={() => setMoreRows(true)}>
              {t('onboard.moreRows', { names: hidden.map((i) => nameOf(i.key)).join(', ') })}
            </button>
          )}
          <p className="note">{t('onboard.planRest', { amount: fmt.money(rest, currency) })} {t('onboard.bufferDef')}</p>
          <div className="ob-actions">
            <Button block disabled={busy} onClick={() => { void finish(false); }}>{t('onboard.looksGood')}</Button>
            <Button block variant={salaried ? 'text' : 'secondary'} disabled={busy} onClick={() => { void finish(true); }}>{t('onboard.startEmpty')}</Button>
          </div>
        </div>
      )}
    </main>
  );
}

/** Currency picker for onboarding (no workspace yet, so no stored rates). */
function CurrencyPickerStandalone({ value, onPick, onClose }: { value: string; onPick: (c: string) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const all = (() => { try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('currency'); } catch { return ['AZN', 'TRY', 'USD', 'EUR', 'RUB']; } })();
    const top = ['AZN', 'TRY', 'USD', 'EUR', 'RUB', 'GBP', 'GEL', 'KZT'];
    const ql = q.trim().toLowerCase();
    return [...new Set([...top, ...all])].filter((c) => !ql || c.toLowerCase().includes(ql)).slice(0, 60);
  }, [q]);
  return (
    <main className="onboarding">
      <div className="ob-col">
        <div className="ob-head"><button type="button" className="icon-btn" aria-label={t('common.back')} onClick={onClose}><Icon name="chevron-left" mirror /></button></div>
        <h1 className="ob-q">{t('onboard.currency')}</h1>
        <TextInput value={q} onChange={setQ} placeholder={t('sys.searchCurrency')} aria-label={t('sys.searchCurrency')} />
        <ul className="list">
          {list.map((c) => (
            <li key={c}><button type="button" className="list-item" onClick={() => onPick(c)}><span className="li-main"><span className="li-title">{c}</span></span>{c === value && <Icon name="check" size={20} />}</button></li>
          ))}
        </ul>
      </div>
    </main>
  );
}

