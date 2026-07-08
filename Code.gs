/**
 * สุดยอดรถเช่า เชียงใหม่ — Google Apps Script API
 * สำหรับโปรเจค: Sudyod CarRental DB
 *
 * วิธีติดตั้ง:
 * 1. เปิด Google Sheet "Sudyod CarRental DB"
 * 2. Extensions → Apps Script
 * 3. วางโค้ดนี้ทั้งหมดแทนที่โค้ดเดิม → Save
 * 4. Deploy → New deployment
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. คัดลอก Web app URL ไปวางในแอป (ปุ่ม ⚙️)
 */

// ชื่อ Sheet แต่ละแท็บ
const SHEET_NAMES = {
  cars:        'รถ',
  bookings:    'การจอง',
  maintenance: 'ซ่อมบำรุง',
  expenses:    'รายจ่าย'
};

// คอลัมน์แต่ละ Sheet (ต้องตรงกับ app.js)
const HEADERS = {
  cars:        ['id','plate','brand','model','type','year','color','mileage','nextService','dailyRate','status','note'],
  bookings:    ['id','carId','customer','phone','start','end','mileageOut','rate','total','status','note','returnDate','returnMileage','extra','finalTotal','returnNote'],
  maintenance: ['id','carId','date','type','mileage','cost','nextService','detail'],
  expenses:    ['id','carId','date','expenseType','amount','detail']
};

/* ─────────────────────────────────────────
   Entry Points
───────────────────────────────────────── */
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'ping') return respond({ status: 'ok' });
  return respond(handleGet());
}

function doPost(e) {
  return respond(handlePost(e));
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ─────────────────────────────────────────
   GET — โหลดข้อมูลทั้งหมด
───────────────────────────────────────── */
function handleGet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheets(ss);
    return {
      status: 'ok',
      data: {
        cars:        sheetToArray(ss, SHEET_NAMES.cars,        HEADERS.cars),
        bookings:    sheetToArray(ss, SHEET_NAMES.bookings,    HEADERS.bookings),
        maintenance: sheetToArray(ss, SHEET_NAMES.maintenance, HEADERS.maintenance),
        expenses:    sheetToArray(ss, SHEET_NAMES.expenses,    HEADERS.expenses)
      },
      timestamp: new Date().toISOString()
    };
  } catch(err) {
    return { status: 'error', error: err.message };
  }
}

/* ─────────────────────────────────────────
   POST — บันทึกข้อมูลทั้งหมด (full sync)
───────────────────────────────────────── */
function handlePost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheets(ss);

    if (body.cars        !== undefined) arrayToSheet(ss, SHEET_NAMES.cars,        body.cars,        HEADERS.cars);
    if (body.bookings    !== undefined) arrayToSheet(ss, SHEET_NAMES.bookings,    body.bookings,    HEADERS.bookings);
    if (body.maintenance !== undefined) arrayToSheet(ss, SHEET_NAMES.maintenance, body.maintenance, HEADERS.maintenance);
    if (body.expenses    !== undefined) arrayToSheet(ss, SHEET_NAMES.expenses,    body.expenses,    HEADERS.expenses);

    return { status: 'ok', timestamp: new Date().toISOString() };
  } catch(err) {
    return { status: 'error', error: err.message };
  }
}

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */

/** สร้าง Sheet ที่ยังไม่มี */
function ensureSheets(ss) {
  Object.entries(SHEET_NAMES).forEach(([key, name]) => {
    if (!ss.getSheetByName(name)) {
      const sheet = ss.insertSheet(name);
      const r = sheet.getRange(1, 1, 1, HEADERS[key].length);
      r.setValues([HEADERS[key]]);
      styleHeader(r);
      sheet.setFrozenRows(1);
    }
  });
}

/** Sheet → Array of objects */
function sheetToArray(ss, name, expectedHeaders) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const all = sheet.getDataRange().getValues();
  if (all.length < 2) return [];
  const headers = all[0].map(String);
  return all.slice(1)
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        let val = row[i];
        if (val === '' || val === null || val === undefined) val = null;
        if (val instanceof Date) val = Utilities.formatDate(val, 'Asia/Bangkok', 'yyyy-MM-dd');
        obj[h] = val;
      });
      return obj;
    });
}

/** Array of objects → Sheet (replace all) */
function arrayToSheet(ss, name, data, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clearContents();

  if (!data || data.length === 0) {
    const r = sheet.getRange(1, 1, 1, headers.length);
    r.setValues([headers]);
    styleHeader(r);
    sheet.setFrozenRows(1);
    return;
  }

  const rows = [
    headers,
    ...data.map(obj => headers.map(h => {
      const v = obj[h];
      return (v === null || v === undefined) ? '' : v;
    }))
  ];

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  styleHeader(sheet.getRange(1, 1, 1, headers.length));
  sheet.setFrozenRows(1);
  headers.forEach((_, i) => { try { sheet.autoResizeColumn(i + 1); } catch(e) {} });
}

/** Style header row */
function styleHeader(range) {
  range
    .setBackground('#4c1d95')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
}

/* ─────────────────────────────────────────
   ทดสอบใน Apps Script Editor
───────────────────────────────────────── */
function testRead() {
  Logger.log(JSON.stringify(handleGet(), null, 2));
}

function testWrite() {
  const e = {
    postData: {
      contents: JSON.stringify({
        cars: [{
          id: 'c1', plate: 'ขข 1234 เชียงใหม่', brand: 'Toyota', model: 'Vios',
          type: 'sedan', year: 2021, color: 'ขาว', mileage: 48000,
          nextService: 50000, dailyRate: 800, status: 'available', note: ''
        }]
      })
    }
  };
  Logger.log(JSON.stringify(handlePost(e), null, 2));
}
