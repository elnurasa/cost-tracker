import { useEffect } from 'react';
import { useI18n } from '../i18n';
import { useUI } from './ui';
import { usePrefs } from './prefs';
import { STORAGE_FULL_EVENT } from '../data/db';
import { ensurePersisted } from '../data/storage';

/** Renders nothing: turns a full-disk write failure into a calm toast, and re-asks for durable storage once per launch. */
export function StorageWatch() {
  const { t } = useI18n();
  const ui = useUI();
  const prefs = usePrefs();
  useEffect(() => {
    let last = 0;
    const onFull = () => {
      if (Date.now() - last < 4000) return;
      last = Date.now();
      ui.toast({ message: t('sys.storageFull'), duration: 8000 });
    };
    window.addEventListener(STORAGE_FULL_EVENT, onFull);
    return () => window.removeEventListener(STORAGE_FULL_EVENT, onFull);
  }, [ui, t]);
  useEffect(() => {
    // browsers grant persistence on engagement: retry once per launch until granted
    if (prefs.persistResult !== 'granted') void ensurePersisted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
