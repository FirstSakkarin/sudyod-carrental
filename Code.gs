// Sudyod CarRental DB -- Google Apps Script API
//
// FIRST-TIME SETUP (do this once only):
// 1. Open Google Sheet "Sudyod CarRental DB"
// 2. Extensions > Apps Script
// 3. Paste this entire file, replacing existing code > Save
// 4. Deploy > New deployment
//    - Type: Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy the Web App URL into the app settings (gear icon)
//
// UPDATING THE CODE LATER -- do this every time after the first setup,
// and never repeat step 4 above (that creates a NEW url and breaks sync
// with the web app until someone notices and re-pastes it):
// 1. Paste the new code here, replacing the old code > Save (Ctrl/Cmd+S)
// 2. Deploy > Manage deployments
// 3. Click the pencil (edit) icon on the existing Active deployment
// 4. Version dropdown > "New version" (NOT "New deployment")
// 5. Click Deploy
// -> The Web App URL stays exactly the same, so the app keeps working
//    without touching the settings again.

// Sheet tab names (English — avoids encoding issues)
const SHEET_NAMES = {
  cars:        'Cars',
  bookings:    'Bookings',
  maintenance: 'Maintenance',
  expenses:    'Expenses',
  extraIncome: 'ExtraIncome',
  catalog:     'VehicleCatalog',
  tombstones:  'Tombstones'
};

