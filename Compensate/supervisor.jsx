/* Compensate Tracker — Supervisor view (dashboard + approvals + team overview) */

function KpiCard({ icon, label, value, unit, tone }) {
  return (
    <div className={"kpi kpi-" + (tone || "neutral")}>
      <div className="kpi-ic"><Icon name={icon} size={20} /></div>
      <div className="kpi-body">
        <div className="kpi-val">{value} {unit && <small>{unit}</small>}</div>
        <div className="kpi-label">{label}</div>
      </div>
    </div>
  );
}

function ApprovalCard({ req, emp, bal, onApprove, onReject }) {
  const D = window.CompData;
  const enough = bal.remaining >= req.hours;
  return (
    <div className="appr">
      <div className="appr-top">
        <Avatar emp={emp} size={40} />
        <div className="appr-who">
          <div className="appr-name">{emp.name} <span className="nick">({emp.nick})</span></div>
          <div className="appr-when">ส่งเมื่อ {D.fmtDate(req.requestedAt)}</div>
        </div>
        <div className="appr-amt">{D.fmtNum(req.hours)} <small>ชม.</small></div>
      </div>
      <div className="appr-detail">
        <div className="appr-line"><Icon name="calendar" size={15} /> ขอลาวันที่ <b>{D.fmtDateWithDow(req.date)}</b></div>
        {req.reason && <div className="appr-line"><Icon name="edit" size={15} /> {req.reason}</div>}
        <div className={"appr-line " + (enough ? "ok" : "bad")}>
          <Icon name={enough ? "check" : "x"} size={15} />
          {enough
            ? <span>คงเหลือ {D.fmtNum(bal.remaining)} ชม. → หลังอนุมัติเหลือ {D.fmtNum(bal.remaining - req.hours)} ชม.</span>
            : <span>คงเหลือไม่พอ (มี {D.fmtNum(bal.remaining)} ชม.)</span>}
        </div>
      </div>
      <div className="appr-actions">
        <Button variant="ghost-danger" size="sm" icon="x" onClick={() => onReject(req.id)}>ไม่อนุมัติ</Button>
        <Button variant="primary" size="sm" icon="check" disabled={!enough} onClick={() => onApprove(req.id)}>อนุมัติ</Button>
      </div>
    </div>
  );
}

function TeamMemberCard({ emp, bal, maxBal, onClick }) {
  const D = window.CompData;
  return (
    <button className="tm" onClick={onClick}>
      <div className="tm-top">
        <Avatar emp={emp} size={42} />
        <div className="tm-id">
          <div className="tm-name">{emp.nick}</div>
          <div className="tm-dept">{emp.dept}</div>
        </div>
        {bal.pending > 0 && <span className="tm-flag">{D.fmtNum(bal.pending)} ชม. รออนุมัติ</span>}
      </div>
      <div className="tm-figure">
        <span className="tm-num">{D.fmtNum(bal.remaining)}</span>
        <span className="tm-unit">ชม.</span>
        <span className="tm-days">≈ {D.hoursToDays(bal.remaining)}</span>
      </div>
      <Bar value={bal.remaining} max={maxBal || 1} tone="primary" />
    </button>
  );
}

