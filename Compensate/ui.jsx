/* Compensate Tracker — shared UI components */
const { useState, useEffect, useRef } = React;

/* ---------- Icons (simple line set) ---------- */
const ICON_PATHS = {
  clock: "M12 7v5l3 2 M12 21a9 9 0 100-18 9 9 0 000 18z",
  calendar: "M7 3v3 M17 3v3 M4 8h16 M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  plus: "M12 5v14 M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7",
  x: "M6 6l12 12 M18 6L6 18",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8z M4.5 20a7.5 7.5 0 0115 0",
  users: "M9 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M2.5 20a6.5 6.5 0 0113 0 M16 12.5a3 3 0 10-1.5-5.6 M16.5 13.5a6 6 0 015 6.5",
  chevronRight: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  chevronLeft: "M15 6l-6 6 6 6",
  hourglass: "M6 3h12v3l-4 6 4 6v3H6v-3l4-6-4-6z",
  briefcase: "M4 8h16v11H4z M9 8V6a1 1 0 011-1h4a1 1 0 011 1v2",
  edit: "M4 20h4L18.5 9.5a2 2 0 00-2.8-2.8L5 17v3z M14 7l3 3",
  trash: "M5 7h14 M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2 M7 7l1 13h8l1-13",
  logout: "M14 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2v-2 M10 12h11 M18 9l3 3-3 3",
  dashboard: "M4 13h7V4H4v9z M13 21h7v-9h-7v9z M13 4v5h7V4h-7z M4 17v3h7v-3H4z",
  history: "M3 12a9 9 0 109-9 9 9 0 00-7.5 4 M3 4v3.5H6.5 M12 8v4l3 2",
  sparkle: "M12 4l1.6 4.8L18.5 10l-4.9 1.2L12 16l-1.6-4.8L5.5 10l4.9-1.2z",
  inbox: "M4 13l2.5-7h11L20 13 M4 13v5a1 1 0 001 1h14a1 1 0 001-1v-5 M4 13h4l1.5 2.5h5L16 13h4",
  send: "M5 12l15-7-7 15-2-6z",
  filter: "M4 6h16 M7 12h10 M10 18h4",
  crown: "M5 18h14 M5 18l-1.5-9 5 4 3.5-6 3.5 6 5-4L19 18",
};

function Icon({ name, size = 20, className = "", style = {} }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg
      className={"ic " + className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {d.split(" M").map((seg, i) => (
        <path key={i} d={(i === 0 ? seg : "M" + seg)} />
      ))}
    </svg>
  );
}

/* ---------- Avatar ---------- */
function Avatar({ emp, size = 44 }) {
  if (!emp) return null;
  const hue = emp.hue ?? 30;
  const bg = `oklch(0.92 0.06 ${hue})`;
  const fg = `oklch(0.42 0.12 ${hue})`;
  const initial = (emp.nick || emp.name || "?").trim().charAt(0);
  return (
    <div
      className="avatar"
      style={{
        width: size, height: size, background: bg, color: fg,
        fontSize: size * 0.42,
      }}
    >
      {initial}
    </div>
  );
}

/* ---------- Card ---------- */
function Card({ children, className = "", style = {}, onClick, hover }) {
  return (
    <div
      className={"card " + (hover ? "card-hover " : "") + className}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

/* ---------- Button ---------- */
function Button({ children, variant = "primary", size = "md", icon, iconRight, onClick, disabled, type = "button", full, className = "" }) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${full ? "btn-full" : ""} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 16 : 18} />}
    </button>
  );
}

/* ---------- Tag / Pill ---------- */
function Tag({ children, tone = "neutral", icon }) {
  return (
    <span className={`tag tag-${tone}`}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: { tone: "warn", label: "รออนุมัติ", icon: "hourglass" },
    approved: { tone: "positive", label: "อนุมัติแล้ว", icon: "check" },
    rejected: { tone: "danger", label: "ไม่อนุมัติ", icon: "x" },
  };
  const c = map[status] || map.pending;
  return <Tag tone={c.tone} icon={c.icon}>{c.label}</Tag>;
}

