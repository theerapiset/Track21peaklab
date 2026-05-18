// runner-live.jsx — Working runner-side web app, wired to the Apps Script
// backend. Renders inside an IOSDevice frame for the design canvas, but
// every input is real, every button calls the backend.
//
// State machine (one component, screens swapped by `mode`):
//   url ?cp=start            → loading → register → success
//   url ?cp=(a1|a2|finish)   → loading → recognized → confirm
//     ├─ ok                  → success (with action: checked|upgrade|downgrade|finished)
//     └─ cooldown            → duplicate (with wait_ms countdown)
//   ↻ borrowed phone         → search → confirm screen using picked runner's token
//   ✋ DNF                    → dnf-confirm → success-dnf

const { useState: useS2, useEffect: useE2, useMemo: useM2, useRef: useR2 } = React;

function LiveRunnerApp({ lang = 'th', cp: cpProp = 'a1', showChrome = true }) {
  const th = lang === 'th';
  const cp = (cpProp || readCpFromUrl()).toLowerCase();
  const cpLabel = cp === 'start' ? (th ? 'จุดสตาร์ท' : 'Start')
                : cp === 'finish' ? (th ? 'เส้นชัย' : 'Finish')
                : cp.toUpperCase();

  // mode: loading | register | recognized | submitting | success | cooldown | dnf-form | error | search
  const [mode, setMode] = useS2('loading');
  const [identity, setIdentity] = useS2(null);   // server-side runner object
  const [lastResult, setLastResult] = useS2(null); // backend response from a successful action
  const [errMsg, setErrMsg] = useS2('');

  // On mount: try lookup() if we have a token; else go to register (at start) / search (elsewhere).
  useE2(() => {
    let cancelled = false;
    (async () => {
      const token = getRunnerToken();
      if (!token) {
        setMode(cp === 'start' ? 'register' : 'search');
        return;
      }
      try {
        const res = await runnerLookup();
        if (cancelled) return;
        if (!res) { setMode(cp === 'start' ? 'register' : 'search'); return; }
        setIdentity(res.runner);
        setMode(cp === 'start' ? 'already-registered' : 'recognized');
      } catch (err) {
        if (cancelled) return;
        if (err.code === 'unknown_runner') {
          clearRunnerToken();
          setMode(cp === 'start' ? 'register' : 'search');
        } else if (err.code === 'not_configured') {
          setMode('error'); setErrMsg('not_configured');
        } else {
          setMode('error'); setErrMsg(err.code || 'fetch_failed');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [cp]);

  async function handleRegister(form) {
    setMode('submitting'); setErrMsg('');
    console.log('[trt] register submit', form);
    try {
      const res = await runnerRegister(form);
      console.log('[trt] register ok', res);
      setIdentity(res.runner);
      setLastResult(res);
      setMode('success');
    } catch (err) {
      console.error('[trt] register failed:', err, 'code=', err && err.code, 'payload=', err && err.payload);
      setErrMsg((err && err.code) || (err && err.message) || 'register_failed');
      setMode('register');
    }
  }

  async function handleConfirmCheckin() {
    setMode('submitting'); setErrMsg('');
    console.log('[trt] checkin submit', cp);
    try {
      const res = await runnerCheckin(cp);
      console.log('[trt] checkin ok', res);
      setIdentity(res.runner);
      setLastResult(res);
      setMode('success');
    } catch (err) {
      console.error('[trt] checkin failed:', err, 'code=', err && err.code);
      if (err && err.code === 'cooldown') {
        setLastResult(err.payload);
        setMode('cooldown');
      } else {
        setErrMsg((err && err.code) || (err && err.message) || 'checkin_failed');
        setMode('recognized');
      }
    }
  }

  async function handleDnf(form) {
    setMode('submitting'); setErrMsg('');
    try {
      const res = await runnerDnf({ cp, ...form });
      setLastResult(res);
      setMode('success-dnf');
    } catch (err) {
      setErrMsg(err.code || 'dnf_failed');
      setMode('dnf-form');
    }
  }

  function handleNotMe() { clearRunnerToken(); setIdentity(null); setMode('search'); }
  function handlePicked(picked) {
    // Borrowed-phone path: adopt the picked runner's token + identity, then
    // hand off to the recognized panel so the user just taps confirm.
    if (!picked || !picked.token) { setErrMsg('cannot_claim_identity'); return; }
    setMode('submitting');
    setRunnerToken(picked.token);
    runnerLookup()
      .then(res => {
        if (res && res.runner) { setIdentity(res.runner); setMode('recognized'); }
        else { setMode('search'); }
      })
      .catch(err => {
        console.error('[trt] picked lookup failed:', err);
        setErrMsg((err && err.code) || 'lookup_failed');
        setMode('search');
      });
  }

  return (
    <div style={{ height: '100%', background: '#fafaf8', display: 'flex',
      flexDirection: 'column', fontFamily: th ? '"Noto Sans Thai", ' + RA.font : RA.font }}>
      {showChrome && <SafariChrome url={`trail.run/cp/${cp}`}/>}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {mode === 'loading' && <LoadingPanel th={th}/>}
        {mode === 'error' && <ErrorPanel th={th} code={errMsg}/>}

        {mode === 'register' && (
          <RegisterPanel th={th} cpLabel={cpLabel} onSubmit={handleRegister} err={errMsg}/>
        )}
        {mode === 'already-registered' && identity && (
          <AlreadyRegisteredPanel th={th} runner={identity}
            onReset={() => { clearRunnerToken(); setIdentity(null); setMode('register'); }}/>
        )}
        {mode === 'submitting' && <LoadingPanel th={th} label={th ? 'กำลังบันทึก…' : 'Submitting…'}/>}

        {mode === 'recognized' && identity && (
          <RecognizedPanel th={th} runner={identity} cp={cp} cpLabel={cpLabel}
            err={errMsg}
            onConfirm={handleConfirmCheckin}
            onNotMe={handleNotMe}
            onDnf={() => setMode('dnf-form')}/>
        )}

        {mode === 'success' && identity && lastResult && lastResult.action === 'finished' && (
          <FinishPanel th={th} runner={identity} result={lastResult}/>
        )}
        {mode === 'success' && identity && lastResult && lastResult.action !== 'finished' && (
          <SuccessPanel th={th} runner={identity} cp={cp} cpLabel={cpLabel}
            result={lastResult}/>
        )}
        {mode === 'success-dnf' && identity && (
          <DnfSuccessPanel th={th} runner={identity} cpLabel={cpLabel}/>
        )}

        {mode === 'cooldown' && lastResult && (
          <CooldownPanel th={th} cpLabel={cpLabel} payload={lastResult}
            onBack={() => setMode('recognized')}/>
        )}

        {mode === 'dnf-form' && identity && (
          <DnfFormPanel th={th} runner={identity} cpLabel={cpLabel}
            onCancel={() => setMode('recognized')} onSubmit={handleDnf} err={errMsg}/>
        )}

        {mode === 'search' && (
          <SearchPanel th={th} cpLabel={cpLabel}
            onBack={() => setMode(cp === 'start' ? 'register' : 'search')}
            onPicked={handlePicked}/>
        )}
      </div>
    </div>
  );
}

function readCpFromUrl() {
  try {
    const u = new URL(window.location.href);
    return (u.searchParams.get('cp') || u.pathname.split('/').filter(Boolean).pop() || 'a1').toLowerCase();
  } catch (_) { return 'a1'; }
}

// ─── Panels ─────────────────────────────────────────────────────────────

function PanelHeader({ kicker, title, subtitle, color = RA.brand }) {
  return (
    <div style={{ padding: '22px 24px 18px', background: color, color: '#fff' }}>
      <div style={{ fontFamily: RA.mono, fontSize: 10, letterSpacing: '0.12em',
        opacity: 0.6 }}>{kicker}</div>
      <div style={{ fontFamily: RA.font, fontSize: 26, fontWeight: 600,
        letterSpacing: '-0.025em', lineHeight: 1.15, marginTop: 10 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ marginTop: 8, fontSize: 13,
          color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{subtitle}</div>
      )}
    </div>
  );
}

function PrimaryButton({ label, onClick, disabled, color = RA.brand }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '18px 16px',
      background: disabled ? '#a8b1a3' : color, color: '#fff', border: 'none',
      borderRadius: 8, fontFamily: RA.font, fontSize: 16, fontWeight: 600,
      letterSpacing: '-0.005em', cursor: disabled ? 'wait' : 'pointer',
    }}>{label}</button>
  );
}

function SecondaryButton({ label, onClick, color = RA.text, dashed }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '12px', background: '#fff',
      border: `1px ${dashed ? 'dashed' : 'solid'} ${RA.borderS}`,
      borderRadius: 6, fontFamily: RA.mono, fontSize: 11, letterSpacing: '0.06em',
      textTransform: 'uppercase', fontWeight: 600, color, cursor: 'pointer',
    }}>{label}</button>
  );
}

