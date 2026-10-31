# 06 - Usability test kit: "Pul Planim" / Sakin

Author: UX Research | Date: 2026-10-30 | Version 1.0 | Audience: founder, researcher/facilitator, designer, developer
Language rule: **participant-facing text is in Azerbaijani** (blocks marked `AZ`); everything else (researcher notes, scoring, analysis) is English.
Companion: `07-expert-walkthrough.md` (an expert/heuristic review of the same 8 tasks; it is NOT user data, but its findings tell you what to watch for and are cross-referenced below as `E-nn`).

**Status of this kit.** No real participant has been tested yet. Every threshold below is a decision rule to be applied to real data. Nothing in this file is evidence about users. Real-user results go into a copy of section 12 (analysis template) and into a new file `08-usability-results.md`.

Contents: 1 Goals and hypotheses - 2 Recruiting and screener - 3 Consent - 4 Running a session on a phone - 5 Facilitator script - 6 The 8 tasks - 7 Think-aloud - 8 After each task (SEQ, calm check) - 9 After the test (SUS, open questions, calm check) - 10 Observation sheet - 11 Severity rubric - 12 Analysis template - 13 Go / no-go - 14 Pilot checklist and logistics.

---

## 1. Goals and the five hypotheses we most need to test

### 1.1 Goals
1. Learn whether a first-time user gets a **correct, trusted "what can I spend today" number** without help (product principle P1/P2, DR-1, DR-4).
2. Learn whether the **daily loop** (add an expense) is as fast and error-free as designed (DR-3: 2 taps + digits).
3. Learn whether the app stays **calm** when the user is over plan (DR-5, DR-6).
4. Learn whether the **taksit (installment)** and **pay-day** concepts are findable and understood by the households that need them most (personas B and A).
5. Produce a go / no-go decision and a ranked issue list (sections 12-13).

### 1.2 Hypotheses

Each hypothesis is falsifiable and has a metric, a pass line, and a "what would change our mind" note. "Risk from expert review" is a pre-test estimate from `07-expert-walkthrough.md`, not data.

| # | Hypothesis | Task | Metric (measured by) | Pass line | Risk from expert review |
|---|---|---|---|---|---|
| H1 | **Users understand the hero number without help.** After onboarding they state the number and, unprompted, explain it as "money left for everyday spending divided by days until next income". | T1, T3, T7 | Correct statement of the number (observer); paraphrase quality 0-2 (section 6); SEQ | T1: 8/8 state the number correctly; T3: >= 6/8 paraphrase correctly with no prompt | HIGH. First-run numbers do not line up (typed "money now" 300 vs "daily money" 130 vs hero; E-04, E-05, E-16). |
| H2 | **Adding an expense takes under 10 seconds and 2 taps beyond digits.** | T2 | Taps (non-digit) and seconds from Today to toast, 3 repeats (stopwatch / screen time-stamps) | 7/8 within 2 non-digit taps; median of repeats 2 and 3 <= 8 s; 0 wrong-amount saves | HIGH on small phones. Layout shift of the number pad and clipped keypad (E-01), decimal separator (E-03). |
| H3 | **Overspend does not cause alarm.** The user records an expense that exceeds the envelope, reports no blame/stress, and can recover. | T4 | Post-task calm rating (calm / ok / stressed), stress 1-5, verbatims; "Move money" used unaided | >= 6/8 rate calm or ok; mean stress <= 2/5; 0 say "judged/blamed"; >= 6/8 find Move money unaided within 20 s | MEDIUM. Wording is neutral but long; recovery can stall with a remainder (E-06, E-13). |
| H4 | **Installments (taksit) are findable and the result is understood.** A taksit household adds a 6-payment purchase and finds it again in "Yaxinlasanlar" (Coming up). | T5b | Unaided success, time, wrong turns, first place tapped | >= 6/8 add it correctly unaided in <= 90 s (with the salary step); first tap lands on a path that works in <= 2 attempts | HIGH. No "Taksit" on any tab or on the "+" sheet; entry is under "Yaxinlasanlar" below the fold (E-10). |
| H5 | **First run completes in under 60 seconds, no account, no help.** | T1 | Seconds from first tap on "Basla" to Today visible with the number in view; taps; abandoned steps | >= 6/8 under 60 s, 8/8 complete | MEDIUM. 9 taps (8 if language already right), but a scroll and a non-resetting scroll position cost time (E-04). |

**Watch items (not hypotheses, but record every time):** reading of amounts such as "1,500" / "4.50" in Azerbaijani (E-03); crashes (E-02); salary wording for freelancer and student (E-07); behaviour on a short phone screen (E-01).

### 1.3 What this study cannot tell you
8 participants support qualitative findings and a rough SUS, not statistics. A single 6/8 vs 7/8 difference is noise; read verbatims and error patterns, not just counts. Real-device facts (low-end Android, iOS Safari, offline, install) can only be seen on real phones (section 4).

---

## 2. Recruiting plan

### 2.1 Sample (8 + 1-2 pilot)
Pilot (not counted): 1-2 colleagues or friends to dry-run the script, the devices and the timing.

| ID | Persona | Age | Phone OS | Phone confidence | Language | Situation to recruit |
|---|---|---|---|---|---|---|
| P1 | A - salaried, two pay days | 29 | Android | high | AZ | Gets avans + maaş; rent; a phone installment |
| P2 | A - salaried, older | 54 | Android | **low** | AZ | Paid monthly; bank SMS user; uses bank app only for balance |
| P3 | B - installment household | 36 | **iOS** | high | AZ (or TR if a TR-speaking facilitator is available) | At least 2 active taksit/credit-card installments; shared household money |
| P4 | B - installment household, older | 51 | Android | **low** | AZ | Taksit for appliances or school; manages household with one phone |
| P5 | C - freelancer | 31 | **iOS** | high | AZ (or EN) | Irregular project income, sometimes foreign currency |
| P6 | C - variable income (driver, seller, tutor) | 45 | Android | medium | AZ | Daily or weekly cash income, no fixed pay day |
| P7 | D - student | 20 | Android | high | AZ | Weekly or monthly allowance, cash heavy, no bills |
| P8 | D - young earner / part-time student | 23 | **iOS** | high | AZ | Allowance + part-time pay |

Coverage check: ages 20-54; Android 5 / iOS 3; low-confidence 3 (P2, P4, P6 medium counts as half); age 50+ 2 (P2, P4); persona A 2, B 2, C 2, D 2. Design spec asks for >= 2 low-confidence and >= 2 age 50+: met. If a Russian or Turkish participant is easy to find, swap P3 or P5 and run the session in their language with a native facilitator; do not run a translated script from AZ.

