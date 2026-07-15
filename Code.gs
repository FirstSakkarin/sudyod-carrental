/**
 * Sudyod CarRental DB — Google Apps Script API
 *
 * Setup:
 * 1. Open Google Sheet "Sudyod CarRental DB"
 * 2. Extensions > Apps Script
 * 3. Paste this entire file, replacing existing code > Save
 * 4. Deploy > New deployment
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL into the app settings (gear icon)
 */

// Sheet tab names (English — avoids encoding issues)
const SHEET_NAMES = {
  cars:        'Cars',
  bookings:    'Bookings',
  maintenance: 'Maintenance',
  expenses:    'Expenses'
};

// Column headers — must match app.js data structure exactly
const HEADERS = {
  cars:        ['id','plate','brand','model','type','year','color','mileage','nextService','dailyRate','status','note','blockedUntil','blockedReason'],
  bookings:    ['id','carId','customer','phone','start','end','mileageOut','rate','total','status','note','returnDate','returnMileage','extra','finalTotal','returnNote'],
  maintenance: ['id','carId','date','type','mileage','cost','nextService','detail'],
  expenses:    ['id','carId','date','expenseType','amount','detail']
};

/* ─────────────────────────────────────────
   Entry Points
───────────────────────────────────────── */
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
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
   GET — Load all data
───────────────────────────────────────── */
function handleGet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
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
   POST — Save all data (full sync)
───────────────────────────────────────── */
function handlePost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
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

function ensureSheets(ss) {
  var keys = Object.keys(SHEET_NAMES);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var name = SHEET_NAMES[key];
    if (!ss.getSheetByName(name)) {
      var sheet = ss.insertSheet(name);
      var r = sheet.getRange(1, 1, 1, HEADERS[key].length);
      r.setValues([HEADERS[key]]);
      styleHeader(r);
      sheet.setFrozenRows(1);
    }
  }
}

function sheetToArray(ss, name, expectedHeaders) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  var all = sheet.getDataRange().getValues();
  if (all.length < 2) return [];
  var headers = all[0].map(function(h) { return String(h); });
  return all.slice(1)
    .filter(function(row) {
      return row.some(function(cell) { return cell !== '' && cell !== null; });
    })
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) {
        var val = row[i];
        if (val === '' || val === null || val === undefined) val = null;
        if (val instanceof Date) val = Utilities.formatDate(val, 'Asia/Bangkok', 'yyyy-MM-dd');
        obj[h] = val;
      });
      return obj;
    });
}

function arrayToSheet(ss, name, data, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clearContents();

  if (!data || data.length === 0) {
    var r = sheet.getRange(1, 1, 1, headers.length);
    r.setValues([headers]);
    styleHeader(r);
    sheet.setFrozenRows(1);
    return;
  }

  var rows = [headers].concat(data.map(function(obj) {
    return headers.map(function(h) {
      var v = obj[h];
      return (v === null || v === undefined) ? '' : v;
    });
  }));

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  styleHeader(sheet.getRange(1, 1, 1, headers.length));
  sheet.setFrozenRows(1);
  headers.forEach(function(_, i) {
    try { sheet.autoResizeColumn(i + 1); } catch(e) {}
  });
}

function styleHeader(range) {
  range
    .setBackground('#1a1a2e')
    .setFontColor('#facc15')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
}

/* ─────────────────────────────────────────
   Test functions
───────────────────────────────────────── */
function testRead() {
  Logger.log(JSON.stringify(handleGet(), null, 2));
}

function testPing() {
  Logger.log('ping ok');
}
