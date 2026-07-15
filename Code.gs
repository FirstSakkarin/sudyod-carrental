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
  expenses:    'Expenses',
  catalog:     'VehicleCatalog'
};

// Column headers — must match app.js data structure exactly
const HEADERS = {
  cars:        ['id','plate','brand','model','type','year','color','mileage','nextService','dailyRate','status','note','blockedUntil','blockedReason'],
  bookings:    ['id','carId','customer','phone','start','startTime','pickupLocation','end','endTime','returnLocation','mileageOut','rate','total','status','note','returnDate','returnMileage','extra','finalTotal','returnNote'],
  maintenance: ['id','carId','date','type','mileage','cost','nextService','detail'],
  expenses:    ['id','carId','date','expenseType','amount','detail'],
  catalog:     ['type','brand','model']
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
        expenses:    sheetToArray(ss, SHEET_NAMES.expenses,    HEADERS.expenses),
        catalog:     sheetToArray(ss, SHEET_NAMES.catalog,     HEADERS.catalog)
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

// Simple trigger: keeps the brand/model dropdowns on the Cars sheet in sync
// with the row's type/brand. Wrapped in try/catch so a trigger error never
// blocks manual sheet editing.
function onEdit(e) {
  try {
    var sheet = e.range.getSheet();
    if (sheet.getName() !== SHEET_NAMES.cars) return;
    var row = e.range.getRow();
    if (row === 1) return;
    var col = e.range.getColumn(); // A=1 id, B=2 plate, C=3 brand, D=4 model, E=5 type
    if (col !== 3 && col !== 5) return;

    var vehicleCatalog = getVehicleCatalog_(sheet.getParent());
    var type    = sheet.getRange(row, 5).getValue();
    var brand   = sheet.getRange(row, 3).getValue();
    var catalog = catalogForType_(vehicleCatalog, type);

    if (col === 5) {
      setListValidation_(sheet.getRange(row, 3), Object.keys(catalog));
    }
    setListValidation_(sheet.getRange(row, 4), catalog[brand] || []);
  } catch (err) {
    // ignore — never block manual edits
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
