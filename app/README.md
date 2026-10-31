# Sakin ("Pul Planım") - local-first budgeting PWA

Tells you how much you can safely spend today. Private, offline, no account, no bank login.
Product name lives in one place: `brand.name` in `src/i18n/*.ts` (EN/RU/TR "Sakin", AZ "Pul Planım"); manifest name in `vite.config.ts` (brand-neutral "Sakin"; tab title, description and iOS title are localized at runtime in `App.tsx`).

## Run
Requires Node 20+ (built and tested on Node 24, npm 11).

    npm install
    npm run dev          # dev server
    npm run build        # tsc typecheck + production build (+ service worker)
    npm run preview      # serves dist at http://127.0.0.1:4173
    npm test             # Vitest (354 tests, incl. payment categories: domain, payments engine, income list, early income, locale number formats, overspend wording, randomized invariants, data layer + sample data, migrations, lock, History query, i18n)
    npm run test:e2e     # builds, then 39 Playwright tests in headless Chromium on port 4180 (see below)
    npm run test:all     # lint + unit + e2e
    npm run lighthouse   # Lighthouse mobile + desktop against a local preview (fetches the CLI with npx)
    npm run lint         # typecheck + i18n catalog checks (keys, placeholders, plurals, banned words)
    npm run icons        # regenerate PNG icons

One-time for e2e: `npx playwright install chromium` (about 150 MB). The e2e suite serves the production build with
`vite preview` on port 4180 (4173 is the launcher, 5173 the dev server) and covers: service worker + offline reload,
installability, update without data loss, CSP, zero third-party requests, PIN/biometric lock (Chromium virtual
authenticator), two tabs, axe-core accessibility, 360 px, 200% text, 5,000-entry performance (writes
`e2e/.results/perf.json`). Deployment, headers and the security review: `../docs/05-delivery-and-security.md`.

