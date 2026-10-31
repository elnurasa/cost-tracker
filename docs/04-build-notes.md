# Build notes (04) - Sakin v1 app

App: `app/` (see `app/README.md`). Date: 2026-10-30.

## Verification actually run
- `npm test`: 11 files, 188 tests, all green (final pass, 2026-10-30; was 10 files / 185) (domain golden + edge + calendar/DST/leap-year, randomized conservation, data layer on fake-indexeddb, schema migration, backup corruption, PIN/WebAuthn logic, History query benchmark, i18n lint).
- `npm run test:e2e`: 28 tests (final pass; was 26) in real headless Chromium 156 (Playwright) against the production build: service worker, offline, install, update, CSP, no network, locks incl. a virtual WebAuthn authenticator, two tabs, accessibility, 5,000-entry performance. All green. Details in "Engineering completion" below.
- `npm run build`: tsc strict (0 errors) + Vite build OK, no warnings (INEFFECTIVE_DYNAMIC_IMPORT and the 500 kB chunk warning are gone); PWA precache 26 entries, 705 KiB. `npm run lint` = typecheck + i18n checks.
- Browser (in-app pane, Windows): phone 390x844 and tablet 1024x768; light and dark; EN, TR, AZ. Walked: sample data, real onboarding (5 screens, AZ template), Today hero + Why sheet (hero 21 = Why "21.66 a day"), add expense (hero/envelope updated live), plan, history, income, coming up, settings (data/currency/lock/stats). No app console errors.
- Fixed from findings: number pad lost fast keystrokes; AZ dates rendered "M10" (ICU data) so AZ uses own month/weekday names; stray text on welcome; language chips clipped.
- Earlier in-pane gap (service worker refused by the pane) is now closed by Playwright/Chromium (see below). Still NOT verified: real phones (Android low-end, iOS Safari install), real fingerprint/face hardware, a screen-reader pass, RU visual pass, the six usability tasks with real users (tasks 1,2,3,5 were walked by the developer only), a hosted deployment with the real headers.

## AC coverage
Legend: I = implemented, P = partial, N = not implemented. T = unit/integration test evidence; B = seen in browser.

