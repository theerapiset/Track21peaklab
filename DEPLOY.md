# Deploy · Trail Run Tracker

คู่มือ deploy ระบบติดตามนักวิ่งเต็มรูปแบบ · เวลารวม ~30-40 นาที · ค่าใช้จ่าย **0 บาท**

```
┌─────────────────────────────────────────────────────────────┐
│  📱 นักวิ่ง 150 คน                                            │
│  สแกน QR → trail.run/cp/start ↘                              │
│                                  ↘                            │
│                                   📡 Apps Script Web App      │
│                                       (POST /register,        │
│                                        /checkin, /dnf …)      │
│                                  ↗                            │
│  🖥 Race Director laptop ↗                                    │
│  เปิด Trail Run Tracker.html                                 │
│  (GET /state every 10s)                                       │
│                                       ↕                       │
│                                   📊 Google Sheet (DB)        │
│                                   3 tabs: Runners,            │
│                                   Checkins, DNF               │
└─────────────────────────────────────────────────────────────┘
```

## 1️⃣ Backend · Google Sheets + Apps Script (10 min)

1. สร้าง Google Sheet ใหม่ ตั้งชื่อ `Trail Run Tracker DB`
2. คัดลอก **Sheet ID** จาก URL (ตัวอักษรระหว่าง `/d/` กับ `/edit`)
3. `Extensions → Apps Script` → ลบ stub `Code.gs` → paste จาก [`backend/Code.gs`](./backend/Code.gs)
4. `Project Settings ⚙ → Script Properties → Add property`:

   | Key | Value | Required? |
   |---|---|---|
   | `SHEET_ID` | (paste sheet ID) | ✅ |
   | `STATE_KEY` | e.g. `rayong2026-dash` | optional — locks the dashboard endpoint |

5. เลือก function **`setup`** ใน dropdown → กด ▶ **Run** → approve OAuth (ครั้งแรกครั้งเดียว)
   ดูใน sheet จะมี 3 tabs เกิดขึ้น: `Runners`, `Checkins`, `DNF`
6. `Deploy → New deployment → ⚙ Type: Web app`
   - Description: `trail-run-tracker v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
   - กด **Deploy** → **copy URL** ออกมา (เก็บไว้ใช้ในขั้นต่อไป)

   > เก็บ URL นี้ไว้เป็น `WEBAPP_URL` ในใจ — ใช้ทั้ง runner page, dashboard, และ smoke test

7. **Smoke test ทันที** เปิดเทอร์มินัล:
   ```sh
   ./scripts/smoke-test.sh "<WEBAPP_URL>"
   ```
   ถ้าได้ `OK · all checks passed` แปลว่า backend พร้อมแล้ว

   *(หรือเปิด `WEBAPP_URL?action=ping` ในเบราว์เซอร์ → `{"ok":true,...}`)*

## 2️⃣ Runner page · ตั้ง URL ของ backend (5 min)

แก้ไฟล์ `runner/index.html` บรรทัดนี้:
```html
<script>
  window.TRT_API_URL = ''; // ← paste WEBAPP_URL จากข้อ 1.6
</script>
```

### ตัวเลือก hosting

**Option A · GitHub Pages** (แนะนำ — repo อยู่บน GitHub แล้ว · ฟรี · HTTPS อัตโนมัติ)

1. push branch ปัจจุบันเข้า main → merge PR
2. GitHub repo → `Settings → Pages → Source: Deploy from a branch`
3. Branch: `main` · Folder: `/ (root)` → **Save**
4. รอ 1-2 นาที → URL จะเป็น `https://theerapiset.github.io/track21peaklab/runner/`
5. ทดสอบ: เปิด `<URL>?cp=start` ในมือถือ → ต้องเห็นหน้าฟอร์มลงทะเบียน

**Option B · Cloudflare Pages** (เร็วกว่า · ไม่ต้องรอ · ฟรี)

