# 07 - Expert walkthrough and heuristic evaluation: "Pul Planim" / Sakin

Author: UX Research | Date: 2026-10-30 | Build: dev server `http://127.0.0.1:5173` (Vite dev build; `Pul Planım` display name in AZ) | Version 1.0

> **READ THIS FIRST. This is an expert / heuristic evaluation, NOT user evidence.**
> One researcher walked the live app and read its code and strings. No real participant took part. Findings are **predictions of usability problems** and **measured facts about the build**. Do not quote any sentence here as "users said / users struggled". Items that need real people are collected in section 9. The usability test that produces real data is specified in `06-usability-test-kit.md`.

Contents: 1 Scope and method - 2 What was measured - 3 Cognitive walkthrough, task by task - 4 Persona deltas - 5 Turkish spot check - 6 Heuristic evaluation - 7 Prioritised issue list - 8 What is working well - 9 Needs real-user confirmation - 10 Evidence limits and state left behind.

---

## 1. Scope and method

### 1.1 What was done
- Read `02-product-spec.md` (principles DR-1..DR-14, personas, success metrics), `03-design-spec.md` (section 9 tasks, onboarding, add expense, Why sheet), `05-localization-glossary.md`, `04-build-notes.md`, `05-delivery-and-security.md`, and the AZ catalog `app/src/i18n/az.ts` (606 keys).
- Cleared the site's IndexedDB (`sakin`) and localStorage in the Browser pane to get a true first run, walked the app at **phone size 375 x 812** (also 360 x 640 for the Add sheet), **light theme, Azerbaijani**, using real taps/clicks on the page (some navigation and measurement via script where marked).
- Re-ran the first run with the **freelancer** setting ("Dəyişir") to see persona C's path live.
- Spot-checked **Turkish** by switching the language (Today screen).
- Computed AZ string statistics with a script (`scratchpad/rl.js`, not part of the product).
- No file under `app/src`, `app/public` or config was changed. At the end the app was restored to sample data, AZ, light, Today (section 10).

### 1.2 Cognitive walkthrough format
For each task, each step lists: **what the user sees**, **what they would try**, **is the next correct action obvious (Y / Partly / N)**, and **friction**. Method follows Wharton's four questions: will the user try to achieve the right effect, notice the correct action, associate it with the effect, and see progress. Predictions assume a typical user of the persona and the AZ labels as shipped.

### 1.3 Which persona paths were walked live and which are analytic
| Task | A Leyla (salaried) | B Murat/Elif (taksit) | C Daniyar (freelancer) | D Aysel (student) |
|---|---|---|---|---|
| T1 First run | **Live** (AZ monthly) | Analytic (two incomes; TR template has an Installments row) | **Live** (Dəyişir path to Today) | Analytic (weekly chip, "Boş başla") |
| T2 Fast capture | **Live** | Same screens | Same screens | Same screens |
| T3 Understand number | **Live** | Analytic | Analytic (cover mode, 30 days) | Analytic |
| T4 Overspend | **Live** | Same screens | Same screens | Pocket money variant analytic |
| T5 Income + installment | **Live** (installment, early income) | **Live** (installment flow); income analytic | Analytic (uncertain income cover prompt) | Analytic |
| T6 Find, review, back up | Partly live (History, Settings > data); **review screen not reachable** without a period boundary | Same | Same | Same |
| T7 What-if | Partly live (Why sheet, tomorrow line) | Analytic | Analytic | Analytic |
| T8 Language / currency | **Live** (TR and back; currency page) | Same | Currency chip analytic | Same |

Where a persona row is analytic, it is marked `[analytic]`. A finding marked `[live]` was observed in the pane.

### 1.4 Task numbering
Tasks T1-T6 are the six tasks of the design spec section 9. T7 = "understand why this number / what would change it" and T8 = "change language and currency" (see `06-usability-test-kit.md` 6.0 for how the duplicate "understand the number" task was resolved).

---

## 2. What was measured (facts about the build, not users)

### 2.1 Taps and time
| Measure | Result | How |
|---|---|---|
| **Onboarding taps, AZ monthly salary, 1 500 income, accept prefills** | **9 taps** (language chip 1, "Başla" 1, digits 4, "Davam et" 2, "Uyğundur" 1). **8** if the device language is already AZ. Non-digit taps: 5 (4). Freelancer path: +1 ("Dəyişir" chip) = 10 / 9. | Click log via an in-page pointer listener |
| Onboarding screens | 5: welcome, 3 numbered inputs ("1 / 4", "2 / 4", "3 / 4"), Today with the number. Spec: 3 input screens + reveal. Met. | Observed |
| Onboarding wall-clock (agent-driven) | "Başla" to "Uyğundur": about 31 s, **dominated by tool latency and a scroll**; not a human time. Keystroke-level estimate for a confident phone user: **about 35-50 s** (9 taps at about 1 s, 3 short reads, 1 scroll). A user who reads the plan list, or a low-confidence user: 60-90 s. | Log + estimate |
| **Add expense taps** | Today > "+" (1) > digits (n) > "Yadda saxla · Yemək" (1). **2 non-digit taps** (meets DR-3). "12" = 4 taps; "4,50" = 6 taps (the decimal key is one of the digit taps). Envelope preselected, so 0 chip taps. | Walked + script |
| Add expense estimated time (KLM) | about 5 s for "12", about 6.5 s for "4.50" for a confident user, if no keypad miss occurs (E-01). | Estimate |
| App-side latency (script clicks; excludes paint) | Sheet in DOM 7 ms after "+"; save to sheet closed 21 ms; save to toast 8 ms. Matches `04-build-notes.md`. | `performance.now` |
| Taps to **add an installment** (AZ) | Today > scroll > "Hamısına bax" (Yaxınlaşanlar) 1 > "Yeni taksit" 1 > name field + OS keyboard > amount field + OS keyboard > "Yadda saxla" 1 > "Yer aç" confirm 1 = **4 non-typing taps**, 2 text entries. Also reachable via Plan screen scrolled to the bottom. | Walked |
| Taps to language change | Today > gear 1 > "Dil" 1 > language 1 = **3**. Back to AZ = +1 (language list still open). | Walked |
| Taps to backup | Today > gear 1 > "Məlumatların nüsxəsini saxla" 1 > button 1 = **3** (optional "Parol" field in the way). | Walked |
| Taps to lock | gear 1 > "Tətbiqi kilidlə" 1 (+ PIN). Visible on the first Settings screen. | Walked |

### 2.2 Reading level and jargon in the AZ strings
(Script on `az.ts`; excludes `a11y`, `demo`, `env`, `kind`, `income` name keys; placeholders replaced by "X".)

| Measure | AZ | EN (same keys) |
|---|---|---|
| Sentences / fragments | 609 | 607 |
| Mean words per sentence | **2.96** (most are labels) | 3.38 |
| Sentences over 12 words (DR-8 limit) | **0 (0.0%)** | 3 (0.5%), longest "plan.makeRoomDone" 15 words |
| Mean vowel-syllables per word | 2.22 | 1.61 (agglutinative language, so higher) |
| Words with 5+ vowel-syllables | 74 (4.1% of words) | 9 |

Verdict: **sentence length is excellent** (the 12-word rule is met everywhere in AZ). Word-length is naturally higher in AZ; the real risk is vocabulary, not syntax.

