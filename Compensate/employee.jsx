/* Compensate Tracker — Employee view */

function BalanceHero({ emp, bal }) {
  const D = window.CompData;
  return (
    <div className="hero">
      <div className="hero-top">
        <div className="hero-label">วันหยุดชดเชยคงเหลือ · Comp balance</div>
        <Tag tone="onhero" icon="user">{emp.dept}</Tag>
      </div>
      <div className="hero-figure">
        <span className="hero-num">{D.fmtNum(bal.remaining)}</span>
        <span className="hero-unit">ชั่วโมง</span>
      </div>
      <div className="hero-sub">≈ {D.hoursToDays(bal.remaining)} <span className="hero-dim">(8 ชม. = 1 วัน)</span></div>

      <div className="hero-stats">
        <div className="hero-stat">
          <div className="hs-label">สะสมทั้งหมด</div>
          <div className="hs-val">{D.fmtNum(bal.earned)} <small>ชม.</small></div>
        </div>
        <div className="hs-div" />
        <div className="hero-stat">
          <div className="hs-label">ใช้ไปแล้ว</div>
          <div className="hs-val">{D.fmtNum(bal.used)} <small>ชม.</small></div>
        </div>
        <div className="hs-div" />
        <div className="hero-stat">
          <div className="hs-label">รออนุมัติ</div>
          <div className="hs-val">{D.fmtNum(bal.pending)} <small>ชม.</small></div>
        </div>
      </div>
    </div>
  );
}

function OTForm({ emp, onSubmit, onCancel }) {
  const D = window.CompData;
  const [date, setDate] = useState(D.todayISO());
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("21:00");
  const [task, setTask] = useState("");
  const [project, setProject] = useState(D.PROJECTS[0]);

  const hours = D.hoursBetween(start, end);
  const valid = task.trim().length > 0 && hours > 0;

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({ date, start, end, hours, task: task.trim(), project });
      }}
    >
      <Field label="วันที่ทำงาน · Date">
        <input type="date" value={date} max={D.todayISO()} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <div className="form-row">
        <Field label="เวลาเริ่ม · Start">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="เวลาเลิก · End">
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>

      <div className={"calc-chip " + (hours > 0 ? "" : "calc-bad")}>
        <Icon name="clock" size={18} />
        {hours > 0 ? (
          <span>รวม <b>{D.fmtNum(hours)} ชั่วโมง</b> · ได้ชดเชย {D.fmtNum(hours)} ชม. (1 ต่อ 1)</span>
        ) : (
          <span>เวลาเลิกต้องมากกว่าเวลาเริ่ม</span>
        )}
      </div>

      <Field label="งานที่ทำ · What you worked on">
        <textarea
          rows={2}
          value={task}
          placeholder="เช่น ปิดงบสิ้นเดือน, แก้บั๊กก่อนส่งมอบ, ติดตั้งหน้างาน…"
          onChange={(e) => setTask(e.target.value)}
        />
      </Field>

      <Field label="โปรเจกต์ / แผนก · Project">
        <select value={project} onChange={(e) => setProject(e.target.value)}>
          {D.PROJECTS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>

      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>ยกเลิก</Button>
        <Button type="submit" icon="check" disabled={!valid}>บันทึก OT</Button>
      </div>
    </form>
  );
}