### 2.2 Where and how
- Sources: researcher's network, a colleague's relatives (not colleagues themselves), a university noticeboard (P7, P8), a local freelancer or driver group (P5, P6), a taksit-using household through a friend-of-friend (P3, P4). Avoid fintech, design and UX professionals.
- Compensation: a fair local gift card or cash (decide with the founder; 30 AZN-equivalent for 60 minutes is a common level for general consumers). Pay even if the participant stops early.
- Scheduling: 60 minutes per session + 15 minutes buffer; at most 3 sessions a day (facilitator fatigue). In person is strongly preferred (phone on a table, see hands). Remote only with screen sharing from the participant's phone, which loses the touch behaviour; avoid for P2 and P4.
- Confirmation message the day before (AZ, below). Ask them to bring their own phone, charged, with the browser they normally use and to **not** clear their phone beforehand.

`AZ` confirmation SMS/WhatsApp text:
> Salam, {ad}! Sabah saat {saat} {yer} ünvanında tətbiq sınağına gözləyirik. Telefonunuzu özünüzlə götürün. Sınaq təxminən 60 dəqiqə çəkir. Sınaqdan keçən sizin biliyiniz deyil, tətbiqdir. Görüşənədək!

### 2.3 Screener (read by phone or form; keep answers on the recruiting sheet, not in session notes)

`AZ` questions (with accept / reject logic in English):

| # | Question (AZ) | Accept / quota |
|---|---|---|
| S1 | Neçə yaşınız var? | 20-55; fill the age spread above |
| S2 | Hansı telefondan istifadə edirsiniz? (Android / iPhone / digər) | Android and iPhone per matrix; reject "keypad phone" |
| S3 | Telefonda yeni tətbiqi özünüz yükləyib başa düşə bilirsiniz? (1 = çətin, 5 = çox asan) | Record; assign low (1-2), medium (3), high (4-5) per matrix |
| S4 | Gəliriniz necə daxil olur? (Ayda bir maaş / ayda iki dəfə - avans və maaş / həftəlik və ya gündəlik / layihə ilə, qeyri-müntəzəm / valideyn və ya təqaüd) | Match persona slot |
| S5 | Taksitlə aldığınız və hələ ödəyib qurtarmadığınız bir şey var? (Bəli, neçə dənə?) | P3, P4: yes, >= 2. Others: any |
| S6 | Pul xərclərinizi izləmək üçün tətbiq, cədvəl və ya dəftərdən istifadə edirsiniz? Hansından? | Mix: at least 2 who track nothing; at most 2 who use a budgeting app |
| S7 | Maliyyə, bank, dizayn və ya proqramçı sahəsində işləyirsiniz? | Reject yes (bank customer-support staff also reject) |
| S8 | Sınaq Azərbaycan dilində keçəcək. Bu sizə rahatdır? | Must be yes |
| S9 | Gözlük, eşitmə və ya əl-barmaq məhdudiyyətiniz varmı ki, bunu qabaqcadan bilməliyik? (Cavab verməmək olar.) | Record accommodations; do not exclude |
| S10 | Oxşar tətbiq sınaqlarında son 6 ayda iştirak etmisiniz? | Reject yes |

### 2.4 Participant ID and data handling
Participant IDs are `P1`...`P8` (never names). The recruiting sheet (name, phone number, screener answers) is stored separately from observation sheets and deleted 30 days after the study. Notes contain no real financial data: use the scenario cards (section 6) so that participants do not reveal their own salary or debts. A participant may use their own figures only if they volunteer, and the observer writes "own data" without the numbers.

---

## 3. Consent

### 3.1 `AZ` consent text (read aloud, then handed on paper or shown on a laptop; collect a tick and initials)

> **Sınaq iştirakçısı üçün məlumat və razılıq**
>
> Biz "Pul Planım" (Sakin) adlı tətbiqi daha rahat etmək üçün sınaqdan keçiririk. Sınaqdan keçən **tətbiqdir, siz deyilsiniz**. Səhv edə bilməzsiniz: harada çətinlik çəkdiyinizi görmək bizə lazımdır.
>
> **Nə baş verəcək.** Təxminən 60 dəqiqə. Telefonda bir neçə tapşırıq yerinə yetirəcəksiniz, düşündüyünüzü ucadan deyəcəksiniz və sonda bir neçə sual cavablandıracaqsınız.
>
> **Sizin pul məlumatlarınız.** Tətbiq məlumatı yalnız bu telefonda saxlayır, heç yerə göndərmir. Sınaqda real maaşınızı və ya borcunuzu yazmağınız **tələb olunmur**; sizə uydurma ssenari kartı veriləcək. Sınaq bitəndə tətbiqdəki məlumat telefondan silinəcək.
>
> **Qeydlər.** Biz kağızda və ya noutbukda yazılı qeydlər aparırıq. **Səs, ekran və ya video qeydi yalnız sizin ayrıca razılığınızla edilir.** Üzünüz heç vaxt çəkilmir. Razılıq verməsəniz, heç nə dəyişmir.
>
> **Gizlilik.** Adınız qeydlərdə yoxdur, yalnız kod (P1, P2...) var. Nəticələrdə sitatlar adsız verilir. Qeydlər 12 ay saxlanılır, sonra silinir. Telefon nömrəniz ayrıca saxlanır və 30 gündən sonra silinir.
>
> **Könüllülük.** İstədiyiniz vaxt, səbəb göstərmədən dayandıra bilərsiniz. Hədiyyə yenə verilir. Hər hansı sualınızı indi və ya sonra verə bilərsiniz.
>
> ☐ Oxudum və iştirak etməyə razıyam.
> ☐ Səs qeydinə razıyam.  ☐ Səs qeydinə razı deyiləm.
> ☐ Ekran qeydinə razıyam.  ☐ Ekran qeydinə razı deyiləm.
>
> Kod: ______   Tarix: ______   Baş hərflər: ______   Tədqiqatçı: ______

### 3.2 English gloss (for the researcher)
Participant is told: it is the app being tested, not them; ~60 min; fictional scenario data; app stores data only on the phone; written notes only, audio/screen recording only with separate opt-in, never the face; ID codes only; quotes anonymous; notes kept 12 months; phone number separate and deleted after 30 days; voluntary, can stop any time, incentive paid regardless; checkboxes for consent, audio, screen.
Have a lawyer or the company's privacy owner confirm that this text satisfies local personal-data law before the first session. If a minor (under 18) is ever recruited, a guardian must sign; the matrix above does not include any.

---

## 4. Running a session on a phone