Domain and jargon-risk vocabulary (number of AZ keys that contain the stem):
`zərf` (envelope) 32, `dövr` (period) 25, `ehtiyat` (buffer) 19, `nüsxə` (backup copy) 19, `köçür` (move) 13, `taksit` 13, `PIN` 13, `valyuta` 8, `məzənnə` (exchange rate) 7, `təxmini` (approximate) 6, plus one-offs `nöqtəli vergül` (semicolon, in the CSV switch), `CSV`, `kateqoriya` (2), `yuvarlaq`. Words for real users to test: **zərf, ehtiyat, dövr, yer aç, nüsxə, məzənnə, əsas valyuta, mövcud məbləğ, nöqtəli vergül** (see E-12, E-13, E-18).
Register: sentences use polite "siz"; two slips to "sən": `settings.quickSaveHelp` ("Yazdığın məbləği...") and `lock.wait` ("...saniyə gözlə").

### 2.3 Layout measurements (Add expense sheet, script-measured)
| Viewport | Chip row height (amount empty) | After first digit | Keypad |
|---|---|---|---|
| 375 x 812 | **18 px** (full height is 50 px; envelope chips visibly cut off) | 50 px; **keypad jumps down 32 px** | all 12 keys on screen after the jump |
| 360 x 640 | **8 px** (chips effectively invisible) | stays 8 px | **"0" key at y 631-695 under the Save bar (608-664); keypad rows 7-9 clipped; "0", decimal and backspace need a sheet scroll** |

(Source: `getBoundingClientRect` on `.chip-row` and keypad buttons.)

### 2.4 Largest-number audit (P1 / DR-1)
Today: hero 54.7 px, envelope amounts 24 px (44%, within the 60% rule). Plan: primary 32 px, row amounts 20 px (**62%, just above the 60% rule**; sev 1). History and Income: single 32 px header amount. The Why sheet has four numbers of nearly equal weight (E-16).

---

## 3. Cognitive walkthrough, task by task

Persona A (Leyla, AZ, monthly salary, 375 x 812) unless stated. Y = obvious, Partly, N = not obvious.

### 3.1 T1 - First run and first number
Scenario: income 1 500 on the 5th, 300 in hand, today is Fri 30 Oct (6 days to the 5 Nov pay day).

| # | User sees | Would try | Next action obvious? | Friction / evidence |
|---|---|---|---|---|
| 1 | Welcome: logo, "Sakin" in English for an en-US browser (language chips English / Русский / Türkçe / Azərbaycanca), "Başla", "Nümunə məlumatla yoxla", "Məlumatlarınız bu telefonda qalır." | Reads the title, taps own language | **Y** | Language follows the device; an AZ speaker on an English-language phone sees English first and must notice the chips (they sit mid-screen, a large gap above the buttons) `[live]`. Brand switches to "Pul Planım" immediately on tapping AZ. Page transition lag: the chip highlights about 1 s later |
| 2 | "1 / 4 Nə qədər maaş alırsınız?", amount "₼ 0", currency chip AZN, five frequency chips, a day-of-month dropdown (default 5), number pad, disabled "Davam et", grey hint "Davam etmək üçün məbləğ yazın." | Types 1500 | **Y** | The pad's bottom row (0, ".", delete) and the Continue button sit **below the fold at 812 px**; the page must scroll, which pushes the title and the amount partly out of view (needed in my walk). Amount then shows **"₼ 1,500"** (EN grouping; AZ readers read a comma as decimal, E-03). Pad decimal key shows "." (AZ typists use ","). Default day "5" is correct only by chance |
| 3 | "2 / 4 Maaşa qədər əlinizdə nə qədər pul var?" prefilled **300** with "Təxmini rəqəm də olar. Sonra dəyişə bilərsiniz." | Accepts or edits | **Y** | Good prefill logic. The prefilled 300 is an estimate of a share of the month; a user who types the real figure is fine. This number is later scaled into every envelope (E-05) |
| 4 | "3 / 4 Budur ilk planınız": **9 editable rows** (Ev 380, Ödənişlər 110, Taksitlər 110, Yemək 330, Nəqliyyat 120, Ailə və hədiyyələr 90, Əyləncə və digər 110, Mənim payım 90, Yığım 80) and a tiny line "Qalan ₼ 80 ehtiyata gedir." Buttons "Uyğundur" and a quiet text link "Boş başla" | Taps "Uyğundur" | **Y** (primary) | 9 rows > DR-9 limit of 7; the user must scroll to see the last rows and the sentence about "ehtiyat"; **"Taksitlər 110" and "Ailə və hədiyyələr 90" are assigned to everyone**; "ehtiyat" is first seen here, undefined; amounts here are **full-month** figures but Today will show **scaled** ones (E-05). The 12-word, calm tone is good |
| 5 | Today. **If the user scrolled on the previous screen, Today opens with the same scroll offset** (observed `scrollY = 212`): the hero panel is above the fold; the first thing visible is the explanation card. After scrolling up: hero "Bu gün xərcləyə bilərsiniz ₼ 21", "Bu gün hələ xərc yoxdur.", a 7-dot horizon line, "Növbəti gəlirə 6 gün qalıb", link "Bu rəqəm niyə belədir?" | Reads the number | **Partly** | **E-04**: the reveal moment can miss the number. Then the card "Bu, gündəlik xərcləriniz üçün pulunuzdur. Növbəti gəlirə qədər bərabər bölünür. **İlk xərcinizi əlavə edin. Aşağıdakı + düyməsinə toxunun.**" competes with the hero for attention on the first screen |
| 6 | Envelope rows: **Ev 76, Ödənişlər 22, Taksitlər 22** ("planda ₼ 76"), Mənim payım 18 | May compare to the plan screen | **N** | Rent was 380 on the plan screen and is **76** here (scaled by 300 / 1 500): "Why is my rent 76?" (E-05) |

Outcome (prediction): completes without help in about 40-55 s; **states the number correctly if it is in view**; understanding of where 21 comes from is not yet supported (see T3). Tap count 9 (8). Hypotheses H5 plausible, H1 at risk.

### 3.2 T2 - Fast capture ("4,50 coffee", then bus, then snack)

| # | User sees | Would try | Obvious? | Friction / evidence |
|---|---|---|---|---|
| 1 | Today, green hero, floating teal "+" (label "Xərc əlavə et") at the bottom centre | Taps "+" | **Y** | The FAB is large and central. Observed once: a "+" tap about 1 s after closing the Why sheet did nothing and following taps hit rows behind it (not reproduced; section 9) |
| 2 | Add sheet "Xərc əlavə et", segmented Xərc / Gəlir / Köçür, amount "₼ 0", **a row of envelope chips cut to a sliver**, "Yemək · ₼ 66 qalıb", chips "AZN" and "··· Bu gün", pad, disabled Save "Yadda saxla · Yemək", hint "Saxlamaq üçün məbləğ yazın." | Types 4 | **Y** | **E-01**: chips collapsed to 18 px (8 px at 360 x 640); the label "··· Bu gün" does not say "date and note" (E-11); the preselected envelope is Food even if opened from another envelope's page |
| 3 | After the first digit the chips unfold and **the pad moves down 32 px** | Types "," or "." then 5, 0 | **Partly** | **Taps 2 and 3 of my fast sequence landed on the pad container and were dropped** (the amount stayed "4"); a person typing at rhythm would see the same. Pad has only "." as decimal key; the amount is then shown as "₼ 4.50" (E-03) |
| 4 | Save is enabled and names the envelope: "Yadda saxla · Yemək" | Taps | **Y** | Excellent affordance: states where the money goes |
| 5 | Toast: "Saxlandı. Yemək zərfindən ₼ 4.50. **Budur, belə işləyir. İki toxunuş.**" + "Geri al"; hero 21 -> 17 and shows "Bu gün xərclənən: ₼ 4.50" | Reads or ignores | **Y** | First-time teaching sentence is good but lengthens the toast. Toast sits over the second envelope row, close to the tab bar (already in known issues) |
| 6 | Repeats for bus and snack | Taps "+", digits, Save | **Y** | Measured 2 non-digit taps each; app latency negligible. On **360 x 640** the "0" key is not reachable without scrolling the sheet (E-01), so "10", "20" and "0,60"-type amounts are slow or missed |

