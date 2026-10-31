# Delivery and security (05) - Sakin v1

Audience: whoever deploys the app and whoever reviews it. Facts here were checked against the code and the Playwright/Chromium runs described in `04-build-notes.md`.

## 1. Static deployment guide

The app is a static site: `app/dist` after `npm run build`. No server code, no environment variables, no database.

Rules every host must follow:
1. HTTPS (service worker and WebAuthn need a secure context; `localhost` also counts).
2. `index.html`, `sw.js` and `manifest.webmanifest` are served with `Cache-Control: no-cache` so updates are picked up on the next launch. Everything in `/assets/` is hashed and can be `immutable`.
3. Serve at the domain root (`/`). The manifest uses `start_url: "/"` and `scope: "/"`. For a sub-path (GitHub Pages project sites) set `base` in `vite.config.ts` and the manifest `start_url`/`scope`, then rebuild.
4. The router is hash based (`#/today`), so deep links never reach the server; an SPA fallback is still configured as a safety net.
5. Send the security headers below (a CSP `<meta>` is also baked into `index.html` at build time, but `frame-ancestors` only works as a header).

`app/public/_headers` and `_redirects` ship in the build and are read as-is by Netlify and Cloudflare Pages.

### Netlify
Build command `npm run build`, publish directory `dist`, base directory `app`. `_headers` and `_redirects` are honoured automatically. No `netlify.toml` needed.

### Cloudflare Pages
Framework preset none, build command `npm run build`, output directory `dist`, root directory `app`. `_headers` and `_redirects` are honoured. Set `NODE_VERSION=22` (or 24) in the project variables.

### GitHub Pages
Pages cannot set headers, so rely on the CSP meta tag only (no `frame-ancestors`, no HSTS control). Use a user/organisation site or a custom domain so the app is at `/`. Publish the contents of `dist` (for example with a workflow that runs `npm ci && npm run build` in `app` and uploads `app/dist`). Add `404.html` as a copy of `index.html` only if you deviate from the hash router.

### nginx (for self hosting)
```
server {
  listen 443 ssl http2;
  root /var/www/sakin;
  location = /sw.js              { add_header Cache-Control "no-cache"; }
  location = /index.html         { add_header Cache-Control "no-cache"; }
  location = /manifest.webmanifest { add_header Cache-Control "no-cache"; default_type application/manifest+json; }
  location /assets/              { add_header Cache-Control "public, max-age=31536000, immutable"; }
  location /                     { try_files $uri /index.html; }
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy no-referrer always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```
(`add_header` inside a `location` replaces the server-level headers in nginx; repeat the security headers in each `location` that sets Cache-Control, or use `include`.)

### Local launcher
`start-app.cmd` installs, builds if `dist` is missing, starts `vite preview` on port 4173 and opens `http://localhost:4173`. It uses `localhost`, not `127.0.0.1`, because WebAuthn rejects IP addresses as relying party IDs (fingerprint/face unlock would silently not register). Delete `dist` to force a rebuild after code changes.

### Release checklist
1. `npm run lint && npm test && npm run test:e2e` all green.
2. Deploy, open the URL, check DevTools > Application > Service workers shows "activated", Manifest shows no warnings, and the response headers match section 1.
3. Bump `APP_VERSION` in `src/data/backup.ts` and `version` in `package.json` together.
4. Existing users get the new version on the next launch: a card "A new version is ready" appears and Update applies it. Data lives in IndexedDB and is untouched by updates; schema changes go through Dexie `version(n).upgrade()` with a test.

## 2. Capacitor wrap-up note (nothing built)

Why wrap: store presence, OS notifications (the evening reminder is in-app only today), automatic encrypted backup to the user's cloud (product spec: moved to V1.1 because a PWA cannot write to Drive/iCloud), biometrics through the OS keystore instead of a presence-only WebAuthn gate.

What is needed:
- Tooling: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`; `npx cap init "Sakin" <reverse.domain.id>`, `webDir: "dist"`, `npx cap add android|ios`, `npx cap sync` after each build.
- Android: Android Studio with a current SDK, JDK 17, a signing keystore (keep it outside the repo), Play Console account (one time fee), adaptive icon from `public/icon-maskable-512.png`, target API level required by Play at submission time, a Data safety form (answer: no data collected, no data shared; all data on device), a privacy policy URL.
- iOS: a Mac with Xcode, Apple Developer Program membership, bundle id and provisioning, launch screen and 1024 px icon (no transparency), App Privacy answers (data not collected), privacy policy URL, review notes that explain there is no account.
- Storage: WKWebView and Android WebView keep IndexedDB, but iOS can evict web storage for apps that are not used; request persistence is not available there. Plan a periodic "back up to file" nudge (already exists) and, for V1.1, a native filesystem/cloud backup plugin.
- Service worker: Capacitor serves from `capacitor://localhost` / `https://localhost`; keep `registerSW` guarded (`Capacitor.isNativePlatform()` -> skip) because the app bundle already is the offline cache and a second cache invites version skew.
- Lock: replace the WebAuthn presence gate with `@aparajita/capacitor-biometric-auth` (or similar) plus Keychain/Keystore-held key, and the PIN with a hash stored in secure storage rather than `localStorage`. Still document that app-level lock is not disk encryption.
- Notifications (optional): `@capacitor/local-notifications` for the opt-in 20:30 reminder; keep the existing rules (max 1/day, quiet hours, paused after 3 ignored).
- CSP: Capacitor needs `connect-src` for its own scheme; do not add any remote host.
- Store compliance: finance category copy must not promise advice; the app gives no investment advice; keep the "PIN is a gate" honesty text.
- Test matrix before submission: Android 8+ low-end 2 GB device, a current iPhone and an old one, airplane mode, 5,000 entries, backup/restore round trip across an app update, RTL not required for the four launch languages.