// Column headers — must match app.js data structure exactly.
// 'updatedAt' is the per-row sync timestamp: the web app merges record-by-record
// and keeps whichever copy (Sheet or app) has the newer updatedAt, so a manual
// edit here is never overwritten by an older snapshot from a device.
const HEADERS = {
  cars:        ['id','plate','brand','model','type','year','color','mileage','nextService','dailyRate','status','ownerName','note','blockedUntil','blockedReason','updatedAt'],
  bookings:    ['id','carId','customer','phone','customerAddress','start','startTime','pickupLocation','end','endTime','returnLocation','mileageOut','rate','otFee','total','deposit','bookingDeposit','status','note','returnDate','returnTime','returnMileage','kmDriven','extra','finalTotal','returnNote','updatedAt'],
  maintenance: ['id','carId','date','type','mileage','cost','nextService','detail','updatedAt'],
  expenses:    ['id','carId','date','expenseType','amount','detail','updatedAt'],
  extraIncome: ['id','carId','date','incomeType','amount','detail','updatedAt'],
  catalog:     ['type','brand','model'],
  tombstones:  ['collection','id','updatedAt']
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
    // Catch rows deleted by hand in the Sheet (onEdit can't see row deletions)
    // and turn them into tombstones before we hand data back to the app.
    reconcileDeletions_(ss);
    return {
      status: 'ok',
      data: {
        cars:        sheetToArray(ss, SHEET_NAMES.cars,        HEADERS.cars),
        bookings:    sheetToArray(ss, SHEET_NAMES.bookings,    HEADERS.bookings),
        maintenance: sheetToArray(ss, SHEET_NAMES.maintenance, HEADERS.maintenance),
        expenses:    sheetToArray(ss, SHEET_NAMES.expenses,    HEADERS.expenses),
        extraIncome: sheetToArray(ss, SHEET_NAMES.extraIncome, HEADERS.extraIncome),
        catalog:     sheetToArray(ss, SHEET_NAMES.catalog,     HEADERS.catalog),
        tombstones:  tombstonesToObject_(sheetToArray(ss, SHEET_NAMES.tombstones, HEADERS.tombstones))
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
    if (body.extraIncome !== undefined) arrayToSheet(ss, SHEET_NAMES.extraIncome, body.extraIncome, HEADERS.extraIncome);
    if (body.tombstones  !== undefined) arrayToSheet(ss, SHEET_NAMES.tombstones,  tombstonesToRows_(body.tombstones), HEADERS.tombstones);

    // The app just wrote the authoritative full set, so refresh the id snapshot
    // to match. This way the next read only flags rows a HUMAN removes from the
    // Sheet afterwards — not the ids this push legitimately dropped.
    writeIdSnapshot_(ss, collectIds_(ss));

    return { status: 'ok', timestamp: new Date().toISOString() };
  } catch(err) {
    return { status: 'error', error: err.message };
  }
}

/* ─────────────────────────────────────────
   Cascading dropdowns (Cars sheet: type → brand → model)
   Source of truth is the "VehicleCatalog" sheet — add brands/models by
   adding rows there (columns: type, brand, model). app.js reads the same
   sheet via handleGet(), so both stay in sync automatically.
───────────────────────────────────────── */
var DEFAULT_VEHICLE_CATALOG_SEED = {
  car: {
    'Toyota':     ['Yaris', 'Yaris Ativ', 'Vios', 'Corolla Altis', 'Corolla Cross', 'Camry', 'Fortuner', 'Hilux Revo', 'Innova'],
    'Honda':      ['City', 'Civic', 'Accord', 'Jazz', 'HR-V', 'CR-V', 'BR-V'],
    'Isuzu':      ['D-Max', 'MU-X'],
    'Mazda':      ['Mazda2', 'Mazda3', 'CX-3', 'CX-30', 'CX-5', 'BT-50'],
    'Mitsubishi': ['Attrage', 'Mirage', 'Xpander', 'Triton', 'Pajero Sport'],
    'Nissan':     ['Almera', 'Note', 'Kicks', 'Navara', 'Terra'],
    'Ford':       ['Ranger', 'Everest', 'Focus'],
    'MG':         ['MG3', 'MG5', 'ZS', 'HS', 'Extender'],
    'Hyundai':    ['Accent', 'Elantra', 'Tucson', 'Creta']
  },
  motorcycle: {
    'Honda':  ['Wave110i', 'Wave125i', 'Click125i', 'Click160i', 'PCX160', 'ADV160', 'CBR150R', 'Forza'],
    'Yamaha': ['Fino', 'Grand Filano', 'NMAX', 'Aerox', 'XMAX', 'YZF-R15'],
    'GPX':    ['Demon', 'Legend']
  }
};

function seedVehicleCatalogSheet_(sheet) {
  var rows = [];
  Object.keys(DEFAULT_VEHICLE_CATALOG_SEED).forEach(function (type) {
    var brands = DEFAULT_VEHICLE_CATALOG_SEED[type];
    Object.keys(brands).forEach(function (brand) {
      brands[brand].forEach(function (model) {
        rows.push([type, brand, model]);
      });
    });
  });
  if (rows.length) sheet.getRange(2, 1, rows.length, 3).setValues(rows);
}

function getVehicleCatalog_(ss) {
  var rows = sheetToArray(ss, SHEET_NAMES.catalog, HEADERS.catalog);
  var catalog = { car: {}, motorcycle: {} };
  rows.forEach(function (r) {
    if (!r.brand || !r.model) return;
    var type = r.type === 'motorcycle' ? 'motorcycle' : 'car';
    if (!catalog[type][r.brand]) catalog[type][r.brand] = [];
    catalog[type][r.brand].push(r.model);
  });
  return catalog;
}

function catalogForType_(vehicleCatalog, type) {
  return type === 'motorcycle' ? vehicleCatalog.motorcycle : vehicleCatalog.car;
}

function setListValidation_(range, values) {
  if (values && values.length) {
    range.setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(true).build()
    );
  } else {
    range.clearDataValidations();
  }
}

// type/year/color options — must match app.js's TYPE_LABEL keys and
// CAR_COLORS list so the Sheet's dropdowns never flag values the app itself
// writes as "invalid".
var CAR_TYPE_KEYS = ['sedan', 'hatchback', 'suv', 'mpv', 'ppv', 'van', 'pickup', 'ev', 'motorcycle'];
var CAR_COLOR_BASE = ['ขาว', 'ดำ', 'เงิน', 'เทา', 'แดง', 'น้ำเงิน', 'ฟ้า', 'เขียว', 'เหลือง', 'ส้ม', 'น้ำตาล', 'ทอง', 'บรอนซ์', 'ม่วง', 'ชมพู'];