Outcome (prediction): H2 holds on a 375 x 812 phone for careful users (about 6 s), is **at risk** for fast typists (dropped digits) and **fails on short screens**. No duplicate saves seen.

### 3.3 T3 - Understand the number

| # | User sees | Would try | Obvious? | Friction / evidence |
|---|---|---|---|---|
| 1 | Hero link "**Bu rəqəm niyə belədir?** >" (underlined, white on green) | Taps it | **Y** | Clear label; also the whole hero panel is described as tappable in the aria text |
| 2 | Sheet: "₼17" title; "Gündəlik pul — Yemək, Nəqliyyat, Ailə və hədiyyələr, Əyləncə və digər — **₼ 130.00**"; "Növbəti gəlirə qədər günlər (5 noy) **6**"; "**₼ 130.00 / 6 = gündə ₼ 21.66**"; "Bu gün xərclənən: ₼ 4.50. Bu gün qalan: ₼ 17.16."; bullets "Ödənişləriniz və taksitləriniz (₼ 120) artıq ayrılıb.", "Aşağı yuvarlaqlaşdırılıb ki, pulunuz çatsın."; "Hesablamanı dəyiş"; buttons "Aydındır", "Planı dəyiş" | Reads top down | **Partly** | The explanation is arithmetically honest and short, but (a) **three numbers in play (130, 21.66, 17.16) plus the title 17** (E-16); (b) "130" bears no visible relation to the 300 the user typed or the 1 500 income (E-05); (c) "Gündəlik pul" is a new term for "daily money"; (d) "(5 noy)" is an abbreviation; (e) the reserved-bills line is below the fold; (f) the designed line "Bu gün az xərcləsəniz, sabahkı rəqəm artar" (answers "what would change it?") was **not in the sheet text** in my walk |
| 3 | User explains | "Money divided by days" | **Partly** | A user can get "130 divided by 6 days is 21" from the sheet; "17 left today" needs the last two lines. The "what would change it" half of the task is not directly supported |

Outcome (prediction): paraphrase likely OK for the arithmetic (about 130 / 6), but identification of what would change it is weak; H1 at risk without the "tomorrow" line.

### 3.4 T4 - Recover from overspend (Food had ₼ 61.50; I recorded ₼ 80)

| # | User sees | Would try | Obvious? | Friction / evidence |
|---|---|---|---|---|
| 1 | Records 80 with the same flow as T2 | - | **Y** | Save always succeeds (good: DR-5) |
| 2 | Toast: "Saxlandı. Yemək zərfində mövcud məbləğdən **₼ 18.50 çox xərclənib.**" with a text action "Ehtiyat zərfindən ₼ 18.50 köçür" | Taps the action or ignores | **Partly** | Calm in tone, but "mövcud məbləğdən çox xərclənib" ("spent more than available") is abstract; the action text is long and is the only recovery cue. The toast reads like an accusation to some (confirm, section 9) |
| 3 | "Pulu köçür" sheet: To = Yemək, From = Ehtiyat, **18 chips in two groups**, amount "₼ 16.00" (capped by what the Buffer holds), "Ehtiyat zərfində ₼ 16 var. **Yığımdan da əlavə edək?**" (a question with no button), "Gündəlik rəqəm 0 qalır", primary "₼ 16 köçür" | Taps the primary | **Partly** | The suggested source was only part of what was needed; the extra question cannot be answered inline (E-06). 18 chips break DR-9 (E-15) |
| 4 | After "₼ 16 köçür": toast "Ehtiyat zərfindən Yemək zərfinə ₼ 16 köçürüldü." + Geri al. Today: hero **0**, "Sabahkı rəqəm: ₼ 12.30"; Food row "**-₼ 2.50**" in large numerals, rose text "Mövcud məbləğdən ₼ 2.50 artıq" with a **"plus in a circle" icon** | Looks for what to do about 2.50 | **N** | **The plan is not "working again"**; no prompt or hero button appeared for the remaining 2.50; the "+" icon beside a shortfall reads as "add", the opposite of the meaning; rose is close to alarm colour (DR-6 asks for a neutral warm tone) (E-06, E-13) |

Outcome (prediction): saves quickly; finds the Move action because the toast offers it; **may not finish "make the plan work"**; calm rating likely OK but the red-ish row and negative numerals are a risk. H3 partly at risk.

### 3.5 T5 - Income and installment

**T5a income received.** In my first-run state the pay day was 6 days away, so the "Maaş gəldi?" card was not on Today; the user must find Gəlir. From Plan the card "Növbəti gəlir Maaş · ₼1,500 · 5 noy" opens it; "Alındı kimi işarələ" is the large primary button.

| # | User sees | Would try | Obvious? | Friction / evidence |
|---|---|---|---|---|
| 1 | Plan tab > card "Növbəti gəlir" (chevron) | Taps card | Partly | "Gəlir" is not in the tab bar (Bu gün / Planım / Tarixçə); reached through Plan or the Today card |
| 2 | Income screen, primary "Alındı kimi işarələ" | Taps | **Y** | Clear |
| 3 | Toast "Planınız aktivdir. Bu günkü rəqəm: **0**." Then "Necə bölünür" lists Ödənişlər və taksitlər 183, Gündəlik xərclər 83, Mənim payım 18, Yığım 16, **Ehtiyat (qalan ehtiyata gedir.) 1,500** | Reads | **N** | **E-08**: marking the *next* salary as received before the period boundary gives "today's number 0" and parks the money in Ehtiyat. A real user paid a day early would see "you got paid, the number is 0". The row label "Ehtiyat (qalan ehtiyata gedir.)" is a composed string; the list sums to more than the salary |

**T5b installment (Phone, 6 payments, 85).** Path I walked: Today (scroll) > "Yaxınlaşanlar > Hamısına bax" > empty state "Taksit yoxdur... [Yeni taksit]" > sheet.

| # | User sees | Would try | Obvious? | Friction / evidence |
|---|---|---|---|---|
| 1 | Today: the "Yaxınlaşanlar" block is **below the fold** after 4 envelope rows; "Hamısına bax" appears twice with identical labels | Looks for "Taksit" in tabs, "+" sheet (Xərc / Gəlir / Köçür) or the envelope row "Taksitlər" | **N** | **E-10**: no "Taksit" entry on the tab bar or "+"; the envelope row "Taksitlər" opens the envelope page (no add). Entry exists via "Yaxınlaşanlar" (an ambiguous word, "what is approaching") and via Plan |
| 2 | "Yaxınlaşanlar" with tabs Taksitlər / Təkrarlanan / Birdəfəlik and a friendly empty state with a primary button | Taps "Yeni taksit" | **Y** | Good empty state copy ("Taksitlə alırsınız? Bura əlavə edin...") |
| 3 | "Yeni taksit": Ad, "Ödəniş məbləği" + AZN chip, "Ödəniş sayı" stepper with 3 / 6 / 9 / 12 chips (6 preselected), "İlk ödəniş tarixi" native date input (**default today**, shown "30-Oct-2026" with an English month), "Artıq ödənilib" stepper, live line "Ödənişlər: 6 × ₼ 85. Son ödəniş: mart 2027. Cəmi ₼ 510." | Types name, amount | **Y** | Live summary is excellent. Uses **OS keyboard text fields** here instead of the app's pad (inconsistent). **E-02:** typing a lone "." or "," in the amount **crashed the screen** to an error page with the raw English text "The number NaN cannot be converted to a BigInt because it is not an integer" (reload recovered; data safe). Comma decimals ("85,50") were handled correctly |
| 4 | After "Yadda saxla": sheet "Yer aç": "Bunun üçün ₼ 63 daha lazımdır. Bu günkü rəqəm 0 olur (indi 0)." Buttons "**Ehtiyatdan və gündəlik puldan götür**" and "Keç" | Taps primary | **Partly** | "Yer aç" (make room) is understandable by metaphor but new; "Keç" is ambiguous (skip the plan change? skip saving?). Then toast "Əlavə olundu. Gündəlik pulunuzdan ₼ 47 köçürüldüyü üçün gündəlik rəqəminiz indi **0 (əvvəl 0 idi)**." is meaningless when the number did not change (E-09) |
| 5 | List: "Telefon, **6 içindən 1 ödənilib** · ayda ₼ 85", progress bar, "Növbəti: B.e., 30 noy", "Ödəniləcək: ₼ 425" | Reads | **Partly** | The default first date (today) makes payment 1 "paid" immediately; "B.e." (Bazar ertəsi) is cryptic (E-10, E-12) |