| AC | Status | Note |
|---|---|---|
| ONB-01 | I B | Welcome, auto language, no prompts/carousel |
| ONB-02 | P B | 5 screens; 60 s median untested with users |
| ONB-03 | I T | region/currency detection, templates |
| ONB-04 | I T | twice a month, anchor, cycle day 5 |
| ONB-05 | I T | weekly x52/12, cycle day 1 |
| ONB-06 | I T | uncertain income, coverUntil +30 d |
| ONB-07 | I T | partial first period, starting amount, scaled plan |
| ONB-08 | I T | prefill full income, period on cycle start |
| ONB-09 | I T B | sums <= income, Buffer remainder |
| ONB-10 | I | start empty: My share + Food + Buffer |
| ONB-11 | I T | persistence (IndexedDB) |
| HERO-01..04 | I T | golden examples 1-3 exact |
| HERO-05 | I T | used-up state; move action; no red |
| HERO-06 | I T | tomorrow shown |
| HERO-07 | I T | last day |
| HERO-08 | I T B | Why sheet, bridge toggle; arithmetic shows start-of-day pool |
| HERO-09 | I T | waiting card + bridge |
| HERO-10..12 | I T | bridge off, Buffer cover, net deficit |
| HERO-13 | I T | flexible netting; a row says "over what is available" (not "over plan"): the over amount is measured from what is funded, tested (`overspend.test.ts`) |
| HERO-14 | I T | amountBase only |
| HERO-15 | I | no-flexible card |
| HERO-16 | I | period_end + cover card |
| HERO-17 | I | today ticker (30 s + resume) |
| HERO-18 | I | one hero-size element per screen (tablet shows it in left pane only) |
| HERO-19, 20 | I T | H=1 then late H=3; stale auto-skip (one-time stale card not built: P) |
| HERO-21 | I T | 400-case property test |
| INC-01..05 | I T | card, yes/different/not yet, ad hoc |
| INC-06 | I | cover prompt after uncertain income |
| INC-07 | I T | rate required |
| INC-08, 09 | I T | clamp, biweekly idempotent |
| PLAN-01, 02 | I T | derived Buffer, over-planned + Fit |
| PLAN-03 | I T | 159.79/45.65/27.39, Buffer 86.74 |
| PLAN-04, 05 | I T | funding tiers |
| PLAN-06 | I T | live recompute |
| PLAN-07, 08 | I T | make room (6,167/1,762/1,321), floor at spent |
| PLAN-09 | I T | fit plan order |
| PLAN-10 | I | new envelope allocation 0 |
| PLAN-11 | I T | archive blocked with balance (UI and repo guard), opens Move; archive drops the master-plan line, next period does not fund it, totals conserved (tested) |
| PLAN-12 | I | Buffer cannot be archived/deleted |
| PLAN-13 | I B | planned/spent/available + neutral bar; pocket shows available |
| PLAN-14, 15 | I T | period plan from master + commitments; also-next toggle |
| EXP-01 | I B | + , digits, Save |
| EXP-02 | I | Save disabled with hint |
| EXP-03 | I T B | undo soft-delete |
| EXP-04 | I T | date max = today |
| EXP-05 | I T | late-edit delta to current Buffer |
| EXP-06 | I T B | grouped by day; windowed list above 120 rows: 5,700 rows -> 17 DOM rows at rest, 32 max while scrolling; scroll p95 17.8 ms (CPU x1) |
| EXP-07 | I T B | filter on 5,000: 0.1-0.3 ms in the query layer, 4 ms keystroke-to-DOM in Chromium (55 ms at CPU x6); 20,000 rows 0.7 ms |
| EXP-08 | I T | tombstones 30 d, excluded from calc/export |
| EXP-09 | I T | dedupe |
| EXP-10 | I T | refund model (toggle in add sheet) |
| EXP-11 | I T | round half up, immutable |
| EXP-12 | I | no category, no alert on pocket |
| POC-01..04 | I | chip row on Today, empty copy, hide setting, carry default |
| REC-01..03 | I T | posting, 366-day catch-up, idempotent |
| REC-04 | I T | pending estimates + Today card |
| REC-05 | I T | skip occurrence |
| REC-06, 07 | I | fixed envelopes only; one-offs covered via plan |
| INS-01, 02, 04, 05, 06, 07, 08 | I T | schedule, paid-before, done, end plan, plan lines, FX at posting, clamp |
| INS-03 | I B | Make-room step at save (browser flow not walked); the AZ/RU/TR templates now include an Installments envelope and the sample shows one installment falling due in 5 days |
| INS-09 | I | blocked, toast "Move your bills first" |
| REB-01..06 | I T | suggestion, stepper cap, preview, undo (browser UI not walked) |
| PER-01, 02 | I T | periods created; combined review confirms all |
| PER-03..06 | I T | defaults, Keep, negative leftover |
| PER-07 | I T | auto-confirm after 7 d |
| PER-08 | I T | provisional = confirmed |
| PER-09 | I T | cycle day change |
| PER-10 | I | Past periods read-only |
| PER-11 | I | one number, one primary button |
| CUR-01, 02, 04 | I T | |
| CUR-03 | I T | convert + auto backup download; rounding tolerance (n/2 minor units per item) property-tested |
| CUR-05 | I | totals in base |
| LOCK-01 | I | lock before render; shield on hide (device switcher blank not verified) |
| LOCK-02, 05 | I T B | backoff 30/60/.../900 s, PBKDF2 hash + salt only, constant-time compare, clock set back cannot extend the wait; unit tests + e2e |
| LOCK-03 | I T B | register + auto prompt on the lock screen + cancel falls back to PIN, verified with Chromium's virtual authenticator; NOT on real fingerprint/face hardware |
| LOCK-04 | I | forgot flow + destructive confirm |
| DATA-01, 02 | I T | CSV |
| DATA-03..08 | I T | backup/restore, passphrase, newer/corrupt, undo, atomic; hand-forged files with a valid checksum are stopped by structure validation; a failure mid-restore rolls everything back (tested) |
| DATA-09 | I | card (30 d cap) |
| DATA-10 | I B | persist() requested on first save and again at each launch until granted; quota errors surface as a calm toast; Chromium headless answers 'denied' (expected without engagement) |
| LOC-01 | I T | typed catalogs + test |
| LOC-02 | I T | CLDR plurals RU |
| LOC-03 | I B | e2e renders EN/AZ/TR/RU: html lang, no placeholder leaks, no overflow; AZ keeps its own formatter because Chromium's az ICU data is thin |
| LOC-04 | I T B | +40% text and dir=rtl: no horizontal scroll on 6 screens (e2e); final pass: looked at Today, Add sheet, Plan, History, Income, Coming up, Settings with dir=rtl in the pane: layout mirrors (logical CSS properties already used everywhere); fixed amounts rendering as "119,60-" and "0 SYMBOL" (money, hero and amount display are now direction: ltr isolates) and the chip-row fade direction. Not reviewed by a native RTL reader |
| LOC-05 | I T | banned-word lint EN/AZ/TR/RU |
| PWA-01 | I B | e2e: SW registers, precache 26 entries, offline reload, add expense offline, data survives reload, every route works offline, cold offline start in a new tab; Chromium installability errors = [] |
| PWA-02 | I T B | e2e v1->v2: new SW waits, card shows, data intact, Update serves v2; IndexedDB v1->v2 migration test; backup migration chain test |
| PWA-03 | I B | e2e at 360x640: no horizontal scroll on 12 screens, every control >= 44 px; switches are now 52x44 real hit areas (visual track unchanged), number chips >= 44 wide |
| PWA-04 | I B | two-pane at >= 840 |
| PWA-05 | P B | 5,016 entries, headless Chromium, final pass: hero 117 / 318 / 551 ms at CPU x1/x4/x6 (budget 2.0 s: met); save-to-UI 18 / 37 / 73 ms (budget 100 ms: met at all three; was 58 / 180 / 275). No real 2 GB Android measured |
| PWA-06 | I B | e2e: a full session makes 49 requests, all GET to our origin, no body, no query string; foreign hosts are blocked and counted (0) |
| PWA-07 | P T | axe-core WCAG 2.2 A/AA: 0 violations on 13 screens, light and dark; 200% text: no overflow; Lighthouse accessibility 100. No screen-reader session was run |
| PWA-08 | I T | atomic() for installment+plan |
| NUD-01, 02 | I | priority order; 2 dismissals = 30 d |
| NUD-03 | I | master switch keeps income/review |
| NUD-04 | I T | lint |
| NUD-05 | I T | in-app card on Today, opt-in (default off), time setting (20:30), hidden when an entry exists today, max 1/day, paused after 3 ignored, quiet hours 22:00-08:00, master switch; OS notification is out of scope in v1 (PWA cannot schedule one reliably) |
| PRIV-01 | I | opt-in only, nothing sent |
| PRIV-02 | I T | v1 has no transport (endpoint is null, flush returns 'disabled', CSP connect-src 'self'); the payload gate (whitelisted events, integer counts, version, locale, random install id) is built and tested so a future sender cannot leak amounts or names |
| PRIV-03 | I | My stats |

## Engineering completion (engineering agent, 2026-10-30)

Everything below was run, not assumed. Browser engine: Playwright 1.x headless Chromium 156 on Windows 11 (no Browser pane used). Repeat with `npm run test:e2e` (builds, serves `vite preview` on port 4180). Raw results: `app/e2e/.results/perf.json`, `lh-mobile.json`, `lh-desktop.json` (git-ignored, regenerated).

