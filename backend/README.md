# Trail Run Tracker — Backend (Google Sheets + Apps Script)

Free, low-ops backend for the no-app runner web flow + Race Director dashboard.

## What you get

- **Google Sheet** = the database (3 tabs: `Runners`, `Checkins`, `DNF`)
- **Apps Script Web App** = the HTTP API (one URL, JSON in/out)
- **No servers, no Cloudflare account, no Firebase** — just a Google account

## Setup (one-time, ~10 minutes)

1. **Create a Google Sheet.** Name it e.g. `Trail Run Tracker DB`. Copy the sheet's ID from the URL (the long string between `/d/` and `/edit`).
2. **Open Extensions → Apps Script.** Delete the stub `Code.gs`, paste the contents of [`Code.gs`](./Code.gs).
3. **Add the sheet ID as a Script Property.**
   In the Apps Script editor: `Project Settings (gear icon) → Script Properties → Add property`
   - Key: `SHEET_ID`
   - Value: *(paste the sheet ID)*
4. **Run `setup()` once.** Select `setup` in the function dropdown, click ▶ Run, approve the OAuth prompt. This creates the three tabs with headers.
5. **Deploy as a Web App.**
   `Deploy → New deployment → Type: Web app`
   - Description: `trail-run-tracker v1`
   - Execute as: **Me**
   - Who has access: **Anyone** (so runners' phones can call it without sign-in)
   - Click **Deploy**, copy the **Web app URL** — that's your API base URL.

   > Every time you change the code, click `Deploy → Manage deployments → ✏️ Edit → New version → Deploy`. The URL stays the same.

6. **Smoke test.** Open the URL with `?action=ping` appended. You should get `{"ok":true,"time":...}`.

## Schema

### `Runners`
| col | type | notes |
|---|---|---|
| `id` | string | `r_xxxxxxxxxx` |
| `token` | string | 32-char random; stored in runner's localStorage |
| `name` | string | display name / nickname |
| `phone` | string | digits-only, used as natural identity |
| `emergency_phone` | string | optional |
| `distance_original` | `11K` / `22K` / `29K` | registered distance |
| `distance_current` | `11K` / `22K` / `29K` | after auto-adjust |
| `status` | `active` / `dnf` / `finished` | |
| `created_at` | ms epoch | |
| `updated_at` | ms epoch | |

### `Checkins`
| col | notes |
|---|---|
| `id` | `c_xxxxxxxxxx` |
| `runner_id` | FK to Runners.id |
| `cp` | `start` / `a1` / `a2` / `finish` |
| `timestamp` | ms epoch |
| `distance_at_checkin` | distance after any auto-adjust applied on this scan |
| `action` | `registered` / `checked` / `upgrade_11_22` / `upgrade_22_29` / `downgrade_29_22` / `finished` |

### `DNF`
| col | notes |
|---|---|
| `id` | `d_xxxxxxxxxx` |
| `runner_id` | FK |
| `cp` | where DNF was filed |
| `timestamp` | ms epoch |
| `reason` | chip value: `injury` / `exhausted` / `cutoff` / `personal` / `weather` / `other` |
| `note` | free-text from the runner |
| `pickup_requested` | `TRUE` / `FALSE` |

## API

Base URL = your Apps Script Web App URL. Pass `action` as a query param. POST bodies are JSON.

### `POST ?action=register`
First scan at Start. Creates runner + records implicit start check-in. Returns token to store in localStorage.
```json
{ "name": "ธีระ", "phone": "0812345678", "distance": "22K", "emergency_phone": "0998765432" }
```
→
```json
{ "ok": true, "action": "registered", "token": "abc...", "runner": { … } }
```
If the phone is already registered, returns `action: "already_registered"` with the existing token (idempotent).

### `POST ?action=checkin`
Records a check-in at a CP, applying cooldown and auto-adjust.
```json
{ "token": "abc...", "cp": "a2" }
```
→ success: `{ "ok": true, "action": "checked"|"upgrade_11_22"|"upgrade_22_29"|"downgrade_29_22"|"finished", "runner": {…}, "checkin": {…} }`
→ cooldown: `{ "ok": false, "error": "cooldown", "wait_ms": 2280000, "last_at": …, "cooldown_ms": 3600000 }`

**Auto-adjust rules** (matches the design chat):
| from | event | to |
|---|---|---|
| 11K | 1st A2 scan | 22K |
| 22K | 2nd A2 scan | 29K |
| 29K | 2nd A1 scan (inbound), A2 scans < 2 | 22K |

**Cooldown:** 60 minutes between repeat scans at the same CP. Returned as a structured error so the client can show the countdown screen.

### `GET ?action=lookup&token=…`
Restore state on page load (used by the "recognized" screen).
→ `{ ok: true, runner, checkins, last_checkin }`

### `GET ?action=search&q=…`
Borrowed-phone fallback. Matches by phone digits or by name prefix. Returns up to 12 results with masked phone numbers; tokens are **not** included.

### `POST ?action=dnf`
Two-step DNF. Reason is required.
```json
{ "token": "…", "cp": "a2", "reason": "exhausted", "note": "ตะคริวที่น่อง", "pickup_requested": true }
```

### `GET ?action=state`
Full state for the Race Director dashboard. Poll every 5–15s.
→ `{ ok: true, runners: [...], checkins: [...], dnf: [...] }`

### `GET ?action=ping`
Health check.

## Wiring the prototype to this backend

The prototype is already wired — you just need to plug in the URL.

1. **Paste the Web App URL** into the placeholder near the top of `Trail Run Tracker.html`:
   ```html
   <script>
     window.TRT_API_URL = 'https://script.google.com/macros/s/AKfycb…/exec';
   </script>
   ```
2. **Switch the Tweaks panel** to `🛰 Live · real backend` (the new option in the *Race state* dropdown). The dashboard now polls `?action=state` every 10s. A yellow banner appears if the URL is unset or the call fails.

`src/api.jsx` defines `window.api(action, params, opts)` — used by both `src/data.jsx` (for `fetchSnapshot()`) and `src/runner-app.jsx` (for the runner action helpers). It POSTs as `text/plain` to dodge the Apps Script CORS preflight quirk.

**Runner action helpers** (in `src/runner-app.jsx`, also on `window.*`):

| screen | helper |
|---|---|
| `register` (Start) | `runnerRegister({ name, phone, distance, emergency_phone })` → stores token in localStorage |
| `recognized` (next CP) | on load: `runnerLookup()` → identity card from server |
| Confirm button | `runnerCheckin('a1' \| 'a2' \| 'finish')` — returns the action (`checked` / `upgrade_…` / `downgrade_…` / `finished`) |
| Cooldown response | the helper rejects with `code === 'cooldown'` + `wait_ms` — show the `web-duplicate` artboard |
| Upgrade/downgrade response | use `res.action` to pick `web-upgrade-22` / `web-upgrade-29` / `web-downgrade-22` |
| DNF confirm | `runnerDnf({ cp, reason, note, pickup_requested })` |
| Fallback search | `runnerSearch(q)` |

**`<LiveRunnerApp lang cp />` (src/runner-live.jsx)** is the working runner page — every input, button, and state transition is wired to the helpers above. Two artboards at the top of the recommended section render it (`⚡ Live · A1` and `⚡ Live · Start`). The original presentational `PhoneWeb*` screens are kept for the design canvas demos.

To deploy the runner page on its own domain, host a tiny HTML that loads `src/api.jsx`, `src/runner-app.jsx`, `src/runner-live.jsx` and mounts `<LiveRunnerApp/>`. The component reads `?cp=…` from the URL, so a single HTML works for every poster.

**QR poster URLs** should embed the CP as a query string so the page knows which CP it represents:
```
https://your-domain.example/checkin.html?cp=start
https://your-domain.example/checkin.html?cp=a1
https://your-domain.example/checkin.html?cp=a2
https://your-domain.example/checkin.html?cp=finish
```

## Dashboard auth (optional shared secret)

Runner endpoints stay open (anyone scanning a QR poster can register / check in), but you can lock `?action=state` behind a shared secret so only the Race Director's machine can drain the full roster.

1. In Apps Script: `Project Settings → Script Properties → Add property`
   - Key: `STATE_KEY`
   - Value: any string the RD will paste (e.g. `rayong2026-dash`)
2. Set the matching value in `Trail Run Tracker.html`:
   ```html
   <script>
     window.TRT_DASHBOARD_KEY = 'rayong2026-dash';
   </script>
   ```
3. Calls to `state` without (or with the wrong) key now return `{ ok: false, error: 'unauthorized' }`.

Skip both steps if you don't care — the data isn't very sensitive and obscurity-by-URL is usually fine for a single-day training event.

## Deploy artefacts in this repo

- **`runner/index.html`** — standalone runner page that mounts `<LiveRunnerApp/>` with `?cp=…` read from the URL. Host this on any static server (Cloudflare Pages / GitHub Pages / Netlify). Paste the Web App URL into the `window.TRT_API_URL` block at the top and you're live.
- **`posters/qr-posters.html`** — printable A4 QR posters (Start / A1 / A2 / Finish). Open the file, paste the deployed runner URL in the *Base URL* field, click *Update QR*, then *Print* — one A4 page per CP. The QR encodes `<base>?cp=<id>` so a single hosted runner page handles all four posters.

## Operational notes

- **Apps Script quotas:** 20k calls/day on a free Google account. 150 runners × ~6 scans + RD dashboard polling fits comfortably. If you're worried, raise the dashboard poll interval to 15s.
- **Concurrency:** all writes go through `LockService` so simultaneous scans at the same CP won't race.
- **Backups:** the sheet is your DB — `File → Make a copy` before the event and after.
- **Editing data manually:** safe. The script re-reads the sheet on every call. Just don't reorder columns; add new ones at the end.
- **Reset for a dry run:** delete rows in `Runners`/`Checkins`/`DNF` (keep the header row). Or copy the sheet and point `SHEET_ID` at the new copy.

## What's intentionally out of scope

- Authentication for the dashboard. Add a shared secret in the URL if you need it: `?action=state&key=…` and check it in `apiState`.
- Push notifications. The dashboard polls; runners load on-demand. No background workers.
- Offline mode. The chat decided "assume signal at every CP." If signal fails at A2, fall back to staff scanning BIBs and entering them later.
