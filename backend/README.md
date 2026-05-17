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

The HTML prototype (`Trail Run Tracker.html`) currently runs from a synthetic snapshot in `src/data.jsx`. To go live, point the runner app and the dashboard at the deployed URL:

```js
// somewhere globally
const API = 'https://script.google.com/macros/s/AKfycb…/exec';

async function api(action, params = {}, method = 'GET') {
  const url = `${API}?action=${action}`;
  const opts = method === 'POST'
    ? { method: 'POST', body: JSON.stringify(params),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' } }
    : {};
  const qs = method === 'GET'
    ? Object.entries(params).map(([k,v]) => `&${k}=${encodeURIComponent(v)}`).join('')
    : '';
  const r = await fetch(url + qs, opts);
  return r.json();
}
```

> Apps Script doesn't accept JSON `Content-Type` for `doPost` — send the body as `text/plain` and let the script parse it. This is a known Apps Script quirk, not a bug.

**Recommended client wiring**, mirroring the screens in `src/runner-app.jsx`:

| screen | call |
|---|---|
| `register` (Start) | `api('register', form, 'POST')` → save `token` to `localStorage` |
| `recognized` (next CP) | on load: `api('lookup', { token })` → fill in identity card |
| Confirm button | `api('checkin', { token, cp }, 'POST')` |
| Cooldown response | show `web-duplicate` artboard with `wait_ms` countdown |
| Upgrade/downgrade response | show `web-upgrade-22` / `web-upgrade-29` / `web-downgrade-22` |
| DNF confirm | `api('dnf', { token, cp, reason, note, pickup_requested }, 'POST')` |
| Fallback search | `api('search', { q })` |
| Dashboard poll | `setInterval(() => api('state').then(render), 10000)` |

**QR poster URLs** should embed the CP as a query string so the page knows which CP it represents:
```
https://your-domain.example/checkin.html?cp=start
https://your-domain.example/checkin.html?cp=a1
https://your-domain.example/checkin.html?cp=a2
https://your-domain.example/checkin.html?cp=finish
```

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
