// Pure domain types. No React, no DB, no I/O.
export type Minor = number; // integer minor units, never floats
export type DateStr = string; // local calendar date YYYY-MM-DD
export type Currency = string; // ISO 4217
export type Locale = 'en' | 'ru' | 'tr' | 'az';
export type Region = 'AZ' | 'TR' | 'CIS' | 'GLOBAL';
export type EnvelopeKind = 'fixed' | 'flexible' | 'pocket' | 'buffer' | 'savings';
export type RolloverAction = 'carry' | 'to_buffer';
export type CycleDay = number | 'L';

export interface Base {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  rev: string;
}

export interface Workspace extends Base {
  name: string;
  baseCurrency: Currency;
  locale: Locale;
  cycleStartDay: CycleDay;
  bridgeBuffer: boolean;
  rates: Record<string, { rate: string; updatedAt: string }>;
  coverUntil: DateStr | null;
  masterPlan: Record<string, Minor>;
  lateAssumedArrival: DateStr | null;
  schemaVersion: number;
  region: Region;
}

export interface Envelope extends Base {
  workspaceId: string;
  name: string;
  icon: string;
  kind: EnvelopeKind;
  order: number;
  archived: boolean;
  rolloverRule: RolloverAction;
  /**
   * Stable payment-category key (domain/categories.ts) for envelopes that are a ready-made payment category, e.g. 'utilities'
   * for "Kommunal". At most one live envelope per key. Missing/null = no category (everyday envelopes). Added in IndexedDB v4.
   */
  categoryKey?: string | null;
}

export type Schedule =
  | { type: 'monthly'; day: number | 'L' }
  | { type: 'weekly'; weekday: number }
  | { type: 'biweekly'; refDate: DateStr }
  | { type: 'once'; date: DateStr }
  | { type: 'none' };

export interface Income extends Base {
  workspaceId: string;
  name: string;
  kind: 'salary' | 'advance' | 'allowance' | 'freelance' | 'other';
  reliability: 'steady' | 'uncertain';
  isAnchor: boolean;
  schedule: Schedule;
  expectedAmount: Minor;
  currency: Currency;
  active: boolean;
}

export interface IncomeEvent extends Base {
  incomeId: string;
  expectedDate: DateStr | null;
  expectedAmount: Minor;
  expectedBase: Minor;
  currency: Currency;
  status: 'expected' | 'received' | 'skipped';
  receivedDate: DateStr | null;
  receivedAmount: Minor | null;
  rate: string;
  receivedBase: Minor | null;
  transactionId: string | null;
}

export interface Period extends Base {
  workspaceId: string;
  startDate: DateStr;
  endDate: DateStr;
  state: 'open' | 'closing' | 'closed';
  closedAt: string | null;
  scaledFirstPeriod: boolean;
}

export interface PlanLine extends Base {
  periodId: string;
  envelopeId: string;
  amount: Minor;
}

export type TxType = 'expense' | 'income' | 'refund';
export type TxSource = 'manual' | 'recurring' | 'installment' | 'qr' | 'sms' | 'bank_api' | 'import';

export interface Transaction extends Base {
  workspaceId: string;
  type: TxType;
  date: DateStr;
  time: string | null;
  amount: Minor;
  currency: Currency;
  rate: string;
  amountBase: Minor;
  envelopeId: string | null;
  incomeEventId: string | null;
  merchant: string | null;
  note: string | null;
  source: TxSource;
  sourceRef: string | null;
  dedupeKey?: string | null;
  recurringRuleId: string | null;
  installmentId: string | null;
  installmentNo: number | null;
  occurrenceDate: DateStr | null;
  occKey?: string | null;
  status: 'posted' | 'pending' | 'void';
  deviceId: string;
  payment?: 'cash' | 'card' | 'other' | null;
}

export interface CommitmentRule extends Base {
  workspaceId: string;
  name: string;
  envelopeId: string;
  amount: Minor;
  currency: Currency;
  frequency: 'once' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  anchorDate: DateStr;
  dayOfMonth: number | 'L' | null;
  endDate: DateStr | null;
  estimate: boolean;
  active: boolean;
  skippedDates: DateStr[];
  /** To whom / where the money goes (bank, utility, landlord). Free text. */
  payee?: string | null;
  /** true = recorded automatically on the due date (direct debit); false = waits for "I paid". Missing = true (data from before v3). */
  autoPost?: boolean;
  /** auto mode only records occurrences due on or after this date (set when the switch is turned on); null = all */
  autoFrom?: DateStr | null;
  /** set while paused; on resume the dates in between are skipped */
  pausedAt?: DateStr | null;
}

export type LoanKind = 'installment' | 'loan';

export interface InstallmentPlan extends Base {
  workspaceId: string;
  name: string;
  envelopeId: string;
  currency: Currency;
  paymentAmount: Minor;
  paymentCount: number;
  firstDueDate: DateStr;
  paidBeforeCount: number;
  skipped: number[]; // occurrence numbers skipped
  status: 'active' | 'done' | 'cancelled';
  /** 'installment' = store taksit (usually no interest), 'loan' = bank kredit. Missing = 'installment'. */
  kind?: LoanKind;
  payee?: string | null;
  /** optional, informational: money borrowed (plan currency, minor units) */
  principal?: Minor | null;
  /** optional, informational: annual interest rate in percent (e.g. 18.5) */
  interestRate?: number | null;
  autoPost?: boolean;
  autoFrom?: DateStr | null;
  /**
   * Occurrence numbers that are not owed at all. Data from before v3 used "skip" with this meaning, so the migration copies
   * `skipped` here. A skip made now keeps the amount owed: it moves to the end of the schedule.
   */
  waived?: number[];
}

export interface EnvelopeTransfer extends Base {
  periodId: string;
  fromEnvelopeId: string;
  toEnvelopeId: string;
  amount: Minor;
  date: DateStr;
  note: string | null;
}

export interface RolloverDecision extends Base {
  periodId: string; // the closed period
  envelopeId: string;
  leftover: Minor;
  action: RolloverAction;
  confirmedAt: string | null;
  adjustment?: boolean; // late-edit adjustment row (4.10)
  appliedPeriodId?: string | null; // period whose Buffer rolloverIn gets the delta
  note?: string | null;
}

export interface Dataset {
  workspace: Pick<Workspace, 'baseCurrency' | 'bridgeBuffer' | 'coverUntil' | 'lateAssumedArrival' | 'cycleStartDay'>;
  envelopes: Envelope[];
  incomes: Income[];
  events: IncomeEvent[];
  periods: Period[];
  planLines: PlanLine[];
  transactions: Transaction[]; // non-deleted only
  transfers: EnvelopeTransfer[];
  decisions: RolloverDecision[];
}
