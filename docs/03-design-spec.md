# Pul Planim - Design Specification

Author: Senior UX/UI Designer | Date: 2026-10-30 | Version 1.0 | Audience: Product Owner, Full-stack Developer
Companion file: `design-tokens.css` (import it; do not re-declare values).

**Reconciliation status: PENDING.** `02-product-spec.md` did not exist when this document was finished. This spec is built on the decided product model in the brief and on `01-market-analysis.md`. Section 12 lists the exact points to re-check when the product spec lands. Where the two disagree on scope, the product spec wins; where they disagree on interaction or visual treatment, this document wins.

**Evidence note.** Contrast ratios in this document were computed (WCAG relative luminance), not estimated. Font glyph coverage was verified by reading the font files' character maps (section 1.4). Everything about usability outcomes (e.g. "2 taps", "under 60 seconds") is a design target to be proven by the test script in section 9.

---

## 1. Principles, personality, identity

### 1.1 Design principles (each is testable)

| # | Principle | How we test it |
|---|---|---|
| P1 | **One primary number per screen.** The largest numeral on any screen is the only number the screen exists to tell. All other numerals are two type steps smaller or more. | Design lint: on every screen exactly one element uses `--text-hero` or `--text-display`. Review checklist and a Playwright check that counts elements with those classes (`=== 1`). |
| P2 | **Answer first, arithmetic on demand.** The screen opens with the answer to a question ("What can I spend today?"). The working-out is one tap away, never in the way. | Usability task 1: user states the number within 5 s of first sight without scrolling. |
| P3 | **Two decisions to log money.** Capturing an expense needs only an amount and (optionally) an envelope. Everything else is defaulted. | Task 2: median 2 taps beyond digits, under 8 s from app open to saved. |
| P4 | **Nothing is ever blocked, nothing is ever a verdict.** Overspending, late income, a forgotten week: the app saves the data, states the fact in neutral words, and offers one repair. | Copy lint: no words from the banned list (section 6.1). Usability: after overspend, 5 of 6 users say they felt "OK / not judged". |
| P5 | **Never colour alone.** Every status is word + icon + pattern + colour. | Greyscale screenshot test: every status still readable. Simulated deuteranopia/protanopia/tritanopia pass. |
| P6 | **Forgiving by default.** Every destructive or surprising action is undoable for 8 s (toast) or reversible from history. No "Are you sure?" dialog for things that can be undone. | Count dialogs: only 3 allowed (delete workspace, restore backup over data, remove envelope with history). |
| P7 | **Works at the extremes.** 200% text, Russian/Turkish strings +30%, one hand, bright sun, no network, RTL later. | Section 7 checklist runs in CI screenshot tests (en, ru, tr, az at 100% and 200%). |
| P8 | **Plain words, no jargon.** Reading level: age 12. Say "left to spend", not "discretionary balance". Say "plan", not "allocation". | Readability pass on EN source strings (Flesch-Kincaid grade <= 6); translators review for the same. |

### 1.2 Brand personality

A **quiet harbor**: sheltered, steady, a place you come back to because nothing there shouts at you. Think a kind older sibling who is good with money, not a coach, not a bank, not a game.

- Calm, never sleepy. Confident, never bossy. Warm, never cute.
- Voice: short sentences, present tense, "you" form, facts before feelings, no exclamation marks except the one delight line at period end.
- It never uses: "overspent", "failed", "warning", "bad", "careless", "budget busted", streaks, scores, grades.

### 1.3 Visual identity: "Liman" (harbor)

**Decision: replace the prototype's navy + electric blue and its fonts.** Reasons:

1. Navy + electric blue + geometric sans is the default look of every fintech and AI template; it reads "bank" or "SaaS", which is the cold association we want to leave behind for people with money anxiety.
2. The prototype fonts cannot ship: Instrument Sans lacks schwa (ə) and all Cyrillic; Bricolage Grotesque lacks schwa and Cyrillic (verified, 1.4). They would silently fall back to system fonts for Azerbaijani/Russian and break the identity in two of four launch languages.

**The look**

- **Palette**: cool mist neutrals (a faintly green grey, not cream, not stark white), **deep teal** as the single brand colour, **saffron** reserved for the pocket-money envelope (the only warm, playful element: it marks "this money is yours, no questions"). Status colours: teal = on plan, amber = a little ahead of pace, **rose** = over plan. Rose is a muted, dusty hue chosen specifically so that "over plan" never reads as "danger red". Pure red does not exist in the palette.
- **Shape**: soft, generous radii (12 / 20 / 28), pill-shaped chips and keys. Cards are **tonal, not outlined or shadowed**: white on mist, no side accent bars, no coloured left borders. Shadow is used only for things that float (sheets, toasts, menus, FAB).
- **The signature**: the **horizon line**. The Today hero sits on a deep-teal panel whose lower edge is a single gentle wave line (one SVG path, 1.5 px, 35% white). Days until next income are small dots along that line; today's dot is filled. It is the only illustration in the product, it is reused (period review, empty states) and it quietly says "calm water, land in sight". It is not decorative noise: the dots are data (days until next income).
- **Iconography**: Lucide (ISC licence), 24 px grid, 1.75 stroke, round caps. No emoji anywhere, including envelope icons. Users pick an icon from a fixed set of 36 line icons; no custom emoji picker.
- **Typography**: **Onest** (OFL), one family, variable weight 400-700. Humanist-grotesque with open apertures, excellent Cyrillic (designed Cyrillic-first), full Latin Extended, native tabular figures. The numerals are friendly but disciplined, which is what a money app needs. A single family loads once, caches offline, and avoids the fallback mismatch problem between a display and a text face across four scripts.
- **Anti-template checklist** (reviewed at every design review): no gradient hero; no purple/blue; no cream + terracotta; no accent-bar cards; no emoji icons; no donut-chart-on-the-home-screen; no confetti.

### 1.4 Font verification (evidence)

Character maps of the font files in the Google Fonts repository were inspected for: ə Ə ı İ ş Ş ç ğ ö ü, Cyrillic Д ы ё, currency signs ₼ ₺ ₽ ₸ €, the minus sign U+2212, and the OpenType `tnum` feature.

| Font | Missing glyphs | tnum | Verdict |
|---|---|---|---|
| **Onest** | none (all of the above present, including ₼ U+20BC and ₺) | yes | **Chosen** |
| Manrope | Ə, ₼, ₸ | yes | Rejected (capital schwa and manat sign missing) |
| Instrument Sans (prototype) | ə, Ə, all tested Cyrillic, ₼, ₺, ₽, ₸ | yes | Rejected |
| Bricolage Grotesque (prototype) | ə, Ə, all tested Cyrillic | yes | Rejected |

Fallback stack (in tokens): `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans"`. All of these contain ə, İ and Cyrillic. If Arabic is added later, add "Noto Sans Arabic" (or IBM Plex Sans Arabic) to the stack and test numeral shaping; keep Latin digits in amounts.

**Developer note:** AZN sign U+20BC is present in Onest but missing from many system fonts. Because we self-host Onest, it always renders. If a user's device ever falls back, `Intl.NumberFormat` will still output the symbol; add the text fallback "AZN" via a feature check (`document.fonts.check('1em Onest', '₼')`) only in the fallback case.

---

## 2. Information architecture and navigation

### 2.1 Decision

**Three tabs plus a raised Add button. No hamburger, no "More" tab.**

```
Phone bottom bar (always visible, 64 px + safe area):

  [ Today ]   [ Plan ]   ( + )   [ History ]       Settings = gear on Today header
                       raised Add
```

| Destination | Question it answers | Its one primary number |
|---|---|---|
| **Today** | "What can I spend today?" | Safe to spend today (hero) |
| **Plan** | "Where is my money going this period?" | Left to spend this period (sum of remaining across non-savings envelopes) |
| **History** | "What did I do?" | Spent this period |
| **Add (+)** | "I just spent something." | The amount being typed |

Not tabs, reached from inside: Income & pay days (Plan > top card "Next income"), Installments & recurring (Plan > "Coming up" section), Envelope detail (tap an envelope), Period-end review (card on Today when due, also Plan > menu), Why this number (tap hero), Settings (gear on Today, also on Plan header on tablet rail).

### 2.2 Justification against "one primary number" (P1)

- Each tab maps to exactly one question and one number, so the tab itself is the headline. A five-tab bar (Today, Envelopes, Income, History, Settings) would give five competing "home" numbers and teach the user a model of the app's internals. Three tabs expose the user's three mental questions: now, plan, past.
- Add is not a tab: it is an action available from every tab, always in the same thumb position (bottom centre). Its sheet takes over the screen, so its only number is the amount being typed.
- Income is not a tab because it changes rarely (once per pay day). It is a card at the top of Plan. Installments and recurring items live in Plan under "Coming up", because they are commitments that shape the plan, not a separate activity.
- Settings is rare and carries no number; a gear on the Today header (top-end corner, 48 px target) is enough. It is not in the bottom bar to keep the bar at 3 + 1, which also makes the centre Add button literally central (symmetrical, one-handed reachable for left and right thumbs).
- Tablet and desktop use a **navigation rail** at the inline-start edge with the same destinations plus Settings (there is room, and no thumb-reach constraint).

### 2.3 Navigation rules

- Bottom bar hides on Add, Why, review and full-screen settings pages; shows on all three tab roots and on envelope detail (so the Add button never disappears while browsing).
- Back: top-start chevron (auto-mirrored in RTL) plus system back gesture. Sheets close via swipe down, scrim tap, Close button (never only one).
- Deep state is preserved per tab (scroll position, filter), and the last tab is restored on relaunch.
- Max depth: 3 (Tab > Envelope detail > Transaction edit sheet).
- Terminology: user-facing word for category is **envelope** in EN/TR/AZ/RU ("zərf", "zarf", "конверт") with a one-line explainer at first use: "An envelope is money set aside for one purpose." The product name for the pocket money envelope is "My pocket money" (AZ "Mənim payım").

### 2.4 Content map

