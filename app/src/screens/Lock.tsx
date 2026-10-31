import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button, Chip, ChipRow } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { useI18n } from '../i18n';
import { useUI } from '../state/ui';
import { usePrefs, setPrefs, resetPrefs } from '../state/prefs';
import { biometricAvailable, disableLock, registerBiometric, setLocked, setPin, verifyBiometric, verifyPin } from '../data/lock';
import { eraseAll } from '../data/repo';

function PinPad({ onKey }: { onKey: (k: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="pad" role="group" aria-label={t('add.keypad')}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((k, i) =>
        k === '' ? (
          <span key={i} />
        ) : (
          <button key={k} type="button" className="pad-key" aria-label={k === 'back' ? t('add.deleteKey') : k} onClick={() => onKey(k)}>
            {k === 'back' ? <Icon name="delete" size={26} /> : k}
          </button>
        ),
      )}
    </div>
  );
}
function Dots({ n, len }: { n: number; len: number }) {
  const { t } = useI18n();
  return (
    <div className="pin-dots" role="img" aria-label={t('lock.digits', { n })}>
      {Array.from({ length: len }, (_, i) => <span key={i} className={`pin-dot${i < n ? ' filled' : ''}`} />)}
    </div>
  );
}

export function LockScreen() {
  const { t } = useI18n();
  const ui = useUI();
  const prefs = usePrefs();
  const len = prefs.lock.len;
  const [pin, setPinState] = useState('');
  const [msg, setMsg] = useState('');
  const [wait, setWait] = useState(Math.max(0, Math.ceil((prefs.lock.lockedUntil - Date.now()) / 1000)));
  const [forgot, setForgot] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => clearInterval(id);
  }, [wait]);

  const tryBio = useCallback(async () => {
    if (await verifyBiometric()) setLocked(false);
  }, []);
  useEffect(() => {
    if (prefs.lock.credId) void tryBio();
  }, [prefs.lock.credId, tryBio]);

  const press = async (k: string) => {
    if (busy.current || wait > 0) return;
    if (k === 'back') return setPinState((p) => p.slice(0, -1));
    const next = (pin + k).slice(0, len);
    setPinState(next);
    if (next.length === len) {
      busy.current = true;
      const r = await verifyPin(next);
      busy.current = false;
      if (r.ok) {
        setLocked(false);
        setPinState('');
      } else {
        setPinState('');
        if (r.waitS > 0) {
          setWait(r.waitS);
          setMsg('');
        } else setMsg(t('lock.wrong', { n: r.triesLeft }));
      }
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (forgot) return;
      if (/^\d$/.test(e.key)) void press(e.key);
      if (e.key === 'Backspace') void press('back');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const erase = async () => {
    const ok = await ui.confirm({ title: t('lock.forgotTitle'), body: `${t('lock.forgotBody')} ${t('lock.forgotNoBackup')}`, confirmLabel: t('lock.erase'), cancelLabel: t('common.cancel'), destructive: true });
    if (!ok) return;
    await eraseAll();
    resetPrefs();
    setLocked(false);
    location.hash = '';
    location.reload();
  };

  return (
    <div className="lock" role="dialog" aria-modal="true" aria-label={t('lock.title')}>
      <div className="lock-inner">
        <Icon name="lock" size={32} />
        <h1 className="lock-title">{t('lock.enter')}</h1>
        <Dots n={pin.length} len={len} />
        <p className="lock-msg" role="status">{wait > 0 ? t('lock.wait', { s: wait }) : msg}</p>
        <PinPad onKey={(k) => void press(k)} />
        <div className="lock-actions">
          {prefs.lock.credId && <Button variant="text" icon="fingerprint" onClick={() => void tryBio()}>{t('lock.biometric')}</Button>}
          <Button variant="text" onClick={() => setForgot(true)}>{t('lock.forgot')}</Button>
        </div>
      </div>
      {forgot && (
        <Sheet title={t('lock.forgotTitle')} onClose={() => setForgot(false)} size="medium" tag="forgot" actions={<Button variant="danger" block onClick={erase}>{t('lock.erase')}</Button>}>
          <p>{t('lock.forgotBody')}</p>
          <p className="note">{t('lock.forgotNoBackup')}</p>
        </Sheet>
      )}
    </div>
  );
}

export function PrivacyShield() {
  return <div className="shield" aria-hidden="true" />;
}

export function LockSetupSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const ui = useUI();
  const [len, setLen] = useState(4);
  const [first, setFirst] = useState('');
  const [pin, setPinState] = useState('');
  const [stage, setStage] = useState<'choose' | 'confirm'>('choose');
  const [msg, setMsg] = useState('');
  const [bio, setBio] = useState(false);
  useEffect(() => void biometricAvailable().then(setBio), []);
  const press = async (k: string) => {
    if (k === 'back') return setPinState((p) => p.slice(0, -1));
    if (pin.length >= 6) return;
    setPinState(pin + k);
  };
  const next = async () => {
    if (stage === 'choose') {
      setFirst(pin);
      setLen(pin.length);
      setPinState('');
      setStage('confirm');
      return;
    }
    if (pin !== first) {
      setMsg(t('lock.mismatch'));
      setPinState('');
      setStage('choose');
      setFirst('');
      return;
    }
    await setPin(pin);
    if (bio) await registerBiometric();
    ui.toast({ message: t('lock.set'), duration: 3000 });
    onClose();
  };
  return (
    <Sheet title={t('lock.setupTitle')} onClose={onClose} tag="lock-setup" actions={<Button block disabled={pin.length < 4} why={t('lock.setupBody')} onClick={next}>{stage === 'choose' ? t('common.continue') : t('common.confirm')}</Button>}>
      <p>{stage === 'choose' ? t('lock.setupBody') : t('lock.confirmPin')}</p>
      <Dots n={pin.length} len={Math.max(4, stage === 'confirm' ? len : pin.length || 4)} />
      {msg && <p className="note" role="status">{msg}</p>}
      <PinPad onKey={(k) => void press(k)} />
      <p className="note">{t('lock.setupHonest')}</p>
      <p className="note">{t('lock.warn')}</p>
      {bio && <p className="muted">{t('lock.bioSetup')}</p>}
    </Sheet>
  );
}

export function LockSettings() {
  const { t } = useI18n();
  const ui = useUI();
  const prefs = usePrefs();
  const l = prefs.lock;
  return (
    <div className="stack">
      <p className="note">{t('lock.setupHonest')}</p>
      {l.enabled ? (
        <>
          <p>{t('lock.set')}</p>
          <div className="field-label">{t('lock.delay')}</div>
          <ChipRow label={t('lock.delay')} wrap>
            {([0, 30, 300] as const).map((s) => <Chip key={s} selected={l.delayS === s} onClick={() => setPrefs({ lock: { ...l, delayS: s } })}>{t(`lock.delay.${s}` as const)}</Chip>)}
          </ChipRow>
          <Button variant="secondary" block onClick={() => ui.openSheet({ kind: 'lock-setup' })}>{t('lock.change')}</Button>
          <Button variant="danger" block onClick={() => disableLock()}>{t('lock.turnOff')}</Button>
        </>
      ) : (
        <>
          <p className="note">{t('lock.warn')}</p>
          <Button block onClick={() => ui.openSheet({ kind: 'lock-setup' })}>{t('settings.lock')}</Button>
        </>
      )}
    </div>
  );
}