### Closed
| Item | What was done | Evidence |
|---|---|---|
| Offline + service worker | Registered on the production build, controls the page, precache 26 entries / 705 KiB; offline reload, add-expense offline, every route offline, cold offline start | `e2e/offline.spec.ts` |
| Installability | Manifest fields, icon sizes read from the PNG headers, Chromium `Page.getInstallabilityErrors` = [] | `e2e/install.spec.ts` |
| Update without data loss | A second build is served; new SW waits (prompt mode), "A new version is ready" card, Update activates it, data intact | `e2e/update.spec.ts` |
| IndexedDB migrations | Dexie v1 -> v2 (adds `meta`, backfills `status`/`deletedAt`), tested with a real v1 database; higher-version DB opens without data loss; backup `schemaVersion` migration chain | `src/data/robust.test.ts` |
| Backup robustness | Size cap, strict structure validation (shapes, enums, integer money, unique ids, dangling references, exactly one Buffer) that still holds when a forger recomputes the checksum; restore is one transaction and rolls back on any failure or quota error | `robust.test.ts` |
| Storage | `persist()` at first save and at each launch until granted; a Dexie middleware turns QuotaExceededError into one calm toast (`sys.storageFull`, 4 languages) | `robust.test.ts`, `e2e/tabs.spec.ts` |
| Tabs | Live query across tabs (write in A shows in B with no reload); 4 parallel `runMaintenance` calls and 3 tabs opening at once create no duplicates | `robust.test.ts`, `e2e/tabs.spec.ts` |
| Engine edge cases | Pay day 28-31, leap years incl. 2100, 8 years of period tiling for 8 cycle days, installments starting on the 31st, yearly Feb 29; DST gaps/repeats in 5 zones and 10 instants, the period chain is identical in 6 zones; device clock moved back never deletes or double-posts | `src/domain/calendar.test.ts`, `robust.test.ts` |
| Money invariants | 14 seeded random 34-step simulations (spend, refund, move, receive, confirm, late edit, delete, installments, archive): money in all envelopes == everything received - everything spent, after every operation, across rollovers; transfers zero-sum; installment totals exact; conversion rounding within n/2 minor units | `src/data/invariants.test.ts` |
| History | Windowed list (rows above 120), pure query module, folded search index. Numbers in the table (EXP-06/07) | `src/screens/history.test.ts`, `e2e/perf.spec.ts` |
| Remove envelope | Decision: remove = archive, never hard delete (history and closed periods must stay intact). Repo refuses unless the balance is zero, drops the master-plan line, `buildPeriodPlan` never funds an archived envelope again (before this, an archived envelope kept silently absorbing plan money) | `robust.test.ts` |
| Evening reminder (NUD-05) | `domain/nudges.ts` (pure), `state/evening.ts`, a card in Today's single-card slot, a toggle + time input in Settings, 4 languages | `robust.test.ts` |
| PRIV-02 | Payload whitelist gate, no transport | `robust.test.ts`, `e2e/network.spec.ts` |
| Lock | PIN unit tests (salted hash, fresh salt each time, series 30/60/120/240/480/900/900 s, correct PIN refused during a wait, clock set back clamped, constant-time compare); WebAuthn flow tests with a mock; browser tests with Chromium's virtual authenticator (auto prompt, cancel -> PIN) | `lock.test.ts`, `e2e/lock.spec.ts` |
| A11y | axe-core WCAG 2.0-2.2 A/AA, 13 screens x light/dark: 0 violations; 360x640; 200% text; +40% pseudo text with dir=rtl | `e2e/a11y.spec.ts` |
| Bundle | Lazy routes (History, Settings, Income, Coming, Review), vendor chunks, no warnings. Main chunk 568 kB -> 126 kB (react 140, dexie 99, shared UI + catalogs 159, gzip total about 160 kB); precache 751 -> 705 KiB (unused Onest subsets skipped) | `npm run build` |
| Lighthouse 13.6 (headless shell, local preview) | mobile and desktop: performance 100, accessibility 100, best practices 100, SEO 91 -> fixed `robots.txt` (was served as the SPA fallback); FCP 0.8 s / LCP 0.8 s / TBT 0 ms / CLS 0 mobile. Lighthouse 12+ has no PWA category, so PWA is covered by the installability check above | `npm run lighthouse` |

### Measured performance (5,016 entries, headless Chromium, desktop CPU, throttled with CDP)
| | CPU x1 | CPU x4 | CPU x6 | Budget |
|---|---|---|---|---|
| Cold start to hero in the DOM | 113 ms | 327 ms | 609 ms | 2,000 ms |
| Save click to hero updated | 58 ms | 180 ms | 275 ms | 100 ms |
| History rows (all time) / DOM rows at rest | 5,705 / 17 | 5,710 / 17 | 5,695 / 17 | |
| Scripted fast scroll, frame p95 / worst | 18 / 33 ms | 51 / 109 ms | 81 / 124 ms | |
| Type in search, list updated | 4 ms | 40 ms | 55 ms | 200 ms |
The table above is the earlier run. Final pass (after the single-update rewrite, same test): cold start 117 / 318 / 551 ms, save click to hero updated 18 / 37 / 73 ms at CPU x1 / x4 / x6 (see "Final pass"). CPU throttling is an approximation of a low-end phone, not a measurement on one.

### Real defects found and fixed by this work
1. Tapping "received" twice (double tap, or the card open in two tabs) counted the pay twice: `receiveIncome` is now idempotent.
2. Archived envelopes kept being funded from the master plan in later periods (money vanished into an invisible envelope).
3. WebAuthn cannot work on `http://127.0.0.1` (IP addresses are invalid RP IDs), and `start-app.cmd` opened that address: it now opens `http://localhost:4173`.
4. A failed restore was reported as "not a backup"; it now says "storage full" or "could not save".
5. Dexie 4 silently adopts a higher native version; documented and tested instead of assumed to throw.

### Still open
- Real-device checks: low-end Android (save-to-UI at x4 is 180 ms, over budget), iOS Safari install and storage eviction, real fingerprint/face, a screen-reader session, RU visual pass.
- (closed in the final pass) Save-to-UI: expense saves now update the UI once, optimistically (see "Final pass").
- Language catalogs for all four locales are in one 159 kB chunk; loading only the active catalog would trim the first load.
- (closed in the final pass) Switch hit area is now 52x44.
- (closed in the final pass) A sheet opened right after "Try with sample data" is no longer lost (e2e sample.spec.ts).
- Native review of translations, usability tests with real users, store packaging (see `docs/05-delivery-and-security.md`).

## Known issues
- Demo data uses the detected currency (USD in the test browser) with AZ template names in English; fine for review, not localized beyond labels.
- Toast sits close to the tab bar on small phones.
- Translations were produced by the team, not native-reviewed (product spec requires native review before launch). Flagged keys: nav.plan "Planım" (AZ/TR), RU masculine past tense in a few "ты" sentences, AZ `settings.passphrase`.
- "Not done" list: see README.

## Next steps (highest value first)
1. Repeat the offline/install/performance checks on a real low-end Android and on iOS Safari (engine-level checks pass, see Engineering completion).
2. Run the six design-spec usability tasks with real users in AZ/TR/RU; native-review translations.
3. Trim save-to-UI on slow CPUs (see Still open) and the V1.1 items (backup reminder to file, paste-bank-message).

