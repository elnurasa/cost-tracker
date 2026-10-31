// "+ New envelope" inside a form (payment form, add-expense): asks only for a name. The icon is suggested from the name and
// can be changed. Nothing is written here: the form creates the envelope together with its own save (one undo), so a
// cancelled form never leaves an empty envelope behind.
import { useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button, TextInput } from '../ui/primitives';
import { Icon, ENVELOPE_ICONS } from '../ui/Icon';
import { useI18n } from '../i18n';
import { useM } from '../state/ctx';
import { foldText, suggestIcon } from '../domain';

export interface NewEnvelopeDraft { name: string; icon: string }
export type InlineResult = { draft: NewEnvelopeDraft } | { existingId: string };

const DEFAULT_ICON: Record<'fixed' | 'flexible', string> = { fixed: 'receipt', flexible: 'wallet' };

export function NewEnvelopeSheet({ kind, initial, onCancel, onDone }: { kind: 'fixed' | 'flexible'; initial?: NewEnvelopeDraft | null; onCancel: () => void; onDone: (r: InlineResult) => void }) {
  const m = useM();
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [chosen, setChosen] = useState<string | null>(initial?.icon ?? null); // set once the person picks an icon by hand
  const auto = suggestIcon(name);
  const icon = chosen ?? auto ?? DEFAULT_ICON[kind];
  const clean = name.trim().replace(/\s+/g, ' ');
  const submit = () => {
    if (!clean) return;
    // the same name as an envelope you already have: select that one instead of making a twin
    const same = m.envelopes.find((e) => e.kind !== 'buffer' && foldText(e.name).trim() === foldText(clean));
    if (same) onDone({ existingId: same.id });
    else onDone({ draft: { name: clean.slice(0, 30), icon } });
  };
  return (
    <Sheet title={t('env.new.title')} onClose={onCancel} size="medium" tag="envelope-inline"
      actions={<Button block disabled={!clean} why={t('env.new.name')} onClick={submit}>{t('env.inline.add')}</Button>}>
      <div className="field">
        <label className="field-label" htmlFor="ei-name">{t('env.new.name')}</label>
        <div className="inline">
          <span className={`tile tile-${kind}`} aria-hidden="true"><Icon name={icon} size={22} /></span>
          <form className="grow" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <TextInput id="ei-name" value={name} onChange={setName} maxLength={30} autoFocus />
          </form>
        </div>
        <div className="field-hint">{kind === 'fixed' ? t('env.inline.fixedHelp') : t('env.inline.flexHelp')}</div>
      </div>
      <div>
        <div className="field-label" id="ei-icon">{t('env.detail.icon')}</div>
        {!chosen && auto && <div className="field-hint" aria-live="polite">{t('env.inline.iconHint')}</div>}
        <div className="icon-grid" role="radiogroup" aria-labelledby="ei-icon">
          {ENVELOPE_ICONS.filter((n) => n !== 'shield' && n !== 'hand-coins').map((n) => (
            <button key={n} type="button" role="radio" aria-checked={icon === n} aria-label={n} className={`icon-pick${icon === n ? ' is-selected' : ''}`} onClick={() => setChosen(n)}>
              <Icon name={n} size={22} />
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