Non-developers: double-click `start-app.cmd` (installs, builds, starts, opens http://localhost:4173; `localhost` matters because fingerprint/face unlock does not work on 127.0.0.1).

## Architecture (module diagram)

    src/domain/      PURE TypeScript. No React, no DB, no clock (today is passed in), no strings.
      types, dates, money (BigInt-exact conversion, largest-remainder)
      funding (derived Buffer, tiered funding) -> safe (horizon, safe-to-spend)
      engine (period snapshot, rollover chain, period lifecycle)   <- single source of every derived number
      schedule (income events, recurring, installments, posting)   planops (make room, fit plan, templates)
      payments (Payments panel: loan status from real payments, confirm/auto mode, waiting items, reservations, interest share)
      rebalance (suggest/cap/preview)   onboarding (income specs, money-now, first period)
    src/data/        Dexie (IndexedDB). repo.ts = all writes (atomic), loadAll() = read model,
                     backup.ts (JSON v1, SHA-256, AES-GCM/PBKDF2, atomic restore, 7-day undo), csv.ts, lock.ts, seed.ts (demo)
    src/state/       model.ts (live query -> Engine -> Model), prefs.ts (localStorage), ui.tsx (hash router, sheets, toast, confirm)
    src/i18n/        typed catalogs en/az/tr/ru, plural via Intl.PluralRules, Intl formatting
    src/ui/          primitives, Sheet/Dialog/Toast, NumberPad, display (Money, EnvelopeRow, Progress, Horizon)
    src/screens/     Today(+Hero, Why), AddSheet(+Move), Plan(+Envelope), History, Income, Payments, Review, Settings, Lock, Onboarding

    UI -> state/model -> data/repo (Dexie) -> domain (pure)      domain never imports upward

Derived values (funded, available, safe-to-spend) are never stored; they are recomputed from facts on every change.
Money is integer minor units; BigInt for rate conversion and pro-rata. Entities carry UUIDv7, rev (HLC-like), soft delete.

## Decisions and the 8 design-spec reconciliations (spec 03 section 12)
1. Hero formula: product spec 4.6 wins (pool = flexible envelopes, Buffer bridge only when income late/unreceived, floor rounding). Pocket excluded in both. Why sheet follows product lines 1-5 in the designer's plain-language style; line 1 shows the start-of-day pool so the printed arithmetic always adds up.
2. Default envelopes/split: product regional templates (AZ/TR/GLOBAL) replace the designer's 10/10 default. Buffer is the derived remainder in both.
3. Period model: monthly pay cycle with horizon-to-next-income (product 4.3).
4. Scope: everything in v1 is built; scan/voice entry points are absent (flag-gated, no dead buttons).
5. Terminology: "envelope" kept (zərf/zarf/конверт). Pocket is "My share / Mənim payım / Benim payım / Моя доля" (product), not "My pocket money".
6. Tablet: breakpoint 840 px (product AC-PWA-04) instead of 905; rail + two-pane as designed. Left pane = compact hero + envelope list; right = routed content.
7. Quick-save is an off-by-default setting. Overspend suggestion order follows product 4.8 (largest flexible surplus when pool positive, else Buffer, then Savings). Toast durations: 6 s add, 8 s move/overspend (product), not 8 s everywhere.
8. No Plus gating anywhere; no paywall; `hasEntitlement` is not needed in v1 (nothing gated).
Other: PIN is 4-6 digits and lock delays are immediately/30 s/5 min (product); AZ/TR use informal "sən/sen" (product 6.3) instead of the designer's AZ "siz"; copy "Your money should last..." was reworded because "should" is on the banned list.
Refinements (with reasons): template rounding step adapts to small incomes (10/5/1 major units) so rows are not all zero; envelope rows show plan-based "left" while no income has been received (otherwise every row would look overspent before payday); late-edit adjustments are stored as rollover rows applied to the current Buffer (4.10); multiple unconfirmed periods are confirmed together by one "Looks good".

## Payments panel (decisions)
A first-class "Payments" tab (Ödənişlər / Ödemeler / Платежи) replaces "Coming up" (`#/coming...` redirects). Full description, ACs and status: `docs/04-build-notes.md`, section "Payments panel".
- **Confirm mode by default** for new bills and loans: on the due date they wait under "Waiting for you" until "I paid" (amount editable, date, envelope, note, undo) or "Skip". The money stays reserved in the fixed envelope meanwhile, so today's number does not move when you confirm. Per payment, "Record automatically on the due date" switches to the old auto-posting (direct debits). Existing data keeps auto mode (migration IndexedDB v3, backup schemaVersion 2).
- **Loans and installments are counted from real payments** (`src/domain/payments.ts`): left to repay = payment x count - (paid before + linked payments). Extra payments shorten the term (same monthly amount, earlier payoff); partial payments leave the difference owed (smaller last payment); a skip keeps the amount owed (one more payment at the end); overpaying beyond what is left is capped and the rest is saved as a normal expense. Interest is optional and informational (simple monthly amortization with a rate, contract share without one).
- Payee ("to whom or where") is free text with suggestions from earlier payees; CSV export has `payee` and `payment_type` columns.
- "Remaining debt" is worded "Left to repay" (the banned-word lint forbids "debt"); the AZ Bills envelope template is now "Kommunal" so it does not clash with the tab name.
- Amount fields use `parseAmountInput` (never NaN, never throws): a lone "." or "," just keeps Save disabled; "," and "." are both accepted as decimal.

## Payment categories: envelope = category (decisions)
Full description, ACs and status: `docs/04-build-notes.md`, section "Payment categories". Pure logic: `src/domain/categories.ts`.
- **An envelope is the category.** No second category/tag system: a payment's category is the envelope it is paid from, so the Plan and the Payments panel can never disagree. Envelopes that are a ready-made payment category carry a stable `categoryKey` (housing, utilities, phone, loans, installments, subscriptions, insurance, education, other); at most one live envelope per key, so a category is never duplicated.
- **Ready-made categories are offered, not forced.** The payment form's envelope chooser lists your envelopes first, then the not-yet-created categories as lighter dashed "suggested" chips (loan form: Loans, Installments; bill form: the other seven), then "+ New envelope". A suggested category becomes a real (fixed) envelope only when a payment is saved into it, so the Plan is not flooded. An archived envelope with that key comes back instead of a twin.
- **Inline "+ New envelope"** in the payment form (kind fixed) and the add-expense sheet (chip row and "All envelopes" list; kind flexible): one small sheet asking only for a name; the icon is suggested from the name and can be changed. Decision: the envelope is a draft until the form is saved and is written in the same step, so cancelling the form leaves nothing behind and one Undo removes the payment/expense, the envelope and any plan change. Typing the name of an envelope you already have selects that one.
- **Money stays conserved.** A new fixed envelope's plan for the current period is what the payment needs this period, through the existing "make room" step (Buffer first, then day-to-day envelopes, never Savings/My share); the step shows today's number before/after. A new flexible envelope starts at 0 (nothing moves, today's number does not change). Undo restores the period plan lines and the master plan exactly.
- **Auto-suggest while typing** name or payee: (1) the person's own earlier choice for the same payee, then the same name, when it was always the same envelope; (2) a local keyword table in EN/AZ/TR/RU, case- and diacritic-insensitive ("qaz", "işıq", "su", "kirayə", "kredit", "taksit", "Netflix", "sığorta", "bağça", "kurs", "газ", "аренда", ...). Words of 3 letters or fewer must be whole words ("su" never matches "sushi"); loans/installments outrank product words ("Telefon taksiti" = installment). Ambiguous input ("Internet su") never auto-picks. The pick shows a "Suggested" badge and one line of why; one tap on another chip overrides it, and editing a payment never re-suggests.
- **Payments panel "By date | By category".** By date (the existing grouping) is the default; the type filter became a light chip row under the switch. By category: one row per envelope with payments, monthly total (weekly x52/12, yearly /12, plus active loans' monthly payment) and, when it has repeating items, the yearly total ("₼32/ay · ildə ₼384"; loans count only what is still due in the next 12 months); one-time payments are shown apart ("Birdəfəlik: ₼450"). Tap opens that envelope's payments; "All categories" goes back. "Still to pay this period" stays the only primary number. Deep link `#/payments/category`.
- **Existing users keep their envelopes:** IndexedDB v4 and backup schemaVersion 3 infer the key from the template names in four languages ("Kommunal"/"Faturalar"/"Счета"/"Bills" -> utilities, "Ev" -> housing, "Taksitlər" -> installments), then keywords, then the icon; names are never changed; v1/v2 backups still import. CSV has a new last column `category` (the key).
- **Deliberately NOT built:** sub-categories, multiple tags per payment, coloured labels, a category on everyday expenses separate from their envelope.

## Number formats and income list (walkthrough pass)
- Money is formatted by the app, not by the browser ICU (`NUMBER_SPECS` in `src/i18n/index.tsx`): AZ `1.500,50 ₼`, TR `₺1.500,50`, RU `1 500,50 ₽`, EN `$1,500.50`.
- Onboarding step 1 and the Income add/edit sheet share one equal-rank income row editor (`src/screens/IncomeRows.tsx`); the domain takes a list (`OnboardInput.incomes`).
- A pay received up to 10 days early belongs to its own period (`isEarlyIncome`, `src/domain/engine.ts`). Status of every walkthrough item: `docs/07-expert-walkthrough.md` section 7.

## What is NOT done / limitations (honest list)
- Verified only in headless Chromium on Windows (service worker, offline, install criteria, update, lock with a virtual authenticator, performance with CPU throttling). Not run on real phones: low-end Android, iOS Safari (install, storage eviction), real fingerprint/face hardware, a screen reader.
- Performance: with 5,000 entries cold start to hero is 117 ms (x1 CPU) to 551 ms (x6); save-to-UI is 18 / 37 / 73 ms at x1 / x4 / x6 (budget 100 ms, met; one optimistic update instead of a second reload). Headless Chromium with CPU throttling, not a real phone. See `docs/04-build-notes.md` (Final pass).
- History is a windowed list above 120 rows (day headers are not sticky in that mode).
- The PIN is a UI gate, not encryption; WebAuthn here proves presence only (no server to verify a signature). See the security review.
- OS notifications, thumbs-up card, auto cloud backup, paste-bank-message, QR, voice: not built (v1.1 / reserved). The evening reminder exists as an in-app card only (opt-in, off by default).
- Telemetry: opt-in switch only; there is no sender in v1 (payload gate is built and tested).
- Envelope "remove" is archive (balance must be zero); nothing is hard-deleted. Rate refresh is manual.
- RTL: no RTL language ships; with dir=rtl set by hand the layout mirrors (logical properties) and amounts stay left-to-right isolates; checked by eye on a phone viewport, not by a native RTL reader.
- Translations are not native-reviewed (the overspend wording "over what is available" is new in all four languages); no usability test with real users yet; no screen-reader session.
- Payments panel: no OS reminders on due dates (in-app only); interest is an estimate, not a bank statement; a loan's remaining amount does not shrink by interest saved through early repayment (edit the plan if the bank recalculates); not checked by a native reader in RU/TR.
- Payment categories: the keyword table is hand-made (about 250 words) and not native-reviewed; suggestions run only in the payment form (not for everyday expenses); By category totals are in the base currency at the stored rates.
- Dev helpers (`__axe`, `__audit`, `__go`, `__walk` in `src/dev/axe.ts`) exist only in the dev server, never in the production build. `__walk` taps buttons and can mark income as received in the sample data.