## UX polish pass (design agent)
Changed: locale defaults (browser language list, Asia/Baku or az -> Azerbaijani market + AZN, tr -> TRY, ru -> RUB; user can change); AZ-realistic sample data (maaş 1,100 + avans 500, prices scaled per currency in `data/seed.ts`); onboarding step 1 hint no longer overlaps the number pad; boot skeleton + critical CSS in `index.html` (no white/dark flash), app waits up to 600 ms for the Onest font; skeleton splash; overspend bar now always shows the hatched segment (scale = what is actually available); toast wraps long actions; segmented control, tab bar and body text wrapping fixed at 200% text; 44 px segmented and switch hit areas; page h1 on Today; blanket reduced-motion rule; theme-color follows manual theme; PIN nudge hidden in sample mode.
Bug fixed: `ConfirmDialog` ran the modal hook while closed, so `body.modal-open` (scroll lock) was set permanently and focus handling misfired; now mounted only when open, with a modal counter.
Tooling: `axe-core` devDependency; in dev, `await __axe()` audits the screen, `__audit()` checks tap targets/clipping/overflow, `__go('plan')` navigates (src/dev/axe.ts, never in production build).
Verified in the live app: axe (WCAG 2.2 AA + best-practice) = 0 violations on Today, Plan, History, Income, Coming, Settings, Settings/data, light and dark, phone (375) and 1024x768; tap-target/clipping audit in AZ, RU at phone width; 200% root font size on phone; onboarding AZN flow end to end; add expense, overspend toast, Move sheet, Escape/focus return.
Not verified: real device, offline/SW, screen reader, EN/TR visual walk of every sheet (audit-only), install prompt, usability tasks 3 and 6 end to end by hand. Known at that time: an overspent row could read "350 of plan, 285 spent, 95 over" while only part of the plan was funded; and a transient "I18nProvider missing" after HMR edits (dev-only). Both fixed in the final pass.

## Final pass (lead engineer, 2026-10-30)

### What changed
1. **Overspend wording.** The over amount is measured against what is available (funded plus carried and moved money), never against the plan: with only the first of two pays received, "of 350 planned, 285 spent" can already be over. Rows, envelope detail and the save toast now say "X over what is available" (EN), "Mövcud məbləğdən X artıq" (AZ), "Kullanılabilir tutardan X fazla" (TR), "Сверх доступного: X" (RU); the plan is labelled "of X planned" / "planda X" / "по плану X". Test: `src/domain/overspend.test.ts` (28,500 spent of 35,000 planned with 15,979 funded is over by 125.21 yet under plan; wording check in 4 languages).
2. **Taksit first-class.** The AZ template (also used for RU/CIS) gets an "Installments" envelope (7 %, calendar icon; TR already had one; GLOBAL keeps on-demand creation from Coming up). The sample data now has the phone installment, 2 of 6 paid, with the 3rd due in 5 days, so Today (Soon card), Plan (Installments row) and Coming up show it. Tests: template sum 93 %, `data.test.ts` sample test, e2e `sample.spec.ts`.
3. **Save-to-UI.** An expense save builds the row, shows it at once from memory (`patchWithTransaction`, called by `addTransaction` right before the write) and the live query then replaces it with the database truth; a failed write rolls the optimistic copy back. No second `loadAll()`. 5,016 entries, headless Chromium, `e2e/perf.spec.ts` now asserts < 100 ms at every throttle: **18 / 37 / 73 ms at CPU x1 / x4 / x6** (was 58 / 180 / 275). Also fixed: the hash hand-off '' -> '#/today' after sample data no longer closes an open sheet (same route is ignored).
4. **Switches** are 52x44 real buttons; the 52x32 track is drawn by ::before, so the look is unchanged. Day-of-month chips are at least 44 wide (the tap audit had found 38-42 px).
5. **Dev-only "I18nProvider missing"** after hot reload: the context is pinned on globalThis in dev, `useI18n` falls back to English in dev instead of throwing, and the error boundary clears itself on the next HMR update. Probed by editing `i18n/index.tsx` live: no error screen.
6. **Hard-coded strings.** Default income name ("Income") is now `income.other` in the workspace language; "+" / "-" icon labels are "Increase / Decrease" in 4 languages (`a11y.increase`, `a11y.decrease`); the `index.html` meta description is brand-neutral and the document title, description and iOS home-screen title are set at runtime per language; the manifest keeps the brand-neutral name "Sakin" and no English description (a static manifest cannot follow the in-app language). A received pay in History and Today is titled with its income name (Salary, Advance), not "Other income".
7. **Identity.** Tab title and iOS title follow the locale rule (Pul Planım in AZ, Sakin elsewhere; seen in the pane). PNG icons regenerated: round line caps like the SVG, thicker wave, 4x4 supersampling (crisp at 192/512; maskable keeps the safe zone); apple-touch-icon is the full-bleed square (no black corners on iOS). Theme colors checked against tokens: manifest background #F2F5F3 = --color-bg, theme #0F6B63 = brand, dark meta #12302C = dark hero; the boot skeleton matches both.

### Visual walk (live app, Browser pane, dev server)
A dev-only crawler (`await __walk()`, src/dev/axe.ts) opened every route and every sheet reachable by a plain button (Add/Edit entry, Why, Move, filters, envelope detail, New envelope, New installment, installment detail, income edit/add, Settings pages) and checked horizontal overflow, controls under 44 px, clipped text and controls outside the viewport. Result: 0 findings (after fixing the chip widths) in EN phone 375x812 light and dark (plus axe on 7 screens, light: 0 violations); TR phone light and dark; AZ tablet 1024x768 light and 768x1024 dark; RU tablet 768x1024 light and dark and 1024x768 light and dark. Sample data was recreated per language so envelope names are native.
RTL (LOC-04): dir=rtl set from the console on TR phone, 30 screens and sheets: no overflow; the eye check found and fixed amounts ordering (see AC table). The attribute was never committed.
Limits: pane screenshots are small (about 172 px wide), so fine visual detail was judged from structural checks and coarse screenshots, not pixel-peeping. The crawler can tap "mark as received"; the final sample data was recreated afterwards.

### Commands run (final)
- `npm run lint`: tsc 0 errors + i18n checks, 2 files / 27 tests pass.
- `npm test`: 11 files, 188 tests pass.
- `npm run test:e2e`: build + 28 tests pass (2.5 min), including perf at CPU x1/x4/x6, axe on 13 screens light/dark with 0 violations, offline, install, update, lock, network.
- `npm run build`: tsc + Vite OK, precache 26 entries (709 KiB).
- `npm run lighthouse` (13.6.0, local preview, re-run to confirm the robots.txt fix): mobile and desktop performance 100, accessibility 100, best practices 100, SEO 100 (was 91); mobile FCP/LCP 0.8 s, TBT 0, CLS 0.

### Still unverified (needs people or hardware)
Real devices (low-end Android, iOS Safari install and eviction); a screen-reader session (VoiceOver, TalkBack, NVDA); native-speaker review of all four catalogs, including the new "over what is available" wording; the six usability tasks with real users in AZ/TR/RU; fingerprint/face on real hardware; hosted headers on the real host; RTL by a native reader (no RTL language ships in v1).

## Payments panel (lead engineer, 2026-10-30)

Founder request (AZ, translated): "A separate Payments panel to manage payments comfortably: to whom / where the payment goes, one-time or loan; for loans and monthly payments, a panel that keeps the accounting as I pay."