Outcome (prediction): the Add form is easy once found; **finding it is the risk (H4)**; first-date default is a latent error for taksit households.

### 3.6 T6 - Find, review, back up
| # | User sees | Would try | Obvious? | Friction / evidence |
|---|---|---|---|---|
| 1 | History: header "Bu dövrdə xərclənib ₼ 169.50" (includes the installment), search field "Xərclərdə axtar" with magnifier, filter chips "Bütün zərflər / Bu dövr / Daha çox" (the last is clipped by design), day groups. Rows: "Yemək / Yemək", "Telefon / Taksitlər · Taksit 1" | Types "qəhvə" | **Y** (search is prominent) | An untitled expense is shown as "Yemək" with subtitle "Yemək", so **searching for "coffee" returns nothing unless a note/merchant was typed**; the Add sheet puts notes behind "··· Bu gün" (E-11) |
| 2 | End the period: the app has no "end period" control. A card "Dövrünüz bitdi. Baxaq?" appears only after the boundary; route `#/review` shows "İndi baxılacaq heç nə yoxdur." before it | Looks for "end period" in Plan / Settings | **N** (until the date passes) | Not walkable; the scripted task needs staged data (E-17). Could not verify "Uyğundur" flow live |
| 3 | Backup: Settings (gear on Today / Plan) > "Məlumatların nüsxəsini saxla" > a page with the title repeated three times, optional "**Parol (istəyə görə, tövsiyə olunur)**" field **before** the primary button, then "Cədvəli yüklə (CSV)" with a switch "**Excel (nöqtəli vergül)**", "Nüsxədən bərpa et", red "Bütün məlumatı sil" | Taps the big button | **Y** | The primary is findable in 3 taps. Jargon: "nüsxə", "Parol" ahead of the action may stall a user, "nöqtəli vergül" is meaningless to most (E-18). Destructive action is separated and last (good) |
| 4 | Lock: Settings first screen, "Tətbiqi kilidlə — Passiv" | Reads | **Y** | Visible without scrolling; good |

### 3.7 T7 - What would change the number?
| # | User sees | Would try | Obvious? | Friction |
|---|---|---|---|---|
| 1 | Hero "0" with "Sabahkı rəqəm: ₼ 12.30" (shown when today is 0) | Reads tomorrow's number | **Y** | Good calm pattern: when today is 0, tomorrow's number is offered |
| 2 | Why sheet "Hesablamanı dəyiş" accordion contains the switch "Gəlir gecikəndə ehtiyatımı hesaba qat" and help text | Opens it | **Partly** | The what-if control is hidden behind a quiet link; the explanation line "Bu gün az xərcləsəniz, sabahkı rəqəm artar" was not seen (E-16). I did not walk the late-income state live |
| 3 | After marking income early: number 0 | - | **N** | E-08: contradicts any prediction the user made |

### 3.8 T8 - Change language and currency
| # | User sees | Would try | Obvious? | Friction / evidence |
|---|---|---|---|---|
| 1 | Today: gear icon (top right of the green hero); **no Settings tab** | Looks in the tab bar | **Partly** | The gear is a small icon without label; History has no gear (observed). 3 taps to reach a language |
| 2 | Settings list: "Dil — Azərbaycanca", "Valyuta — AZN", "Görünüş", "Dövrlər və maaş günləri" | Taps "Dil" | **Y** | Clear |
| 3 | Language list English / Русский / Türkçe / Azərbaycanca; tapping applies instantly | Taps Türkçe | **Y** | Instant, no restart; envelope names created from the template **stay in Azerbaijani** under the Turkish UI ("Yemək", "Taksitlər", "Mənim payım"; by design, but confusing, E-20) |
| 4 | "Valyuta" page: "Valyuta / AZN", "Plandakı hər şey bu valyutada göstərilir.", "Əsas valyutanı dəyiş", "Məzənnələr" explanation | Looks for a way to enter USD | **Partly** | The page title and the first card are the same word; the per-transaction currency (the "AZN" chip in the Add sheet) is not mentioned here; for persona C the foreign-currency path is invisible from Settings. A screen-reader-only string "**az-Latn**" is exposed on this page (E-19) |

---

## 4. Persona deltas (what changes per persona; all `[analytic]` unless marked)

### 4.1 Persona A - Leyla (salaried, two pay days)
- T1: chooses "Ayda iki dəfə" and enters two payments (First 1 100 on the 5th, second 500 on the 20th, per the sample data). The extra step adds taps (day pickers x2). `[analytic]` The seed "maaş + avans" scenario exists in the sample data, so the app supports it.
- T4/T5: "Avans" and "Maaş" are first-class names (`income.advance`). The "Maaş gəldi?" card is the key to her daily rhythm; because of E-08 an early payment shows 0 today.
- Wording fits her best: "Maaşa qədər", "avans". She is the persona the copy was written for.

### 4.2 Persona B - Murat/Elif (taksit household)
- T1: TR template pre-allocates 10% to Taksitlər; the AZ template pre-allocates 7%. They may expect to **enter their existing taksits at onboarding** and cannot (the step is only in Yaxınlaşanlar). `[analytic]`
- T5b is their job: the 6-payment live summary is a strength. First-payment default is today and marks payment 1 as paid (E-10): if the purchase happened last week this is right, otherwise wrong. They will want to add several taksits in a row; the sheet closes to the list each time ("+ Yeni taksit" is visible, good).
- Two pay days (1st and 15th) need "Ayda iki dəfə". Murat and Elif share one phone: no multi-user notion; fine for v1.
- "Zərf" metaphor: probably familiar (Turkish "zarf usulü" budgeting); risk for AZ users is lower than expected. `[analytic]`

### 4.3 Persona C - Daniyar (freelancer, variable income) `[live for onboarding]`
- T1: **"Dəyişir"** chip is available; the title stays "**Nə qədər maaş alırsınız?**" (E-07). Next screen "**Maaşa qədər** əlinizdə nə qədər pul var?" prefilled with the full amount (2 000). Today shows "Bu gün xərcləyə bilərsiniz **28**", "**Növbəti gəlirə 30 gün qalıb**" - a horizon invented from the default cover window while there is no known next income. The hero line is plausible but "next income in 30 days" contradicts "it varies".
- Plan step: the same template incl. "Ailə və hədiyyələr" 90 and Taksitlər 140 (hence zero relevance to a freelancer).
- T5a: "Alındı kimi işarələ" on a weekly or ad hoc income; the "Nə vaxta qədər çatsın?" cover prompt exists (`card.cover`, chips 1 həftə / 2 həftə / 1 ay) `[analytic]`: good for "how long this lasts".
- Currency: the app is AZN-based. A USD payment is entered by the **currency chip inside the Add sheet** and asks for a rate ("Məzənnə"). Settings > Valyuta does not mention this (T8).

