# Sync Fix — Handoff Notes (2026-07-17)

## ปัญหาเดิม
แก้ข้อมูลใน Google Sheet เสร็จ → เปิดเว็บแล้วกด sync → ข้อมูลเวอร์ชั่นเก่าในเครื่องเขียนทับของใหม่ในชีต

## สาเหตุ
Sync เดิมเป็นแบบ "last-writer-wins เขียนทับทั้ง collection" ไม่มีการเทียบเวอร์ชันรายแถว
ทำให้เครื่องที่ถือ snapshot เก่า push ทับชีตได้ บวกกับบั๊กย่อย: push ก่อน pull สำเร็จ,
seed ข้อมูลตัวอย่างทับของจริง, และตีความ "อ่านชีตพลาด = ชีตว่าง" แล้ว push ทับ

## สิ่งที่แก้ไปแล้ว

### app.js (ฝั่งเว็บ)
- ทุก record มีฟิลด์ `updatedAt` (stamp ทุกครั้งที่ create/edit)
- เพิ่ม `mergeById()` — merge ทีละ record เทียบ `updatedAt` เก็บอันใหม่กว่า (ทับ blind-replace เดิม)
- ระบบ tombstone (`state.tombstones`) — การลบไม่ถูกดึงกลับมา; เก็บใน localStorage คีย์ `tombstones`
- `loadedFromSheets` guard — ห้าม push จนกว่า pull สำเร็จอย่างน้อย 1 ครั้ง
- `syncNow()` — pull+merge ก่อนเสมอ, ถ้า pull พลาด "ไม่ push" เด็ดขาด
- `loadFromSheets()` else-branch เดิมที่ push ข้อมูลเก่าตอนอ่านพลาด → เอาออก
- seed ข้อมูลตัวอย่างเฉพาะตอนไม่มี sheetsUrl (offline) เท่านั้น

### Code.gs (ฝั่ง Apps Script)
- เพิ่มคอลัมน์ `updatedAt` ทุกตาราง (cars/bookings/maintenance/expenses)
- เพิ่มแท็บ `Tombstones` + `_IdSnapshot` (สร้างอัตโนมัติรอบแรก)
- `onEdit` stamp `updatedAt` อัตโนมัติเมื่อแก้แถวมือในชีต → ชีตชนะเมื่อแก้ทีหลัง
- `reconcileDeletions_()` — จับการลบแถวมือในชีต (onEdit จับไม่ได้) โดย diff id กับ snapshot
  แล้วสร้าง tombstone ให้ ทำงานตอน handleGet ทุกครั้ง (ไม่ต้องติดตั้ง trigger เพิ่ม)

## ยังไม่ได้ deploy (ต้องทำ)
อัปเดต Code.gs ขึ้น Apps Script: วางทับ → Save → Deploy > Manage deployments >
แก้ deployment เดิม > เลือก "New version" (ห้ามสร้าง New deployment เพราะ URL จะเปลี่ยน) > Deploy

## หมายเหตุ
- Sync แรกหลัง deploy: แถวเก่าที่ยังไม่มี `updatedAt` ทั้งสองฝั่งจะถือว่า "ชีตเป็นหลัก" (tie → ชีตชนะ)
- ทดสอบ merge/deletion แล้วผ่านหมด (unit tests) แต่ยังไม่ได้ทดสอบบน production Sheet จริง

## TODO ที่อาจทำต่อ
- ทดสอบจริงบนชีต production หลัง deploy
- พิจารณา prune tombstones/snapshot เก่าเกิน N วัน กันโตไม่จำกัด
- ยืนยัน onEdit stamp ไม่ชนกับ dropdown validation logic บนแท็บ Cars