### 4.1 Giving the participant the app (three ways, in order of preference)

| Option | Use when | Steps | Limits |
|---|---|---|---|
| **A. Deployed HTTPS URL** (best) | You need the real PWA: install, offline, lock/biometrics, honest performance | Deploy `app/dist` to Netlify / Cloudflare Pages / GitHub Pages per `docs/05-delivery-and-security.md` section 1 (static site, HTTPS, headers, serve at domain root). Put the URL on a short QR code. Open it in the participant's own browser. | Needs a hosting account; ship a build tagged "usability" so you know what was tested; record `Versiya` shown in Ayarlar > Haqqinda. |
| **B. LAN preview** | No deployment yet; quick sessions in one room | On the laptop: `cd app && npm run build`, then serve the build to the network. `npm run preview` in this repo is pinned to `--host 127.0.0.1`, so use `npx vite preview --host 0.0.0.0 --port 4173 --strictPort` (appending `-- --host` to the npm script gives two `--host` flags; check that it binds before the session). Find the laptop IP (`ipconfig`), allow port 4173 in the Windows firewall (private network only), join phone and laptop to the **same Wi-Fi**, open `http://<laptop-ip>:4173` on the phone. | `http://<ip>` is **not a secure context**: the service worker, install-to-home-screen, offline mode and fingerprint/face lock will **not** work and results on those features are invalid. Plain data entry and all screens do work. Disable "client isolation" on guest Wi-Fi or use a phone hotspot. |
| **C. USB reverse (Android only, secure context)** | You want offline/PWA behaviour on a researcher-owned Android without hosting | Enable USB debugging, `adb reverse tcp:4173 tcp:4173`, run the preview on the laptop, open `http://localhost:4173` on the phone. `localhost` counts as a secure context, so the service worker works. | Only for researcher-owned phones; the participant's own phone is better for realism (A). |

Use **device in portrait, default font size, default browser zoom**. Before each session: open the URL in a **new private/incognito tab or a fresh browser profile** so IndexedDB starts empty; after each session erase data (Ayarlar > Məlumatlarınız > Bütün məlumatı sil, or clear site data) and close the tab. Record: device model, OS version, browser, viewport size if visible, font size setting, app version, date.

One researcher-owned reference device on each of: a 360 x 640-class Android (small and cheap), a current mid-range Android, an iPhone. Run P2 and P4 on the same small Android if their own phone is tiny; if their own phone is used, note its size (expert review E-01 predicts trouble on short screens).

### 4.2 Staging (what must be prepared before each session)
- Onboarding is T1, so start from empty. Prepare the scenario card (section 6.1) for the participant's persona.
- T4 (overspend) needs a known Food balance. Read "Yemək ... qalıb" in the Add sheet or on Today after T2, then set the restaurant amount to **that balance + 15** (round to a whole number). The facilitator does this arithmetic live; do not pre-fill.
- T5a (salary arrives today): the app only offers "Maaş gəldi?" on or after the pay day. Create the situation by choosing, in T1, a card whose pay day equals the **day-of-month of the session**. Dry-run it in the pilot to confirm the card appears. If it does not, use Gəlir > "Alındı kimi işarələ" and note it. Do **not** treat an early "received" result (hero 0, money lands in Ehtiyat, E-08) as participant error; log it as a product issue.
- T6 (end of period): the review card appears only after the period boundary. Before T6 advance the **device date** to the day after the participant's next pay day (Settings > Date, auto time off) and reopen the app, then restore the date at the end of the session. Dry-run this in the pilot; the expert walkthrough could not reach the review screen without time travel (E-17).
- Install a stopwatch app or use screen-recording-with-timestamps only if the participant consented. Otherwise the second observer keeps time.

### 4.3 Roles and room
Facilitator (talks, never touches the phone), note-taker (observation sheet, timer, taps). Participant sits side by side with the facilitator, phone flat on the table or in a hand, whichever they use naturally. A webcam pointed at the phone is optional and consent-gated. Quiet room; phone on Do Not Disturb so that messages do not interrupt.

### 4.4 Session timeline (60 min)
| Min | Block |
|---|---|
| 0-5 | Welcome, consent, device check, background questions |
| 5-13 | T1 first run |
| 13-18 | T2 fast capture x3 |
| 18-22 | T3 understand the number |
| 22-28 | T4 overspend |
| 28-36 | T5 income + installment |
| 36-44 | T6 find, review, back up |
| 44-48 | T7 what-if |
| 48-52 | T8 language and currency |
| 52-60 | SUS, open questions, calm check, thanks, incentive, erase data |

Tasks are always run in this order (the later ones depend on data from earlier ones). If time runs out, drop T8 first, then T7; never drop T1-T5.

---

## 5. Facilitator script (exact wording)

Say the `AZ` lines as written. Italics are for the researcher only. Keep the voice flat and friendly; do not praise or react to results.

### 5.1 Welcome (2 min)
> Salam, {ad}, xoş gəlmisiniz. Mənim adım {ad}. Bu gün sizinlə pul planlama tətbiqini sınaqdan keçirəcəyik. **Sınaqdan keçən sizin biliyiniz deyil, tətbiqdir.** Səhv cavab yoxdur. Mən tətbiqi hazırlayan komandanın üzvü deyiləm ki, incimiş olum; nə düşünürsünüzsə, olduğu kimi deyin, bu bizə ən çox kömək edən şeydir.
> Yanımda {ad} qeydlər aparır. Sınaq təxminən bir saat çəkir. İstədiyiniz vaxt fasilə istəyə və ya dayandıra bilərsiniz.
> Gəlin razılıq formasına baxaq. *[read consent section 3.1; collect ticks]*
> Sizə uydurma ssenari kartları verəcəyəm; öz real pul məlumatınızı yazmağınız lazım deyil.

### 5.2 Background questions (3 min; no leading)
1. Adətən pulunuzun nəyə getdiyini necə izləyirsiniz? *(probe: "Bunu necə edirsiniz?")*
2. Ay ərzində "bu gün nə qədər xərcləyə bilərəm" sualını özünüzə verirsiniz? Necə cavab tapırsınız?
3. Telefonda pulla bağlı hansı tətbiqlərdən istifadə edirsiniz?
4. Son dəfə pulunuz ayın sonuna çatmayanda nə hiss etdiniz? *(optional; skip if the participant looks uneasy; this calibrates the anxiety questions later)*

### 5.3 Think-aloud instruction and practice (2 min) - see section 7.

### 5.4 Opening the app
> Telefonunuzda bu ünvanı açın / bu QR-kodu oxudun. *[hand over the link]* Bu, tətbiqin ilk dəfə açılışıdır. Mən heç nə göstərməyəcəyəm. Hazırsınızsa, ilk tapşırıqdan başlayaq.