function Input({ label, value, onChange, placeholder, type = 'text', autoFocus, mono }) {
  return (
    <div>
      <div style={{ fontFamily: RA.mono, fontSize: 10, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: RA.muted, marginBottom: 6 }}>{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoFocus={autoFocus}
        style={{ width: '100%', padding: '13px 14px', background: '#fff',
          border: `1px solid ${RA.borderS}`, borderRadius: 6, outline: 'none',
          fontFamily: mono ? RA.mono : RA.font, fontSize: 15, fontWeight: 500,
          color: RA.text, letterSpacing: mono ? '0.02em' : 'normal' }}/>
    </div>
  );
}

function LoadingPanel({ th, label }) {
  return (
    <div style={{ padding: 32, textAlign: 'center', color: RA.muted,
      fontFamily: RA.mono, fontSize: 11, letterSpacing: '0.08em' }}>
      {label || (th ? 'กำลังโหลด…' : 'Loading…')}
    </div>
  );
}

function ErrorPanel({ th, code }) {
  const msg = code === 'not_configured'
    ? (th ? 'ระบบยังไม่ได้ตั้งค่า · ตั้ง window.TRT_API_URL ก่อน' : 'Backend URL not configured · set window.TRT_API_URL')
    : (th ? `ติดต่อ server ไม่ได้ · ${code}` : `Cannot reach server · ${code}`);
  return (
    <div style={{ padding: 24 }}>
      <PanelHeader kicker="ERROR" title={th ? 'มีปัญหา' : 'Something went wrong'}
        color={RA.alert}/>
      <div style={{ padding: 16, fontSize: 13, color: RA.text }}>{msg}</div>
    </div>
  );
}

function RegisterPanel({ th, cpLabel, onSubmit, err }) {
  const [name, setName] = useS2('');
  const [phone, setPhone] = useS2('');
  const [distance, setDistance] = useS2('22K');
  const [emergency, setEmergency] = useS2('');
  const canSubmit = name.trim() && phone.replace(/\D/g, '').length >= 9;
  return (
    <div>
      <PanelHeader
        kicker={`RAYONG TRAIL · ${cpLabel}`}
        title={th ? 'สวัสดี! ลงทะเบียนก่อนวิ่ง' : 'Welcome! Quick sign-up'}
        subtitle={th
          ? 'กรอกชื่อกับเบอร์ครั้งเดียว · จุดถัดๆไปแค่กดยืนยัน'
          : 'Fill once · next CPs just need one tap to confirm'}/>
      <form onSubmit={e => { e.preventDefault(); if (canSubmit) onSubmit({
        name: name.trim(), phone, distance, emergency_phone: emergency,
      }); }} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label={th ? 'ชื่อเล่น' : 'Nickname'} value={name} onChange={setName}
          placeholder={th ? 'เช่น ธีระ' : 'e.g. Theera'} autoFocus/>
        <Input label={th ? 'เบอร์โทร' : 'Phone number'} value={phone} onChange={setPhone}
          placeholder="08X-XXX-XXXX" type="tel" mono/>
        <DistancePicker value={distance} onChange={setDistance} th={th}/>
        <Input label={th ? 'เบอร์ฉุกเฉิน (ไม่บังคับ)' : 'Emergency contact (optional)'}
          value={emergency} onChange={setEmergency}
          placeholder={th ? 'เบอร์คนใกล้ตัว' : 'Family/friend phone'} type="tel" mono/>

        {err && <ErrorRow th={th} code={err}/>}

        <PrimaryButton label={th ? 'ลงทะเบียน · ออกตัวเลย ↗' : 'Sign up · let’s go ↗'}
          disabled={!canSubmit}/>
        <div style={{ marginTop: 4, padding: '10px 12px', background: '#f4f3ef',
          borderRadius: 6, fontFamily: RA.mono, fontSize: 10, color: RA.muted,
          letterSpacing: '0.04em', lineHeight: 1.55 }}>
          {th
            ? '🔒 เก็บแค่ชื่อ + เบอร์ + ระยะ · ลบทิ้งหลังจบงาน 7 วัน'
            : '🔒 We only keep name + phone + distance · purged 7 days after race'}
        </div>
      </form>
    </div>
  );
}

function DistancePicker({ value, onChange, th }) {
  return (
    <div>
      <div style={{ fontFamily: RA.mono, fontSize: 10, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: RA.muted, marginBottom: 6 }}>
        {th ? 'ระยะที่ลงวิ่ง' : 'Distance'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {['11K', '22K', '29K'].map(d => {
          const active = value === d;
          return (
            <button key={d} type="button" onClick={() => onChange(d)} style={{
              padding: '14px 10px', background: active ? RA.brand : '#fff',
              color: active ? '#fff' : RA.text,
              border: `1px solid ${active ? RA.brand : RA.borderS}`,
              borderRadius: 6, fontFamily: RA.font, fontWeight: 600, fontSize: 16,
              cursor: 'pointer',
            }}>{d}</button>
          );
        })}
      </div>
    </div>
  );
}

function AlreadyRegisteredPanel({ th, runner, onReset }) {
  return (
    <div>
      <PanelHeader kicker="RAYONG TRAIL · START"
        title={th ? `สวัสดี ${runner.name}!` : `Hi ${runner.name}!`}
        subtitle={th ? 'คุณลงทะเบียนแล้ว · เริ่มวิ่งได้เลย' : 'You\'re registered · ready to run'}/>
      <div style={{ padding: 20 }}>
        <RunnerCard th={th} runner={runner} cpLabel={th ? 'จุดสตาร์ท' : 'Start'} cp="start"/>
        <div style={{ height: 16 }}/>
        <SecondaryButton label={th ? 'ไม่ใช่ฉัน · ใช้เครื่องคนอื่น' : 'Not me · borrowed phone'}
          onClick={onReset} dashed/>
      </div>
    </div>
  );
}

function RecognizedPanel({ th, runner, cp, cpLabel, onConfirm, onNotMe, onDnf, err }) {
  return (
    <div>
      <PanelHeader kicker={`RAYONG TRAIL · ${cpLabel}`}
        title={th ? `สวัสดี ${runner.name}!` : `Hi ${runner.name}!`}
        subtitle={th
          ? 'ระบบจำคุณได้แล้ว · กดยืนยันเข้าจุดพักได้เลย'
          : 'You\'re recognised · just confirm to check in'}/>
      <div style={{ padding: '18px 20px 12px' }}>
        <RunnerCard th={th} runner={runner} cpLabel={cpLabel} cp={cp}/>
      </div>
      {err && <div style={{ padding: '0 20px 12px' }}><ErrorRow th={th} code={err}/></div>}
      <div style={{ padding: '0 20px 12px' }}>
        <PrimaryButton onClick={onConfirm}
          label={th ? `ยืนยันเข้าจุดพัก ${cpLabel}` : `Confirm arrival at ${cpLabel}`}/>
      </div>
      <div style={{ padding: '4px 20px 18px', display: 'flex',
        flexDirection: 'column', gap: 6 }}>
        <SecondaryButton onClick={onNotMe} dashed
          label={th ? 'ไม่ใช่ฉัน · ใช้เครื่องคนอื่นอยู่' : 'Not me · I’m on a borrowed phone'}/>
        <button onClick={onDnf} style={{
          marginTop: 4, padding: 6, background: 'transparent', border: 'none',
          fontFamily: RA.mono, fontSize: 10, letterSpacing: '0.08em',
          textTransform: 'uppercase', fontWeight: 600, color: RA.alert,
          cursor: 'pointer', textDecoration: 'underline',
        }}>{th ? 'ขอ DNF · ขอถอนตัวจากการแข่ง' : 'Request DNF · withdraw from race'}</button>
      </div>
    </div>
  );
}

function RunnerCard({ th, runner, cpLabel, cp }) {
  // Sheets can return phone as a number — coerce before slicing.
  const phoneTail = String(runner.phone || '').slice(-4);
  return (
    <div style={{ background: '#fff', border: `1px solid ${RA.border}`,
      borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 999,
          background: RA.brand, color: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 18, fontWeight: 600 }}>
          {(runner.name || '?').slice(0, 1)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: RA.text }}>{runner.name}</div>
          <div style={{ fontFamily: RA.mono, fontSize: 11, color: RA.muted, marginTop: 2 }}>
            08X-XXX-{phoneTail} · {runner.distance_current}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 6, borderTop: `1px solid ${RA.border}` }}>
        <div>
          <div style={{ fontFamily: RA.mono, fontSize: 9, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: RA.muted }}>
            {th ? 'สถานะ' : 'Status'}
          </div>
          <div style={{ fontFamily: RA.mono, fontSize: 13, fontWeight: 500,
            color: RA.text, marginTop: 2 }}>{runner.status}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: RA.mono, fontSize: 9, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: RA.muted }}>
            {th ? 'จุดนี้' : 'This CP'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: RA.text, marginTop: 2 }}>
            {cpLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessPanel({ th, runner, cp, cpLabel, result }) {
  const action = result.action || 'checked';
  const isUpgrade = action.indexOf('upgrade') === 0;
  const isDowngrade = action.indexOf('downgrade') === 0;
  const isFinished = action === 'finished';
  const isRegistered = action === 'registered' || action === 'already_registered';
  const color = isDowngrade ? '#d97706' : isFinished ? RA.brandDk : RA.brand;
  const headline = isFinished ? (th ? `🏁 เข้าเส้นชัย ${runner.distance_current}!` : `🏁 Finished ${runner.distance_current}!`)
    : isUpgrade ? (th ? '✨ ระบบอัพเกรดระยะให้คุณ!' : '✨ Auto-upgraded!')
    : isDowngrade ? (th ? '🛡 ระบบปรับระยะให้เหมาะ' : '🛡 Auto-adjusted')
    : isRegistered ? (th ? 'ลงทะเบียนเรียบร้อย' : 'You\'re in')
    : (th ? `เช็คอินที่ ${cpLabel} สำเร็จ` : `Checked in at ${cpLabel}`);
  return (
    <div>
      <PanelHeader kicker="✓ OK" color={color}
        title={th ? `สวัสดี ${runner.name}` : `Hi ${runner.name}`}
        subtitle={headline}/>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(isUpgrade || isDowngrade) && (
          <div style={{ padding: 16, background: '#fff', border: `1px solid ${RA.border}`,
            borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontFamily: RA.mono, fontSize: 10, color: RA.muted,
              letterSpacing: '0.1em' }}>
              {th ? 'ระยะใหม่ของคุณ' : 'Your new distance'}
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, marginTop: 6, color: RA.text }}>
              {result.runner ? result.runner.distance_original : runner.distance_original} {isDowngrade ? '↓' : '↑'} {runner.distance_current}
            </div>
          </div>
        )}
        <RunnerCard th={th} runner={runner} cpLabel={cpLabel} cp={cp}/>
        <div style={{ fontFamily: RA.mono, fontSize: 11, color: RA.muted,
          textAlign: 'center', letterSpacing: '0.06em' }}>
          {th ? 'ระบบบันทึกแล้ว · เก็บหน้านี้ไว้ก็ได้' : 'Saved · you can keep this page'}
        </div>
      </div>
    </div>
  );
}

