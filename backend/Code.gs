/**
 * Trail Run Tracker — Google Apps Script backend
 *
 * Web App that backs the no-app runner web flow and the Race Director
 * dashboard. State lives in a single Google Sheet with three tabs:
 * Runners, Checkins, DNF. See backend/README.md for the schema and the
 * deploy steps.
 */

// ───────────────────────── Config ─────────────────────────

const SHEET_ID = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '';

const SHEETS = {
  runners:  'Runners',
  checkins: 'Checkins',
  dnf:      'DNF',
};

const RUNNER_COLS = [
  'id', 'token', 'name', 'phone', 'emergency_phone',
  'distance_original', 'distance_current', 'status',
  'created_at', 'updated_at',
];
const CHECKIN_COLS = [
  'id', 'runner_id', 'cp', 'timestamp', 'distance_at_checkin', 'action',
];
const DNF_COLS = [
  'id', 'runner_id', 'cp', 'timestamp', 'reason', 'note', 'pickup_requested',
];

const VALID_CPS = ['start', 'a1', 'a2', 'finish'];
const VALID_DISTANCES = ['11K', '22K', '29K'];

const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes between scans at the same CP

// ───────────────────────── Web App entry points ─────────────────────────

function doGet(e) {
  return handle(e, 'GET');
}
function doPost(e) {
  return handle(e, 'POST');
}

function handle(e, method) {
  try {
    const action = (e && e.parameter && e.parameter.action) || '';
    const body   = parseBody(e);
    const params = Object.assign({}, e.parameter || {}, body);

    let result;
    switch (action) {
      case 'register': result = apiRegister(params); break;
      case 'checkin':  result = apiCheckin(params);  break;
      case 'lookup':   result = apiLookup(params);   break;
      case 'search':   result = apiSearch(params);   break;
      case 'dnf':      result = apiDnf(params);      break;
      case 'state':    result = apiState(params);    break;
      case 'ping':     result = { ok: true, time: now() }; break;
      default:
        return json({ ok: false, error: 'unknown_action', action: action }, 400);
    }
    return json(result, 200);
  } catch (err) {
    return json({ ok: false, error: 'server_error', message: String(err && err.message || err) }, 500);
  }
}

function parseBody(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try { return JSON.parse(e.postData.contents) || {}; }
  catch (_) { return {}; }
}

function json(obj, _status) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ───────────────────────── API: register ─────────────────────────

function apiRegister(p) {
  const name  = (p.name  || '').toString().trim();
  const phone = normalizePhone(p.phone);
  const distance = (p.distance || '').toString().toUpperCase();
  const emergency = normalizePhone(p.emergency_phone || '');

  if (!name)  return { ok: false, error: 'name_required' };
  if (!phone) return { ok: false, error: 'phone_required' };
  if (VALID_DISTANCES.indexOf(distance) < 0) return { ok: false, error: 'invalid_distance' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const existing = findRunnerByPhone(phone);
    if (existing) {
      return { ok: true, action: 'already_registered', runner: existing, token: existing.token };
    }

    const id = newId('r');
    const token = newToken();
    const ts = now();
    const row = {
      id: id,
      token: token,
      name: name,
      phone: phone,
      emergency_phone: emergency,
      distance_original: distance,
      distance_current: distance,
      status: 'active',
      created_at: ts,
      updated_at: ts,
    };
    appendRow(SHEETS.runners, RUNNER_COLS, row);

    // Implicit start check-in: stamp arrival at the start line.
    appendRow(SHEETS.checkins, CHECKIN_COLS, {
      id: newId('c'),
      runner_id: id,
      cp: 'start',
      timestamp: ts,
      distance_at_checkin: distance,
      action: 'registered',
    });

    return { ok: true, action: 'registered', runner: row, token: token };
  } finally {
    lock.releaseLock();
  }
}

// ───────────────────────── API: checkin ─────────────────────────