Read each task prompt exactly (section 6). Hand over the scenario card. Do not explain any word, button or screen.

### 5.5 Neutral probes (use only these; ask after the participant finishes or is silent > 10 s)
| Situation | Say (AZ) | English meaning |
|---|---|---|
| Silent | Nə düşünürsünüz? / İndi nə baş verir? | What are you thinking? |
| Hesitating on screen | Bu ekranda nə görürsünüz? | What do you see here? |
| Before a tap | Bunu basanda nə olacağını gözləyirsiniz? | What do you expect to happen? |
| After a surprise | Bu sizi təəccübləndirdi? Nə gözləyirdiniz? | Surprised? What did you expect? |
| Asks "should I tap X?" | Siz nə edərdiniz? | What would you do? |
| Asks "is this right?" | Siz necə düşünürsünüz? Sizin üçün düzgündürmü? | What do you think? |
| Asks what a word means | Sizcə nə deməkdir? | What do you think it means? |
| Participant stops | Bu sizin üçün nə deməkdir? | What does that mean for you? |

Never say: "düyməni bura basın", "bax, burada yazılıb", "bu çətin deyil", "yaxşı", "düzdür", "səhvdir". Never answer a question about the app; write it down.

### 5.6 Help ladder (record the level used; any level >= 1 means "assisted", not "unaided")
| Level | When | Say (AZ) |
|---|---|---|
| 0 | Default | (nothing) |
| 1 | Stuck > 60 s or the participant asks for help | Tətbiqdə başqa harada baxmaq olar? |
| 2 | Stuck > 90 s after level 1 | Ekranın {aşağı / yuxarı} hissəsinə baxın. |
| 3 | Stuck > 2 min or the participant is distressed | Gəlin bunu birlikdə edək. *(facilitator shows; mark FAIL)* |

Time limit per task (section 6). When the limit passes, say "Çox sağ olun, bu tapşırığı burada saxlayaq" and move on without drawing attention.

### 5.7 Closing
> Sınaq bitdi, çox sağ olun. Sizin dedikləriniz bizə çox kömək edəcək. Telefondakı sınaq məlumatını indi siləcəyəm. Sualınız varmı? *[incentive; thank; erase data in front of them: Ayarlar > Məlumatlarınız > Bütün məlumatı sil]*

---

## 6. The 8 tasks

### 6.0 How the 8 tasks were assembled
Tasks 1-6 are the six tasks of `03-design-spec.md` section 9 with the same pass thresholds. Task 7 and Task 8 are added. The spec's task 3 already asks the participant to explain the number from the "Why this number?" sheet; the founder's brief also asked for "understand why this number". To avoid a duplicate, **T3 stays the paraphrase task and T7 tests the deeper skill: using the explanation to predict what will change** (what-if and trust). T8 is language and currency.

### 6.1 Scenario cards (AZ; fictional; one per persona; the participant keeps it on the table)
Today's date is whatever the device shows. Choose the "pay day" figure so that the numbers are easy.

**Kart A (Leyla, maaşlı):**
> Siz aylıq 1 500 manat maaş alırsınız (ayın 5-də). Avans yoxdur. Elə bu gün ayın {bu gün}-dir, ona görə növbəti maaşa {n} gün qalıb. Əlinizdə təxminən 300 manat var. *(for two-pay variant use P1: Ayda iki dəfə, 20-də 500 və 5-də 1 100)*

**Kart B (Murat/Elif, taksitli ailə):**
> Ailənizin aylıq gəliri 1 800 manatdır, ayın 1-də. Maaşa qədər əlinizdə 400 manat var. Taksitlə telefon almısınız (altı ödəniş, ayda 85 manat).

**Kart C (Daniyar, sərbəst):**
> Siz layihə ilə işləyirsiniz; adətən ayda təxminən 2 000 manat qazanırsınız, amma tarixlər dəyişir. İndi əlinizdə 900 manat var.

**Kart D (Aysel, tələbə):**
> Valideynləriniz sizə hər həftə 80 manat göndərir. Bu gün əlinizdə 60 manat var.

Where a task names "the salary", "the paycheck" or "the money" use the participant's own card word (maaş / pul / cibxərcliyi).

### 6.2 Task table (overview)

| # | Task | Primary hypothesis | Time limit | Core for launch gate? |
|---|---|---|---|---|
| T1 | First run and first number | H5, H1 | 3 min | Yes |
| T2 | Fast capture (x3) | H2 | 90 s each | Yes |
| T3 | Understand the number | H1 | 2 min | Yes |
| T4 | Recover from overspend | H3 | 3 min | Yes |
| T5 | Income and installment | H4 | 4 min total | Yes |
| T6 | Find, review, back up | - | 5 min | No (secondary) |
| T7 | What would change the number? | H1 (trust) | 3 min | No (secondary) |
| T8 | Change language and currency | - | 3 min | No (secondary) |

For every task the observer records: result (S / P / F), unaided or assisted level (help ladder), time, non-digit taps, errors, quotes, severity 0-4 (section 10 sheet). Then the facilitator asks the SEQ and the calm check (section 8).

### 6.3 T1 - First run and first number (spec task 1)
- **Setup:** empty app, card in hand, phone at the browser start page.
- **Read aloud (AZ):** *"Bu karta baxın. Tətbiqi bu vəziyyətinizə uyğun qurun, sonra mənə deyin: bu gün nə qədər xərcləyə bilərsiniz?"*
- **Do not say:** the word "onboarding", the names of buttons, the number of steps.
- **Success (S):** completes setup unaided (help level 0), states the hero amount that is on the screen (+/- the rounding, whole-unit "floor"), and states it **in context** ("this is what I can spend today"). **Partial (P):** completes with help level 1 or states the number but misreads it (for example reads "1,500" as one and a half). **Fail (F):** abandons, needs level 2-3, or cannot state the number.
- **Time target:** open to number in view <= 60 s (stopwatch from first tap on "Basla" until the hero number is fully visible). Pass: >= 6/8 under 60 s, 8/8 complete, 8/8 state the number correctly.
- **Metrics:** total taps (expert count for AZ monthly path: 9 with the language chip, 8 without; count digit taps separately), screens seen (welcome + 3 steps + Today), hesitation points, language chosen unaided, errors.
- **Watch for (from expert review):** hero hidden because Today opens scrolled (E-04); amount display format (E-03); salary wording for freelancer/student cards (E-07); "Qalan ... ehtiyata gedir" first use of Ehtiyat; plan screen amounts vs Today amounts (E-05); non-bill persona hunting for "Boş başla".
- **Probes (after the number is stated):** "Bu rəqəm sizə nə deyir?" "Bu rəqəm sizə düzgün gəlir?" "Ekranda başqa nə gözünüzə dəydi?"

