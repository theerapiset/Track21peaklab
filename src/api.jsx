// api.jsx — thin client for the Apps Script backend.
//
// Loaded before the other src/* files so they can call `window.api(...)`.
// The runner web flow uses it via the action helpers in runner-app.jsx;
// data.jsx uses it to build live snapshots for the Race Director dashboard.
//
// Configure the deployed Web App URL by setting `window.TRT_API_URL` in the
// host HTML BEFORE this script runs. If unset, the prototype falls back to
// the mock snapshot in data.jsx and api() rejects with `not_configured`.

(function () {
  const DEFAULT_TIMEOUT_MS = 12000;

  function configured() {
    return !!(window.TRT_API_URL && /^https?:\/\//.test(window.TRT_API_URL));
  }

  function buildUrl(action, params) {
    const base = window.TRT_API_URL.replace(/\?.*$/, '');
    const qs = Object.entries(params || {})
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return `${base}?action=${encodeURIComponent(action)}${qs ? '&' + qs : ''}`;
  }

  // Apps Script doPost rejects standard JSON Content-Type — send as text/plain
  // and let the script JSON.parse the body. Known platform quirk.
  async function api(action, params, opts) {
    if (!configured()) {
      const err = new Error('not_configured');
      err.code = 'not_configured';
      throw err;
    }
    const method = (opts && opts.method) || (params && Object.keys(params).length ? 'POST' : 'GET');
    const timeout = (opts && opts.timeout) || DEFAULT_TIMEOUT_MS;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const url = method === 'GET' ? buildUrl(action, params || {}) : buildUrl(action, {});
    const init = { method, signal: controller.signal };
    if (method !== 'GET') {
      init.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      init.body = JSON.stringify(params || {});
    }

    try {
      const res = await fetch(url, init);
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch (_) { body = { ok: false, error: 'bad_json', raw: text }; }
      if (!body.ok) {
        const err = new Error(body.error || 'api_error');
        err.code = body.error || 'api_error';
        err.payload = body;
        throw err;
      }
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  Object.assign(window, {
    api,
    apiIsConfigured: configured,
  });
})();