1. [pages.cloudflare.com](https://pages.cloudflare.com) → Create project → **Direct upload**
2. ลากเฉพาะโฟลเดอร์: `runner/` + `src/` + `assets/` (ไม่ต้องเอา backend/, posters/, *.html)
3. Deploy → URL เป็น `https://xxx.pages.dev/runner/`

> ทั้งคู่ HTTPS อัตโนมัติ · iOS Safari ต้องการ HTTPS ถึงจะใช้กล้องสแกน QR ได้ราบรื่น

## 3️⃣ QR Posters · พิมพ์ A4 (10 min + เวลาเข้าโรงพิมพ์)

1. เปิด `posters/qr-posters.html` ในเบราว์เซอร์ (เปิด local file หรือเปิดผ่าน Pages เดียวกัน)
2. ช่อง *Base URL* → paste runner page URL จากข้อ 2 (ลงท้ายด้วย `/runner/` ก็พอ)
3. กด **Update QR** → เช็คทุกใบ:
   - Start poster · QR encodes `<base>?cp=start`
   - A1 poster · QR encodes `<base>?cp=a1`
   - A2 poster · QR encodes `<base>?cp=a2`
   - Finish poster · QR encodes `<base>?cp=finish`
4. กด **🖨 Print** → เลือก Save as PDF หรือพิมพ์เลย → A4 หน้าละ 1 ใบ
5. **เคลือบพลาสติก / laminate** กันฝน → ติดที่จุด · พิมพ์สำรองอีกใบเผื่อเสีย

> URL fallback (ตัวหนังสือใต้ QR) ต้องอ่านออกได้แม้ไกล 1m — เผื่อนักวิ่งสแกน QR ไม่ติดแล้วพิมพ์เอง

## 4️⃣ Race Director Dashboard (3 min)

แก้ไฟล์ `Trail Run Tracker.html` บรรทัด:
```html
<script>
  window.TRT_API_URL = 'https://script.google.com/macros/s/AKfycb…/exec';
  window.TRT_DASHBOARD_KEY = 'rayong2026-dash'; // ถ้าตั้ง STATE_KEY ใน Apps Script
</script>
```

วันงาน:
1. เปิด `Trail Run Tracker.html` ใน Chrome/Safari บน laptop ของ RD
2. Tweaks panel (มุมขวาบน) → *Race state* → **🛰 Live · backend จริง**
3. ขยายเต็มจอ (F11)
4. ตั้ง laptop ไม่ให้หลับ + เชื่อมต่อปลั๊กไฟ + WiFi/4G

> dashboard polling ทุก 10 วินาที · เปิดทิ้งไว้ได้ทั้งวัน · quota Apps Script ฟรี 20k calls/day = พอเหลือเฟือ

## ✅ Dry run ก่อนวันงาน (สำคัญสุด — 30 min)

ทดสอบ end-to-end อย่างน้อย 1 รอบเต็ม:

| # | Action | Expected |
|---|---|---|
| 1 | เปิด Start QR ในมือถือเครื่อง 1 → กรอก "ทดสอบ" + เบอร์ตัวเอง + 22K → Register | dashboard เห็น runner เพิ่ม 1 · status `active` |
| 2 | เปิด Start QR อีกครั้ง (เครื่องเดิม) | เห็น "สวัสดี ทดสอบ" · ไม่ลงทะเบียนซ้ำ |
| 3 | เปิด A1 QR → กดยืนยัน | dashboard checkin ใหม่ · progress ขยับไปที่ A1 |
| 4 | เปิด A1 QR อีกครั้งภายใน 1 นาที | หน้า cooldown countdown ~59 นาที |
| 5 | เปิด A2 QR → กดยืนยัน *(ลองด้วยเครื่องที่ register เป็น 11K)* | เด้งหน้า "auto-upgrade 11K → 22K" · dashboard แสดง pill `11K ↑ 22K` |
| 6 | กดปุ่มแดงเล็ก "ขอ DNF" → เลือกเหตุผล "หมดแรง" → ติ๊ก "ขอรถรับ" → ยืนยัน | dashboard alert · status เปลี่ยนเป็น DNF |
| 7 | (ใน Google Sheet) ดู tab `Checkins`, `Runners`, `DNF` | มีข้อมูลครบทุก action |

หลังเทสต์เสร็จ ล้างข้อมูลก่อนวันจริง:
- เปิด Sheet → tab Runners, Checkins, DNF → ลบ row test (อย่าลบ header row)
- หรือ `File → Make a copy` แล้วเปลี่ยน `SHEET_ID` ใน Script Properties ไปที่ copy ใหม่

## 🚨 แผน B · ระบบล่มกลางงาน

1. **Apps Script quota เต็ม** (>20k calls/day) — ไม่น่าเกิดสำหรับ 150 คน
2. **Sheet API rate limit** — รอ 1 นาทีแล้วลองใหม่
3. **มือถือนักวิ่งสัญญาณตาย** — สตาฟแสกน BIB จดมือ → key เข้า sheet หลังงาน
4. **Apps Script ผิดพลาดทั้งหมด** — สตาฟทุกจุด **จดชื่อ + เบอร์ + เวลา** ใส่กระดาษ A4 → key หลังงาน

> เก็บ paper logbook ไว้ทุกจุด **เป็น default** ไม่ใช่แค่แผนสำรอง — ใช้ตรวจสอบกับ digital ภายหลัง

## 📋 Pre-race checklist (วันก่อน + เช้าวันงาน)

**วันก่อนงาน:**
- [ ] Dry run ครบ 7 ข้อ ของ "Dry run before race day"
- [ ] Sheet ล้างข้อมูลทดสอบ
- [ ] Apps Script `Executions` tab ว่าง / quota OK
- [ ] Posters พิมพ์ + laminate ครบ 4 ใบ (+สำรอง)
- [ ] Charge laptop ของ RD · เตรียม power bank/UPS

**ก่อน 6 โมง:**
- [ ] Posters ติดที่จุดแล้ว · QR สแกนติดจากระยะ 50cm
- [ ] dashboard เปิดอยู่ · ไม่มีแบนเนอร์เหลือง · polling ทำงาน
- [ ] สตาฟทุกจุดมีกระดาษ + ปากกาสำหรับ paper logbook
- [ ] แจ้งนักวิ่งใน briefing: "**แสกน QR ที่ Start ก่อนวิ่ง · กรอกชื่อ+เบอร์+ระยะ · จุดถัดไปกดยืนยันเฉยๆ**"

## 📂 ไฟล์ที่ใช้

| Path | Used by | Edit before deploy? |
|---|---|---|
| `backend/Code.gs` | Apps Script | ⛔ paste as-is |
| `runner/index.html` | นักวิ่ง (mobile) | ✅ paste `TRT_API_URL` |
| `src/api.jsx`, `src/runner-app.jsx`, `src/runner-live.jsx`, `assets/` | static (โหลดจาก runner/) | ⛔ |
| `posters/qr-posters.html` | RD print | ใส่ Base URL ผ่าน UI ของไฟล์เอง |
| `Trail Run Tracker.html` | RD laptop | ✅ paste `TRT_API_URL` + (optional) `TRT_DASHBOARD_KEY` |

ทุกอย่างอยู่ใน 1 repo · ถ้า static host จาก root ก็ใช้ได้ทั้ง runner page, posters, dashboard ในโดเมนเดียวกัน