function apiCheckin(p) {
  const token = (p.token || '').toString();
  const cp    = (p.cp    || '').toString().toLowerCase();
  if (!token) return { ok: false, error: 'token_required' };
  if (VALID_CPS.indexOf(cp) < 0) return { ok: false, error: 'invalid_cp' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const runner = findRunnerByToken(token);
    if (!runner) return { ok: false, error: 'unknown_runner' };
    if (runner.status === 'dnf') return { ok: false, error: 'runner_dnf', runner: runner };
    if (runner.status === 'finished') return { ok: false, error: 'already_finished', runner: runner };

    const checkins = listCheckinsForRunner(runner.id);
    const last = lastCheckinAt(checkins, cp);

    if (last) {
      const elapsed = now() - new Date(last.timestamp).getTime();
      if (elapsed < COOLDOWN_MS) {
        return {
          ok: false,
          error: 'cooldown',
          runner: runner,
          cp: cp,
          last_at: last.timestamp,
          wait_ms: COOLDOWN_MS - elapsed,
          cooldown_ms: COOLDOWN_MS,
        };
      }
    }

    // Apply auto-adjust BEFORE recording so the recorded distance reflects truth.
    const a1Count = countCheckins(checkins, 'a1');
    const a2Count = countCheckins(checkins, 'a2');

    let newDistance = runner.distance_current;
    let action = 'checked';

    if (cp === 'a2') {
      if (a2Count === 0 && runner.distance_current === '11K') {
        newDistance = '22K'; action = 'upgrade_11_22';
      } else if (a2Count === 1 && runner.distance_current === '22K') {
        newDistance = '29K'; action = 'upgrade_22_29';
      }
    } else if (cp === 'a1' && a1Count === 1) {
      // Second A1 scan = inbound leg
      if (runner.distance_current === '29K' && a2Count < 2) {
        newDistance = '22K'; action = 'downgrade_29_22';
      }
    } else if (cp === 'finish') {
      action = 'finished';
    }

    if (newDistance !== runner.distance_current) {
      updateRunner(runner.id, { distance_current: newDistance, updated_at: now() });
      runner.distance_current = newDistance;
    }
    if (action === 'finished') {
      updateRunner(runner.id, { status: 'finished', updated_at: now() });
      runner.status = 'finished';
    }

    const ci = {
      id: newId('c'),
      runner_id: runner.id,
      cp: cp,
      timestamp: now(),
      distance_at_checkin: newDistance,
      action: action,
    };
    appendRow(SHEETS.checkins, CHECKIN_COLS, ci);

    const response = {
      ok: true,
      action: action,
      runner: runner,
      checkin: ci,
      a1_count: a1Count + (cp === 'a1' ? 1 : 0),
      a2_count: a2Count + (cp === 'a2' ? 1 : 0),
    };

    // Finisher stats: rank within distance, total time, pace, full timeline.
    if (action === 'finished') {
      const myFinishTs = Number(ci.timestamp);
      const myStart = checkins.find(function (c) { return c.cp === 'start'; });
      const startTs = myStart ? Number(myStart.timestamp) : null;
      response.start_at = startTs;
      response.finish_at = myFinishTs;
      response.total_time_ms = startTs ? (myFinishTs - startTs) : null;
      response.distance_km = parseInt(runner.distance_current, 10) || null;

      // Rank: count finishers in the same distance bucket with an earlier
      // finish-checkin timestamp (or same ts but earlier id, deterministic tie-break).
      const allCheckins = listAllCheckins();
      const allRunners = listRunners();
      const sameDistFinishes = [];
      allRunners.forEach(function (r) {
        if (r.distance_current !== runner.distance_current) return;
        const fc = allCheckins.find(function (c) {
          return c.runner_id === r.id && c.cp === 'finish';
        });
        if (fc) sameDistFinishes.push({ id: r.id, ts: Number(fc.timestamp) });
      });
      sameDistFinishes.sort(function (a, b) { return a.ts - b.ts || a.id.localeCompare(b.id); });
      const myIdx = sameDistFinishes.findIndex(function (x) { return x.id === runner.id; });
      response.rank = myIdx >= 0 ? myIdx + 1 : sameDistFinishes.length;
      response.total_finishers = sameDistFinishes.length;

      // Timeline: all checkins for this runner, chronological, including this one.
      response.timeline = checkins.concat([ci]).map(function (c) {
        return { cp: c.cp, timestamp: Number(c.timestamp), action: c.action };
      });
    }

    return response;
  } finally {
    lock.releaseLock();
  }
}

// ───────────────────────── API: lookup (browser recall) ─────────────────────────

function apiLookup(p) {
  const token = (p.token || '').toString();
  if (!token) return { ok: false, error: 'token_required' };
  const runner = findRunnerByToken(token);
  if (!runner) return { ok: false, error: 'unknown_runner' };
  const checkins = listCheckinsForRunner(runner.id);
  return {
    ok: true,
    runner: runner,
    checkins: checkins,
    last_checkin: checkins[checkins.length - 1] || null,
  };
}

// ───────────────────────── API: search (fallback / borrowed phone) ─────────────────────────

function apiSearch(p) {
  const qRaw = (p.q || '').toString().trim();
  if (!qRaw) return { ok: true, results: [] };
  const q = qRaw.toLowerCase();
  const qDigits = qRaw.replace(/\D/g, '');
  const all = listRunners();
  const results = all.filter(function (r) {
    if (qDigits && String(r.phone || '').indexOf(qDigits) >= 0) return true;
    if (q && r.name && String(r.name).toLowerCase().indexOf(q) === 0) return true;
    return false;
  }).slice(0, 12).map(function (r) {
    // Include the token so the borrowed-phone flow can adopt the picked
    // identity and proceed to checkin. Phone is masked for shoulder-surf
    // resistance; for a training event with no real adversary this is
    // an acceptable trade between security and ergonomics.
    return { id: r.id, name: r.name, phone: maskPhone(r.phone), token: r.token,
             distance_current: r.distance_current, status: r.status };
  });
  return { ok: true, results: results };
}

// ───────────────────────── API: DNF ─────────────────────────