// Reapplies dropdown validation for type/brand/model/year/color on the Cars
// sheet after every full rewrite (arrayToSheet). onEdit only fires for
// manual UI edits, never for this API-driven write, so without this call
// the columns would carry no fresh validation of their own — or worse,
// stale validation left over from before clearContents() (see arrayToSheet).
function applyCarsDropdowns_(sheet, data, headers) {
  var col = {};
  headers.forEach(function(h, i) { col[h] = i + 1; });

  var thisYear = new Date().getFullYear();
  var years = [];
  for (var y = thisYear + 1; y >= 2005; y--) years.push(y);

  var usedColors = [];
  data.forEach(function(c) {
    if (c.color && CAR_COLOR_BASE.indexOf(c.color) === -1 && usedColors.indexOf(c.color) === -1) {
      usedColors.push(c.color);
    }
  });
  var colors = CAR_COLOR_BASE.concat(usedColors);

  setListValidation_(sheet.getRange(2, col.type, data.length, 1), CAR_TYPE_KEYS);
  setListValidation_(sheet.getRange(2, col.year, data.length, 1), years);
  setListValidation_(sheet.getRange(2, col.color, data.length, 1), colors);

  var vehicleCatalog = getVehicleCatalog_(sheet.getParent());
  data.forEach(function(c, i) {
    var row = i + 2;
    var catalog = catalogForType_(vehicleCatalog, c.type);
    setListValidation_(sheet.getRange(row, col.brand, 1, 1), Object.keys(catalog));
    setListValidation_(sheet.getRange(row, col.model, 1, 1), catalog[c.brand] || []);
  });
}

// Simple trigger: keeps the brand/model dropdowns on the Cars sheet in sync
// with the row's type/brand. Wrapped in try/catch so a trigger error never
// blocks manual sheet editing.
function onEdit(e) {
  try {
    var sheet = e.range.getSheet();
    var name  = sheet.getName();
    var dataSheets = [SHEET_NAMES.cars, SHEET_NAMES.bookings, SHEET_NAMES.maintenance, SHEET_NAMES.expenses, SHEET_NAMES.extraIncome];
    if (dataSheets.indexOf(name) === -1) return;
    var row = e.range.getRow();
    if (row === 1) return;

    // Stamp updatedAt on the row that was just edited by hand, so the web app's
    // record-level merge sees this as the newest version and keeps it instead
    // of overwriting it with an older copy from a device. This is the core fix
    // for "edit in the Sheet, then the app pushes an old version over it".
    stampUpdatedAt_(sheet, name, row, e.range.getColumn());

    // Cars-only: keep the brand/model dropdowns in step with type/brand.
    if (name === SHEET_NAMES.cars) {
      var col = e.range.getColumn(); // A=1 id, B=2 plate, C=3 brand, D=4 model, E=5 type
      if (col === 3 || col === 5) {
        var vehicleCatalog = getVehicleCatalog_(sheet.getParent());
        var type    = sheet.getRange(row, 5).getValue();
        var brand   = sheet.getRange(row, 3).getValue();
        var catalog = catalogForType_(vehicleCatalog, type);
        if (col === 5) setListValidation_(sheet.getRange(row, 3), Object.keys(catalog));
        setListValidation_(sheet.getRange(row, 4), catalog[brand] || []);
      }
    }
  } catch (err) {
    // ignore — never block manual edits
  }
}

// Maps a sheet tab name back to its HEADERS key ('Cars' -> 'cars').
function keyForSheetName_(name) {
  var keys = Object.keys(SHEET_NAMES);
  for (var i = 0; i < keys.length; i++) {
    if (SHEET_NAMES[keys[i]] === name) return keys[i];
  }
  return null;
}

// Writes the current time (ISO) into the row's updatedAt cell. Skips the write
// if the edit WAS the updatedAt cell itself, so hand-tweaking that column
// doesn't fight the app. Stored as plain text so Sheets never reinterprets the
// ISO string as a date.
function stampUpdatedAt_(sheet, name, row, editedCol) {
  var key = keyForSheetName_(name);
  if (!key) return;
  var headers = HEADERS[key];
  var idx = headers.indexOf('updatedAt');
  if (idx === -1) return;
  if (editedCol === idx + 1) return;
  var cell = sheet.getRange(row, idx + 1);
  cell.setNumberFormat('@');
  cell.setValue(new Date().toISOString());
}

