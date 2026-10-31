# Product Spec v1 - "Sakin" (AZ market name: "Pul Planim")

Author: Product Owner | Date: 2026-10-30 | Audience: UX/UI Designer, Full-stack Developer, QA
Inputs: `01-market-analysis.md` (items marked UNVERIFIED there are treated as hypotheses here).
Status: decisions are final unless a risk in section 9 triggers a review. The founder delegated all decisions to the team; nothing in this document is an open question.

How to read: sections 1-3 are the "why/what". Section 4 is the domain logic and is normative: a developer implements it as a pure, I/O-free module and QA derives golden tests from the worked examples. Sections 5-7 are flows, tone and numbered acceptance criteria (AC-xxx). Sections 8-9 are metrics and risks.

---

## 1. Product name, positioning, vision, principles

### 1.1 Name decision
- **International name: "Sakin"** (working, pending trademark/store-name check). Rationale: means "calm" in both Turkish and Azerbaijani (two of the four launch languages, and the two where we have the most to prove), short, pronounceable in English and Russian, neutral meaning there, no finance jargon, fits the "calm" promise. Store subtitle pattern: "Sakin - your calm daily number".
- **Azerbaijani market name: "Pul Planim"** (store listing, AZ marketing). Same app, same package; only the display name and listing differ per locale. In-app brand string is a localizable key (`brand.name`) so AZ shows "Pul Planim" and others "Sakin".
- Fallback if "Sakin" is unavailable (trademark or store collision): "Kalma" then "Pul Planim" globally. Decision rule: do not spend more than one day on this; the name is a string, not architecture.
- Not chosen: "Pul Planim" globally (hard to say and remember outside AZ/TR; "pul" means "stamp/fee" in other languages).