function MemberDetail({ state, emp, onClose, manager, canDelete, onEdit, onDelete, onResetCode }) {
  const D = window.CompData;
  const [mode, setMode] = useState("view"); // view | edit | confirmDelete | resetCode
  const bal = D.balanceFor(state, emp.id);
  const ot = state.otRecords.filter((r) => r.empId === emp.id).sort((a, b) => b.date.localeCompare(a.date));
  const lv = state.leaveRequests.filter((l) => l.empId === emp.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  if (mode === "edit") {
    return (
      <Modal open={true} onClose={onClose} title={"แก้ไขข้อมูล: " + emp.nick}>
        <EmployeeForm
          initial={emp}
          submitLabel="บันทึกการแก้ไข"
          submitIcon="check"
          onCancel={() => setMode("view")}
          onSubmit={(data) => { onEdit(emp.id, data); setMode("view"); }}
        />
      </Modal>
    );
  }

  if (mode === "confirmDelete") {
    return (
      <Modal open={true} onClose={() => setMode("view")} title="ลบพนักงาน">
        <div className="form">
          <div className="decide-emp">
            <Avatar emp={emp} size={38} />
            <div>
              <div style={{ fontWeight: 600 }}>{emp.name}</div>
              <div style={{ color: "var(--text-faint)", fontSize: "12.5px" }}>{emp.dept}</div>
            </div>
          </div>
          <div className="calc-chip calc-bad">
            <Icon name="trash" size={18} />
            <span>จะลบพนักงานคนนี้พร้อม OT {ot.length} รายการ และคำขอลา {lv.length} รายการ — ไม่สามารถย้อนกลับได้</span>
          </div>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setMode("view")}>ยกเลิก</Button>
            <Button variant="ghost-danger" icon="trash" onClick={() => { onDelete(emp.id); }}>ยืนยันลบ</Button>
          </div>
        </div>
      </Modal>
    );
  }

  if (mode === "resetCode") {
    return (
      <Modal open={true} onClose={() => setMode("view")} title={"รีเซ็ตรหัส: " + emp.nick}>
        <div className="reset-intro">
          <Icon name="user" size={15} /> ตั้งรหัสเข้าใช้งานใหม่ให้ {emp.name} — แจ้งรหัสใหม่นี้ให้เจ้าตัวเพื่อเข้าสู่ระบบ
        </div>
        <ChangeCodeForm
          requireCurrent={false}
          submitLabel="ตั้งรหัสใหม่"
          onCancel={() => setMode("view")}
          onSubmit={(newCode) => { onResetCode(emp.id, newCode); setMode("view"); }}
        />
      </Modal>
    );
  }

  const footer = manager ? (
    <React.Fragment>
      {canDelete
        ? <Button variant="ghost-danger" size="sm" icon="trash" onClick={() => setMode("confirmDelete")}>ลบพนักงาน</Button>
        : <span className="md-self-note">นี่คือบัญชีของคุณ</span>}
      <Button variant="ghost" size="sm" icon="logout" onClick={() => setMode("resetCode")}>รีเซ็ตรหัส</Button>
      <Button variant="primary" size="sm" icon="edit" onClick={() => setMode("edit")}>แก้ไขข้อมูล</Button>
    </React.Fragment>
  ) : null;

  return (
    <Modal open={true} onClose={onClose} title={emp.name} wide footer={footer}>
      <div className="md-summary">
        <div><span className="md-k">คงเหลือ</span><span className="md-v">{D.fmtNum(bal.remaining)} ชม.</span></div>
        <div><span className="md-k">สะสม</span><span className="md-v">{D.fmtNum(bal.earned)} ชม.</span></div>
        <div><span className="md-k">ใช้ไป</span><span className="md-v">{D.fmtNum(bal.used)} ชม.</span></div>
        <div><span className="md-k">รออนุมัติ</span><span className="md-v">{D.fmtNum(bal.pending)} ชม.</span></div>
      </div>
      <h4 className="md-h">ประวัติ OT ({ot.length})</h4>
      <div className="md-list">
        {ot.length === 0 ? <Empty icon="hourglass" title="ยังไม่มี OT" /> :
          ot.map((r) => (
            <div className="md-item" key={r.id}>
              <span className="md-date">{D.fmtDate(r.date)}</span>
              <span className="md-task">{r.task}</span>
              <span className="md-h-val">+{D.fmtNum(r.hours)} ชม.</span>
            </div>
          ))}
      </div>
      <h4 className="md-h">คำขอลา ({lv.length})</h4>
      <div className="md-list">
        {lv.length === 0 ? <Empty icon="send" title="ยังไม่มีคำขอลา" /> :
          lv.map((r) => (
            <div className="md-item" key={r.id}>
              <span className="md-date">{D.fmtDate(r.date)}</span>
              <span className="md-task">
                {r.reason || "ขอใช้สิทธิ์ลา"} · {D.fmtNum(r.hours)} ชม.
                {r.note && r.status !== "pending" && (
                  <span className="md-note"><Icon name="user" size={11} /> หัวหน้า: {r.note}</span>
                )}
              </span>
              <span className="md-h-val"><StatusBadge status={r.status} /></span>
            </div>
          ))}
      </div>
    </Modal>
  );
}