// Sheet rows [{collection,id,updatedAt}] -> nested object the app expects:
// { cars: {id: ts}, bookings: {...}, maintenance: {...}, expenses: {...} }
function tombstonesToObject_(rows) {
  var out = { cars: {}, bookings: {}, maintenance: {}, expenses: {}, extraIncome: {} };
  (rows || []).forEach(function (r) {
    if (!r.collection || !r.id) return;
    if (!out[r.collection]) out[r.collection] = {};
    out[r.collection][r.id] = r.updatedAt || '';
  });
  return out;
}

// Inverse of tombstonesToObject_: nested object -> flat rows for the sheet.
function tombstonesToRows_(obj) {
  var rows = [];
  Object.keys(obj || {}).forEach(function (coll) {
    var m = obj[coll] || {};
    Object.keys(m).forEach(function (id) {
      rows.push({ collection: coll, id: id, updatedAt: m[id] });
    });
  });
  return rows;
}

/* ─────────────────────────────────────────
   Manual-row-deletion detection

   Apps Script's simple onEdit trigger does NOT fire when a whole row is
   deleted, so a row a human deletes directly in the Sheet would otherwise be
   silently resurrected by the web app on the next merge (the app still has its
   own copy). To catch it, we keep a snapshot of the ids that existed in each
   data sheet (hidden "_IdSnapshot" tab) and, on every read the app makes,
   compare it against what's actually there now. Any id that vanished becomes a
   tombstone — exactly as if the row had been deleted from inside the app.
───────────────────────────────────────── */
var ID_SNAPSHOT_SHEET = '_IdSnapshot';
var TOMBSTONE_COLLECTIONS = ['cars', 'bookings', 'maintenance', 'expenses', 'extraIncome'];

// Current id set of one sheet: { id: true, ... } (id is always column 1).
function idsInSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  var out = {};
  if (!sheet) return out;
  var last = sheet.getLastRow();
  if (last < 2) return out;
  var vals = sheet.getRange(2, 1, last - 1, 1).getValues();
  vals.forEach(function (r) {
    var id = r[0];
    if (id !== '' && id !== null && id !== undefined) out[String(id)] = true;
  });
  return out;
}

// { cars:{id:true}, bookings:{...}, ... } across all data sheets.
function collectIds_(ss) {
  var out = {};
  TOMBSTONE_COLLECTIONS.forEach(function (coll) {
    out[coll] = idsInSheet_(ss, SHEET_NAMES[coll]);
  });
  return out;
}

function getIdSnapshotSheet_(ss) {
  var sh = ss.getSheetByName(ID_SNAPSHOT_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ID_SNAPSHOT_SHEET);
    sh.getRange(1, 1, 1, 2).setValues([['collection', 'id']]);
    sh.hideSheet();
  }
  return sh;
}

function readIdSnapshot_(ss) {
  var sh = getIdSnapshotSheet_(ss);
  var out = {};
  var last = sh.getLastRow();
  if (last < 2) return out;
  var vals = sh.getRange(2, 1, last - 1, 2).getValues();
  vals.forEach(function (r) {
    var coll = r[0], id = r[1];
    if (!coll || id === '' || id === null || id === undefined) return;
    if (!out[coll]) out[coll] = {};
    out[coll][String(id)] = true;
  });
  return out;
}

function writeIdSnapshot_(ss, snapObj) {
  var sh = getIdSnapshotSheet_(ss);
  sh.clearContents();
  var rows = [['collection', 'id']];
  Object.keys(snapObj).forEach(function (coll) {
    Object.keys(snapObj[coll]).forEach(function (id) { rows.push([coll, id]); });
  });
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
}