### What shipped
- **New destination "Payments"** (AZ Ödənişlər, TR Ödemeler, RU Платежи) in the phone tab bar (Today, Plan, [+], Payments, History) and the tablet rail. It replaces "Coming up": `#/coming`, `#/coming/installments|repeating|once` redirect to `#/payments` with the matching filter. The "Coming up" card on Today and the "Still to pay" card on Plan link here; the + sheet has a "Payment or loan" chip.
- **One primary number**: "Still to pay this period" = waiting (any date) + scheduled up to the period end, in base currency. Status line ("1 payment waiting for you · Next: Internet, 2 Nov"), filter All | Loans | Repeating | One-time, groups Waiting for you / This period / Later / Finished. Rows: name, payee, type badge (Bank loan, Installment, Monthly, Weekly, ..., One-time), "Automatic" marker, amount, date ("Due 2 days ago", "Due 4 Nov", "Paid 3 Nov"), state pill (paid / waiting / scheduled / skipped / paused / ended); loans get a slim repaid bar and "X left". Past due uses the amber "waiting" pill and a factual sentence, never rose or red.
- **Add flow**: type picker with three large options (Repeating, Loan or installment, One-time) and one-line explanations; loans ask "Which one is it?" (Store installment = taksit, usually no interest / Bank loan = kredit). Fields: name, payee (free text, native autocomplete plus chips of earlier payees), amount + currency, date / frequency, number of payments, first payment date (**defaults to one month from today**), payments already made (**defaults to 0**), optional amount borrowed and annual interest rate, envelope (auto-selects the Installments or Bills fixed envelope), "Record automatically on the due date" (off by default). The existing "make room" step still runs when the fixed envelope is too small.
- **Pay as I go**: new commitments are in CONFIRM mode. On/after the due date the item waits under "Waiting for you" with "I paid"; the money stays reserved in the fixed envelope until it is confirmed or skipped. The "I paid" sheet has the amount prefilled and editable, the date (today, can be earlier), the envelope and an optional note; saving writes the linked expense (source recurring/installment, ruleId/installmentId, installmentNo/occurrenceDate) and shows an 8 s undo toast. Early "I paid" is allowed. Auto mode is a per-payment switch.
- **Loan detail**: primary number "Left to repay"; repaid bar; next payment, total to repay, paid so far, payments left + payoff month, amount borrowed / interest in total / interest paid / borrowed money left (only when the borrowed amount is given, labelled an estimate); I paid, Pay extra, Skip this one, auto switch, full timeline (paid-before rows folded into one, "Show more" after 8), past payments (tap opens the normal edit sheet), Edit, End this plan / Continue the plan. **Repeating detail**: primary number "Next amount", paid this year, envelope, I paid, Skip, auto switch, timeline, past payments with actual amounts, Edit, Pause/Resume, Remove (confirm dialog).
- Tablet (>= 840 px): the list lives in the left pane, the selected payment in the right pane (the detail number uses a smaller size there so the list number stays the one primary number).

### Accounting rules (`src/domain/payments.ts`, pure, documented in the file header)
1. Loan: T = payment x (count - waived); paid = paidBefore x payment + sum(linked payments in the loan currency); left = max(0, T - paid). The unpaid schedule is rebuilt from "left": each unpaid, unskipped occurrence takes min(payment, rest), in order.
2. Extra payment: same monthly amount, fewer payments, earlier payoff. Partial payment: that occurrence is paid with the actual amount; the shortfall becomes a smaller payment at the end. Skip: still owed, one more payment at the end.
3. Overpay: capped at what is left; the remainder is saved as a separate normal expense in the same envelope and the toast says so (the money left the account either way, so it is never dropped).
4. Interest (informational): needs the borrowed amount. With a rate: simple monthly amortization over the real payments, interest_k = round(balance x rate / 1200), extra payments repay the balance only. Without a rate: every payment carries the contract share (T - borrowed) / T.
5. Reservations: a new period's plan reserves every unpaid occurrence due in it **plus confirm-mode items still waiting from before**, so an unconfirmed bill keeps its money set aside across the period boundary. Confirming a reserved payment moves money from "funded" to "spent" inside the same fixed envelope, so safe-to-spend does not change; paying more than reserved is covered like any fixed-envelope shortfall (Buffer first).
6. Idempotent: "I paid" twice (double tap, two tabs) writes once. Undo soft-deletes; a loan that the undone rows had finished becomes active again. Turning auto mode on only covers due dates from that day (`autoFrom`), so waiting items are never posted behind the user's back. Resume after a pause skips the paused dates.
7. Migration: IndexedDB v3 and backup schemaVersion 2 backfill `payee`, `kind`, `principal`, `interestRate`, `autoPost` (= true for existing data: no behaviour change), `autoFrom`, `pausedAt`, and copy the old installment `skipped` list to `waived` (the old skip meant "not owed"). v1 backups import through the same function.

### Acceptance criteria defined for this feature
Legend as above (I = implemented, T = test evidence, B = seen in the Browser pane).

| AC | Status | Evidence |
|---|---|---|
| PAY-01 Payments tab (phone) and rail item (tablet); old Coming routes redirect | I T B | e2e `payments.spec.ts` (redirect + filter), pane walk |
| PAY-02 One primary number "Still to pay this period" = waiting + scheduled to period end, base currency | I T B | `payments.test.ts` panel overview |
| PAY-03 Status line, filter, groups Waiting / This period / Later / Finished, row anatomy incl. payee, badge, pill, loan bar | I T B | unit + Browser pane (AZ sample) |
| PAY-04 Type picker with explanations; kredit / taksit sub-choice; payee autocomplete | I T B | dev walk + e2e add-loan |
| PAY-05 New commitments default to confirm mode; existing data keeps auto mode | I T | `payments.data.test.ts` migration + confirm tests |
| PAY-06 "I paid": editable amount, date, envelope, note; linked transaction; undo; idempotent; early pay | I T B | data test + e2e + pane |
| PAY-07 Hero unchanged by confirming a reserved payment; reserved money not spendable while waiting | I T | `payments.test.ts` safe-to-spend block, data test, e2e confirm test |
| PAY-08 A waiting bill stays reserved in the next period | I T | data test (period boundary) |
| PAY-09 Loan accounting from real payments: total, paid, left, payments left, payoff month | I T B | unit + e2e (1,200 -> 1,100 -> 800, "8 payments left") |
| PAY-10 Extra payment shortens the term; partial payment; skip moves to the end; overpay capped, rest = normal expense | I T | unit + data test |
| PAY-11 Interest share only with the borrowed amount, labelled an estimate | I T B | unit (both methods) |
| PAY-12 Auto switch per payment; pause/resume; end/continue; remove with confirm | I T B | data test (autoFrom, resume skips) |
| PAY-13 Dexie v3 + backup v2 migrations, backward-compatible import; CSV has `payee`, `payment_type` | I T | data tests |
| PAY-14 i18n EN/AZ/TR/RU incl. plurals; glossary extended; lint clean | I T | `npm run lint` |
| PAY-15 Sample data: kredit with principal + rate, phone taksit, electricity/gas/water in confirm mode (gas waiting), internet auto, rent auto, one-time car insurance; localized names and currency | I B | Browser pane (AZ) |
| PAY-16 A11y: 44 px targets, labelled amounts/progress, 200% text, light/dark, tablet two-pane, axe 0 | I T B | dev `__walk` / `__axe` / `__audit`: 0 findings (phone light AZ, 200% text, tablet 1024x768 dark); e2e a11y now also covers a payment detail page and the I paid sheet |
| PAY-17 Offline "I paid" | I T | e2e offline test |
| E-02 (walkthrough) a lone "." or "," in an amount never crashes | I T | `parseAmountInput` unit tests, e2e |
| E-10 (walkthrough) first payment defaults to next month; nothing counted as paid unless said; reachable from + | I T | e2e + form defaults |