### 4.4 Persona D - Aysel (student on allowance)
- T1: "Hər həftə" chip, amount per payment; next-payday date control is a different component (not walked). The template (rent 380, bills, taksit) is **irrelevant to a student with no bills**: she must see "Boş başla", which is a small low-emphasis link under the primary button. `[analytic]` Title still says "maaş". Word "cibxərcliyi" (allowance) exists only as an income name key.
- T2: pocket-money row "Mənim payım — Bu pul sizindir. İstədiyiniz kimi xərcləyin." is warm and the right idea; for D it should be the main thing but it is the **fourth** row on Today.
- T4: overspend on "Mənim payım" has no alert (EXP-12) and uses the Buffer first in the toast (not walked).
- Tone: the app is quiet; low financial literacy risk is concentrated in "ehtiyat", "dövr", "zərf".

---

## 5. Turkish spot check (`[live]`, Today screen after switching to Türkçe)
- Language switch applied instantly; `html lang="tr"`; tab title "Sakin" (the brand switches to Pul Planım only for AZ).
- Strings seen: "Bugün harcayabilirsin", "Yarınki rakam: ₼0,41", "Bu rakam neden?", "Zarfların", "Hepsini gör", "Yaklaşanlar", "Kullanılabilir tutardan ₼2,50 fazla", "Bu para senin. Soru sormadan harcayabilirsin.", tabs "Bugün / Planım / Geçmiş". Register informal "sen", consistent with the glossary.
- **Number format is correct for Turkish ("₼0,41", "₼2,50")**, unlike Azerbaijani (E-03): the same app formats TR with comma decimals and AZ with dots. This confirms that the AZ case is a data gap, not a design intent.
- "Sonraki gelire 36 gün" lacks a closing verb ("kaldı"/"var"); the AZ equivalent has "qalıb" (sev 1, E-12).
- Envelope and installment names remain Azerbaijani ("Yemək", "Taksitlər", "Mənim payım") in the TR UI (E-20).
- No clipping or overflow seen at 375 px. Not checked: RU, 200% text, other screens in TR.

---

## 6. Heuristic evaluation

Ratings: strong / adequate / weak, with the strongest evidence. Issue IDs refer to section 7.

### 6.1 Nielsen's 10
| # | Heuristic | Rating | Evidence |
|---|---|---|---|
| 1 | Visibility of system status | adequate | Strong: toast after every save with Undo, hero crossfade, "Bu gün xərclənən" line, "6 içindən 1 ödənilib" progress, "1 / 4" step counter. Weak: early-income result "Bugünkü rəqəm 0" without saying why (E-08); "indi 0 (əvvəl 0 idi)" (E-09); the sheet's chip row appears only after the first digit (E-01) |
| 2 | Match between system and real world | adequate | Strong: "Maaş", "Avans", "Taksit", "Bu gün xərcləyə bilərsiniz", "Yadda saxla · Yemək". Weak: "maaş" asked of freelancers/students (E-07); "zərf", "Ehtiyat", "Yer aç", "Yaxınlaşanlar", "nüsxə", "nöqtəli vergül", "mövcud məbləğ" (E-12, E-13, E-18); "Hər ay: 5. gün" (E-12); amount shown with EN separators in AZ (E-03) |
| 3 | User control and freedom | strong | Undo on save and on move, soft delete, "Geri" everywhere, draft kept, sheets close by "X" and swipe handle, data erase is separate. Weak: no user-initiated "end period" (E-17); "Keç" meaning (E-09) |
| 4 | Consistency and standards | weak | AZ number format differs from TR and from the glossary (E-03); decimal key "." vs comma typing; registers sən/siz (E-12); two identical "Hamısına bax" links; a "+" icon beside a shortfall (E-13); installment form uses OS keyboards while the rest uses the pad; "Haqqında" appears as section title and row; page title = first card title on the Currency page |
| 5 | Error prevention | adequate | Strong: disabled Save with a visible hint; date max today; "Bu çox böyük rəqəmdir. Yoxlayaq?" guard (`add.bigNumber`); Save never blocked by budget state. Weak: lone "." crashes the installment form (E-02); first payment default marks 1 paid (E-10); keypad jump drops digits (E-01) |
| 6 | Recognition rather than recall | adequate | Strong: Save button names the envelope; envelope chips; live installment summary. Weak: "··· Bu gün" hides date/note/payment/refund (E-11); installments hidden behind "Yaxınlaşanlar" (E-10); settings gear is an unlabeled icon |
| 7 | Flexibility and efficiency | adequate | Preselected envelope, "quick save" setting (off), 2-tap capture. Weak: no shortcut to add a taksit from "+" (E-10) |
| 8 | Aesthetic and minimalist design | adequate | Today is calm and focused. Weak: onboarding plan has 9 rows (E-14); Move sheet has 18 chips (E-15); Plan shows a 32 px total plus four groups; the Why sheet has four competing numbers (E-16); first-run Today shows two paragraphs of explanation above the envelopes |
| 9 | Help users recognise, diagnose and recover from errors | adequate | Strong: calm, reassuring error copy ("Məlumatlarınız bu telefonda təhlükəsizdir"), reload button. Weak: **raw English exception text on the error screen** (E-02); an over-plan state with no further action (E-06) |
| 10 | Help and documentation | adequate | One-time explainers (envelope, first-save toast, "Why" sheet). No searchable help seen on the first Settings screen (a `settings.help` key exists); the Why sheet is the product's best "documentation". Weak: no onboarding explanation of "ehtiyat" |

### 6.2 Product principles (DR rules)
| Rule | Status | Evidence |
|---|---|---|
| DR-1 / P1 one primary number per screen | **Mostly met** | Today 54.7 px vs 24 px rows. Plan rows at 62% of the header (marginal). The Why sheet is a list of equal numbers |
| DR-2 first useful screen < 60 s | **Plausible (estimate 35-55 s)**; E-04 can hide the number | 3 input screens, no account, no permission |
| DR-3 add expense <= 2 taps | **Met** (2 non-digit taps) with a hazard (E-01) | Walked |
| DR-4 every number explainable in one tap | **Partly** | Hero has Why; envelope rows have a detail page; the Plan total "Bu dövrdə qalan ₼ 79.50" is not explained and conflicts with hero 0 (E-16b) |
| DR-5 nothing blocks or scolds | **Mostly met** | Save never blocked; wording neutral. Risk words: "çox xərclənib", "artıq", negative numerals (E-13) |
| DR-6 no red for money state | **Partly** | Over-plan row uses rose/magenta text and a **plus-in-circle** icon; hatched bar. Not pure red, but close; recommend a warm neutral with a clear icon (E-13) |
| DR-7 no streaks/scores | Met | None seen |
| DR-8 plain language, <= 12 words | **Met on length; jargon open** | 0 AZ sentences over 12 words; vocabulary list in 2.2 |
| DR-9 <= 7 list rows, 1 primary + 1 secondary | **Not met in two places** | Onboarding plan 9 rows (E-14); Move sheet 18 chips (E-15) |
| DR-10 undo not confirm | Met | Toasts with Geri al |
| DR-12 touch targets >= 48 / body >= 16 px | Met in the walk | Pad keys 64 px high; chips 48 px |
| DR-13 empty states | Met | "Taksit yoxdur... [Yeni taksit]", "Burada hələ heç nə yoxdur", "Hələ keçmiş dövr yoxdur" |

---

## 7. Prioritised issue list

Severity 0-4 (see the rubric in `06-usability-test-kit.md` section 11): 4 catastrophe, 3 major, 2 minor, 1 cosmetic. "Confidence": H = observed in the app; M = observed plus inference; L = inference only (needs users). Locations are given as **screen > element**; no screenshots.