// ─── Finish celebration ─────────────────────────────────────────────────

const SEMANTIC_CP_LABEL = {
  start:   { th: 'จุดสตาร์ท',  en: 'Start' },
  a1_out:  { th: 'A1 · ขาไป',  en: 'A1 outbound' },
  a2_in:   { th: 'A2 · ขึ้นเขา', en: 'A2 uphill' },
  a2_out:  { th: 'A2 · ลงเขา', en: 'A2 downhill' },
  a1_in:   { th: 'A1 · ขากลับ', en: 'A1 return' },
  finish:  { th: 'เส้นชัย',     en: 'Finish' },
};

function semanticForTimeline(items) {
  // Map raw cp ids (start/a1/a2/finish) to semantic labels by occurrence order.
  const counts = { a1: 0, a2: 0 };
  return items.map(function (c) {
    let id = c.cp;
    if (c.cp === 'a1') { id = counts.a1 === 0 ? 'a1_out' : 'a1_in'; counts.a1++; }
    else if (c.cp === 'a2') { id = counts.a2 === 0 ? 'a2_in' : 'a2_out'; counts.a2++; }
    return { id: id, ts: c.timestamp, action: c.action };
  });
}

function fmtElapsed(ms) {
  if (!ms || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return (h > 0 ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0');
}

function fmtClockOfDay(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function FinishPanel({ th, runner, result }) {
  const totalMs = Number(result.total_time_ms) || 0;
  const distanceKm = Number(result.distance_km) || parseInt(runner.distance_current, 10) || 0;
  const paceMinPerKm = distanceKm > 0 ? (totalMs / 60000) / distanceKm : 0;
  const paceMm = Math.floor(paceMinPerKm);
  const paceSs = Math.round((paceMinPerKm - paceMm) * 60);
  const rank = Number(result.rank) || 0;
  const totalFin = Number(result.total_finishers) || rank;
  const wasAdjusted = runner.distance_original && runner.distance_original !== runner.distance_current;
  const timeline = semanticForTimeline(result.timeline || []);

  async function handleShare() {
    const text = th
      ? `${runner.name} เข้าเส้นชัย ${runner.distance_current} ในเวลา ${fmtElapsed(totalMs)} · ลำดับที่ ${rank}/${totalFin} · Rayong Trail 2026`
      : `${runner.name} finished ${runner.distance_current} in ${fmtElapsed(totalMs)} · rank ${rank}/${totalFin} · Rayong Trail 2026`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Rayong Trail · Finish', text: text, url: window.location.origin });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        alert(th ? 'คัดลอกข้อความแล้ว · นำไปแชร์ได้' : 'Copied to clipboard');
      }
    } catch (_) { /* user cancelled */ }
  }

  function handleSavePdf() {
    document.body.classList.add('trt-print-cert');
    window.print();
    setTimeout(function () { document.body.classList.remove('trt-print-cert'); }, 500);
  }

  return (
    <div style={{ background: '#fafaf8' }}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(180deg, ' + RA.brand + ' 0%, ' + RA.brandDk + ' 100%)',
        padding: '28px 24px 36px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.08, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle at 20% 30%, #fff 1px, transparent 1.5px), radial-gradient(circle at 70% 60%, #fff 1px, transparent 1.5px), radial-gradient(circle at 40% 80%, #fff 1px, transparent 1.5px)',
          backgroundSize: '60px 60px, 40px 40px, 80px 80px' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, position: 'relative' }}>
          <img src="../assets/rayong-trail-logo.jpg" alt=""
            style={{ width: 42, height: 'auto', borderRadius: 6 }}/>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>Rayong Trail Running</div>
            <div style={{ fontFamily: RA.mono, fontSize: 9, letterSpacing: '0.14em', opacity: 0.7 }}>
              2026 · FINISHER
            </div>
          </div>
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, position: 'relative',
          fontStyle: 'italic' }}>
          🏁 {runner.name}!
        </div>
        <div style={{ marginTop: 10, fontSize: 14, opacity: 0.92, position: 'relative' }}>
          {th
            ? `เข้าเส้นชัย ${runner.distance_current} สำเร็จ! ยอดเยี่ยมมาก 👏`
            : `Finished ${runner.distance_current}! Outstanding 👏`}
        </div>
      </div>

      {/* Big time card */}
      <div style={{ padding: '0 20px', marginTop: -20, position: 'relative' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${RA.border}`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)', padding: '22px 20px' }}>
          <div style={{ fontFamily: RA.mono, fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: RA.muted, textAlign: 'center' }}>
            {th ? 'เวลาทางการ' : 'Official time'}
          </div>
          <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-0.03em',
            color: RA.text, textAlign: 'center', marginTop: 4, fontStyle: 'italic',
            fontVariantNumeric: 'tabular-nums' }}>
            {fmtElapsed(totalMs)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14,
            marginTop: 18, paddingTop: 16, borderTop: `1px solid ${RA.border}` }}>
            <Stat label={th ? 'ระยะ' : 'Distance'}
              value={runner.distance_current}/>
            <Stat label={th ? 'เพซเฉลี่ย' : 'Avg pace'}
              value={paceMm > 0 ? `${paceMm}'${String(paceSs).padStart(2,'0')}"` : '—'}
              hint={th ? '/กม.' : '/km'}/>
            <Stat label={th ? 'ลำดับ' : 'Rank'}
              value={rank > 0 ? `#${rank}` : '—'}
              hint={totalFin > 0 ? `/ ${totalFin}` : ''}/>
          </div>
        </div>
      </div>

      {/* Auto-adjust note */}
      {wasAdjusted && (
        <div style={{ margin: '16px 20px 0', padding: '12px 14px',
          background: '#fff7e6', border: '1px solid #f6c66a', borderRadius: 8 }}>
          <div style={{ fontFamily: RA.mono, fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#92400e' }}>🛡 ปรับระยะอัตโนมัติ</div>
          <div style={{ fontSize: 13, color: '#78350f', marginTop: 4, lineHeight: 1.5 }}>
            {th
              ? `จบที่ ${runner.distance_current} · ลงทะเบียนไว้ ${runner.distance_original} · ระบบปรับตามจุดที่ผ่านจริง`
              : `Finished ${runner.distance_current} · registered ${runner.distance_original}`}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div style={{ padding: '20px' }}>
        <div style={{ fontFamily: RA.mono, fontSize: 10, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: RA.muted, marginBottom: 10 }}>
          {th ? 'ไทม์ไลน์' : 'Timeline'}
        </div>
        <div style={{ background: '#fff', border: `1px solid ${RA.border}`,
          borderRadius: 8, overflow: 'hidden' }}>
          {timeline.map(function (it, i) {
            const lbl = SEMANTIC_CP_LABEL[it.id] || { th: it.id, en: it.id };
            const splitMs = i > 0 ? (it.ts - timeline[0].ts) : 0;
            const isFinish = it.id === 'finish';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                borderTop: i ? `1px solid ${RA.border}` : 'none',
                background: isFinish ? '#ecfdf5' : '#fff' }}>
                <div style={{ width: 26, height: 26, borderRadius: 999,
                  background: isFinish ? RA.brand : RA.border, color: isFinish ? '#fff' : RA.muted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700 }}>
                  {isFinish ? '🏁' : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: RA.text }}>
                    {th ? lbl.th : lbl.en}
                  </div>
                  <div style={{ fontFamily: RA.mono, fontSize: 11, color: RA.muted, marginTop: 2 }}>
                    {fmtClockOfDay(it.ts)}{i > 0 ? ` · +${fmtElapsed(splitMs)}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Medal callout */}
      <div style={{ margin: '4px 20px 16px', padding: '14px 16px',
        background: '#ecfdf5', border: `1px solid #6ee7b7`, borderRadius: 8,
        display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 28 }}>🏅</div>
        <div style={{ fontSize: 13, color: RA.text, lineHeight: 1.5 }}>
          {th
            ? <>รับเหรียญที่<b> โต๊ะข้างเส้นชัย</b> · โชว์หน้านี้ให้ทีมงาน</>
            : <>Pick up your medal at the <b>finish table</b> · show this page to staff</>}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PrimaryButton onClick={handleShare}
          label={th ? '📤 แชร์ผลวิ่ง' : '📤 Share result'}/>
        <SecondaryButton onClick={handleSavePdf}
          label={th ? '🖨 บันทึกใบประกาศ (Save as PDF)' : '🖨 Save certificate (Save as PDF)'}/>
        <a href="../results/" style={{
          textAlign: 'center', padding: '12px', textDecoration: 'none',
          fontFamily: RA.mono, fontSize: 11, letterSpacing: '0.06em',
          textTransform: 'uppercase', fontWeight: 600, color: RA.brand,
        }}>
          {th ? '📊 ดูผลทั้งหมด · นักวิ่งทุกคน' : '📊 View all results'}
        </a>
      </div>

      {/* Closing line */}
      <div style={{ padding: '0 20px 28px', textAlign: 'center',
        fontSize: 13, color: RA.muted, lineHeight: 1.55 }}>
        {th
          ? 'ขอบคุณที่มาวิ่งด้วยกัน · พักผ่อน ดื่มน้ำเยอะๆ แล้วเจอกันรอบหน้านะ 🌲'
          : 'Thanks for running with us · rest, hydrate, see you next time 🌲'}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: RA.mono, fontSize: 9, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: RA.muted }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: RA.text,
        marginTop: 4, letterSpacing: '-0.01em' }}>{value}</div>
      {hint && <div style={{ fontFamily: RA.mono, fontSize: 10, color: RA.muted, marginTop: 1 }}>{hint}</div>}
    </div>
  );
}

