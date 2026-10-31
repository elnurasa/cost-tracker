# 05 - Localization glossary, rules and reviewer notes

Owner: localization. Source of truth for strings: `app/src/i18n/{en,az,tr,ru}.ts`. Checks: `app/src/i18n/i18n.test.ts` and `i18n.quality.test.ts` (run by `npm test` and `npm run lint`).

## 1. Voice and register (decided)

| Language | Register | Notes |
|---|---|---|
| EN | "you" | Sentence case. |
| AZ | formal-warm **siz** (polite plural) | Sentences use -(y)In imperatives ("əlavə edin"). Short buttons keep the bare imperative ("Əlavə et"), as bank apps do. Earlier drafts used "sən"; replaced to match the product spec 6.1. |
| TR | informal **sen** | Kept (spec). |
| RU | polite **вы** | Earlier drafts used "ты"; replaced to match spec 6.1. Buttons use the infinitive ("Добавить"). |

Rules: no guilt words (banned-word lint in tests), one idea per sentence, no exclamation marks, no finance jargon. Names of envelopes are capitalised in lists and headings, lowercase inside sentences in AZ/TR/RU ("ehtiyata gedir", "yedeğe gider", "в запас"). Turkish never puts an apostrophe on these common nouns. Russian uses guillemets «» (never straight quotes). The word "backup" is "nüsxə" in AZ (not "ehtiyat nüsxə", which collides with the Buffer envelope "Ehtiyat").

## 2. Glossary