/* ---------- Field ---------- */
function Field({ label, hint, children, className = "" }) {
  return (
    <label className={"field " + className}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/* ---------- Progress bar ---------- */
function Bar({ value, max, tone = "primary" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="bar">
      <div className={`bar-fill bar-${tone}`} style={{ width: pct + "%" }} />
    </div>
  );
}

/* ---------- Empty state ---------- */
function Empty({ icon = "inbox", title, sub }) {
  return (
    <div className="empty">
      <div className="empty-ic"><Icon name={icon} size={26} /></div>
      <div className="empty-title">{title}</div>
      {sub && <div className="empty-sub">{sub}</div>}
    </div>
  );
}

/* ---------- Modal ---------- */
function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={"modal " + (wide ? "modal-wide" : "")} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด"><Icon name="x" size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Toast ---------- */
function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = (msg, tone = "positive") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  };
  const node = (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <Icon name={t.tone === "positive" ? "check" : "sparkle"} size={16} />
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
  return [node, push];
}

/* ---------- Employee form (shared: add + edit) ---------- */
const DEPTS = ["RA", "MM", "MP", "ICE"];
function EmployeeForm({ initial, defaultDept, submitLabel = "บันทึก", submitIcon = "check", onCancel, onSubmit }) {
  const [name, setName] = useState(initial ? initial.name : "");
  const [nick, setNick] = useState(initial ? initial.nick : "");
  const [dept, setDept] = useState(initial ? initial.dept : (defaultDept || DEPTS[0]));
  const [role, setRole] = useState(initial ? initial.role : "staff");
  const [code, setCode] = useState(initial ? (initial.code || "") : "");
  const valid = name.trim().length > 0 && String(code).trim().length > 0;
  const deptOptions = DEPTS.includes(dept) ? DEPTS : [dept, ...DEPTS];
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const n = name.trim();
        onSubmit({ name: n, nick: nick.trim() || n.split(" ")[0], dept, role, code: String(code).trim() });
      }}
    >
      <Field label="ชื่อ–นามสกุล · Full name">
        <input value={name} autoFocus placeholder="เช่น สมหญิง รักงาน" onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="ชื่อเล่น · Nickname" hint="เว้นว่างได้ — ระบบจะใช้ชื่อจริงแทน">
        <input value={nick} placeholder="เช่น หญิง" onChange={(e) => setNick(e.target.value)} />
      </Field>
      <Field label="แผนก · Department">
        <select value={dept} onChange={(e) => setDept(e.target.value)}>
          {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </Field>
      <Field label="ตำแหน่ง · Role">
        <div className="seg">
          {[["staff", "พนักงาน"], ["lead", "หัวหน้าแผนก"], ["boss", "Division Manager"]].map(([k, lbl]) => (
            <button type="button" key={k} className={"seg-btn " + (role === k ? "on" : "")} onClick={() => setRole(k)}>{lbl}</button>
          ))}
        </div>
      </Field>
      <Field label="รหัสพนักงาน · Employee code" hint="ใช้สำหรับเข้าสู่ระบบของพนักงานคนนี้">
        <input value={code} inputMode="numeric" placeholder="เช่น 2006" onChange={(e) => setCode(e.target.value)} />
      </Field>
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>ยกเลิก</Button>
        <Button type="submit" icon={submitIcon} disabled={!valid}>{submitLabel}</Button>
      </div>
    </form>
  );
}

/* ---------- Change / reset code form ---------- */
function ChangeCodeForm({ requireCurrent, currentCode, onCancel, onSubmit, submitLabel = "บันทึกรหัสใหม่" }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (requireCurrent && String(cur).trim() !== String(currentCode).trim()) { setErr("รหัสปัจจุบันไม่ถูกต้อง"); return; }
        if (!next.trim()) { setErr("กรอกรหัสใหม่"); return; }
        if (next.trim() !== confirm.trim()) { setErr("รหัสใหม่ทั้งสองช่องไม่ตรงกัน"); return; }
        onSubmit(next.trim());
      }}
    >
      {requireCurrent && (
        <Field label="รหัสปัจจุบัน · Current code">
          <input type="password" inputMode="numeric" value={cur} autoFocus placeholder="รหัสที่ใช้อยู่" onChange={(e) => { setCur(e.target.value); setErr(""); }} />
        </Field>
      )}
      <Field label="รหัสใหม่ · New code">
        <input inputMode="numeric" value={next} autoFocus={!requireCurrent} placeholder="ตั้งรหัสใหม่" onChange={(e) => { setNext(e.target.value); setErr(""); }} />
      </Field>
      <Field label="ยืนยันรหัสใหม่ · Confirm">
        <input inputMode="numeric" value={confirm} placeholder="กรอกรหัสใหม่อีกครั้ง" onChange={(e) => { setConfirm(e.target.value); setErr(""); }} />
      </Field>
      {err && <div className="code-err"><Icon name="x" size={15} /> {err}</div>}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>ยกเลิก</Button>
        <Button type="submit" icon="check">{submitLabel}</Button>
      </div>
    </form>
  );
}

Object.assign(window, {
  Icon, Avatar, Card, Button, Tag, StatusBadge, Field, Bar, Empty, Modal, useToast,
  EmployeeForm, ChangeCodeForm, DEPTS,
});
