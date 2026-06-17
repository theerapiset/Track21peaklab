/* Compensate Tracker — App shell, navigation, state, tweaks */

const THEME_META = {
  warm: "อบอุ่น",
  fresh: "สดใส",
  calm: "สงบ",
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "warm",
  "radius": 16,
  "density": "regular"
}/*EDITMODE-END*/;

const CURRENT_KEY = "compensate_current_user";

/* ---------- Login: search name + employee code ---------- */
function roleLabel(role) {
  return role === "boss" ? "Division Manager" : role === "lead" ? "หัวหน้าแผนก" : "พนักงาน";
}
function NamePicker({ employees, authenticate }) {
  const [query, setQuery] = useState("");
  const [selId, setSelId] = useState(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [forgot, setForgot] = useState(false);
  const sel = employees.find((e) => e.id === selId);

  if (sel) {
    return (
      <div className="picker">
        <div className="picker-inner narrow">
          <div className="brand-mark"><Icon name="hourglass" size={26} /></div>
          <h1 className="picker-title">ยืนยันตัวตน</h1>
          <p className="picker-sub">กรอกรหัสพนักงานของคุณเพื่อเข้าใช้งาน</p>
          <div className="code-card">
            <Avatar emp={sel} size={60} />
            <div className="cc-name">{sel.name}</div>
            <div className="cc-meta">{sel.nick} · {sel.dept} · {roleLabel(sel.role)}</div>
            <form
              className="code-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!code.trim()) return;
                if (!authenticate(sel.id, code)) { setErr("รหัสพนักงานไม่ถูกต้อง ลองอีกครั้ง"); setCode(""); }
              }}
            >
              <Field label="รหัสพนักงาน · Employee code">
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={code}
                  placeholder="กรอกรหัสของคุณ"
                  onChange={(e) => { setCode(e.target.value); setErr(""); }}
                />
              </Field>
              {err && <div className="code-err"><Icon name="x" size={15} /> {err}</div>}
              <Button full type="submit" icon="logout" disabled={!code.trim()}>เข้าใช้งาน</Button>
            </form>
            <button className="forgot-link" onClick={() => setForgot((v) => !v)}>ลืมรหัส?</button>
            {forgot && (
              <div className="forgot-note">
                <Icon name="user" size={14} /> แจ้ง <b>หัวหน้าแผนก</b> หรือ <b>Division Manager (MN)</b> เพื่อรีเซ็ตรหัสใหม่ แล้วเข้าสู่ระบบด้วยรหัสใหม่ที่ได้รับ
              </div>
            )}
            <div className="demo-hint">รหัสสำหรับทดลอง (เดโม): <b>{sel.code}</b></div>
          </div>
          <button className="picker-back" onClick={() => { setSelId(null); setCode(""); setErr(""); }}>
            <Icon name="chevronLeft" size={16} /> เปลี่ยนชื่อ
          </button>
        </div>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const results = employees.filter((e) => !q || (e.name + " " + e.nick + " " + e.dept).toLowerCase().includes(q));

  return (
    <div className="picker">
      <div className="picker-inner">
        <div className="brand-mark"><Icon name="hourglass" size={26} /></div>
        <h1 className="picker-title">บันทึกวันหยุดชดเชย</h1>
        <p className="picker-sub">Compensate Tracker · พิมพ์ชื่อของคุณเพื่อเข้าใช้งาน</p>

        <div className="search-box">
          <Icon name="user" size={18} />
          <input autoFocus value={query} placeholder="พิมพ์ชื่อ ชื่อเล่น หรือแผนก…" onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="picker-list">
          {results.length === 0 ? (
            <div className="no-result">ไม่พบชื่อ “{query}” — ลองพิมพ์ใหม่</div>
          ) : results.map((e) => (
            <button key={e.id} className="picker-row" onClick={() => setSelId(e.id)}>
              <Avatar emp={e} size={42} />
              <div className="pr-txt">
                <span className="pr-name">{e.name}</span>
                <span className="pr-meta">{e.nick} · {e.dept}</span>
              </div>
              {e.role !== "staff" && <Tag tone="primary" icon="users">{roleLabel(e.role)}</Tag>}
              <Icon name="chevronRight" size={18} className="pr-arrow" />
            </button>
          ))}
        </div>
        <p className="picker-foot"><Icon name="user" size={14} /> เลือกชื่อแล้วกรอกรหัสพนักงานเพื่อเข้าใช้งาน</p>
      </div>
    </div>
  );
}

/* ---------- Header ---------- */
function Header({ emp, onSwitch, isLead }) {
  return (
    <header className="topbar">
      <div className="tb-left">
        <div className="brand-mark sm"><Icon name="hourglass" size={18} /></div>
        <div className="tb-title">
          <span className="tb-name">บันทึกวันหยุดชดเชย</span>
          <span className="tb-en">Compensate Tracker</span>
        </div>
      </div>
      <button className="tb-user" onClick={onSwitch}>
        <Avatar emp={emp} size={34} />
        <div className="tb-user-txt">
          <span className="tbu-name">{emp.nick}</span>
          <span className="tbu-role">{emp.role !== "staff" ? roleLabel(emp.role) : emp.dept}</span>
        </div>
        <Icon name="logout" size={16} className="tb-switch-ic" />
      </button>
    </header>
  );
}

/* ---------- Nav ---------- */
function Nav({ tabs, active, onChange }) {
  return (
    <nav className="nav">
      {tabs.map((t) => (
        <button key={t.id} className={"nav-btn " + (active === t.id ? "on" : "")} onClick={() => onChange(t.id)}>
          <Icon name={t.icon} size={18} />
          <span>{t.label}</span>
          {t.badge > 0 && <span className="nav-badge">{t.badge}</span>}
        </button>
      ))}
    </nav>
  );
}

/* ---------- App ---------- */
function App() {
  const D = window.CompData;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [state, setState] = useState(() => D.load());
  const [currentId, setCurrentId] = useState(() => localStorage.getItem(CURRENT_KEY) || null);
  const [tab, setTab] = useState(() => {
    const id = localStorage.getItem(CURRENT_KEY);
    if (!id) return "home";
    const st = D.load();
    const e = st.employees.find((x) => x.id === id);
    return e && e.role !== "staff" ? "team" : "home";
  });
  const [toastNode, push] = useToast();

  const persist = (next) => { setState(next); D.save(next); };

  const actions = {
    addOT(empId, d) {
      const rec = { id: "ot" + Date.now(), empId, ...d, createdAt: new Date().toISOString() };
      persist({ ...state, otRecords: [...state.otRecords, rec] });
    },
    addLeave(empId, d) {
      const rec = {
        id: "l" + Date.now(), empId, date: d.date, hours: d.hours, reason: d.reason,
        status: "pending", requestedAt: D.todayISO(), decidedBy: null, decidedAt: null,
      };
      persist({ ...state, leaveRequests: [...state.leaveRequests, rec] });
    },
    decide(reqId, status, byId, note) {
      persist({
        ...state,
        leaveRequests: state.leaveRequests.map((l) =>
          l.id === reqId ? { ...l, status, note: (note || "").trim(), decidedBy: byId, decidedAt: D.todayISO() } : l),
      });
    },
    addEmployee(data) {
      const hues = [24, 205, 335, 145, 60, 280, 0, 110, 250, 188, 312, 40];
      const e = {
        id: "u" + Date.now(), name: data.name, nick: data.nick, role: data.role,
        dept: data.dept, code: data.code, hue: hues[state.employees.length % hues.length],
      };
      persist({ ...state, employees: [...state.employees, e] });
      return e.id;
    },
    editEmployee(id, data) {
      persist({
        ...state,
        employees: state.employees.map((e) => e.id === id ? { ...e, ...data } : e),
      });
    },
    deleteEmployee(id) {
      persist({
        ...state,
        employees: state.employees.filter((e) => e.id !== id),
        otRecords: state.otRecords.filter((r) => r.empId !== id),
        leaveRequests: state.leaveRequests.filter((l) => l.empId !== id),
      });
    },
    resetDemo() {
      const fresh = D.reset();
      setState(fresh);
      push("รีเซ็ตข้อมูลตัวอย่างแล้ว", "info");
    },
  };

  const pickUser = (id) => {
    setCurrentId(id);
    localStorage.setItem(CURRENT_KEY, id);
    const e = state.employees.find((x) => x.id === id);
    setTab(e && e.role !== "staff" ? "team" : "home");
  };
  const authenticate = (id, code) => {
    const e = state.employees.find((x) => x.id === id);
    if (!e || String(e.code).trim() !== String(code).trim()) return false;
    pickUser(id);
    return true;
  };
  const switchUser = () => { setCurrentId(null); };

  const emp = state.employees.find((e) => e.id === currentId);
  const isLead = emp && emp.role !== "staff";
  const isBoss = emp && emp.role === "boss";
  const pendingCount = emp
    ? state.leaveRequests.filter((l) => {
        if (l.status !== "pending") return false;
        if (isBoss) return true;
        const reqEmp = state.employees.find((x) => x.id === l.empId);
        return reqEmp && reqEmp.dept === emp.dept;
      }).length
    : 0;

  const rootStyle = { "--radius": t.radius + "px" };

  if (!emp) {
    return (
      <div className="app" data-theme={t.theme} data-density={t.density} style={rootStyle}>
        <NamePicker employees={state.employees} authenticate={authenticate} />
        {toastNode}
        <TweaksUI t={t} setTweak={setTweak} reset={actions.resetDemo} />
      </div>
    );
  }

  const tabs = isLead
    ? [
        { id: "team", label: isBoss ? "ภาพรวมทีม" : "ทีม " + emp.dept, icon: "dashboard" },
        { id: "approvals", label: "คำขอลา", icon: "inbox", badge: pendingCount },
        { id: "home", label: "หน้าของฉัน", icon: "user" },
      ]
    : [{ id: "home", label: "หน้าของฉัน", icon: "user" }];

  const activeTab = tabs.some((x) => x.id === tab) ? tab : tabs[0].id;

  return (
    <div className="app" data-theme={t.theme} data-density={t.density} style={rootStyle}>
      <Header emp={emp} onSwitch={switchUser} isLead={isLead} />
      {tabs.length > 1 && <Nav tabs={tabs} active={activeTab} onChange={setTab} />}

      <main className="content">
        <div className="content-inner">
          {activeTab === "home"
            ? <EmployeeView state={state} emp={emp} actions={actions} push={push} />
            : <SupervisorView state={state} emp={emp} actions={actions} push={push} tab={activeTab} />}
        </div>
      </main>

      {toastNode}
      <TweaksUI t={t} setTweak={setTweak} reset={actions.resetDemo} />
    </div>
  );
}

/* ---------- Tweaks panel ---------- */
function TweaksUI({ t, setTweak, reset }) {
  return (
    <TweaksPanel>
      <TweakSection label="ธีมสี · Visual direction" />
      <TweakRadio
        label="โทน"
        value={t.theme}
        options={[{ value: "warm", label: "อบอุ่น" }, { value: "fresh", label: "สดใส" }, { value: "calm", label: "สงบ" }]}
        onChange={(v) => setTweak("theme", v)}
      />
      <TweakSection label="รูปแบบ · Layout" />
      <TweakRadio
        label="ความหนาแน่น"
        value={t.density}
        options={[{ value: "compact", label: "แน่น" }, { value: "regular", label: "ปกติ" }, { value: "comfy", label: "โปร่ง" }]}
        onChange={(v) => setTweak("density", v)}
      />
      <TweakSlider label="ความมนขอบ" value={t.radius} min={6} max={24} step={1} unit="px" onChange={(v) => setTweak("radius", v)} />
      <TweakSection label="ข้อมูล · Data" />
      <TweakButton label="รีเซ็ตข้อมูลตัวอย่าง" onClick={reset} />
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