function TeamTable({ state, team, onPick }) {
  const D = window.CompData;
  const rows = team.map((e) => ({ emp: e, bal: D.balanceFor(state, e.id) }))
    .sort((a, b) => b.bal.remaining - a.bal.remaining);
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>พนักงาน</th>
            <th>แผนก</th>
            <th className="num">สะสม</th>
            <th className="num">ใช้ไป</th>
            <th className="num">รออนุมัติ</th>
            <th className="num">คงเหลือ</th>
            <th className="num">≈ วัน</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ emp, bal }) => (
            <tr key={emp.id} onClick={() => onPick(emp)}>
              <td>
                <div className="tcell-emp">
                  <Avatar emp={emp} size={30} />
                  <span>{emp.name}{emp.role === "lead" && <span className="lead-tag">หัวหน้า</span>}</span>
                </div>
              </td>
              <td className="dim">{emp.dept}</td>
              <td className="num">{D.fmtNum(bal.earned)}</td>
              <td className="num dim">{D.fmtNum(bal.used)}</td>
              <td className="num">{bal.pending > 0 ? <span className="pend">{D.fmtNum(bal.pending)}</span> : "–"}</td>
              <td className="num strong">{D.fmtNum(bal.remaining)}</td>
              <td className="num dim">{D.hoursToDays(bal.remaining)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DecisionModal({ decision, onClose, onConfirm }) {
  const D = window.CompData;
  const { req, emp, action } = decision;
  const approve = action === "approved";
  const [note, setNote] = useState("");
  const valid = approve || note.trim().length > 0;
  return (
    <Modal open={true} onClose={onClose} title={approve ? "อนุมัติคำขอลา" : "ไม่อนุมัติคำขอลา"}>
      <div className="form">
        <div className="decide-emp">
          <Avatar emp={emp} size={38} />
          <div>
            <div style={{ fontWeight: 600 }}>{emp.name}</div>
            <div style={{ color: "var(--text-faint)", fontSize: "12.5px" }}>
              ขอลา {D.fmtDateWithDow(req.date)} · {D.fmtNum(req.hours)} ชม.
            </div>
          </div>
        </div>
        <Field
          label={approve ? "หมายเหตุจากหัวหน้า (ถ้ามี) · Note" : "เหตุผลที่ไม่อนุมัติ · Reason"}
          hint={approve ? "พนักงานจะเห็นข้อความนี้ในประวัติคำขอ" : "จำเป็นต้องระบุเหตุผลให้พนักงานทราบ"}
        >
          <textarea
            rows={3}
            value={note}
            autoFocus
            placeholder={approve
              ? "เช่น อนุมัติตามที่ขอ ฝากมอบงานก่อนลาด้วย"
              : "เช่น ช่วงนี้มีงานเร่งด่วน ขอเลื่อนวันลาออกไปก่อน"}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
          <Button
            variant={approve ? "primary" : "ghost-danger"}
            icon={approve ? "check" : "x"}
            disabled={!valid}
            onClick={() => onConfirm(note.trim())}
          >
            {approve ? "ยืนยันอนุมัติ" : "ยืนยันไม่อนุมัติ"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Department cover boxes ---------- */
const COVER_DEPTS = ["RA", "MP", "MM", "ICE"];
const DEPT_HUES = { MN: 265, RA: 42, MP: 235, MM: 150, ICE: 300 };
function DeptBox({ dep, members, state, onOpen }) {
  const D = window.CompData;
  const hue = DEPT_HUES[dep] ?? 42;
  const head = members.find((m) => m.role !== "staff");
  const total = members.reduce((s, m) => s + D.balanceFor(state, m.id).remaining, 0);
  return (
    <button className="dept-box" style={{ "--dh": hue }} onClick={() => onOpen(dep)}>
      <div className="dept-head">
        <span className="dept-name">{dep}</span>
        <Icon name="chevronRight" size={20} className="dept-arrow" />
      </div>
      <div className="dept-body">
        {head ? (
          <div className="dept-lead">
            <Avatar emp={head} size={46} />
            <div className="dl-txt">
              <div className="dl-name">{head.nick} <span className="dl-tag">หัวหน้าแผนก</span></div>
              <div className="dl-sub">{head.name}</div>
            </div>
          </div>
        ) : (
          <div className="dept-nolead"><Icon name="user" size={16} /> ยังไม่มีหัวหน้าแผนก</div>
        )}
      </div>
      <div className="dept-foot">
        <span><Icon name="users" size={14} /> {members.length} คน</span>
        <span>คงเหลือรวม {D.fmtNum(total)} ชม.</span>
      </div>
    </button>
  );
}

/* ---------- Department member list (level 2) ---------- */
function DeptDetail({ dep, members, state, onBack, onPick, onAdd, embedded }) {
  const D = window.CompData;
  const hue = DEPT_HUES[dep] ?? 42;
  const head = members.find((m) => m.role !== "staff");
  const staff = members.filter((m) => m.role === "staff");
  const ordered = head ? [head, ...staff] : staff;
  return (
    <div className="dept-detail">
      {!embedded && <button className="back-btn" onClick={onBack}><Icon name="chevronLeft" size={16} /> กลับหน้าแผนก</button>}
      <div className="dd-banner" style={{ "--dh": hue }}>
        <div className="dd-bn-left">
          <span className="dd-label">{embedded ? "ทีมของคุณ · หน่วยงาน" : "หน่วยงาน"}</span>
          <h1 className="dd-title">{dep}</h1>
          <span className="dd-count">{members.length} คน · หัวหน้า {head ? head.nick : "—"}</span>
        </div>
        <Button variant="primary" size="sm" icon="plus" onClick={() => onAdd(dep)}>เพิ่มคนในแผนก</Button>
      </div>

      <div className="dd-list">
        {ordered.length === 0 ? (
          <Card className="list-card"><Empty icon="users" title="ยังไม่มีสมาชิกในแผนกนี้" sub="กดปุ่ม “เพิ่มคนในแผนก” เพื่อเริ่ม" /></Card>
        ) : ordered.map((m) => {
          const bal = D.balanceFor(state, m.id);
          return (
            <button key={m.id} className="dd-row" onClick={() => onPick(m)}>
              <Avatar emp={m} size={42} />
              <div className="ddr-txt">
                <span className="ddr-name">{m.name}{m.role === "lead" && <span className="dl-tag">หัวหน้า</span>}</span>
                <span className="ddr-sub">{m.nick}</span>
              </div>
              <div className="ddr-bal">
                <span className="ddr-num">{D.fmtNum(bal.remaining)}<small> ชม.</small></span>
                <span className="ddr-days">≈ {D.hoursToDays(bal.remaining)}</span>
              </div>
              <Icon name="chevronRight" size={18} className="ddr-arrow" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SupervisorView({ state, emp, actions, push, tab }) {
  const D = window.CompData;
  const [detail, setDetail] = useState(null);
  const [decision, setDecision] = useState(null); // { req, emp, action }
  const [showAdd, setShowAdd] = useState(false);
  const [addDept, setAddDept] = useState(null);
  const [openDept, setOpenDept] = useState(null);

  const team = state.employees; // all (used for boss drill)
  const isBoss = emp.role === "boss";
  const scopeTeam = isBoss ? state.employees : state.employees.filter((e) => e.dept === emp.dept);
  const scopeIds = new Set(scopeTeam.map((e) => e.id));
  const pending = state.leaveRequests
    .filter((l) => l.status === "pending" && scopeIds.has(l.empId))
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));

  const totalRemaining = scopeTeam.reduce((s, e) => s + D.balanceFor(state, e.id).remaining, 0);
  const monthOT = state.otRecords
    .filter((r) => r.date >= "2026-06-01" && scopeIds.has(r.empId))
    .reduce((s, r) => s + r.hours, 0);

  const empById = (id) => state.employees.find((e) => e.id === id);

  const approvalsBlock = (
    <section className="sec">
      <div className="sec-head">
        <h3><Icon name="inbox" size={18} /> คำขอลารออนุมัติ</h3>
        <span className="sec-count">{pending.length} รายการ</span>
      </div>
      {pending.length === 0 ? (
        <Card className="list-card"><Empty icon="check" title="ไม่มีคำขอค้างอยู่" sub="คำขอใหม่จะแสดงที่นี่" /></Card>
      ) : (
        <div className="appr-grid">
          {pending.map((req) => {
            const e = empById(req.empId);
            return (
              <ApprovalCard
                key={req.id}
                req={req}
                emp={e}
                bal={D.balanceFor(state, req.empId)}
                onApprove={() => setDecision({ req, emp: e, action: "approved" })}
                onReject={() => setDecision({ req, emp: e, action: "rejected" })}
              />
            );
          })}
        </div>
      )}
    </section>
  );

  const kpisBlock = (
    <div className="kpis">
      <KpiCard icon="users" label="ชั่วโมงคงเหลือรวมทั้งทีม" value={D.fmtNum(totalRemaining)} unit="ชม." tone="primary" />
      <KpiCard icon="inbox" label="คำขอรออนุมัติ" value={pending.length} unit="รายการ" tone="warn" />
      <KpiCard icon="hourglass" label="OT เดือนนี้ (มิ.ย.)" value={D.fmtNum(monthOT)} unit="ชม." tone="neutral" />
    </div>
  );

  return (
    <div className="sup-view">
      {tab === "approvals" ? (
        <React.Fragment>
          {kpisBlock}
          {approvalsBlock}
        </React.Fragment>
      ) : openDept ? (
        <DeptDetail
          dep={openDept}
          state={state}
          members={state.employees.filter((e) => e.dept === openDept)}
          onBack={() => setOpenDept(null)}
          onPick={setDetail}
          onAdd={(dep) => { setAddDept(dep); setShowAdd(true); }}
        />
      ) : isBoss ? (
        <React.Fragment>
          <div className="cover-head">
            <div>
              <h1 className="cover-title">MN compensate tracker</h1>
              <p className="cover-sub">เลือกหน่วยงานเพื่อดูรายชื่อและวันหยุดชดเชย</p>
            </div>
            <Button variant="ghost" size="sm" icon="plus" onClick={() => { setAddDept(null); setShowAdd(true); }}>เพิ่มพนักงาน</Button>
          </div>

          {(() => {
            const mnMembers = team.filter((e) => e.dept === "MN");
            const boss = mnMembers.find((m) => m.role !== "staff");
            return (
              <button className="mn-banner" onClick={() => setOpenDept("MN")}>
                <div className="mn-crown"><Icon name="crown" size={22} /></div>
                {boss ? (
                  <React.Fragment>
                    <Avatar emp={boss} size={52} />
                    <div className="mn-txt">
                      <div className="mn-label"><Icon name="crown" size={13} /> MN · Division Manager</div>
                      <div className="mn-name">{boss.name} <span className="mn-nick">({boss.nick})</span></div>
                      <div className="mn-sub">ดูแลทุกหน่วยงาน · RA · MP · MM · ICE</div>
                    </div>
                  </React.Fragment>
                ) : (
                  <div className="mn-txt">
                    <div className="mn-label"><Icon name="crown" size={13} /> MN · Division Manager</div>
                    <div className="mn-name">ยังไม่มี Division Manager</div>
                  </div>
                )}
                <Icon name="chevronRight" size={22} className="mn-arrow" />
              </button>
            );
          })()}

          <div className="dept-grid">
            {COVER_DEPTS.map((dep) => (
              <DeptBox key={dep} dep={dep} state={state} members={team.filter((e) => e.dept === dep)} onOpen={setOpenDept} />
            ))}
          </div>
        </React.Fragment>
      ) : (
        <DeptDetail
          dep={emp.dept}
          state={state}
          members={scopeTeam}
          embedded={true}
          onPick={setDetail}
          onAdd={(dep) => { setAddDept(dep); setShowAdd(true); }}
        />
      )}

      {detail && (
        <MemberDetail
          state={state}
          emp={detail}
          onClose={() => setDetail(null)}
          manager={true}
          canDelete={detail.id !== emp.id}
          onEdit={(id, data) => { actions.editEmployee(id, data); push(`แก้ไขข้อมูล ${data.nick} แล้ว`); setDetail(state.employees.find((x) => x.id === id)); }}
          onDelete={(id) => { const n = detail.nick; actions.deleteEmployee(id); setDetail(null); push(`ลบ ${n} ออกจากระบบแล้ว`, "info"); }}
          onResetCode={(id, newCode) => { actions.editEmployee(id, { code: newCode }); push(`รีเซ็ตรหัสของ ${detail.nick} แล้ว`); }}
        />
      )}
      {showAdd && (
        <Modal open={true} onClose={() => setShowAdd(false)} title={addDept ? `เพิ่มคนในแผนก ${addDept}` : "เพิ่มพนักงานใหม่"}>
          <EmployeeForm
            defaultDept={addDept}
            submitLabel="เพิ่มพนักงาน"
            submitIcon="plus"
            onCancel={() => setShowAdd(false)}
            onSubmit={(data) => { actions.addEmployee(data); setShowAdd(false); push(`เพิ่ม ${data.nick} เข้าแผนก ${data.dept} แล้ว`); }}
          />
        </Modal>
      )}
      {decision && (
        <DecisionModal
          decision={decision}
          onClose={() => setDecision(null)}
          onConfirm={(note) => {
            actions.decide(decision.req.id, decision.action, emp.id, note);
            const ok = decision.action === "approved";
            push(ok ? `อนุมัติคำขอของ ${decision.emp.nick} แล้ว` : `ไม่อนุมัติคำขอของ ${decision.emp.nick}`, ok ? "positive" : "info");
            setDecision(null);
          }}
        />
      )}
    </div>
  );
}

Object.assign(window, { SupervisorView });