```
Today
 ├─ Hero: safe to spend today ─► Why this number? (sheet)
 ├─ Day strip (days until next income)
 ├─ Quick envelopes: top 3 by use, remaining amounts
 ├─ Coming up (next 3 commitments)  ─► Installments & recurring
 ├─ Cards (conditional): income due today / period-end review / backup nudge
 └─ Header: gear ─► Settings
Plan
 ├─ Header number: left this period
 ├─ Next income card ─► Income screen (amounts, pay days, split editor)
 ├─ Envelopes grouped: Fixed · Flexible · My pocket money · Savings · Buffer ─► Envelope detail
 └─ Coming up ─► Installments & recurring
History
 ├─ Search + filter chips (envelope, period, source, currency)
 └─ Day-grouped list ─► Transaction edit sheet
Add (+) ─► sheet: expense (default) | income | transfer between envelopes
Settings: Language · Currency · Appearance · Lock · Backup & export · Periods · About
```

---

## 3. Design tokens (prose and tables)

Authoritative values are in `design-tokens.css`. This section explains the decisions.

### 3.1 Colour

All pairs below are computed contrast ratios. Text needs 4.5:1 (large text 3:1), UI components and graphics need 3:1.

**Light**

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--color-bg` | #F2F5F3 | app background | text on it 15.3 |
| `--color-surface` | #FFFFFF | cards, sheets, rows | text 16.8, muted 7.18, subtle 5.54 |
| `--color-surface-sunken` | #E8EEEB | input wells, number display well | - |
| `--color-border` | #D5DEDA | decorative hairlines | not relied on |
| `--color-border-strong` | #7E908B | input outlines, focusable boundaries | 3.36 vs white |
| `--color-text` / muted / subtle | #12201D / #4A5B57 / #5B6C68 | primary / secondary / tertiary text | 16.8 / 7.18 / 5.54 on white |
| `--color-brand` | #0F6B63 | buttons, links, selected | 6.36 on white; white on it 6.36 |
| `--color-brand-soft` | #D8EDE9 | selected chip, tinted fills | brand on it 5.21 |
| `--color-hero-bg` | #0F6B63 | Today hero panel | white 6.36, muted text 5.18 |
| `--color-pocket` / text / soft | #F0B84A / #7A5200 / #FBEFD0 | pocket-money envelope only | ink on fill 9.33; text on white 6.92 |
| `--color-ok` | #0F6B63 | on plan | 6.36 |
| `--color-watch` / fill / soft | #8A5A00 / #E5A12B / #FBEBC8 | ahead of pace | text on white 5.93, on soft 5.03 |
| `--color-over` / fill / soft | #A83A55 / #C8506B / #F8E1E6 | over plan (rose) | text on white 6.17, on soft 4.97 |
| `--color-info` | #2F5D8C | neutral notices, offline | 6.85 |

**Dark** (deep green-black, never pure black; avoids OLED smearing and halation)

| Token | Hex | Contrast |
|---|---|---|
| bg / surface / sunken | #0D1513 / #152120 / #0A1110 | text on bg 15.8 |
| text / muted / subtle | #E6EFEC / #A9BDB8 / #8FA39E | 15.8 / 8.39 / 6.22 on surface |
| brand (text/controls) | #5CC9BC | 8.29 on surface; dark ink #04211D on it 8.49 |
| hero-bg | #12302C | hero text 12.78, muted 8.89 |
| pocket | #F2C25E | 9.96 on surface |
| watch | #F0B94D | 9.25 |
| over | #F08AA0 | 6.97 on surface, 6.30 on over-soft |
| border-strong | #5E7570 | 3.35 |

**Semantic status system ("over plan without alarm red")**

| State | Meaning | Colour | Icon (Lucide) | Word (EN) | Bar pattern |
|---|---|---|---|---|---|
| On plan | spent <= pace | teal | `check` in circle | "On plan" | solid fill |
| A bit ahead | spent > time-pace, <= 100% of plan | amber | `trending-up` (small) | "A bit ahead of pace" | solid fill + pace marker visible gap |
| Over plan | spent > plan | rose | `plus` in circle (meaning "extra") | "{amount} over plan" | solid fill to 100%, then **diagonal-hatched** overflow segment to the inline-end, never a full-width red bar |
| Done / nothing planned | n/a | muted text | none | "No plan yet" | empty track |

Rules: the rose is never used for backgrounds larger than a chip or one row's tinted wash; never for the hero; never for large text; never for an icon larger than 20 px. The word "over" appears with the amount, in `--text-label`, not bold. The corrective action (Move money) uses the **brand** colour, so the visual weight sits on the fix, not the problem.

Colour-blind safety: teal vs amber vs rose differ in luminance (L ~0.12 / 0.17 / 0.14 relative) and in pattern (solid / solid with ahead-tick / hatched) and icon and word. Verified by design: no state depends on red-green discrimination.

### 3.2 Typography scale (Onest, rem-based)

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `--text-hero` | clamp 52-72 px / 1.0 | 600, tracking -0.02em | **The** primary number on Today only |
| `--text-display` | 32 / 36 | 600 | Primary number on Plan, History, Income, Envelope detail, Period review |
| `--text-title-lg` | 24 / 28 | 600 | Sheet titles, amount in Add display (scales down via fit) |
| `--text-title` | 20 / 26 | 600 | Section headings, row primary amounts in detail |
| `--text-body-lg` | 17 / 26 | 400/500 | Row titles, buttons |
| `--text-body` | 16 / 24 | 400 | Body |
| `--text-label` | 14 / 20 | 500 | Secondary info, chips, status words |
| `--text-caption` | 12 / 16 | 400 | Timestamps, legal. Floor: nothing smaller |

Rules: sizes are in rem; line-height unitless-equivalent; never lock heights on text containers (min-height only). Amounts use tabular lining figures in lists. Currency symbol renders at 0.5em of the number, baseline-aligned, weight 500, in `--color-text-muted` (hero: `--color-hero-text-muted`). Do not apply `text-transform: uppercase` (breaks Turkish/Azerbaijani İ/ı casing unless `lang` is set; avoided entirely).
Long words: `overflow-wrap: anywhere` on titles, `hyphens: auto` on body text with correct `lang`.

### 3.3 Spacing, radius, elevation

- Spacing: 4 pt base (`--space-1..16`). Page gutter 16 px on phone, 24 px on medium+. Vertical rhythm between groups 24 px; between rows 0 (rows are separated by 1 px hairlines inset by 16 px, no gaps).
- Radius: 4 / 8 / 12 / 20 / 28 / full. Cards 20. Hero panel 28 (bottom corners only, bleeds to screen edges on phone). Sheets 28 top. Inputs 12. Chips and keys: full.
- Elevation: 0 (flat tonal surface) for everything in-flow; 1 for pressed-raised list items on drag; 2 for FAB, toast, menus; 3 for dialogs; sheet shadow on the sheet's top edge. In dark mode elevation is communicated by a lighter surface tone first, shadow second.

### 3.4 Motion

| Token | Duration | Use |
|---|---|---|
| instant | 90 ms | pressed state |
| fast | 160 ms | chip select, toggle, fade |
| base | 240 ms | sheet open/close, row insert/remove |
| slow | 360 ms | screen push, hero number change |
| calm | 600 ms | progress bar fill, delight moments |

Easings: standard `(0.2, 0, 0, 1)` for most; decelerate for entering; accelerate for leaving; `settle` (one 4% overshoot) for delight only. Principles: motion explains cause (a number moves where the money went), it never decorates. No bounces on errors. Numbers change by a 240 ms vertical crossfade, never by "odometer" counting (counting reads as gambling/stock ticker). Reduced motion: all durations collapse, transforms removed, state remains (see 7.4).

### 3.5 Touch targets and one-handed reach

- Minimum target 48 x 48 CSS px (exceeds WCAG 2.2 AA 24 px and meets AAA 44 px); primary buttons, FAB, list rows 56 px; number-pad keys 64 px high.
- Minimum 8 px between adjacent targets.
- All primary actions live in the bottom 40% of the screen ("thumb zone"). Top-of-screen controls are secondary (settings, back, close).
- Edge gestures: do not place critical controls within 16 px of the screen edge (system back gestures).

### 3.6 Breakpoints and layout

| Class | Width | Layout | Navigation |
|---|---|---|---|
| Compact (phone portrait) | 0-599 | single column, 16 px gutters | bottom bar |
| Medium (large phone, phone landscape, small tablet portrait) | 600-904 | single column, content max 640 centered, 24 px gutters | bottom bar |
| Expanded (tablet) | 905-1239 | **two-pane**: left 400 px, right flexible | rail at inline-start (80 px) |
| Large (tablet landscape, desktop PWA) | 1240+ | two-pane, whole app max 1200 centered | rail |

Height: if viewport height < 480 px (landscape phone), Add sheet switches to a two-column layout (display left, pad right), hero shrinks to `--text-display`.

PWA: `display: standalone`; `viewport-fit=cover`; pad `env(safe-area-inset-*)`; status-bar colour follows `theme-color` (set light and dark via two `<meta name="theme-color" media="(prefers-color-scheme: ...)">`); the bottom bar adds `--safe-bottom`.

---

## 4. Component specifications

Conventions: each component lists anatomy, states, and a11y. States: **Default, Pressed, Disabled, Error, Empty, Loading** (N/A noted where it does not apply). Pressed = 90 ms tone shift (surface -> surface-hover, brand -> brand-strong) plus `scale(0.98)` on buttons/keys (removed under reduced motion). Focus = dual ring from tokens.

### 4.1 Number pad

Anatomy: 3 x 4 grid. Keys 1-9, then `[decimal] 0 [backspace]`. The decimal key shows the locale separator (`,` for AZ/TR/RU, `.` for EN) and is hidden (replaced by `00`) for currencies with 0 minor units (e.g. JPY) and when the workspace is set to "whole amounts only". Key size: column width / 3, height 64, gap 8, **rounded rectangles radius 20 (`--radius-lg`)**, not circles, to maximise hit area.

| State | Spec |
|---|---|
| Default | surface fill, `--text-title-lg` digit, weight 500 |
| Pressed | `surface-sunken` fill, scale 0.98, light haptic tick (`navigator.vibrate(8)` where supported) |
| Disabled | digit keys disabled once 2 decimals entered or 9 integer digits; opacity 0.4, `aria-disabled`; pressing does a 160 ms horizontal 2 px nudge of the display (not red) |
| Error | n/a (the pad never errors; invalid input is prevented) |
| Empty | display shows `0` placeholder in muted; Save disabled |
| Loading | n/a |

Behaviour: long-press backspace clears all after 400 ms. Physical keyboard digits work. `inputmode="none"` on the display element so the OS keyboard never appears. Arithmetic (`+`) is a later feature: a small `+` key appears as a 4th-column secondary only after the first sum use; not in v1 launch layout. The pad is **not** mirrored in RTL (digit grid is universal). Each key has `aria-label` = the digit name; backspace = "Delete last digit".

### 4.2 Amount display

Shows the typed amount, currency, and optionally a converted base value.

- Anatomy: `[symbol small] [number title-lg->display]` centred; below, a 1 px caret line; below, optional "= 12,40 ₼" converted line (label size) when transaction currency differs from base.
- Auto-fit: starts at `--text-display` (32); shrinks to `--text-title` (20) for > 10 characters; never truncates.
- Grouping: formatted live with the locale's grouping, e.g. `1 234,50` (RU), `1.234,50` (TR), `1,234.50` (EN), `1 234,50` (AZ); caret always at the end.
- States: Default (shows value); Empty (placeholder `0` in `text-subtle`); Error (amount > 999 999 999: shake 2 px once, display remains, hint "That's a very large number. Check it?" in info colour, Save stays enabled - never blocks); Disabled/Loading N/A.
- A11y: `role="status"` `aria-live="polite"` reads the full amount phrase ("12 manat 40 qəpik") on change with debounce 400 ms.

### 4.3 Envelope row / card

Two variants.

**Row** (lists in Plan, Today): height min 72 px (grows with 200% text).
```
┌──────────────────────────────────────────────┐
│ [icon tile 40]  Food & groceries      120 ₼  │   <- amount = remaining (title size)
│                 ▓▓▓▓▓▓▓▓░░|░░░░  of 300 ₼    │   <- progress bar + "of plan"
│                 On plan                      │   <- status word (label)
└──────────────────────────────────────────────┘
```
- Icon tile: 40 x 40, radius 12, tinted by envelope type (neutral `brand-soft` for flexible, `surface-sunken` for fixed, `pocket-soft` for pocket, `ok-soft` for savings, `info-soft` for buffer). Icon only; no emoji.
- Right: remaining amount (`--text-title`, tabular). Below it nothing. The "of {plan}" sits under the bar on the start side.
- Chevron appears only on tablet-hover/RTL-mirrored; whole row is the target.
- Types differ by what the row shows: Fixed bills show "Due 5th - paid / not yet" instead of a bar (a bill is binary); Pocket shows only remaining and **no status word, no pace marker** (exempt from judgement); Savings shows "{saved} of {goal}" with a bar and no pace marker; Buffer shows only its balance.

| State | Spec |
|---|---|
| Default | as above |
| Pressed | surface-hover fill |
| Disabled | archived envelope: opacity 0.6, "Archived" label |
| Error | envelope amount cannot be computed (e.g. missing currency rate): replace amount with "-", status "Check currency" in info colour; tap opens fix sheet |
| Empty | envelope with no plan: bar replaced by text "No plan yet" + "Set amount" text button |
| Loading | skeleton: tile + two lines (see 4.14) |

A11y: row is a single button; label = "{name}, {remaining} left of {plan}, {status}". No nested interactive elements (bar is decorative `aria-hidden` and described by the label).

### 4.4 Progress bar: plan vs time-pace

The one chart in the product. It answers: "Am I spending at the pace of the period?"

```
 time elapsed ───────────┐ (pace marker, 14 px tall tick, 2 px wide, text colour)
                         ▼
 track  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░|░░░░░░░░░░░░░░░░     fill = spent / plan
 start                                  end