### 1.2 One-line positioning
"Sakin tells you how much you can safely spend today - privately, offline, and without judging you."
(Positioning option B from the market analysis, "The calm daily number", with option C's pay-cycle and installment mechanics built in as the reason the number is right.)

### 1.3 Vision
Anyone who gets paid, in any currency, with any financial literacy, can open their phone and know in two seconds whether they are okay today, and understand why in one tap. The app never makes them feel bad, never needs a bank login, and still works after the data is two years deep.

### 1.4 Design rules (testable form of the founder's philosophy)
Each rule has an ID that QA and design reviews cite.

| ID | Rule | How it is tested |
|---|---|---|
| DR-1 | No screen has more than one primary number (the largest type on screen). Secondary numbers are at most 60% of its size. | Design review checklist per screen; screenshot audit |
| DR-2 | First useful screen (hero number) within 60 seconds of first open, with no account, no permission prompt, no bank. | Timed usability test, 5 users, median <= 60 s |
| DR-3 | Add expense takes at most 2 taps excluding digit entry (tap "+", type amount, tap "Save"), with envelope and date pre-filled. | Tap-count test; AC-EXP-01 |
| DR-4 | Every number the app computes is explainable in one tap with plain arithmetic. | Each computed figure has a "why" sheet (AC-HERO-08) |
| DR-5 | Nothing blocks or scolds. No modal prevents saving an entry. No sentence says the user "failed", "overspent", "exceeded", "must" or "should". | Copy lint (banned-word list, section 6.3) run in CI on all 4 locales |
| DR-6 | No red used to signal money state. Red is reserved for irreversible destructive confirmations only. Over-plan uses a neutral warm tone with an icon plus text, never colour alone. | Design token audit; accessibility check |
| DR-7 | No streaks, scores, badges, grades, leaderboards, confetti-for-spending. | Backlog rule: such tickets are rejected |
| DR-8 | Plain language: sentences <= 12 words, reading level about grade 6, no jargon (no "zero-based", "amortization", "liquidity"). Domain words used: income, plan, envelope, buffer, bill, installment. | Copy review; native-speaker pass per locale |
| DR-9 | Progressive disclosure: a screen shows at most 7 list rows before "Show more"; at most 1 primary and 1 secondary button per screen. | Design review |
| DR-10 | Undo instead of confirm dialogs for reversible actions (delete, move money). Confirm dialogs only for irreversible bulk actions (restore/replace all data, base-currency conversion, erase). | Interaction audit |
| DR-11 | Works fully offline; every core action (add, edit, rebalance, plan edit) completes with no network and updates the UI in <= 100 ms; cold start to hero <= 2.0 s on a reference low-end Android (2 GB RAM). | Performance test on device lab |
| DR-12 | Accessibility: touch targets >= 48 dp, body text >= 16 px, WCAG AA contrast, supports OS font scaling to 200% without clipping, full screen-reader labels, state never conveyed by colour alone. | Automated + manual audit |
| DR-13 | Empty and zero states are first-class: every screen is useful and non-scary with zero data. | Per-screen empty state exists |
| DR-14 | The user's data never leaves the device unless they export it (v1). | Network audit: zero third-party requests, zero requests carrying user data |

---

## 2. Target users and personas

Primary audience at launch: people who are paid on a schedule and live on a tight monthly rhythm in AZ/TR/CIS, plus English-speaking users who want a calm, private, no-bank-login planner. Market evidence: sections 4, 7, 9 of the analysis.

### Persona A - Leyla, 29, salaried, two pay days (Baku)
- Android phone, paid "avans" on the 20th and salary on the 5th; rent, phone installment, family gifts; mostly cash and card, bank SMS everywhere; Russian + Azerbaijani.
- Jobs: "Tell me what I can spend until the next payment." "Keep the rent money safe from me." "Give me a little guilt-free money."
- Pain: bank apps show balances, not what is free to spend. Spreadsheets get abandoned.
- Success: opens the app daily, uses hero number, sees avans and salary both land in one plan.

### Persona B - Murat and Elif, 36/34, installment-heavy household (Istanbul)
- Credit-card taksit for a phone, fridge and school fees; salary on the 1st (Murat) plus a smaller one on the 15th (Elif); inflation forces mid-month re-planning; shared pot managed by one phone.
- Jobs: "Show me what is already promised to future months." "Add a new taksit and see what it does to this month." "Re-plan when prices jump."
- Pain: US-built apps cannot model N future payments from one purchase.
- Success: every taksit added in under 30 seconds, the hero number visibly adjusts, re-plan takes one screen.

### Persona C - Daniyar, 31, freelancer with variable income (Almaty / remote)
- Paid per project, irregular dates, sometimes USD, sometimes local currency; no stable pay day.
- Jobs: "Tell me how long this payment can last." "Don't judge me for a bad month." "Handle two currencies without a finance degree."
- Pain: fixed-month budgets break; apps assume a salary.
- Success: records income when it lands, answers "last how long?" once, gets a daily number that makes sense, keeps a Buffer.

### Persona D - Aysel, 20, student on allowance (Ganja / anywhere)
- Receives weekly or monthly money from parents plus occasional part-time pay; no bills; cash heavy; low financial literacy; wants fun money without guilt.
- Jobs: "Don't let me run out before Friday." "Let me spend my fun money without a lecture."
- Pain: finance apps feel like homework.
- Success: onboarding in under a minute, one number, the "My share" envelope as her main thing.

Persona -> mechanics map: A -> multiple incomes per period, horizon to next income (avans). B -> installments, make-room, mid-period plan edit. C -> uncertain income, cover-until horizon, multi-currency per transaction, Buffer. D -> pocket envelope, weekly income events, minimal plan.

---

## 3. Scope

### 3.1 Feature list with purpose

Legend: V1 = build now; V1.1 = next release (target 6-8 weeks after V1); V2 = after validation; LATER = direction, not planned.

**V1 (the full loop: set up, spend, see the number, adjust, close the period, never lose data)**

| # | Feature | One-line purpose |
|---|---|---|
| F1 | 60-second onboarding with regional templates | Reach the first useful number before attention fades |
| F2 | Workspace and settings (language, base currency, theme, cycle start day) | Make the app local without configuration pain |
| F3 | Income schedules with expected/received states | Plan activates only on real money |
| F4 | Envelopes (fixed, flexible, pocket, buffer, savings) and plan allocation | The founder's core model: split income, see plan vs actual |
| F5 | Auto Buffer for unallocated money | Never tell the user "you made a mistake" |
| F6 | Safe-to-spend hero (daily number) + "Why this number?" | Answer "am I okay today?" in two seconds, with trust |
| F7 | Add / edit / delete expense and income with undo; history list with filter and search | Fast capture; full history forever |
| F8 | Pocket envelope "My share" (Menim payim) | Guilt-free personal money with no judgment |
| F9 | Recurring bills and one-time planned items (auto-post) | Known commitments handle themselves |
| F10 | Installment plans (taksit) | Make N future payments first-class; show their effect |
| F11 | Rebalance: move money between envelopes (one tap) | Overspend becomes a 3-second fix, not a failure |
| F12 | Edit plan mid-period, "Make room", "Fit plan to income" | Real life changes; the plan flexes |
| F13 | Period lifecycle, end-of-period review with suggested rollover (one tap) | Close the loop without bookkeeping |
| F14 | Multi-currency: base currency per workspace; per-transaction currency with manual/stored rate | Honest handling of USD/EUR/TRY mixes with minimal rules |
| F15 | App lock (PIN, biometric via WebAuthn where available) | Table stakes privacy |
| F16 | Export (CSV, JSON backup), restore, optional passphrase encryption of backups | Ownership and recoverability |
| F17 | Four languages (EN, RU, TR, AZ), RTL-ready layout | Home-market fluency, future-proof |
| F18 | Installable PWA, offline, persistent storage request, adaptive phone / two-pane tablet layout | Delivery vehicle for V1 |
| F19 | In-app calm nudges (capped) | Gentle re-engagement without OS notification dependency (see 6.1) |
| F20 | On-device "My stats" (days tracked, etc.) and opt-in anonymous counters | Measure without surveillance |

**V1.1**
- Source-agnostic importers: "Paste bank message" (policy-safe, cross-platform, user pastes or shares an SMS text; on-device template parser) - purpose: capture assist with zero permissions.
- Azerbaijan fiscal receipt QR scan (after a spike on payload content, per analysis item) - purpose: authoritative total/merchant/date in one scan.
- Capacitor wrapper with local OS notifications, Android widget for the daily number, automatic backup to a user-chosen file/cloud folder.
- Savings goals with target and date (a Savings envelope with a target) - purpose: motivate without pressure.
- Stored exchange-rate refresh (optional, online, user-triggered) - purpose: remove manual rate typing.
- Refund UI ("Money back") - model already supports it in V1.
- Simple monthly recap screen (3 facts, no charts of shame).
- Second workspace (e.g., "Business" or "Partner"): up to 2 free.
- Weekend/holiday shift of expected pay dates.
- Voice entry (Web Speech / platform STT) - purpose: 1-tap hands-free entry; accuracy for Azerbaijani unverified, so not a gate.

**V2**
- Android-only opt-in notification/SMS capture with strict allowlist, on-device only, approval-gated (Google Play Permissions Declaration); never a launch dependency.
- Optional account + end-to-end encrypted sync (contract in 4.12), multi-device.
- Shared budget with a partner (two devices, one workspace).
- Open banking (CBAR Azerbaijan, TCMB/BKM GECIT Turkey) via a licensed aggregator partner as a transaction `source: bank_api`.
- Spanish, Portuguese-BR, Arabic (RTL) locales.
- Plus paid tier (section 3.4).

**LATER**
- Receipt line-item OCR/LLM, AI input assist (categorise, parse), forecasting, investment-adjacent views, iOS Shortcuts/Wallet automations, web dashboard.

### 3.2 Deliberately NOT building (and why)

| Not building | Why |
|---|---|
| Bank login / credential aggregation in V1 | Regulatory/licensing burden, cost, breakage; violates local-first; analysis: sync breakage is a top churn cause |
| Net worth, investments, crypto, debt-payoff optimizers | Different product; complexity; no clear value for our personas |
| Tags, nested categories, split transactions, custom rules engines | Complexity (analysis theme #3); one envelope per transaction keeps the model explainable |
| Gamification: streaks, badges, scores, points, levels | Shames missed days, creates "digital nag"; DR-7 |
| Budget "grades", spending-vs-peers comparisons | Shame/report-card effect (theme #2) |
| AI chat assistant | Commoditised, costs money, privacy complexity; AI only later and only for input |
| Ads and affiliate/credit offers | Trust; Cleo-style monetisation conflicts with calm tone |
| Charts-heavy analytics in V1 | Not needed for the daily loop; one plan-vs-actual bar per envelope suffices |
| Bill payment, money movement, card issuance | We never hold or move money; avoids financial-services licensing |
| Future-dated manual expenses | Use planned items; keeps "spent so far" truthful |
| Percent-based plan storage | Amounts are stored; percentages exist only as a template helper; avoids drift and rounding bugs |
| Per-envelope custom currencies | Base-only plan keeps arithmetic and explanation simple |
| Weekly/biweekly/custom-length budget periods | Periods are monthly cycles; weekly pay is handled as multiple incomes inside one period (see 4.2) |
| Reminders/alarms for every bill | Bills auto-post; notification fatigue |
| Social features, leaderboards, public sharing | No value for the job to be done |
| Dark-pattern monetisation (hard paywall in onboarding, caps on envelopes/history) | Backlash triggers in the analysis |

### 3.3 Tablet scope
Layout only in V1: at width >= 840 px, a two-pane layout (left: Today + Plan stacked; right: History or the selected item's detail) with a navigation rail instead of bottom tabs. No tablet-only features. Phone is the design target and QA priority.

### 3.4 Monetisation: free vs paid (nothing is built in V1)

Principle: the core loop is free forever; paid features are things with ongoing cost or multi-device value. Code rule: every future paid feature is behind `hasEntitlement(key)`, which returns `true` for everything in V1. No payment SDK, no paywall UI, no price strings in V1.

| Free forever | Plus (later; entitlement key) |
|---|---|
| Unlimited envelopes, transactions, history, periods | Multi-device encrypted sync + hosted cloud backup (`sync`) |
| Safe-to-spend, Why sheet, rebalance, rollover | Shared budget with a partner (`shared`) |
| Installments, recurring bills, multi-currency, 4+ languages | Advanced insights: yearly report, trends, forecasts (`insights_plus`) |
| App lock, CSV/JSON export, encrypted backup file, restore | Voice and AI input assists if they use paid cloud services (`assist_cloud`) |
| QR receipt scan, paste-bank-message, Android notification capture (no marginal cost) | More than 2 workspaces, extra themes/icons (`workspaces_plus`, `themes`) |
| 2 workspaces | |

Pricing intent (applied only when Plus ships): purchasing-power-parity tiers from the analysis: Tier 1 (US/CA/UK/EU/AU/Gulf) about $29.99/yr, lifetime $69; Tier 2 (TR, BR, MX, PL, KZ) about 45% of Tier 1; Tier 3 (AZ, GE, IN, ID, EG, UZ and similar) about 25% of Tier 1. 30-day free trial of Plus, annual and lifetime SKUs, no hard paywall in onboarding. Price-change policy published in-app: 60 days' notice and existing subscribers grandfathered for 12 months. Review Tier 2 prices twice a year (inflation).

---

## 4. Domain model and calculation rules (normative)

Implementation note: all logic in this section lives in a pure module (`domain/`) with no I/O, no clock access (clock passed in as `today`), and no UI strings. UI and storage call it. All derived values (funded amounts, available balances, safe-to-spend) are recomputed from stored facts and are NEVER stored. Stored facts: transactions, income events, transfers, plan lines, rollover decisions, rules.

### 4.1 Conventions
- **Money**: integer minor units (`Minor`). Exponent from ISO 4217 (AZN 2, TRY 2, USD 2, JPY 0). Never floating point. Internal precision is exact minor units; **display** of the hero number rounds DOWN to whole major units (so the user never overshoots); all other amounts display with the currency's normal decimals.
- **Dates**: local calendar dates `YYYY-MM-DD` (workspace uses the device's local zone; no UTC date math). Timestamps `createdAt/updatedAt` are UTC ISO strings. Day difference = difference of calendar dates (DST-safe).
- **IDs**: UUIDv7 strings. Every entity has `id`, `createdAt`, `updatedAt`, `deletedAt|null` (soft delete tombstone, purged after 30 days), `rev` (hybrid logical clock string, for future sync).
- **Rounding**: when dividing money use floor to minor units unless stated; pro-rata distribution uses **largest remainder**: compute exact shares, floor each, then give remaining minor units one by one to the largest fractional remainders; ties go to the lowest `order` index.
- **Foreign conversion**: `rate` = base units per 1 foreign unit, stored as a decimal string (up to 8 decimals); `amountBase = round_half_up(amount * rate)` in base minor units, computed once at save and stored.
- **Base currency**: all plan, envelope, funding and safe-to-spend math is in the workspace base currency.

### 4.2 Entities

```
Workspace {
  id, name, baseCurrency: ISO4217, locale: 'en'|'ru'|'tr'|'az',
  cycleStartDay: 1..28 | 'L',          // 'L' = last day of month
  bridgeBuffer: boolean = true,         // count Buffer while income is late/unreceived
  rates: { [ISO4217]: { rate: string, updatedAt } },
  coverUntil: date | null,              // for users without steady income (4.6)
  masterPlan: { [envelopeId]: Minor },  // allocation template for a normal full period
  lateAssumedArrival: date | null,      // user-set "I expect it on..." override (4.6)
  createdAt, schemaVersion, region: 'AZ'|'TR'|'CIS'|'GLOBAL'
}

Envelope {
  id, workspaceId, name, icon, kind: 'fixed'|'flexible'|'pocket'|'buffer'|'savings',
  order: int, archived: boolean,
  rolloverRule: 'carry'|'to_buffer'     // default by kind, see 4.9
}
 constraints: exactly one 'buffer' (cannot be deleted/archived; can be renamed);
              exactly one 'pocket' in V1 (can be renamed; cannot be deleted, may be hidden from Today);
              any number of fixed / flexible / savings; hard technical cap 30 envelopes (not a paywall).
 kind change is allowed except fixed <-> others while active commitments are linked (UI: "Move your bills first").
 Archiving an envelope with a non-zero available balance is blocked until the balance is moved (Transfer sheet opens).

Income {                                 // a schedule
  id, workspaceId, name, kind: 'salary'|'advance'|'allowance'|'freelance'|'other',
  reliability: 'steady'|'uncertain',     // steady: defines the horizon; uncertain: never defines it
  isAnchor: boolean,                     // exactly one steady income is the anchor (sets default cycleStartDay)
  schedule: {type:'monthly', day:1..31|'L'} | {type:'weekly', weekday:0..6}
          | {type:'biweekly', refDate} | {type:'once', date} | {type:'none'},   // 'none' = ad hoc
  expectedAmount: Minor, currency: ISO4217, active: boolean
}

IncomeEvent {                            // one occurrence
  id, incomeId, expectedDate|null, expectedAmount: Minor, currency,
  status: 'expected'|'received'|'skipped',
  receivedDate|null, receivedAmount|null (own currency), rate, receivedBase|null,
  transactionId|null                     // the income transaction created on receipt
}
 Events are generated lazily for dates from today-14 to today+62 and are idempotent on (incomeId, expectedDate).
 An event belongs to the period containing receivedDate if received, else the period containing expectedDate.

Period {
  id, workspaceId, startDate, endDate,   // [start, next start - 1]
  state: 'open'|'closing'|'closed', closedAt|null, scaledFirstPeriod: boolean
}
PlanLine { periodId, envelopeId, amount: Minor }       // buffer line is derived, not stored (4.4)

Transaction {
  id, workspaceId,
  type: 'expense'|'income'|'refund',
  date, time|null,
  amount: Minor (>0), currency, rate: string, amountBase: Minor (>0),
  envelopeId|null (required for expense/refund, null for income),
  incomeEventId|null,
  merchant|null, note|null,
  source: 'manual'|'recurring'|'installment'|'qr'|'sms'|'bank_api'|'import',
  sourceRef|null,                        // dedupe key; unique per (source, sourceRef) when not null
  recurringRuleId|null, installmentId|null, installmentNo|null, occurrenceDate|null,
  status: 'posted'|'pending'|'void',     // pending = auto-posted estimate awaiting confirmation; counts as spent
  deviceId
}
 Spent for an envelope = sum(expense.amountBase) - sum(refund.amountBase) over status in (posted,pending), by date in period.
 Future-dated entries are not allowed (date <= today).

CommitmentRule {                         // bills, subscriptions, one-time planned items
  id, name, envelopeId (must be kind 'fixed'), amount: Minor, currency,
  frequency: 'once'|'weekly'|'biweekly'|'monthly'|'yearly',
  anchorDate (first/next due date), dayOfMonth|'L' for monthly, endDate|null,
  estimate: boolean,                     // true => posts with status 'pending' (variable bill, e.g. utilities)
  active: boolean, skippedDates: date[]
}

InstallmentPlan {                        // "taksit"
  id, name, envelopeId (kind 'fixed'), currency,
  paymentAmount: Minor, paymentCount: int (1..120),
  firstDueDate, paidBeforeCount: int = 0,         // payments already made before entering the app
  totalAmount: Minor (derived = paymentAmount * paymentCount, display only),
  status: 'active'|'done'|'cancelled'
}
 Occurrence n (1..paymentCount) due on firstDueDate + (n-1) months, day clamped to month length.
 Occurrences n <= paidBeforeCount are `paid` at creation without a transaction. Others are `scheduled`.
 Occurrence states: scheduled | paid | skipped. When all are paid/skipped the plan becomes 'done'.

EnvelopeTransfer { id, periodId, fromEnvelopeId, toEnvelopeId, amount: Minor (base), date, note|null }

RolloverDecision { periodId (the closed period), envelopeId, leftover: Minor (may be negative),
                   action: 'carry'|'to_buffer', confirmedAt|null }
```

**Period boundaries.** With `cycleStartDay = c`, period k starts on day `c` of a month (`'L'` = last day) and ends the day before the next start. Period length is always one month. Periods are created lazily when the app opens (create every missing period up to today). The onboarding period may be partial (starts today; 5.1).

### 4.3 Period decision (the budget period)

**Decision: the budget period is a monthly pay cycle, user-selectable by its start day; default = the day-of-month of the user's anchor income; weekly, biweekly and irregular earners default to day 1 (calendar month). The period is the container for the plan and for rollover; it is NOT the unit that divides the daily number. The daily number is divided by the days until the next expected income (the horizon, 4.6), which can fall inside the period.**

Why this is right for each pattern:
- **Azerbaijan "avans + salary" (persona A):** one period per month anchored on the larger payment (default: salary day). The avans is a second income event inside the same period. Alternatives rejected: two half-month periods would double setup and misplace monthly bills (rent) into arbitrary halves. The horizon rule keeps the daily number correct anyway: after salary, the number covers days until the avans; after the avans, days until the next salary.
- **Weekly / biweekly pay (persona D, gig workers):** one calendar-month period holding 4-5 expected income events. The planned income is the sum of expected events in the period; the daily number covers days until the next paycheck. No weekly budgets to maintain.
- **Turkey mid-month re-planning (persona B):** the plan is editable at any time (F12) with "Make room" for new installments and "Fit plan to income" for lower income; salary on the 1st and a second one on the 15th are simply two events. Cycle start 1 is the common case.
- **Calendar month** is just `cycleStartDay = 1`. Users can change the start day in Settings; the change takes effect at the next period boundary (the current period keeps its dates).
- **Pay days 29-31:** mapped to `'L'` (last day). Salary paid on the 29th/30th/31st is treated as paid on the last day of the month; this is a documented approximation (+/- 2 days), covered by the 3-day late grace.
- **Variable income:** see 4.6 (cover-until).

### 4.4 Plan allocation and the automatic Buffer

- Each period has `PlanLine`s for every non-buffer envelope (amount >= 0; missing line = 0).
- **Planned income** `P_inc` = sum over the period's income events of: `receivedBase` if received, `expectedBase` (expected amount converted at the stored rate) if expected, 0 if skipped; plus income transactions with no event (ad hoc).
- **Buffer line (derived):** `alloc[buffer] = max(0, P_inc - sum(alloc[e] for e not buffer))`. The user never types it. The unallocated rest therefore lands in Buffer; the UI says "The rest goes to your Buffer".
- **Over-planned:** if `sum(non-buffer allocs) > P_inc`, buffer allocation is 0 and the Plan screen shows the neutral line "Plan is X above expected income. Fit plan to income?" with one button (4.7). It is never an error, and saving is never blocked.
- **New period plan creation:** copy `masterPlan`; then for each fixed envelope with commitments (rules or installment occurrences) due in the new period, `alloc[e] = max(alloc[e], sum of commitments due in period for e)`. Edits on a period offer "Also use for next periods" (default on), which updates `masterPlan`.

### 4.5 Funding (plan activates on receipt) and Available

`R` = total received income in the period in base currency = sum of `receivedBase` of received events + ad hoc income transactions dated in the period.

```
function funding(R, alloc, envelopes): Map<EnvelopeId, Minor>
  fixed  = envelopes where kind == 'fixed'
  others = envelopes where kind != 'fixed'        // flexible, pocket, savings, buffer
  F  = sum(alloc[e] for e in fixed)
  T2 = sum(alloc[e] for e in others)              // includes derived buffer line
  funded = all zeros
  if R <= 0: return funded
  if R < F:
      funded[fixed] = proRata(R, alloc over fixed)            // bills first, shared fairly
      return funded
  funded[fixed] = alloc[fixed]                    // tier 1: bills and installments are fully funded first
  R2 = R - F
  if T2 == 0:       funded[buffer] += R2                      // surplus
  elif R2 >= T2:    funded[others] = alloc[others]; funded[buffer] += R2 - T2   // surplus to Buffer
  else:             funded[others] = proRata(R2, alloc over others)             // tier 2: shared proportionally
  return funded
```

Why pro-rata for tier 2 (and not "flexible first"): with an avans + salary, "flexible first" front-loads day-to-day money and starves the second half of the month. Pro-rata gives roughly the same daily rate before and after the second income (verified in Example 1).

```
function available(e, period): Minor
  return rolloverIn[e] + funded[e] + transfersIn[e] - transfersOut[e] - spent[e]
```
`rolloverIn[e]` comes from the previous period's confirmed (or provisional) rollover decisions (4.9) plus backdated-edit adjustments (4.10).

**Invariant (must be a unit test and a property test):** sum of `available(e)` over all envelopes = `sum(rolloverIn) + R - sum(spent)` exactly, for every state. Money never appears or vanishes; transfers sum to zero.

### 4.6 The safe-to-spend formula

**Definition.** Safe to spend today = the money in the user's day-to-day (flexible) envelopes, after bills/installments have been funded first and after covering any shortfalls in other envelopes, divided evenly across the days until the next expected income, minus what was already spent today from those envelopes. The naive "remaining / days left in month" is rejected because it ignores pay-cycle position, installments and planned one-offs.

**Horizon.** `H` = number of days from today up to (not including) the next expected steady income date; today counts as one day.

```
function horizon(today, ws, events): { H: int, nextDate: date, mode }
  steady = events of incomes with reliability='steady', status='expected'
  late   = steady events with expectedDate < today and age <= 14 days
  if late is not empty:
      nextDate = ws.lateAssumedArrival if set and >= today else today + 3
      return { H: max(1, nextDate - today), nextDate, mode: 'late' }
  upcoming = steady events with expectedDate >= today, minimal expectedDate
  if upcoming exists (generated up to today+62):
      return { H: max(1, upcoming.expectedDate - today), nextDate: upcoming.expectedDate, mode: 'scheduled' }
  if ws.coverUntil >= today:
      return { H: max(1, ws.coverUntil - today), nextDate: ws.coverUntil, mode: 'cover' }
  // no steady income and no cover date: fall back to the end of the current period
  return { H: max(1, period.endDate - today + 1), nextDate: period.endDate + 1, mode: 'period_end' }
```
- Events older than 14 days past expectation are auto-marked `skipped` and a one-time calm card asks "Did that payment arrive? Add it anytime."
- If an event is expected today and not received, `H = 1` (conservative "last day until payday"); tomorrow it becomes `late` (H = 3 by default).
- **Cover-until (variable income):** when an `uncertain` income is received (or on first run with no steady income) the app asks once: "This should last until...?" with chips 1 week / 2 weeks / 1 month (default) / pick date. The answer sets `ws.coverUntil`. When it passes, the `late` style card asks again. This replaces a salary date for freelancers and is the only extra concept they learn.

**Calculation.**

```
function safeToSpend(ctx): Result            // ctx: today, ws, period, envelopes, available[], events, txns
  // 1. Shortfalls in non-flexible envelopes are real money already used
  D          = sum(max(0, -available[e]) for e where kind in {fixed, pocket, savings})
  bufferAvl  = available[buffer]
  cover      = min(D, max(0, bufferAvl))                 // Buffer silently absorbs them first
  netDeficit = D - cover
  // 2. Day-to-day pool: flexible envelopes net each other (surplus offsets overspend)
  flexPool   = sum(available[e] for e where kind == 'flexible')
  pool       = flexPool - netDeficit
  // 3. Bridge: when no income has arrived yet this period, or an income is late, count the Buffer
  h = horizon(...)
  bridge = ws.bridgeBuffer and (R == 0 or h.mode == 'late')
  if bridge: pool += max(0, bufferAvl - cover)
  // 4. Today
  spentTodayFlex = net (expense - refund) amountBase dated today in flexible envelopes, status posted/pending
  poolStart  = pool + spentTodayFlex                      // the pool as it was at the start of the day
  allowance  = poolStart <= 0 ? 0 : floor(poolStart / h.H)
  leftToday  = max(0, allowance - spentTodayFlex)
  tomorrow   = (h.H > 1 and pool > 0) ? floor(pool / (h.H - 1)) : 0     // shown only when leftToday == 0
  state      = classify(...)                              // see edge cases
  return { leftToday, allowance, pool, poolStart, H: h.H, nextDate: h.nextDate, mode: h.mode,
           D, cover, netDeficit, bridged: bridge, spentTodayFlex, tomorrow, state }
```
- **Excluded from the number on purpose:** Fixed envelopes (reserved), Pocket (the user's own), Savings, and Buffer (except bridging).
- **Planned one-offs and installments** live in Fixed envelopes and are funded first, so they are reserved without a special term. The Why sheet lists "Reserved for bills and installments: X".
- **Moves between flexible envelopes never change the number** (the pool is the sum). Moves from Buffer/Savings/Pocket into a flexible envelope raise it.
- **Hero display:** `floor(leftToday / 10^exponent)` major units, formatted by locale. If `leftToday` < 1 major unit the hero shows 0.

**"Why this number?" (one tap on the hero or its info icon).** A bottom sheet with at most 5 lines, plain arithmetic, in this order (each line shown only if non-zero, except the first three):
1. "Day-to-day money: {pool}" (sub-note: "Food, Transport, Fun" - names of the flexible envelopes).
2. "Days until next income ({nextDate}): {H}".
3. "{poolStart} / {H} = {allowance} a day".
4. "Spent today: {spentTodayFlex}. Left today: {leftToday}".
5. Optional notes, one per applicable case: "Your bills and installments ({reserved}) are already set aside." / "Counting your Buffer while your income is late." / "Pocket was {x} over, covered by Buffer." / "Rounded down so you never overshoot."
Footer link: "Change how this works" -> toggles `bridgeBuffer`.

**Edge cases (normative; each has an AC):**

| Case | Behaviour |
|---|---|
| First day / onboarding | Pool = opening money share (5.1); H from schedule; no history needed. Works with zero transactions. |
| No income received yet this period (cycle start before pay day) | `R == 0` -> bridge counts Buffer; pool shows Buffer-based number; banner "Waiting for payday". |
| Income late (expected date passed, not received) | mode `late`: H = 3 (or user date), bridge on, hero still shows a number, calm card "Salary not here yet? We are counting your Buffer for now." One-tap "It arrived" and "I expect it on..." actions. |
| Income expected today, not received | H = 1; card "Did your salary arrive?" |
| Income arrives | Funding recomputes immediately; card disappears; toast shows the new number. |
| Pool <= 0 (used up) | Hero shows 0; sub-line "Your day-to-day money is used up until {nextDate}"; primary action "Move money" (rebalance, 5.4). No red, no "overspent". |
| Spent more than today's allowance | Hero shows 0; sub-line "Tomorrow's number: {tomorrow}" (when pool > 0). |
| Last day (H = 1) | Hero = whole remaining pool; sub-line "Last day until payday". |
| Negative envelope inside flexible | Envelope row shows "{x} over" neutral tone and "Move money"; the hero is unaffected unless the whole pool is negative (offset by other flexible surplus). |
| Overspent Pocket / Fixed / Savings | Auto-covered by Buffer first (`cover`), remainder reduces the pool; Why sheet states it neutrally. |
| Multi-currency spend | Converted at save to base using the stored/entered rate; hero only ever in base currency. |
| No flexible envelopes | Hero replaced by a card "Add a day-to-day envelope (like Food) to see your daily number." |
| No steady income and no cover date | mode `period_end` (days to end of period) plus a card asking for "last until...". |
| Clock/date change | Everything is a function of `today`; recomputed on resume and at local midnight. |
| Plan edited mid-period | Funding recomputed from facts; hero updates instantly; no history rewritten. |
| Income received different from expected | `P_inc` uses received; Buffer line absorbs the difference (more or less). |

### 4.7 Mid-period plan operations

**Make room(amount, targetEnvelope)** - used when raising an allocation (e.g., adding an installment) beyond the available Buffer line:
1. Take from the Buffer line first: `fromBuffer = min(amount, alloc[buffer])` (buffer shrinks automatically because it is derived).
2. If `amount - fromBuffer > 0`: reduce flexible allocations proportionally (largest remainder), but never below what has already been spent in each envelope this period (floor at `spent[e]`).
3. If still short: the sheet shows one neutral line "Not enough room: X short" and offers "Take from My share / Savings instead" as explicit user choices. **Pocket and Savings are protected: never reduced automatically.** Saving is never blocked; leftover shortfall simply makes the plan over-planned (4.4).

**Fit plan to income:** when over-planned by `x`: reduce in order Buffer (already 0), then Savings allocations (proportional), then flexible (proportional, floored at spent), then fixed commitments are never reduced; Pocket reduced last, only if the user taps "Include My share". One preview, one confirm.

### 4.8 Transfers (rebalance)
`EnvelopeTransfer` moves `amount` from one envelope to another within the current period. It changes `available` of both; sum is zero. Allowed between any two envelopes, any amount > 0 (source may go negative; calm note only). Suggestions (5.4): if a single envelope is negative but the flexible pool is positive: propose from the flexible envelope with the largest surplus (hero unchanged); if the whole pool is <= 0: propose from Buffer, then Savings (never Pocket unless the user picks it). Default amount = shortfall rounded up to the next 10 major units, with +/- 10 stepper and a live preview "Daily number becomes {n}". Undo toast for 8 seconds.

### 4.9 Period close, rollover
- A period leaves `open` at 00:00 local on `endDate + 1` (evaluated when the app opens or resumes). Its state becomes `closing`, a new period is created and opened immediately.
- **Leftover** per envelope = `available(e)` at the end of the closed period (can be negative).
- **Defaults by kind** (the "suggested" rollover; user can toggle each envelope between Keep and To Buffer in the review):
  - fixed -> `to_buffer` (unused bill money is not trapped)
  - flexible ("food-like") -> `to_buffer` ("reset": the envelope starts the new period with its new allocation only; the leftover moves to Buffer so no money disappears)
  - pocket -> `carry` (guilt-free money accumulates)
  - savings -> `carry`
  - buffer -> `carry`
- A **negative** leftover with `to_buffer` reduces the Buffer (it may go negative; a negative Buffer is shown neutrally as "Buffer: -20, refilled first next payday" and is naturally repaid because Buffer is funded as part of tier 2).
- A **negative** leftover with `carry` carries as a negative opening balance.
- `rolloverIn[e](new) = sum over decisions: carry -> own leftover to e; to_buffer -> leftover to the buffer envelope`.
- While `closing`, the decisions are **provisional** (defaults applied live so the hero number is stable). The user confirms with one tap ("Looks good"), or edits toggles first. Auto-confirm with defaults happens 7 days after the new period starts. Confirmation sets `confirmedAt` and period `closed`.
- The review screen is the only place rollover is chosen; it has one primary number: "Left over: {sum of positive leftovers}".

### 4.10 Edits to closed periods
Transactions may be added/edited/deleted at any date <= today. If a change affects a `closed` period, history shows it in that period, and the delta to its envelope's leftover is applied to the CURRENT period's Buffer `rolloverIn` as an automatic adjustment (stored as an `RolloverDecision` adjustment row with note "late edit"). Closed snapshots are not rewritten. If the affected period is `closing`, the provisional leftover simply recomputes.

### 4.11 Recurring and installment posting
- **Auto-post on open (PWA cannot run in the background):** on every app open/resume and at local midnight while open, process all due occurrences with `dueDate <= today` that have no transaction, creating transactions with `date = dueDate`, `source = 'recurring'|'installment'`, `occurrenceDate`, and idempotency on `(ruleId|installmentId, occurrenceDate)`. Catch-up window: max 366 days back; older occurrences are skipped silently.
- `estimate = true` rules post with `status = 'pending'`; the Today screen shows a small neutral card "Utilities posted as an estimate. Confirm or change the amount." (max 1 card, 1 tap to confirm).
- User can "Skip this time" any occurrence (adds to `skippedDates` / marks installment occurrence skipped; removes the transaction if already posted).
- Posting into an envelope uses the stored rate if the rule currency differs from base.
- An installment's effect on the plan is shown at creation (5.7) and through plan creation for next periods (4.4).

### 4.12 Multi-currency rules (exact, V1)
1. A workspace has one **base currency**, chosen at onboarding (default from region/locale). All plan, funding, available and hero math is in base.
2. Any income, expense or commitment may have its own currency. Fields: `amount` (own currency), `currency`, `rate`, `amountBase` (immutable once stored).
3. **Rates are manual and local.** `ws.rates[currency]` stores the last rate used. When entering a foreign-currency transaction: if a stored rate exists it is prefilled and editable inline; if none exists, the rate field is required (calm helper: "How many {base} is 1 {foreign}? Rough is fine."). The rate used is saved back as the stored rate.
4. Changing a stored rate never changes past transactions.
5. Commitments in a foreign currency reserve and post at the rate stored at that time.
6. **Changing the base currency** (Settings): an explicit "Convert my data" operation: the user enters one rate (1 old = X new); an automatic JSON backup is created first and offered for download; every stored `Minor` amount in plan lines, `amountBase`, transfers, rollover, income expected amounts is converted with round half-up; original `amount/currency/rate` fields are preserved on transactions. Confirmation dialog required (irreversible except via restore).
7. No automatic rate fetching in V1. Inflation messaging (Turkey): the Plan screen has no "real terms" display in V1; the response to inflation is cheap re-planning (4.7).

### 4.13 Sync contract (LATER; nothing built in V1, but V1 data must satisfy it)
- Every entity is identified by UUIDv7, carries an `rev` hybrid logical clock, `updatedAt`, `deletedAt` tombstone and `deviceId`. Derived state is never synced.
- Transport (future): `POST /v1/sync/push {workspaceId, changes:[{collection, id, rev, deleted, ciphertext}], cursor}` and `GET /v1/sync/pull?cursor=...`. Server stores opaque ciphertext keyed by (workspace, collection, id, rev); it never sees plaintext.
- Encryption: client-side AES-256-GCM; key derived from a user passphrase (PBKDF2/Argon2id) plus a printable recovery key; losing both = data unrecoverable server-side (stated at setup).
- Conflict policy: per-record last-writer-wins by `rev`; transactions, transfers and income events are append-mostly; delete wins over edit.
- Auth: email or passkey, created only when the user opts in. The app must remain fully functional signed out.

### 4.14 Worked examples (golden test vectors)

All amounts shown in major units for readability; implementation uses minor units. "Display" is the hero (floor to whole major units).

**Example 1 - Azerbaijan, avans + salary, installment (AZN).**
Cycle start day 5 (anchor = salary). Incomes: Salary 1,000 (day 5), Avans 500 (day 20). `P_inc` = 1,500.
Plan: Home 400, Bills 100, Installments 80 (fixed = 580); Food 350, Transport 100, Fun and other 60 (flexible = 510); My share (pocket) 120; Savings 100. Buffer (derived) = 1,500 - 1,310 = 190. T2 (non-fixed) = 510 + 120 + 100 + 190 = 920.
- **Day 5, salary received:** R = 1,000. Fixed funded 580 in full. R2 = 420, f = 420/920. Tier-2 shares in minor units (largest remainder over the group, ties to lowest order): Food 15,979, Transport 4,565, Fun 2,739, My share 5,478, Savings 4,565, Buffer 8,674 (sum 42,000). Flexible funded total = 232.83.
- **Day 8:** the phone installment (80) posted on day 7 and rent paid on day 6 sit in Fixed (funded in full), so they do not touch the number. Flexible spent so far: 54.00 (Food 42, Transport 12). `flexPool` = 232.83 - 54.00 = 178.83. No deficits, income not late, R > 0, no bridge. Next income = avans on day 20: H = 12. Spent today 0 -> allowance = floor(17,883 / 12) = 1,490 minor = 14.90 -> **hero 14**. Later that day the user spends 10.00 on Food: poolStart = 168.83 + 10.00 = 178.83, allowance 14.90, **leftToday = 4.90 -> hero 4**.
- **Day 20, avans received (R = 1,500):** f = 1, every envelope funded to its allocation. Suppose flexible spent to date is 270.00: `flexPool` = 510 - 270 = 240.00. Next income = salary on day 5 of next month (15 days, 30-day month): H = 15, allowance = 16.00 -> **hero 16**. (Daily rate about equal before and after the avans, which is the point of pro-rata tier 2.)

**Example 2 - Turkey, installments, make room (TRY).**
Cycle start 1, salary 40,000 on day 1. Plan: Home 14,000, Bills 3,000, Installments 6,500 (fixed = 23,500); Groceries 7,000, Transport 2,000, Fun and other 1,500 (flexible = 10,500); My share 2,000; Savings 2,000; Buffer (derived) = 40,000 - 23,500 - 10,500 - 2,000 - 2,000 = 2,000. T2 = 16,500.
- **Day 1:** R = 40,000: fixed 23,500; R2 = 16,500 = T2 so f = 1. Pool 10,500, next income day 1 of next month (30-day month): H = 30 -> allowance 350.00 -> hero 350.
- **Day 10:** flexible spent 3,600 -> pool 6,900; H = 21 -> allowance = floor(690,000 / 21) = 32,857 kuruş = 328.57 -> **hero 328**.
- **Add a 4 x 1,250 installment (first due day 15):** Make room 1,250: Buffer line 2,000 -> 750. Fixed alloc (Installments) 6,500 -> 7,750. R2 = 15,250 = T2 (flex 10,500 + 2,000 + 2,000 + 750) so flexible funding is unchanged -> **hero stays 328**. UI says "Your Buffer covers this. Today's number stays 328."
- **Add a second installment of 2,000 per month:** Make room 2,000: Buffer 750 -> 0 (takes 750); 1,250 remaining taken proportionally from flexible allocations (floored at spent): flexible 10,500 -> 9,250 (Groceries 6,167, Transport 1,762, Fun 1,321). Fixed = 14,000 + 3,000 + 9,750 = 26,750. Pool = 9,250 - 3,600 = 5,650; allowance = floor(565,000 / 21) = 26,904 = 269.04 -> **hero 269** (was 328). UI says "Added. Your daily number is 269 now (was 328) because 1,250 moved from your day-to-day money."

**Example 3 - Late income with Buffer bridge (AZN).**
Cycle start 5, salary 1,000 expected day 5. Previous period closed with leftover Food 30, Transport 10 (flexible -> to_buffer) and Buffer available 80, so Buffer `rolloverIn` = 120; My share carried 20, Savings carried 200.
- **Day 7 morning, salary not received:** expectedDate 5 < today 7 -> `late`. Flexible funded 0, rolloverIn 0, spent since day 5 = 18.00 -> flexPool = -18.00. No deficits. Bridge on (late and R = 0): pool = -18 + 120 = 102.00. H = 3 (assumed arrival day 10). allowance = 34.00 -> **hero 34**, with the card "Salary not here yet? We are counting your Buffer for now."
- User taps "I expect it on day 9": H = 2 -> allowance 51.00 -> hero 51.
- **Day 9, salary received:** R = 1,000; funding as in Example 1 style; Buffer still holds its 120; the 18.00 already spent reduces the flexible funded amount; bridge turns off; hero recomputed from the real pool.

**Example 4 - Overspend and rebalance (AZN, continuing Example 1 on day 14).**
Flexible funded 232.83; flexible spent to date 268.00 -> flexPool = -35.17; no bridge (income on time). H = 6 (avans day 20). poolStart <= 0 -> allowance 0 -> **hero 0**, sub-line "Your day-to-day money is used up until Apr 20", action "Move money". The rebalance sheet proposes "Move 40 from Buffer" (shortfall 35.17 rounded up to 40), preview "Daily number becomes 0". Moving 40: pool = -35.17 + 40 = 4.83, allowance 0.80, **hero 0** (the preview says so before saving). The user taps + to raise the amount; Buffer available is 86.74, so the stepper stops there (the sheet says "Buffer has 86.74. Add from Savings too?"). Moving 86.74: pool = 51.57; allowance = floor(5,157 / 6) = 859 minor = 8.59 -> **hero 8**. Transfers never create money, so the amount is capped by the source balance when the source is Buffer or Savings.

**Example 5 - Freelancer cover-until (USD base, EUR income).**
Base USD. Receives 1,200 EUR with stored rate 1.10 -> `amountBase` 1,320.00 USD. Prompt "last until..." -> 1 month = 30 days. Plan: Home 500 (fixed), Food 300, Transport 80 (flexible 380), My share 100, Buffer derived 340. R = 1,320: fixed 500; R2 = 820 = T2 (380+100+340) -> f = 1. Day 1: mode `cover`, H = 30, pool 380 -> allowance 12.66 -> hero 12. On day 31 the cover date passes: mode `late` card "Payment not in yet? We are counting your Buffer for now." (the late rule applies to `coverUntil` the same as to events, H = 3 by default).

---

## 5. Key user flows

### 5.1 First-run onboarding (target <= 60 s; hard cap 5 screens)
No account, no permission prompts, no tutorial carousel. Region is detected from locale region, else time zone (Asia/Baku -> AZ, Europe/Istanbul -> TR); locale language from the device (fallback EN). Currency from region (AZ->AZN, TR->TRY, KZ->KZT, GE->GEL, RU->RUB, US->USD, UK->GBP, euro-zone->EUR, else USD); shown as a tappable chip with a searchable list of ISO currencies.

1. **O1 Welcome (~5 s).** Brand, tagline, language chip (auto), line "Your data stays on this phone." Button "Start". Silently request `navigator.storage.persist()` when the first record is saved (never a prompt).
2. **O2 Income (~15 s).** "How much are you paid?" Amount field (numeric keypad) + currency chip. "How often?" five chips: Once a month (default) / Twice a month / Every 2 weeks / Every week / It varies.
   - Once a month: day-of-month picker (1-31, 29-31 stored as last day).
   - Twice a month: two rows (amount + day each; labelled "First payment" / "Second payment"); the larger is the anchor (tie -> later day). Total = monthly income.
   - Every 2 weeks / Every week: amount per payment, "next payday" date picker; monthly planning figure for the template = amount x 26/12 or x 52/12 (template only; real planning uses actual events).
   - It varies: "About how much per month?" amount; one optional date "Next payment expected?" (default none); sets `uncertain` income and `cover` mode with a default of 30 days.
   Creates the Income schedule(s); anchor sets `cycleStartDay` (day 1 for weekly/biweekly/varies).
3. **O3 Money now (~10 s).** "How much do you have right now to last until payday?" Prefill: if the last pay day was within the last 2 days -> full income; else income x (days to next payday / cycle length) rounded to the nearest 10; user edits; caption "A rough number is fine. You can fix it later."
   - If prefill is accepted (just paid): Period 1 starts on the last cycle start date, income event marked received on that date.
   - Otherwise: **partial first period**: starts today, ends at the next cycle boundary - 1; a received income event "Starting amount" (kind `other`, source manual, name localized) of the entered amount dated today is created; scheduled events are expected from the next boundary on; `scaledFirstPeriod = true` and the first period's plan lines = template amounts scaled by `opening / monthlyIncome` (largest remainder); `masterPlan` stays at full-income amounts.
4. **O4 Plan (~15 s).** Region template with amounts (table below), each row tappable for inline edit. Bottom line "The rest, {x}, goes to your Buffer." Button "Looks good" (the only primary action). A link "Start empty" creates only My share + Buffer + one Food envelope.
5. **O5 Your number (~5 s).** Hero reveal with a one-sentence explanation and a coach mark on "+": "Add your first expense". No push or permission prompts. After the first expense is saved: show the PWA install hint (once) and set the "bills and installments" card on Today.

**Region templates (percent of monthly income; amounts rounded to the nearest 10 minor-major units; localized envelope names; Buffer = remainder):**

| Envelope (kind) | AZ (CIS uses AZ) | TR | GLOBAL |
|---|---|---|---|
| Home - rent & utilities (fixed) | 25 | 28 | 30 |
| Bills - phone, internet (fixed) | 7 | 7 | 8 |
| Installments (fixed) | - | 10 | - (created on first installment) |
| Food (flexible) | 22 | 18 (Groceries) | 15 |
| Transport (flexible) | 8 | 7 | 7 |
| Family and gifts (flexible) | 6 | - | - |
| Fun and other (flexible) | 7 | 5 | 8 |
| My share (pocket) | 6 | 5 | 7 |
| Savings (savings) | 5 | 5 | 15 |
| Buffer (derived remainder) | 14 | 15 | 10 |

Rationale: AZ includes family/gifts (extended-family obligations, analysis section 4); TR carries a 10% installment line so the first taksit has room; GLOBAL is a 50/30/20-flavoured default. At most 8 non-buffer envelopes. Every template satisfies `sum(non-buffer) <= 100%`.

Done criteria: screen count <= 5, median time <= 60 s, no permission dialog, hero visible.

### 5.2 Add expense (2 taps + digits)
1. Today: tap "+" (tap 1). Sheet opens with numeric keypad up, segmented control Expense | Income (Expense default).
2. Type amount. Envelope chip pre-filled with the last used envelope; top-4 most frequent envelopes of the last 30 days shown as chips; "More" opens the full list. Date shows "Today" (tap to change; max = today). Optional: note, currency chip.
3. Tap "Save" (tap 2). Sheet closes, toast "Added {amount} to {envelope}. Undo" (6 s), hero animates to the new number (<= 100 ms for data, animation <= 300 ms), light haptic where supported.
Rules: amount > 0 required; nothing else is required; saving never blocked by budget state. Pocket expense: no category question; the chip is "My share". Foreign currency: tap currency chip -> pick -> rate prefilled/required (4.12). Edit: tap a history row -> same sheet in edit mode; delete -> soft delete + Undo toast.

### 5.3 Receive income
Triggered by a Today card on the expected date and on later days while unreceived ("Did your salary arrive? [Yes, {amount}] [Different amount] [Not yet]"), or manually via "+" -> Income.
1. Tap "Yes, {amount}" -> event `received` today at the expected amount (editable via "Different amount": keypad, currency chip).
2. Creates an income transaction; funding recomputes; toast "Your plan is active. Today's number: {n}." If the income was `uncertain`, immediately ask "This should last until...?" chips (4.6).
3. "Not yet": card hides until tomorrow; from the next day the `late` mode applies (with "I expect it on..." date picker).
Received amount != expected: no warning; Plan screen shows the neutral note "You received {x} (planned {y}). The difference went to your Buffer."

### 5.4 Rebalance on overspend
1. Trigger: hero shows 0 with "Move money", or an envelope row shows "{x} over" with "Move money".
2. Sheet "Move money": To (prefilled with the envelope in need), From (suggested by 4.8), Amount (prefilled, +/- 10 stepper, keypad), preview line "Daily number becomes {n}".
3. Tap "Move" -> transfer saved, toast "Moved {x} from {from} to {to}. Undo" (8 s).
Also available any time from Plan screen ("Move money" button) with no trigger.

### 5.5 End of period
1. On first open after the boundary: Today shows one card "Your period is done. Take a look?" (once; reappears at most daily until confirmed, then stops).
2. Review screen: primary number "Left over: {x}"; list of envelopes with their leftover and the default action chip (Keep / To Buffer); a single sentence "Food starts fresh each period; the rest moves to Buffer."
3. One tap "Looks good" confirms all defaults and starts the new period with the same plan (master plan + new commitments). "Edit" lets the user toggle chips or change the plan before confirming.
4. Auto-confirm after 7 days. Nothing else is required.

### 5.6 Edit plan mid-period
1. Plan tab -> "Edit plan". List of envelopes with amount fields; Buffer line is read-only "The rest: {x}" updating live.
2. Raising an allocation beyond Buffer triggers inline "Make room" (4.7) with a single "Take from Buffer and day-to-day money" button and an explicit preview of the hero change.
3. If over-planned: banner "Plan is {x} above expected income" with "Fit plan to income".
4. Toggle "Also use for next periods" (default on). Save -> applied immediately; toast with hero change if any.
Adding/archiving envelopes is done here as well (archive blocked while balance != 0: Move money opens).

### 5.7 Add installment (taksit)
1. Plan tab -> "+ Bill or installment" -> choose Installment / Repeating bill / One-time planned.
2. Installment: Name, Payment amount (currency chip), Number of payments, First payment date, optional "Already paid: N". Envelope preselected = Installments (created automatically as a fixed envelope if missing).
3. Live summary: "{n} payments of {amount}. Ends {month year}. Total {total}."
4. If this period's allocation does not cover payments due in this period: "Make room" sheet (4.7) with preview "Today's number stays {n}" or "becomes {n}".
5. Save. Future periods include it automatically (4.4). Detail screen allows: edit amount (unpaid only), skip a payment, "Mark all remaining paid / End plan" (cancels future occurrences).
Repeating bill: Name, amount, frequency, due date or day, "Amount varies" toggle (`estimate`). One-time planned: Name, amount, date.

### 5.8 Export, backup, restore
- **Export CSV:** More -> Data -> "Export spreadsheet (CSV)". Options: date range (default All), "Excel (semicolon)" toggle default on for TR/AZ/RU locales. Columns: `id,date,type,amount,currency,rate,amount_base,base_currency,envelope,merchant,note,source,status`. UTF-8 with BOM, ISO dates, dot decimal, RFC 4180 quoting. Delivered with the Web Share API (files) or download.
- **Backup JSON:** "Back up everything". Optional passphrase (AES-256-GCM, PBKDF2-SHA256 >= 600k iterations, random salt/IV stored in file header). File contains `{format:'sakin-backup', schemaVersion, appVersion, exportedAt, checksum(SHA-256 of payload), workspace, envelopes, incomes, incomeEvents, periods, planLines, transactions, commitmentRules, installmentPlans, transfers, rolloverDecisions}`. Records "last backup" date.
- **Restore:** "Restore from backup" -> pick file -> (passphrase if needed) -> validate checksum and schemaVersion (newer-than-app is refused with a calm message; older is migrated) -> preview "{n} entries, {dates}" -> single destructive confirm "Replace data on this phone" -> automatic snapshot of current data kept 7 days for "Undo restore" -> restore in one atomic IndexedDB transaction.
- **Backup status:** Today shows nothing; More -> Data shows "Last backup: {date}"; an in-app card appears if no backup in 30 days and >= 20 entries (max once per 30 days, dismissible).
- V1 limitation (recorded in risks): the PWA cannot write to Drive/iCloud automatically; automatic backup arrives with the wrapper (V1.1).

### 5.9 Change language / currency
- **Language:** More -> Language -> choose EN/RU/TR/AZ -> applies instantly, no restart; dates, numbers, plurals re-render; user-created envelope names are not translated. Default envelope names created from templates are stored as the user's text at creation time.
- **Display of numbers:** by locale (Intl). AZN symbol (U+20BC) and TRY symbol (U+20BA) use a bundled fallback glyph; if glyph unsupported show the ISO code.
- **Base currency:** More -> Currency -> "Change base currency" -> explain in plain words -> enter one rate -> automatic backup -> confirm -> converted (4.12 rule 6).
- **Per-transaction currency:** inline in the add sheet (5.2).

### 5.10 Lock
More -> Security -> "Lock the app": set a 4-6 digit PIN (stored as PBKDF2-SHA256 hash with salt) and optionally "Use fingerprint / face" via WebAuthn user-verification where available. Locks after the app has been in the background > 30 s (options: immediately, 30 s, 5 min). 5 wrong PINs -> 30 s wait, doubling each time up to 15 min. "Forgot PIN" -> explains: "Your data is only on this phone. Erase the app data and restore from a backup." with a clear warning if no backup exists. Lock is an access gate, not at-rest encryption in V1 (stated honestly in Settings help).

---

## 6. Notifications, nudges and tone

### 6.1 Channel decision
V1 is a PWA with no server, so reliable scheduled OS notifications are not available offline (Notification Triggers is not a shipped standard; web push needs a server, which conflicts with local-first). **Decision: V1 nudges are in-app cards only, produced by a rule engine that is channel-agnostic.** In V1.1 (Capacitor wrapper) the same rules feed local OS notifications. This is a consequence of the platform decision, recorded in the change log (end of this section's index).

### 6.2 Nudge rules
Global: max 1 card on Today at a time (priority below); max 1 OS notification per day and 3 per week once available; quiet hours 22:00-08:00; any nudge type is auto-disabled for 30 days after 2 consecutive dismissals without action; no nudge ever mentions overspending, streaks or missed days; every nudge has a visible "Not now" and "Stop these" action; settings has one master switch plus a daily-reminder time.

| Priority | Nudge | Trigger | Frequency cap |
|---|---|---|---|
| 1 | Did your income arrive? | On expected date; again next day if still expected | Max 2 per event, then late card (not a nudge) |
| 2 | Period review ready | First open after boundary | Daily until confirmed, max 7 |
| 3 | Estimate bill posted: confirm amount | Estimate rule posted | 1 per rule per period |
| 4 | Catch-up: "Add what you spent lately in one go?" | 3 consecutive days with no entries | Once per 7 days, stops after 2 ignored |
| 5 | Backup | >= 20 entries and no backup for 30 days | Once per 30 days |
| 6 | Evening reminder (opt-in, default OFF) | User-set time (default 20:30), no entry today | Max 1/day; paused after 3 ignored in a row; skipped if app opened after 17:00 |
| - | "Does today's number feel right?" (thumb up/down) | After 5th active day | Once per 14 days |

### 6.3 Tone-of-voice guidelines
Voice: a calm, practical friend. Facts first, no verdicts, no exclamation marks except greetings, no emojis in money states, short sentences, active voice, second person. Describe the money, not the person. Always pair a limit with the next step. Banned words (lint, per locale equivalents): overspent, exceeded, failed, warning, error (for user input), must, should, mistake, bad, careless, deficit, penalty, streak.

| # | Bad | Good |
|---|---|---|
| 1 | "You overspent on Food by 45 AZN!" | "Food is 45 over. Move money from somewhere else?" |
| 2 | "Warning: budget exceeded." | "Today's money is used up. Tomorrow's number: 12." |
| 3 | "You haven't logged anything in 3 days!" | "Want to add what you spent lately? One total is fine." |
| 4 | "Amazing! 7-day streak!" | "Welcome back. Pick up wherever you like." |
| 5 | "Salary missing. Spending restricted." | "Salary not here yet? We are counting your Buffer for now." |
| 6 | "Error: invalid amount." | "Add an amount to save this." |
| 7 | "You've used 82% of your Fun budget." | "Fun: 12 left." |
| 8 | "Pocket money limit reached." | "My share is empty until payday. It refills on Apr 5." |
| 9 | "Unallocated funds detected! Allocate your income." | "The rest, 190, sits safely in your Buffer." |
| 10 | "Delete this transaction? This cannot be undone." | "Removed. Undo" |

Localization of tone: AZ/TR use informal "sen" form; RU uses "ty" form consistent with peers (informal but polite); a native speaker reviews each locale before launch. Key terms (to be confirmed by native reviewers): Safe to spend today = AZ "Bu gun xerclemek olar" (with proper diacritics in UI), TR "Bugun harcayabilecegin", RU "Mozhno potratit segodnya" (Cyrillic in UI); Buffer = "Ehtiyat" / "Yedek" / "Zapas"; My share = "Menim payim" / "Benim payim" / "Moya dolya".

---

## 7. Acceptance criteria (Given / When / Then)

Numbering: `AC-<area>-<nn>`. QA references these IDs. "Hero" = the safe-to-spend number. Worked examples in 4.14 are the golden vectors.

### Onboarding (ONB)
- **AC-ONB-01** Given a fresh install, When the app opens, Then it shows the Welcome screen with auto-detected language and no permission prompt, account prompt or tutorial carousel.
- **AC-ONB-02** Given onboarding, When the user completes it with defaults, Then it takes at most 5 screens and a scripted run completes in <= 60 s median across 5 testers.
- **AC-ONB-03** Given device locale region AZ, When O2 opens, Then currency defaults to AZN and the AZ template is used at O4; likewise TR->TRY/TR template; unknown region -> USD/GLOBAL template.
- **AC-ONB-04** Given the user chooses "Twice a month" with 1,000 on day 5 and 500 on day 20, When onboarding completes, Then two steady Income schedules exist, the day-5 one is the anchor, `cycleStartDay` = 5, and `P_inc` for the period = 1,500.
- **AC-ONB-05** Given "Every week" with 300 per payment and next payday date, When completed, Then `cycleStartDay` = 1 and the template uses 300 x 52/12 = 1,300 as monthly income.
- **AC-ONB-06** Given the user chose "It varies", When completed, Then the income is `uncertain` and `coverUntil` = today + 30 days unless changed.
- **AC-ONB-07** Given pay day was 10 days ago and the user enters money-now = 400, When completed, Then Period 1 starts today, a received "Starting amount" event of 400 exists, scheduled events begin from the next boundary, and plan lines are the template scaled by 400/monthlyIncome.
- **AC-ONB-08** Given pay day was today, When O3 opens, Then it is prefilled with the full income and, if accepted, Period 1 starts on the last cycle start date with the income event received.
- **AC-ONB-09** Given a template, When O4 shows, Then non-buffer allocations sum <= monthly income, the Buffer line equals the remainder, and tapping "Looks good" lands on Today with a hero number.
- **AC-ONB-10** Given "Start empty", When chosen, Then only My share, Buffer and one Food envelope exist and the hero shows a number once income exists.
- **AC-ONB-11** Given onboarding is done, When the user kills and reopens the app offline, Then all data persists and onboarding does not repeat.

### Hero / Safe-to-spend (HERO)
- **AC-HERO-01** Given Example 1 data on day 8, When Today renders, Then the hero shows 14 and the calculation returns allowance 14.90 (minor units 1,490).
- **AC-HERO-02** Given AC-HERO-01 and a 10.00 Food expense today, When Today renders, Then the hero shows 4 (leftToday 4.90).
- **AC-HERO-03** Given Example 2 day 10, When the user adds the 4 x 1,250 installment with "Make room", Then the hero stays 328; When the second 2,000 installment is added, Then the hero shows 269 and the toast mentions the change.
- **AC-HERO-04** Given Example 3 day 7 (salary late, Buffer 120, spent 18), When Today renders, Then hero = 34 and the late card is shown; When "I expect it on day 9" is set, Then hero = 51.
- **AC-HERO-05** Given the pool <= 0, When Today renders, Then hero = 0, the sub-line states the money is used up until `nextDate`, "Move money" is the primary action, and no red styling or words from the banned list appear.
- **AC-HERO-06** Given today's spend exceeds today's allowance and pool > 0, When Today renders, Then hero = 0 and the sub-line shows tomorrow's number floor(pool/(H-1)).
- **AC-HERO-07** Given H = 1, When Today renders, Then the hero equals the whole remaining pool and the sub-line says it is the last day until payday.
- **AC-HERO-08** Given any hero state, When the user taps the hero, Then the Why sheet opens within 100 ms with the lines defined in 4.6, arithmetic that matches the calculation output exactly, and a footer to toggle the Buffer bridge.
- **AC-HERO-09** Given no income has been received this period and Buffer > 0 and `bridgeBuffer` on, When Today renders, Then the pool includes Buffer and the card "Waiting for payday" is shown.
- **AC-HERO-10** Given `bridgeBuffer` is turned off, When income is late, Then the pool excludes Buffer and the hero reflects that.
- **AC-HERO-11** Given a Pocket envelope overspent by 30 and Buffer available 100, When computed, Then `cover` = 30, netDeficit = 0, the hero is unchanged and the Why sheet says Buffer covered it.
- **AC-HERO-12** Given Pocket overspent by 30 and Buffer 10, When computed, Then netDeficit = 20 reduces the pool by 20.
- **AC-HERO-13** Given one flexible envelope at -20 and another at +50, When computed, Then flexPool = +30 (they offset), the negative envelope row shows "20 over" neutrally, and a "Move money" action is offered.
- **AC-HERO-14** Given a foreign-currency expense, When saved, Then the hero reduces by `amountBase` only and displays in base currency.
- **AC-HERO-15** Given no flexible envelopes, When Today renders, Then the hero is replaced by the "Add a day-to-day envelope" card.
- **AC-HERO-16** Given no steady income and no coverUntil, When Today renders, Then H = days to period end + 1 and a "last until..." card is shown.
- **AC-HERO-17** Given the device date passes midnight while the app is open, When the next minute ticks or the app resumes, Then the hero recomputes for the new day (spentToday resets).
- **AC-HERO-18** Given any state, When rendering, Then the hero is the only element with the primary-number type size (DR-1) and is rounded down to whole major units.
- **AC-HERO-19** Given income expected today and not received, When computed, Then H = 1 and the "Did your salary arrive?" card shows; Given it is still not received tomorrow, Then mode = `late` with H = 3.
- **AC-HERO-20** Given an expected event more than 14 days overdue, When the app opens, Then it is marked `skipped` and a one-time calm card is shown.
- **AC-HERO-21** Property test: for random states, the funding invariant (sum of available = rolloverIn + R - spent) holds, `leftToday >= 0`, and moving money between flexible envelopes never changes `allowance`.

### Income (INC)
- **AC-INC-01** Given an expected event on today's date, When Today renders, Then the "Did your salary arrive?" card shows with Yes / Different amount / Not yet.
- **AC-INC-02** Given the user taps "Yes", When saved, Then the event is `received` at today's date and expected amount, an income transaction exists, funding recomputes, and the toast shows the new hero.
- **AC-INC-03** Given "Different amount" 900 for an expected 1,000, When saved, Then `P_inc` uses 900, the Buffer line shrinks by 100, and a neutral note appears on Plan.
- **AC-INC-04** Given "Not yet", When tapped, Then the card hides until the next day and funding is unchanged.
- **AC-INC-05** Given an ad hoc income added via "+" -> Income, When saved, Then it funds the current period and increases `P_inc` (Buffer line grows).
- **AC-INC-06** Given an `uncertain` income received, When saved, Then the "last until..." prompt appears once and sets `coverUntil`.
- **AC-INC-07** Given an income in USD with no stored USD rate in an AZN workspace, When saving, Then the rate field is required and saved as the stored rate.
- **AC-INC-08** Given a monthly schedule on day 31, When a 30-day month occurs, Then the expected date is the last day of the month.
- **AC-INC-09** Given a biweekly schedule, When events are generated, Then they occur every 14 days from `refDate` for the next 62 days, idempotently.

### Envelopes and plan (PLAN)
- **AC-PLAN-01** Given a plan with non-buffer sum 1,310 and `P_inc` 1,500, When displayed, Then Buffer allocation = 190 and the screen says the rest goes to the Buffer.
- **AC-PLAN-02** Given non-buffer sum > `P_inc`, When displayed, Then Buffer = 0 and the neutral "Plan is X above expected income" line with "Fit plan to income" appears; saving is not blocked.
- **AC-PLAN-03** Given Example 1 day 5, When funding is computed, Then flexible funded = 232.83 with Food 159.79, Transport 45.65, Fun 27.39 (largest remainder) and Buffer funded 86.74.
- **AC-PLAN-04** Given R < fixed total, When computed, Then only fixed envelopes are funded, pro-rata, and flexible funded is 0.
- **AC-PLAN-05** Given R > total planned, When computed, Then the surplus is added to Buffer.
- **AC-PLAN-06** Given the user edits an allocation mid-period, When saved, Then the hero updates instantly and past transactions are unchanged.
- **AC-PLAN-07** Given "Make room 2,000" with Buffer 750 (Example 2), When applied, Then Buffer allocation becomes 0, flexible allocations reduce by 1,250 proportionally with largest remainder (Groceries 6,167, Transport 1,762, Fun 1,321), Pocket and Savings are unchanged.
- **AC-PLAN-08** Given an envelope with spent 900 and "Make room" would reduce its allocation below 900, When applied, Then it is floored at 900 and the remainder is taken from other flexible envelopes.
- **AC-PLAN-09** Given "Fit plan to income" with a 100 over-plan, When confirmed, Then Savings reduce first, then flexible, never fixed, never Pocket unless "Include My share" is chosen, and the preview shows the hero change.
- **AC-PLAN-10** Given a new envelope is added, When saved, Then it appears in the plan with allocation 0 and the Buffer line unchanged.
- **AC-PLAN-11** Given archiving an envelope with balance != 0, When tapped, Then "Move money" opens and archiving completes after the balance is moved.
- **AC-PLAN-12** Given the Buffer envelope, When the user tries to delete or archive it, Then the action is unavailable; rename is allowed.
- **AC-PLAN-13** Given Plan tab, When rendering, Then each non-buffer envelope shows planned, spent and available with a neutral bar (no red) and Pocket shows only "available".
- **AC-PLAN-14** Given a new period, When created, Then plan lines copy `masterPlan` and fixed envelopes are raised to cover commitments due in the period.
- **AC-PLAN-15** Given "Also use for next periods" off, When saved, Then `masterPlan` is unchanged.

### Expenses, history (EXP)
- **AC-EXP-01** Given Today, When the user taps "+", types an amount and taps "Save", Then the entry is saved with the last-used envelope and today's date in <= 2 taps excluding digits.
- **AC-EXP-02** Given the add sheet, When amount is empty or zero, Then Save is disabled with the hint "Add an amount to save this."
- **AC-EXP-03** Given an expense saved, When the toast shows, Then Undo within 6 s removes it completely (soft delete) and the hero returns to its prior value.
- **AC-EXP-04** Given the date picker, When opened, Then dates after today are not selectable.
- **AC-EXP-05** Given an expense in a closed period is edited, When saved, Then the closed snapshot is unchanged and the delta is applied to the current period's Buffer rolloverIn (4.10).
- **AC-EXP-06** Given History, When opened, Then entries are grouped by day (newest first), each row shows envelope, amount (base primary, original secondary if foreign), and a source icon; the list virtualizes smoothly with 5,000 entries.
- **AC-EXP-07** Given History filters, When the user filters by envelope, date range or text (note/merchant), Then results update within 200 ms on 5,000 entries.
- **AC-EXP-08** Given an expense deleted, When Undo is not tapped, Then it is retained as a tombstone for 30 days and excluded from all calculations and exports (exports include only non-deleted).
- **AC-EXP-09** Given two transactions with the same `(source, sourceRef)`, When imported, Then the second is rejected as a duplicate.
- **AC-EXP-10** Given a refund transaction exists (model support), When spent is computed, Then it reduces the envelope's spent.
- **AC-EXP-11** Given an expense in a foreign currency with rate 1.10, When saved, Then `amountBase` = round-half-up(amount x 1.10) and is not altered when the stored rate later changes.
- **AC-EXP-12** Given an expense in Pocket, When saved, Then no category is asked and no alert or colour change occurs even if Pocket becomes negative.

### Pocket (POC)
- **AC-POC-01** Given the Pocket envelope, When Today renders, Then a small chip shows "My share: {available}" (secondary size) and tapping opens its detail.
- **AC-POC-02** Given Pocket available <= 0, When displayed, Then it shows "Empty until payday. Refills {date}." and never uses red or shaming copy.
- **AC-POC-03** Given the user hides Pocket on Today, When set, Then the chip is hidden but the envelope still functions and is excluded from the hero.
- **AC-POC-04** Given the period closes, When the review shows defaults, Then Pocket's default action is Keep (carry).

### Recurring and installments (REC / INS)
- **AC-REC-01** Given a monthly bill due on day 12, When the app opens on or after day 12, Then exactly one transaction dated day 12 exists with source `recurring` and the correct envelope.
- **AC-REC-02** Given the app was not opened for 40 days, When opened, Then all missed occurrences within the 366-day window are posted once each with their original due dates.
- **AC-REC-03** Given reopening the app repeatedly, When processing runs, Then no duplicates are created (idempotent on rule+occurrenceDate).
- **AC-REC-04** Given an `estimate` rule, When posted, Then status is `pending`, counts as spent, and an Today card asks to confirm or edit; confirming sets `posted`.
- **AC-REC-05** Given "Skip this time" on an occurrence, When confirmed, Then no transaction exists for it and it is not re-posted.
- **AC-REC-06** Given a commitment rule, When the envelope picker opens, Then only fixed envelopes are offered.
- **AC-REC-07** Given a one-time planned item dated in 5 days, When the period plan is created/edited, Then the fixed allocation covers it and it is not counted as a flexible expense.
- **AC-INS-01** Given a new installment of 4 payments of 1,250 first due on the 15th, When saved, Then 4 occurrences exist on consecutive months with day clamped to month length, total 5,000 is displayed, and payments post on due dates.
- **AC-INS-02** Given "Already paid: 2" of 6, When saved, Then occurrences 1-2 are marked paid with no transactions and 3-6 are scheduled.
- **AC-INS-03** Given an installment due in the current period without enough allocation, When saving, Then the Make-room sheet appears with the preview of the hero change (Example 2).
- **AC-INS-04** Given the final payment posts, When processed, Then the plan status becomes `done` and stops appearing in the active list.
- **AC-INS-05** Given "End plan", When confirmed, Then future occurrences are cancelled, posted history remains.
- **AC-INS-06** Given the next period is created, When plan lines are built, Then the Installments envelope allocation is at least the sum of payments due in it.
- **AC-INS-07** Given an installment in USD in an AZN workspace, When a payment posts, Then `amountBase` uses the stored USD rate at posting time.
- **AC-INS-08** Given an installment with first due date on the 31st, When months have fewer days, Then the payment falls on the last day of that month.
- **AC-INS-09** Given a fixed envelope with active commitments, When the user tries to change its kind, Then it is blocked with "Move your bills first".

### Rebalance (REB)
- **AC-REB-01** Given hero = 0 due to pool <= 0, When "Move money" is tapped, Then the sheet prefills To = a flexible envelope, From = Buffer, Amount = shortfall rounded up to the next 10, with a preview "Daily number becomes {n}" equal to the recomputed hero.
- **AC-REB-02** Given an envelope at -20 and another flexible at +50, When "Move money" is tapped from the negative row, Then From is the flexible envelope with the largest surplus and the preview shows the hero unchanged.
- **AC-REB-03** Given the stepper, When + or - is tapped, Then amount changes by 10 major units and the preview updates; the amount is capped by the source's available balance only when the source is Buffer or Savings, with a calm explanation.
- **AC-REB-04** Given Move is tapped, When saved, Then an `EnvelopeTransfer` exists, sum of available is unchanged, and an 8 s Undo is offered.
- **AC-REB-05** Given Example 4, When the user moves 40 then increases to the Buffer cap 86.74, Then the previews equal 0 and 8 respectively.
- **AC-REB-06** Given the transfer is undone, When Undo is tapped, Then balances and hero return to the earlier values.

### Period and rollover (PER)
- **AC-PER-01** Given the clock passes `endDate`, When the app opens, Then a new period exists with the master plan, the old one is `closing`, and no data is lost.
- **AC-PER-02** Given the app is unused for 3 months, When opened, Then all intermediate periods are created, each with its commitments posted, and the user is offered one combined review.
- **AC-PER-03** Given the review, When the user taps "Looks good", Then rollover decisions are confirmed with defaults (fixed/flexible -> Buffer, Pocket/Savings/Buffer carry) and the period becomes `closed`.
- **AC-PER-04** Given Food leftover 30 with default To Buffer, When confirmed, Then the new period's Food `rolloverIn` is 0 and Buffer `rolloverIn` increases by 30.
- **AC-PER-05** Given the user toggles Food to Keep, When confirmed, Then Food `rolloverIn` = 30.
- **AC-PER-06** Given a negative leftover of -20 in Food with To Buffer, When confirmed, Then Buffer `rolloverIn` decreases by 20.
- **AC-PER-07** Given no action for 7 days, When the 7th day passes, Then defaults auto-confirm.
- **AC-PER-08** Given `closing` state, When the hero is computed, Then it uses provisional rollover from defaults and does not jump on confirm when defaults are accepted.
- **AC-PER-09** Given the cycle start day is changed in Settings, When applied, Then the current period is unchanged and the next boundary uses the new day.
- **AC-PER-10** Given history, When opened on Plan -> Past periods, Then closed periods list planned vs spent per envelope as read-only summaries.
- **AC-PER-11** Given the review, When shown, Then it has exactly one primary number ("Left over") and one primary button.

### Multi-currency (CUR)
- **AC-CUR-01** Given a workspace in AZN, When adding an EUR expense with no stored rate, Then rate is required before Save enables.
- **AC-CUR-02** Given a stored rate exists, When adding a foreign expense, Then the rate is prefilled and editable and the edited rate becomes the new stored rate.
- **AC-CUR-03** Given Settings -> Change base currency, When confirmed with rate 0.59, Then an automatic backup is created and offered, all base-amounts convert with round-half-up, originals remain on transactions, and sum-of-available invariant still holds within 1 minor unit per entity (documented tolerance from rounding).
- **AC-CUR-04** Given Example 5, When income 1,200 EUR at 1.10 is saved, Then `amountBase` = 1,320.00 USD and hero = 12.
- **AC-CUR-05** Given any screen with totals, When rendering, Then totals are shown in base currency; foreign amounts appear only as secondary text on rows.

### Lock (LOCK)
- **AC-LOCK-01** Given lock is enabled, When the app returns from background after the chosen delay, Then the lock screen appears before any financial data is rendered (including app switcher preview blank).
- **AC-LOCK-02** Given a wrong PIN is entered 5 times, When attempting again, Then a wait of 30 s applies and doubles per extra series up to 15 min.
- **AC-LOCK-03** Given biometric is enabled and available, When the lock screen shows, Then the biometric prompt appears; if cancelled, PIN entry is available.
- **AC-LOCK-04** Given "Forgot PIN", When tapped, Then the erase-and-restore explanation shows and erasing requires a destructive confirm.
- **AC-LOCK-05** Given the PIN, When stored, Then only a salted PBKDF2 hash is persisted (never the PIN).

### Export / backup / restore (DATA)
- **AC-DATA-01** Given CSV export, When generated, Then it has the specified columns, UTF-8 BOM, ISO dates, dot decimals, opens correctly in Excel/Sheets, row count equals non-deleted transactions in range.
- **AC-DATA-02** Given "Excel (semicolon)" on, When exported, Then delimiter is `;`.
- **AC-DATA-03** Given a backup without passphrase, When restored on a clean install, Then the entire state (all entities) is identical and the hero equals the pre-backup value.
- **AC-DATA-04** Given a passphrase backup, When restored with the wrong passphrase, Then restore fails with a calm message and no data changes.
- **AC-DATA-05** Given a backup with a newer `schemaVersion`, When restored, Then it is refused with the message to update the app; with an older version it is migrated.
- **AC-DATA-06** Given a corrupted file (checksum mismatch), When restored, Then it is refused and nothing changes.
- **AC-DATA-07** Given a successful restore, When done, Then a pre-restore snapshot is retained for 7 days and "Undo restore" brings it back.
- **AC-DATA-08** Given a restore fails mid-way (simulated), When the transaction aborts, Then the database is unchanged (atomicity).
- **AC-DATA-09** Given 20+ entries and no backup for 30 days, When Today renders, Then a single dismissible backup card shows at most once per 30 days.
- **AC-DATA-10** Given first save, When storage is persisted, Then `navigator.storage.persist()` was requested and its result is recorded; if denied, More -> Data shows a calm "Back up regularly" note.

### Language / locale (LOC)
- **AC-LOC-01** Given EN/RU/TR/AZ, When switching language, Then all UI strings change instantly with no restart and no untranslated keys (CI check fails on missing keys).
- **AC-LOC-02** Given RU, When counts are shown ("1, 2, 5 entries"), Then plural forms follow CLDR (one/few/many/other).
- **AC-LOC-03** Given the TR/AZ/RU locales, When amounts render, Then decimal comma and locale grouping are used; AZN and TRY symbols render via the fallback glyph where fonts lack them.
- **AC-LOC-04** Given a pseudo-locale with +40% string length and `dir=rtl`, When the app renders, Then no clipping, no horizontal scroll and layout mirrors (logical CSS properties only).
- **AC-LOC-05** Given a banned-word lint, When run in CI on all locale files, Then there are zero hits.

### Platform / PWA / layout (PWA)
- **AC-PWA-01** Given the app is installed, When the device is offline (airplane mode), Then every V1 feature works.
- **AC-PWA-02** Given a service worker update, When available, Then it activates on next launch without data loss and a migration test passes.
- **AC-PWA-03** Given a 360x640 phone viewport, When using the app, Then there is no horizontal scroll and touch targets >= 48 dp.
- **AC-PWA-04** Given width >= 840 px, When rendering, Then the two-pane layout shows (left: Today + Plan; right: History/detail) with a navigation rail.
- **AC-PWA-05** Given a reference low-end Android (2 GB RAM), When cold starting with 5,000 transactions, Then hero renders in <= 2.0 s and save-to-UI update <= 100 ms.
- **AC-PWA-06** Given a network trace of a 10-minute session, When captured, Then it contains zero requests to third-party hosts and none carrying user data.
- **AC-PWA-07** Given the accessibility audit, When run, Then WCAG AA contrast, screen-reader names for hero/Why/FAB/sheets, and 200% font scale pass.
- **AC-PWA-08** Given a user action writes multiple records (e.g., installment + plan lines), When it fails midway, Then no partial state persists (single IndexedDB transaction).

### Nudges (NUD)
- **AC-NUD-01** Given several nudges are eligible, When Today renders, Then only the highest priority one shows.
- **AC-NUD-02** Given a nudge is dismissed twice consecutively, When next eligible, Then it is suppressed for 30 days.
- **AC-NUD-03** Given the master switch is off, When any trigger occurs, Then only safety-critical cards (income arrived? and period review) remain, as passive cards without sound.
- **AC-NUD-04** Given any nudge copy, When linted, Then none contains banned words or streak language.
- **AC-NUD-05** Given evening reminder opt-in and an entry already made today, When 20:30 passes, Then no reminder is produced.

### Stats / privacy (PRIV)
- **AC-PRIV-01** Given a fresh install, When telemetry is queried, Then no event leaves the device until the user opts in on day 3+ prompt.
- **AC-PRIV-02** Given opt-in, When events are sent, Then payloads contain only whitelisted event names, counts, app version, locale and a random install ID, and never amounts, names, notes, envelope names or merchants.
- **AC-PRIV-03** Given Settings -> My stats, When opened, Then it shows only on-device figures (days with entries, entries this period) with no comparison or grade.

---

## 8. Success metrics

### 8.1 Definitions
- **Activated (A1):** onboarding complete AND at least 1 expense saved within 24 h of first open.
- **Habit-activated (A2):** entries on >= 3 distinct days within the first 7 days.
- **Time-to-first-expense (TTFE):** first open timestamp to first expense saved timestamp (on-device, aggregated only if opted in).
- **Entry day:** a calendar day (by creation date) with at least 1 user-created expense or income (auto-posted recurring entries do not count).
- **Tracked-day rate:** entry days / days since first open, for habit-activated users in days 8-30.
- **Retention:** user opens the app on day N (opt-in cohort; cross-checked with store-console retention).

### 8.2 Targets (ambition; benchmarks from the analysis are unverified, so targets are reviewed after 8 weeks of data)

| Metric | Target |
|---|---|
| Onboarding completion (of installs that open) | >= 75% |
| Median onboarding time | <= 60 s |
| Activation A1 | >= 60% of onboarded users |
| Habit-activation A2 | >= 30% of onboarded users |
| Median TTFE | <= 90 s; p90 <= 4 min |
| D1 retention | >= 35% |
| D7 retention | >= 22% (A2 users >= 45%) |
| D30 retention | >= 11% (A2 users >= 30%) |
| Tracked-day rate (A2 users, days 8-30) | >= 50% |
| "Today's number feels right" thumbs-up share | >= 80% |
| Why-sheet open rate (trust-curiosity indicator) | 15-40% of weekly actives (too low = not discoverable; too high = number not trusted) |
| Period review completion within 3 days | >= 70% |
| Users with >= 30 days that took a backup/export | >= 40% |
| Crash-free sessions | >= 99.5% |
| Data-loss reports | 0 |

### 8.3 What we measure and where
- **On-device only (always, never transmitted):** all of the above computed locally for "My stats" (days with entries, entries this period, last backup date) and for local diagnostics.
- **Opt-in anonymous counters (asked once after day 3, default off, easy to revoke):** event names `onboarding_done`, `first_expense`, `daily_open`, `why_opened`, `period_review_done`, `backup_done`, `lang_changed`, `feedback_thumb`; plus app version, locale, region (country-level from locale), random install ID, day-since-install bucket, counts (not values). No IP storage beyond transient request handling. No third-party analytics SDK.
- **Store-level (no consent needed):** installs, uninstalls, store-console retention, crashes (platform vitals).
- **Never measured or collected:** amounts, balances, income, envelope names or counts, merchants, notes, exact dates of entries, contacts, location, advertising IDs, the content of any backup.

---

## 9. Risks, mitigations and assumptions

### 9.1 Risks

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R1 | Manual-entry fatigue kills retention (analysis theme #1) | High / High | 2-tap entry, last-used envelope, auto-posting bills and installments, catch-up nudge accepting one lump total, no streak penalty, V1.1 paste-bank-message and QR scan |
| R2 | Users distrust the daily number (Simplifi precedent) | Medium / High | Why sheet with plain arithmetic, golden-vector tests, invariant property tests, conservative rounding down, thumbs feedback, mode banners (late / waiting) instead of silent changes |
| R3 | PWA data loss (browser storage eviction, cleared site data) | Medium / Very high | `storage.persist()`, install prompt, backup cards, "Last backup" status, one-tap export, restore tested, wrapper (V1.1) with file-based auto-backup; do not market "never lose data" until wrapper |
| R4 | PWA cannot send reliable OS notifications / widgets | High / Medium | In-app nudge design, wrapper in V1.1 for notifications and Android widget |
| R5 | PIN lock is only a gate, not at-rest encryption | Medium / Medium | State plainly in Settings help; passphrase-encrypted backups; revisit encrypting IndexedDB with a PIN-derived key in V1.1 |
| R6 | SMS/notification capture policy rejection (Google Play) | Medium / Medium | Not in V1; paste-bank-message in V1.1; Android capture V2, on-device only, shipped as a separate permission build if declined |
| R7 | Bank/super-app (Kaspi, Birbank, Revolut) copies the "daily number" | Medium / Medium | Cross-bank, cash-inclusive, installment-aware, private; speed to polish and trust; later aggregator integration instead of competing with feeds |
| R8 | Low willingness to pay in home market | High / Medium | Near-zero serving cost (local-first); PPP tiers; Plus features limited to multi-device/cloud value; free core is an acquisition strength |
| R9 | Complexity creep from edge cases (multi-currency, installments, late income) | Medium / High | Fixed rules in section 4; explicit not-building list; one primary number per screen (DR-1); feature requests must cite a persona job |
| R10 | Localization quality (AZ/TR/RU tone) damages trust | Medium / Medium | Native reviewer per locale before launch; banned-word lint; glossary; pseudo-locale tests |
| R11 | Inflation in Turkey makes plans stale quickly | High (TR) / Medium | Mid-period edit + make-room + fit-to-income in one screen; monthly period with quick copy-forward |
| R12 | Name/trademark conflict | Medium / Low | Name is a string; fallback list (1.1) |
| R13 | Estimation of avans/salary prevalence in AZ unverified (analysis open item) | Medium / Low | Product does not depend on it; supports 1, 2, weekly, biweekly, varying incomes |
| R14 | Azerbaijan fiscal QR payload may lack item-level data | Medium / Low | QR is V1.1 after a spike; model already supports `source: qr` |

### 9.2 Assumptions decided by the team (no founder input needed)

1. Retention and activation targets are ambition numbers; they will be recalibrated after the first 8 weeks of real opt-in data.
2. A budget period is always one month long; sub-monthly periods are not offered (rationale 4.3).
3. The anchor income is the larger steady income (tie -> later day); cycle start default = its pay day (days 29-31 map to last day).
4. Weekend/holiday shift of pay days is not modelled in V1; the 3-day late grace and "I expect it on..." cover it.
5. "Reset" rollover means the leftover moves to Buffer rather than vanishing; money is conserved.
6. Fixed envelopes are funded first, all other envelopes pro-rata; this order is a model assumption justified by Example 1 and should be validated in usability tests with avans+salary users.
7. Buffer is counted into the daily number only while income is late or not yet received (bridge), user-toggleable.
8. A negative Buffer is allowed and repaid naturally by next period's tier-2 funding.
9. Pocket and Savings are protected from automatic reduction; the user can always choose to take from them.
10. One pocket envelope per workspace in V1; couples use two workspaces later or a V2 shared budget.
11. The late-income assumed arrival is 3 days; events more than 14 days overdue are auto-skipped.
12. Rates are manual in V1 to preserve offline/local-first; online refresh is V1.1 and optional.
13. Installments are interest-free for planning (user enters the actual per-payment amount, which already includes interest).
14. Auto-posting runs on app open/resume (PWA limitation); the effect is identical to scheduled posting because entries are back-dated to the due date.
15. The PIN is a UI access gate in V1; at-rest encryption is not claimed.
16. Telemetry is opt-in only; retention numbers come from the opt-in cohort and store consoles, so absolute values will be biased and are used for trends.
17. Region templates are product defaults, not financial advice; the app shows no investment or financial advice anywhere.
18. Expense categories are the envelopes themselves; there is no second taxonomy.
19. Entity IDs, HLC `rev` and tombstones are included in V1 storage purely to keep sync additive later.

### 9.3 Change log versus the lead's decisions

| Lead decision | Status | Change and reason |
|---|---|---|
| 1 Hero formula | Refined, not overridden | Pool = flexible envelopes only, bills/installments funded first (so reserved implicitly), shortfalls covered by Buffer, Buffer bridged only when income is late or unreceived, today's spend handled as "start-of-day pool" so the number does not shrink as the day goes on. Reason: makes the formula implementable and testable and avoids double-counting. |
| 2 Buffer | Kept | Buffer is derived, never typed. |
| 3 Capture ladder | Kept | `source` enum includes all; V1.1 adds paste-bank-message (new, policy-safe) ahead of QR. |
| 4 Overspend | Kept | Envelope-level overspend inside flexible is netted automatically; explicit rebalance for Buffer/others. |
| 5 Late income | Kept and made exact | Late mode with 3-day assumed arrival and Buffer bridge; funding is derived from receipts. |
| 6 Rollover | Kept with interpretation | "Reset" = leftover moves to Buffer (money conserved); negative leftovers hit Buffer. |
| 7 Local-first, lock, export | Kept with one change | Automatic encrypted backup moved to V1.1 (wrapper) because a PWA cannot write to Drive/iCloud on its own; V1 has manual backup, persistence request and reminders. PIN is a gate, not encryption, in V1. |
| 8 Installments first-class | Kept | Plus recurring and one-time planned items as commitment rules in Fixed envelopes. |
| 9 Languages, multi-currency | Kept | Manual/stored rates only in V1; base currency conversion is an explicit operation. |
| 10 Monetisation | Kept | Free vs Plus table; QR, paste-bank-message and Android capture stay free because they fight churn and cost nothing to serve. |
| 11 PWA | Kept with one consequence | Reliable scheduled OS notifications are not possible in a no-server PWA, so V1 nudges are in-app cards; OS notifications arrive with the wrapper. |
| 12 Period | Decided | Monthly pay cycle, user-selectable start day, default = anchor pay day; horizon-based daily number (4.3). |

### 9.4 Glossary (for developers and translators)
- **Envelope:** a named bucket of money; also the category of a transaction.
- **Plan:** the amounts allocated to envelopes for one period.
- **Fixed / Flexible / Pocket / Buffer / Savings:** envelope kinds (4.2).
- **Funded:** the part of an allocation that real received income has activated.
- **Available:** rollover in + funded + transfers in - transfers out - spent.
- **Pool:** the day-to-day money used for the hero.
- **Horizon (H):** days from today until the next expected steady income.
- **Bridge:** counting Buffer into the pool while income is late or not yet received.
- **Commitment:** a recurring bill, one-time planned item or installment payment due on a date.
- **Make room / Fit plan to income:** the two mid-period plan helpers (4.7).
