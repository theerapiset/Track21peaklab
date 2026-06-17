/* Compensate Tracker — data layer (plain JS, exposed on window.CompData) */
(function () {
  const STORAGE_KEY = "compensate_tracker_v1";
  const HOURS_PER_DAY = 8;

  const PROJECTS = [
    "Shutdown / Turnaround",
    "Preventive Maintenance",
    "Inspection / ตรวจสอบ",
    "Reliability & Asset Integrity",
    "งานปรับปรุงระบบ",
    "งานเอกสาร / รายงาน",
  ];

  function hoursBetween(start, end) {
    // start / end as "HH:MM"
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60; // crossed midnight
    return Math.round((mins / 60) * 100) / 100;
  }

  function seed() {
    const employees = [
      { id: "mn1", name: "Chanwut Sangchuwong", nick: "Chanwut", role: "boss", dept: "MN", code: "1000", hue: 265 },

      // RA — Reliability & Asset Integrity (head: Wasan)
      { id: "ra0", name: "Wasan Cheeppensuk", nick: "Wasan", role: "lead", dept: "RA", code: "1001", hue: 28 },
      { id: "ra1", name: "Tanachai Jatturongkapolkul", nick: "Tanachai", role: "staff", dept: "RA", code: "2001", hue: 210 },
      { id: "ra2", name: "Thanakorn Wannapong", nick: "Thanakorn", role: "staff", dept: "RA", code: "2002", hue: 150 },
      { id: "ra3", name: "Waranya Tanchum", nick: "Waranya", role: "staff", dept: "RA", code: "2003", hue: 130 },
      { id: "ra4", name: "Borwornwis Srichulahart", nick: "Borwornwis", role: "staff", dept: "RA", code: "2004", hue: 250 },
      { id: "ra5", name: "Thanathus Theerakulsunthorn", nick: "Thanathus", role: "staff", dept: "RA", code: "2005", hue: 200 },
      { id: "ra6", name: "Pittawat Pimsamarn", nick: "Pittawat", role: "staff", dept: "RA", code: "2006", hue: 35 },
      { id: "ra7", name: "Navapon Suppapat", nick: "Navapon", role: "staff", dept: "RA", code: "2007", hue: 95 },
      { id: "ra8", name: "Theera Piset", nick: "Theera", role: "staff", dept: "RA", code: "2008", hue: 280 },
      { id: "ra9", name: "Tanaphat Kittilugsanawong", nick: "Tanaphat", role: "staff", dept: "RA", code: "2009", hue: 18 },
      { id: "ra10", name: "Jiradet Mikjaidee", nick: "Jiradet", role: "staff", dept: "RA", code: "2010", hue: 170 },
      { id: "ra11", name: "Jakrapan Apiwattananan", nick: "Jakrapan", role: "staff", dept: "RA", code: "2011", hue: 235 },

      // MP — Maintenance Planning (head: Teerapatt) · ลูกทีมเพิ่มภายหลัง
      { id: "mp0", name: "Teerapatt Chaisrithong", nick: "Teerapatt", role: "lead", dept: "MP", code: "1002", hue: 240 },

      // MM — Mechanical (head: Jest)
      { id: "mm0", name: "Jest Jaiyawat", nick: "Jest", role: "lead", dept: "MM", code: "1003", hue: 150 },

      // ICE — Instrument, Control System & Electrical (head: Theeraphong)
      { id: "ice0", name: "Theeraphong Thongkaew", nick: "Theeraphong", role: "lead", dept: "ICE", code: "1004", hue: 300 },
    ];

    const raw = [
      // empId, date, start, end, task, project
      ["ra1", "2026-06-03", "18:00", "21:00", "ตรวจสอบระบบควบคุมหลังปรับปรุง", "Inspection / ตรวจสอบ"],
      ["ra1", "2026-06-10", "09:00", "16:00", "งานตรวจสภาพอุปกรณ์หน้างาน (เสาร์)", "Reliability & Asset Integrity"],
      ["ra8", "2026-05-15", "17:30", "21:30", "วิเคราะห์ root cause ความเสียหายอุปกรณ์หลัก", "Reliability & Asset Integrity"],
      ["ra8", "2026-05-22", "08:00", "13:00", "งานตรวจสภาพเครื่องจักรประจำปี (เสาร์)", "Inspection / ตรวจสอบ"],
      ["ra8", "2026-06-05", "17:30", "20:30", "วิเคราะห์ข้อมูล reliability เครื่องจักรหลัก", "Reliability & Asset Integrity"],
      ["ra5", "2026-05-28", "18:00", "22:00", "สอบเทียบเครื่องมือวัดระบบควบคุม", "Preventive Maintenance"],
      ["ra9", "2026-06-07", "08:00", "15:00", "ซ่อมบำรุงปั๊มสำคัญ (เสาร์)", "Shutdown / Turnaround"],
      ["ra2", "2026-06-02", "18:00", "20:30", "งานซ่อมบำรุงเครื่องจักรหมุน", "Preventive Maintenance"],
      ["ra0", "2026-06-08", "18:00", "20:00", "ประชุมวางแผนงานนอกเวลา", "Reliability & Asset Integrity"],

      ["mm0", "2026-06-06", "09:00", "13:00", "ซ่อมบำรุงเครื่องจักร (เสาร์)", "Preventive Maintenance"],
      ["ice0", "2026-06-09", "18:00", "20:30", "แก้ไขระบบไฟฟ้าฉุกเฉินหน้างาน", "งานปรับปรุงระบบ"],
      ["mp0", "2026-06-04", "17:30", "19:30", "จัดทำแผนงานซ่อมบำรุงประจำเดือน", "งานเอกสาร / รายงาน"],
    ];

    const otRecords = raw.map((r, i) => ({
      id: "ot" + (i + 1),
      empId: r[0],
      date: r[1],
      start: r[2],
      end: r[3],
      hours: hoursBetween(r[2], r[3]),
      task: r[4],
      project: r[5],
      createdAt: r[1] + "T20:00:00",
    }));

    const leaveRequests = [
      {
        id: "l1", empId: "ra2", date: "2026-06-20", hours: 8,
        reason: "พาครอบครัวไปต่างจังหวัด", status: "pending",
        requestedAt: "2026-06-12", decidedBy: null, decidedAt: null, note: "",
      },
      {
        id: "l2", empId: "ra1", date: "2026-06-18", hours: 4,
        reason: "ไปทำธุระส่วนตัวช่วงบ่าย", status: "pending",
        requestedAt: "2026-06-13", decidedBy: null, decidedAt: null, note: "",
      },
      {
        id: "l3", empId: "ra8", date: "2026-05-29", hours: 8,
        reason: "ลาพักผ่อนประจำปี", status: "approved", note: "อนุมัติตามที่ขอ ฝากมอบงานให้ทีมก่อนลาด้วย",
        requestedAt: "2026-05-22", decidedBy: "ra0", decidedAt: "2026-05-23",
      },
    ];

    return { version: 9, employees, otRecords, leaveRequests };
  }

  function load() {
    try {
      const rawStr = localStorage.getItem(STORAGE_KEY);
      if (rawStr) {
        const parsed = JSON.parse(rawStr);
        if (parsed && parsed.version === 9 && Array.isArray(parsed.employees)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Compensate: failed to load, reseeding", e);
    }
    const fresh = seed();
    save(fresh);
    return fresh;
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Compensate: failed to save", e);
    }
  }

  function reset() {
    const fresh = seed();
    save(fresh);
    return fresh;
  }

  // Balance for one employee (in hours)
  function balanceFor(state, empId) {
    const earned = state.otRecords
      .filter((r) => r.empId === empId)
      .reduce((s, r) => s + r.hours, 0);
    const used = state.leaveRequests
      .filter((l) => l.empId === empId && l.status === "approved")
      .reduce((s, l) => s + l.hours, 0);
    const pending = state.leaveRequests
      .filter((l) => l.empId === empId && l.status === "pending")
      .reduce((s, l) => s + l.hours, 0);
    return {
      earned: round(earned),
      used: round(used),
      pending: round(pending),
      remaining: round(earned - used),
      available: round(earned - used - pending), // after holding pending
    };
  }

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  // "37 ชม." + "≈ 4 วัน 5 ชม."
  function hoursToDays(hours) {
    const sign = hours < 0 ? "-" : "";
    const abs = Math.abs(hours);
    const days = Math.floor(abs / HOURS_PER_DAY);
    const rem = round(abs - days * HOURS_PER_DAY);
    let txt = "";
    if (days > 0) txt += days + " วัน";
    if (rem > 0) txt += (days > 0 ? " " : "") + fmtNum(rem) + " ชม.";
    if (!txt) txt = "0 ชม.";
    return sign + txt;
  }

  function fmtNum(n) {
    return Number.isInteger(n) ? String(n) : String(round(n));
  }

  const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const TH_MONTHS_FULL = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const TH_DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

  function fmtDate(iso, opts) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    const day = d.getDate();
    const m = d.getMonth();
    const yBE = d.getFullYear() + 543;
    if (opts && opts.full) {
      return `${day} ${TH_MONTHS_FULL[m]} ${yBE}`;
    }
    return `${day} ${TH_MONTHS[m]} ${String(yBE).slice(2)}`;
  }

  function fmtDateWithDow(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return `${TH_DOW[d.getDay()]} ${fmtDate(iso)}`;
  }

  function todayISO() {
    // Project "today" is June 15, 2026
    return "2026-06-15";
  }

  window.CompData = {
    HOURS_PER_DAY,
    PROJECTS,
    load, save, reset, seed,
    balanceFor, hoursToDays, hoursBetween, round, fmtNum,
    fmtDate, fmtDateWithDow, todayISO,
  };
})();