```
- Track: `--color-bar-track`, height 10 px (14 on detail), radius 4. Fill: `ok-fill`/`watch-fill`. Fill grows from inline-start (mirrors in RTL).
- **Pace marker**: a thin vertical tick at `elapsedDays / periodDays` of the width, extending 3 px above and below the bar, with a small `Today` label only on Envelope detail (not on rows).
- Fill colour by state: spent <= pace -> teal solid; spent > pace and <= plan -> amber solid; spent > plan -> fill is teal/amber to 100% and a **hatched rose segment** (45-degree stripes, 4 px period) continues beyond in an overflow lane: the bar's right end has a notch; the overflow segment is drawn inside an extra 25% of track length (max), with the plan boundary marked by a 2 px tick. For > 25% over, the segment stays capped and text carries the amount.
- Text always accompanies: status word + amounts. Bar is `aria-hidden`; the row's accessible name carries the meaning.
- Animations: fill animates `--dur-calm` on first view per session only, then snaps on updates by 240 ms.

States: Default; Pressed N/A (not interactive); Disabled (no plan: empty track with dashed border); Error N/A; Empty (0 spent: track only + marker); Loading (track shimmer 1.2 s, off under reduced motion).

### 4.5 Safe-to-spend hero

The Today centrepiece. Full-bleed panel (inline edges 0, top under status bar, bottom corners radius 28).

```
┌───────────────────────────────────────────┐
│  Today · Thu 30 Oct                  ⚙   │  <- label row
│                                           │
│  You can spend today                      │  <- label, muted
│                                           │
│  38 ₼                                     │  <- --text-hero, white, 600
│                                           │
│  Spent today 12 ₼ · 6 days to next income │  <- label, muted
│  ~~~~~~~~~∙∙∙∙●∙∙∙∙∙∙∙~~~~~~~~~~~~~~~~~~  │  <- horizon line + day dots (6)
│  Why this number? ›                       │  <- text button, 48 px target
└───────────────────────────────────────────┘
```
Whole number + "Why this number?" open the explainer sheet (number is a button, `aria-label` below). The hero never goes negative and never changes colour.

| State | Behaviour |
|---|---|
| Default | number = remaining for today (see formula in 5.4), floored to whole currency unit |
| Pressed | panel tone shift 4% |
| Used up | number shows `0`, label "Today's number is used", sub-line "Tomorrow: 34 ₼" and a quiet text button "Move money from another envelope" (also on Add overspend). Colour unchanged. |
| Past today's number (spent more than today's share) | same as Used up; the extra reduces the following days evenly; line: "You went {x} past today. The next {n} days are {d} each." |
| Disabled | N/A |
| Error | cannot compute (no income set): number replaced with "?" and label "Add your income to see your number", primary button "Add income" |
| Empty (first day, no spending yet) | shows full number, with sub-line "Nothing spent yet today" |
| Loading | skeleton bar 60% width at hero size; never a spinner; max 300 ms before data (local DB) |
| Income late | sub-line "Income expected {date}. Number assumes it arrives." info tint, with "Mark as received" |

A11y: the hero is `<button>`; `aria-label` = "You can spend 38 manat today. 12 manat spent so far. 6 days until next income. Opens explanation." Day dots `aria-hidden`.

### 4.6 Bottom sheet

Used for: Add expense (tall), Why this number (medium), Move money, filters, envelope picker, confirm leftovers.

- Anatomy: grabber (36 x 4, radius full, centred, 12 px from top), title row (title-lg + Close button at inline-end, 48 px), content, sticky action area (safe-area padded). Corner radius 28 top. Scrim `--color-scrim`.
- Heights: peek 40%, medium 60%, tall 92% (never 100%: the status bar area stays visible to hint "this is temporary"). Content scrolls; header and action bar stay.
- Interactions: swipe down to dismiss (velocity or > 30% travel), scrim tap dismisses (except when it contains unsaved typed amount: then it collapses to peek and shows toast "Draft saved" - the draft persists 24 h; no data loss and no confirm dialog).
- Motion: enter 240 ms decelerate from bottom; exit 160 ms accelerate. Reduced motion: opacity only.
- States: Default; Pressed (grabber drag); Disabled action (primary disabled until valid); Error (inline message above action bar, info/over-soft tint, with fix link); Empty (content shows empty state); Loading (skeleton content).
- A11y: `role="dialog"` `aria-modal="true"`, focus trapped, first focus on the title (not on the Close button), Esc closes, returns focus to the trigger.

### 4.7 Chip

Used for envelope selection, filters, quick amounts.

- Height 48 (visual 40 with 4 px transparent hit-area padding each side), radius full, label size 14->`--text-body` 16 for envelope chips, padding-inline 16, optional leading icon 20.
- Default: surface-sunken fill, text colour; border none. Selected: `brand-soft` fill + `brand` text + leading `check` icon (selection is not colour-only). Pressed: darkened 4%. Disabled: opacity 0.4, `aria-disabled`. Error: N/A. Empty: N/A. Loading: skeleton pill 88 x 40.
- Chips truncate to max 20 characters visually with `text-overflow: ellipsis` and show full text in `title`/accessible name; they never wrap to two lines, they scroll horizontally in a row (`scroll-snap`), with an end fade.
- A11y: role `radio` in a `radiogroup` for single-select; `checkbox` for filters.

### 4.8 Segmented control

2-4 options (e.g. Expense | Income | Move; Fixed | Flexible; Light | Dark | Auto). Height 48, container radius full on `surface-sunken`, selected segment a surface-colour pill with brand text and 1px border-strong... (light) / `surface-hover` (dark). Sliding indicator 160 ms. Labels never wrap; if combined label widths exceed the container at current text size, it **switches to a vertical stack of radio rows** (a CSS container-query / JS fit check) - this is the 200% text answer.
States: Default; Pressed (segment tone shift); Disabled (per segment, opacity 0.4); Error N/A; Empty N/A; Loading N/A.
A11y: `role="tablist"`/radio group as appropriate; arrow keys move.

### 4.9 List item (transaction / generic)

Min height 64 (row) / 56 (compact settings row). Layout (logical): `[leading icon tile 40] [title + subtitle] [trailing amount / control]`.
- Transaction: title = note or envelope name; subtitle = envelope - time - source badge ("Cash", "Card", "Installment 3/6"); trailing = amount (`--text-body-lg`, tabular), expenses without sign (negative implied by context), income with a leading `+` and brand colour. **No red for expenses.** Foreign currency: trailing shows original, subtitle shows converted.
- Swipe actions (touch): inline-end swipe reveals Delete (rose-soft, `trash` icon + label), inline-start swipe: Edit. Both are also available via tap -> edit sheet (swipe is never the only path).
- States: Default; Pressed (surface-hover); Disabled (pending/locked, opacity 0.6); Error (failed to save: not possible locally; for restore conflicts: info badge "Needs a look"); Empty (see 4.13); Loading (skeleton).
- A11y: single button; name = "{amount}, {title}, {envelope}, {date}". Swipe alternatives via the custom action menu (`aria-actions` polyfill: long press opens a menu).

### 4.10 Toast / undo

- Position: bottom, above the tab bar and above the FAB zone (24 px above bar), inline margins 16, radius 16, `--shadow-2`, inverse surface (`--color-text` background, `--color-bg` text; 15:1).
- Duration: 8 s for undoable actions (pauses on focus/hover/press; extended under screen reader), 4 s for info. Max one visible; new replaces old and queues the old action as committed. Not dismissible by timing out any critical info: errors never use toasts alone.
- Anatomy: message (body) + one action text button "Undo" (min 48 target, brand-on-inverse color `#8BE0D5` light / `#0F6B63` dark) + optional progress hairline (hidden under reduced motion).
- States: Default; Pressed (action tone); Disabled N/A; Error variant: info-icon + message + "Try again"; Empty N/A; Loading N/A.
- A11y: `role="status"` polite; for action toasts also keyboard-reachable via F6/`Tab` first stop after the trigger; announces "Saved. 12 manat from Food. Undo available."