function CooldownPanel({ th, cpLabel, payload, onBack }) {
  const [now, setNow] = useS2(Date.now());
  useE2(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const lastAt = Number(payload.last_at) || now;
  const total = Number(payload.cooldown_ms) || 3600000;
  const elapsed = Math.max(0, now - lastAt);
  const remain = Math.max(0, total - elapsed);
  const mm = Math.floor(remain / 60000);
  const ss = Math.floor((remain % 60000) / 1000);
  const pct = Math.min(100, (elapsed / total) * 100);
  return (
    <div>
      <PanelHeader kicker={`⚠ ${th ? 'ซ้ำ' : 'DUPLICATE'}`} color={RA.alert}
        title={th ? 'คุณเพิ่งเช็คอินไป' : 'Just checked in'}
        subtitle={th ? `${cpLabel} · รอครบ 60 นาทีก่อนสแกนรอบหน้า`
                     : `${cpLabel} · wait 60 min before next scan`}/>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: 18, background: '#fff', border: `1px solid ${RA.border}`,
          borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontFamily: RA.mono, fontSize: 10, color: RA.muted,
            letterSpacing: '0.1em' }}>
            {th ? 'สแกนได้อีกใน' : 'Try again in'}
          </div>
          <div style={{ fontFamily: RA.mono, fontSize: 32, fontWeight: 700,
            marginTop: 8, color: RA.text, fontVariantNumeric: 'tabular-nums' }}>
            {String(mm).padStart(2,'0')}:{String(ss).padStart(2,'0')}
          </div>
          <div style={{ marginTop: 14, height: 6, borderRadius: 999,
            background: RA.border, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: RA.brand }}/>
          </div>
        </div>
        <div style={{ padding: '12px 14px', background: '#fff7e6',
          border: '1px solid #f6c66a', borderRadius: 6,
          fontFamily: RA.mono, fontSize: 11, color: '#78350f', lineHeight: 1.5 }}>
          {th
            ? 'ทำไม? · ป้องกันการกดซ้ำตอนยังไม่ได้วนรอบเขา · ทีมงานจะเห็นว่ามีคนพยายามสแกนซ้ำ'
            : 'Why? · prevents accidental re-scan before completing the loop · staff sees the attempt'}
        </div>
        <SecondaryButton onClick={onBack}
          label={th ? '← กลับ' : '← Go back'}/>
      </div>
    </div>
  );
}