| ID | Sev | Conf. | Location | Evidence | Recommended fix | Status (2026-10-30, lead engineer) |
|---|---|---|---|---|---|---|
| **E-01** | **3** | H | Add sheet ("Xərc əlavə et") > envelope chip row, number pad, footer hint/Save bar | At 375 x 812 the chip row is **18 px high** (chips visibly cut off) until the first digit, then 50 px, shifting the pad **down 32 px**; two fast taps after the first digit hit the pad container and were dropped. At **360 x 640** the row is 8 px and the pad's bottom row ("0", decimal, delete) sits under the Save bar (keys 631-695, bar 608-664): not reachable without scrolling the sheet. Source: DOM measurements | Make the chip row `flex-shrink: 0` with a fixed height and reserve the footer hint's space always (no height change on first digit). Size the pad rows with `clamp()` from the available height (`dvh`) so all 12 keys and the Save bar fit at 360 x 560. Keep hint and Save in a fixed-height footer. Add an e2e test at 360 x 560 that taps each key | **Fixed.** Chip row never shrinks (`.sheet-body > * { flex-shrink: 0 }`), the hint line keeps its height, keys fire on pointer-down (a fast second tap is never lost), pad rows sized from the viewport height and the detail chips stay on one line. Measured: 375x812 and 360x640 all 12 keys above the Save bar, 0 px movement after the first digit, "4,50" typed fast lands complete. 360x560: one short scroll of the sheet body (keys stay >= 44 px). e2e `walkthrough.spec.ts` (3 sizes) |
| **E-02** | **3** | H | Coming up > "Yeni taksit" sheet > "Ödəniş məbləği" text field | Typing only "." (a user starting with the decimal separator) replaced the screen with the error boundary showing the raw English text "The number NaN cannot be converted to a BigInt because it is not an integer"; reload recovered, data safe. The same parsing may exist in other text amount fields (recurring/one-time, plan edit, income edit, rate field) | Parse defensively (reject NaN/empty, never throw during render); use the app's number pad component for all amounts; never show `error.message` to users (localise or hide detail); add a test that fuzzes every amount field with ".", ",", "-", "1e3", "٣" | **Fixed (Payments work, verified).** `parseAmountInput` never throws / never NaN; every text amount field (payments, income, plan rows, onboarding) uses it; the error screen no longer shows `error.message` in production (dev only). Unit + e2e tests |
| **E-03** | **3** | H (format) / L (misreading) | AZ: onboarding amount display, Add sheet amount, Why sheet, Income, toasts, rows | In AZ the app shows "**₼ 1,500**", "**₼ 4.50**", "**₼ 130.00**" (EN grouping and decimal), while Turkish shows "₼0,41", and `05-localization-glossary.md` states AZ is `1.234,50 ₼`. In Azerbaijani a comma is the decimal separator, so "1,500" can be read as 1.5. The pad key reads "." Cause: `Intl.NumberFormat('az-Latn')` falls back to thin ICU data in this Chromium (the date formatter already works around the same gap) | Give AZ an explicit formatter (separators `.` grouping, `,` decimal, symbol after the number) like `AZ_MON`; label the pad's decimal key with the locale separator; test on a real Android and iOS device (their ICU may differ), and add a test that asserts the AZ string | **Fixed.** The app owns separators per language (`NUMBER_SPECS` in `i18n/index.tsx`): AZ `1.500,50 ₼`, TR `₺1.500,50`, RU `1 500,50 ₽`, EN `$1,500.50`, identical on every engine (Chromium ICU is no longer used for digits). Pad decimal key shows "," (AZ/TR/RU) and is announced "Vergül"; inputs accept "," and "." (and grouped "1.500,50"); screen-reader amounts are spoken in AZ ("4 manat 50 qəpik") when the browser has no AZ data. Unit tests (`i18n.quality.test.ts`, `edge.test.ts`) + e2e. Real Android/iOS not checked |
| **E-04** | **3** | H | Onboarding step 3 > Today (reveal) | Today opened with the previous screen's scroll offset (`scrollY = 212`), so the hero number was **off-screen** at the "first number" moment; the visible content was the explanation card | `scrollTo(0, 0)` on route change and on reveal; move focus to the hero (`aria-live`) | **Fixed.** Every route change (and every onboarding step) scrolls to the top; onboarding -> Today shows the hero at y = 0. e2e |
| **E-05** | **3** | H (observed) / M (impact) | Onboarding step 3 ("Budur ilk planınız") vs Today envelope rows, Why sheet | Plan step shows full-month amounts (Ev 380, Yemək 330); after "money now = 300" Today shows **scaled** values (Ev 76, "planda ₼ 76", Yemək 66) and the Why sheet "Gündəlik pul ₼ 130". Nothing explains the scaling ("rent is 76?"). Persona A/B read their numbers by comparing screens | On step 3 say what the amounts mean ("Növbəti 6 gün üçün" or show both) or show scaled amounts there; on Today label rows "bu dövrdə planda"; add one Why line "300 pulunuzdan 170 ödənişlərə ayrıldı" | **Fixed.** Step 3 says it is a monthly plan and that until the next pay day you have X, split the same way; each row shows "İlk dövr: 76 ₼" (the scaled first-period amount Today will show); the Why sheet adds "İlk dövr qısadır. Plan əlinizdəki 300 ₼ pula görə qurulub." |
| **E-06** | **3** | H | Add sheet toast > "Pulu köçür" sheet > Today row/hero after move | The only suggested source was capped by the Buffer (16 of the 18.50 needed); the hint "Yığımdan da əlavə edək?" is text without a control; after moving 16 the row stayed "−₼ 2.50" with no prompt; hero 0 with no "Pul köçür" button. "Make the plan work again" cannot finish in one pass | Offer a combined source ("Ehtiyat + Yığım") or a second inline button; after a partial move re-show the toast action for the remainder; show "Pul köçür" on the hero when it is 0 and an envelope is short | **Fixed.** Move sheet: To / From are two fields with pickers; when the chosen source is capped, a checked option "Qalan X Nəqliyyat zərfindən götürülsün" takes the rest from the next sources (4.8 order: other flexible with spare money, Buffer, Savings; never Pocket) in the same tap; if nothing can cover it the sheet says calmly that the rest comes out of the next income. The overspend toast now suggests from the state after the expense (flexible donor first). The hero shows "Pul köçür" when it is 0 and an envelope is short. Unit test `planMove` |
| **E-07** | **2** | H | Onboarding step 1 title and step 2 title, "Növbəti maaş günü", Today "Maaşa qədər son gün." | "Nə qədər maaş alırsınız?" and "Maaşa qədər əlinizdə..." stay when the user picks "Hər həftə" or "Dəyişir"; a freelancer and a student have no salary; Today then says "Növbəti gəlirə 30 gün qalıb" for a variable income | Make the question frequency-aware ("Nə qədər pul alırsınız?" / "Cibxərcliyi nə qədərdir?"), replace "maaş" with "gəlir" in the shared screens, and rephrase the horizon for variable income ("Pulunuz təxminən 30 gün çatacaq") | **Fixed.** Step 1 is now an income list (see the founder change below); the title follows the preset ("Nə qədər maaş alırsınız?" / "Hər dəfə nə qədər pul alırsınız?" / "Ayda təxminən nə qədər?"); step 2 says "növbəti gəlirə qədər" / "indi" for non-salary; Today says "Təxminən 30 gün çatacaq" in cover mode |
| **E-08** | **3** | H (observed) / L (frequency) | Income > "Alındı kimi işarələ" > toast and "Necə bölünür" | Marking the next salary received six days early: toast "Planınız aktivdir. Bu günkü rəqəm: 0", hero stays 0, "Ehtiyat" shows 1,500, the split list sums to more than the salary. A person paid a day early (common) sees "paid, but 0 today" | If the income arrives before the period boundary, say so ("Maaş növbəti dövr üçün ayrıldı, dövr 5 noyabrda başlayır. Bu günkü rəqəm dəyişmir") and show the split as a preview of next period | **Fixed.** A scheduled pay received up to 10 days early belongs to the period of its expected date (`eventPeriodDate`, `isEarlyIncome`): today's number, this period's income and the horizon stay; the next period is funded when it starts. Toast: "Növbəti dövr üçün saxlanıldı. Dövrün başlanğıcı: 5 noyabr. Bu günkü rəqəm 21 qalır."; Why sheet and Income page say it too. Unit tests. Spec had no explicit rule; this is the decision |
| **E-09** | **2** | H | "Yer aç" sheet ("Keç") and its confirmation toast | Toast "...gündəlik rəqəminiz indi 0 (əvvəl 0 idi)" when nothing changed; "Keç" does not say what is skipped | Use the "same number" variant when unchanged; rename "Keç" to "İndi yox" or "Plana toxunma" and say the installment is saved either way | **Fixed.** "Keç" -> "Planı olduğu kimi saxla" plus "Ödəniş hər iki halda yadda saxlanılır."; an unchanged number uses "Bu günkü rəqəm X qalır" (no more "indi 0 (əvvəl 0 idi)") |
| **E-10** | **3** | H | Today (below fold) "Yaxınlaşanlar" > "Hamısına bax"; "+" sheet; tab bar; installment form first date | No "Taksit" entry on tab bar or "+" sheet; the block is below the fold behind two identical "Hamısına bax" links; the word "Yaxınlaşanlar" ("approaching") does not say taksit; the first payment date defaults to today and is auto-counted as paid ("6 içindən 1 ödənilib") | Rename to "Ödənişlər və taksitlər"; add "Taksit əlavə et" to the Plan screen header and as a fourth option in the "+" sheet; make the two "Hamısına bax" links distinct; default first date to next month or ask "İlk ödəniş nə vaxtdır?" with chips (Bu gün, Gələn ay, Tarix seç) | **Fixed (Payments work, verified).** Payments tab in the tab bar, "Ödəniş və ya kredit" in the + sheet, first payment defaults to next month and nothing is counted as paid. This pass: Today section renamed "Ödənişlər və taksitlər" and the two links are distinct ("Bütün zərflər", "Bütün ödənişlər") |
| **E-11** | **2** | H | Add sheet > chip "··· Bu gün" and chip "AZN" | The details chip's label is an ellipsis plus a date; notes, payment method, refund toggle are hidden behind it, yet search by note is how users find expenses (T6); the currency chip has no accessible name in the tree | Label "Tarix və qeyd"; show the note field as a one-line "Qeyd (istəyə görə)" row; add `aria-label` to the currency chip and installment radios | **Fixed.** Detail chip reads "Bu gün · Qeyd" (or the note text) with a pencil icon; currency chip is named "Valyuta: AZN". The note field stays one tap away to keep the pad on screen at 360x640 |
| **E-12** | **2** | H | AZ microcopy | "Ehtiyat (qalan ehtiyata gedir.)" row on Income; "Hər ay: 5. gün"; "(5 noy)" and "B.e." abbreviations; "Yer aç"; "Mövcud məbləğdən"; TR "Sonraki gelire 36 gün" without a verb; register slips `settings.quickSaveHelp` and `lock.wait`; "Planım" as tab name | Rewrite: "Ehtiyat", "Hər ayın 5-i", full month/day names where space allows ("5 noyabr", "Bazar ertəsi"), "{amount} çatmır"; fix register; native review of the 15 flagged strings per language (glossary section 6) | **Fixed (partly needs native review).** AZ dates use full names ("5 noyabr", "30 oktyabr, cümə"); "Hər ayın 5-i" with the right suffix; Income split row is plain "Ehtiyat" + sub-line; "{amount} çatmır"; TR "Sonraki gelire 36 gün var"; AZ register fixed in `settings.quickSaveHelp` and `lock.wait`. Not changed: "Planım" tab (lint forbids AZ = EN "Plan"; native review), "Yer aç" title |
| **E-13** | **2** | H (form) / L (feeling) | Today and Plan > over-plan envelope row; toast "çox xərclənib" | Large negative numeral "−₼ 2.50", rose text "Mövcud məbləğdən ₼ 2.50 artıq", a **plus-in-circle** icon next to a shortfall; toast says "mövcud məbləğdən ₼ 18.50 çox xərclənib" | Replace with "₼ 2.50 çatmır" (consistent with `plan.fitShort`) in a warm neutral; use a neutral icon (arrow-left-right / sparkle) instead of "+"; keep the hatched bar; drop the minus on the big amount | **Fixed.** Row and toast say "₼ 2,50 çatmır" (EN "short"); the amount column shows 0, no big negative numeral; status icon is the move arrow, not "+"; over colour changed from rose to a warm brown (light #8A4B2E, 6.7:1 / dark #E8A787, 8.1:1), bar stays hatched |
| **E-14** | **2** | H | Onboarding step 3 | 9 editable rows (limit 7, DR-9); "Taksitlər 110" and "Ailə və hədiyyələr 90" for everyone; "Qalan ₼ 80 ehtiyata gedir." tiny and undefined; "Boş başla" is a low-emphasis link (the right path for a student) | Show 5-6 groups with "Daha çox" expansion; hide Taksitlər until a taksit exists (the app already creates it on demand); give "Boş başla" equal weight for frequency = weekly; add one line "Ehtiyat = planlaşdırmadığınız pul" | **Fixed.** Onboarding plan shows 7 rows; "Taksitlər" and "Ailə və hədiyyələr" sit behind "Daha çox: ..." (still counted); one line defines Ehtiyat; "Boş başla" is a secondary button for weekly / every-2-weeks / varies incomes |
| **E-15** | **2** | H | "Pulu köçür" sheet | Two chip groups with 9 chips each (18 choices), then a stepper, a hint and a question; primary only after scrolling at 375 px | Show "To" and "From" as two tappable fields that open pickers; keep the primary in a sticky bar (it already is) | **Fixed.** "Hara" and "Haradan" are two fields (name + balance) that open a list; no 18-chip wall |
| **E-16** | **2** | H | Why sheet ("Bu rəqəm niyə belədir?") and Plan header | Four numbers (title 17; 130; 21.66; 17.16) of near-equal weight; reserved-bills line below the fold; no line answering "what would change it" in my walk; Plan header "Bu dövrdə qalan ₼ 79.50" shown next to hero 0 on Today (two "left" numbers) | Show as a short receipt (money for everyday spending, ÷ days, = per day, minus spent today = left); put one "if you spend less today, tomorrow's number grows" line as a fixed last row; label the Plan header as "bu dövrdə hamısı (ödənişlər daxil)" or demote it | **Fixed.** Why sheet is a receipt (money ÷ days = a day − spent = left today, only the result bold) and always ends with "Bu gün az xərcləsəniz, sabahkı rəqəm artar."; Plan header now says "Bu dövrdə qalan, Mənim payım və Ehtiyat daxil" |
| **E-17** | **2** | H (absence) | Review ("Dövrün yekunu") | `#/review` shows "İndi baxılacaq heç nə yoxdur." before the boundary; no control to end a period; the scripted usability task needs time travel | Keep auto-boundary behaviour; for tests use the device-date method in the kit; consider a "Dövrü indi yekunlaşdır" only if research shows demand | **Won't fix (by design).** Periods close automatically at the boundary (spec 4.9); a manual "end period" is not added without research evidence. For usability tests use the device-date method in `06` |
| **E-18** | **2** | H | Settings > Məlumatlarınız | Title repeated three times (row, card, button); optional "Parol" field placed before the primary action; "Excel (nöqtəli vergül)" switch; "nüsxə" and "bərpa" are formal | Primary action first, "Parol" in an expander "Parolla qoru"; replace the switch label with "Excel üçün (Azərbaycan/Türkiyə)"; test "nüsxə" against "ehtiyat nüsxə"/"fayl" with users | **Fixed.** Backup card: help line, then the primary button; the password is behind "Parolla qoru (istəyə görə)"; the repeated card title is gone; CSV switch reads "Excel üçün (Azərbaycan, Türkiyə, Rusiya)". "nüsxə" wording left for user testing |
| **E-19** | **1** | H | Settings > Valyuta; installment form | Screen-reader-only text "az-Latn" is exposed; installment-count radios and the currency chip have no accessible name | Remove or localise the sr-only tag; add labels; include in the planned screen-reader pass | **Fixed.** The sr-only "az-Latn" tag is removed; currency chip and income rows have names; axe 0 on all screens and sheets checked |
| **E-20** | **1** | H | Any screen after changing language | Default envelope names stay in AZ under TR/EN/RU UI (design decision) | Tell the user once ("Zərf adları dəyişməyib; istəsəniz Plan > ad ilə dəyişin") or translate unmodified template names | **Fixed.** Switching language renames app-made envelope and income names that still equal the template name in the old language; names the person typed stay |
| **E-21** | **1** | H | Add sheet opened from an envelope detail page | Opened from "Ödənişlər" it preselected Yemək, not the envelope on screen | Preselect the open envelope when the sheet is opened from its page | **Fixed.** "+" on an envelope page preselects that envelope (phone tab bar and tablet rail) |
| **E-22** | **1** | L (once, not reproduced) | Today FAB right after closing the Why sheet | One "+" tap about 1 s after "Aydındır" did nothing and following taps landed on envelope rows | Verify on a real device; check overlay/focus restoration timing | **Could not reproduce.** Closed the Why sheet with "Aydındır", tapped "+" after 1 s with a real click: the Add sheet opened. Keep for the real-device check |
| **E-23** | **1** | H | Plan > row amounts | 20 px vs header 32 px = 62% (rule: <= 60%) | Reduce to 19 px or increase the header to 34 px | **Fixed.** Row amounts on Plan / envelope pages are 19 px (59% of the 32 px primary number) |

**Status summary (2026-10-30, lead engineer):** 21 of 23 fixed (incl. E-02 and E-10 verified from the Payments work; E-12 partly, the rest of its wording waits for a native reviewer), E-17 won't fix (by design), E-22 not reproducible in the pane. Details per row in the last column; implementation notes and test evidence in `04-build-notes.md`, section "Expert walkthrough fixes and the onboarding income list". These are engineering fixes to predicted problems; section 9 still needs real users.

**Top by severity (for the team):** E-01, E-02, E-03, E-04, E-05, E-06, E-08, E-10 (all 3), then E-07, E-09, E-11..E-18 (2).

---

## 8. What is working well (keep)

1. **Two-tap capture.** "+", digits, "Yadda saxla · Yemək": 2 non-digit taps, preselected envelope, Save names the envelope; app latency about 10-20 ms.
2. **Calm first-run.** No account, no permission prompts, no tutorial; 5 screens; prefilled "money now" is intelligent; "Təxmini rəqəm də olar" lowers anxiety.
3. **Today hierarchy.** One dominant number (54.7 px), a plain label ("Bu gün xərcləyə bilərsiniz"), the "Bu rəqəm niyə belədir?" link at the foot, envelopes at 44% of the hero size.
4. **When the number is 0 the app offers tomorrow's number** ("Sabahkı rəqəm: ₼ 12.30"), a graceful, non-scolding pattern.
5. **Undo everywhere** (save, move, receive) and no confirm dialogs for reversible actions.
6. **Installment sheet's live summary** ("6 × ₼ 85. Son ödəniş: mart 2027. Cəmi ₼ 510.") and the friendly empty state.
7. **Short sentences:** 0 AZ sentences over 12 words; error copy reassures ("Məlumatlarınız bu telefonda təhlükəsizdir").
8. **Settings are short and well grouped**; lock and backup are visible in one tap; destructive "Bütün məlumatı sil" is last, separated and rose-coloured only there.
9. **Language switching is instant and complete**; Turkish number formatting is correct; AZ dates use their own tables.
10. **History search is prominent** and the pad/controls meet the 48 px target.

---

## 9. Needs real-user confirmation (do not treat the items above as settled)

| # | Question | Why an expert cannot answer | Where tested in the kit |
|---|---|---|---|
| 1 | Do Azerbaijani users misread "₼ 1,500" / "4.50" (E-03)? | Depends on habit and on the device's own locale data | 6.11 (e), T1, T2 |
| 2 | Do users understand the hero number as "money for everyday spending / days left" (H1)? Do 21 vs 130 vs 300 confuse them (E-05, E-16)? | Needs paraphrase and trust data | T1, T3, T7 |
| 3 | Is the dropped-digit hazard (E-01) real for finger taps and on their own small phone? | Depends on timing, thumb size, device | T2, 6.11 (f) |
| 4 | Do people find installments within 90 s (H4), and which word do they look for ("Taksit", "Ödənişlər")? | First-tap behaviour | T5b |
| 5 | Does the over-plan message feel blaming or calm (H3), including the rose colour, the "−" and "çox xərclənib"? | Emotional response | T4, calm set 9.3 |
| 6 | Do "zərf", "ehtiyat", "dövr", "yer aç", "nüsxə", "mövcud məbləğ" make sense? Does the "pay" ("Mənim payım") read as "my own money"? | Language comprehension; native-reviewer plus users | 6.11 (c, d), probes |
| 7 | Is the salary wording a barrier for freelancers and students (E-07)? | Persona fit | T1 with cards C, D |
| 8 | Does "sən" vs "siz" register matter? | Cultural preference | Open question 2 |
| 9 | Is the "Yaxınlaşanlar" tab name and the gear-only Settings entry findable? | Discoverability | T5, T8 |
| 10 | Is the early-salary result (E-08) common and alarming? | Frequency of early pay is local knowledge | T5a with a staged early payment |
| 11 | Real-device facts: iOS Safari behaviour, low-end Android speed, service worker/offline/install, screen reader, fingerprint/face | Not testable in a desktop pane | Pilot + `05` release checklist |
| 12 | The one-time FAB miss after closing a sheet (E-22) | Not reproduced | Observe during T3-T4 |
| 13 | Does the first-run time stay under 60 s for low-confidence people (P2, P4)? | Human time | T1 stopwatch |

---

## 10. Evidence limits and state left behind

- Single evaluator; no inter-rater check. Findings E-04, E-06, E-08 are about specific states created by my scenario (pay day 6 days away, a purchase larger than the envelope, income marked early); other states may differ.
- Review screen ("Dövrün yekunu" with data), the "Maaş gəldi?" card, RU, 200% text, offline/install and a screen reader were **not** walked.
- The dev server is a Vite dev build, not the production build; behaviour of the service worker and exact performance were not assessed here (see `04-build-notes.md` for the Playwright results).
- The pane's own width kept changing while I worked (the founder was adjusting it); I re-applied the 375 x 812 preset each time. Some clicks were by coordinates on screenshots that lag by 1-2 s; where a result looked odd I re-checked with the DOM.
- During the walk I created, then removed, test data. Final state (verified): sample data loaded ("Nümunə məlumata baxırsınız."), language Azerbaijani, theme light, Today open, viewport mobile 375 x 812.
- No file under `app/src`, `app/public` or config was modified.
