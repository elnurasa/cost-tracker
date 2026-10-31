import { Icon } from '../ui/Icon';
import { Money } from '../ui/display';
import { useI18n } from '../i18n';
import { useM } from '../state/ctx';
import { useUI } from '../state/ui';
import type { Transaction } from '../domain';

export function HistoryRow({ tx }: { tx: Transaction }) {
  const m = useM();
  const ui = useUI();
  const { t, fmt } = useI18n();
  const env = m.env(tx.envelopeId);
  const foreign = tx.currency !== m.base;
  // a received pay shows the name of its income ("Salary"), not a generic label
  const incomeName = tx.type === 'income' && tx.incomeEventId ? m.data.ds.incomes.find((i) => i.id === m.data.ds.events.find((e) => e.id === tx.incomeEventId)?.incomeId)?.name : undefined;
  const title = tx.note || tx.merchant || (tx.type === 'income' ? incomeName ?? t('income.other') : env?.name ?? '');
  const badge =
    tx.source === 'installment' ? t('history.installmentNo', { n: tx.installmentNo ?? 0 })
    : tx.source === 'recurring' ? t('history.recurring')
    : tx.status === 'pending' ? t('history.pending')
    : tx.type === 'refund' ? t('history.refund')
    : tx.payment === 'cash' ? t('add.cash')
    : tx.payment === 'card' ? t('add.card')
    : '';
  const sub = [tx.type === 'income' ? '' : env?.name, badge, foreign ? fmt.money(tx.amountBase, m.base) : ''].filter(Boolean).join(' · ');
  const shown = foreign ? tx.amount : tx.amountBase;
  const cur = foreign ? tx.currency : m.base;
  const icon = tx.type === 'income' ? 'banknote' : tx.source === 'installment' ? 'calendar-clock' : tx.source === 'recurring' ? 'repeat' : env?.icon ?? 'wallet';
  const aria = `${fmt.moneyName(shown, cur)}, ${title}, ${env?.name ?? ''}, ${fmt.date(tx.date, 'long')}`;
  return (
    <button type="button" className="list-item tx-row" onClick={() => ui.openSheet({ kind: 'edit', txId: tx.id })} aria-label={aria}>
      <span className={`tile tile-${tx.type === 'income' ? 'income' : env?.kind ?? 'flexible'}`}><Icon name={icon} size={22} /></span>
      <span className="li-main">
        <span className="li-title">{title}</span>
        <span className="li-sub">{sub}</span>
      </span>
      <span className={`li-amount${tx.type === 'income' ? ' income' : ''}`}>
        <Money minor={tx.type === 'refund' ? -shown : shown} currency={cur} sign={tx.type === 'income'} />
      </span>
    </button>
  );
}