const DNF_REASONS = [
  ['injury',    { th: 'บาดเจ็บ',         en: 'Injury' }],
  ['exhausted', { th: 'หมดแรง',         en: 'Exhausted' }],
  ['cutoff',    { th: 'ใกล้ cut-off',   en: 'Cut-off' }],
  ['personal',  { th: 'ปัญหาส่วนตัว',  en: 'Personal' }],
  ['weather',   { th: 'สภาพอากาศ',    en: 'Weather' }],
  ['other',     { th: 'อื่นๆ',           en: 'Other' }],
];

function DnfFormPanel({ th, runner, cpLabel, onCancel, onSubmit, err }) {
  const [reason, setReason] = useS2('exhausted');
  const [note, setNote] = useS2('');
  const [pickup, setPickup] = useS2(false);
  return (
    <div>
      <PanelHeader kicker={`✋ DNF · ${cpLabel}`} color={RA.alert}
        title={th ? 'ยืนยันขอถอนตัว' : 'Confirm withdrawal'}
        subtitle={th ? `${runner.name} · ทีมงานจะรู้ทันทีว่าคุณไม่วิ่งต่อ`
                     : `${runner.name} · staff will be notified right away`}/>
      <form onSubmit={e => { e.preventDefault(); onSubmit({
        reason, note: note.trim(), pickup_requested: pickup,
      }); }} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontFamily: RA.mono, fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: RA.muted, marginBottom: 6 }}>
            {th ? 'เหตุผล (จำเป็น)' : 'Reason (required)'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DNF_REASONS.map(([k, label]) => {
              const active = reason === k;
              return (
                <button key={k} type="button" onClick={() => setReason(k)} style={{
                  padding: '8px 12px', borderRadius: 999,
                  background: active ? RA.alert : '#fff',
                  color: active ? '#fff' : RA.text,
                  border: `1px solid ${active ? RA.alert : RA.borderS}`,
                  fontFamily: RA.font, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer',
                }}>{active ? '✓ ' : ''}{label[th ? 'th' : 'en']}</button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: RA.mono, fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: RA.muted, marginBottom: 6 }}>
            {th ? 'รายละเอียด (ไม่บังคับ)' : 'Note (optional)'}
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            rows={3} style={{ width: '100%', padding: '12px 14px', background: '#fff',
              border: `1px solid ${RA.borderS}`, borderRadius: 6, outline: 'none',
              fontFamily: RA.font, fontSize: 14, color: RA.text, resize: 'vertical' }}
            placeholder={th ? 'เช่น ตะคริวที่น่อง…' : 'e.g. cramping calves…'}/>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', background: '#fff7e6',
          border: '1px solid #f6c66a', borderRadius: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={pickup}
            onChange={e => setPickup(e.target.checked)} style={{ width: 18, height: 18 }}/>
          <span style={{ fontFamily: RA.font, fontSize: 13, color: RA.text }}>
            🚐 {th ? 'ขอรถรับ · ทีม S&R จะมารับที่จุดนี้' : 'Request pickup · S&R will come for me'}
          </span>
        </label>

        {err && <ErrorRow th={th} code={err}/>}

        <PrimaryButton color={RA.alert}
          label={th ? `✓ ยืนยัน DNF · ที่ ${cpLabel}` : `✓ Confirm DNF · at ${cpLabel}`}/>
        <SecondaryButton onClick={onCancel}
          label={th ? '← ขอกลับ · วิ่งต่อ' : '← Back · keep running'}/>
      </form>
    </div>
  );
}