function apiDnf(p) {
  const token = (p.token || '').toString();
  const cp = (p.cp || '').toString().toLowerCase();
  const reason = (p.reason || '').toString();
  const note = (p.note || '').toString();
  const pickup = !!p.pickup_requested;
  if (!token) return { ok: false, error: 'token_required' };
  if (VALID_CPS.indexOf(cp) < 0) return { ok: false, error: 'invalid_cp' };
  if (!reason) return { ok: false, error: 'reason_required' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const runner = findRunnerByToken(token);
    if (!runner) return { ok: false, error: 'unknown_runner' };

    const rec = {
      id: newId('d'),
      runner_id: runner.id,
      cp: cp,
      timestamp: now(),
      reason: reason,
      note: note,
      pickup_requested: pickup ? 'TRUE' : 'FALSE',
    };
    appendRow(SHEETS.dnf, DNF_COLS, rec);
    updateRunner(runner.id, { status: 'dnf', updated_at: now() });
    runner.status = 'dnf';
    return { ok: true, action: 'dnf', runner: runner, dnf: rec };
  } finally {
    lock.releaseLock();
  }
}

// ───────────────────────── API: state (dashboard) ─────────────────────────

function apiState(p) {
  const required = PropertiesService.getScriptProperties().getProperty('STATE_KEY');
  if (required && (p.key || '') !== required) {
    return { ok: false, error: 'unauthorized' };
  }
  const runners = listRunners();
  const checkins = listAllCheckins();
  const dnf = listAllDnf();
  return { ok: true, time: now(), runners: runners, checkins: checkins, dnf: dnf };
}

// ───────────────────────── Sheet helpers ─────────────────────────

function sheet(name) {
  const id = SHEET_ID || PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('SHEET_ID script property is not set');
  const ss = SpreadsheetApp.openById(id);
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    const cols = name === SHEETS.runners ? RUNNER_COLS
               : name === SHEETS.checkins ? CHECKIN_COLS
               : name === SHEETS.dnf ? DNF_COLS : null;
    if (cols) sh.appendRow(cols);
  }
  return sh;
}

function readAll(sheetName, cols) {
  const sh = sheet(sheetName);
  const range = sh.getDataRange().getValues();
  if (range.length < 2) return [];
  const header = range[0];
  const rows = [];
  for (let i = 1; i < range.length; i++) {
    const row = range[i];
    const obj = {};
    for (let c = 0; c < cols.length; c++) {
      const idx = header.indexOf(cols[c]);
      obj[cols[c]] = idx >= 0 ? row[idx] : '';
    }
    if (obj.id) rows.push(obj);
  }
  return rows;
}

function appendRow(sheetName, cols, obj) {
  const sh = sheet(sheetName);
  const row = cols.map(function (c) { return obj[c] != null ? obj[c] : ''; });
  sh.appendRow(row);
}

function updateRunner(id, patch) {
  const sh = sheet(SHEETS.runners);
  const values = sh.getDataRange().getValues();
  const header = values[0];
  const idCol = header.indexOf('id');
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] === id) {
      Object.keys(patch).forEach(function (k) {
        const col = header.indexOf(k);
        if (col >= 0) sh.getRange(i + 1, col + 1).setValue(patch[k]);
      });
      return true;
    }
  }
  return false;
}

function listRunners()    { return readAll(SHEETS.runners,  RUNNER_COLS);  }
function listAllCheckins(){ return readAll(SHEETS.checkins, CHECKIN_COLS); }
function listAllDnf()     { return readAll(SHEETS.dnf,      DNF_COLS);     }

function listCheckinsForRunner(runnerId) {
  return listAllCheckins()
    .filter(function (c) { return c.runner_id === runnerId; })
    .sort(function (a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
}

function findRunnerByToken(token) {
  const all = listRunners();
  for (let i = 0; i < all.length; i++) if (all[i].token === token) return all[i];
  return null;
}

function findRunnerByPhone(phone) {
  const all = listRunners();
  for (let i = 0; i < all.length; i++) if (all[i].phone === phone) return all[i];
  return null;
}

function lastCheckinAt(checkins, cp) {
  for (let i = checkins.length - 1; i >= 0; i--) {
    if (checkins[i].cp === cp) return checkins[i];
  }
  return null;
}

function countCheckins(checkins, cp) {
  let n = 0;
  for (let i = 0; i < checkins.length; i++) if (checkins[i].cp === cp) n++;
  return n;
}

// ───────────────────────── Misc helpers ─────────────────────────

function now() { return new Date().getTime(); }

function newId(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function newToken() {
  return Utilities.getUuid().replace(/-/g, '');
}

function normalizePhone(s) {
  return (s || '').toString().replace(/\D/g, '');
}

function maskPhone(s) {
  const p = (s || '').toString();
  if (p.length < 4) return p;
  return p.slice(0, 3) + '••••' + p.slice(-2);
}

// ───────────────────────── One-time setup ─────────────────────────

/**
 * Run this once from the Apps Script editor after pasting the sheet ID
 * into Script Properties. It creates the three tabs with headers.
 */
function setup() {
  sheet(SHEETS.runners);
  sheet(SHEETS.checkins);
  sheet(SHEETS.dnf);
  Logger.log('Sheets ready: ' + Object.values(SHEETS).join(', '));
}