| Concept | EN | AZ | TR | RU | Why |
|---|---|---|---|---|---|
| Envelope | Envelope | Zərf | Zarf | Конверт | The product metaphor; taught once by `env.explainer` and `env.new.explainer` ("envelopes are also your categories"). "Kateqoriya/kategori/категория" is used only inside those explainers and the Payments "By category" switch (see "Category" below). |
| Plan | Plan | Plan ("Planım" as tab) | Plan ("Planım") | План | Everyday word in all four. |
| Buffer | Buffer | Ehtiyat | Yedek | Запас | Everyday words for "money kept in reserve". TR collision with "yedekle" (backup) is accepted; see reviewer notes. |
| Safe to spend today (hero label) | You can spend today | Bu gün xərcləyə bilərsiniz | Bugün harcayabilirsin | Сегодня можно потратить | Plain sentence, <= 30 chars, no "safe-to-spend" jargon. RU is impersonal, so it avoids the ты/вы question. |
| My share | My share | Mənim payım | Benim payım | Моя доля | Guilt-free personal money, "share" not "allowance". Spec draft said "pocket money"; the app uses "share" in all languages. |
| Savings | Savings | Yığım | Birikim | Накопления | |
| Installment | Installment | Taksit | Taksit | Рассрочка | Local, everyday term (RU: the purchase plan; "платёж {n}" for one payment). |
| Bills | Bills | Ödənişlər | Faturalar | Счета | |
| Period | Period | Dövr | Dönem | Период | Pay-to-pay cycle. Month is used where the user states frequency. |
| Rollover | (described) "What is left moves to your Buffer" | "Qalan pul ehtiyata keçir" | "Artan para yedeğe geçer" | "Остаток уходит в запас" | The word "rollover" is never shown; the rule is described in plain words. |
| Rebalance / make room | Move money / Make room | Pulu köçür / Yer aç | Para aktar / Yer aç | Перенести деньги / Освободить место | Everyday verbs, no "rebalance". |
| Over plan | "{amount} over" | "{amount} artıq" | "{amount} fazla" | "Сверх: {amount}" | Neutral, never "exceeded/overspent". |
| Backup | Back up | Nüsxə saxla | Yedekle | Резервная копия | |
| Password for backup | Password | Parol | Parola | Пароль | "Passphrase" dropped everywhere; simpler. |
| Payments (tab, panel) | Payments | Ödənişlər | Ödemeler | Платежи | Founder's word. Because AZ "Ödənişlər" is now the tab, the AZ Bills envelope template is renamed **"Kommunal"** for new workspaces (existing envelope names are user data and are not touched). |
| Still to pay this period (panel number) | Still to pay this period | Bu dövr ödəniləcək | Bu dönem ödenecek | Осталось оплатить за период | Plain, no "obligations" or "liabilities". |
| Payee | To whom or where | Kimə və ya hara | Kime ya da nereye | Кому или куда | A question, not the word "payee"/"benefisiar"/"получатель". |
| One-time / Repeating | One-time / Repeating | Birdəfəlik / Təkrarlanan | Tek sefer / Düzenli | Разовый / Регулярный | Filter and type picker. EN uses "Repeating" (not "Monthly") because the group also holds weekly and yearly bills; the row badge names the real frequency (Aylıq, Aylık, Ежемесячно). |
| Bank loan / Store installment | Bank loan / Store installment | Kredit / Taksit | Banka kredisi (badge: Kredi) / Taksit | Банковский кредит (badge: Кредит) / Рассрочка в магазине (badge: Рассрочка) | Everyday words in each market; the sub-line explains interest in plain words. |
| I paid (confirm action) | I paid | Ödədim | Ödedim | Я оплатил(а) | First person, the user's own words. RU uses the "(а)" form to stay gender-neutral. |
| Waiting (state) | Waiting / Waiting for you | Gözləyir / Sizi gözləyir | Bekliyor / Seni bekliyor | Ждёт / Ждут вас | Never "overdue", "late" or "missed". Past due is stated as a fact: "Due 2 days ago" / "Tarixdən 2 gün keçib" / "Tarihi 2 gün önceydi" / "Срок был 2 дня назад". |
| Left to repay (remaining debt) | Left to repay | Qalan ödəniş | Kalan ödeme | Осталось выплатить | The banned-word lint forbids "debt / borc / borç / долг" (guilt words, DR-5), so the founder's "remaining debt" is phrased as what is left to repay. |
| Pay extra (early repayment) | Pay extra | Əlavə ödə | Ek ödeme yap | Внести больше | No "prepayment" / "amortization". |
| Interest | Interest | Faiz | Faiz | Проценты | Shown only when the user gives the borrowed amount; always labelled an estimate. |
| Record automatically | Record automatically on the due date | Tarixində avtomatik qeyd et | Tarihinde otomatik kaydet | Записывать сам в день платежа | For direct debits; the help line explains the opposite mode. |
| Category (= envelope) | By category / Each envelope is a category | Kateqoriyaya görə / Hər zərf bir kateqoriyadır | Kategoriye göre / Her zarf bir kategoridir | По категориям / Каждый конверт — это категория | Decision: an envelope IS the category; there is no separate category field. "Kateqoriya/kategori/категория" now also appears in the Payments view switch and its help line, always next to "envelope". |
| Ready-made payment categories (`cat.*`) | Housing · Utilities · Phone & internet · Loans · Installments · Subscriptions · Insurance · Education & kids · Other | Mənzil · Kommunal · Telefon və internet · Kreditlər · Taksitlər · Abunəliklər · Sığorta · Təhsil və uşaqlar · Digər | Konut · Faturalar · Telefon ve internet · Krediler · Taksitler · Abonelikler · Sigorta · Eğitim ve çocuk · Diğer | Жильё · Коммунальные · Связь и интернет · Кредиты · Рассрочки · Подписки · Страховка · Учёба и дети · Другое | AZ Utilities = "Kommunal" and TR = "Faturalar" on purpose: they equal the template envelope names, so an existing workspace never shows two names for one category. Examples line `cat.*.ex` ("İşıq, qaz, su"). An app-named category envelope follows a language switch; a renamed one stays. |
| New envelope (inline) | New envelope · Add and select | Yeni zərf · Əlavə et və seç | Yeni zarf · Ekle ve seç | Новый конверт · Добавить и выбрать | Same "New envelope" label as Plan. |
| Suggested (auto-pick hint) | Suggested · Suggested from the name. Tap another one to change it. | Təklif · Ada görə təklif olunur. Dəyişmək üçün başqasına toxunun. | Öneri · İsme göre önerildi. Değiştirmek için başkasına dokun. | Подсказка · Подсказано по названию. Чтобы изменить, выберите другой. | Learned from the person: "Same as before for {payee}" / "{payee} üçün əvvəlki kimi" / "{payee} için önceki gibi" / «Как раньше для «{payee}»». |
| Per month / per year | {amount}/mo · {amount} a year | {amount}/ay · ildə {amount} | {amount}/ay · yılda {amount} | {amount}/мес. · {amount} в год | Screen readers get "ayda {amount}" etc. (`pay.cat.monthAria`) instead of a slash. Amounts are wrapped in Unicode isolates (LRI/PDI) inside these sentences so they never reorder in RTL. |

New keys added by other teams must follow this table. Common mistakes to avoid: AZ "sən" forms, RU "ты" forms, TR apostrophes on envelope nouns, "ehtiyat nüsxə".

## 3. Length discipline

Overall character length versus EN (all keys, longest plural form): **AZ 1.06, TR 1.04, RU 1.09**. Budgets enforced by tests: tabs <= 10 chars, hero label <= 30, buttons/chips/segments <= 26, no string > 2.6x EN (when EN >= 12 chars), per-language total <= 1.15x EN.

Worst offenders fixed (before -> after):