function DnfSuccessPanel({ th, runner, cpLabel }) {
  return (
    <div>
      <PanelHeader kicker="✋ DNF" color={RA.alert}
        title={th ? 'บันทึก DNF แล้ว' : 'DNF recorded'}
        subtitle={th ? `${runner.name} · ทีมงานเห็นแล้ว · ขอบคุณที่มาวิ่งด้วยกัน`
                     : `${runner.name} · staff has been notified`}/>
      <div style={{ padding: 24, fontSize: 14, color: RA.text, lineHeight: 1.6 }}>
        {th
          ? `พักผ่อน ดื่มน้ำ และนั่งรอที่ ${cpLabel} ทีมงานจะมาดูแลครับ 🌲`
          : `Rest, hydrate, and wait at ${cpLabel}. The team is on the way 🌲`}
      </div>
    </div>
  );
}

function SearchPanel({ th, cpLabel, onBack, onPicked }) {
  const [q, setQ] = useS2('');
  const [results, setResults] = useS2([]);
  const [loading, setLoading] = useS2(false);
  const timer = useR2(null);
  useE2(() => {
    if (q.length < 1) { setResults([]); return; }
    setLoading(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await runnerSearch(q);
        setResults(r); setLoading(false);
      } catch (_) { setLoading(false); }
    }, 200);
    return () => clearTimeout(timer.current);
  }, [q]);
  return (
    <div>
      <PanelHeader kicker={`↻ ${th ? 'มือถือเพื่อน' : 'BORROWED PHONE'}`}
        title={th ? 'ค้นหาตัวเอง' : 'Find yourself'}
        subtitle={th ? 'พิมพ์ชื่อหรือเบอร์ของคุณ' : 'Type your name or phone'}/>
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input label={th ? 'ชื่อ / เบอร์' : 'Name / phone'} value={q} onChange={setQ}
          placeholder={th ? 'เช่น ธ หรือ 0812' : 'e.g. T or 0812'} autoFocus/>
        <div style={{ background: '#fff', border: `1px solid ${RA.border}`,
          borderRadius: 8, overflow: 'hidden', minHeight: 60 }}>
          {loading && (
            <div style={{ padding: 14, fontFamily: RA.mono, fontSize: 11,
              color: RA.muted }}>…</div>
          )}
          {!loading && results.length === 0 && q && (
            <div style={{ padding: 14, fontFamily: RA.mono, fontSize: 11,
              color: RA.muted }}>{th ? 'ไม่พบ' : 'No matches'}</div>
          )}
          {results.map((r, i) => (
            <button key={r.id || i} type="button" onClick={() => onPicked(r)}
              style={{ display: 'flex', width: '100%', padding: '12px 14px',
                background: '#fff', border: 'none', borderTop: i ? `1px solid ${RA.border}` : 'none',
                textAlign: 'left', cursor: 'pointer', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: RA.text }}>{r.name}</div>
                <div style={{ fontFamily: RA.mono, fontSize: 11, color: RA.muted,
                  marginTop: 2 }}>{r.phone} · {r.distance_current}</div>
              </div>
              <span style={{ fontSize: 16, color: RA.muted }}>›</span>
            </button>
          ))}
        </div>
        <div style={{ padding: '10px 12px', background: '#fff7e6',
          border: '1px solid #f6c66a', borderRadius: 6,
          fontFamily: RA.mono, fontSize: 10, color: '#78350f',
          letterSpacing: '0.04em', lineHeight: 1.55 }}>
          {th
            ? '⚠ โหมดเครื่องอื่น · เลือกชื่อตัวเองเท่านั้น · ไม่กดมั่ว'
            : '⚠ Borrowed-device mode · pick your own name only'}
        </div>
        <SecondaryButton onClick={onBack} label={th ? '← กลับ' : '← Back'}/>
      </div>
    </div>
  );
}

function ErrorRow({ th, code }) {
  const map = {
    cooldown:        th ? 'เพิ่งสแกนไปเมื่อสักครู่' : 'Just scanned a moment ago',
    unknown_runner:  th ? 'ไม่พบนักวิ่ง' : 'Runner not found',
    phone_required:  th ? 'กรอกเบอร์ก่อน' : 'Phone required',
    name_required:   th ? 'กรอกชื่อก่อน' : 'Name required',
    invalid_distance:th ? 'เลือกระยะที่ลงวิ่ง' : 'Pick a distance',
    invalid_cp:      th ? 'CP ไม่ถูกต้อง' : 'Invalid CP',
    not_configured:  th ? 'ยังไม่ได้ตั้งค่า backend' : 'Backend not configured',
  };
  return (
    <div style={{ padding: '10px 12px', background: '#fef2f2',
      border: '1px solid #fca5a5', borderRadius: 6,
      fontFamily: RA.mono, fontSize: 11, color: '#7f1d1d' }}>
      ⚠ {map[code] || code}
    </div>
  );
}

Object.assign(window, { LiveRunnerApp });
