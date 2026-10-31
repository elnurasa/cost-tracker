# Pul Planim - International Market Analysis

Author: Market Analyst | Date: 2026-10-30 | Audience: Product Owner, UX/UI, Full-stack Dev

**Evidence legend.** `[S]` = taken from a source retrieved in this research session (URL in Sources). `[B]` = analyst background knowledge, not re-verified this session. `UNVERIFIED` = could not confirm; do not build on it without checking. Most competitor pricing/rating data comes from affiliate-style comparison blogs that disagree with each other; treat prices as +/-20% until checked on vendor pages. Reddit/Trustpilot/app-store reviews could not be mined directly with the available tooling (search returned blogs, not review corpora); Section 3 is therefore a synthesis of secondary sources plus background knowledge and is flagged accordingly.

---

## Executive summary

1. **Market is large but badly measured.** Published "personal finance app" market sizes range from ~$1.4B (software) to ~$170B (broad app category) for 2025; the only apples-to-apples signal is that North America is largest (~61% of mobile-app revenue in one report) and APAC/LatAm grow fastest. Do not put any single TAM number in a pitch. [S]
2. **The incumbent price umbrella is $50-110/yr** (YNAB ~$99-109, Monarch ~$99, Copilot ~$85-95, Simplifi ~$36-72, PocketGuard ~$75). Low-cost manual trackers (Wallet, Spendee, Toshl, Monefy, Money Manager) sit at $15-35/yr or lifetime. A calm, simple app can be paid at $15-30/yr in the West and far less in emerging markets. [S]
3. **The Mint vacuum was captured by bank-sync products** (Monarch, Copilot, YNAB, Credit Karma as official but feature-poor destination), not by simple apps. Bank-sync is a US/UK/EU-centric moat that does not exist in our home region. [S]
4. **Bank sync is the dominant retention complaint and also the dominant cost/liability.** Local-first + manual/assisted capture sidesteps aggregator fees, credential risk and breakage, but we then own the "manual-entry fatigue" problem and must win it with capture assists. [S/B]
5. **"Safe to spend" is validated but poorly executed by others.** Simplifi's "Left to spend / Spending Plan" is the closest incumbent; its community forum shows the number confuses users when credits, planned one-offs or paychecks are involved. A trustworthy daily number with transparent arithmetic is a genuine differentiator. [S]
6. **SMS parsing is the biggest platform risk to the capture ladder.** Google Play restricts READ_SMS/RECEIVE_SMS to default handlers or approved exceptions; "SMS-based money management / apps that track and manage budgets" is an explicit exception category but requires a Permissions Declaration and review, and bans sharing non-financial SMS. iOS has no SMS read API at all. [S]
7. **Open banking is arriving in our region faster than assumed**: Azerbaijan's central bank announced a live open-banking platform in Oct 2025 (ABB and Turan Bank apps live), Turkey runs it via TCMB/BKM GECIT with 39 certified providers, Georgia has rules since 2023 and a licensee (Keepz), UAE/Saudi are live/phasing in. Kazakhstan: mixed/planned. [S]
8. **Turkey is the highest-value near market** (population ~85M [B], high inflation ~29.7% Sep-2026 [S], heavy installment/taksit culture, strong Android+iOS mix) but needs installment tracking and inflation-aware UX to be credible.
9. **Language priority**: English, Russian, Turkish, Azerbaijani first (the four together cover the founder's home market and the Turkic/Russian-speaking cluster with few polished local competitors); then Spanish, Brazilian Portuguese, Arabic (RTL), and one of Ukrainian/Kazakh/Georgian/Hindi. See Section 8.
10. **Whitespace**: no mainstream app combines (a) zero bank credentials, (b) pay-cycle-aware plan, (c) one daily number, (d) a guilt-free pocket-money envelope, (e) calm tone, (f) fully offline, (g) emerging-market-friendly price. Recommended position: "The calm daily number" (Option B, Section 9).
11. **Biggest risks**: manual-entry fatigue defeating retention; SMS/notification-capture policy rejection; a bank/super-app (Kaspi, Birbank, Revolut, Monzo) bundling the same number free; low willingness-to-pay in home market; local-first sync/restore complexity causing data-loss reviews.
12. **Contradictions with founder decisions**: see "Where the market contradicts the brief" at end of Section 9.

---

## 1. Market size, growth, structure

### 1.1 Global size (wildly inconsistent; scope definitions differ) [S]
| Source | Scope | 2025 size | CAGR |
|---|---|---|---|
| Research and Markets | Personal finance apps (broad) | $165.9B | ~25% |
| The Insight Partners | Personal finance apps | $170.1B | ~24.9% (2026-34) |
| Research Nester | Personal finance apps | $31.7B | 20.8% |
| Verified Market Reports | Personal finance apps | $32.3B | 18.3% |
| Emergen Research | Personal finance **mobile** apps | $6.0B | 11.8% (2026-35) |
| Data Horizzon | **Budgeting apps** | ~$6.8B (2024) | 9.5% (2025-33) |
| Fortune Business Insights | Personal finance **software** | $1.35B | 7.6% |
| Straits Research | Personal finance software | $1.48B | 6.2% |

Reading: the credible band for "budgeting/personal-finance mobile apps" is **$6-7B revenue-equivalent, ~10-12% CAGR**; the $30B+ and $165B+ figures bundle wealth, payments, lending. Use $6-7B / ~10% as the planning figure and label it low-confidence.

### 1.2 By region [S unless noted]
- **North America**: largest; 61.4% share of personal-finance mobile app market (Emergen); 32-39% of personal-finance *software* (Fortune/Straits). Budgeting CAGR ~10% (Data Horizzon, internally inconsistent).
- **Europe**: ~9% CAGR (Data Horizzon). Fragmented by language; open banking (PSD2) makes sync viable; neobank-native budgeting (Revolut, Monzo) captures a lot of casual users. [B]
- **APAC**: fastest-growing in several reports (Research Nester, Straits); Emergen: 16.4% CAGR. Low ARPU, Android-dominant. [S]
- **LatAm**: 15.2% CAGR (Emergen). Brazil has local leaders (Mobills, Organizze, GuiaBolso lineage); Pix and installment tracking are key features. [S/B]
- **MENA**: ~8% CAGR (Data Horizzon); Gulf open finance live/phasing in; Arabic/RTL localization is the barrier for Western apps. [S]
- **CIS/Caucasus/Turkey**: no market-size source found - **UNVERIFIED**. Qualitative structure below.

### 1.3 Download/usage datapoints (all partial) [S]
- US (Sensor Tower, 2025): Rocket Money ~4.3-4.9M weekly active users, ~125-143K weekly downloads (Q3); EveryDollar iOS ~717-880K WAU; **YNAB Android only ~176K WAU, 2-2.5K weekly downloads** - i.e. the premium, methodology-heavy leader is small by download count. Albert 47-78K weekly downloads (Q1).
- Brazil: Mobills ~10-25K weekly downloads, ~$27K weekly revenue (Q3 2025).
- Russia iOS: ZenMoney 6K-24K WAU (2024, iOS only; Russian iOS data is distorted by store restrictions).
- Turkey (Sensor Tower, to 2024): Splitwise led downloads; Money Manager and Wallet recurring; local butce.app exists; no dominant Turkish budgeting brand identified.
- Kazakhstan: Kaspi.kz super-app ~14.7M MAU / 10.1M DAU (2024) - a banking super-app is the default "finance app" for most of the country; standalone budgeting apps are marginal. [S]
- Azerbaijan: Birbank 3M+ active users (Kapital Bank), m10 wallet 5M+ (secondary source), 20.6M payment cards in circulation (Jun 2025), cashless share of domestic card payments 67.6% in 2025 (Zenodo citing CBAR). [S]
- No MAU for Monarch, Copilot, Simplifi, Cleo, Goodbudget etc. found; Cleo figures (1.2M users / 2.8M cash-advance users) conflict and are from secondary blogs - **UNVERIFIED**.

### 1.4 Structure
Three layers: (1) **Bank-sync premium** (YNAB, Monarch, Copilot, Simplifi, Rocket Money): high price, US/CA/UK-centred, retention tied to sync quality. (2) **Manual/hybrid mass-market** (Wallet, Spendee, Monefy, Money Manager, Toshl, Fortune City): cheap, global, Android-heavy, aging UX. (3) **Embedded in banks/neobanks/super-apps** (Revolut, Monzo, Kaspi, Birbank, ABB, TBC/BOG, Garanti): free, zero friction, but shallow budgeting and no cross-bank view (open banking is starting to change that in AZ/TR).

---

## 2. Competitor teardown (24 products)

Ratings are approximate, from third-party roundups (dates mixed 2025-2026) unless stated; verify in stores. Capture: M = manual, S = bank sync, SMS = SMS parsing.

| App | Positioning | Pricing (approx.) | Platforms | Capture | Strengths | Weaknesses |
|---|---|---|---|---|---|---|
| **YNAB** | Zero-based "give every dollar a job"; methodology + education | $14.99/mo, ~$99-109/yr | iOS, Android, web | S + M | Cult loyalty, strong method, education; ~75-90% retention claims (conflicting) | Steep learning curve, perceived guilt/rigidity, history of price hikes with poor comms (2021 Reddit backlash), small Android footprint |
| **Monarch Money** | "Mint successor"; couples/household, net worth | $14.99/mo, ~$99.99/yr | iOS, Android, web | S + M | Best AI assistant (per roundups), shared household, wide aggregators, ex-Mint product leader | Price; US/CA only; sync dependency; feature breadth = complexity |
| **Copilot Money** | Beautiful, ML-categorised, Apple-native | ~$85-95/yr (sources conflict) | iOS, Mac, limited web; **no Android confirmed** | S | Design benchmark, smart categorisation | Apple only; sync reliance; price |
| **Quicken Simplifi** | Cash-flow "Spending Plan" with "Left to spend" | ~$36-72/yr (promo vs standard; UNVERIFIED current) | iOS, Android, web | S | Cheapest big-brand; closest to safe-to-spend | Left-to-spend confusion with credits/one-offs (community threads); sync-dependent; US only |
| **PocketGuard** | "In My Pocket" safe-to-spend number | $12.99/mo, $74.99/yr, $149.99 lifetime | iOS, Android | S | Simple "In My Pocket" number, lifetime option | Sync reliance, ads/upsell friction, US only [B for sentiment] |
| **Goodbudget** | Envelope budgeting, shared with partner | Free (20 envelopes, 2 devices); ~$8-10/mo or $80/yr | iOS, Android, web | M | Envelope clarity, couples sync | Dated UI, manual labour, expensive premium |
| **Actual Budget** | Open-source, local-first, zero-based | Free/self-host [B] | Web/desktop (PWA), community mobile | M + optional sync (SimpleFIN/GoCardless) [B] | Privacy, ownership, no subscription | Technical setup, not consumer-friendly, no polished native mobile [B] |
| **Lunch Money** | Power-user, multi-currency, API | ~$10/mo (UNVERIFIED annual) | Web (+ mobile web/PWA) | S + M | Multi-currency, open API, indie trust | Web-first, hobbyist audience |
| **Wallet by BudgetBakers** | Global multi-currency tracker, bank sync in EU/CZ | Premium ~$30/yr or $6/mo; lifetime ~$50 | iOS, Android, web | M + S (EU) | 4.5-4.6 rating, multi-currency, wide languages | Cluttered, paywalls, sync limited by region |
| **Spendee** | Visual wallets, shared | Free; $14.99-35.99/yr | iOS, Android, web | M + S | Clean design, 4.6 | Free-tier limits, sync dependent |
| **Monefy** | Ultra-fast manual entry, pie chart | Free + IAP ($2.49-59.99 range seen) | iOS, Android | M | Fast, simple; ~4.1 Android / 4.7 iOS | Weak budgeting/planning, no real forecasting |
| **Money Manager (Realbyte)** | Android veteran, rich manual ledger | Free + premium | iOS (4.8 / ~19.5K ratings), Android | M | Huge feature set, loved in Asia/Turkey/CIS [B] | Dated UI, overwhelming for beginners |
| **Toshl Finance** | Playful tracker, bank sync EU | Pro ~$20/yr, Medici ~$40/yr | iOS, Android, web | M + S (EU) | Personality, tags, many currencies | Aging, sync paywall |
| **Fortune City** | Gamified (build a city by logging) | Free + IAP [B] | iOS, Android | M | Fights logging fatigue via play | Poor budgeting depth, niche [B] |
| **Emma (UK)** | Open-banking aggregator, subscriptions finder | ~GBP 5-10/mo (UNVERIFIED) | iOS, Android | S (UK/EU) | Subscription cancellation, aggregation | UK/EU-only, subscription fatigue |
| **Cleo (US/UK)** | AI "sassy" chatbot + cash advances | $5.99-14.99/mo tiers (Pro/Builder monthly only) | iOS, Android | S | Personality, engagement; cash-advance revenue | Tone can shame/roast; monetises via credit; US/UK |
| **Revolut / Monzo** | Neobank with budgets, pots/vaults | Free tiers + paid plans | iOS, Android | native | Zero-friction capture, "pots" | Only that bank's data (Revolut supports external accounts in some markets [B]) |
| **Mint (shut)** | Free, ad-funded aggregator | - | - | S | Was the mass-market default | Closed 23 Mar 2024 (first announced 1 Jan); Credit Karma destination lacks budgeting; users scattered to Monarch, YNAB, spreadsheets [S] |
| **Rocket Money** | Subscription-cancel + budget | Free + premium [B] | iOS, Android | S | Largest US active base (~4-5M WAU) [S] | Aggressive upsell/cancel-fee complaints [B] |
| **EveryDollar** | Ramsey zero-based | Free / Premium [B] | iOS, Android | M + S(paid) | ~0.7-0.9M iOS WAU [S] | Sync paywalled |
| **ZenMoney (RU)** | Russian-language leader: bank sync + SMS parsing | Subscription [B] | iOS, Android, web | S (RU banks) + SMS | Deep RU/CIS bank coverage, Russian UX | Russia-based/political and sanctions friction, limited outside RU/UA/KZ [S partial] |
| **Mobills (BR)** | Brazil leader | Freemium; ~USD 27K/wk revenue [S] | iOS, Android, web | M + Open Finance | Local rail/language fit | Brazil-only |
| **Kaspi.kz / Birbank / ABB / TBC / BOG / Garanti** | Bank/super-app with spend views | Free | Mobile | native | Zero friction, trust, mass adoption (Kaspi 14.7M MAU) | Per-bank silo; budgeting shallow [S/B] |
| **butce.app / local Turkish trackers** | Turkish installment + expense tracker | UNVERIFIED | UNVERIFIED | M | Taksit-aware | Small, unverified quality |

**Key observation:** the only apps in the matrix that deliver *one daily number* are PocketGuard ("In My Pocket") and Simplifi ("Left to spend"), both US-only and bank-sync-dependent. Nobody in the manual/local-first tier does it well. [S/B]

**Mint shutdown flow** [S]: Intuit pushed users to Credit Karma (which said it lacks Mint's budgeting). Monarch (ex-Mint PM) claims a 2000% signup spike in 48h (self-reported). Others went to YNAB or spreadsheets. Lesson: the ex-free-user base showed willingness to pay ~$100/yr only for *engaged* users; the rest left to spreadsheets - an unserved segment that wants free/cheap and simple.

---

## 3. Why users churn - top 8 themes (ranked)

Evidence quality caveat: sources are blog/vendor content and background knowledge; vendor statistics (e.g., "67% quit in 30 days", "68% abandon when sync breaks") are unsourced and treated as UNVERIFIED. Ranking is analyst judgement based on frequency across sources. [S/B]

1. **Manual-entry fatigue / "falling behind".** Logging takes minutes per day-week; once a few days are missed, users feel the data is wrong and quit. Evidence: multiple 2026 guides identify this as the top reason (e.g., "15-30 minutes per week" estimate; "not discipline, upkeep"). [S, low rigor]
2. **Shame / report-card effect.** Tracking becomes a verdict; users avoid opening the app to avoid the number. Evidence: sources describing "emotional avoidance"; Substack commenters on "digital nag" for each latte. [S]
3. **Complexity and rigid structure.** Methodology overload (zero-based, envelopes, rules) that doesn't match irregular income. Evidence: YNAB learning curve narratives; "rigid structures that don't match how you earn and spend". [S/B]
4. **Bank-sync breakage.** Re-auth loops, duplicate/missing transactions, Plaid outages. Vendor claim: "68% quit instead of reconnect" - UNVERIFIED but directionally consistent with Mint/Monarch/Simplifi forum complaints. [S/B]
5. **Paywalls and price hikes.** YNAB 2021 hike ($83.99 to $98.99, one month notice) produced a Reddit backlash focused on poor communication more than price; freemium caps (Goodbudget 20 envelopes, Spendee wallet limits) irritate. [S]
6. **Wrong/confusing numbers.** "Left to spend" off after credits or planned one-offs (Simplifi community threads: "$930.64 left to spend looked wrong"). Trust in the number is the product. [S]
7. **Privacy and credential fear.** Handing bank logins to aggregators; post-Mint data-sale memory; drives interest in Actual Budget/local-first. [B, partially S]
8. **No payoff / no guidance.** Tracking shows what happened, not what to do; novelty fades (sources 1-3 above). Also: notification overload. [S]

---

## 4. Regional differences that change product design

| Topic | Finding | Design consequence |
|---|---|---|
| **Cash-heavy economies** | Azerbaijan: 67.6% of domestic card payments cashless (2025), 20.6M cards, QR/instant payments growing [S]; yet cash remains significant (Georgia outside cities [S]; informal sector across region [B]). | Cash entry must be as first-class as card; "cash on hand" wallet type; no assumption that every spend is a transaction on an account. |
| **Bank SMS notifications** | Banks in AZ/TR/KZ/RU/GE send per-transaction SMS (the basis of ZenMoney's SMS parsing and India-style trackers) [B/S]. | SMS/notification parsing is a regional killer feature but policy-gated (Section 5). Build bank-specific parser templates; offer paste/share-sheet import as policy-safe fallback. |
| **Open banking** | **Azerbaijan**: CBAR announced operational open-banking platform 6 Oct 2025 under Payment Services law Art. 62.7; Bank ABB, Turan Bank apps live with account aggregation; expansion planned. A tracker (Fiskil) says no framework - contradicted by CBAR (primary) [S]. **Turkey**: TCMB licenses AIS/PIS (Law 6493 Art. 12), BKM GECIT gateway, 39 certified PSPs, Dec 2025 amendment allowing value-added services, v2.0.0 service set Mar 2026 [S]. **Georgia**: NBG rules approved May 2023; Keepz first licensee; instant payment system due late 2026 [S]. **Kazakhstan**: sources conflict; planned mandate announced (Astana Times 2025) [S]. **UAE**: Open Finance Regulation in force (July 2025), Nebras/AlTareq hub; **Saudi**: SAMA licensing since Mar 2026 [S]. **EU**: PSD2 [B]. **UK**: OB established [B]. **US**: Plaid/aggregators; CFPB 1033 rule status UNVERIFIED. | Bank APIs "later" is correct, but AIS licensing (TCMB/CBAR authorisation, certification) is a regulatory project, not just integration. A licensed aggregator partner is the realistic path. |
| **Multi-currency / inflation** | Turkey CPI 29.7% y/y Sep-2026 (31.5% Aug), policy rate 37%, year-end target ~28% [S]. Azerbaijan manat is pegged/stable [B]; many in AZ/GE/TR hold USD/EUR savings or prices [B]. | Plans must allow mid-month re-plan; show real-terms warnings in high-inflation locales; per-envelope currency; FX as optional manual rate, not an aggregator dependency. |
| **Salary cycles** | Azerbaijan/CIS: advance (avans) + salary split paid twice monthly is common [B; search returned nothing - UNVERIFIED]; weekly/biweekly in US/UK/Gulf gig work; day-of-month shifting for weekends. | Multiple income events per period; the "month" must be anchored to pay days, not calendar; safe-to-spend must handle "next pay in N days" not "days left in month." |
| **Payment rails** | AZ: Birbank, m10 wallet, ABB, AzIPS instant payments, CBAR QR standard [S]; TR: FAST, QR, TROY, EFT [S]; Pix (BR) [S]; UPI (IN) [B]. Super-apps: Kaspi (KZ) [S]. | Rail-agnostic categories; QR import where the rail exposes it. |
| **Installments (taksit)** | Turkey: 19.5% of credit-card purchases in installments (Garanti BBVA 2025); 44% of surveyed consumers use them always/mostly, 72% at least sometimes (2026 survey) [S]. Brazil also installment-heavy (parcelado) [S]. | First-class "future commitments" object: a purchase that creates N future obligations; safe-to-spend must subtract upcoming installments. This is a clear differentiator vs. US-built apps. |
| **Family / shared money** | Households commonly pool income; couples sharing is a Monarch/Goodbudget selling point [S]. In MENA/South Asia/Caucasus extended-family obligations and gifting are common [B]. | Optional shared budget (not v1); a "family support" category; pocket-money envelope concept is culturally flexible. |
| **RTL** | Arabic, Hebrew, Persian, Urdu need full mirroring [B]. | Use logical layout properties from day 1; test numerals (Arabic-Indic vs Latin). |
| **Date/number/currency formats** | AZ/TR/RU use decimal comma, space/dot thousands; AZN symbol (U+20BC) not in all fonts [B]; TR uses TL/TRY with symbol U+20BA. | Locale-driven formatting via platform APIs; fallback glyph for AZN; never hard-code separators. |
| **Platform mix** | Azerbaijan: Android 84.4% / iOS 15.6% (Jun 2026 Statcounter) - Android share moves 78-84% over the last year; Kazakhstan: Android 53.8% / iOS 46.2% (Jun 2026) [S]. Brazil ~78% and India ~95% Android (2023, secondary) [S]. | Android-first quality; iOS parity for monetisation (higher ARPU). iOS widgets/Live Activities are a nice-to-have; Android widgets are core. |

---

## 5. Platform and legal constraints

### 5.1 Google Play: SMS / call log [S - primary page fetched]
Policy page: Google Play "Use of SMS or Call Log permission groups" (support.google.com/googleplay/android-developer/answer/9047303).
- Apps may access SMS/Call Log only for permitted core uses and must be the **default SMS/Phone/Assistant handler**, with narrow exceptions requiring a Permissions Declaration Form in Play Console. Apps without declaration or non-qualifying risk removal.
- **Explicit exception: "SMS-based money management - apps that track and manage budgets"** for READ_SMS, RECEIVE_SMS, RECEIVE_MMS, RECEIVE_WAP_PUSH. Condition: budgeting/loan apps "may not exfiltrate or share non-financial or personal SMS history."
- Also listed: SMS-based financial transactions (e.g., UPI). From 27 Jan 2027, phone-call account verification is no longer a permitted READ_CALL_LOG use.
- Implication: SMS parsing is feasible but **requires approval, a clear core-functionality justification, on-device-only processing of financial SMS, and a demonstrable lack of alternative**. A "paste/share" or notification-based method reduces risk. Expect review rejections; plan an alternate release without SMS permission.

### 5.2 Notification listener [S partial; UNVERIFIED primary]
`BIND_NOTIFICATION_LISTENER_SERVICE` is user-granted via Special App Access (the user toggles it in Settings), not a Play "restricted permission" requiring declaration to our knowledge, but sources conflict (one security site says reviewed/restricted, another says no policy restriction). The Play *User Data* and *Permissions* policies still apply (prominent disclosure, minimal use, no exfiltration). Notifications may contain OTPs and private messages - filter strictly to a whitelist of bank/wallet package names and discard everything else on-device. Verify at developer.android.com and Play policy center before building.

### 5.3 Apple App Store
- No iOS API to read SMS or other apps' notifications; capture on iOS = manual, widget, Shortcuts/Siri, share sheet, Apple Pay/Wallet transaction automation via Shortcuts (user-built "Transaction" automation trigger [B]).
- Subscriptions/IAP: Guideline 3.1.1 (IAP for digital content) and auto-renewal disclosure rules [S secondary]. Financial apps: 5.1.1(ix) apps in highly regulated fields should come from a legal entity providing the services; a 2025 summary cites 3.2.1(viii) requiring licences in each region for **financial services** apps [S secondary; primary text UNVERIFIED]. A budgeting tracker that does not move or hold money is generally not a "financial services" app [B] - keep copy and metadata clear that we provide no banking, lending or advice.
- Apple's primary guidelines page was not retrievable; verify at developer.apple.com/app-store/review/guidelines.

### 5.4 Data protection basics for storing financial data
- **GDPR (EU/UK)** [B]: financial data is personal data but not "special category"; need lawful basis, privacy notice, DSAR/erasure, breach notification (72h) where we process on servers. If data stays solely on-device, we are mostly not a controller for it; **optional sync/account makes us a controller/processor** - encrypt end-to-end, minimise, DPA with cloud vendor, EU hosting option.
- **CCPA/CPRA (California)** [B]: applies above revenue/data thresholds; sale/share opt-out; sensitive PI includes account log-in + financial; local-first minimises scope. Not verified this session.
- **Azerbaijan** [S]: 2010 Law on Personal Data (No. 998-IIIQ): consent-based processing; cross-border transfer conditions; GDPR-aligned replacement being drafted (not confirmed enacted). Practical: explicit in-app consent, local storage, document cross-border transfers for sync.
- **Turkey KVKK** [S]: Law 6698, amended by Law 7499 (March 2024): new Art. 9 cross-border regime (adequacy, then SCCs/BCRs, then occasional transfers), notification of SCCs; Art. 6 special-category grounds widened; PDPA guideline on cross-border transfer (2 Jan 2025). Financial data is not special-category but still personal data; if we use a cloud backend outside Turkey, transfers need an Art. 9 mechanism, VERBIS registration thresholds may apply [B].
- **What "local-first, no bank credentials" avoids:** PCI scope (we never see PANs), AIS/PIS licensing (TCMB/CBAR) unless we ourselves read bank data, aggregator contracts and per-connection fees, credential-storage liability and breach exposure, most cross-border transfer obligations (if sync is optional and E2E-encrypted), and bank-consent UX. What it does **not** avoid: App Store/Play policy, consumer protection for subscriptions, data subject rights for any server-held data (accounts, analytics, crash logs), and the need to disclose analytics SDKs (App Store privacy labels, Play Data safety).

---

## 6. Monetization benchmarks

- **Price anchors (US/West)** [S]: YNAB $99-109/yr; Monarch ~$99.99/yr; Copilot $85-95/yr; PocketGuard $74.99/yr (+$149.99 lifetime); Simplifi $36-72/yr; Goodbudget $80/yr; Cleo $5.99-14.99/mo; mass-market manual apps $15-36/yr (Spendee, Toshl, Wallet), with lifetime offers ($50 Wallet).
- **Conversion benchmarks (RevenueCat State of Subscription Apps, all categories)** [S]: median hard-paywall trial-to-paid 10.7% by day 35 vs 2.1% for freemium (download-to-paid); top-decile hard paywall 38.7%; 80% of trial starts occur on day 1; longer trials (17-32 days) convert better (42.5% vs 25.5% for <4-day trials, per summary); higher-priced apps show higher trial conversion. Finance-category cut is gated - **UNVERIFIED**.
- **What users tolerate** [S/B]: paying for a clearly valuable daily habit; one-time/lifetime payments for offline tools (Wallet, PocketGuard lifetime); annual plans with transparent renewal reminders. **Backlash triggers**: silent price hikes (YNAB 2021), paywalling previously free features, hard caps on core entities (envelopes/wallets), dark patterns around trials/cancellation (Rocket Money-type complaints [B]), ads on a finance screen, "free" apps monetised via credit products (Cleo model).
- **Regional PPP** (analyst proposal; not benchmarked in sources): Tier 1 (US/CA/UK/EU/AU/Gulf): $2.99-4.99/mo or $24.99-39.99/yr, lifetime $59-79. Tier 2 (TR, BR, MX, PL, KZ): ~40-50% of Tier 1. Tier 3 (AZ, GE, IN, ID, EG, UZ, etc.): ~20-30% (e.g., AZN-equivalent $0.99/mo or $9.99/yr). Both app stores support localized price points; check Apple/Google price matrix and tax rules. Turkey's inflation means prices should be reviewed at least twice yearly.
- **Recommended model**: free core (unlimited manual entry, one plan, safe-to-spend, history) + paid "Plus" (capture assists with ongoing cost: receipt/AI/OCR, multi-device sync, shared budgets, export, widgets variants, insights), with annual + lifetime option. Rationale: freemium converts at ~2% (RevenueCat) so free core must be cheap to serve - which local-first provides. Avoid hard paywall on onboarding in a trust-sensitive category; use a long free trial of Plus (14-30 days) instead.

---

## 7. Trends

- **AI in personal finance**: "AI assistant" has become a marketing checkbox; Monarch's conversational assistant rated strongest in roundups; auto-categorisation and predictive cash-flow are baseline [S, low-authority sources]. Cleo's personality-driven approach monetises through credit rather than subscriptions [S].
- **Safe-to-spend / "left to spend"**: Simplifi's Spending Plan computes income minus bills, subscriptions and savings goals, exposes a daily average, and is the clearest incumbent for the pattern; PocketGuard's "In My Pocket" likewise. Documented pain: confusion with credits and planned one-offs [S]. This is the strongest validated pattern aligned with the founder's hero concept.
- **Zero-based/envelope**: YNAB and Goodbudget keep a loyal niche but have a learning curve; EveryDollar targets the same audience [S/B]. Simplified envelope ("plan vs actual by category") is a more mass-market form.
- **Local-first/privacy**: Actual Budget (open-source, local-first) is the reference; post-Mint distrust and "no bank login" lists (iOS roundups) show demand [S/B]. Market still mostly niche/technical.
- **Widgets / Live Activities / Shortcuts / voice**: platform features widely used by trackers [B]; no reliable engagement benchmarks found - **UNVERIFIED**.
- **Receipt scanning**: LLM-based extraction reports ~97% on field extraction on an AIMultiple benchmark (older model), vendor claims up to 99.5% (Veryfi, unverified); hybrid OCR+LLM reports 95%+ at lower cost [S]. Azerbaijan-specific: fiscal receipts carry a QR code and a 12-character fiscal ID that can be verified against the State Tax Service database via e-kassa.gov.az, and BirBank/ABB read the QR for VAT refund [S] - this means QR scan can yield **authoritative total/merchant/date, possibly without OCR** (item-level data availability UNVERIFIED).
- **Voice entry accuracy**: no benchmark found - **UNVERIFIED**; practical expectation is high accuracy for amount+category in widely-supported languages but lower for Azerbaijani on-device recognition [B].

---

## 8. Language/localization priorities (top 8)

Criteria: addressable reach in our positioning (cash-heavy, Android-heavy, low literacy tolerant, manual-first), competition for native-language quality, willingness to pay, and founder access/feedback.

| Rank | Locale | Reasoning |
|---|---|---|
| 1 | **English** | Store default, global fallback, enables all Tier-1 pricing. Required for review/discovery. |
| 2 | **Russian** | Lingua franca across AZ, GE, KZ, UZ, KG, UA/BY/RU diaspora; ZenMoney is the main native competitor and has regional/political friction; Kaspi dominates KZ finance but not planning. Russian is also widely used by Azerbaijani urban users [B]. |
| 3 | **Turkish** | ~85M population [B], large smartphone base, inflation + installments are acute pain, no dominant local budgeting brand found [S]; Turkic proximity to Azerbaijani lets you reuse parsing patterns and community. |
| 4 | **Azerbaijani** | Home market and founder base; tiny competition for native-language quality; ~10M in Azerbaijan [B, UNVERIFIED]; low ARPU - treat as brand-trust/testbed, not main revenue. Note Latin script; AZN glyph issue. |
| 5 | **Spanish** | 559M total speakers [S]; LatAm CAGR ~15% [S]; mixed Mexican/Colombian/Argentine regional variants (inflation in AR). |
| 6 | **Portuguese (BR)** | Brazil is a large Android market with strong local competitor (Mobills) - need Pix/parcelado features to compete [S]. |
| 7 | **Arabic (RTL)** | MENA growth and Gulf open finance [S]; RTL cost is real; good second-wave test of layout system. |
| 8 | **Ukrainian / Kazakh / Georgian / Hindi / Indonesian** (pick by data after launch) | Hindi (609M total speakers [S]) and Indonesian are huge but low ARPU and crowded; Georgian/Kazakh/Ukrainian are small but underserved. Choose with real install data. |

Sequencing: architect for ICU/locale formats and RTL from v1; ship **EN + RU + TR + AZ** first, then ES/PT-BR/AR.

---

## 9. Whitespace, positioning, risks

### 9.1 The gap
- Bank-sync apps own the US; manual apps are cheap but cluttered; bank/super-apps are free but silo'd. No well-reviewed app combines: **plan anchored to pay cycles + one daily number + guilt-free pocket money + works offline + no bank login + friendly pricing for emerging markets**. PocketGuard/Simplifi prove demand for the number; Actual Budget proves demand for local-first; neither is simple for non-technical users.

### 9.2 Three positioning options
- **A. "Privacy-first budget" (Actual-for-everyone).** Pitch: your money stays on your phone. Pros: clear, emotionally resonant, differentiates against sync apps. Cons: privacy is a feature not a daily habit; narrow in emerging markets where users already hand data to banks; invites comparison with Actual on feature depth.
- **B. "The calm daily number" (safe-to-spend + pocket money).** Pitch: "How much can I spend today without worry?" Pros: one-sentence promise, validated pattern, low-literacy friendly, works with manual entry (the number needs only income + plan + spends), culturally portable; privacy/local-first becomes proof not headline. Cons: needs excellent correctness (trust in the number), crowded messaging if US apps add it.
- **C. "Paycheck planner for irregular/cash economies."** Pitch: plan each pay cycle (advance + salary, weekly, gig) with cash and installments. Pros: strong regional fit (AZ/TR/GE/KZ), nobody serves it; Cons: harder to explain globally, narrower initial TAM.

**Recommendation: B as headline, with C's mechanics built in.** Reasoning: B has the clearest promise and demonstrated demand (Simplifi/PocketGuard); the pay-cycle and installment logic from C is what makes the number *right* in our regions and is a moat the US apps lack; local-first/no-credentials supports B as a trust proof point rather than the lead.

### 9.3 Five biggest risks
1. **Retention collapse from manual-entry fatigue** (theme #1). Mitigation: capture ladder, 2-tap entry, "catch-up" mode that asks once a week for a lump sum rather than guilt, forgiving defaults.
2. **Platform policy rejection** of SMS/notification capture (Google declaration/exception, no iOS equivalent). Mitigation: ship value without SMS; submit declaration with clear on-device-only story; paste/share-sheet fallback.
3. **Distribution disadvantage vs bundled banks/super-apps** (Kaspi 14.7M MAU, Birbank 3M+, Revolut/Monzo, and now open-banking aggregators in AZ/TR). Mitigation: be the cross-bank, cash-inclusive planner; later integrate open banking via licensed partner rather than competing with banks' feeds.
4. **Low willingness to pay in home market** and high price-sensitivity; PPP tiering complexity and chargeback/refund overhead; ~2% freemium conversion benchmark [S]. Mitigation: low serving cost (local-first), Tier-1/2 revenue, lifetime SKU, avoid paying for servers where possible.
5. **Local-first trust failure: data loss, lost device, sync conflicts, backup bugs.** A single "I lost my history" review is high-cost because history is a core promise. Mitigation: automatic encrypted backups (iCloud/Google Drive/file export), restore tests, visible backup status.

(Honourable mentions: inflation volatility breaking plan arithmetic; Apple/Google policy shifts; AI-feature expectation creep; regulatory change on data localisation in AZ/TR/KZ.)

### 9.4 Where the market contradicts or tests the brief
- **"Bank APIs later"** - the region is moving earlier than expected (AZ live Oct 2025; TR mature). Not a contradiction, but later may be sooner: keep the transaction model source-agnostic from day 1.
- **"Notification/SMS parsing as an assist"** - Google Play requires declaration, may reject; iOS impossible. Treat as Android-only, optional, not a core promise in marketing.
- **"Safe to spend = remaining budget / remaining days"** - the simple formula fails with pay cycles, installments, and planned one-offs (see Simplifi complaints). It should be redefined as remaining *discretionary* budget / days until *next income*, minus known upcoming commitments.
- **"Simplicity over features"** - market evidence supports it, but some table-stakes (multi-currency, backup/export, shared with partner) are expected; excluding them risks 1-star reviews. Decide explicit "not now" list.
- **"Phone + tablet"** - fine, but tablets are a minor usage share; Azerbaijan Android tablet share is volatile (Report.az) [S]. Do not spend early design effort on tablet-specific layouts.
- **Voice + AI + receipts** - promising but unproven for Azerbaijani; do not make them launch gates.

---

## Implications for the product

1. **Define the hero number as "safe to spend today = (discretionary remaining) / (days until next income) after known commitments".** Evidence: Simplifi/PocketGuard validate the pattern; Simplifi community shows failures with credits and one-offs; Azerbaijan/CIS advance+salary and weekly pay cycles (Sections 4, 7). Show the arithmetic in one tap ("why this number").
2. **Make the pay-cycle (not the calendar month) the planning unit; support multiple income events per cycle and shifting pay days.** Evidence: Section 4 salary cycles; gig/weekly pay in US/UK/Gulf.
3. **Build installments/commitments as a first-class object (N future obligations from one purchase) before launch in Turkey/Brazil.** Evidence: 19.5%-72% installment usage in Turkey (Section 4); installment tracking listed as key in Brazil [S].
4. **Treat cash as first-class and design capture ladder around the Android reality.** Evidence: Android 84% in AZ; cash still significant; SMS/notification capture is Android-only (Sections 4-5). Priority: widget + quick-add + recurring + QR scan, then notification/SMS (optional), then bank APIs.
5. **Ship v1 without any dependence on SMS permission; submit the Play SMS exception only with an on-device-only design.** Evidence: Play SMS policy (budget exception exists but requires declaration and bans sharing non-financial SMS). Offer share-sheet/"paste bank message" import as default, using notification-listener only with a strict allowlist.
6. **Make Azerbaijani fiscal-receipt QR scanning an early differentiator.** Evidence: QR + 12-char fiscal ID on every receipt, verifiable via e-kassa.gov.az; BirBank/ABB already scan it for VAT refund. First step: spike on whether total/merchant/date can be retrieved offline from QR payload or requires online lookup (UNVERIFIED).
7. **Calm tone as a measurable design constraint: no red "overspent" shaming; use neutral language, positive framing, and a "catch up" mode instead of broken streaks.** Evidence: themes #1-2 (fatigue, shame).
8. **Pocket-money envelope must be literally exempt from judgment: no categorising, no alerts, optional visibility.** Evidence: "digital nag" objection and shame theme; Fortune City/Cleo show tone is a differentiator either direction.
9. **Free core with unlimited manual entry and full history; paid Plus for sync, receipt/AI, widgets/insights, shared budgets.** Evidence: freemium ~2% conversion (RevenueCat), caps and paywalls are churn triggers; local-first gives near-zero marginal cost.
10. **Regional pricing tiers from day 1 and a lifetime SKU; commit publicly to price-change policy (notice + grandfathering).** Evidence: PPP gap ($99 incumbents vs low-income markets), YNAB 2021 backlash was about communication.
11. **Plan automated encrypted backup and restore as launch-critical, plus visible "last backup" indicator.** Evidence: risk 5; privacy/ownership is the local-first promise; no credibility without recoverability.
12. **Localization from day 1: ICU formats, RTL-ready layout, AZN glyph fallback, locale-aware date/decimal handling; ship EN/RU/TR/AZ.** Evidence: Section 8 ranking; formatting differences (Section 4).
13. **Keep transaction ingestion source-agnostic (manual, recurring, QR, SMS, bank) with a dedupe/"source" field.** Evidence: open banking is live in AZ and TR; later integration via a licensed AIS partner must not require migration. Don't pursue own AIS licence early.
14. **Explicit "not now" list and a one-screen setup** (income, pay days, 5-8 default categories prefilled by locale). Evidence: complexity theme #3; Mint's free-user exodus to spreadsheets shows many users want a simple tool.
15. **Be explicit in privacy copy and store listings: no bank credentials, data on device, what leaves the device under optional sync, E2E encryption.** Evidence: GDPR/KVKK/Azerbaijan consent regimes; App Store privacy labels and Play Data safety forms; trust as acquisition channel.
16. **Defer AI chat; prioritise AI for *input* (categorise, voice, receipt) and on-device where possible.** Evidence: "AI assistant" commoditised; accuracy of receipt extraction is good (95-97%+) while conversational layers add cost and privacy complexity.

---

## Open items needing verification before commitments
- Final Google Play policy text for notification listeners; Apple guideline wording for financial apps (primary pages).
- Market sizes for CIS/Caucasus/Turkey/MENA (no credible source found).
- Per-store ratings, installs and MAU for competitors (affiliate blogs disagree).
- Azerbaijani salary-cycle prevalence (avans + salary) and smartphone/tablet penetration.
- Azerbaijan fiscal QR payload content (is item-level data retrievable?).
- CFPB 1033 / US open banking status; Kazakhstan open banking status; Georgia budgeting competitors.
- Voice and widget engagement benchmarks.

---

## Sources (retrieved in this session unless marked)

Market size
- https://www.researchandmarkets.com/report/personal-finance-app-market
- https://www.marketresearchfuture.com/reports/personal-finance-mobile-app-market-22409
- https://www.fortunebusinessinsights.com/personal-finance-software-market-112683
- https://straitsresearch.com/report/personal-finance-software-market
- https://www.emergenresearch.com/industry-report/personal-finance-mobile-app-market
- https://datahorizzonresearch.com/budgeting-apps-market-47078
- https://www.researchnester.com/reports/personal-finance-apps-market/8243
- https://www.theinsightpartners.com/reports/personal-finance-apps-market
- https://www.verifiedmarketreports.com/product/personal-finance-apps-market/

Usage / downloads
- Sensor Tower Q3 2025 US: https://sensortower.com/blog/2025-q3-unified-top-5-personal%20finance%20budgeting%20and%20planning-units-us-63e363f0e1714cfff1979caa
- Sensor Tower Q2 2025 Brazil Android: https://sensortower.com/blog/2025-q2-android-top-5-personal%20finance%20budgeting%20and%20planning-units-br-63e363f0e1714cfff1979caa
- Sensor Tower Russia Q2 2024: https://sensortower.com/blog/2024-q2-unified-top-5-personal%20finance%20budgeting%20and%20planning-revenue-ru-63e363f0e1714cfff1979caa
- Sensor Tower Turkey Q3 2024: https://sensortower.com/blog/2024-q3-unified-top-5-personal%20finance%20budgeting%20and%20planning-revenue-tr-63e363f0e1714cfff1979caa
- Kaspi.kz MAU: https://stonemountainresearch.substack.com/p/kaspikz-the-most-dominant-platform ; https://www.renaissancecapital.com/Profile/KSPI/Kaspi.kz/IPO
- Azerbaijan payments: https://www.trend.az/business/4073945.html ; https://zenodo.org/records/22205858 ; https://geyin.az/en/blog/post/online-payments-in-azerbaijan-91-electronic-m10-birbank-and-/ ; https://en.wikipedia.org/wiki/Birbank
- Statcounter Azerbaijan: https://gs.statcounter.com/os-market-share/mobile/azerbaijan ; Kazakhstan: https://gs.statcounter.com/os-market-share/mobile/kazakhstan/2025 ; https://report.az/en/ict/android-s-market-share-on-mobile-devices-in-azerbaijan-drops-by-nearly-8

Competitors / pricing / Mint
- https://monarchmoney.com/mint-shutting-down ; https://www.cnbc.com/2023/11/07/budgeting-app-mint-is-shutting-down-users-are-disappointed.html ; https://plisio.net/tradfi/mint-vs-credit-karma
- https://www.fincomparelab.com/best-tools/best-ynab-alternatives/ ; https://getfinny.app/blog/monarch-vs-ynab-vs-simplifi-2026 ; https://getfinny.app/blog/quicken-simplifi-review-2026 ; https://toolradar.com/tools/copilot-money/pricing ; https://costbench.com/best/best-budgeting-apps/
- https://getfinny.app/blog/wallet-budgetbakers-review-2026 ; https://wallethub.com/best-budget-apps ; https://pocketclear.app/blog/cheapest-budgeting-apps-2026.html
- https://financefeeds.com/the-best-budgeting-apps-of-2026/ ; https://pocketguard.com/blog/pocketguard-vs-goodbudget/ ; https://pocketclear.app/blog/budget-app-comparison-chart-2026.html
- YNAB price history: https://pocketclear.app/blog/ynab-price-increases-history.html ; Reddit mirror https://lr.eu.psf.lt/r/ynab/comments/qlunk3/ynab_communication_about_price_change
- ZenMoney: https://adapty.io/paywall-library/zenmoney/ ; https://apps.apple.com/us/app/zenmoney-expense-tracker/id905934786
- Turkey local: https://butce.app/en ; https://www.buxfer.com/countries/222/turkey-best-budgeting-app

Churn / trends
- https://spendtrak.app/blog/why-people-quit-budgeting-apps ; https://useorigin.com/resources/blog/why-budgeting-apps-fail-most-people-and-how-ai-fixes-it ; https://www.strategia-x.com/blog/2026-04-12-why-budgeting-apps-fail-30-days-fintech-ux-data/ ; https://robertpuelz.substack.com/p/no-budget-app-fix-now/comments
- Simplifi Spending Plan help: https://help.simplifimoney.com/en/articles/4212702-using-the-simplifi-spending-plan ; community threads https://community.simplifimoney.com/discussion/comment/21770/ ; https://community.simplifimoney.com/discussion/comment/57836
- AI: https://useorigin.com/resources/blog/ai-in-personal-finance-2026-comparing-the-top-tools-and-approaches ; https://getfinny.app/blog/ai-personal-finance-trends-2026
- Receipt OCR: https://aimultiple.com/receipt-ocr ; https://veryfi.com/technology/line-item-extraction-accuracy-benchmarks ; https://www.raftlabs.com/blog/ocr-vs-llm-invoice-processing

Open banking / regions
- CBAR: https://cbar.az/press-release-5292/azerbaijans-financial-market-starts-to-implement-open-banking?language=en ; https://www.cbar.az/press-release-4941/statement-on-approved-requirements-for-open-banking?language=en ; Fiskil tracker (conflicting): https://www.fiskil.com/open-finance-tracker
- Turkey: https://virconlegal.com/open-banking-turkiye-legal-guide-fintechs/ ; https://www.esin.av.tr/2025/04/02/developments-in-open-banking-and-digital-wallets/ ; https://fintech.tr/en/open-banking-and-instant-payments-in-turkey
- Kazakhstan: https://astanatimes.com/2025/04/what-stands-behind-kazakhstans-open-banking-initiative/
- Georgia: https://nbg.gov.ge/en/media/news/the-number-of-new-innovative-services-is-increasing-through-the-use-of-open-banking
- UAE/Saudi: https://www.pinsentmasons.com/out-law/guides/uae-open-finance ; https://paymentexpert.com/2026/10/21/uae-fintech-hub-open-finance-2026/ ; https://www.madvisory.qa/insights-open-banking-goes-live-gcc.html
- Turkey inflation: https://tradingeconomics.com/turkey/inflation-cpi ; installments: https://www.norbr.com/payworldtour/payment-methods-in-turkey ; https://turkeyinsightslab.com/research/online-shopping-turkey-2026/#findings
- Azerbaijan fiscal receipts: https://www.taxes.gov.az/uploads/2024/eng/Bifold-eCASHREGISTER.pdf ; https://e-kassa.gov.az/ ; https://taxes.gov.az/en/page/ticaret-ve-ya-iase-obyektlerinden-alinmis-mallara-gore-odenilmis-edv-nin-qaytarilmasi

Policy / legal
- Google Play SMS and Call Log policy (fetched in full): https://support.google.com/googleplay/android-developer/answer/9047303
- Android NotificationListenerService reference: https://developer.android.com/reference/android/service/notification/NotificationListenerService
- Apple (secondary only; primary not retrieved): https://developer.apple.com/app-store/review/guidelines ; https://www.gummicube.com/blog/updated-apple-app-review-requirements/
- Azerbaijan data law: https://natlex.ilo.org/dyn/natlex2/natlex2/files/download/86656/AZE-86656.pdf ; https://worldwatch.global/azerbaijan/data-privacy
- Turkey KVKK 7499: https://mondaq.com/turkey/data-protection/1442172/recent-amendments-to-the-law-on-the-protection-of-personal-data ; https://iapp.org/news/a/the-long-awaited-amendments-in-turkish-data-protection-law

Monetization
- https://www.revenuecat.com/state-of-subscription-apps-2025 ; https://www.rocketshiphq.com/revenuecat-state-of-subscription-apps-2025-summary/ ; https://www.singular.net/blog/subscription-apps/

Languages
- https://www.wikipedia.org/wiki/Languages_by_total_speakers ; https://www.the-star.co.ke/news/infographics/2026-02-20-the-most-spoken-languages-worldwide