### 4.11 Dialog

Used rarely (P6). Centered card, max-width 360 (phone: 16 margins), radius 28, padding 24, `--shadow-3`, scrim.
- Anatomy: title (title-lg), one paragraph (body), 2 buttons stacked (full width, 56 each; primary = safe choice at top; destructive-confirm is a plain text-weight rose-text button, never a filled rose button, second position). Default focus on the safe choice.
- Wording template: question as plain statement: "Remove the envelope Taxi?" / "Its 14 past expenses stay in history under Unsorted." / [Keep it] [Remove envelope].
- States: Default; Pressed; Disabled (confirm disabled until a typed word, only for Delete everything); Error (inline); Empty/Loading N/A.
- A11y: `role="alertdialog"`, focus trap, Esc = safe choice.

### 4.12 Buttons (supporting)

Primary: height 56, radius full, brand fill, on-brand text, label `--text-body-lg` 600; one primary per screen/sheet. Secondary: surface-sunken fill, text colour. Text button: brand text, 48 min height. Destructive text: `--color-over` text. Disabled: `surface-sunken` fill, `text-disabled` text, `aria-disabled="true"` (stays focusable, announces why via `aria-describedby`: "Enter an amount to save"). Loading: label replaced by 3 dots (static under reduced motion), width preserved. FAB (Add): 64 x 64, radius full, brand fill, `plus` 28 icon, `--shadow-2`, protrudes 20 px above bar, label "Add" under it in label size? No: icon only on phone, `aria-label="Add expense"`; on rail it is an extended 56 px high button with the text "Add".

### 4.13 Empty state

Pattern (reused everywhere): small horizon-line illustration (the same wave path, 96 px wide, text-subtle), one headline (title), one sentence (body, muted), one primary action. No cartoon characters. Max 3 lines of text at 100%.
- Example (History): "Nothing here yet" / "Your first expense will show up here." / [Add expense].
- States: Default; Pressed (button); Disabled/Error N/A; Loading (skeleton replaces illustration); Empty is the state itself.
- A11y: heading level matches page; illustration `aria-hidden`.

### 4.14 Skeleton

Shapes match the final component's geometry exactly (no layout shift): rows as tile + two lines of 60% / 35% width, `surface-sunken` fill, radius 8. Shimmer: 1.2 s linear horizontal gradient at 6% contrast, disabled under reduced motion (static fill). Shown only if data takes > 120 ms; because storage is local, most views never show one. Container has `aria-busy="true"` and a visually hidden "Loading".

### 4.15 Banner (system)

Offline, backup-needed, income-late. Full-width strip under the header, `info-soft` background (never rose), icon + one sentence + optional text action, dismissible except offline (which self-clears). Height min 48.

---

## 5. Screens (phone and tablet)

Wireframe legend: `[ ]` button, `( )` chip, `▓░` bar, `●` selected dot, `⚙` gear, `›` chevron (mirrors in RTL), `|` pace marker. Widths are ~360 px phone. The single primary number is marked **(1)**. Microcopy shown is the EN default; keys and translations in section 6.

### 5.0 Tablet frame (applies to every screen)