function LeaveForm({ emp, bal, onSubmit, onCancel }) {
  const D = window.CompData;
  const [date, setDate] = useState("2026-06-22");
  const [mode, setMode] = useState("full"); // full day / half / custom
  const [custom, setCustom] = useState(4);
  const [reason, setReason] = useState("");

  const hours = mode === "full" ? 8 : mode === "half" ? 4 : Number(custom) || 0;
  const overdraft = hours > bal.available;
  const valid = hours > 0 && !overdraft;

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({ date, hours, reason: reason.trim() });
      }}
    >
      <div className="leave-bal">
        <span>ใช้ได้อีก (หลังหักที่รออนุมัติ)</span>
        <b>{D.fmtNum(bal.available)} ชม. · {D.hoursToDays(bal.available)}</b>
      </div>

      <Field label="วันที่ขอลา · Leave date">
        <input type="date" value={date} min={D.todayISO()} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <Field label="จำนวนที่ขอใช้ · Amount">
        <div className="seg">
          {[["full", "เต็มวัน (8 ชม.)"], ["half", "ครึ่งวัน (4 ชม.)"], ["custom", "กำหนดเอง"]].map(([k, lbl]) => (
            <button type="button" key={k} className={"seg-btn " + (mode === k ? "on" : "")} onClick={() => setMode(k)}>{lbl}</button>
          ))}
        </div>
      </Field>

      {mode === "custom" && (
        <Field label="จำนวนชั่วโมง">
          <input type="number" min="1" max="24" step="0.5" value={custom} onChange={(e) => setCustom(e.target.value)} />
        </Field>
      )}

      <div className={"calc-chip " + (overdraft ? "calc-bad" : "")}>
        <Icon name={overdraft ? "x" : "hourglass"} size={18} />
        {overdraft
          ? <span>ยอดคงเหลือไม่พอ (มี {D.fmtNum(bal.available)} ชม.)</span>
          : <span>จะส่งคำขอ <b>{D.fmtNum(hours)} ชม.</b> ให้หัวหน้าอนุมัติ</span>}
      </div>

      <Field label="เหตุผล (ถ้ามี) · Reason">
        <textarea rows={2} value={reason} placeholder="เช่น พาครอบครัวไปต่างจังหวัด" onChange={(e) => setReason(e.target.value)} />
      </Field>

      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>ยกเลิก</Button>
        <Button type="submit" icon="send" disabled={!valid}>ส่งคำขอ</Button>
      </div>
    </form>
  );
}

function OTRow({ rec }) {
  const D = window.CompData;
  return (
    <div className="rec-row">
      <div className="rec-date">
        <span className="rd-day">{new Date(rec.date + "T00:00:00").getDate()}</span>
        <span className="rd-mon">{D.fmtDate(rec.date).split(" ")[1]}</span>
      </div>
      <div className="rec-main">
        <div className="rec-task">{rec.task}</div>
        <div className="rec-meta">
          <Tag tone="soft" icon="briefcase">{rec.project}</Tag>
          <span className="rec-time"><Icon name="clock" size={13} /> {rec.start}–{rec.end} น.</span>
        </div>
      </div>
      <div className="rec-hours">+{D.fmtNum(rec.hours)}<small>ชม.</small></div>
    </div>
  );
}

function LeaveRow({ rec }) {
  const D = window.CompData;
  return (
    <div className="rec-row">
      <div className="rec-date alt">
        <span className="rd-day">{new Date(rec.date + "T00:00:00").getDate()}</span>
        <span className="rd-mon">{D.fmtDate(rec.date).split(" ")[1]}</span>
      </div>
      <div className="rec-main">
        <div className="rec-task">ขอใช้สิทธิ์ลา {D.fmtNum(rec.hours)} ชม.</div>
        <div className="rec-meta">
          {rec.reason ? <span className="rec-reason">{rec.reason}</span> : <span className="rec-reason dim">ไม่ระบุเหตุผล</span>}
        </div>
        {rec.note && rec.status !== "pending" && (
          <div className={"rec-note " + (rec.status === "rejected" ? "rec-note-bad" : "")}>
            <Icon name="user" size={12} /> หัวหน้า: {rec.note}
          </div>
        )}
      </div>
      <div className="rec-status"><StatusBadge status={rec.status} /></div>
    </div>
  );
}