| Key | Language | Before | After |
|---|---|---|---|
| `hero.label` | TR | Bugün harcayabileceğin tutar (28) | Bugün harcayabilirsin (21) |
| `env.detail.show` / `hide` | RU | Показать на экране «Сегодня» (28) | Показать в «Сегодня» (20) |
| `settings.hidePocket` | RU | 41 chars | 34 chars |
| `lock.erase` | RU | Стереть данные приложения (25) | Стереть данные (14) |
| `settings.undoRestore` | RU | Отменить восстановление (23) | Вернуть как было (16) |
| `card.stop` | RU | Больше не показывать (20) | Не показывать (13) |
| `review.editPlan` | RU | Изменить следующий план (23) | Изменить план (13) |
| `plan.left` | RU | Осталось в этом периоде (23) | Осталось за период (18) |
| `today.comingUp` / `coming.title` | AZ | Yaxınlaşan ödənişlər (20) | Yaxınlaşanlar (13) |
| `plan.planned` | AZ | Planlaşdırılıb (14) | Planda (6) |
| `lock.delay` | AZ / TR | Bundan sonra kilidlə / Şu süre sonra kilitle | Kilidləmə vaxtı / Kilitlenme süresi |
| `common.showMore` | TR | Daha fazla göster (17) | Devamını göster (15) |
| `card.backupAction` | RU | Сохранить сейчас (16) | Сохранить (9) |

Tab labels now: EN Today/Plan/Payments/History/Settings; AZ Bu gün/Planım/Ödənişlər/Tarixçə/Ayarlar; TR Bugün/Planım/Ödemeler/Geçmiş/Ayarlar; RU Сегодня/План/Платежи/История/Настройки (max 9). The `pay.*` buttons, states, badges and filter segments are inside the 26-character button budget test.

## 4. Plurals, numbers, dates (verified)

* Payments panel plurals: `pay.status.waiting`, `pay.paymentsLeft`, `pay.sinceDue`, `pay.waitingCount` are plural objects in all four languages (RU one/few/many: «Остался 1 платёж», «Осталось 3 платежа», «Осталось 26 платежей»).
* Plurals: `Intl.PluralRules` picks one/few/many/other. Tests assert Russian for 1, 2, 5, 11, 21, 22, 25, 101, 111, 112 (день/дня/дней, запись/записи/записей). AZ/TR have no inflection after numerals (same form for `one` and `other`).
* Counted nouns are never left inside a non-plural string (EN/RU test). Three EN/RU sentences were reworded to avoid it: `coming.summary` ("Payments: {n} x {amount}" / "Платежей: {n} по {amount}"), `lock.wrong`, `lock.digits`.
* Money (Intl, verified): AZ `1.234,50 ₼` (symbol after), TR `₺1.234,50` (before), RU `1 234,50 ₽` (NBSP, after), EN `$1,234.50`. Whole amounts drop `.00`.
* Dates: Azerbaijani no longer depends on engine data. `makeFmt('az')` uses built-in month and weekday tables (`AZ_MON`, `AZ_MON_LONG`, `AZ_WD`, `AZ_WD_LONG` exported from `i18n/index.tsx`); the "M10" problem cannot occur. New `fmt.weekday(dow, 'short' | 'long')` replaces direct `Intl` calls in `Income.tsx`. TR, RU, EN use `Intl` (verified: `5 Eki`, `5 окт.`, `Oct 5`). Currency search uses the `az-Latn` tag.
* Decimal example in `sys.rateInvalid`: "1,70" for AZ, TR, RU; "1.70" for EN.

## 5. Hard-coded strings

Moved to keys: error boundary title/body/button (`sys.errorTitle`, `sys.error`, `sys.reload`) and the loading label (`common.loading`) in `App.tsx`. Left on purpose: icon-button labels "+" and "-" (symbols), CSV column ids (machine format), default name `'Income'` in `data/repo.ts` (fallback only; callers pass a name), `rp.name: 'Sakin'` in `data/lock.ts` (brand), `index.html` and PWA manifest descriptions (English, build-time; a per-locale manifest is a later task).

## 6. Localization notes for native reviewers (15 most uncertain strings per language)

### Azerbaijani (AZ)
1. `hero.label` "Bu gün xərcləyə bilərsiniz" - natural vs "Bu gün xərcləmək olar"?
2. `env.pocket` "Mənim payım" - does "pay" read as "my own share of money"? Alternative "Öz xərcliyim".
3. `env.buffer` "Ehtiyat" - understood as reserve money?
4. `env.explainer` "Zərf bir məqsəd üçün ayrılmış puldur." - is the envelope metaphor clear to non-bank users?
5. `onboard.payDay` "Ayın neçəsində alırsınız?" - works for salary and allowance?
6. `onboard.looksGood` / `review.confirm` "Uyğundur" - good button for "Looks good"?
7. `inc.monthlyOn` "Hər ay: {day}. gün" - ordinal form; suffix -ci/-cı/-cu varies, a pattern avoiding it is used.
8. `card.lateAction` "Gözlədiyim tarix" - button meaning "I expect it on...".
9. `plan.fitShort` "Çatmır: {amount}." - too terse?
10. `row.ahead` "Plandan bir az tez gedir" - neutral, non-judging?
11. `coming.fixedOnly` "Ödənişlər üçün ayrıca zərf istifadə olunur."
12. `hero.footer` "Aşağı yuvarlaqlaşdırılıb ki, pulunuz çatsın." - reassuring and correct?
13. `settings.passphrase` "Parol (istəyə görə, tövsiyə olunur)".
14. `onboard.revealBody` - "bərabər bölünür" for even daily split.
15. Mixed register: sentences use siz, buttons use bare imperative. Confirm this matches current app practice.

