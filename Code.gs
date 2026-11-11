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
  cars:        ['id','plate','brand','model','type','year','color','mileage','nextService','dailyRate','status','ownerName','note','blockedUntil','blockedReason','orderNo','engineCC','seats','updatedAt','lateRate','photo'],
  bookings:    ['id','carId','customer','phone','customerAddress','start','startTime','pickupLocation','end','endTime','returnLocation','mileageOut','rate','otFee','total','deposit','bookingDeposit','status','note','returnDate','returnTime','returnMileage','kmDriven','extra','finalTotal','returnNote','updatedAt','staffOut','staffIn','water','carseat','fuelTopup','teamNote','deliveredAt','returnExtras','lateFee','discount','pickLog','driverJob','pickupTrip','returnTrip','deliveryFee','collectFee'],
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
  // Pull bookings from the queue Sheet right now / show the last sync report.
  if (action === 'syncQueue') return respond(syncQueueFromSheet_(30000));
  if (action === 'queueSyncStatus') {
    var last = PropertiesService.getScriptProperties().getProperty('QUEUE_SYNC_LAST');
    return respond(last ? JSON.parse(last) : { status: 'never' });
  }
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
    // New bookings from the queue Sheet (at most every few minutes).
    maybeSyncQueue_();
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
  // Wait for a queue-Sheet sync that is writing Bookings, so neither write
  // overwrites the other halfway through.
  var lock = LockService.getScriptLock();
  var locked = false;
  try { locked = lock.tryLock(25000); } catch (err) {}
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
  } finally {
    if (locked) lock.releaseLock();
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

// Hybrid versions the app offers next to their base model (same list as
// HYBRID_MODELS in app.js), so the Sheet never flags them as invalid.
var HYBRID_MODELS_ = {
  'Toyota':     ['Yaris Ativ HEV', 'Yaris Cross HEV', 'Corolla Altis HEV', 'Corolla Cross HEV', 'Camry HEV', 'C-HR HEV', 'Innova Zenix HEV', 'Alphard HEV'],
  'Honda':      ['City e:HEV', 'City Hatchback e:HEV', 'Civic e:HEV', 'Accord e:HEV', 'HR-V e:HEV', 'CR-V e:HEV'],
  'MG':         ['MG3 Hybrid+', 'VS HEV', 'ZS HEV', 'HS PHEV'],
  'Nissan':     ['Note e-POWER', 'Kicks e-POWER', 'Serena e-POWER'],
  'Mitsubishi': ['Xpander HEV', 'Xpander Cross HEV', 'Xforce HEV'],
  'Suzuki':     ['Swift Hybrid'],
  'Haval':      ['H6 HEV', 'Jolion HEV'],
  'BYD':        ['Sealion 6 DM-i']
};

// Writes any hybrid model or any brand/model a car already uses that is
// missing from the VehicleCatalog sheet, so the catalog the app and the Sheet
// read always lists them. Only appends; never removes or reorders rows.
function fillVehicleCatalog_(ss, carsRows) {
  var sheet = ss.getSheetByName(SHEET_NAMES.catalog);
  if (!sheet) return;
  var have = {};
  sheetToArray(ss, SHEET_NAMES.catalog, HEADERS.catalog).forEach(function (r) {
    have[(r.type === 'motorcycle' ? 'motorcycle' : 'car') + '|' + r.brand + '|' + r.model] = true;
  });
  var add = [];
  function want(type, brand, model) {
    brand = String(brand || '').trim(); model = String(model || '').trim();
    if (!brand || !model) return;
    var k = type + '|' + brand + '|' + model;
    if (!have[k]) { have[k] = true; add.push([type, brand, model]); }
  }
  Object.keys(HYBRID_MODELS_).forEach(function (b) { HYBRID_MODELS_[b].forEach(function (m) { want('car', b, m); }); });
  (carsRows || []).forEach(function (c) { want(c.type === 'motorcycle' ? 'motorcycle' : 'car', c.brand, c.model); });
  if (add.length) sheet.getRange(sheet.getLastRow() + 1, 1, add.length, 3).setValues(add);
}

// Brand → model list for dropdowns: the VehicleCatalog sheet + hybrids +
// every brand/model the cars already use. A model typed in the app (or one
// missing from the catalog) is therefore always "on the list" and never shows
// the red "Invalid" mark. Validation only warns anyway — values are never removed.
function modelListsFor_(vehicleCatalog, type, carsRows) {
  var base = catalogForType_(vehicleCatalog, type), out = {};
  Object.keys(base).forEach(function (b) { out[b] = base[b].slice(); });
  if (type !== 'motorcycle') {
    Object.keys(HYBRID_MODELS_).forEach(function (b) {
      if (!out[b]) out[b] = [];
      HYBRID_MODELS_[b].forEach(function (m) { if (out[b].indexOf(m) === -1) out[b].push(m); });
    });
  }
  (carsRows || []).forEach(function (c) {
    var b = String(c.brand || '').trim(), m = String(c.model || '').trim();
    if (!b || (c.type === 'motorcycle') !== (type === 'motorcycle')) return;
    if (!out[b]) out[b] = [];
    if (m && out[b].indexOf(m) === -1) out[b].push(m);
  });
  return out;
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
var CAR_TYPE_KEYS = ['sedan', 'hatchback', 'suv', 'mpv', 'ppv', 'van', 'pickup', 'ev', 'ehev', 'motorcycle'];
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

  fillVehicleCatalog_(sheet.getParent(), data);
  var vehicleCatalog = getVehicleCatalog_(sheet.getParent());
  var lists = { car: modelListsFor_(vehicleCatalog, 'car', data), motorcycle: modelListsFor_(vehicleCatalog, 'motorcycle', data) };
  data.forEach(function(c, i) {
    var row = i + 2;
    var catalog = c.type === 'motorcycle' ? lists.motorcycle : lists.car;
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
        var catalog = modelListsFor_(vehicleCatalog, type, sheetToArray(sheet.getParent(), SHEET_NAMES.cars, HEADERS.cars));
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
   Auto-import from the shop's queue Sheet ("ตารางคิวรถ2569")

   Top & Mink keep the real queue in a paper-style Google Sheet: one tab per
   month, one row per car, two columns per day (เช้า/บ่าย), and each booking is
   a merged cell like "13/11:8.30-16/11:16.40 น. 4Line Pailin". Nobody types
   those bookings into the web app, so this section reads that Sheet and adds
   the bookings to the Bookings tab by itself:
   - runs at most every QUEUE_SYNC_EVERY_MIN minutes when the app loads data
     (or right away with ?action=syncQueue)
   - only bookings that end today or later, only cars that exist in Cars
   - a booking already typed into the app (same car, start within 1 day)
     is never added twice
   - rows it added are kept in step with the queue Sheet (moved times,
     deleted cells) until someone edits that row in the app; after that the
     app's copy wins and the sync leaves it alone
   - a booking deleted in the app stays deleted (tombstone)
───────────────────────────────────────── */
var QUEUE_SHEET_ID_DEFAULT = '1fWxpWzoWOJcfFNvdX5uJY13Dxo5-aY3PdxuJAa-j3Pw';
var QUEUE_BASE_YEAR = 2026;   // tabs without a year suffix ('พย') are 2569 = 2026; 'มค70' = 2570 = 2027
var QUEUE_MONTHS_AHEAD = 3;   // read this month + 3 more tabs
var QUEUE_SYNC_EVERY_MIN = 5;
var QUEUE_SYNC_SHEET = '_QueueSync'; // hidden: id + updatedAt of rows this sync wrote
var QUEUE_TAB_NAMES = ['มค','กพ','มีค','เมย','พค','มิย','กค','สค','กย','ตค','พย','ธค'];
var QUEUE_NOTE_TAG = '(นำเข้าจากตารางคิว)';

var QUEUE_RANGE_RE = /(\d{1,2})\s*\/\s*(\d{1,2})\s*:\s*([0-9.:]*)[^0-9\/\-–]*?[-–\/]\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*:\s*([0-9.:]*)/;
var QUEUE_SAMEDAY_RE = /(\d{1,2})\s*\/\s*(\d{1,2})\s*:\s*(\d{1,2}[.:]\d{2})\s*-\s*(\d{1,2}[.:]\d{2})(?![\d\/])/; // 6/2:8.00-20.00
var QUEUE_SINGLE_RE = /(\d{1,2})\s*\/\s*(\d{1,2})\s*:\s*\d{1,2}[.:]\d{2}/;
var QUEUE_NOT_RENTAL_RE = /ซ่อม|ปรับตั้ง|เช็คระยะ|เช็กระยะ|ล้างรถ|ตรวจสอบ|ถ่ายน้ำมัน|นำรถกลับ/;
var QUEUE_CHANNELS = [
  [/^(FB|facebook)(?![a-z])/i, 'Facebook'],
  [/^OA(?![a-z])/i,            'LINE OA'],
  [/^line(?![a-z])/i,          'Line'],
  [/^WA(?![a-z])/i,            'WhatsApp'],
  [/^easy\s*rent(?![a-z])/i,   'Easyrent'],
  [/^(DH|drivehub)(?![a-z])/i, 'DriveHub'],
  [/^fastwork(?![a-z])/i,      'Fastwork'],
  [/^haup\w*/i,                'HaupCar']
];

// "City ขาว-จง4064ชม" -> "จง4064", "จง4064 เชียงใหม่" -> "จง4064", "ฉค 1721" -> "ฉค1721"
function queuePlateKey_(s) {
  var m = String(s || '').match(/(?<![ก-๙])(\d?[ก-ฮ]{1,3})[\s-]?(\d{1,4})(?!\d)/);
  return m ? m[1] + m[2] : '';
}

function queueCarsByPlate_(cars) {
  var out = {};
  (cars || []).slice().sort(function (a, b) {
    return (Number(a.orderNo) || 999) - (Number(b.orderNo) || 999);
  }).forEach(function (c) {
    var k = queuePlateKey_(c.plate);
    if (k && !out[k]) out[k] = c; // duplicate plates: lowest ลำดับ wins
  });
  return out;
}

function queueYmd_(t) { // UTC ms -> 'yyyy-MM-dd'
  var d = new Date(t);
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}
function queueDayMs_(ymd) { var p = String(ymd).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
var QUEUE_DAY = 86400000;

// "8.00" -> "08:00"; "" or "…" -> null
function queueTime_(s) {
  var m = String(s || '').match(/^(\d{1,2})[.:](\d{2})/);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return ('0' + m[1]).slice(-2) + ':' + m[2];
}

// d/m nearest to the reference day (handles bookings that cross a new year)
function queueNearestDay_(d, m, refMs) {
  var y = new Date(refMs).getUTCFullYear(), best = null;
  [y - 1, y, y + 1].forEach(function (yy) {
    var t = Date.UTC(yy, m - 1, d);
    if (best === null || Math.abs(t - refMs) < Math.abs(best - refMs)) best = t;
  });
  return best;
}

// Row 3 holds the day numbers: one number per day, the next column (empty) is
// the afternoon half. Days roll into the next month when the number drops.
function queueColumnDates_(values, year, month) {
  var row = values[2] || [], out = [], y = year, m = month, prev = 0, last = null;
  for (var c = 2; c < row.length; c++) {
    var v = String(row[c] === null || row[c] === undefined ? '' : row[c]).trim();
    if (/^\d{1,2}$/.test(v)) {
      var d = +v;
      if (d < prev) { m++; if (m > 12) { m = 1; y++; } }
      prev = d;
      last = { ms: Date.UTC(y, m - 1, d), half: 'am' };
      out[c] = last;
    } else if (last && last.half === 'am') {
      last = { ms: last.ms, half: 'pm' };
      out[c] = last;
    } else {
      last = null;
    }
  }
  return out;
}

// One month tab -> { bookings: [...], skipped: [...] }
// values: 2D display values; merges: [[row1,col1,row2,col2], ...] 1-based.
function parseQueueGrid_(tab, values, merges, year, month, carsByPlate, todayYmd) {
  var cols = queueColumnDates_(values, year, month);
  var lastCol = 0, firstCol = -1;
  cols.forEach(function (v, c) { if (v) { lastCol = c; if (firstCol < 0) firstCol = c; } });
  var spanEnd = {};
  (merges || []).forEach(function (mg) { spanEnd[(mg[0] - 1) + ',' + (mg[1] - 1)] = mg[3] - 1; });
  var todayMs = queueDayMs_(todayYmd);
  var res = { bookings: [], skipped: [] };

  for (var r = 3; r < values.length; r++) {
    var row = values[r];
    var label = String(row[1] || '').trim();
    if (!/^\d+$/.test(String(row[0] || '').trim()) || !label) continue; // only numbered car rows
    var car = carsByPlate[queuePlateKey_(label)];
    for (var c = 2; c < row.length; c++) {
      var text = String(row[c] === null || row[c] === undefined ? '' : row[c]).replace(/\s+/g, ' ').trim();
      if (!text || !cols[c]) continue;
      var c2 = spanEnd[r + ',' + c] !== undefined ? spanEnd[r + ',' + c] : c;
      while (c2 > c && !cols[c2]) c2--;
      var where = tab + ' แถว ' + (r + 1) + ' ' + label;
      var skip = function (why) { res.skipped.push({ where: where, text: text, why: why }); };

      var m = text.match(QUEUE_RANGE_RE);
      if (!m) { // same-day rental "6/2:8.00-20.00" -> same shape as a range
        var sd = text.match(QUEUE_SAMEDAY_RE);
        if (sd) { m = [sd[0], sd[1], sd[2], sd[3], sd[1], sd[2], sd[4]]; m.index = sd.index; }
      }
      if (QUEUE_NOT_RENTAL_RE.test(text)) { if (m) skip('งานรถ ไม่ใช่การเช่า'); continue; }
      if (!m) { if (QUEUE_SINGLE_RE.test(text)) skip('มีเวลาเดียว (งานรับ-ส่ง/คนขับ)'); continue; }

      var S0 = cols[c].ms, E0 = cols[c2].ms, fixes = [];
      var s = queueNearestDay_(+m[1], +m[2], S0);
      var e = queueNearestDay_(+m[4], +m[5], E0);
      var startsAtEdge = c === firstCol, endsAtEdge = c2 === lastCol;
      if (startsAtEdge ? s > S0 + 2 * QUEUE_DAY : Math.abs(s - S0) > 2 * QUEUE_DAY) { s = S0; fixes.push('วันรับรถ'); }
      if (endsAtEdge ? e < E0 - 2 * QUEUE_DAY : Math.abs(e - E0) > 2 * QUEUE_DAY) { e = E0; fixes.push('วันคืนรถ'); }
      if (e < s) { skip('วันคืนก่อนวันรับ'); continue; }
      if (e < todayMs) continue; // finished already

      var st = queueTime_(m[3]), et = queueTime_(m[6]);
      if (!st) { st = cols[c].half === 'am' ? '09:00' : '13:00'; fixes.push('เวลารับรถ'); }
      if (!et) { et = cols[c2].half === 'am' ? '09:00' : '17:00'; fixes.push('เวลาคืนรถ'); }

      if (!car) { skip('ไม่มีรถคันนี้ในระบบ'); continue; }

      var rest = text.slice(m.index + m[0].length).replace(/^[\s.…]*(น\.)?[\s.…]*/, '').replace(/^\d+\s*/, '');
      var channel = '';
      for (var i = 0; i < QUEUE_CHANNELS.length; i++) {
        if (QUEUE_CHANNELS[i][0].test(rest)) { channel = QUEUE_CHANNELS[i][1]; rest = rest.replace(QUEUE_CHANNELS[i][0], ''); break; }
      }
      if (!channel && /^(รับ)?คิวจาก/.test(rest)) channel = 'ฝากคิว';
      var customer = rest.replace(/^[\s.·,:-]+/, '').trim().slice(0, 60) || 'ไม่ระบุชื่อ';

      res.bookings.push({
        carId: car.id,
        customer: customer,
        start: queueYmd_(s), startTime: st,
        end: queueYmd_(e), endTime: et,
        channel: channel,
        text: text,
        fixes: fixes,
        where: where
      });
    }
  }
  return res;
}

function queueStatus_(b, nowYmdHm) {
  var s = b.start + ' ' + b.startTime, e = b.end + ' ' + b.endTime;
  if (nowYmdHm < s) return 'upcoming';
  if (nowYmdHm < e) return 'active';
  return 'completed';
}

function queueSameBooking_(a, b) {
  if (String(a.carId) !== String(b.carId)) return false;
  var as = queueDayMs_(a.start), bs = queueDayMs_(b.start);
  var ae = queueDayMs_(a.end || a.start), be = queueDayMs_(b.end || b.start);
  return Math.abs(as - bs) <= QUEUE_DAY && as <= be && bs <= ae;
}

// Pure merge step (no Sheet access) so it can be tested on its own.
// parsed: from parseQueueGrid_ (all tabs). owned: {id: updatedAt this sync wrote}.
// Returns the new bookings array + what changed.
function planQueueSync_(parsed, bookings, owned, tombIds, todayYmd, coveredUntilYmd, nowIso, nowYmdHm, idFn) {
  var out = bookings.slice(), byId = {}, seen = {}, kept = [], added = [], updated = [], removed = [];
  out.forEach(function (b) { byId[String(b.id)] = b; });
  var isOwnedUntouched = function (b) { return owned[b.id] && String(owned[b.id]) === String(b.updatedAt); };
  var manual = out.filter(function (b) { return !owned[b.id]; });

  parsed.forEach(function (p) {
    var id = 'bq' + idFn(p.carId + '|' + p.start + '|' + p.startTime);
    if (seen[id]) return; // same booking seen in two month tabs
    // ...or written slightly differently in the two tabs: keep the first one
    if (kept.some(function (k) { return queueSameBooking_(k, p); })) return;
    seen[id] = true; kept.push(p);
    if (tombIds[id]) return; // deleted in the app: stays deleted
    var note = (p.channel ? p.channel + ' · ' : '') + p.text + ' ' + QUEUE_NOTE_TAG;
    var existing = byId[id];
    if (existing) {
      if (isOwnedUntouched(existing) &&
          (existing.customer !== p.customer || existing.end !== p.end || existing.endTime !== p.endTime || existing.note !== note)) {
        existing.customer = p.customer; existing.end = p.end; existing.endTime = p.endTime; existing.note = note;
        existing.updatedAt = nowIso; owned[id] = nowIso;
        updated.push(p);
      }
      return;
    }
    if (manual.some(function (b) { return queueSameBooking_(b, p); })) return; // already typed into the app
    var row = {
      id: id, carId: p.carId, customer: p.customer, phone: '', customerAddress: '',
      start: p.start, startTime: p.startTime, pickupLocation: '',
      end: p.end, endTime: p.endTime, returnLocation: '',
      mileageOut: 0, rate: 0, otFee: 0, total: 0, deposit: 0, bookingDeposit: 0,
      status: queueStatus_(p, nowYmdHm), note: note, updatedAt: nowIso
    };
    out.push(row); byId[id] = row; owned[id] = nowIso;
    added.push(p);
  });

  // Rows this sync made that are gone from the queue Sheet (moved or deleted
  // there), or that someone has since typed into the app by hand.
  out = out.filter(function (b) {
    if (!isOwnedUntouched(b) || b.status !== 'upcoming') return true;
    var gone = !seen[b.id] && b.start >= todayYmd && b.start <= coveredUntilYmd;
    var dupe = manual.some(function (mb) { return mb.id !== b.id && queueSameBooking_(mb, b); });
    if (gone || dupe) { removed.push(b); delete owned[b.id]; return false; }
    return true;
  });
  return { bookings: out, added: added, updated: updated, removed: removed, owned: owned };
}

function queueTabName_(year, month) {
  return QUEUE_TAB_NAMES[month - 1] + (year === QUEUE_BASE_YEAR ? '' : String((year + 543) % 100));
}

function readQueueSyncOwned_(ss) {
  var sh = ss.getSheetByName(QUEUE_SYNC_SHEET);
  if (!sh) {
    sh = ss.insertSheet(QUEUE_SYNC_SHEET);
    sh.getRange(1, 1, 1, 2).setValues([['id', 'updatedAt']]);
    sh.hideSheet();
  }
  var out = {}, last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, 2).getDisplayValues().forEach(function (r) { if (r[0]) out[r[0]] = r[1]; });
  return { sheet: sh, owned: out };
}

function writeQueueSyncOwned_(sh, owned, liveIds) {
  var rows = [['id', 'updatedAt']];
  Object.keys(owned).forEach(function (id) { if (liveIds[id]) rows.push([id, owned[id]]); });
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 2).setNumberFormat('@').setValues(rows);
}

// Main entry. Returns a small report (also saved for ?action=queueSyncStatus).
function syncQueueFromSheet_(waitMs) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(waitMs || 0)) return { status: 'busy' };
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheets(ss);
    var props = PropertiesService.getScriptProperties();
    var queueId = props.getProperty('QUEUE_SHEET_ID') || QUEUE_SHEET_ID_DEFAULT;
    var q = SpreadsheetApp.openById(queueId);
    var tz = 'Asia/Bangkok', now = new Date();
    var todayYmd = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
    var nowYmdHm = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm');
    var cars = sheetToArray(ss, SHEET_NAMES.cars, HEADERS.cars);
    var carsByPlate = queueCarsByPlate_(cars);

    var y = +todayYmd.slice(0, 4), mo = +todayYmd.slice(5, 7);
    var parsed = [], skipped = [], tabsRead = [], coveredUntil = '0000-00-00';
    for (var i = 0; i <= QUEUE_MONTHS_AHEAD; i++) {
      var name = queueTabName_(y, mo), sh = q.getSheetByName(name);
      if (!sh) break; // stop at the first missing month so removals stay safe
      var values = sh.getDataRange().getDisplayValues();
      var merges = sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).getMergedRanges().map(function (r) {
        return [r.getRow(), r.getColumn(), r.getLastRow(), r.getLastColumn()];
      });
      var res = parseQueueGrid_(name, values, merges, y, mo, carsByPlate, todayYmd);
      parsed = parsed.concat(res.bookings); skipped = skipped.concat(res.skipped);
      tabsRead.push(name);
      coveredUntil = queueYmd_(Date.UTC(y, mo, 0)); // last day of this month
      mo++; if (mo > 12) { mo = 1; y++; }
    }
    if (!tabsRead.length) return { status: 'error', error: 'ไม่พบแท็บเดือนนี้ในตารางคิว' };

    var bookings = sheetToArray(ss, SHEET_NAMES.bookings, HEADERS.bookings);
    var tomb = currentTombstoneIds_(ss).bookings || {};
    var ownedInfo = readQueueSyncOwned_(ss);
    var nowIso = now.toISOString();
    var md5 = function (s) {
      return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)
        .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('').slice(0, 10);
    };
    var plan = planQueueSync_(parsed, bookings, ownedInfo.owned, tomb, todayYmd, coveredUntil, nowIso, nowYmdHm, md5);

    if (plan.added.length || plan.updated.length || plan.removed.length) {
      arrayToSheet(ss, SHEET_NAMES.bookings, plan.bookings, HEADERS.bookings);
      if (plan.removed.length) appendTombstoneRows_(ss, plan.removed.map(function (b) { return ['bookings', b.id, nowIso]; }));
      writeIdSnapshot_(ss, collectIds_(ss));
    }
    var live = {};
    plan.bookings.forEach(function (b) { live[b.id] = true; });
    writeQueueSyncOwned_(ownedInfo.sheet, plan.owned, live);

    var report = {
      status: 'ok', at: nowIso, tabs: tabsRead,
      added: plan.added.length, updated: plan.updated.length, removed: plan.removed.length,
      addedList: plan.added.map(function (p) { return p.where + ' · ' + p.text; }),
      removedList: plan.removed.map(function (b) { return b.carId + ' ' + b.start + ' ' + b.customer; }),
      skipped: skipped
    };
    try { props.setProperty('QUEUE_SYNC_LAST', JSON.stringify(report).slice(0, 8500)); } catch (e) {}
    return report;
  } catch (err) {
    return { status: 'error', error: err.message };
  } finally {
    lock.releaseLock();
  }
}

// Called from handleGet: sync at most every QUEUE_SYNC_EVERY_MIN minutes.
function maybeSyncQueue_() {
  try {
    var cache = CacheService.getScriptCache();
    if (cache.get('queueSyncAt')) return;
    cache.put('queueSyncAt', '1', QUEUE_SYNC_EVERY_MIN * 60);
    syncQueueFromSheet_(0);
  } catch (e) {}
}

// Timer entry point (see the note below).
function queueSyncTrigger() { syncQueueFromSheet_(30000); }

// Optional: to sync every 10 minutes even when nobody has the app open, add a
// timer by hand (Apps Script editor > Triggers ⏰ > Add trigger > function
// queueSyncTrigger, time-driven, every 10 minutes). Not created from code on
// purpose: ScriptApp would add a new permission and stop the web app until
// someone re-authorizes it.

// Editor helper: run now and print the report.
function testQueueSync() {
  Logger.log(JSON.stringify(syncQueueFromSheet_(30000), null, 2));
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
  var TEXT_COLUMNS = ['phone', 'photo', 'startTime', 'endTime', 'returnTime', 'updatedAt', 'deliveredAt', 'staffOut', 'staffIn', 'teamNote', 'returnExtras'];
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