function snapshotDiffers_(a, b) {
  for (var i = 0; i < TOMBSTONE_COLLECTIONS.length; i++) {
    var c = TOMBSTONE_COLLECTIONS[i];
    var ak = Object.keys((a && a[c]) || {});
    var bk = Object.keys((b && b[c]) || {});
    if (ak.length !== bk.length) return true;
    for (var j = 0; j < bk.length; j++) {
      if (!(a[c] && a[c][bk[j]])) return true;
    }
  }
  return false;
}

// Ids already tombstoned, so we don't append duplicate tombstone rows.
function currentTombstoneIds_(ss) {
  var rows = sheetToArray(ss, SHEET_NAMES.tombstones, HEADERS.tombstones);
  var out = {};
  rows.forEach(function (r) {
    if (!r.collection || !r.id) return;
    if (!out[r.collection]) out[r.collection] = {};
    out[r.collection][String(r.id)] = true;
  });
  return out;
}

function appendTombstoneRows_(ss, rows) {
  var sh = ss.getSheetByName(SHEET_NAMES.tombstones);
  if (!sh) { ensureSheets(ss); sh = ss.getSheetByName(SHEET_NAMES.tombstones); }
  var start = Math.max(sh.getLastRow() + 1, 2);
  sh.getRange(start, 1, rows.length, 3).setValues(rows);
  sh.getRange(start, 3, rows.length, 1).setNumberFormat('@'); // updatedAt as text
}

function reconcileDeletions_(ss) {
  var current  = collectIds_(ss);
  var snap     = readIdSnapshot_(ss);
  var existing = currentTombstoneIds_(ss);
  var now      = new Date().toISOString();
  var toAppend = [];

  TOMBSTONE_COLLECTIONS.forEach(function (coll) {
    var prev = snap[coll] || {};
    var cur  = current[coll] || {};
    var et   = existing[coll] || {};
    Object.keys(prev).forEach(function (id) {
      // Was there last time, gone now, and not already tombstoned -> deleted by hand.
      if (!cur[id] && !et[id]) toAppend.push([coll, id, now]);
    });
  });

  if (toAppend.length) appendTombstoneRows_(ss, toAppend);
  // Only rewrite the snapshot when it actually changed, so steady-state reads
  // (nothing added/removed) stay read-only and cheap.
  if (snapshotDiffers_(snap, current)) writeIdSnapshot_(ss, current);
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
      if (key === 'catalog') seedVehicleCatalogSheet_(sheet);
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
  // clearContents() doesn't reset cell formatting, so a stray format left
  // over from a manual edit (e.g. a "rate" cell accidentally formatted as
  // a Date) would keep reinterpreting freshly-written numbers as dates on
  // every future sync. Reset to General so numbers always read back as numbers.
  var resetRows = Math.max(sheet.getMaxRows(), (data ? data.length : 0) + 1);
  var resetRange = sheet.getRange(1, 1, resetRows, headers.length);
  resetRange.setNumberFormat('General');
  // clearContents() also leaves old dropdown validation rules attached to
  // their cell positions. Since every sync rewrites all rows in a fresh
  // order/count, those stale per-row rules end up attached to completely
  // different cars than before and flag their new values as "Invalid
  // input" even though nothing is actually wrong. Clear them all here;
  // applyCarsDropdowns_ below reapplies fresh ones that match the new data.
  resetRange.clearDataValidations();

  // Time-of-day strings like "14:30" look like a time value to Sheets' input
  // parser and get silently auto-converted to a Date/Time serial on write,
  // no matter what format the cell had beforehand. That serial then loses
  // its time component when read back (sheetToArray formats Dates as
  // yyyy-MM-dd), corrupting the value. Force these columns to Plain Text so
  // the string is stored literally and never auto-parsed.
  var TEXT_COLUMNS = ['startTime', 'endTime', 'returnTime', 'updatedAt'];
  headers.forEach(function(h, i) {
    if (TEXT_COLUMNS.indexOf(h) !== -1) {
      sheet.getRange(1, i + 1, resetRows, 1).setNumberFormat('@');
    }
  });

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

  if (name === SHEET_NAMES.cars) applyCarsDropdowns_(sheet, data, headers);
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