Payment categories (new, unreviewed): `cat.housing` "Mənzil" (vs "Ev xərcləri"?); `cat.education` "Təhsil və uşaqlar"; `pay.view.category` "Kateqoriyaya görə" (17 chars, fits the segment at 360 px); `pay.cat.perMonth` "{amount}/ay"; `env.inline.flexHelp` "0-dan başlayır".

Payments panel (new, unreviewed): `pay.stillToPay` "Bu dövr ödəniləcək"; `pay.sinceDue` "Tarixdən {n} gün keçib" (calm enough for past due?); `pay.leftToRepay` "Qalan ödəniş" (instead of "qalan borc", which the lint bans); `pay.iPaid` "Ödədim"; `env.bills` renamed "Kommunal" (does it cover rent-free bills like phone?).

### Turkish (TR)
1. `hero.label` "Bugün harcayabilirsin".
2. `env.pocket` "Benim payım" vs "Harçlığım" (spec draft) vs "Kendi payım".
3. `env.buffer` "Yedek" collides with "yedekle/yedek" (backup). Alternative "Rezerv" or "Güvence".
4. `env.explainer` "Zarf, tek bir amaç için ayırdığın paradır."
5. `onboard.incomeTitle` "Ne kadar gelirin var?".
6. `onboard.payDay` "Ayın kaçında alıyorsun?".
7. `onboard.looksGood` / `review.confirm` "Uygun" as button.
8. `plan.makeRoomShort` "Yetmiyor: {amount} eksik."
9. `move.to` / `move.from` "Nereye / Nereden" labels.
10. `row.ahead` "Plandan biraz hızlı".
11. `review.done` "Yeni dönem başladı. Güzel iş." - tone.
12. `coming.progress` "Ödenen: {paid} / {total}".
13. `settings.hidePocket` "Benim payım Bugün ekranında görünsün".
14. `lock.wrong` "Bu PIN doğru değil..." and use of "PIN'i" apostrophe on an acronym.
15. `hero.footer` "Aşağı yuvarlanır, böylece paran yeter."

Payments panel (new, unreviewed): `pay.filter.repeating` "Düzenli"; `pay.sinceDue` "Tarihi {n} gün önceydi"; `pay.payExtra` "Ek ödeme yap".

### Russian (RU)
1. `hero.label` "Сегодня можно потратить".
2. `env.pocket` "Моя доля" - clear as personal spending money? Alternative "Мои деньги", "Карманные".
3. `env.buffer` "Запас" (lowercase in sentences, e.g. "пойдёт в запас").
4. `env.explainer` "Конверт — это деньги, отложенные на одну цель."
5. Declension of «Мою долю» / «Моей доле» in `plan.fitIncludeShare`, `why.covered`, `settings.hidePocket`.
6. `hero.usedUp` "Повседневные деньги закончились. Следующее пополнение: {date}."
7. `card.cover` / `inc.coverTitle` "Чтобы хватило до..." (chip with date picker follows).
8. `card.lateAction` "Укажу дату".
9. `onboard.looksGood` / `review.confirm` "Подходит" as button label.
10. `inc.monthlyOn` "Каждый месяц, {day}-го числа" (grammatical for all days 1-31).
11. `row.over` "Сверх: {amount}" and `row.ahead` "Чуть быстрее плана" - neutral enough?
12. `history.installmentNo` "Рассрочка, платёж {n}".
13. `coming.summary` "Платежей: {n} по {amount}. Последний: {month}. Всего {total}." - "{month}" is the nominative ("октябрь 2026 г.").
14. `settings.passphrase` "Пароль (по желанию, рекомендуется)".
15. `review.done` "Новый период начался. Хорошая работа." - tone.

Payments panel (new, unreviewed): `pay.iPaid` «Я оплатил(а)» (gender-neutral, a bit bookish); `pay.resumed` «Снова активен» (avoids «Продолжено», which the lint flags because it contains «должен»); `pay.payExtra` «Внести больше».

Also for English: `env.buffer` "Buffer" is still the most jargon-like word in the app; a plainer word ("Cushion", "Spare") could be A/B tested.