### Decisions worth knowing
- "Remaining debt" is shown as "Left to repay": the banned-word lint (DR-5) forbids debt / borc / borç / долг.
- The EN filter says "Repeating" (the founder said "Monthly") because the group also holds weekly and yearly bills; badges show the real frequency.
- AZ Bills envelope template renamed "Kommunal" so it does not collide with the new "Ödənişlər" tab (existing envelope names are user data and stay).
- The repo API default stays `autoPost: true` (old callers and tests unchanged); the product default (the add form) is confirm mode.
- Tests changed because the spec changed (stated, not hidden): CSV header gained two columns; backup schemaVersion 1 -> 2; the IndexedDB meta row now records the last step (2 -> 3); `migrate(d, 1)` is no longer a no-op. No golden test changed.

### Commands run (Payments panel)
- `npm run lint`: tsc 0 errors + i18n checks, 27 tests pass (tab label and button budgets now include `nav.payments` and the `pay.*` buttons).
- `npm test`: 13 files, 243 tests pass (was 11 / 188; new `src/domain/payments.test.ts` 45 tests, `src/data/payments.data.test.ts` 10 tests).
- `npm run test:e2e`: build + 32 tests pass (2.8 min; new `e2e/payments.spec.ts` 4 tests; axe light and dark: 0 violations on 15 screens incl. a loan detail and the I paid sheet).
- `npm run build`: tsc + Vite OK, precache 26 entries (760 KiB).
- Browser pane (dev server, own tab on localhost): AZ sample, phone 375x812 light; `__walk` over the panel, every detail page and sheet: 0 findings; axe 0; 200% root text: 0 findings; tablet 1024x768 dark: two-pane, axe 0; RU and TR phone walk: 0 overflow / clipping.

### Not verified
Real phones, a screen reader, native-speaker review of the new strings, RU and TR visual pass of the panel (checked by the i18n lint only), RTL by a native reader.

## Expert walkthrough fixes and the onboarding income list (lead engineer, 2026-10-30)

Scope: every open issue in `07-expert-walkthrough.md` (E-01..E-23), in severity order, plus a founder change to onboarding step 1. The per-issue status column is in `07` section 7. E-02 and E-10 had been fixed by the Payments work and were re-verified.