### 6.4 T2 - Fast capture (spec task 2)
- **Setup:** Today with the number visible; no sheet open.
- **Read aloud:** *"Siz indicə 4,50 manata qəhvə aldınız. Bunu tətbiqə yazın."* After it is saved: *"İndi avtobusa 0,60 manat verdiniz. Bunu yazın."* Then: *"Bir də qəlyanaltı 2 manat. Bunu yazın."*
- **Success:** each expense saved with the right amount in an acceptable envelope; <= 2 taps beyond digits; no duplicate saves; no wrong amount. **Partial:** correct amount but 3-4 non-digit taps, or fixed an error. **Fail:** wrong amount saved and not noticed, or cannot find how to start.
- **Time target:** home screen to toast. 1st: <= 15 s (learning); 2nd and 3rd: median <= 8 s. Pass: 7/8 within 2 non-digit taps, median repeats <= 8 s, 0 duplicates.
- **Metrics:** non-digit taps; digit-tap errors (a digit that did not register); seconds; how the decimal separator was entered (the keypad shows "." in AZ; participants may reach for ","); whether the participant looked at the envelope chips.
- **Watch for:** keypad jumping after the first digit and dropped taps (E-01); clipped bottom row on a short phone (E-01); reading of "4.50" (E-03); whether the participant understands the toast ("Saxlandı... Budur, belə işləyir. İki toxunuş.").
- **Probes:** "Bunu yazarkən nə düşündünüz?" "Hansı zərfə düşdü, bilirsiniz?"

### 6.5 T3 - Understand the number (spec task 3)
- **Setup:** Today.
- **Read aloud:** *"Bu rəqəm niyə belədir? Öz sözlərinizlə izah edin."*
- **Success (paraphrase score 0-2):** 2 = says in own words that it is the money available for everyday spending divided by the days left until the next income, and **names one thing that would change it** (e.g. spending today, a payment, income arriving). 1 = partly right (mentions days or an amount, not the link). 0 = wrong or "I don't know". S = 2 without prompts; P = 1 or 2 with a prompt; F = 0.
- **Time target:** <= 2 min. Pass: >= 6/8 score 2 without prompts.
- **Metrics:** opened the sheet unaided (first tap: the "Bu rəqəm niyə belədir?" link in the green hero panel), how far they scrolled, which line they read first, words used for "Gündəlik pul".
- **Watch for:** confusion between the amount they typed as "money now" and the "Gündəlik pul" in the sheet (E-05, E-16); three numbers on one sheet (E-16); whether the participant finds the line about reserved bills, which sits below the fold; abbreviation "(5 noy)".
- **Probes:** "Bu sətir nə deməkdir?" *(point at a line only after they have spoken)*; "Başqa kimsə bunu sizdən soruşsa, nə deyərdiniz?"

### 6.6 T4 - Recover from overspend (spec task 4)
- **Setup:** read the Food balance on Today. Restaurant amount = balance + 15 (whole number).
- **Read aloud:** *"Siz restoranda {X} manat xərclədiniz. Bunu yazın və planınızı yenidən işlək hala gətirin."*
- **Success:** saves without hesitation; finds and uses the **Pul köçür** path (toast action or the Move sheet) within 20 s of seeing the over-plan message; ends with the over-plan row cleared or the participant says it is fine. **Partial:** saves, notices the message, moves part of the money. **Fail:** cannot save, or does not notice any way to adjust the plan.
- **Time target:** save <= 15 s; move <= 20 s after the toast appears. Pass: 8/8 save; >= 6/8 use Move money unaided; >= 6/8 rate calm or ok.
- **Metrics:** hesitation before Save (any "am I allowed?" comment); did they read the toast; first tap after the toast; whether the Buffer was enough; residual over-plan after the move; tone words they use ("günah", "pis", "qırmızı", "təhlükə").
- **Watch for:** toast text ("mövcud məbləğdən ... çox xərclənib" - do they understand it?), the single suggested source being capped by the Buffer so that a remainder is left (E-06), a hero of 0 with no action, rose-coloured row and a "plus in a circle" icon beside the over message (E-13), the primary button below the fold on a small sheet.
- **Probes (calm check follows immediately, section 8.2):** "Bu mesajı oxuyanda nə hiss etdiniz?" "Tətbiq sizinlə necə danışırdı?"

### 6.7 T5 - Income and installment (spec task 5)
- **Setup:** salary arrives today (see 4.2). Participant is on Today.
- **T5a read aloud:** *"Bu gün {maaşınız / pulunuz} gəldi. Tətbiqə göstərin."*
- **T5b read aloud:** *"Siz telefonu 6 hissəyə (taksitlə) aldınız, hər ay 85 manat. Bunu tətbiqə əlavə edin. Sonra mənə göstərin ki, bu ödənişi tətbiqdə hardan görmək olar."*
- **Success:** T5a: marks income received (or enters a different amount if the card says so). T5b: creates an installment with name, amount, 6 payments, a sensible first date; sees the "Yer aç" (make room) step if it appears and finishes it; finds the installment again under "Yaxınlaşanlar". **Partial:** completes with help level 1 or needs > 2 wrong turns. **Fail:** cannot find where to add an installment.
- **Time target:** <= 90 s for both (spec). Pass: >= 6/8 complete both.
- **Metrics:** first place tapped for T5b (Plan? "+" sheet? envelope "Taksitlər"? Settings?), number of wrong screens, whether they scroll to "Yaxınlaşanlar" on Today, whether they type the amount using the OS keyboard (the installment form uses text fields, not the number pad), first-payment date they accept (the form defaults to today and counts that payment as paid), reaction to "6 içindən 1 ödənilib".
- **Watch for:** no "Taksit" word in the tab bar or the "+" sheet (E-10); the default first date; a crash if the participant types only a decimal separator into the amount field (E-02); the toast "indi 0 (əvvəl 0 idi)" (E-09); the hero after receiving income early (E-08).
- **Probes:** "Siz burada nə axtarırdınız?" "Taksit sözü ilə nəyi gözləyirdiniz?" After T5b: "Bu ödəniş bu ayın rəqəminə necə təsir etdi?"