## 3. Security and privacy review

### Data and network
- All data is in the browser (IndexedDB) and `localStorage` (preferences, PIN hash). There is no account and no server.
- **No network calls in v1.** Verified in Chromium (`e2e/network.spec.ts`): a full session of 49 requests, all `GET`, all to the app's own origin, none with a body or query string; requests to any other host are blocked by the test and counted (0). The production CSP (`connect-src 'self'`, `script-src 'self'`, no `unsafe-eval`, no inline scripts, `object-src 'none'`, `form-action 'none'`) enforces this in the browser; zero CSP violations were logged while walking every screen.
- Telemetry (AC-PRIV-01/02): the switch exists and is off until the user opts in, but v1 has no sender (`TELEMETRY_ENDPOINT = null`). `buildTelemetryPayload` is the only allowed way to make a payload: whitelisted events, integer counts, app version, locale, random install id. Amounts, names, notes, envelope names and merchants cannot pass it (tests).
- Logs: the code has no `console.*` calls in production paths and nothing user-entered goes into error text (the error boundary shows only the first 80 characters of an exception message). Backup errors carry a code, not content. Do not add logging of transactions.
- Third parties: none at runtime. Fonts are self-hosted (`@fontsource`), icons are bundled (`lucide-react`). `npm audit --omit=dev` reports 0 vulnerabilities; the full audit lists 4 low advisories in build tooling (workbox-build via vite-plugin-pwa), not shipped to users. Run it before each release.

### PIN lock (honest description)
- The PIN is a **UI gate, not encryption**. IndexedDB content is readable by anyone who can open the browser profile (DevTools, another OS user with disk access, malware). The app says so in Settings (`lock.setupHonest`) and the setup sheet; store listings and marketing must not claim "encrypted" for the PIN.
- Stored: PBKDF2-SHA-256, 210,000 iterations, random 16 byte salt per PIN, 4-6 digits. The PIN itself is never stored (test asserts it is absent from preferences). A 4-6 digit PIN has at most one million values, so an attacker with the stored hash and salt can brute-force it offline in seconds to minutes; the hash slows casual snooping only.
- Rate limiting is client side: 5 wrong tries then 30 s, doubling per series up to 15 min; the right PIN is refused during a wait; moving the device clock back cannot extend a wait beyond the cap. Moving the clock forward, clearing site data or editing `localStorage` defeats it (anyone who can do that can already read IndexedDB). Verification uses a constant-time comparison.
- The lock screen mounts before any financial content renders (no number is in the DOM while locked; tested) and a privacy shield covers the app switcher preview.
- Forgot PIN: the only way back in is erasing local data (backup restore is the recovery path) - by design, there is no server reset.
- Real encryption exists only for backup files: AES-256-GCM, key from PBKDF2-SHA-256 with 600,000 iterations and a random salt, optional passphrase. A lost passphrase cannot be recovered.

### WebAuthn (biometric) sanity
- Registration asks for a platform authenticator with `userVerification: required`; the credential id is stored; on the lock screen the app requests an assertion for that id only and accepts it only if the returned id matches.
- There is no server, so no signature is verified: this proves "the device owner is present", nothing more. Cancel, timeout or no authenticator falls back to the PIN pad without unlocking (tested with Chromium's virtual authenticator, including the failed-verification case; not tested on real hardware).
- Needs a valid RP ID: works on `localhost` and real domains, not on IP addresses.

### Other points reviewed
- XSS surface: React escapes output; no `dangerouslySetInnerHTML`; user text is shown only as text. CSV export neutralises spreadsheet formula injection (cells starting with `=`, `+`, `-`, `@` that are not plain numbers get a leading quote; unit-tested).
- Backup import is untrusted input: size capped at 64 MB of text, JSON parse errors handled, checksum, structural validation (types, enums, references) before anything is written, atomic restore with a 7 day undo snapshot.
- Service worker scope is `/`; it only precaches build output and does no runtime caching of other origins.
- Clickjacking: `frame-ancestors 'none'` in the header (not possible in a meta tag).
- Supply chain: pin versions with `package-lock.json`, review `npm audit` and dependency updates before each release.

### What is not covered
Penetration test, real-device lock/biometric tests, storage eviction behaviour on iOS, legal review of the privacy policy and store forms.