```
Expanded ≥905 px:
┌────┬──────────────────────┬────────────────────────────────────┐
│Rail│  LEFT PANE (400)     │  RIGHT PANE (flex, content ≤ 720)  │
│80  │  Plan column         │  Detail / History / Forms          │
│    │  hero (compact)(1)   │  numbers ≤ --text-title-lg         │
│Today│ envelopes list      │                                    │
│Plan │                     │                                    │
│Hist.│                     │                                    │
│ ⚙  │                      │                                    │
│[+Add]                     │                                    │
└────┴──────────────────────┴────────────────────────────────────┘
```
- The **left pane is persistent** on every rail destination except Settings and Onboarding. It contains the compact hero (on tablet the hero stays `--text-hero` at ~56 px; the right pane never uses display/hero size) and the envelope list beneath.
- The **right pane** changes by rail selection: Today -> Today feed (today's spending, coming up, cards); Plan -> selected envelope detail (default: first envelope needing attention, else Flexible), with Income and Installments reachable by tabs at the top of the pane; History -> full history with filters; Settings -> centered form column (max 560), left pane hidden.
- Tapping an envelope in the left pane always loads its detail in the right pane (no navigation push). Tapping a transaction opens the edit sheet as a **side sheet** from the inline-end edge (width 420) instead of a bottom sheet.
- Add: from rail "Add" extended button -> a centered modal sheet 440 wide containing the same pad. The pad always keeps 64 px keys.
- P1 on tablet: one hero/display numeral on the whole screen (left pane); right-pane numbers max `--text-title-lg`.
- Portrait tablet 600-904: single pane (same as phone, wider gutters, content max 640).

### 5.1 Onboarding (target: under 60 seconds, 4 steps, no account)

Decision: **3 input screens + 1 reveal.** Defaults are prefilled from device locale (language, currency, first-day-of-week, decimal format). Nothing is mandatory except income amount and next pay date.

| Step | Screen | Time budget |
|---|---|---|
| 0 | Splash 600 ms: logo + horizon line. No carousel, no "feature tour". | 1 s |
| 1 | **Language and currency**: language list (4 chips, device language preselected) and currency chip (detected). Primary: "Continue". | 5 s |
| 2 | **Income**: "How much do you receive, and when?" Amount (number pad), "Next pay day" (date: quick chips Today / Tomorrow / In 3 days / Pick date), "How often?" segmented: Monthly / Twice a month / Weekly / Just once. | 20 s |
| 3 | **Regular bills**: "Rent and bills you must pay each period" single number (number pad), skip text button "I'll add these later". | 10 s |
| 4 | **Reveal**: the hero panel appears with the first real number and one line "Here is a first plan you can change anytime: Bills 450, My pocket money 150, Savings 150, the rest is yours to spend daily." Primary "Looks good, start". Secondary "Change plan". | 10 s |

Default split used on reveal: Fixed = entered number; **My pocket money = 10%**; **Savings = 10%**; Flexible = remainder after commitments; Buffer starts at 0 (receives unallocated money automatically). If bills + 20% > income, the pocket and savings default shrink proportionally to 5% each and the reveal sentence stays neutral.

Wireframe step 2 (phone):
```
┌─────────────────────────────┐
│ ‹                  2 of 3   │
│                             │
│ How much do you receive,    │
│ and when?                   │
│                             │
│        1 500 ₼   (1)        │  <- amount display (title-lg->display)
│ Next pay day                │
│ (Today)(Tomorrow)(In 3 days)│
│ (Pick date)                 │
│ [Monthly|2×/mo|Weekly|Once] │
│                             │
│  1  2  3                    │
│  4  5  6                    │
│  7  8  9                    │
│  ,  0  ⌫                    │
│ [        Continue        ]  │
└─────────────────────────────┘
```
- Primary number: the typed amount. Primary action: Continue.
- Progress: "2 of 3" text (no progress bar needed).
- Privacy line on step 1 footer: "No account. Your data stays on this phone." (the only trust copy; detail in Settings).
- Lock and backup are **not** in onboarding; they are offered after the 3rd expense logged ("Want a PIN or fingerprint lock?") and after day 7 for backup.
- Tablet: onboarding is a centered column max 480 on mist background, same steps.
- Interactions: back keeps entered values; closing the app mid-way resumes at the same step; "Skip" is only on step 3.
- Errors: amount 0 -> Continue disabled, hint "Enter an amount to continue"; past date -> allowed ("Already paid? Then choose Today").

### 5.2 Today (hero)

```
Phone (scroll):
┌───────────────────────────────┐
│ Thu 30 Oct                 ⚙  │
│ ┌ hero panel (teal) ────────┐ │
│ │ You can spend today       │ │
│ │ 38 ₼                (1)   │ │
│ │ Spent today 12 ₼          │ │
│ │ ~~∙∙∙∙●∙∙∙~~  6 days left │ │
│ │ Why this number? ›        │ │
│ └───────────────────────────┘ │
│ [card] Salary due today       │  <- conditional
│        [Mark as received]     │
│ Your envelopes                │
│ ┌ Food & groceries   120 ₼ ─┐ │
│ │ ▓▓▓▓░░|░░░░  of 300       │ │
│ ├ Transport           45 ₼ ─┤ │
│ ├ My pocket money     80 ₼ ─┤ │
│ └───────────────────────────┘ │
│ Coming up                     │
│  Rent · Mon 5 · 450 ₼         │
│  Phone installment 3/6 · 12th │
│                               │
│ [Today] [Plan] ( + ) [History]│
└───────────────────────────────┘
```
- **Primary number:** safe to spend today. **Primary action:** Add (FAB).
- Hierarchy: hero > envelope top 3 (by use in last 14 days; pocket always included) > coming up (next 3 commitments within the period) > conditional cards. "See all" text button under envelopes jumps to Plan.
- Conditional cards (max 1 at a time, priority order): income due/late -> period-end review ready -> backup reminder -> lock suggestion. A card has one sentence and one button, dismiss "Not now" returns in 3 days.
- Interactions: tap hero -> Why sheet; tap envelope -> envelope detail; pull-to-refresh not provided (local data). Number updates with a 240 ms crossfade after Add.
- Spent-today line: shows only when > 0; when 0 shows "Nothing spent yet today" (calm, no streak).
- Status: no status words on Today except inside envelope rows; hero has none.
- Tablet: left pane = hero (compact) + envelopes; right pane = "Today" feed: header "Today", list of today's transactions (or empty state "No expenses yet today"), then "Coming up" with the next 5 commitments, then conditional cards. Primary number remains the hero.

### 5.3 Add expense

The most important interaction. Opens as a tall sheet (92%) already focused; **no keyboard, pad is part of the sheet**.

```
┌─────────────────────────────────┐
│ ─── (grabber)                   │
│ Add expense                  ✕  │
│ [Expense | Income | Move]       │  <- segmented (Expense default)
│                                 │
│            12,50 ₼        (1)   │  <- amount display
│     = 7.35 USD    (if foreign)  │
│                                 │
│ (Food)(Transport)(Pocket)(Café) │  <- chips: recent/most used first, scroll →
│ Selected: Food · 120 ₼ left     │
│ Today ▾   Note (optional)  ···  │  <- collapsed row: date, note, cash/card, currency
│  1   2   3                      │
│  4   5   6                      │
│  7   8   9                      │
│  ,   0   ⌫                      │
│ [     Save · Food     ]         │
└─────────────────────────────────┘
```
- **Primary number:** amount typed. **Primary action:** Save (label always names the envelope: "Save · Food").
- **Two-tap path:** (1) tap Add; type amount; (2) tap Save. Envelope is preselected: the most-used envelope **for this time-of-day window and weekday** in the last 30 days, falling back to overall most used, falling back to Flexible. Chip order: preselected first, then the 4 most recent distinct, then the rest by frequency, then "All envelopes…" which opens the full picker. Pocket money is always in the first 6.
- Tapping a chip changes selection; it does **not** save (prevents accidental saves) - exception: **Quick-save setting** (off by default): chip tap saves immediately. Rationale: lower error rate; two taps still holds.
- "···" row expands (still within the sheet): Date (Today, Yesterday, picker), Note (free text; opens the OS keyboard, the sheet moves up), Paid with (Cash/Card/Other; remembers), Currency chip (remembers per envelope).
- Entry points shown as small icon buttons in the title row, inline-end of title, **disabled-with-coming-soon** in v1: `scan-line` (Scan receipt QR) and `mic` (Say it). They are rendered only when the feature flag is on; until then they are absent (no dead buttons). Their placement is reserved at 48 px.
- After Save: sheet closes (240 ms), hero crossfades, toast: "Saved. 12,50 ₼ from Food." [Undo] 8 s. Haptic success tick.
- **Overspend**: Save always succeeds. If it pushes the envelope over plan: toast variant (stays 8 s): "Saved. Food is 6 ₼ over plan." [Move 6 ₼ from Buffer]. Source suggestion order: Buffer (if >= amount), then the envelope with the largest unspent surplus that is not Fixed/Savings/Pocket, else "Choose envelope". Tapping opens a mini sheet "Move money" pre-filled; one confirm button "Move 6 ₼". If dismissed, nothing else happens; the envelope row shows "6 ₼ over plan" in rose text (no banner, no push notification).
- **Income** tab: amount + source chip (existing income entries) + "Received/Expected" toggle; Save "Mark as received". **Move** tab: from-chip, to-chip, amount, "Move".
- Error: amount 0 -> Save disabled with `aria-describedby` "Enter an amount to save". Draft preserved on dismiss.
- Tablet: modal sheet 440 x 640, same layout, centered.
- Edge case, refund: use the "···" row toggle "This is a refund" which records positive amount back into the envelope.

### 5.4 Why this number? (explainer)

Medium sheet (60%), scrollable. The only place arithmetic appears. Plain words, a single "receipt" metaphor, every line tappable to its source.

Formula (display and logic): `today's number = (flexible money for the period − flexible already spent − set-aside commitments still to pay) ÷ days until next income (inclusive of today)`, minus what is already spent today.

```
┌─────────────────────────────────┐
│ ─── Why this number?         ✕  │
│                                 │
│ 38 ₼  can be spent today   (1)  │  <- title-lg (hero not repeated; this is the sheet's number)
│                                 │
│ This is how we got it           │
│ Money you will have        1 500│  Salary · 5 Nov expected  ›
│ − Bills and installments    −530│  Rent, phone installment  ›
│ − Savings and pocket money  −300│  you set these aside      ›
│ − Already spent             −214│  in flexible envelopes    ›
│ = Left for flexible spending 456│
│ ÷ Days until next income      12│  Next: 12 Nov             ›
│ ──────────────────────────────  │
│ = 38 a day                      │
│ Spent today: 12 → 26 ₼ left     │
│                                 │
│ If you spend less today, tomorrow's number grows.            │
│ [ Got it ]  [ Change my plan ]  │
└─────────────────────────────────┘
```
- Primary number: the same safe amount; sheet repeats it once at title-lg then shows the working. Primary action: "Got it".
- Pure-language rules: no "discretionary", "allocation", "amortization". Each line has a one-sentence helper in muted text. All figures are pulled from live state; each row's `›` deep-links (Income, Installments, Envelopes).
- Dynamic cases: income late (line "Salary expected 5 Nov, not received yet. We assume it comes."); installments listed by name; pocket money shown as part of what is set aside (explicit: "Pocket money is yours and is not counted in today's number").
- Rounds hero **down** to whole currency unit and says so in small print when decimals matter ("Rounded down so you never plan on money you don't have").
- Tablet: a popover/side sheet at the inline-end (width 420) over the right pane.

### 5.5 Envelopes / Plan

```
┌───────────────────────────────┐
│ Plan                          │
│ Left this period              │
│ 612 ₼                    (1)  │  <- display 32
│ of 1 500 ₼ · 12 days to go    │
│ ┌ Next income ──────────────┐ │
│ │ Salary · 1 500 ₼ · 5 Nov  │ │
│ │ Expected              ›   │ │
│ └───────────────────────────┘ │
│ Fixed bills            450 ₼  │  <- group header w/ planned total (label)
│  Rent        Due 5th · Paid   │
│  Phone inst. 3/6 · Due 12th   │
│ Flexible                      │
│  Food & groceries  120 ₼ ▓|░░ │
│  Transport          45 ₼      │
│ My pocket money      80 ₼     │
│ Savings    Vacation 400/1200  │
│ Buffer              34 ₼      │
│ [ + New envelope ]            │
│ Coming up …                   │
└───────────────────────────────┘
```
- **Primary number:** left this period (sum of remaining in Flexible + Pocket + Fixed unpaid? Decision: sum of *remaining spendable* = Flexible + Pocket + Buffer remaining; Fixed shown as paid/unpaid; Savings excluded). Primary action: tap into an envelope (edit plan), secondary "+ New envelope".
- Group order is fixed: Fixed, Flexible, My pocket money, Savings, Buffer. Group headers show only the planned total in label text.
- Reorder: not in v1 (order by group then usage); renaming and icon choose in Envelope detail > Edit.
- Planning mode: "Edit plan" text button in header switches rows to stepper-style amount fields (tap amount -> number pad sheet). The unallocated remainder is displayed live as "Unplanned goes to Buffer: 34 ₼" (calm, never "error: unallocated").
- Over-plan shown per 4.4. A group never shows red header.
- Tablet: this is the left pane (persistent); the Income card and Coming up appear in the right pane tabs (Detail | Income | Coming up).

### 5.6 Income

Reached from Plan > Next income card.
```
┌───────────────────────────────┐
│ ‹ Income                      │
│ Next: 1 500 ₼ on 5 Nov  (1)   │  <- display
│ Expected · in 6 days          │
│ [ Mark as received ]          │
│ How it is split               │
│  Fixed bills         450 ━━   │  <- stacked horizontal split bar
│  Flexible            600      │
│  My pocket money     150      │
│  Savings             150      │
│  Buffer (the rest)   150      │
│ Pay days                      │
│  Salary · monthly · 5th  ›    │
│  Advance · monthly · 20th ›   │
│ [ + Add income ]              │
│ Past payments ›               │
└───────────────────────────────┘
```
- **Primary number:** the next expected income. **Primary action:** "Mark as received" (when due or past), else "Add income".
- Expected vs received: each pay day creates an *expected* entry; "Mark as received" opens a mini sheet prefilled with the expected amount (editable: actual may differ), date today. On confirm: money lands in envelopes by the split, the remainder in **Buffer automatically**, toast "Income added. Plan updated." [Undo].
- Weekend shift option: "If it falls on a weekend: pay day moves to Friday / Monday / stays". Default per country in the product spec; fallback "stay".
- Split editor: each row is a number-pad-driven amount (tap to edit) and a percent helper in muted text; the Buffer row is read-only ("the rest, automatically"). If the user enters more than income, Buffer shows "0" and a calm info line "This is 40 ₼ more than your income. Reduce something or it will come from Buffer next time." (no error state, no block).
- Irregular income: "Just once" frequency; amount range not supported in v1.
- Tablet: right pane with two columns: left card list of income sources, right split editor.

### 5.7 History (search and filter)

```
┌───────────────────────────────┐
│ History                       │
│ Spent this period             │
│ 888 ₼                    (1)  │  <- display 32
│ [(search icon) Search expenses…]   │  <- 48 px field (icon is Lucide search)
│ (All envelopes▾)(This period▾)(More▾) │
│ Today                         │
│  Café   Food     −12,50       │
│ Wed 29 Oct                    │
│  Bus    Transport  −1,20      │
│  …                            │
└───────────────────────────────┘
```
- **Primary number:** spent this period (changes with filter: "Spent in view"). Primary action: tap row to edit.
- Search: instant on-device, matches note, envelope name, amount (typing digits matches amount equality or prefix), locale-insensitive for diacritics (searching "ə" or "e" finds both; folds İ/I/ı/i for tr/az).
- Filters as chips opening bottom sheets: Envelope (multi-select), Period (This, Last, Pick range, All time), More (source: cash/card; currency; type: expense/income/move; recurring/installment).
- Grouping by day with a sticky day header including the day total in label text (muted).
- Infinite list with windowed rendering; "Full history" is all-time: no cut-off.
- Edit sheet: same as Add, plus "Delete" (text button, rose text) -> deletes with toast Undo (no dialog).
- Empty (no data): empty state 4.13. Empty (no results): "Nothing matches. Try fewer filters." [Clear filters].
- Tablet: right pane list; left pane unchanged; selecting a row opens the side sheet; filters appear as a persistent chips row.

### 5.8 Envelope detail

```
┌───────────────────────────────┐
│ ‹  Food & groceries     ⋯    │
│  120 ₼ left            (1)    │  <- display
│  ▓▓▓▓▓▓░░░░░|░░░░░░░░░░░      │  <- bar (14 px) with "Today" label on marker
│  Spent 180 of 300 ₼           │
│  A bit ahead of pace          │  <- status, with icon
│  About 12 ₼ a day for 10 days │
│ [ Add to Food ]               │
│ [ Move money ]  [ Edit plan ] │
│ This period                   │
│  Café  Wed 29   −12,50        │
│  …                            │
│ Earlier periods ›             │
└───────────────────────────────┘
```
- **Primary number:** remaining in this envelope. **Primary action:** "Add to {envelope}" (opens Add with envelope preselected).
- Overspend variant: number is the overrun, shown as "6 ₼ over plan" in **text colour**, not rose (rose only for the small status word/icon); headline label changes to "Over plan by", and the first button becomes "Move money from another envelope" (primary), "Add to Food" secondary.
- Pocket variant: no bar, no status, no pace. Text: "This is yours. Spend it freely." Number = remaining. History list shows amounts with notes optional; **no category prompts**.
- Savings variant: bar = saved/goal, no pace marker, text "Reached by about {date} at this pace" optional; "Add to savings" / "Take out".
- Fixed variant: shows due date, "Paid / Not yet", button "Mark as paid" (creates the transaction at planned amount, editable).
- "···" menu: Rename, Change icon, Archive, Remove (dialog only if it has history).
- "Earlier periods" -> compact list of period totals (plan vs actual as two numbers in label size and the bar), tap to filter History to that period and envelope.
- Tablet: right pane; "Earlier periods" is a horizontal scroller of small bar-stacks.

### 5.9 Installments (taksit) and recurring

Reached from Plan > Coming up (and Add > "···" > Repeat/Installment).

```
┌───────────────────────────────┐
│ ‹ Coming up                   │
│ Still to pay this period      │
│ 535 ₼                    (1)  │
│ [ Installments | Repeating ]  │  <- segmented
│ Installments                  │
│  Phone · 3 of 6 · 85 ₼/month  │
│  Next: 12 Nov                 │
│  ▓▓▓░░░  3 paid · 3 left      │
│  Fridge · 8 of 12 · 62 ₼ …    │
│ Total left to pay: 495 ₼      │
│ [ + New installment ]         │
└───────────────────────────────┘
```
- **Primary number:** total of commitments still to pay before next income (the same figure subtracted in "Why this number"). Primary action: "+ New installment" / "+ New repeating".
- New installment flow (single sheet): Name (default from note), **Total price** or **Per payment** (segmented; the app calculates the other), **Number of payments** (stepper 2-60 with quick chips 3, 6, 9, 12), **First payment date**, **Envelope** (default Fixed bills), optional **Interest included?** toggle (no interest maths in v1). Summary line: "6 payments of 85 ₼. Last on 12 Apr." Save.
- Each installment pays itself as an expected item: on due date a card on Today asks "Phone installment 85 ₼ due today. [Mark as paid]"; marking creates the transaction. Skipped = "Not paid yet" stays visible with calm text "Overdue by 2 days", never red-banner.
- Recurring (rent, subscriptions): name, amount, frequency (weekly / monthly / every N months / custom day), envelope, "Remind me" toggle (on). Pausing allowed.
- Early payoff: "Pay off remaining" button in detail: records remaining total and removes future obligations after confirm toast.
- Tablet: right pane two-column (installments list | detail with payment schedule table).

### 5.10 Period-end review

Triggered at the end of the pay-cycle (the day before next income, or on app open after it). A card on Today, never a modal on launch. Gentle, optional, 15-second target.

```
┌───────────────────────────────┐
│ ‹ Period review               │
│  ~~~~ horizon wave ~~~~       │
│ You made it to 5 Nov.         │
│ Left over                     │
│ 86 ₼                     (1)  │  <- display
│ Here is where we'd put it:    │
│  Food & groceries   20 → Buffer
│  Transport          12 → Buffer
│  Flexible leftover  54 → Savings (Vacation)  
│ [ Confirm all ]  [ Change ]   │
│ Spent 1 414 of 1 500 plan     │
│ Biggest: Food & groceries     │
│ Skip for now                  │
└───────────────────────────────┘
```
- **Primary number:** total left over across flexible envelopes (not pocket: pocket carries over silently by default). **Primary action:** "Confirm all" (one tap).
- Suggested destinations by default rules: flexible leftover -> Savings if a goal exists, else Buffer; pocket money carries over; fixed leftover (a bill cheaper than planned) -> Buffer. Each line can be changed (tap -> envelope chooser).
- Overspent envelopes at period end: single neutral line "Food ran 40 ₼ past plan. Cover it from Buffer? [Cover 40 ₼]" optional; or "Leave as is" (carry-forward as 0 and the next plan unchanged). Never a list of "failures".
- Summary below the action: plan vs actual as two numbers in label size, and the top envelope; no grades, no comparison to others, no "streaks".
- On confirm: delight moment (section 8), new period starts, Today hero recalculates.
- "Skip for now": leftover stays in each envelope as-is and rolls into Buffer automatically after 7 days (communicated).
- Tablet: right pane; leftover table on the left half, "What happens next" preview on the right half.

### 5.11 Settings

```
┌───────────────────────────────┐
│ ‹ Settings                    │
│ General                       │
│  Language            English ›│
│  Currency                 AZN ›│
│  Appearance          Auto ▾   │
│  Periods and pay days       › │
│ Privacy and safety            │
│  Lock the app            Off ▸│  <- toggle; opens PIN/biometric setup
│ Your data                     │
│  Back up your data          › │
│  Last backup: 3 days ago      │
│  Export to file (CSV, JSON) › │
│  Restore from backup         ›│
│ About                         │
│  Help · Privacy · Version     │
│  Delete all data (text, rose) │
└───────────────────────────────┘
```
- No primary number on Settings (P1 satisfied by absence). Primary action: none; each row opens its own screen/sheet.
- Language: list of 4 with native names (English, Русский, Türkçe, Azərbaycanca); applies instantly without restart; changes number formatting too, with a separate "Number format" row ("Follow language" default) to decouple.
- Currency: **base currency** (changing it asks via dialog because it recalculates reports: "Change base currency? Past amounts stay in their original currency."); "Also use other currencies when adding" toggle enables the currency chip in Add; manual exchange rate screen (per pair, "Rate: 1 USD = 1,70 AZN", last edited date). No online rate fetch in v1.
- Lock: PIN (6 digits) and/or biometrics (WebAuthn platform authenticator where available). Lock delay options: Immediately / 1 min / 5 min. Recovery warning in plain words: "If you forget the PIN, the only way back in is a backup. Make one first." and offers Back up now. Forgot-PIN path: restore from backup file after clearing local data (documented).
- Backup & export: "Back up now" saves an encrypted file (passphrase optional but recommended) via share sheet/File System Access API; "Last backup" status with a quiet check; reminders every 14 days via Today card (not push). Export CSV (transactions) and JSON (everything).
- Tablet: centered column max 560, left pane hidden. Items identical.

### 5.12 Empty and first-day states

| Context | Content |
|---|---|
| Today, day 1 after onboarding | hero shows number; a single card: "Add your first expense. Tap + below." with a pointing arrow animation off by default; auto-dismisses after first expense. |
| Today, no expenses today | sub-line "Nothing spent yet today." |
| Plan, no envelopes beyond defaults | default 5 envelopes exist from onboarding, "+ New envelope" visible. |
| History, empty | empty state: "Nothing here yet" / "Your first expense will show up here." [Add expense]. |
| Envelope, no spending | bar track only; text "Nothing spent yet in this envelope." |
| Installments, none | empty state: "No installments" / "Buying in installments? Add it here and we'll keep the monthly payments in your plan." [Add installment]. |
| Day 2-3 | single gentle education chip per day on Today (dismissible, never repeats): "Tip: long-press an envelope to move money." Maximum 3 tips total. |
| Day 3, after 3rd expense | offer lock (card). Day 7 offer backup (card). |

### 5.13 Offline

The app is local-first: offline is a **non-event for core flows**, so the design says so and gets out of the way.

- A slim info banner appears only on screens that depend on network: Settings > Back up to cloud (if provided), Restore from link, Help. On Today etc. there is **no banner**; a small `cloud-off` icon (20) with label "Offline" appears at the header's inline-end for 4 s after connectivity change, then fades.
- If the user reaches a network-only action: inline state in place of the control: "You're offline. This needs internet. Everything else works." with [OK]. No error colour.
- Update available (service worker): a text card on Today "A new version is ready. [Update]" - never auto-reloads mid-typing; updates apply after the Add sheet closes.
- Install prompt (PWA): shown only after 3 days and 2 sessions, in Settings and as a Today card once: "Add Pul Planim to your home screen."

### 5.14 Error states

Principle: errors in a local app are rare and must say what happened, what is safe, what to do.

| Case | Treatment |
|---|---|
| Storage full / write failed | Dialog-free sheet: "We couldn't save this on your phone." / "Your other data is safe. Free some space and try again." [Try again] [Export my data]. Draft retained. |
| Data corrupted / migration failed | Full screen: "We hit a problem opening your data." / "Your last backup is safe. You can restore it." [Restore from backup] [Contact help]. App never silently wipes. |
| Invalid backup file | Inline: "This file isn't a Pul Planim backup." |
| Wrong PIN | Shake 2 px, "That PIN isn't right. {n} tries left." After 5: 30 s cool-down shown as countdown; "Forgot PIN?" link. |
| Amount too large | info hint, still saves. |
| Date in far future | info hint "This is far away. Is it correct?", still saves. |
| Unknown (crash boundary) | Calm full-screen with horizon illustration: "Something went wrong" / "Your data is safe on this phone." [Reload]. Error id in caption for support. |

Tablet: same content, centered max 480 over the panes.

---

## 6. Microcopy library

### 6.1 Voice rules

- Sentence case, no ALL CAPS. No exclamation marks except "Well done." style single moments listed in section 8.
- Banned words (lint list, all four languages must have equivalents banned): overspent, failed, warning, bad, careless, exceeded, blown, wasted, debt (use "installments"), alert, limit reached.
- Prefer verbs the user did: "You spent", "Saved". Prefer "left" to "remaining". Amounts always with currency.
- Register: EN "you"; AZ formal-warm "siz"; TR informal "sen"; RU polite "вы". Plurals via ICU MessageFormat (`{n, plural, ...}`); Russian needs one/few/many/other.
- Placeholders in braces; never concatenate sentence pieces in code.

### 6.2 Core 15 (translated)

| Key | EN | AZ | TR | RU |
|---|---|---|---|---|
| `today.hero.label` | You can spend today | Bu gün xərcləyə bilərsiniz | Bugün harcayabileceğin tutar | Сегодня можно потратить |
| `today.hero.why` | Why this number? | Bu rəqəm niyə belədir? | Bu rakam neden? | Почему это число? |
| `add.title` | Add expense | Xərc əlavə et | Harcama ekle | Добавить расход |
| `add.save` | Save · {envelope} | Yadda saxla · {envelope} | Kaydet · {envelope} | Сохранить · {envelope} |
| `add.saved` | Saved. {amount} from {envelope}. | Yadda saxlandı. {envelope}: {amount}. | Kaydedildi. {envelope}: {amount}. | Сохранено. {envelope}: {amount}. |
| `common.undo` | Undo | Geri al | Geri al | Отменить |
| `env.pocket` | My pocket money | Mənim payım | Harçlığım | Мои карманные |
| `env.buffer` | Buffer | Ehtiyat | Yedek | Запас |
| `env.overPlan` | {amount} over plan | Plandan {amount} çox | Planın {amount} üzerinde | Сверх плана: {amount} |
| `env.moveMoney` | Move money from another envelope | Başqa zərfdən pul köçür | Başka bir zarftan para aktar | Перенести деньги из другого конверта |
| `review.title` | Period review | Dövrün yekunu | Dönem özeti | Итоги периода |
| `review.confirmLeft` | Confirm all | Hamısını təsdiqlə | Hepsini onayla | Подтвердить всё |
| `status.offline` | You're offline. Everything still works and saves on your phone. | İnternet yoxdur. Hər şey işləyir və telefonunuzda saxlanılır. | Çevrimdışısın. Her şey çalışmaya ve telefonunda kaydedilmeye devam ediyor. | Нет сети. Всё работает и сохраняется на телефоне. |
| `history.empty` | Nothing here yet. Your first expense will show up here. | Hələ heç nə yoxdur. İlk xərciniz burada görünəcək. | Burada henüz bir şey yok. İlk harcaman burada görünecek. | Пока пусто. Первый расход появится здесь. |
| `settings.backup` | Back up your data | Məlumatlarınızı ehtiyat nüsxələyin | Verilerini yedekle | Сделайте резервную копию данных |
| `income.markReceived` | Mark as received | Daxil olub kimi qeyd et | Alındı olarak işaretle | Отметить как полученный |
| `today.daysToIncome` | {n, plural, one {# day} other {# days}} until next income | Növbəti gəlirə {n} gün qalıb | Sonraki gelire {n} gün var | {n, plural, one {До следующего дохода # день} few {До следующего дохода # дня} many {До следующего дохода # дней} other {До следующего дохода # дня}} |
| `settings.lock` | Lock the app | Tətbiqi kilidlə | Uygulamayı kilitle | Заблокировать приложение |

Translator notes: "zərf"/"zarf"/"конверт" is the word for envelope, used in env names; if the translator prefers "kateqoriya/kategori/категория" for clarity in low-literacy testing, swap only in `env.*` keys (A/B in usability, section 9). AZ plural has no inflection after numerals. Azerbaijani/Turkish: avoid forced uppercase (İ/ı). Russian strings are the longest: budget +30-35%.

### 6.3 Remaining library (EN source; translate in the next i18n pass)

Today and hero
1. `today.spentToday` - "Spent today {amount}"
2. `today.nothingSpent` - "Nothing spent yet today."
3. `today.used` - "Today's number is used."
4. `today.tomorrow` - "Tomorrow: {amount}"
5. `today.pastToday` - "You went {amount} past today. The next {n} days are {perDay} each."
6. `today.incomeDue` - "Salary is due today."
7. `today.incomeLate` - "Income was expected {date}. The number assumes it arrives."
8. `today.noIncome` - "Add your income to see your number."
9. `today.comingUp` - "Coming up"

Add and edit
10. `add.amountHint` - "Enter an amount to save."
11. `add.draftSaved` - "Draft saved."
12. `add.largeAmount` - "That's a very large number. Check it?"
13. `add.farDate` - "This date is far away. Is it right?"
14. `add.note` - "Note (optional)"
15. `add.refund` - "This is a refund"
16. `add.overToast` - "Saved. {envelope} is {amount} over plan."
17. `add.moveFrom` - "Move {amount} from {source}"
18. `move.title` - "Move money"
19. `move.done` - "Moved {amount} from {from} to {to}."

Envelopes
20. `env.pocketHelp` - "This money is yours. Spend it freely, no questions."
21. `env.bufferHelp` - "Money you haven't planned lands here automatically."
22. `env.explainer` - "An envelope is money set aside for one purpose."
23. `env.onPlan` - "On plan"
24. `env.aheadOfPace` - "A bit ahead of pace"
25. `env.noPlan` - "No plan yet"
26. `env.unplanned` - "Unplanned money goes to Buffer: {amount}"
27. `env.paid` / `env.notYet` - "Paid" / "Not yet"
28. `env.overdue` - "Overdue by {n, plural, one {# day} other {# days}}"

Income and review
29. `income.expected` - "Expected {date}"
30. `income.added` - "Income added. Plan updated."
31. `income.overSplit` - "That's {amount} more than your income. Reduce something, or it will come from Buffer."
32. `review.leftover` - "Left over"
33. `review.skip` - "Skip for now"
34. `review.covered` - "{envelope} ran {amount} past plan. Cover it from Buffer?"
35. `review.done` - "New period started. Well done."
36. `review.carried` - "Pocket money carries over."

Installments and recurring
37. `inst.new` - "New installment"
38. `inst.progress` - "{paid} of {total} paid"
39. `inst.summary` - "{n} payments of {amount}. Last on {date}."
40. `inst.dueToday` - "{name} {amount} is due today."
41. `inst.payoff` - "Pay off the rest"

Settings, safety, system
42. `settings.lastBackup` - "Last backup: {when}"
43. `settings.noBackup` - "You haven't backed up yet. It takes 10 seconds."
44. `settings.lockWarn` - "If you forget your PIN, a backup is the only way back in. Make one first."
45. `settings.currencyChange` - "Change base currency? Past amounts stay in their original currency."
46. `lock.wrongPin` - "That PIN isn't right. {n} tries left."
47. `err.saveFail` - "We couldn't save this on your phone. Your other data is safe."
48. `err.corrupt` - "We hit a problem opening your data. Your last backup is safe."
49. `err.generic` - "Something went wrong. Your data is safe on this phone."
50. `update.ready` - "A new version is ready."
51. `install.prompt` - "Add Pul Planim to your home screen."
52. `onboard.privacy` - "No account. Your data stays on this phone."
53. `onboard.reveal` - "Here is a first plan you can change anytime."
54. `common.gotIt` / `common.notNow` / `common.close` - "Got it" / "Not now" / "Close"
55. `history.noMatch` - "Nothing matches. Try fewer filters."

---

## 7. Accessibility

### 7.1 Targets (WCAG 2.2 AA, aiming at AAA where cheap)

| Criterion | Target | How |
|---|---|---|
| 1.4.3 Contrast (text) | >= 4.5:1; large >= 3:1 | token pairs computed in 3.1; all >= 4.97 |
| 1.4.11 Non-text contrast | >= 3:1 | border-strong 3.35/3.36, bar graphics, focus ring |
| 1.4.4 Resize text / 1.4.10 Reflow | to 200% without loss; reflow at 320 CSS px with no 2-D scroll | rem sizes, no fixed heights, segmented controls restack |
| 1.4.12 Text spacing | tolerate 1.5 line, 2x paragraph spacing | no clipped containers |
| 2.4.7 / 2.4.11 / 2.4.13 Focus visible/not obscured/appearance | dual ring 3 px + 2 px offset; sticky bars never cover focused element (`scroll-padding`) | tokens |
| 2.5.7 Dragging movements | every drag has a tap alternative (swipe -> menu; reorder -> move buttons) | list item spec |
| 2.5.8 Target size minimum (24) | 48 min used | 3.5 |
| 3.3.7 Redundant entry | defaults and drafts retained | Add sheet |
| 3.3.8 Accessible authentication | PIN by input (paste allowed), biometrics alternative, no puzzle/memory test | Lock |
| 3.2.6 Consistent help | Help always last row in Settings; "Why this number?" in same place | - |
| 4.1.3 Status messages | toasts and amount via live regions | 4.2, 4.10 |

### 7.2 Dynamic type to 200%

- All text in rem; layouts use min-height, flex-wrap, and `min-width: 0`. Verify at 100, 150, 200% in en, ru, tr.
- Hero: `clamp(52px, ..., 72px)` times the user scale; at 200% the hero reaches ~104-144 px, so the panel grows vertically; the horizon dots collapse into a text-only "6 days to next income". The number never wraps; if it can't fit in the width (e.g. 1 234 567 ₼), it steps down one size and shows the currency symbol on the next line start-aligned.
- Rows: envelope row becomes two lines: line 1 name, line 2 amount and bar; status word wraps beneath. Number pad keys stay 64 px minimum and the pad scrolls within the sheet if needed, the Save button remains pinned.
- Chip rows become 2-line wrap lists at >= 150% instead of horizontal scroll.
- Bottom bar labels are always shown; at 200% labels may wrap to 2 lines (bar height auto, min 64).

### 7.3 Screen reader

- Hero: `<button aria-label="You can spend 38 manat today. 12 manat already spent. 6 days until next income. Opens explanation.">`. Currency spoken as the currency name via `Intl.NumberFormat(..., {style:'currency', currencyDisplay:'name'})` for the label (e.g. "38 Azerbaijani manats").
- Progress bar (not a `role=progressbar` on rows to avoid verbosity): row name includes the meaning: "Food & groceries, 120 manat left of 300, a bit ahead of pace." On Envelope detail the bar is `role="meter"` with `aria-valuemin=0 aria-valuemax={plan} aria-valuenow={spent}` and `aria-valuetext="180 of 300 manat spent. Today is day 10 of 20. A bit ahead of pace."`.
- Number pad: key `aria-label`s are digits; the display announces the whole amount, not digit-by-digit.
- Toasts: polite live region; undo reachable.
- Landmarks: `header`, `main`, `nav` (tab bar), headings in order (one `h1` per screen = the screen name).
- Reading order matches visual order; the FAB is last in tab order within the nav landmark but has an accesskey-like skip link: "Add expense" is the first tab stop after the header on Today.
- All icons `aria-hidden` unless standalone; icon-only buttons have `aria-label`.

### 7.4 Reduced motion

`prefers-reduced-motion: reduce` or Settings > Appearance > "Reduce motion": durations 0; sheets fade; the hero crossfade becomes an instant swap; bar fills snap; delight moments show their static end-state plus the text; no parallax anywhere (there is none by default). Skeleton shimmer off. Haptics remain (separate setting "Vibration").

### 7.5 Colour-blind-safe status

Redundant encoding (P5): colour + icon + word + bar pattern (solid / ahead tick gap / hatched overflow). Test with Sim Daltonism / Chrome DevTools vision deficiency emulation for protan, deutan, tritan, achromatopsia: the three states must remain distinguishable by shape and word alone.

### 7.6 One-handed reach

- Bottom 40% hosts every primary action: FAB, Save, Confirm, number pad.
- Sheets anchor to the bottom; titles at top are read-only; Close can also be done by swipe down.
- Left-handed users: Settings > "Layout hand" option is **not** offered (the centered FAB and full-width buttons are symmetrical). The only inline-side-dependent control is Close/Back, which duplicates a gesture.
- On tablets, Add lives on the rail at the inline-start edge; rail position follows reading direction. A tablet "Reach mode" is not needed because bottom sheets are centered.

### 7.7 Other

Haptics optional; sound none; screen-reader language set via `lang` per string; currency read in user locale; time in 24h/12h per locale; date formats via `Intl.DateTimeFormat`; no flashing > 3 Hz anywhere; no time limits (toast undo is also available in History).

---

## 8. Delight moments (restrained)

Rule: delight is a quiet acknowledgement, once, never a game. No confetti, no streak counters, no badges, no sound. All have a static reduced-motion form.

| Moment | What happens | Duration | Copy |
|---|---|---|---|
| **Stayed within plan** (first Today view of a new day when yesterday ended at or under its number) | the horizon wave line at the bottom of the hero draws itself once left-to-right; the hero label gets a second line "You kept {x} from yesterday. It's in today's number." If yesterday was over: nothing special, no "you missed" - the hero simply shows the new number. | 600 ms, once per day | "You kept 6 ₼ from yesterday. It's in today's number." |
| **Under pace all week** | no popup. The envelope status shows "On plan" with a very small check; nothing more. (Under-reward by design: praise should not make over-spend feel like loss.) | - | - |
| **Completing a period** (after Confirm all) | review screen horizon wave settles flat (it is gently wavy throughout), the leftover number animates into its destinations: the amount splits into chips that glide 240 ms into Savings and Buffer rows; light haptic; then the screen resolves to "New period started". | 1.2 s total | "New period started. Well done." (only exclamation-free celebration line allowed) |
| **Savings goal reached** | the savings bar completes; a single ring (brand colour, 2 px) expands once behind the goal icon and fades (`settle` easing, 600 ms); a sheet offers: "Goal reached: {name} {amount}. That's all you." [Set a new goal] [Keep going]. | 600 ms | "Goal reached: {name}. You did that." |
| **First expense logged ever** | the toast has a small extra line: "That's how it works. Two taps." Never repeated. | - | - |
| **Backup done** | toast with `shield-check` icon: "Backed up. Your data is safe." | - | - |

Haptics: light tick for Save and Confirm; none for errors (errors are not alarms).

---

## 9. Usability test script (run against the built app)

Setup: 6-8 participants; at least 2 low confidence with apps, 2 age 50+, languages split AZ/RU/TR/EN (test in the participant's language); own phone (Android majority); think-aloud; no coaching; start from install of the PWA. Record time, taps, errors, and 1-5 ease rating after each task. Post-task: "How did that feel?" (calm / ok / stressed).

| # | Task (read aloud) | Success criteria | Pass threshold |
|---|---|---|---|
| 1 | **First run and first number.** "Set the app up for your own situation, then tell me how much you can spend today." | Completes onboarding unaided; states the hero amount correctly; time from open to reveal <= 60 s. | >= 6/8 under 60 s, 8/8 complete, 8/8 state the number correctly |
| 2 | **Fast capture.** "You just bought a coffee for 4.50. Record it." (repeat with a bus fare and a snack) | Saved in the right/acceptable envelope; <= 2 taps beyond digits; second and third time median <= 8 s from home to toast. | 7/8 within 2 taps; median <= 8 s on repeats; 0 duplicate saves |
| 3 | **Understand the number.** "Why is it that number? Explain in your own words." | Opens "Why this number?"; correctly paraphrases that it is money left divided by days until next income; identifies one thing that would change it. | >= 6/8 paraphrase correctly without prompts |
| 4 | **Recover from overspend.** (Scenario: Food has 10 left.) "You spent 25 on a restaurant. Record it and make the plan work again." | Saves without hesitation; finds and uses "Move money" within 20 s; reports not feeling blamed. | 8/8 save; >= 6/8 use Move money unaided; >= 6/8 rate tone calm/ok |
| 5 | **Income and pay day.** "Your salary arrived today. Show the app." Then: "You bought a phone in 6 installments of 85. Add it." | Marks income as received (amount adjusted if scenario says different); adds installment with correct count/amount/first date; finds where the installment appears in Coming up. | >= 6/8 complete both; <= 90 s for both |
| 6 | **Find, review, back up.** "Find the coffee you recorded last week. Then end this pay period and keep what's left. Finally, make a backup." | Uses search or filter in <= 30 s; completes period review with Confirm all; reaches Back up and completes; states where the lock option is. | >= 6/8 complete all three; backup found in <= 30 s |

Additional probes: (a) language switch to Russian at 200% text, confirm no clipped text; (b) airplane mode: record an expense, confirm users are not worried; (c) concept check: "What is the envelope 'My pocket money' for?" (>= 6/8 correct: money to spend freely without tracking by category); (d) A/B on term "envelope" vs "category" for comprehension in AZ/TR/RU.
Metrics: SUS >= 80; task-level error-free rate >= 85%; "stress" rating after overspend task <= 2/5; zero participants say the number "felt like a judgement".

---

## 10. Implementation notes for the developer

- Import `design-tokens.css` first; components consume only tokens (no hex in component CSS). Dark mode: nothing to do except never hard-code colours; allow `data-theme` override from Settings > Appearance (Auto/Light/Dark).
- Logical properties only: `margin-inline`, `padding-block`, `inset-inline-start`, `border-start-start-radius`, `text-align: start`, `float: inline-start`. Flip only icons that imply direction (chevrons, back arrows, progress fill direction handled by `inline-start`). Do **not** mirror: number pad, digits, play/media icons, the hero horizon line (decorative, but flip it horizontally with `scaleX(-1)` in RTL for naturalness), currency amounts (wrap with `unicode-bidi: isolate`).
- Format with `Intl.NumberFormat` / `Intl.DateTimeFormat` / `Intl.PluralRules` and ICU messages. Store money as integer minor units + ISO currency code; `Intl` for display. Hero uses `Math.floor` on major units.
- Currency symbol size and placement: use `formatToParts` to place symbol before/after per locale; render symbol in a span at 0.5em.
- Number pad: custom component, not `<input>`. Provide hidden `<output>` for accessibility. Support hardware keyboard.
- Fonts: self-host Onest woff2 (latin, latin-ext, cyrillic, cyrillic-ext), precache; `font-display: swap`.
- Sheets: use the `<dialog>` element or an equivalent focus-trap; handle `visualViewport` for the keyboard (Note field).
- Pace marker: `left` position = `elapsedDays / totalDays` as `inset-inline-start: calc(var(--p) * 100%)`.
- Respect `prefers-reduced-motion`, `prefers-contrast`, `prefers-color-scheme`; provide `data-motion="reduce"` toggle.
- Safe areas: bottom bar `padding-block-end: max(var(--safe-bottom), 8px)`; sheet action bar same; `viewport-fit=cover`.
- Lint list to automate: P1 (count of hero/display elements), banned words in EN source, contrast of token pairs (unit test), no `left/right/margin-left` in CSS (stylelint `liberty/use-logical-spec`).
- Visual QA matrix: 4 languages x light/dark x 100/200% text x phone/tablet = 32 screenshots for Today and Add.

## 11. Explicit "not now" (design cut list)

Charts and reports beyond plan-vs-actual bars; donut charts; custom emoji; multiple workspaces switcher UI (the spec supports "workspace" in data but exposes one in v1); shared budgets; arithmetic in the number pad; receipt scan and voice (entry points reserved, flag-gated); push notifications (use in-app cards only; OS notification permissions are not requested in v1); gamification; AI chat; widgets (later, Android first).

## 12. Reconciliation with 02-product-spec.md (PENDING)

When the product spec lands, check:
1. **Hero formula** (5.4) matches the PO's definition, including inclusion of Pocket money (here: excluded from the hero, shown as separate guilt-free envelope), rounding (floor), and handling of late income (assume arrival, never block).
2. **Default envelope set and split** (5.1: Fixed, Flexible, Pocket 10%, Savings 10%, Buffer) and the Buffer-catches-the-rest rule.
3. **Period model**: "period" = pay cycle between incomes; multiple incomes per period (advance + salary) change "days until next income" to the nearest *expected* income.
4. **Scope of v1**: installments, recurring, period review, multi-currency per transaction, lock, backup/export: if any is deferred, hide its entry points (do not show dead buttons).
5. **Terminology**: "envelope" vs "category".
6. **Tablet scope**: market analysis recommends little early tablet effort; this spec keeps the tablet to a layout adaptation (rail + two-pane) that reuses phone components, so the cost is mostly CSS grid and a side-sheet variant.
7. **Quick-save chip behaviour** (5.3) and overspend suggestion order (Buffer first).
8. **Price/Plus gating** if any: no paywall in onboarding or on the hero; Plus features appear only as normal rows in Settings.