### What changed (founder-visible)
- **Add sheet (E-01).** No layout jump before or after the first digit (chip row can no longer shrink; the hint line keeps its height); pad keys fire on pointer-down so a fast second tap is never dropped; key height follows the screen height; detail chips stay on one line. 360x640: all 12 keys above the Save bar; 375x812 the same; 360x560: one short scroll. Detail chip now reads "Bu gün · Qeyd" (E-11); "+" on an envelope page preselects that envelope (E-21).
- **Numbers (E-03).** The app owns the separators per language (`NUMBER_SPECS`, `i18n/index.tsx`): AZ `1.500,50 ₼`, TR `₺1.500,50`, RU `1 500,50 ₽`, EN `$1,500.50`, on every engine (Chromium's reduced ICU printed `₼ 1,500.50` for az). Pad decimal key is "," for AZ/TR/RU; every text amount accepts "," and "." and grouped input (`normalizeAmountText`); screen-reader amounts are spoken in Azerbaijani ("4 manat 50 qəpik") when the browser has no az data. AZ dates use full names ("5 noyabr", "30 oktyabr, cümə").
- **Scroll (E-04).** Every route change and onboarding step opens at the top.
- **First-period amounts (E-05).** Onboarding step 3 explains the monthly plan and shows "İlk dövr: 76 ₼" per row; the Why sheet explains the short first period.
- **Overspend (E-06, E-13, E-15).** Move sheet has To / From fields with pickers; when the chosen source is capped it offers the rest from the next sources (other flexible envelopes with spare money, Buffer, Savings; never Pocket) in one tap, or says calmly that the rest comes out of the next income. The toast suggests from the state after the expense. The hero shows "Pul köçür" when it is 0 and an envelope is short. Rows say "₼ 2,50 çatmır" with amount 0, a move icon and a warm brown instead of rose.
- **Early salary (E-08).** A scheduled pay received up to 10 days before its date belongs to its own (next) period (`isEarlyIncome` / `eventPeriodDate` in `domain/engine.ts`): today's number, this period's income and the horizon stay; toast "Növbəti dövr üçün saxlanıldı. Dövrün başlanğıcı: 5 noyabr. Bu günkü rəqəm 21 qalır."; Why sheet and Income page say it too. (The spec had no explicit early-income rule; this is the decision.)
- **Why sheet (E-16).** A receipt (money ÷ days = a day − spent = left), result bold, last line "Bu gün az xərcləsəniz, sabahkı rəqəm artar."; Plan header names what it includes.
- **Copy (E-07, E-09, E-12, E-14, E-18, E-19, E-20, E-23).** Frequency-aware onboarding titles; "Yer aç" sheet: "Planı olduğu kimi saxla" + "saved either way", no "now 0 (was 0)"; AZ register fixes; onboarding plan shows 7 rows + "Daha çox: Taksitlər, Ailə və hədiyyələr" and defines Ehtiyat; backup button first, password behind "Parolla qoru"; sr-only "az-Latn" removed; app-made envelope and income names follow a language switch; Plan row amounts 19 px (59%).
- Also fixed on the way: hero screen-reader label said "1 day until next income until next income"; envelope progress meter had no accessible name; section links wrap at 200% text.

### Onboarding step 1: equal-rank income list (founder request)
- Problem: in "twice a month" the second payment sat in a nested card and only it had a typeable field; the first amount was driven by a pad far below; pay days were a bare `<select>`.
- Now: a list of income rows of equal rank (name prefilled and editable, amount, schedule). Presets "Ayda bir dəfə / Avans + maaş / 2 həftədən bir / Hər həftə / Dəyişir" only pre-fill the list (amounts already typed are kept). Tapping a row's amount makes it the active row (highlighted border, `aria-pressed`, "Yazılır: Avans" above the pad) and the one number pad types into it; the pad scrolls into view. "Başqa gəlir əlavə et" adds a row; every row but the last can be removed; "Ayda cəmi" shows under the list for 2+ rows.
- Schedule per row (sheet): Monthly with a 7-column day grid 1-31 plus "Ayın son günü" (29-31 follow the existing month-end rule and the sheet says so), Weekly (weekday), Every 2 weeks (next date), It varies (optional next date). Weekend shifting ("earlier working day") is **not** built: the engine has no such rule; noted for later.
- Domain: `OnboardInput.incomes?: OnboardIncome[]` (`domain/onboarding.ts`, `specsFromList`): anchor = a row marked as anchor, else the largest steady monthly-equivalent income (tie: later pay day); `monthlyFigure`, `cycleDayFor`, `nextPay`, `suggestMoneyNow`, cover mode (`onlyUncertain`) work on any list; the old single-shape input still works (existing tests unchanged, same numbers). Tests: 1 / 2 / 3 incomes, last-day and 29/31, irregular-only.
- The Income screen's add/edit sheet uses the same row editor (`screens/IncomeRows.tsx`) with the number pad, so adding an income later looks the same.
- Taps, default monthly path (AZ, 1 500): language 1 + Başla 1 + digits 4 + Davam et 1 + Davam et 1 + Uyğundur 1 = **9** (8 when the device is already AZ), unchanged. "Avans + maaş": +1 preset, +1 tap on the second amount. Whole step fits 375x812 without scrolling for one income.

### Tests added or changed (stated)
- New: `e2e/walkthrough.spec.ts` (Add sheet at 360x640, 360x560, 375x812: keys above Save, no movement, fast "4.50"; AZ amounts and decimal key, Today at top; onboarding income list end to end). Unit: AZ/TR/RU/EN money, hero, parts, moneyName, formatRaw; `parseAmountInput` with grouped and comma input; income list; early income; `planMove`.
- Changed because the spec changed: AZ date strings (`5 oktyabr`, `5 oktyabr, bazar ertəsi`); overspend wording test now expects "short / çatmır / eksik / Не хватает" (still measured against what is available, never "over plan"); "1,2,3" stays invalid (grouping must be in threes).

### Commands run (this pass)
- `npm run lint`: tsc 0 errors + i18n checks, 32 tests pass.
- `npm test`: 13 files, 277 tests pass (was 243).
- `npm run build`: tsc + Vite OK, precache 27 entries (785 KiB).
- `npm run test:e2e`: build + 37 tests pass (2.9 min), incl. the new `walkthrough.spec.ts` (5) and axe light/dark on 15 screens: 0 violations. (One intermediate run failed the 200% text test on Today: the new "All envelopes" / "All payments" links did not wrap; fixed.)
- Browser pane (dev server): `__axe` 0 on Today, Plan, Income, Payments, History, Settings/data, Settings/currency and on the Add, Why, Move, Move picker, Income edit and schedule sheets (AZ phone light, foreground tab); tablet 1024x768 dark: axe 0; `__walk` RU and TR phone (no overflow, clipping, small targets), AZ walk found and fixed an unnamed envelope meter; sheet colour-contrast hits in that walk came from a background tab whose open animation had not finished and were 0 when re-checked in the foreground. The 127.0.0.1:5173 tab's old test data was erased for the onboarding walk.

### Not verified
Real Android/iOS (their ICU and keyboards, touch timing of the pointer-down pad), a screen reader reading the AZ amount names, native review of the new AZ/TR/RU strings (flag: `inc.earlyNext`, `move.noSpare`, `onboard.planScaled`, `why.firstPeriod`, "Planım"), usability of the income list with real people.

## Payment categories: envelope = category (lead engineer, 2026-10-31)

Founder-approved design (implemented as approved; details refined and recorded here and in `app/README.md`, "Payment categories").

### What shipped
- **Envelope = category.** No separate category/tag system. Envelopes that are a ready-made payment category carry an optional stable `categoryKey` (`housing`, `utilities`, `phone`, `loans`, `installments`, `subscriptions`, `insurance`, `education`, `other`); at most one live envelope per key. Pure logic in `src/domain/categories.ts` (keyword table, folding, suggestion, inference, By category totals).
- **Payment form chooser** (add and edit): existing fixed envelopes first, then the not-yet-created ready-made categories as lighter dashed "suggested" chips (loan form: Loans, Installments; bill forms: Utilities, Housing, Phone & internet, Subscriptions, Insurance, Education & kids, Other), then "+ New envelope". A suggested category is created only when the payment is saved into it (never floods the Plan); an archived envelope with the key is brought back instead of a duplicate. Under the chips one line says why the chip is selected and, for a not-yet-created one, its examples ("İşıq, qaz, su. Yeni zərf. Yadda saxladığınız zaman yaradılır.").
- **Inline "+ New envelope"** in the payment form (fixed) and in the add-expense sheet (chip row and the "All envelopes" list; flexible): a small sheet with only a name; icon suggested from the name, changeable (icon grid). The envelope is a draft until the form is saved, then written in the same step; cancelling leaves nothing. Same name as an existing envelope selects that one.
- **Plan and hero.** A new fixed envelope gets, for the current period, what the payment needs this period through the existing "make room" step (Buffer first, then day-to-day envelopes); the step now also says "{name} gets {amount} for this period" and shows today's number before/after (the preview counts the draft envelope). A new flexible envelope starts at 0 (nothing moves). Save toasts now carry **Undo** for new payments and for any save that created an envelope: the payment, its automatic postings, the envelope and the period/master plan return exactly to what they were (`undoPaymentSave`, `undoExpenseWithEnvelope`).
- **Auto-suggest** while typing name or payee: own earlier choice for the same payee, then the same name (only when it was always the same envelope); then the EN/AZ/TR/RU keyword table, case/diacritic-insensitive (ə, ı/İ, ş, ç, ğ, ö, ü, ё folded). Short words are whole-word only ("su" never matches "sushi", "gas" never "gasoline"); loans/installments outrank product words ("Telefon taksiti"); conflicting name/payee or two categories in one name = no auto-pick. Loan forms accept only loan/installment keywords. "Suggested" badge + one line; one tap overrides; editing never re-suggests.
- **Payments panel "By date | By category"** (segmented; By date default, the type filter became a chip row). By category: one row per envelope with payments; monthly total, yearly total for repeating items ("32 ₼/ay · ildə 384 ₼"), one-time shown apart ("Birdəfəlik: 450 ₼"); tap opens the filtered list ("Zərf: Abunəliklər", "All categories" back). "Still to pay this period" remains the only primary number. Deep link `#/payments/category`. Works in the tablet left pane.
- **Data.** IndexedDB v4 (infers keys for existing envelopes: template names in 4 languages, then keywords, then icon; never twice; names untouched); backup schemaVersion 3 with the same inference for v1/v2 files, unknown keys refused by validation; CSV gets a last column `category`; onboarding templates set keys (home -> housing, bills -> utilities, installments -> installments); a fixed envelope created in Plan gets the inferred key when free; app-named category envelopes follow a language switch.
- **Sample data.** Utilities (electricity, gas, water), Housing (rent), Phone & internet (internet), Loans (car loan, now 150/month so the sample stays plausible), Installments (phone taksit), Subscriptions (music 8 + video 24 = 32/month, 384/year), Insurance (one-time 450 in 35 days). The sample plan sizes the bills to their cost and the seed funds every payment due this period with the make-room rule; today's number is 16 ₼ in the AZ sample (it was 33 ₼ before only because the car loan was silently not set aside).
- **Not built (decided):** sub-categories, several tags per payment, coloured labels, a category on everyday expenses apart from their envelope.

### Acceptance criteria (this feature)
| AC | Status | Evidence |
|---|---|---|
| CAT-01 Envelope = category; one live envelope per key; no second category field | I T | `categories.data.test.ts` (never a duplicate, archived comes back, inferred key only when free) |
| CAT-02 Inline "+ New envelope" in payment form (fixed) and add-expense (flexible); created with the save; same name selects existing; Undo removes it | I T B | e2e `payments.spec.ts` (inline from a payment, Undo); data test (add-expense undo; a used envelope stays); pane walk (AZ) |
| CAT-03 New fixed envelope funded via make room, money conserved, hero change shown, Undo restores plan exactly | I T B | data test (total available equal before/after/undo, master plan equal); pane: "Ehtiyatınız bunu qarşılayır. Bu günkü rəqəm 16 qalır." |
| CAT-04 Suggested categories offered, created only on use; existing users mapped ("Kommunal" -> utilities) | I T B | unit (inference in 4 languages), migration test, pane (old localhost data migrated: Ev / Taksitlər / Kommunal) |
| CAT-05 Auto-suggest from name/payee, 4 languages, case/diacritic-insensitive, learning from own payees, no auto-pick when ambiguous | I T B | `categories.test.ts` (51 keyword cases in 4 languages, learning, ambiguity), e2e ("qaz" -> Bills/Utilities, "Netflix" -> Subscriptions, "Internet su" -> no suggestion) |
| CAT-06 By date / By category; monthly and yearly totals; one-time apart; tap = filtered list; one primary number | I T B | unit totals (weekly, yearly, loans' next 12 months, paused), e2e (₼32 a month / ₼384 a year, one-time ₼450, filtered list, deep link) |
| CAT-07 Dexie v4 + backup v3 migrations, backward-compatible import, CSV `category` | I T | data tests |
| CAT-08 i18n EN/AZ (siz)/TR/RU, glossary, lint | I T | `npm run lint`; glossary section 2 |
| CAT-09 A11y: 44 px targets, labels (chips "X, new envelope", rows with month/year text), 200% text, light/dark, phone/tablet, RTL-safe amounts | I T B | e2e axe light/dark now incl. By category, payment form chooser and inline sheet; pane `__axe`/`__audit` 0 findings: phone light + dark, 200% text, tablet 1024x768, dir=rtl |
| CAT-10 Sample data shows the categories | I T B | data test, pane (AZ) |

### Tests added or changed (stated)
- New: `src/domain/categories.test.ts` (68: folding, 51 keyword cases in EN/AZ/TR/RU incl. negatives like "Sushi", "Gasoline", "Internet su", learning, inference, icons, By category totals), `src/data/categories.data.test.ts` (9: keys on onboarding, no duplicates, IndexedDB v3 -> v4, backup v2 -> v3 + invalid key refused, CSV, make-room conservation + exact undo, add-expense undo, sample data). e2e `payments.spec.ts` +2 (inline envelope from a payment + Undo, "qaz" -> Utilities, "Netflix" -> Subscriptions, ambiguous no pick; By category totals, filtered list, deep link); `a11y.spec.ts` now also axes `#/payments/category`, the payment form chooser and the inline sheet (light and dark).
- Changed because the spec changed: CSV header gained `category`; backup schemaVersion 2 -> 3; the IndexedDB meta row now records 3 -> 4; sample car loan 285 -> 150 and the sample plan rows sized to the bills (otherwise the honestly funded sample would show 0 today). No golden test changed.

### Commands run
- `npm run lint`: tsc 0 errors + i18n checks, 2 files / 32 tests pass.
- `npm test`: 15 files, 354 tests pass (was 13 / 277).
- `npm run test:e2e`: build + 39 tests pass (3.2 min). One intermediate run failed my own new test (it expected USD sample prices; the test browser is detected as Azerbaijan, AZN); expectation fixed.
- `npm run build`: tsc + Vite OK, precache 30 entries (821 KiB).
- Browser pane (dev server, localhost tab, AZ sample): `__axe` 0 and `__audit` 0 findings on By category, payment form with suggested chips, inline sheet (phone light and dark), 200% root text, tablet 1024x768, dir=rtl. Walked by script in the pane: "Uşaq bağçası" -> suggested "Təhsil və uşaqlar" -> make room ("Ehtiyatınız bunu qarşılayır. Bu günkü rəqəm 16 qalır.") -> toast with Undo -> undone; add-expense "+ Yeni zərf" "Kafe" (coffee icon suggested) -> saved -> Undo removed it; cancelled inline payment envelope left nothing. Older localhost data migrated (Ev/Taksitlər/Kommunal keys).

### Not verified
Native review of the new AZ/TR/RU strings and of the keyword table; real phones and a screen reader; pane screenshots were unreliable this session (the window was not drawing), so the visual check was structural (DOM, axe, tap-target/clip audit), not by eye.