function EmployeeView({ state, emp, actions, push }) {
  const D = window.CompData;
  const [showOT, setShowOT] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const bal = D.balanceFor(state, emp.id);

  const myOT = state.otRecords.filter((r) => r.empId === emp.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const myLeave = state.leaveRequests.filter((l) => l.empId === emp.id)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  return (
    <div className="emp-view">
      <BalanceHero emp={emp} bal={bal} />

      <div className="quick-actions">
        <button className="qa qa-primary" onClick={() => setShowOT(true)}>
          <div className="qa-ic"><Icon name="plus" size={22} /></div>
          <div className="qa-txt">
            <span className="qa-title">บันทึก OT</span>
            <span className="qa-sub">เพิ่มชั่วโมงทำงานล่วงเวลา</span>
          </div>
        </button>
        <button className="qa" onClick={() => setShowLeave(true)} disabled={bal.available <= 0}>
          <div className="qa-ic alt"><Icon name="send" size={20} /></div>
          <div className="qa-txt">
            <span className="qa-title">ขอใช้สิทธิ์ลา</span>
            <span className="qa-sub">{bal.available > 0 ? `ใช้ได้ ${D.fmtNum(bal.available)} ชม.` : "ยังไม่มีชั่วโมงให้ใช้"}</span>
          </div>
        </button>
      </div>

      <section className="sec">
        <div className="sec-head">
          <h3><Icon name="hourglass" size={18} /> ประวัติ OT</h3>
          <span className="sec-count">{myOT.length} รายการ</span>
        </div>
        <Card className="list-card">
          {myOT.length === 0
            ? <Empty icon="hourglass" title="ยังไม่มีบันทึก OT" sub="กดปุ่ม “บันทึก OT” เพื่อเริ่มสะสมชั่วโมง" />
            : myOT.map((r) => <OTRow key={r.id} rec={r} />)}
        </Card>
      </section>

      <section className="sec">
        <div className="sec-head">
          <h3><Icon name="history" size={18} /> คำขอลา</h3>
          <span className="sec-count">{myLeave.length} รายการ</span>
        </div>
        <Card className="list-card">
          {myLeave.length === 0
            ? <Empty icon="send" title="ยังไม่มีคำขอลา" sub="เมื่อมีชั่วโมงสะสม กดขอใช้สิทธิ์ลาได้เลย" />
            : myLeave.map((r) => <LeaveRow key={r.id} rec={r} />)}
        </Card>
      </section>

      <div className="settings-row">
        <button className="settings-btn" onClick={() => setShowCode(true)}>
          <Icon name="logout" size={16} /> เปลี่ยนรหัสเข้าใช้งาน
        </button>
      </div>

      <Modal open={showCode} onClose={() => setShowCode(false)} title="เปลี่ยนรหัสเข้าใช้งาน">
        <ChangeCodeForm
          requireCurrent={true}
          currentCode={emp.code}
          submitLabel="บันทึกรหัสใหม่"
          onCancel={() => setShowCode(false)}
          onSubmit={(newCode) => {
            actions.editEmployee(emp.id, { code: newCode });
            setShowCode(false);
            push("เปลี่ยนรหัสเรียบร้อยแล้ว");
          }}
        />
      </Modal>

      <Modal open={showOT} onClose={() => setShowOT(false)} title="บันทึกการทำงานล่วงเวลา">
        <OTForm emp={emp} onCancel={() => setShowOT(false)} onSubmit={(d) => {
          actions.addOT(emp.id, d);
          setShowOT(false);
          push(`บันทึก OT ${D.fmtNum(d.hours)} ชม. เรียบร้อย`);
        }} />
      </Modal>

      <Modal open={showLeave} onClose={() => setShowLeave(false)} title="ขอใช้สิทธิ์วันหยุดชดเชย">
        <LeaveForm emp={emp} bal={bal} onCancel={() => setShowLeave(false)} onSubmit={(d) => {
          actions.addLeave(emp.id, d);
          setShowLeave(false);
          push("ส่งคำขอให้หัวหน้าแล้ว รออนุมัติ", "info");
        }} />
      </Modal>
    </div>
  );
}

Object.assign(window, { EmployeeView });