### 6.8 T6 - Find, review, back up (spec task 6)
- **Setup:** the device date has been advanced to just after the period boundary (4.2); at least 5 expenses exist, one with a note "Qəhvə" dated "last week" (the facilitator adds it via the Add sheet's details row before the session, or the participant recorded it in T2).
- **Read aloud:** *"Keçən həftə yazdığınız qəhvə xərcini tapın. Sonra bu dövrü bitirin və qalan pulu saxlayın. Axırda məlumatlarınızın nüsxəsini saxlayın. Və mənə deyin: tətbiqə PIN kilidi harada qoyulur?"*
- **Success:** finds the coffee entry via search or filter in <= 30 s; completes the period review with the "Uyğundur" (confirm) button; reaches the backup screen and saves a backup (Parol optional) in <= 30 s; states the lock path (Ayarlar > Tətbiqi kilidlə). **Partial:** any one step needs help level 1. **Fail:** cannot complete two or more steps.
- **Time target:** search <= 30 s; backup <= 30 s from "go". Pass: >= 6/8 complete all three; backup found in <= 30 s.
- **Metrics:** use of search vs scrolling; what they typed ("qəhvə", "4,50"); the History row subtitle; where they looked for backup (Today card? Settings gear?); reaction to the optional Parol field; reaction to the Excel "(nöqtəli vergül)" toggle on the same page.
- **Watch for:** History rows of untitled expenses read "Yemək / Yemək" so searching by item name fails unless a note was typed; the review card on Today and the word "Dövr"; the backup screen's jargon (E-18); no user-initiated way to end a period before the boundary (E-17).
- **Probes:** "Bu sözü ("nüsxə") siz necə başa düşürsünüz?" "Parol nə üçündür?"

### 6.9 T7 - What would change the number? (added; trust and prediction)
- **Setup:** Today with the sheet closed.
- **Read aloud:** *"Fərz edin ki, bu gün heç nə xərcləmirsiniz. Sabah bu rəqəm necə olacaq? Bəs maaşınız bir həftə gec gəlsə, nə olacaq? Əvvəlcə fikrinizi deyin, sonra tətbiqdə baxa bilərsiniz."*
- **Success (0-2):** predicts direction correctly for both (no spend: tomorrow's number is larger; late income: the app keeps counting with the Buffer, or the number falls) **before** looking; then verifies in the app by opening "Bu rəqəm niyə belədir?" and the late-income switch ("Gəlir gecikəndə ehtiyatımı hesaba qat"). S = both predictions right and verified; P = one right or verified with help level 1; F = cannot predict and cannot find the explanation.
- **Time target:** <= 3 min.
- **Metrics:** prediction accuracy; whether they trust the number after verification (1-5); whether the "Sabahkı rəqəm" line on the hero (shown when the number is 0) or the line "Bu gün az xərcləsəniz, sabahkı rəqəm artar" helps; reaction if the app shows a surprising 0.
- **Watch for:** E-16 (the "tomorrow grows" line is not visible in the sheet in our walk); E-08 (income received early gives 0 today).
- **Probes:** "Bu rəqəmə nə qədər etibar edirsiniz, 1-dən 5-ə?" "Nə olsaydı etibarınız artardı?"

### 6.10 T8 - Change language and currency (added)
- **Setup:** Today.
- **Read aloud:** *"İndi tətbiqi türk dilinə çevirin. Sonra yenidən azərbaycan dilinə qaytarın. Sonra bu pul vahidinin nə olduğunu və hardan dəyişdirilə biləcəyini mənə göstərin (dəyişməyin)."* For persona C also: *"Tutaq ki, bir xarici müştəri sizə 100 dollar ödədi. Bunu necə yazardınız?"*
- **Success:** language changed and restored within 60 s unaided (Ayarlar > Dil, applies instantly); finds the currency page; for the C card finds the currency chip in the Add sheet or Income entry. **Partial:** help level 1. **Fail:** cannot find Ayarlar.
- **Time target:** <= 60 s for language; <= 60 s to locate the currency page.
- **Metrics:** how they reach Settings (gear on Today / Plan; there is no Settings tab); do they notice that envelope names stay in the original language (E-20); do they understand "Əsas valyutanı dəyiş" (base currency) vs the chip in the Add sheet; correct reading of amounts after the switch (AZ shows "1,500", TR shows "1.500"; E-03).
- **Probes:** "Nə dəyişdi?" "Bu ad (zərf adı) niyə dəyişmədi sizcə?"

### 6.11 Additional probes (from the design spec, plus two from the expert review)
(a) **200% text / Russian:** one session (P2 or P4) at the phone's largest font size; ask them to read the hero and add an expense. If a Russian speaker is recruited, switch to Русский at 200% text and confirm nothing is clipped.
(b) **Airplane mode:** *"Telefonu təyyarə rejiminə qoyun. Bir xərc yazın."* Ask: "Bu sizi narahat etdi?" (works over option A or C, not B).
(c) **Concept check (before and after the "envelope explainer"):** *"'Mənim payım' zərfi nə üçündür, sizcə?"* Pass: >= 6/8 say money to spend freely.
(d) **Term check "zərf" vs "kateqoriya":** do not A/B across 8 people. Ask every participant, before any explanation, *"'Zərf' sözünü eşidəndə nə düşünürsünüz?"* and *"Bunun əvəzinə hansı söz deyərdiniz?"* Collect words; review with a native copy reviewer.
(e) **Amount reading card (E-03):** show the screen with "₼ 1,500" and ask *"Bu neçə manatdır?"* Record every answer.
(f) **Short-screen run (E-01):** run T2 once on the 360 x 640-class reference phone.

---

## 7. Think-aloud instructions

### 7.1 `AZ` instruction (read aloud, then do the practice)
> Mən sizdən xahiş edirəm ki, tapşırıqları yerinə yetirərkən **ucadan düşünəsiniz**: nəyə baxdığınızı, nə axtardığınızı, nəyi niyə basdığınızı və nə gözlədiyinizi deyin. Hətta "bilmirəm" və ya "çaşdım" demək də çox faydalıdır. Mən susarsam, səbəbi budur ki, sizi dinləyirəm; sualınız olarsa, qeyd edirik, amma cavab verə bilmərəm.
> **Məşq:** *"Telefonunuzda saatı necə qurardınız? Ucadan deyin, nə edirsiniz."* *(practice on the participant's alarm app; stop after 30 s)*

### 7.2 Researcher notes
- Think-aloud slows the participant, so times are longer than real; use T2 repeats 2 and 3 (after the participant has stopped narrating) for speed, and record "narrating" vs "silent".
- Do not ask "why" repeatedly; one probe from 5.5, then wait 5 s.
- If the participant narrates their own finances, do not note numbers.

---

## 8. After each task

### 8.1 Single Ease Question (SEQ), asked after every task (AZ)
> *Bu tapşırığı yerinə yetirmək sizin üçün nə qədər asan idi?* (1 = çox çətin ... 7 = çox asan)

Record 1-7. Benchmarks (published averages around 5.5): below 5 on a task = problem; below 4 = serious problem. (The design spec asks for a 1-5 ease rating; a 7-point SEQ is used here because it is the common standard and benchmarked; if the founder prefers 5-point, convert as `(SEQ-1)*4/6+1`.)

### 8.2 Calm / anxiety check after tasks T1, T4, T5 (and any task where the participant sounded tense)
> *Bu tapşırıqdan sonra özünüzü necə hiss edirsiniz?* ☐ Sakin ☐ Normal ☐ Gərgin *(design spec: calm / ok / stressed)*
> *1-dən 5-ə qədər: nə qədər gərgin idiniz?* (1 = heç, 5 = çox)

Record the word and the number. Ask the open question only once: *"Bunu niyə belə dediniz?"*

---

## 9. After the test

### 9.1 System Usability Scale (SUS), Azerbaijani
Give on paper or a form on the researcher's laptop, in this order, **without discussing**. Scale: 1 = Tamamilə razı deyiləm, 2 = Razı deyiləm, 3 = Qərarsızam, 4 = Razıyam, 5 = Tamamilə razıyam.

| # | Statement (AZ) | Polarity |
|---|---|---|
| 1 | Düşünürəm ki, bu tətbiqdən tez-tez istifadə etmək istərdim. | positive |
| 2 | Tətbiqi lazımsız dərəcədə mürəkkəb tapdım. | negative |
| 3 | Tətbiqdən istifadə etmək asan idi. | positive |
| 4 | Tətbiqdən istifadə edə bilmək üçün texniki biri ilə kömək almalı olacağımı düşünürəm. | negative |
| 5 | Tətbiqdəki müxtəlif imkanların yaxşı bir-birinə bağlandığını gördüm. | positive |
| 6 | Tətbiqdə həddindən artıq uyğunsuzluq olduğunu düşündüm. | negative |
| 7 | Düşünürəm ki, əksər insanlar bu tətbiqi çox tez öyrənəcək. | positive |
| 8 | Tətbiqdən istifadə etmək mənim üçün çox əlverişsiz idi. | negative |
| 9 | Tətbiqdən istifadə edərkən özümə tam arxayın idim. | positive |
| 10 | Tətbiqdən istifadə etməyə başlamazdan əvvəl çox şey öyrənməli idim. | negative |

(Translated from the standard 10-item SUS. Have a native speaker back-translate once before the first session; record any change. Treat items 4 and 8 carefully: "əlverişsiz" is the common rendering of "cumbersome".)

**Scoring.** For each participant: odd items score = response - 1; even items score = 5 - response; sum the ten scores (0-40) and multiply by 2.5 to get 0-100.
```
SUS = 2.5 x [ (r1-1) + (5-r2) + (r3-1) + (5-r4) + (r5-1) + (5-r6) + (r7-1) + (5-r8) + (r9-1) + (5-r10) ]
```
Report the mean and the range; do not report a percentage or compare to the "80" line using the mean alone (see 13). Benchmarks: ~68 average, 80+ "good" (top ~10%), 85+ excellent. With n = 8 the 95% interval is about +/- 8-10 points.

### 9.2 Open questions (AZ; 3)
1. Bu tətbiqdə ən çox nəyi bəyəndiniz?
2. Ən çox nə sizi çaşdırdı və ya narahat etdi?
3. Bu tətbiqi kimə tövsiyə edərdiniz və ya etməzdiniz, niyə?

Extra (optional, if time): *"Bu tətbiqi ilk dəfə bu gün sınadığınız üçün, sabah da açardınızmı? Nə vaxt?"*

### 9.3 Calm / tone and anxiety question set (AZ; ask after the SUS)
1. Rəqəm aşağı olanda, məsələn 0 görəndə, özünüzü necə hiss etdiniz? *(if they did not see 0, show T4's screen)*
2. Tətbiq sizinlə danışarkən sizi günahlandırdığını və ya qiymətləndirdiyini hiss etdiniz? Haradan?
3. Tətbiqdə sizi narahat edən bir söz, rəng və ya mesaj oldumu?
4. Tətbiqin tonunu bir-iki sözlə təsvir edin. *(listen for "sakit", "mehriban", "soyuq", "mənə baxan", "bank kimi")*
5. 1-dən 5-ə: Tətbiq pulunuza nəzarəti sizə nə qədər hiss etdirdi? (1 = heç, 5 = çox)
6. 1-dən 5-ə: Tətbiq sizi nə qədər stressə saldı? (1 = heç, 5 = çox)
7. "Bu günkü rəqəm mənə hökm kimi gəldi" - razısınız? (1 = yox, 5 = bəli)

Pass: mean stress (Q6) <= 2; Q7 <= 2 for every participant (design spec: zero participants say the number felt like a judgement); record exact words.

---

## 10. Observation sheet template (copy one per participant)

Header: Participant `P_` | persona | age | OS / model / browser / viewport | font size | app version | facilitator | note-taker | date | consent for audio / screen (Y/N).

| Task | Result (S / P / F) | Help level (0-3) | Time (s) | Non-digit taps | Errors / wrong turns | Quotes (exact, with time) | Severity (0-4) | SEQ (1-7) | Calm word / stress 1-5 | Issue IDs |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 First run | | | | | | | | | | |
| T2a Coffee | | | | | | | | | | |
| T2b Bus | | | | | | | | | | |
| T2c Snack | | | | | | | | | | |
| T3 Understand | | | | | | | | | | |
| T4 Overspend | | | | | | | | | | |
| T5a Income | | | | | | | | | | |
| T5b Installment | | | | | | | | | | |
| T6a Find coffee | | | | | | | | | | |
| T6b Review period | | | | | | | | | | |
| T6c Backup + lock | | | | | | | | | | |
| T7 What-if | | | | | | | | | | |
| T8a Language | | | | | | | | | | |
| T8b Currency | | | | | | | | | | |

Second table, per task, free-form:

| Time stamp | What the participant did / said | Where (screen > element) | Expected | Category (confusion / error / slip / delight / suggestion) | Severity |
|---|---|---|---|---|---|

Third block: SUS responses r1..r10 (circle); SUS score; open answers 1-3; calm set Q1-Q7; concept checks (c)-(e); one-line summary written within 10 minutes of the session.

**Definitions:** Unaided = help level 0. Error = a wrong action that changes data or loses progress; slip = a wrong tap corrected without help; wrong turn = a navigation step to a screen that is not on the correct path. Time starts when the facilitator finishes reading the prompt; ends when the participant says "done" or reaches the end state.

---

## 11. Severity rating rubric (Nielsen-style 0-4, applied per observed incident)

| Sev | Label | Definition | Example |
|---|---|---|---|
| 0 | Not a problem | Observer disagrees it is a usability issue after review | Participant mentions a preference |
| 1 | Cosmetic | Noticed only when looked for; no effect on the task | A slightly odd abbreviation |
| 2 | Minor | Causes hesitation or a recoverable slip; low priority fix | Needs two attempts to find a setting |
| 3 | Major | Task fails for some users, causes errors or stress, or damages trust; high priority | Misreads the hero number; cannot add a taksit |
| 4 | Catastrophe | Data loss, financial misunderstanding with consequences, crash with no recovery, or abandonment; must fix before release | App wipes data; amount saved 100x wrong |

Rating is by two people (facilitator and note-taker) independently, then agree. Rate the **observed impact**, and separately record **frequency** (how many of 8). Add 1 to severity if the issue also breaks a stated product rule (calm tone DR-5/6, one number DR-1, plain words DR-8). Persistence: a sev 3-4 observed once is still logged and re-tested.

---

## 12. Analysis template

### 12.1 Issue log (one row per distinct issue; merge duplicates from the sheets)

| ID | Issue (one sentence) | Screen > element | Task | Participants (n/8) | Frequency F (1-4) | Severity S (0-4) | Priority score F x S | Evidence (quotes, ids) | Hypothesis affected | Proposed fix | Owner | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

Frequency scale: F=1 (1/8), F=2 (2-3/8), F=3 (4-5/8), F=4 (6-8/8). Priority = F x S (max 16). Tie-breaker: higher severity first; then issues on the core path (T1-T5).

### 12.2 Prioritisation
- **P0 (before any release):** any sev 4, or F x S >= 9 on T1-T5.
- **P1 (this sprint):** F x S 6-8, or sev 3 with F=1 on T1-T5.
- **P2 (next):** F x S 3-5, or any sev 2.
- **P3 (backlog):** the rest. Re-test all P0/P1 fixes with 3 new participants.
Group by pattern ("number reading", "layout on small phone") rather than by screen.

### 12.3 Task summary table

| Task | Completed unaided (n/8) | Assisted (n) | Failed (n) | Median time | Mean SEQ | Notes |
|---|---|---|---|---|---|---|
| T1 | | | | | | |
| T2 (median of repeats 2-3) | | | | | | |
| T3 | | | | | | |
| T4 | | | | | | |
| T5 | | | | | | |
| T6 | | | | | | |
| T7 | | | | | | |
| T8 | | | | | | |

### 12.4 SUS and calm summary
Per participant and mean/median/range; per persona group; mean stress (9.3 Q6); count of "judged" answers (Q7 >= 4); tone words (cluster).

### 12.5 Hypothesis verdicts
For each of H1-H5: Supported / Not supported / Inconclusive, with the metric, the evidence rows and the proposed product decision.

### 12.6 Report outline
1 One-page summary (verdict, top 5 issues, SUS) - 2 Method and participants - 3 Results by hypothesis - 4 Issue log - 5 Quotes - 6 Recommended changes and owners - 7 Re-test plan.

---

## 13. Go / no-go criteria for launch

Apply to the **real** results of sections 6-9. n = 8: treat as decision rules with human judgement, not as statistical proof.

### 13.1 Launch gate (all must hold = GO)
| # | Criterion | Threshold |
|---|---|---|
| G1 | SUS (mean of 8) | >= 80, and no persona group mean below 68 |
| G2 | Core tasks T1-T5 pooled unaided success (help level 0) | >= 80% of attempts (>= 32 of 40), and **no core task below 6/8** |
| G3 | T1 first run | >= 6/8 under 60 s; 8/8 complete; 8/8 state the number correctly |
| G4 | T2 fast capture | >= 7/8 within 2 non-digit taps; median of repeats <= 8 s; 0 wrong-amount saves |
| G5 | T3 hero explanation | >= 6/8 paraphrase correctly without prompt |
| G6 | T4 overspend | 8/8 save; >= 6/8 use Move money unaided; >= 6/8 rate calm or ok; mean stress <= 2/5; 0 say judged/blamed |
| G7 | T5 installment | >= 6/8 complete both parts in <= 90 s |
| G8 | Open severity | **0 sev-4**; every sev-3 issue fixed and re-tested (3 new participants, all passing) |
| G9 | Safety | 0 crashes on valid input; 0 data-loss events; 0 participants who misread a displayed amount by 10x or more |
| G10 | Real-device | Install, offline, lock and performance checks passed on a real low-end Android and on iOS Safari (outside this study; `04-build-notes.md` "Still open") |

### 13.2 Conditional go (ship to a closed beta only)
SUS 70-79 **or** exactly one core task at 6/8 with the cause understood and a fix scheduled, **and** G8, G9 satisfied. Re-test before public launch.

### 13.3 No-go
Any of: SUS < 70; a core task < 6/8 for a reason not yet fixed; any sev-4; G9 violated; stress > 2.5 or >= 2 participants report feeling judged. Do not launch; fix, re-test with 5 new participants.

### 13.4 Reading the result honestly
State the n, the persona split and any session run on a LAN (non-secure) build. Report that the expert walkthrough (`07`) is a predictor, not evidence. Record what was **not** tested (RU/TR except spot checks, screen-reader users, real fingerprint/face, long-term use). A good SUS does not replace a 2-week diary or retention data (`02-product-spec.md` section 8).

---

## 14. Pilot checklist and logistics

- [ ] Build deployed (or LAN preview verified on the participant device class); URL / QR printed.
- [ ] Consent text, scenario cards (A-D), SUS sheets, observation sheets printed; stopwatch; pen; incentive; spare charger; reference phones.
- [ ] Pilot 1 with a colleague's relative: run the full script, check timing (60 min), staging for T4/T5/T6 (4.2), the app version shown in Ayarlar > Haqqında, and that you can erase data between sessions.
- [ ] Confirm the amount-format question (6.11 e) shows what you expect on the participant's device (the format depends on the browser's locale data, not only on the app).
- [ ] After each session: erase data, close the tab, restore the device date, back up the observation sheet, write the one-line summary.
- [ ] After sessions 3, 6 and 8: 30-minute team debrief; fix **only** sev-4 issues between sessions so that later sessions are comparable; log everything else.
- [ ] After session 8: complete section 12 within 3 working days; create `08-usability-results.md`.
