/* ====================================
   SUDYOD CARRENTAL — App Logic
   ==================================== */

// Built-in fallback so every device syncs automatically without the owner
// having to paste the URL into Settings manually — a device whose
// localStorage never got the URL saved (or had it evicted, e.g. iOS
// Safari's storage eviction) would otherwise silently run fully offline
// with no real data and no obvious way to tell why.
const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyDZtpn0WkPwryHBsAPrSLQ_N4P4bLsKic0yZwy78RC00t96TrGQYcu82MZybLd-Ej6tQ/exec';

// ── State ──────────────────────────────────────────────────────────────
let state = {
  user: null,           // { username, role }
  cars: [],
  bookings: [],
  maintenance: [],
  expenses: [],
  extraIncome: [],      // รายได้เสริม: ล้างรถ, เปลี่ยนของเหลว, ส่งต่อคิวรถ ฯลฯ
  customerTags: {},     // { 'name||phone': 'vip' | 'regular' | 'new' | '' }
  sheetsUrl: '',
  syncing: false,
  catalog: null,        // { car: {brand: [models]}, motorcycle: {...} } — synced from the "VehicleCatalog" sheet
  // Tombstones: { cars: {id: updatedAt}, bookings: {...}, ... } — records the
  // user deleted, so a delete survives a merge instead of being resurrected by
  // the other side's still-present copy. Newest timestamp wins (record vs tomb).
  tombstones: { cars: {}, bookings: {}, maintenance: {}, expenses: {}, extraIncome: {} },
  // Guard: never push to the sheet until at least one successful pull has
  // completed this session, so an old/local snapshot can't clobber the sheet
  // before we've even seen what's in it.
  loadedFromSheets: false,
};

// ── Sync helpers ────────────────────────────────────────────────────────
const SYNC_COLLECTIONS = ['cars', 'bookings', 'maintenance', 'expenses', 'extraIncome'];
function nowISO() { return new Date().toISOString(); }
// Stamp a record as "just changed here" so record-level merge knows this copy
// is newer than whatever is on the other side.
function touch(rec) { if (rec) rec.updatedAt = nowISO(); return rec; }
function markDeleted(collection, id) {
  if (!state.tombstones[collection]) state.tombstones[collection] = {};
  state.tombstones[collection][id] = nowISO();
}

// Record-level merge: union local + remote by id, newest updatedAt wins per
// record, then hide anything a tombstone deleted more recently than its last
// edit. This is what stops an old web snapshot from overwriting fresh Sheet
// edits — each row is compared on its own timestamp, not the whole collection.
function mergeById(local, remote, collection) {
  const map = {};
  (local || []).forEach(r => { if (r && r.id != null) map[r.id] = r; });
  (remote || []).forEach(r => {
    if (!r || r.id == null) return;
    const cur = map[r.id];
    if (!cur) { map[r.id] = r; return; }
    map[r.id] = ((r.updatedAt || '') >= (cur.updatedAt || '')) ? r : cur;
  });
  const tomb = state.tombstones[collection] || {};
  return Object.values(map).filter(r => {
    const t = tomb[r.id];
    if (!t) return true;
    // Record edited AFTER it was deleted → it was re-created; keep it and drop
    // the stale tombstone. Otherwise the deletion stands.
    if ((r.updatedAt || '') > t) { delete tomb[r.id]; return true; }
    return false;
  });
}

// Merge the two tombstone registries (local + whatever the sheet carried),
// keeping the newest deletion time for each id.
function mergeTombstones(remote) {
  if (!remote) return;
  SYNC_COLLECTIONS.forEach(coll => {
    const rt = remote[coll] || {};
    const lt = state.tombstones[coll] || (state.tombstones[coll] = {});
    Object.keys(rt).forEach(id => {
      if (!lt[id] || rt[id] > lt[id]) lt[id] = rt[id];
    });
  });
}

// ── Vehicle catalog (type → brand → models) ─────────────────────────────
// Fallback used only until the first successful sync from the Google Sheet's
// "VehicleCatalog" tab, which is the real source of truth going forward —
// add new brands/models there, not here.
const DEFAULT_VEHICLE_CATALOG = {
  car: {
    'Toyota':     ['Yaris', 'Yaris Ativ', 'Vios', 'Corolla Altis', 'Corolla Cross', 'Camry', 'Fortuner', 'Hilux Revo', 'Innova'],
    'Honda':      ['City', 'Civic', 'Accord', 'Jazz', 'HR-V', 'CR-V', 'BR-V'],
    'Isuzu':      ['D-Max', 'MU-X'],
    'Mazda':      ['Mazda2', 'Mazda3', 'CX-3', 'CX-30', 'CX-5', 'BT-50'],
    'Mitsubishi': ['Attrage', 'Mirage', 'Xpander', 'Triton', 'Pajero Sport'],
    'Nissan':     ['Almera', 'Note', 'Kicks', 'Navara', 'Terra'],
    'Ford':       ['Ranger', 'Everest', 'Focus'],
    'MG':         ['MG3', 'MG5', 'ZS', 'HS', 'Extender'],
    'Hyundai':    ['Accent', 'Elantra', 'Tucson', 'Creta'],
  },
  motorcycle: {
    'Honda':  ['Wave110i', 'Wave125i', 'Click125i', 'Click160i', 'PCX160', 'ADV160', 'CBR150R', 'Forza'],
    'Yamaha': ['Fino', 'Grand Filano', 'NMAX', 'Aerox', 'XMAX', 'YZF-R15'],
    'GPX':    ['Demon', 'Legend'],
  },
};

function buildVehicleCatalog(rows) {
  const catalog = { car: {}, motorcycle: {} };
  (rows || []).forEach(r => {
    if (!r.brand || !r.model) return;
    const type = r.type === 'motorcycle' ? 'motorcycle' : 'car';
    if (!catalog[type][r.brand]) catalog[type][r.brand] = [];
    catalog[type][r.brand].push(r.model);
  });
  return catalog;
}

function catalogForType(type) {
  const hasSynced = state.catalog && (Object.keys(state.catalog.car).length || Object.keys(state.catalog.motorcycle).length);
  const catalog = hasSynced ? state.catalog : DEFAULT_VEHICLE_CATALOG;
  return type === 'motorcycle' ? catalog.motorcycle : catalog.car;
}

// ── Auto-init (no login) ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  state.user = { username: 'admin', role: 'owner', display: 'เจ้าของ' };
  document.body.classList.add('is-owner');
  initApp();
});

// The viewport meta tag's user-scalable=no isn't always honored by iOS
// Safari in standalone/home-screen mode, so pinch-zoom is blocked here too.
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

// ── Init ───────────────────────────────────────────────────────────────
function initApp() {
  loadFromStorage();
  // null (key never set / storage evicted) falls back to the default; an
  // explicitly-saved empty string (owner turned sync off on purpose in
  // Settings) is respected and stays offline.
  const savedSheetsUrl = localStorage.getItem('sheetsUrl');
  state.sheetsUrl = savedSheetsUrl !== null ? savedSheetsUrl : DEFAULT_SHEETS_URL;
  // Only seed demo data when running fully offline (no Sheet configured). When
  // a Sheet IS configured, an empty local store must stay empty until the first
  // pull — otherwise sample cars could be pushed up and clobber real data.
  if (!state.sheetsUrl && !state.cars.length) seedSampleData();
  const todayLabel = formatDateThai(new Date());
  document.getElementById('topbarDate').textContent   = todayLabel;
  document.getElementById('todayDateDesk').textContent = todayLabel;
  renderDashboard();
  navigate('dashboard');
  initCustomPickers();
  enhanceAllSelects();
  if (state.sheetsUrl) {
    // If the last session left unsynced local changes (e.g. entered while
    // offline), start with a full sync (pull+merge+push) instead of a pull.
    if (localStorage.getItem('pendingPush')) syncNow();
    else loadFromSheets();
    startSheetsPolling();
  }
}

function loadFromStorage() {
  state.cars          = JSON.parse(localStorage.getItem('cars')          || '[]');
  state.bookings      = JSON.parse(localStorage.getItem('bookings')      || '[]');
  state.maintenance   = JSON.parse(localStorage.getItem('maintenance')   || '[]');
  state.expenses      = JSON.parse(localStorage.getItem('expenses')      || '[]');
  state.extraIncome   = JSON.parse(localStorage.getItem('extraIncome')   || '[]');
  state.customerTags  = JSON.parse(localStorage.getItem('customerTags')  || '{}');
  state.catalog       = JSON.parse(localStorage.getItem('vehicleCatalog') || 'null');
  const savedTombstones = JSON.parse(localStorage.getItem('tombstones') || 'null');
  if (savedTombstones) state.tombstones = savedTombstones;
  SYNC_COLLECTIONS.forEach(c => { if (!state.tombstones[c]) state.tombstones[c] = {}; });
}

function saveToStorage() {
  localStorage.setItem('cars',         JSON.stringify(state.cars));
  localStorage.setItem('bookings',     JSON.stringify(state.bookings));
  localStorage.setItem('maintenance',  JSON.stringify(state.maintenance));
  localStorage.setItem('expenses',     JSON.stringify(state.expenses));
  localStorage.setItem('extraIncome',  JSON.stringify(state.extraIncome));
  localStorage.setItem('customerTags', JSON.stringify(state.customerTags));
  localStorage.setItem('tombstones',   JSON.stringify(state.tombstones));
}

// ── Sample Data ────────────────────────────────────────────────────────
function seedSampleData() {
  const today = todayStr();
  const d = (n) => {
    const dt = new Date(); dt.setDate(dt.getDate() + n);
    return dt.toISOString().slice(0,10);
  };

  state.cars = [
    { id: 'c1', plate: 'ขข 1234 เชียงใหม่', brand: 'Toyota', model: 'Vios',   type: 'sedan',  year: 2021, color: 'ขาว',   mileage: 48000, nextService: 50000, dailyRate: 800,  status: 'available',   note: '' },
    { id: 'c2', plate: 'กข 5678 เชียงใหม่', brand: 'Toyota', model: 'Camry',  type: 'sedan',  year: 2022, color: 'เทา',   mileage: 22000, nextService: 30000, dailyRate: 1200, status: 'rented',      note: '' },
    { id: 'c3', plate: 'งง 9999 เชียงใหม่', brand: 'Isuzu',  model: 'D-Max',  type: 'pickup', year: 2020, color: 'ดำ',    mileage: 75000, nextService: 80000, dailyRate: 1000, status: 'available',   note: '' },
    { id: 'c4', plate: 'ชช 1111 เชียงใหม่', brand: 'Honda',  model: 'HR-V',   type: 'suv',    year: 2023, color: 'แดง',   mileage: 12000, nextService: 20000, dailyRate: 1100, status: 'available',   note: '' },
    { id: 'c5', plate: 'ทท 2468 เชียงใหม่', brand: 'Toyota', model: 'Fortuner',type:'suv',    year: 2021, color: 'ขาว',   mileage: 55000, nextService: 60000, dailyRate: 1500, status: 'maintenance', note: 'เปลี่ยนน้ำมันเครื่อง' },
    { id: 'c6', plate: 'นน 3579 เชียงใหม่', brand: 'Honda',  model: 'Jazz',   type: 'sedan',  year: 2020, color: 'ฟ้า',   mileage: 38000, nextService: 40000, dailyRate: 700,  status: 'available',   note: '' },
  ];
  state.bookings = [
    { id: 'b1', carId: 'c2', customer: 'สมชาย ใจดี',    phone: '081-234-5678', start: d(-3), end: today, mileageOut: 21800, rate: 1200, total: 4800,  status: 'active',    extra: 0, returnMileage: null, note: '' },
    { id: 'b2', carId: 'c1', customer: 'สมหญิง รักดี',   phone: '082-987-6543', start: d(2),  end: d(5),  mileageOut: null,  rate: 800,  total: 2400,  status: 'upcoming',  extra: 0, returnMileage: null, note: '' },
  ];
  saveToStorage();
}

// ── Navigation ─────────────────────────────────────────────────────────
const PAGE_LABELS = {
  dashboard:   'ภาพรวม',
  cars:        'รถทั้งหมด',
  bookings:    'การจอง',
  maintenance: 'ซ่อมบำรุง',
  suggest:     'แนะนำรถ',
  finance:     'รายรับ-รายจ่าย',
  customers:   'ลูกค้า',
};

let currentPage = 'dashboard';

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));
  document.querySelectorAll('.bnav-item').forEach(a => a.classList.remove('active'));

  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');

  const nav = document.querySelector(`.nav-item[onclick="navigate('${page}')"]`);
  if (nav) nav.classList.add('active');

  // Bottom nav active state
  const bnav = document.querySelector(`.bnav-item[data-page="${page}"]`);
  if (bnav) bnav.classList.add('active');
  updateBnavIndicator(bnav);

  document.getElementById('topbarTitle').textContent = PAGE_LABELS[page] || page;
  closeSidebar();
  document.getElementById('carsBackBtn').style.display = 'none';

  renderCurrentPage();
}

function renderCurrentPage() {
  if (currentPage === 'dashboard')   renderDashboard();
  if (currentPage === 'cars')        renderCarsPage();
  if (currentPage === 'bookings')    renderBookingsPage();
  if (currentPage === 'maintenance') renderMaintenancePage();
  if (currentPage === 'finance')     renderFinancePage();
  if (currentPage === 'customers')   renderCustomersPage();
}

// Slides the bottom-nav "bump" circle under whichever tab is active. Reads
// the tab's actual position instead of assuming a fixed width, so it keeps
// lining up correctly if a tab is added/removed or the screen is resized.
function updateBnavIndicator(activeBnavItem) {
  const indicator = document.getElementById('bnavIndicator');
  if (!indicator) return;
  if (!activeBnavItem) { indicator.classList.remove('visible'); return; }

  const inner    = indicator.parentElement;
  const itemRect = activeBnavItem.getBoundingClientRect();
  const innerRect = inner.getBoundingClientRect();
  indicator.style.left = `${itemRect.left - innerRect.left + itemRect.width / 2}px`;
  indicator.classList.add('visible');
}

window.addEventListener('resize', () => {
  const active = document.querySelector('.bnav-item.active');
  updateBnavIndicator(active);
});

function goToCarsFiltered(status) {
  navigate('cars');
  document.getElementById('carSearch').value = '';
  document.getElementById('carStatusFilter').value = status;
  document.getElementById('carsBackBtn').style.display = 'flex';
  renderCarsPage();
}

// ── Sidebar ────────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ── Dashboard ──────────────────────────────────────────────────────────
function renderDashboard() {
  const cars = state.cars;
  const today = todayStr();

  const available   = cars.filter(c => c.status === 'available').length;
  const rented      = cars.filter(c => c.status === 'rented').length;
  const maintenance = cars.filter(c => c.status === 'maintenance').length;

  document.getElementById('statTotal').textContent       = cars.length;
  document.getElementById('statAvailable').textContent   = available;
  document.getElementById('statRented').textContent      = rented;
  document.getElementById('statMaintenance').textContent = maintenance;

  // (blockedDueCard removed from dashboard — will be placed elsewhere)

  // Today's deliveries
  const deliveries = state.bookings
    .filter(b => b.start === today && b.status !== 'completed')
    .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
  const deliveryEl = document.getElementById('todayDeliveries');
  if (!deliveries.length) {
    deliveryEl.innerHTML = '<p class="empty-state">ไม่มีรถที่ต้องส่งวันนี้</p>';
  } else {
    deliveryEl.innerHTML = deliveries.map(b => {
      const car = getCarById(b.carId);
      return `
        <div class="return-item">
          <div class="return-item-info">
            <div class="return-plate">${car ? car.plate : '-'} <span style="font-weight:400;color:var(--gray-500);font-size:.8rem;">${car ? car.brand + ' ' + car.model : ''}</span></div>
            <div class="return-customer">${b.customer} · ${telLink(b.phone)}</div>
            ${b.pickupLocation ? `<div class="return-location">ส่งที่: ${mapLink(b.pickupLocation)}</div>` : ''}
          </div>
          <div>
            <span class="return-tag">${b.startTime || 'ไม่ระบุเวลา'}</span>
            <button class="btn btn-sm btn-primary" style="margin-top:.35rem;" onclick="openEditBookingModal('${b.id}')">รายละเอียด</button>
          </div>
        </div>`;
    }).join('');
  }

  // Today's returns
  const returns = state.bookings.filter(b => b.end === today && b.status === 'active');
  const returnEl = document.getElementById('todayReturns');
  if (!returns.length) {
    returnEl.innerHTML = '<p class="empty-state">ไม่มีรถที่ต้องคืนวันนี้</p>';
  } else {
    returnEl.innerHTML = returns.map(b => {
      const car = getCarById(b.carId);
      return `
        <div class="return-item">
          <div class="return-item-info">
            <div class="return-plate">${car ? car.plate : '-'} <span style="font-weight:400;color:var(--gray-500);font-size:.8rem;">${car ? car.brand + ' ' + car.model : ''}</span></div>
            <div class="return-customer">${b.customer} · ${telLink(b.phone)}</div>
            ${b.returnLocation ? `<div class="return-location">รับคืนที่: ${mapLink(b.returnLocation)}</div>` : ''}
          </div>
          <div>
            <span class="return-tag">คืนวันนี้</span>
            <button class="btn btn-sm btn-success" style="margin-top:.35rem;" onclick="openReturnModal('${b.id}')">คืนรถ</button>
          </div>
        </div>`;
    }).join('');
  }

  // Car mini grid
  document.getElementById('dashboardCarList').innerHTML =
    sortCarsByStatus(cars).map(carMiniCardHtml).join('');
}

// Shared status-tinted glass card, used by the dashboard grid and the
// Cars page grid.
const CAR_STATUS_ORDER = { available: 0, rented: 1, maintenance: 2, blocked: 3 };

function sortCarsByStatus(cars) {
  return [...cars].sort((a, b) => (CAR_STATUS_ORDER[a.status] ?? 99) - (CAR_STATUS_ORDER[b.status] ?? 99));
}

function carMiniCardHtml(car) {
  const statusLabel = { available: 'ว่าง', rented: 'เช่าอยู่', maintenance: 'ซ่อมบำรุง', blocked: 'งดให้บริการ' }[car.status] || car.status || '-';
  return `
    <div class="car-mini-card status-${car.status}" style="--car-color:${CAR_COLOR_HEX[car.color] || 'rgba(255,255,255,0.12)'}" onclick="openCarDetail('${car.id}')">
      <div class="car-mini-photo">${car.photo ? `<img src="${car.photo}" alt="" />` : vehicleTypeIcon(car.type, car.color)}</div>
      <div class="car-mini-plate">${car.plate}</div>
      <div class="car-mini-model">${car.brand || '-'} ${car.model || '-'}${car.color ? ' - ' + car.color : ''}</div>
      ${car.ownerName ? `<div class="car-mini-owner">${car.ownerName}</div>` : ''}
      <div class="car-mini-status-big">${statusLabel}</div>
    </div>`;
}

// ── Cars Page ──────────────────────────────────────────────────────────
function renderCarsPage() {
  const q      = (document.getElementById('carSearch')?.value || '').toLowerCase();
  const status = document.getElementById('carStatusFilter')?.value || '';

  let cars = state.cars.filter(c => {
    const matchQ = !q || `${c.plate} ${c.brand} ${c.model} ${c.color || ''} ${c.ownerName || ''}`.toLowerCase().includes(q);
    const matchS = !status || c.status === status;
    return matchQ && matchS;
  });

  document.getElementById('carsCount').textContent = `${cars.length} คัน`;

  const html = cars.length
    ? `<div class="section-card"><div class="car-grid">${sortCarsByStatus(cars).map(carMiniCardHtml).join('')}</div></div>`
    : '<p class="empty-state" style="text-align:center;padding:2rem;">ไม่พบรถ</p>';

  document.getElementById('carsTableContainer').innerHTML = html;
}

// Car modals
const CAR_COLORS = ['ขาว', 'ดำ', 'เงิน', 'เทา', 'แดง', 'น้ำเงิน', 'ฟ้า', 'เขียว', 'เหลือง', 'ส้ม', 'น้ำตาล', 'ทอง', 'บรอนซ์', 'ม่วง', 'ชมพู'];

// Thai color name -> swatch hex, used for the car-color gradient that fills
// the top half of each car card so the real-world color reads at a glance.
const CAR_COLOR_HEX = {
  'ขาว': '#f8fafc', 'ดำ': '#18181b', 'เงิน': '#cbd5e1', 'เทา': '#6b7280',
  'แดง': '#ef4444', 'น้ำเงิน': '#2563eb', 'ฟ้า': '#38bdf8', 'เขียว': '#16a34a',
  'เหลือง': '#eab308', 'ส้ม': '#f97316', 'น้ำตาล': '#78350f', 'ทอง': '#ca8a04',
  'บรอนซ์': '#92714a', 'ม่วง': '#9333ea', 'ชมพู': '#ec4899',
};

function populateYearSelect(selectedYear) {
  const thisYear = new Date().getFullYear();
  const years = [];
  for (let y = thisYear + 1; y >= 2005; y--) years.push(y);
  const extra  = selectedYear && !years.includes(+selectedYear) ? [+selectedYear] : [];
  const yearEl = document.getElementById('carYear');
  yearEl.innerHTML = '<option value="">— เลือกปี —</option>' +
    [...years, ...extra].map(y => `<option value="${y}">${y}</option>`).join('');
  yearEl.value = selectedYear || '';
}

function populateColorSelect(selectedColor) {
  const used   = [...new Set(state.cars.map(c => c.color).filter(Boolean))];
  const extra  = used.filter(c => !CAR_COLORS.includes(c));
  const colorEl = document.getElementById('carColor');
  colorEl.innerHTML = '<option value="">— เลือกสี —</option>' +
    [...CAR_COLORS, ...extra].map(c => `<option value="${c}">${c}</option>`).join('');
  colorEl.value = selectedColor || '';
}

function populateBrandSelect(selectedBrand) {
  const catalog = catalogForType(document.getElementById('carType').value);
  const brands  = Object.keys(catalog);
  const extra   = selectedBrand && !brands.includes(selectedBrand) ? [selectedBrand] : [];
  const brandEl = document.getElementById('carBrand');
  brandEl.innerHTML = '<option value="">— เลือกยี่ห้อ —</option>' +
    [...brands, ...extra].map(b => `<option value="${b}">${b}</option>`).join('');
  brandEl.value = selectedBrand || '';
}

function populateModelSelect(selectedModel) {
  const catalog = catalogForType(document.getElementById('carType').value);
  const brand   = document.getElementById('carBrand').value;
  const models  = catalog[brand] || [];
  const extra   = selectedModel && !models.includes(selectedModel) ? [selectedModel] : [];
  const modelEl = document.getElementById('carModel');
  modelEl.innerHTML = '<option value="">— เลือกรุ่น —</option>' +
    [...models, ...extra].map(m => `<option value="${m}">${m}</option>`).join('');
  modelEl.value = selectedModel || '';
}

function onCarTypeChange() {
  populateBrandSelect();
  populateModelSelect();
}
function onCarBrandChange() {
  populateModelSelect();
}

function handleCarPhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const size = 240;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(size / img.width, size / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      document.getElementById('carPhotoData').value = dataUrl;
      document.getElementById('carPhotoPreview').innerHTML = `<img src="${dataUrl}" alt="" />`;
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function openAddCarModal() {
  document.getElementById('carModalTitle').textContent = 'เพิ่มรถ';
  document.getElementById('carModalId').value   = '';
  document.getElementById('carPhotoData').value = '';
  document.getElementById('carPhotoInput').value = '';
  document.getElementById('carPhotoPreview').innerHTML = '<i class="fa-solid fa-car"></i>';
  document.getElementById('carPlate').value     = '';
  document.getElementById('carType').value      = 'sedan';
  populateBrandSelect();
  populateModelSelect();
  populateYearSelect();
  populateColorSelect();
  document.getElementById('carMileage').value   = '';
  document.getElementById('carNextService').value = '';
  document.getElementById('carDailyRate').value = '';
  document.getElementById('carStatus').value    = 'available';
  document.getElementById('carOwnerName').value = '';
  document.getElementById('carNote').value      = '';
  showModal('carModal');
}

function openEditCarModal(id) {
  const car = getCarById(id);
  if (!car) return;
  document.getElementById('carModalTitle').textContent    = 'แก้ไขข้อมูลรถ';
  document.getElementById('carModalId').value            = car.id;
  document.getElementById('carPhotoData').value          = car.photo || '';
  document.getElementById('carPhotoInput').value         = '';
  document.getElementById('carPhotoPreview').innerHTML   = car.photo
    ? `<img src="${car.photo}" alt="" />`
    : `<i class="fa-solid fa-car"></i>`;
  document.getElementById('carPlate').value              = car.plate;
  document.getElementById('carType').value               = car.type || 'sedan';
  populateBrandSelect(car.brand);
  populateModelSelect(car.model);
  populateYearSelect(car.year);
  populateColorSelect(car.color);
  document.getElementById('carMileage').value            = car.mileage;
  document.getElementById('carNextService').value        = car.nextService || '';
  document.getElementById('carDailyRate').value          = car.dailyRate;
  document.getElementById('carStatus').value             = car.status;
  document.getElementById('carOwnerName').value          = car.ownerName || '';
  document.getElementById('carNote').value               = car.note || '';
  closeModal('carDetailModal');
  showModal('carModal');
}

function saveCar() {
  const plate = document.getElementById('carPlate').value.trim();
  const brand = document.getElementById('carBrand').value.trim();
  const model = document.getElementById('carModel').value.trim();
  if (!plate || !brand || !model) { showToast('กรุณากรอกข้อมูลที่จำเป็น', 'error'); return; }

  const id = document.getElementById('carModalId').value;
  const data = {
    plate, brand, model,
    type:        document.getElementById('carType').value,
    year:        +document.getElementById('carYear').value || null,
    color:       document.getElementById('carColor').value.trim(),
    mileage:     +document.getElementById('carMileage').value || 0,
    nextService: +document.getElementById('carNextService').value || null,
    dailyRate:   +document.getElementById('carDailyRate').value || 0,
    status:      document.getElementById('carStatus').value,
    ownerName:   document.getElementById('carOwnerName').value.trim(),
    note:        document.getElementById('carNote').value.trim(),
    photo:       document.getElementById('carPhotoData').value || null,
    updatedAt:   nowISO(),
  };

  if (id) {
    const idx = state.cars.findIndex(c => c.id === id);
    if (idx > -1) state.cars[idx] = { ...state.cars[idx], ...data };
  } else {
    state.cars.push({ id: 'c' + Date.now(), ...data });
  }

  saveToStorage();
  closeModal('carModal');
  renderCarsPage();
  renderDashboard();
  pushToSheets(['cars']);
  showToast(id ? 'อัปเดตข้อมูลรถเรียบร้อย' : 'เพิ่มรถเรียบร้อย', 'success');
}

function deleteCar(id) {
  if (!confirm('ต้องการลบรถคันนี้?')) return;
  state.cars = state.cars.filter(c => c.id !== id);
  markDeleted('cars', id);
  saveToStorage();
  renderCarsPage();
  renderDashboard();
  pushToSheets(['cars']);
  showToast('ลบรถเรียบร้อย');
}

function openCarDetail(id) {
  const car = getCarById(id);
  if (!car) return;

  const STATUS_LABEL = { available: 'ว่าง', rented: 'เช่าอยู่', maintenance: 'ซ่อมบำรุง', blocked: 'ปิดตา' };
  const activeBooking = state.bookings.find(b => b.carId === id && b.status === 'active');
  const history = state.bookings.filter(b => b.carId === id && b.status === 'completed').slice(-5).reverse();

  document.getElementById('carDetailTitle').innerHTML = `${vehicleTypeIcon(car.type)} ${car.plate}`;
  document.getElementById('carDetailBody').innerHTML = `
    <div style="margin-bottom:.75rem;">
      <span class="pill pill-${car.status}">${STATUS_LABEL[car.status] || car.status || '-'}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem .75rem;font-size:.88rem;margin-bottom:1rem;">
      <div><span style="color:var(--gray-500);">ยี่ห้อ/รุ่น</span><br><strong>${car.brand || '-'} ${car.model || '-'}</strong></div>
      <div><span style="color:var(--gray-500);">ปี</span><br><strong>${car.year || '-'}</strong></div>
      <div><span style="color:var(--gray-500);">สี</span><br><strong>${car.color || '-'}</strong></div>
      <div><span style="color:var(--gray-500);">ประเภท</span><br><strong>${vehicleTypeIcon(car.type)} ${TYPE_LABEL[car.type] || car.type || '-'}</strong></div>
      <div><span style="color:var(--gray-500);">เลขไมล์</span><br><strong>${(car.mileage || 0).toLocaleString()} กม.</strong></div>
      <div><span style="color:var(--gray-500);">ซ่อมถัดไป</span><br><strong>${car.nextService ? car.nextService.toLocaleString() + ' กม.' : '-'}</strong></div>
      <div><span style="color:var(--gray-500);">ราคา/วัน</span><br><strong>${(car.dailyRate || 0).toLocaleString()} ฿</strong></div>
      <div><span style="color:var(--gray-500);">เจ้าของรถ</span><br><strong>${car.ownerName || '-'}</strong></div>
    </div>
    ${car.status === 'blocked' ? `
      <div style="background:var(--blocked-bg);border:1px solid rgba(167,139,250,0.2);border-radius:var(--radius-sm);padding:.75rem;font-size:.85rem;margin-bottom:.75rem;color:var(--blocked);">
        <i class="fa-solid fa-lock"></i> <strong>รถถูกปิดตาอยู่</strong>
        ${car.blockedReason ? `<br>เหตุผล: ${car.blockedReason}` : ''}
        ${car.blockedUntil  ? `<br>กำหนดเปิดตา: ${car.blockedUntil}` : ''}
        <br><button class="btn btn-sm" style="margin-top:.5rem;background:var(--blocked-bg);color:var(--blocked);border:1px solid rgba(167,139,250,0.3);"
          onclick="unblockCar('${car.id}');closeModal('carDetailModal')">
          <i class="fa-solid fa-lock-open"></i> เปิดตา
        </button>
      </div>` : ''}
    ${activeBooking ? `
      <div style="background:var(--rented-bg);border-radius:var(--radius-sm);padding:.75rem;font-size:.85rem;margin-bottom:.75rem;">
        <strong>การเช่าปัจจุบัน</strong><br>
        ${activeBooking.customer} · ${activeBooking.start} – ${activeBooking.end}
        <button class="btn btn-sm btn-success" style="margin-left:.75rem;" onclick="openReturnModal('${activeBooking.id}');closeModal('carDetailModal')">คืนรถ</button>
      </div>` : ''}
    ${history.length ? `
      <div style="font-size:.82rem;color:var(--gray-500);margin-bottom:.35rem;">ประวัติการเช่าล่าสุด</div>
      ${history.map(b => `<div style="font-size:.83rem;padding:.35rem 0;border-bottom:1px solid var(--gray-100);">${b.start} – ${b.end} · ${b.customer}${(b.kmDriven !== null && b.kmDriven !== undefined && b.kmDriven >= 0) ? ` · วิ่งไป ${b.kmDriven.toLocaleString()} กม.` : ''}</div>`).join('')}` : ''}
    ${car.note ? `<div style="margin-top:.75rem;font-size:.82rem;color:var(--gray-500);">หมายเหตุ: ${car.note}</div>` : ''}
  `;
  document.getElementById('carDetailEditBtn').onclick   = () => openEditCarModal(id);
  document.getElementById('carDetailDeleteBtn').onclick = () => { closeModal('carDetailModal'); deleteCar(id); };
  const blockBtn = document.getElementById('carDetailBlockBtn');
  if (car.status === 'blocked') {
    blockBtn.innerHTML = '<i class="fa-solid fa-lock-open"></i> เปิดตา';
    blockBtn.onclick = () => { unblockCar(id); closeModal('carDetailModal'); };
  } else {
    blockBtn.innerHTML = '<i class="fa-solid fa-lock"></i> ปิดตา';
    blockBtn.onclick = () => { closeModal('carDetailModal'); openBlockCarModal(id); };
  }
  showModal('carDetailModal');
}

// ── Bookings Page ──────────────────────────────────────────────────────
function renderBookingsPage() {
  const filter = document.getElementById('bookingFilter')?.value || 'all';
  const today  = todayStr();

  let bookings = state.bookings.filter(b => {
    if (filter === 'active')    return b.status === 'active';
    if (filter === 'upcoming')  return b.status === 'upcoming';
    if (filter === 'completed') return b.status === 'completed';
    return true;
  });

  bookings = [...bookings].sort((a,b) => a.start.localeCompare(b.start));

  const STATUS_LABEL = { active: 'กำลังเช่า', upcoming: 'กำลังจะถึง', completed: 'คืนแล้ว' };
  const STATUS_PILL  = { active: 'rented', upcoming: 'upcoming', completed: 'completed' };

  const html = bookings.length ? `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>รถ</th>
            <th>ลูกค้า</th>
            <th>วันรับ–คืน</th>
            <th>ยอดรวม</th>
            <th>สถานะ</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${bookings.map(b => {
            const car = getCarById(b.carId);
            const isOverdue = b.status === 'active' && b.end < today;
            return `
              <tr class="row-clickable" onclick="openEditBookingModal('${b.id}')">
                <td><strong>${car ? car.plate : '-'}</strong><br><span style="font-size:.78rem;color:var(--gray-400);">${car ? car.brand+' '+car.model : ''}</span></td>
                <td>${b.customer}<br><span style="font-size:.78rem;">${telLink(b.phone)}</span></td>
                <td>${b.start}<br>– ${b.end}${isOverdue ? ' <span class="pill pill-overdue" style="font-size:.68rem;">เกินกำหนด</span>' : ''}
                  ${b.pickupLocation || b.returnLocation ? `<br><span style="font-size:.72rem;">${b.pickupLocation ? 'รับ: ' + mapLink(b.pickupLocation) : ''}${b.pickupLocation && b.returnLocation ? ' · ' : ''}${b.returnLocation ? 'คืน: ' + mapLink(b.returnLocation) : ''}</span>` : ''}</td>
                <td><strong>${(b.status === 'completed' ? (b.finalTotal || b.total || 0) : (b.total || 0)).toLocaleString()} ฿</strong></td>
                <td><span class="pill pill-${STATUS_PILL[b.status]||'completed'}">${STATUS_LABEL[b.status]||b.status}</span></td>
                <td>
                  <div class="actions">
                    ${b.status !== 'completed' ? `<button class="btn btn-sm btn-success btn-icon" onclick="event.stopPropagation(); openReturnModal('${b.id}')" title="คืนรถ"><i class="fa-solid fa-rotate-left"></i></button>` : ''}
                    <button class="btn btn-sm btn-warning btn-icon" onclick="event.stopPropagation(); openEditBookingModal('${b.id}')" title="แก้ไข"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-sm btn-danger btn-icon" onclick="event.stopPropagation(); deleteBooking('${b.id}')" title="ลบ"><i class="fa-solid fa-trash"></i></button>
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : '<p class="empty-state" style="text-align:center;padding:2rem;">ไม่มีรายการ</p>';

  document.getElementById('bookingsTableContainer').innerHTML = html;
  runBookingsSearch();
}

function openAddBookingModal() {
  populateCarSelect('bookingCar', true);
  document.getElementById('bookingModalTitle').textContent = 'เพิ่มการจอง';
  document.getElementById('bookingModalId').value    = '';
  document.getElementById('bookingCustomer').value   = '';
  document.getElementById('bookingPhone').value      = '';
  document.getElementById('bookingStart').value      = '';
  document.getElementById('bookingStartTime').value  = '';
  document.getElementById('bookingEnd').value        = '';
  document.getElementById('bookingEndTime').value    = '';
  document.getElementById('bookingPickupLocation').value = '';
  document.getElementById('bookingReturnLocation').value  = '';
  document.getElementById('bookingMileageOut').value = '';
  document.getElementById('bookingRate').value       = '';
  document.getElementById('bookingOtFee').value      = '';
  document.getElementById('bookingNote').value       = '';
  document.getElementById('bookingTotalBox').style.display = 'none';
  updateBookingHints();
  showModal('bookingModal');
}

function openEditBookingModal(id) {
  const b = state.bookings.find(x => x.id === id);
  if (!b) return;
  populateCarSelect('bookingCar', false);
  document.getElementById('bookingModalTitle').textContent = 'แก้ไขการจอง';
  document.getElementById('bookingModalId').value    = b.id;
  document.getElementById('bookingCar').value        = b.carId;
  document.getElementById('bookingCustomer').value   = b.customer;
  document.getElementById('bookingPhone').value      = b.phone || '';
  document.getElementById('bookingStart').value      = b.start;
  document.getElementById('bookingStartTime').value  = b.startTime || '';
  document.getElementById('bookingEnd').value        = b.end;
  document.getElementById('bookingEndTime').value    = b.endTime || '';
  document.getElementById('bookingPickupLocation').value = b.pickupLocation || '';
  document.getElementById('bookingReturnLocation').value  = b.returnLocation || '';
  document.getElementById('bookingMileageOut').value = b.mileageOut || '';
  document.getElementById('bookingRate').value       = b.rate || '';
  document.getElementById('bookingOtFee').value      = b.otFee || '';
  document.getElementById('bookingNote').value       = b.note || '';
  calcBookingTotal();
  showModal('bookingModal');
}

// Rough business-hours check used only to nudge staff toward an OT charge —
// doesn't block or auto-add anything, since OT policy/amount is their call.
function isOffHours(timeStr) {
  if (!timeStr) return false;
  const h = +timeStr.split(':')[0];
  return h < 8 || h >= 20;
}

function updateBookingHints() {
  const start     = document.getElementById('bookingStart').value;
  const startTime = document.getElementById('bookingStartTime').value;
  const endTime   = document.getElementById('bookingEndTime').value;
  const today     = todayStr();

  const mileageHint = document.getElementById('mileageOutHint');
  mileageHint.style.display = (start && start <= today) ? 'inline' : 'none';

  const otHint = document.getElementById('otHint');
  if (isOffHours(startTime) || isOffHours(endTime)) {
    otHint.textContent = '⚠ เวลานอกเวลาทำการ อาจมีค่า OT';
    otHint.style.display = 'inline';
  } else {
    otHint.style.display = 'none';
  }
}

function calcBookingTotal() {
  const start = document.getElementById('bookingStart').value;
  const end   = document.getElementById('bookingEnd').value;
  const carId = document.getElementById('bookingCar').value;
  const rateOverride = +document.getElementById('bookingRate').value || 0;
  const otFee = +document.getElementById('bookingOtFee').value || 0;
  const box   = document.getElementById('bookingTotalBox');

  updateBookingHints();

  if (!start || !end || !carId) { box.style.display = 'none'; return; }

  const days = daysBetween(start, end);
  if (days <= 0) { box.style.display = 'none'; return; }

  const car  = getCarById(carId);
  const rate = rateOverride || (car ? car.dailyRate : 0);
  const total = days * rate + otFee;

  document.getElementById('bookingDays').textContent  = days;
  document.getElementById('bookingTotal').textContent = '฿' + total.toLocaleString() + (otFee ? ` (รวม OT ${otFee.toLocaleString()} ฿)` : '');
  box.style.display = 'flex';
}

// A car can't legitimately be handed to two customers over the same span —
// same-day turnover (one ends exactly when the other starts) is fine and
// handled by the Booking search's queue view, so only flag a *strict*
// overlap, matching the definition computeAvailability() already uses.
function findBookingConflict(carId, start, end, excludeId) {
  return state.bookings.find(b =>
    b.carId === carId &&
    b.id !== excludeId &&
    b.status !== 'completed' &&
    b.start < end && b.end > start
  );
}

function saveBooking() {
  const carId    = document.getElementById('bookingCar').value;
  const customer = document.getElementById('bookingCustomer').value.trim();
  const start    = document.getElementById('bookingStart').value;
  const end      = document.getElementById('bookingEnd').value;
  if (!carId || !customer || !start || !end) { showToast('กรุณากรอกข้อมูลที่จำเป็น', 'error'); return; }
  if (end < start) { showToast('วันคืนรถต้องไม่ก่อนวันรับรถ', 'error'); return; }

  const id    = document.getElementById('bookingModalId').value;
  const today = todayStr();
  const status = start <= today ? 'active' : 'upcoming';

  const mileageOut = +document.getElementById('bookingMileageOut').value || null;
  if (status === 'active' && !mileageOut) {
    showToast('กรุณากรอกเลขไมล์ออก (จำเป็นเมื่อรับรถวันนี้หรือก่อนหน้า)', 'error');
    return;
  }

  const conflict = findBookingConflict(carId, start, end, id || null);
  if (conflict) {
    const proceed = confirm(
      `รถคันนี้ถูกจองซ้อนกับ ${conflict.customer} ช่วง ${conflict.start} – ${conflict.end} อยู่แล้ว\n` +
      `ต้องการบันทึกทับซ้อนต่อหรือไม่?`
    );
    if (!proceed) return;
  }

  const car   = getCarById(carId);
  const days  = daysBetween(start, end);
  const rateOverride = +document.getElementById('bookingRate').value || 0;
  const rate  = rateOverride || (car ? car.dailyRate : 0);
  const otFee = +document.getElementById('bookingOtFee').value || 0;
  const total = days * rate + otFee;

  const data = {
    carId, customer, start, end, rate, total, status, otFee,
    startTime:       document.getElementById('bookingStartTime').value || '',
    endTime:         document.getElementById('bookingEndTime').value || '',
    pickupLocation:  document.getElementById('bookingPickupLocation').value.trim(),
    returnLocation:  document.getElementById('bookingReturnLocation').value.trim(),
    phone:        document.getElementById('bookingPhone').value.trim(),
    mileageOut,
    note:         document.getElementById('bookingNote').value.trim(),
    extra: 0, returnMileage: null,
    updatedAt: nowISO(),
  };

  let touchedCar = false;
  if (id) {
    const idx = state.bookings.findIndex(b => b.id === id);
    if (idx > -1) state.bookings[idx] = { ...state.bookings[idx], ...data };
  } else {
    state.bookings.push({ id: 'b' + Date.now(), ...data });
    // Mark car as rented if active
    if (status === 'active') { updateCarStatus(carId, 'rented'); touchedCar = true; }
  }

  saveToStorage();
  closeModal('bookingModal');
  renderBookingsPage();
  renderDashboard();
  pushToSheets(touchedCar ? ['bookings', 'cars'] : ['bookings']);
  showToast(id ? 'อัปเดตการจองเรียบร้อย' : 'เพิ่มการจองเรียบร้อย', 'success');
}

function deleteBooking(id) {
  if (!confirm('ต้องการลบการจองนี้?')) return;
  state.bookings = state.bookings.filter(b => b.id !== id);
  markDeleted('bookings', id);
  saveToStorage();
  renderBookingsPage();
  renderDashboard();
  pushToSheets(['bookings']);
  showToast('ลบการจองเรียบร้อย');
}

// ── Return Car ─────────────────────────────────────────────────────────
function openReturnModal(bookingId) {
  const b   = state.bookings.find(x => x.id === bookingId);
  const car = b ? getCarById(b.carId) : null;
  if (!b || !car) return;

  document.getElementById('returnBookingId').value = bookingId;
  document.getElementById('returnDate').value      = todayStr();
  document.getElementById('returnTime').value      = '';
  document.getElementById('returnMileage').value   = '';
  document.getElementById('returnExtra').value     = '0';
  document.getElementById('returnNote').value      = '';
  document.getElementById('returnKmPreview').textContent = '';
  document.getElementById('returnKmPreview').className   = 'return-km-preview';

  const days  = daysBetween(b.start, b.end);
  document.getElementById('returnSummary').innerHTML = `
    <strong>${car.plate}</strong> ${car.brand || '-'} ${car.model || '-'}<br>
    ลูกค้า: ${b.customer} · เบอร์: ${telLink(b.phone)}<br>
    วันรับรถ: ${b.start}${b.startTime ? ' ' + b.startTime : ''} · กำหนดคืน: ${b.end}${b.endTime ? ' ' + b.endTime : ''} (${days} วัน)<br>
    ${b.returnLocation ? `สถานที่คืนรถ: ${mapLink(b.returnLocation)}<br>` : ''}
    เลขไมล์ตอนรับรถ: <strong>${((b.mileageOut ?? car.mileage) || 0).toLocaleString()} กม.</strong><br>
    ยอดเช่า: <strong>${(b.total||0).toLocaleString()} ฿</strong>${b.otFee ? ` (รวม OT ${b.otFee.toLocaleString()} ฿)` : ''}
  `;
  showModal('returnModal');
}

function returnMileageBaseline(b, car) {
  return (b.mileageOut !== null && b.mileageOut !== undefined) ? b.mileageOut : (car ? car.mileage : null);
}

function updateReturnKmPreview() {
  const bookingId = document.getElementById('returnBookingId').value;
  const b   = state.bookings.find(x => x.id === bookingId);
  const car = b ? getCarById(b.carId) : null;
  const preview = document.getElementById('returnKmPreview');
  const returnMile = +document.getElementById('returnMileage').value || null;
  const baseline   = b ? returnMileageBaseline(b, car) : null;

  if (!returnMile || baseline === null || baseline === undefined) {
    preview.textContent = '';
    preview.className   = 'return-km-preview';
    return;
  }

  const km = returnMile - baseline;
  if (km < 0) {
    preview.textContent = `⚠ เลขไมล์น้อยกว่าตอนรับรถ (${baseline.toLocaleString()} กม.) กรุณาตรวจสอบ`;
    preview.className   = 'return-km-preview warn';
  } else {
    preview.textContent = `ลูกค้าวิ่งไป ${km.toLocaleString()} กม.`;
    preview.className   = 'return-km-preview ok';
  }
}

function confirmReturn() {
  const bookingId   = document.getElementById('returnBookingId').value;
  const returnDate  = document.getElementById('returnDate').value;
  const returnTime  = document.getElementById('returnTime').value || '';
  const returnMile  = +document.getElementById('returnMileage').value || null;
  const extra       = +document.getElementById('returnExtra').value  || 0;
  const returnNote  = document.getElementById('returnNote').value.trim();

  const idx = state.bookings.findIndex(b => b.id === bookingId);
  if (idx < 0) return;

  const b   = state.bookings[idx];
  const car = getCarById(b.carId);
  if (returnDate < b.start) { showToast('วันคืนรถต้องไม่ก่อนวันรับรถ', 'error'); return; }
  const days = daysBetween(b.start, returnDate);
  const finalTotal = (days * b.rate) + (b.otFee || 0) + extra;

  const baseline = returnMileageBaseline(b, car);
  const kmDriven = (returnMile !== null && baseline !== null && baseline !== undefined) ? (returnMile - baseline) : null;

  state.bookings[idx] = { ...b, status: 'completed', returnDate, returnTime, returnMileage: returnMile, kmDriven, extra, finalTotal, returnNote, updatedAt: nowISO() };

  // Update car mileage & status
  const carIdx = state.cars.findIndex(c => c.id === b.carId);
  if (carIdx > -1) {
    state.cars[carIdx].status  = 'available';
    if (returnMile) state.cars[carIdx].mileage = returnMile;
    touch(state.cars[carIdx]);
  }

  saveToStorage();
  closeModal('returnModal');
  renderBookingsPage();
  renderDashboard();
  pushToSheets(['bookings', 'cars']);
  const kmMsg = (kmDriven !== null && kmDriven >= 0) ? ` · ลูกค้าวิ่งไป ${kmDriven.toLocaleString()} กม.` : '';
  showToast(`บันทึกการคืนรถเรียบร้อย ✅${kmMsg}`, 'success');
}

// ── Maintenance Page ───────────────────────────────────────────────────
function renderMaintenancePage() {
  // Populate car filter
  const filterEl = document.getElementById('maintenanceCarFilter');
  const selectedCar = filterEl?.value || '';
  if (filterEl && filterEl.options.length <= 1) {
    state.cars.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.plate;
      filterEl.appendChild(opt);
    });
  }

  let list = [...state.maintenance];
  if (selectedCar) list = list.filter(m => m.carId === selectedCar);
  list.sort((a,b) => b.date.localeCompare(a.date));

  const TYPE_LABEL = { oil: 'น้ำมันเครื่อง', tire: 'ยาง', brake: 'เบรก', ac: 'แอร์', body: 'ตัวถัง/สี', general: 'ทั่วไป', other: 'อื่นๆ' };

  const html = list.length ? `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>รถ</th>
            <th>วันที่ซ่อม</th>
            <th>ประเภท</th>
            <th>เลขไมล์</th>
            <th>ค่าซ่อม</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(m => {
            const car = getCarById(m.carId);
            return `
              <tr>
                <td><strong>${car ? car.plate : '-'}</strong></td>
                <td>${m.date}</td>
                <td>${TYPE_LABEL[m.type] || m.type}<br><span style="font-size:.78rem;color:var(--gray-400);">${m.detail || ''}</span></td>
                <td>${m.mileage ? m.mileage.toLocaleString()+' กม.' : '-'}</td>
                <td><strong class="finance-expense">${(m.cost||0).toLocaleString()} ฿</strong></td>
                <td>
                  <button class="btn btn-sm btn-danger btn-icon" onclick="deleteMaintenance('${m.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : '<p class="empty-state" style="text-align:center;padding:2rem;">ไม่มีรายการ</p>';

  document.getElementById('maintenanceTableContainer').innerHTML = html;
}

function openAddMaintenanceModal() {
  populateCarSelect('maintenanceCar', false);
  document.getElementById('maintenanceModalId').value  = '';
  document.getElementById('maintenanceDate').value     = todayStr();
  document.getElementById('maintenanceType').value     = 'oil';
  document.getElementById('maintenanceMileage').value  = '';
  document.getElementById('maintenanceCost').value     = '';
  document.getElementById('maintenanceNextService').value = '';
  document.getElementById('maintenanceDetail').value   = '';
  showModal('maintenanceModal');
}

function saveMaintenance() {
  const carId = document.getElementById('maintenanceCar').value;
  const date  = document.getElementById('maintenanceDate').value;
  const cost  = +document.getElementById('maintenanceCost').value || 0;
  if (!carId || !date) { showToast('กรุณาเลือกรถและวันที่', 'error'); return; }

  const data = {
    carId, date, cost,
    type:        document.getElementById('maintenanceType').value,
    mileage:     +document.getElementById('maintenanceMileage').value || null,
    nextService: +document.getElementById('maintenanceNextService').value || null,
    detail:      document.getElementById('maintenanceDetail').value.trim(),
    updatedAt:   nowISO(),
  };

  const id = document.getElementById('maintenanceModalId').value;
  let touchedCarNextService = false;
  if (id) {
    const idx = state.maintenance.findIndex(m => m.id === id);
    if (idx > -1) state.maintenance[idx] = { ...state.maintenance[idx], ...data };
  } else {
    state.maintenance.push({ id: 'm' + Date.now(), ...data });
    // Update car next service mileage
    if (data.nextService) {
      const cIdx = state.cars.findIndex(c => c.id === carId);
      if (cIdx > -1) { state.cars[cIdx].nextService = data.nextService; touch(state.cars[cIdx]); touchedCarNextService = true; }
    }
  }

  saveToStorage();
  closeModal('maintenanceModal');
  renderMaintenancePage();
  pushToSheets(touchedCarNextService ? ['maintenance', 'cars'] : ['maintenance']);
  showToast('บันทึกการซ่อมเรียบร้อย', 'success');
}

function deleteMaintenance(id) {
  if (!confirm('ต้องการลบรายการนี้?')) return;
  state.maintenance = state.maintenance.filter(m => m.id !== id);
  markDeleted('maintenance', id);
  saveToStorage();
  renderMaintenancePage();
  pushToSheets(['maintenance']);
  showToast('ลบรายการเรียบร้อย');
}

// ── Car availability search (shared by the Dashboard and the Suggest page) ──
// Finds cars that are free for [start,end), plus cars busy elsewhere but due
// back on the pickup day (same-day return queue), with the prep-time gap.
function computeAvailability({ start, startTime, end, type }) {
  if (!start || !end) return { error: 'missing' };
  const days = daysBetween(start, end);
  if (days <= 0) return { error: 'bad-range' };

  const available    = [];
  const sameDayQueue = [];

  state.cars.forEach(car => {
    if (car.status === 'maintenance') return;
    if (car.status === 'blocked')     return;
    if (type && car.type !== type)    return;

    const carBookings = state.bookings.filter(b => b.carId === car.id && b.status !== 'completed');
    const trueConflict = carBookings.some(b => b.start < end && b.end > start);
    if (trueConflict) return; // genuinely busy during the requested window — don't show

    const returningOnPickupDay = carBookings.find(b => b.end === start);
    if (returningOnPickupDay) {
      const prepMins = minutesBetween(returningOnPickupDay.end, returningOnPickupDay.endTime, start, startTime);
      sameDayQueue.push({ car, booking: returningOnPickupDay, prepMins });
    } else {
      available.push(car);
    }
  });

  sameDayQueue.sort((a, b) => (a.prepMins ?? Infinity) - (b.prepMins ?? Infinity));
  return { error: null, days, available, sameDayQueue };
}

// prefix selects which set of form field IDs the "จอง" button prefills from
// (e.g. 'suggest' → #suggestDate, 'bookSuggest' → #bookSuggestDate).
function buildAvailabilityHtml(available, sameDayQueue, days, prefix) {
  if (!available.length && !sameDayQueue.length) {
    return `<div class="section-card"><div class="modal-body"><p class="empty-state">ไม่พบรถว่างในช่วงเวลานี้</p></div></div>`;
  }

  const carCardHtml = (car, tag, extraInfo) => `
    <div class="suggest-car-card">
      <div class="suggest-car-info">
        <div class="suggest-car-plate">${car.plate} ${tag}</div>
        <div class="suggest-car-model">${car.brand || '-'} ${car.model || '-'} · ${car.color||'-'} · ปี ${car.year||'-'}</div>
        ${extraInfo || ''}
      </div>
      <div style="text-align:right;">
        <div class="suggest-rate">${(car.dailyRate || 0).toLocaleString()} ฿/วัน</div>
        <div style="font-size:.78rem;color:var(--gray-400);">รวม ${((car.dailyRate || 0)*days).toLocaleString()} ฿</div>
        <button class="btn btn-primary btn-sm" style="margin-top:.35rem;" onclick="prefillBooking('${car.id}','${prefix}')">
          <i class="fa-solid fa-plus"></i> จอง
        </button>
      </div>
    </div>`;

  const availableSection = available.length ? `
    <div class="section-card">
      <div class="section-card-header">
        <h3>รถว่าง ${available.length} คัน · ${days} วัน</h3>
      </div>
      ${available.map(car => carCardHtml(car, '<span class="pill pill-available" style="font-size:.7rem;">ว่าง</span>')).join('')}
    </div>` : '';

  const queueSection = sameDayQueue.length ? `
    <div class="section-card">
      <div class="section-card-header">
        <h3><i class="fa-solid fa-clock-rotate-left"></i> รถติดคิวคืนวันเดียวกัน ${sameDayQueue.length} คัน</h3>
      </div>
      ${sameDayQueue.map(({ car, booking, prepMins }) => carCardHtml(
        car,
        '<span class="pill pill-rented" style="font-size:.7rem;">มีคิวคืน</span>',
        `<div style="font-size:.78rem;color:var(--gray-400);margin-top:.2rem;">
           คืนจาก ${booking.customer} · ${booking.end}${booking.endTime ? ' เวลา ' + booking.endTime : ''}
         </div>
         <div style="font-size:.78rem;font-weight:700;margin-top:.15rem;color:${prepMins !== null && prepMins < 0 ? 'var(--danger)' : 'var(--maintenance)'};">
           ${formatPrepTime(prepMins)}
         </div>`
      )).join('')}
    </div>` : '';

  return availableSection + queueSection;
}

// ── Suggest Page ───────────────────────────────────────────────────────
function runSuggest() {
  const start     = document.getElementById('suggestDate').value;
  const startTime = document.getElementById('suggestTime').value;
  const end       = document.getElementById('suggestEndDate').value;
  const type      = document.getElementById('suggestType').value;
  const results   = document.getElementById('suggestResults');

  const { error, days, available, sameDayQueue } = computeAvailability({ start, startTime, end, type });
  if (error === 'missing')   { results.innerHTML = ''; return; }
  if (error === 'bad-range') { results.innerHTML = '<p class="empty-state">กรุณาเลือกวันคืนหลังวันรับรถ</p>'; return; }

  results.innerHTML = buildAvailabilityHtml(available, sameDayQueue, days, 'suggest');
}

// ── Bookings page quick search (moved here from the dashboard) ─────────
function runBookingsSearch() {
  const start     = document.getElementById('bookSuggestDate').value;
  const startTime = document.getElementById('bookSuggestTime').value;
  const end       = document.getElementById('bookSuggestEndDate').value;
  const type      = document.getElementById('bookSuggestType').value;
  const results   = document.getElementById('bookSuggestResults');
  if (!results) return;

  const { error, days, available, sameDayQueue } = computeAvailability({ start, startTime, end, type });
  if (error === 'missing')   { results.innerHTML = '<p class="empty-state">กรอกวันรับ-คืนรถเพื่อค้นหารถว่าง</p>'; return; }
  if (error === 'bad-range') { results.innerHTML = '<p class="empty-state">กรุณาเลือกวันคืนหลังวันรับรถ</p>'; return; }

  results.innerHTML = buildAvailabilityHtml(available, sameDayQueue, days, 'bookSuggest');
}

function prefillBooking(carId, prefix = 'suggest') {
  openAddBookingModal();
  document.getElementById('bookingCar').value             = carId;
  document.getElementById('bookingStart').value           = document.getElementById(`${prefix}Date`).value;
  document.getElementById('bookingStartTime').value       = document.getElementById(`${prefix}Time`).value;
  document.getElementById('bookingPickupLocation').value  = document.getElementById(`${prefix}Location`).value.trim();
  document.getElementById('bookingEnd').value             = document.getElementById(`${prefix}EndDate`).value;
  document.getElementById('bookingEndTime').value         = document.getElementById(`${prefix}EndTime`).value;
  document.getElementById('bookingReturnLocation').value  = document.getElementById(`${prefix}EndLocation`).value.trim();
  calcBookingTotal();
}

// ── Finance Page ───────────────────────────────────────────────────────
function renderFinancePage() {
  if (state.user?.role !== 'owner') return;

  // Populate filters
  const carFilter = document.getElementById('financeCarFilter');
  const selectedCar = carFilter?.value || '';
  if (carFilter && carFilter.options.length <= 1) {
    state.cars.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.plate;
      carFilter.appendChild(opt);
    });
  }

  const monthFilter = document.getElementById('financeMonthFilter');
  const selectedMonth = monthFilter?.value || '';
  const months = [...new Set([
    ...state.bookings.filter(b => b.status === 'completed').map(b => b.returnDate?.slice(0,7) || b.end.slice(0,7)),
    ...state.expenses.map(e => e.date.slice(0,7)),
    ...state.extraIncome.map(x => (x.date || '').slice(0,7)).filter(Boolean),
  ])].sort().reverse();
  if (monthFilter && monthFilter.options.length <= 1) {
    months.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = m;
      monthFilter.appendChild(opt);
    });
  }

  // Filter income (completed bookings)
  let incomeList = state.bookings.filter(b => b.status === 'completed');
  if (selectedCar) incomeList = incomeList.filter(b => b.carId === selectedCar);
  if (selectedMonth) incomeList = incomeList.filter(b => (b.returnDate||b.end).startsWith(selectedMonth));

  // Filter extra income (รายได้เสริม — counted into total income, shown tagged)
  let extraList = state.extraIncome;
  if (selectedCar)   extraList = extraList.filter(x => x.carId === selectedCar);
  if (selectedMonth) extraList = extraList.filter(x => (x.date || '').startsWith(selectedMonth));

  // Filter expenses
  let expenseList = [...state.expenses, ...state.maintenance.map(m => ({ ...m, expenseType: 'maintenance', amount: m.cost, isMaintenance: true }))];
  if (selectedCar)   expenseList = expenseList.filter(e => e.carId === selectedCar);
  if (selectedMonth) expenseList = expenseList.filter(e => e.date.startsWith(selectedMonth));

  const rentalIncome = incomeList.reduce((s,b) => s + (b.finalTotal || b.total || 0), 0);
  const extraIncome  = extraList.reduce((s,x) => s + (x.amount || 0), 0);
  const totalIncome  = rentalIncome + extraIncome;
  const totalExpense = expenseList.reduce((s,e) => s + (e.amount || e.cost || 0), 0);
  const net = totalIncome - totalExpense;

  document.getElementById('financeSummaryCards').innerHTML = `
    <div class="stat-card stat-available">
      <div class="stat-icon"><i class="fa-solid fa-arrow-trend-up"></i></div>
      <div class="stat-info">
        <div class="stat-num">${totalIncome.toLocaleString()}</div>
        <div class="stat-label">รายรับ (฿)</div>
        ${extraIncome ? `<div class="stat-sub">ค่าเช่า ${rentalIncome.toLocaleString()} · เสริม ${extraIncome.toLocaleString()}</div>` : ''}
      </div>
    </div>
    <div class="stat-card stat-maintenance">
      <div class="stat-icon"><i class="fa-solid fa-arrow-trend-down"></i></div>
      <div class="stat-info"><div class="stat-num">${totalExpense.toLocaleString()}</div><div class="stat-label">รายจ่าย (฿)</div></div>
    </div>
    <div class="stat-card ${net >= 0 ? 'stat-rented' : 'stat-total'}">
      <div class="stat-icon"><i class="fa-solid fa-coins"></i></div>
      <div class="stat-info"><div class="stat-num">${net.toLocaleString()}</div><div class="stat-label">กำไรสุทธิ (฿)</div></div>
    </div>
  `;

  // Combined table
  const rows = [
    ...incomeList.map(b => {
      const car = getCarById(b.carId);
      return { date: b.returnDate||b.end, label: `เช่ารถ ${car ? car.plate : '-'} (${b.customer})`, income: b.finalTotal||b.total||0, expense: 0 };
    }),
    ...extraList.map(x => {
      const car = getCarById(x.carId);
      const typeLabel = INCOME_TYPE_LABEL[x.incomeType] || x.incomeType || 'รายได้เสริม';
      return {
        date: x.date,
        label: `${EXTRA_INCOME_TAG} ${typeLabel}${car ? ' ' + car.plate : ''}${x.detail ? ` <span style="color:var(--gray-500);font-size:.8rem;">· ${x.detail}</span>` : ''}`,
        income: x.amount || 0, expense: 0, id: x.id, isExtra: true,
      };
    }),
    ...expenseList.map(e => {
      const car = getCarById(e.carId);
      const typeLabel = EXPENSE_TYPE_LABEL[e.expenseType] || e.expenseType || e.type || 'รายจ่าย';
      return {
        date: e.date, label: `${typeLabel} ${car ? car.plate : ''}`, income: 0, expense: e.amount||e.cost||0,
        id: e.id, isMaintenance: !!e.isMaintenance,
      };
    }),
  ].sort((a,b) => b.date.localeCompare(a.date));

  document.getElementById('financeTableContainer').innerHTML = rows.length ? `
    <div class="table-wrap" style="margin-top:1rem;">
      <table class="data-table">
        <thead>
          <tr><th>วันที่</th><th>รายการ</th><th>รายรับ</th><th>รายจ่าย</th><th>จัดการ</th></tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${r.date}</td>
              <td>${r.label}</td>
              <td class="finance-income">${r.income ? r.income.toLocaleString()+' ฿' : '-'}</td>
              <td class="finance-expense">${r.expense ? r.expense.toLocaleString()+' ฿' : '-'}</td>
              <td>${!r.id ? '' : r.isMaintenance ? `
                <button class="btn btn-sm btn-danger btn-icon" onclick="deleteMaintenance('${r.id}')" title="ลบ (จัดการรายละเอียดที่หน้าซ่อมบำรุง)"><i class="fa-solid fa-trash"></i></button>
              ` : r.isExtra ? `
                <button class="btn btn-sm btn-secondary btn-icon" onclick="openEditExtraIncomeModal('${r.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-danger btn-icon" onclick="deleteExtraIncome('${r.id}')"><i class="fa-solid fa-trash"></i></button>
              ` : `
                <button class="btn btn-sm btn-secondary btn-icon" onclick="openEditExpenseModal('${r.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-danger btn-icon" onclick="deleteExpense('${r.id}')"><i class="fa-solid fa-trash"></i></button>
              `}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '<p class="empty-state" style="text-align:center;padding:2rem;">ไม่มีรายการ</p>';
}

function openAddExpenseModal() {
  populateCarSelect('expenseCar', false);
  document.getElementById('expenseModalTitle').textContent = 'บันทึกรายจ่าย';
  document.getElementById('expenseModalId').value = '';
  document.getElementById('expenseDate').value    = todayStr();
  document.getElementById('expenseType').value    = 'insurance';
  document.getElementById('expenseAmount').value  = '';
  document.getElementById('expenseDetail').value  = '';
  showModal('expenseModal');
}

function openEditExpenseModal(id) {
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  populateCarSelect('expenseCar', false);
  document.getElementById('expenseModalTitle').textContent = 'แก้ไขรายจ่าย';
  document.getElementById('expenseModalId').value = e.id;
  document.getElementById('expenseCar').value     = e.carId;
  document.getElementById('expenseDate').value    = e.date;
  document.getElementById('expenseType').value    = e.expenseType;
  document.getElementById('expenseAmount').value  = e.amount;
  document.getElementById('expenseDetail').value  = e.detail || '';
  showModal('expenseModal');
}

function deleteExpense(id) {
  if (!confirm('ต้องการลบรายการนี้?')) return;
  state.expenses = state.expenses.filter(e => e.id !== id);
  markDeleted('expenses', id);
  saveToStorage();
  renderFinancePage();
  pushToSheets(['expenses']);
  showToast('ลบรายการเรียบร้อย');
}

function saveExpense() {
  const carId  = document.getElementById('expenseCar').value;
  const date   = document.getElementById('expenseDate').value;
  const amount = +document.getElementById('expenseAmount').value || 0;
  if (!carId || !date || !amount) { showToast('กรุณากรอกข้อมูลที่จำเป็น', 'error'); return; }

  const data = {
    carId, date, amount,
    expenseType: document.getElementById('expenseType').value,
    detail:      document.getElementById('expenseDetail').value.trim(),
    updatedAt:   nowISO(),
  };

  const id = document.getElementById('expenseModalId').value;
  if (id) {
    const idx = state.expenses.findIndex(e => e.id === id);
    if (idx > -1) state.expenses[idx] = { ...state.expenses[idx], ...data };
  } else {
    state.expenses.push({ id: 'e' + Date.now(), ...data });
  }

  saveToStorage();
  closeModal('expenseModal');
  renderFinancePage();
  pushToSheets(['expenses']);
  showToast('บันทึกรายจ่ายเรียบร้อย', 'success');
}

// ── Extra income (รายได้เสริม) ─────────────────────────────────────────
// Counted into total income on the finance page but kept as its own
// collection/sheet so each entry stays visibly tagged as side income.

function openAddExtraIncomeModal() {
  populateCarSelect('extraIncomeCar', false);
  document.getElementById('extraIncomeCar').options[0].textContent = '— ไม่ระบุรถ —';
  document.getElementById('extraIncomeModalTitle').textContent = 'บันทึกรายได้เสริม';
  document.getElementById('extraIncomeModalId').value = '';
  document.getElementById('extraIncomeType').value    = 'carwash';
  document.getElementById('extraIncomeAmount').value  = '';
  document.getElementById('extraIncomeDate').value    = todayStr();
  document.getElementById('extraIncomeDetail').value  = '';
  showModal('extraIncomeModal');
}

function openEditExtraIncomeModal(id) {
  const x = state.extraIncome.find(r => r.id === id);
  if (!x) return;
  populateCarSelect('extraIncomeCar', false);
  document.getElementById('extraIncomeCar').options[0].textContent = '— ไม่ระบุรถ —';
  document.getElementById('extraIncomeModalTitle').textContent = 'แก้ไขรายได้เสริม';
  document.getElementById('extraIncomeModalId').value = x.id;
  document.getElementById('extraIncomeType').value    = x.incomeType || 'other';
  document.getElementById('extraIncomeAmount').value  = x.amount;
  document.getElementById('extraIncomeDate').value    = x.date;
  document.getElementById('extraIncomeCar').value     = x.carId || '';
  document.getElementById('extraIncomeDetail').value  = x.detail || '';
  showModal('extraIncomeModal');
}

function deleteExtraIncome(id) {
  if (!confirm('ต้องการลบรายการนี้?')) return;
  state.extraIncome = state.extraIncome.filter(x => x.id !== id);
  markDeleted('extraIncome', id);
  saveToStorage();
  renderFinancePage();
  pushToSheets(['extraIncome']);
  showToast('ลบรายการเรียบร้อย');
}

function saveExtraIncome() {
  const date   = document.getElementById('extraIncomeDate').value;
  const amount = +document.getElementById('extraIncomeAmount').value || 0;
  if (!date || !amount) { showToast('กรุณากรอกวันที่และจำนวนเงิน', 'error'); return; }

  const data = {
    carId:      document.getElementById('extraIncomeCar').value || null,
    date, amount,
    incomeType: document.getElementById('extraIncomeType').value,
    detail:     document.getElementById('extraIncomeDetail').value.trim(),
    updatedAt:  nowISO(),
  };

  const id = document.getElementById('extraIncomeModalId').value;
  if (id) {
    const idx = state.extraIncome.findIndex(x => x.id === id);
    if (idx > -1) state.extraIncome[idx] = { ...state.extraIncome[idx], ...data };
  } else {
    state.extraIncome.push({ id: 'x' + Date.now(), ...data });
  }

  saveToStorage();
  closeModal('extraIncomeModal');
  renderFinancePage();
  pushToSheets(['extraIncome']);
  showToast('บันทึกรายได้เสริมเรียบร้อย', 'success');
}

// ── Block / Unblock Car ────────────────────────────────────────────────

function openBlockCarModal(id) {
  const car = getCarById(id);
  if (!car) return;
  document.getElementById('blockCarId').value = id;
  document.getElementById('blockUntil').value  = '';
  document.getElementById('blockReason').value = '';
  document.getElementById('blockCarInfo').innerHTML =
    `<i class="fa-solid fa-lock"></i> <strong>${car.plate}</strong> — ${car.brand || '-'} ${car.model || '-'} (${car.color || ''})`;
  showModal('blockCarModal');
}

function saveBlockCar() {
  const id     = document.getElementById('blockCarId').value;
  const until  = document.getElementById('blockUntil').value;
  const reason = document.getElementById('blockReason').value.trim();
  const idx    = state.cars.findIndex(c => c.id === id);
  if (idx < 0) return;
  state.cars[idx].status       = 'blocked';
  state.cars[idx].blockedUntil = until || null;
  state.cars[idx].blockedReason = reason || null;
  touch(state.cars[idx]);
  saveToStorage();
  closeModal('blockCarModal');
  renderCarsPage();
  renderDashboard();
  pushToSheets(['cars']);
  const car = state.cars[idx];
  showToast(`ปิดตา ${car.plate} เรียบร้อย${until ? ' ถึง ' + until : ''}`, 'success');
}

function unblockCar(id) {
  const idx = state.cars.findIndex(c => c.id === id);
  if (idx < 0) return;
  state.cars[idx].status        = 'available';
  state.cars[idx].blockedUntil  = null;
  state.cars[idx].blockedReason = null;
  touch(state.cars[idx]);
  saveToStorage();
  renderCarsPage();
  renderDashboard();
  pushToSheets(['cars']);
  showToast(`เปิดตา ${state.cars[idx].plate} เรียบร้อย — สถานะ: ว่าง`, 'success');
}

// ── Customers Page ─────────────────────────────────────────────────────

const TAG_LABEL = { vip: 'VIP', regular: 'ลูกค้าประจำ', new: 'ลูกค้าใหม่', '': '' };
const TAG_COLOR = {
  vip:     { bg: 'rgba(250,204,21,0.15)', color: '#facc15', shadow: 'rgba(250,204,21,0.4)' },
  regular: { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa', shadow: 'rgba(96,165,250,0.4)' },
  new:     { bg: 'rgba(52,211,153,0.15)', color: '#34d399', shadow: 'rgba(52,211,153,0.4)' },
};

function buildCustomerList() {
  const map = {};
  state.bookings.forEach(b => {
    const key = (b.customer || '').trim() + '||' + (b.phone || '').trim();
    if (!map[key]) {
      map[key] = {
        key,
        name:     (b.customer || '').trim(),
        phone:    (b.phone || '').trim() || '-',
        bookings: [],
        totalSpent: 0,
        lastDate: '',
      };
    }
    map[key].bookings.push(b);
    if (b.status === 'completed') {
      map[key].totalSpent += (b.finalTotal || b.total || 0);
    }
    const date = b.returnDate || b.end || '';
    if (date > map[key].lastDate) map[key].lastDate = date;
  });
  return Object.values(map).sort((a, b) => b.bookings.length - a.bookings.length);
}

function renderCustomersPage() {
  const q       = (document.getElementById('customerSearch')?.value || '').toLowerCase();
  const tagFilter = document.getElementById('customerTagFilter')?.value || '';

  let customers = buildCustomerList().filter(c => {
    const matchQ   = !q || c.name.toLowerCase().includes(q) || c.phone.includes(q);
    const tag      = state.customerTags[c.key] || '';
    const matchTag = !tagFilter || tag === tagFilter;
    return matchQ && matchTag;
  });

  document.getElementById('customersCount').textContent = `${customers.length} ราย`;

  if (!customers.length) {
    document.getElementById('customersTableContainer').innerHTML =
      '<p class="empty-state" style="text-align:center;padding:2rem;">ไม่พบลูกค้า</p>';
    return;
  }

  const html = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>ลูกค้า</th>
            <th>เบอร์โทร</th>
            <th>จำนวนครั้ง</th>
            <th>ยอดรวม</th>
            <th>เช่าล่าสุด</th>
            <th>แท็ก</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${customers.map(c => {
            const tag = state.customerTags[c.key] || '';
            const tc  = TAG_COLOR[tag];
            const tagHtml = tag
              ? `<span class="pill" style="background:${tc.bg};color:${tc.color};box-shadow:0 0 8px ${tc.shadow};">${TAG_LABEL[tag]}</span>`
              : `<span style="color:var(--gray-400);font-size:.78rem;">-</span>`;
            return `
              <tr class="row-clickable" onclick="openCustomerDetail('${encodeKey(c.key)}')">
                <td><strong>${c.name}</strong></td>
                <td>${telLink(c.phone)}</td>
                <td><strong style="color:var(--primary);text-shadow:0 0 8px var(--glow-primary-sm);">${c.bookings.length}</strong> ครั้ง</td>
                <td><strong>${c.totalSpent.toLocaleString()} ฿</strong></td>
                <td>${c.lastDate || '-'}</td>
                <td>${tagHtml}</td>
                <td>
                  <div class="actions">
                    <button class="btn btn-sm btn-outline btn-icon" onclick="event.stopPropagation(); openCustomerDetail('${encodeKey(c.key)}')" title="ดูประวัติ">
                      <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-primary btn-icon" onclick="event.stopPropagation(); prefillBookingForCustomer('${encodeKey(c.key)}')" title="จองให้ลูกค้านี้">
                      <i class="fa-solid fa-plus"></i>
                    </button>
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  document.getElementById('customersTableContainer').innerHTML = html;
}

function encodeKey(key) { return encodeURIComponent(key); }
function decodeKey(key) { return decodeURIComponent(key); }

function openCustomerDetail(encodedKey) {
  const key = decodeKey(encodedKey);
  const customers = buildCustomerList();
  const c = customers.find(x => x.key === key);
  if (!c) return;

  const tag = state.customerTags[key] || '';
  const tc  = TAG_COLOR[tag];
  const tagHtml = tag
    ? `<span class="pill" style="background:${tc.bg};color:${tc.color};box-shadow:0 0 8px ${tc.shadow};">${TAG_LABEL[tag]}</span>`
    : '';

  const completed  = c.bookings.filter(b => b.status === 'completed');
  const active     = c.bookings.filter(b => b.status === 'active');
  const upcoming   = c.bookings.filter(b => b.status === 'upcoming');
  const avgSpend   = completed.length ? Math.round(c.totalSpent / completed.length) : 0;

  // Most rented car
  const carCount = {};
  c.bookings.forEach(b => { carCount[b.carId] = (carCount[b.carId] || 0) + 1; });
  const favCarId = Object.entries(carCount).sort((a,b) => b[1]-a[1])[0]?.[0];
  const favCar   = favCarId ? getCarById(favCarId) : null;

  document.getElementById('customerModalTitle').innerHTML =
    `<i class="fa-solid fa-user"></i> ${c.name} ${tagHtml}`;

  document.getElementById('customerModalBody').innerHTML = `
    <!-- Stats row -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:.75rem;margin-bottom:1.25rem;">
      <div style="background:rgba(250,204,21,0.08);border:1px solid rgba(250,204,21,0.15);border-radius:var(--radius-sm);padding:.85rem;text-align:center;">
        <div style="font-size:1.5rem;font-weight:700;color:var(--primary);text-shadow:0 0 10px var(--glow-primary);">${c.bookings.length}</div>
        <div style="font-size:.75rem;color:var(--gray-500);margin-top:.15rem;">ครั้งทั้งหมด</div>
      </div>
      <div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.15);border-radius:var(--radius-sm);padding:.85rem;text-align:center;">
        <div style="font-size:1.5rem;font-weight:700;color:var(--available);text-shadow:0 0 10px var(--available-glow);">${c.totalSpent.toLocaleString()}</div>
        <div style="font-size:.75rem;color:var(--gray-500);margin-top:.15rem;">ยอดรวม (฿)</div>
      </div>
      <div style="background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.15);border-radius:var(--radius-sm);padding:.85rem;text-align:center;">
        <div style="font-size:1.5rem;font-weight:700;color:var(--rented);text-shadow:0 0 10px var(--rented-glow);">${avgSpend.toLocaleString()}</div>
        <div style="font-size:.75rem;color:var(--gray-500);margin-top:.15rem;">เฉลี่ย/ครั้ง (฿)</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-sm);padding:.85rem;text-align:center;">
        <div style="font-size:.95rem;font-weight:700;color:var(--gray-800);">${favCar ? favCar.brand + ' ' + favCar.model : '-'}</div>
        <div style="font-size:.75rem;color:var(--gray-500);margin-top:.15rem;">รถที่เช่าบ่อย</div>
      </div>
    </div>

    <!-- Info row -->
    <div style="display:flex;gap:1rem;flex-wrap:wrap;font-size:.85rem;margin-bottom:1rem;padding:.75rem;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);border:1px solid rgba(255,255,255,0.06);">
      <div>${telLink(c.phone)}</div>
      <div><i class="fa-solid fa-calendar" style="color:var(--gray-500);width:16px;"></i> เช่าล่าสุด: <strong>${c.lastDate || '-'}</strong></div>
      ${active.length ? `<div><i class="fa-solid fa-road" style="color:var(--rented);width:16px;"></i> <span style="color:var(--rented);">กำลังเช่าอยู่ ${active.length} รายการ</span></div>` : ''}
      ${upcoming.length ? `<div><i class="fa-solid fa-clock" style="color:var(--maintenance);width:16px;"></i> <span style="color:var(--maintenance);">กำลังจะถึง ${upcoming.length} รายการ</span></div>` : ''}
    </div>

    <!-- Tag selector -->
    <div style="margin-bottom:1rem;">
      <div style="font-size:.82rem;font-weight:600;color:var(--gray-600);margin-bottom:.4rem;">แท็กลูกค้า</div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
        ${['', 'new', 'regular', 'vip'].map(t => {
          const active = (state.customerTags[key] || '') === t;
          const tc = TAG_COLOR[t];
          return `<button onclick="setCustomerTag('${encodeKey(key)}','${t}')"
            class="btn btn-sm"
            style="${active
              ? `background:${tc ? tc.bg : 'rgba(255,255,255,0.1)'};color:${tc ? tc.color : 'var(--gray-600)'};border:1px solid ${tc ? tc.color : 'rgba(255,255,255,0.2)'};box-shadow:0 0 10px ${tc ? tc.shadow : 'transparent'};`
              : 'background:rgba(255,255,255,0.04);color:var(--gray-500);border:1px solid rgba(255,255,255,0.08);'}"
          >${t ? TAG_LABEL[t] : 'ไม่มีแท็ก'}</button>`;
        }).join('')}
      </div>
    </div>

    <!-- Booking history -->
    <div style="font-size:.85rem;font-weight:600;color:var(--gray-600);margin-bottom:.5rem;">ประวัติการเช่า</div>
    ${c.bookings.length ? `
    <div class="table-wrap">
      <table class="data-table" style="font-size:.82rem;">
        <thead><tr><th>รถ</th><th>วันรับ</th><th>วันคืน</th><th>ยอด</th><th>สถานะ</th></tr></thead>
        <tbody>
          ${[...c.bookings].sort((a,b) => b.start.localeCompare(a.start)).map(b => {
            const car = getCarById(b.carId);
            const amount = b.status === 'completed' ? (b.finalTotal || b.total || 0) : (b.total || 0);
            const pill = { active:'rented', upcoming:'upcoming', completed:'completed' }[b.status] || 'completed';
            const label = { active:'กำลังเช่า', upcoming:'กำลังจะถึง', completed:'คืนแล้ว' }[b.status] || b.status;
            return `<tr>
              <td>${car ? car.plate : '-'}<br><span style="color:var(--gray-400);font-size:.75rem;">${car ? car.brand+' '+car.model : ''}</span></td>
              <td>${b.start}</td>
              <td>${b.returnDate || b.end}</td>
              <td><strong>${amount.toLocaleString()} ฿</strong></td>
              <td><span class="pill pill-${pill}">${label}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : '<p class="empty-state">ไม่มีประวัติ</p>'}
  `;

  document.getElementById('customerBookBtn').onclick = () => {
    closeModal('customerModal');
    prefillBookingForCustomer(encodedKey);
  };

  showModal('customerModal');
}

function setCustomerTag(encodedKey, tag) {
  const key = decodeKey(encodedKey);
  if (tag === '') {
    delete state.customerTags[key];
  } else {
    state.customerTags[key] = tag;
  }
  saveToStorage();
  // Re-render modal body with updated tag
  openCustomerDetail(encodedKey);
  renderCustomersPage();
  showToast(tag ? `แท็ก "${TAG_LABEL[tag]}" บันทึกแล้ว` : 'ลบแท็กแล้ว', 'success');
}

function prefillBookingForCustomer(encodedKey) {
  const key = decodeKey(encodedKey);
  const [name, phone] = key.split('||');
  openAddBookingModal();
  document.getElementById('bookingCustomer').value = name || '';
  document.getElementById('bookingPhone').value    = phone || '';
}

// ── Google Sheets Sync ─────────────────────────────────────────────────
function openSettingsModal() {
  document.getElementById('settingsUrl').value = state.sheetsUrl || '';
  document.getElementById('testResult').textContent = '';
  showModal('settingsModal');
}

function saveSettings() {
  state.sheetsUrl = document.getElementById('settingsUrl').value.trim();
  localStorage.setItem('sheetsUrl', state.sheetsUrl);
  closeModal('settingsModal');
  if (state.sheetsUrl) {
    syncNow();
    startSheetsPolling();
    showToast('บันทึกการตั้งค่าเรียบร้อย กำลัง sync...', 'success');
  } else {
    stopSheetsPolling();
    showToast('ปิดการ sync กับ Google Sheets');
  }
}

async function testSheetsConnection() {
  const url = document.getElementById('settingsUrl').value.trim();
  const el  = document.getElementById('testResult');
  if (!url) { el.textContent = '⚠️ กรุณากรอก URL ก่อน'; el.style.color = 'var(--maintenance)'; return; }
  el.textContent = 'กำลังทดสอบ...'; el.style.color = 'var(--gray-500)';
  try {
    const res = await fetch(url + '?action=ping', { redirect: 'follow' });
    const json = await res.json();
    if (json.status === 'ok') { el.textContent = '✅ เชื่อมต่อสำเร็จ'; el.style.color = 'var(--success)'; }
    else                      { el.textContent = '⚠️ ตอบกลับแต่ไม่ถูกต้อง'; el.style.color = 'var(--maintenance)'; }
  } catch {
    el.textContent = '❌ เชื่อมต่อไม่ได้'; el.style.color = 'var(--danger)';
  }
}

// โหลดข้อมูลจาก Sheets ตอนเปิดแอป (silent = true สำหรับ auto-refresh พื้นหลัง ไม่ขึ้น toast รบกวน)
async function loadFromSheets(silent = false) {
  if (!state.sheetsUrl) return;
  if (!silent) setSyncStatus('syncing');
  try {
    const res  = await fetch(state.sheetsUrl);
    const json = await res.json();
    if (json.status === 'ok' && json.data) {
      const d = json.data;
      // Record-level merge, NOT blind replace. Empty collections in the sheet
      // no longer silently keep stale local rows, and a row freshly edited in
      // the sheet (newer updatedAt) wins over the local copy instead of the
      // whole collection being clobbered one way or the other.
      mergeTombstones(d.tombstones);
      state.cars        = mergeById(state.cars,        d.cars,        'cars');
      state.bookings    = mergeById(state.bookings,    d.bookings,    'bookings');
      state.maintenance = mergeById(state.maintenance, d.maintenance, 'maintenance');
      state.expenses    = mergeById(state.expenses,    d.expenses,    'expenses');
      state.extraIncome = mergeById(state.extraIncome, d.extraIncome, 'extraIncome');
      if (d.catalog?.length) {
        state.catalog = buildVehicleCatalog(d.catalog);
        localStorage.setItem('vehicleCatalog', JSON.stringify(state.catalog));
      }
      state.loadedFromSheets = true;
      saveToStorage();
      renderCurrentPage();
      setSyncStatus('on');
      if (!silent) showToast('โหลดข้อมูลจาก Google Sheets เรียบร้อย ✅', 'success');
    } else {
      // We got a response but not a valid data payload. Treat it as an ERROR,
      // never as "the sheet is empty" — the old code pushed local data up here,
      // which is exactly how a transient read glitch overwrote the sheet with
      // an old snapshot. Just surface the error and leave the sheet untouched.
      setSyncStatus('error');
      if (!silent) showToast('อ่านข้อมูลจาก Sheets ไม่ได้ (ตอบกลับไม่ถูกต้อง)', 'error');
    }
  } catch {
    setSyncStatus('error');
    if (!silent) showToast('โหลดข้อมูลจาก Sheets ไม่ได้ ใช้ข้อมูล local แทน', '');
  }
}

// Auto-refresh: ดึงข้อมูลจาก Sheets ทุก 15 วินาที เผื่อมีคนแก้ข้อมูลตรงในชีต
let sheetsPollTimer = null;
function startSheetsPolling() {
  stopSheetsPolling();
  if (!state.sheetsUrl) return;
  sheetsPollTimer = setInterval(() => {
    if (!state.sheetsUrl || state.syncing) return;
    // Unsynced local changes pending (offline entry)? Do a full sync so they
    // reach the sheet; otherwise just pull.
    if (localStorage.getItem('pendingPush')) syncNow();
    else loadFromSheets(true);
  }, 15000);
}
function stopSheetsPolling() {
  if (sheetsPollTimer) clearInterval(sheetsPollTimer);
  sheetsPollTimer = null;
}

// Push ข้อมูลไปยัง Sheets แบบปลอดภัย: ดึงข้อมูลล่าสุดจาก Sheet มา merge ทีละ
// record ก่อนเสมอ (เทียบ updatedAt เก็บอันที่ใหม่กว่า) แล้วจึงค่อย push กลับ
// ถ้าดึงข้อมูลก่อน push ไม่สำเร็จ จะ "ไม่ push" เด็ดขาด เพื่อกันไม่ให้ข้อมูล
// เวอร์ชั่นเก่าในเครื่องเขียนทับข้อมูลที่เพิ่งแก้ในชีต
async function syncNow() {
  if (!state.sheetsUrl || state.syncing) return;
  state.syncing = true;
  setSyncStatus('syncing');

  // 1) Always pull first and MERGE record-by-record. Because merge keeps the
  //    newest version of every individual row, we no longer need to guess which
  //    collections "changed" — a fresh Sheet edit survives, a fresh app edit
  //    survives, and neither clobbers the other wholesale.
  let pulledOk = false;
  try {
    const pullRes  = await fetch(state.sheetsUrl);
    const pullJson = await pullRes.json();
    if (pullJson.status === 'ok' && pullJson.data) {
      const d = pullJson.data;
      mergeTombstones(d.tombstones);
      state.cars        = mergeById(state.cars,        d.cars,        'cars');
      state.bookings    = mergeById(state.bookings,    d.bookings,    'bookings');
      state.maintenance = mergeById(state.maintenance, d.maintenance, 'maintenance');
      state.expenses    = mergeById(state.expenses,    d.expenses,    'expenses');
      state.extraIncome = mergeById(state.extraIncome, d.extraIncome, 'extraIncome');
      state.loadedFromSheets = true;
      pulledOk = true;
      saveToStorage();
      renderCurrentPage();
    }
  } catch {
    // fall through to the guard below
  }

  // 2) NEVER push a snapshot we couldn't reconcile against the live sheet.
  //    If the pre-push read failed, pushing local data blindly is precisely the
  //    "old version overwrites new" bug — so we bail out and just report error.
  if (!pulledOk) {
    setSyncStatus('error');
    state.syncing = false;
    return;
  }

  try {
    const payload = {
      cars:        state.cars,
      bookings:    state.bookings,
      maintenance: state.maintenance,
      expenses:    state.expenses,
      extraIncome: state.extraIncome,
      tombstones:  state.tombstones,
    };
    const res  = await fetch(state.sheetsUrl, {
      method: 'POST',
      body:   JSON.stringify(payload),
      // No Content-Type header = avoids CORS preflight with Google Apps Script
    });
    const json = await res.json();
    if (json.status === 'ok') {
      // Everything local is now on the sheet — nothing pending anymore.
      localStorage.removeItem('pendingPush');
      setSyncStatus('on');
    } else {
      setSyncStatus('error');
    }
  } catch {
    setSyncStatus('error');
  }
  state.syncing = false;
}

// changedCollections is no longer needed (merge handles every collection), but
// the param is kept so existing call sites don't have to change.
function pushToSheets(_changedCollections) {
  // Persist "there are unsynced local changes" BEFORE trying to sync: if the
  // device is offline the attempt fails silently, and this flag is what makes
  // the data push itself later — on reconnect ('online' event), on the next
  // 15s poll tick, or on the next app start. Cleared only by a successful push.
  localStorage.setItem('pendingPush', '1');
  if (state.sheetsUrl) syncNow();
}

// The moment connectivity returns, push any offline-entered data up instead
// of waiting for the user's next action.
window.addEventListener('online', () => {
  if (state.sheetsUrl && localStorage.getItem('pendingPush')) syncNow();
});

function refreshApp() {
  if (!state.sheetsUrl) {
    renderDashboard();
    showToast('รีเฟรชเรียบร้อย', 'success');
    return;
  }
  loadFromSheets();
}

function setSyncStatus(s) {
  let cls, html;
  if (s === 'on')       { cls = 'sync-on';    html = '<i class="fa-solid fa-circle"></i> ออนไลน์'; }
  else if (s === 'off') { cls = 'sync-off';   html = '<i class="fa-solid fa-circle"></i> ออฟไลน์'; }
  else if (s === 'syncing') { cls = 'sync-off'; html = '<i class="fa-solid fa-rotate fa-spin"></i> sync...'; }
  else                  { cls = 'sync-error'; html = '<i class="fa-solid fa-circle-exclamation"></i> ผิดพลาด'; }

  ['syncStatus', 'syncStatusDesk'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'sync-badge ' + cls;
    el.style.cssText = 'border:none;background:none;font-family:inherit;cursor:pointer;';
    el.innerHTML = html;
  });
}

// ── Helpers ────────────────────────────────────────────────────────────
function getCarById(id) { return state.cars.find(c => c.id === id); }

const TYPE_LABEL = {
  sedan: 'Sedan', hatchback: 'Hatchback', suv: 'SUV', mpv: 'MPV', ppv: 'PPV',
  van: 'รถตู้', pickup: 'กระบะ', ev: 'EV', motorcycle: 'มอเตอร์ไซค์',
};
const EXPENSE_TYPE_LABEL = {
  insurance: 'ประกันภัย', tax: 'ภาษีรถ', fuel: 'น้ำมัน',
  maintenance: 'ซ่อมบำรุง', cleaning: 'ทำความสะอาด', other: 'อื่นๆ',
};
const INCOME_TYPE_LABEL = {
  carwash: 'ล้างรถ', fluid: 'เปลี่ยนของเหลวรถยนต์', queue: 'ส่งต่อคิวรถ', other: 'อื่นๆ',
};
// Small pill prefixed to finance-table rows so side income is never mistaken
// for rental income even though both count into the same total.
const EXTRA_INCOME_TAG = '<span style="display:inline-block;font-size:.68rem;font-weight:700;padding:.05rem .45rem;border-radius:999px;background:rgba(164,249,53,0.14);color:#a4f935;">เสริม</span>';
// Renders a phone number as a tel: link so tapping it opens the phone app
// ready to dial. stopPropagation keeps the tap from also triggering the
// clickable row/card the number usually sits inside.
function telLink(phone) {
  if (!phone) return '-';
  const digits = String(phone).replace(/[^\d+]/g, '');
  if (!digits) return phone;
  return `<a href="tel:${digits}" class="tel-link" onclick="event.stopPropagation()"><i class="fa-solid fa-phone"></i> ${phone}</a>`;
}

// Renders a pickup/return location as a Google-Maps navigation link.
// Accepts either a pasted Maps URL (used as-is; leftover text becomes the
// label) or a plain place name (turned into a Maps search so it still
// navigates). stopPropagation keeps clickable rows from also firing.
function mapLink(loc) {
  if (!loc) return '-';
  const urlMatch = String(loc).match(/https?:\/\/\S+/);
  const url   = urlMatch ? urlMatch[0] : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`;
  const label = urlMatch ? (String(loc).replace(urlMatch[0], '').trim() || 'นำทาง') : loc;
  return `<a href="${url}" target="_blank" rel="noopener" class="map-link" onclick="event.stopPropagation()"><i class="fa-solid fa-location-dot"></i> ${label}</a>`;
}

function vehicleTypeIcon(type, color) {
  const hex = color && CAR_COLOR_HEX[color];
  // Dark car colors (black, brown, navy, ...) would otherwise vanish against
  // the icon's own dark circle background, so give colored icons a faint
  // light halo — invisible on the default gray/orange icons.
  const glow = hex ? 'filter:drop-shadow(0 0 1px rgba(255,255,255,.6));' : '';
  return type === 'motorcycle'
    ? `<i class="fa-solid fa-motorcycle" style="color:${hex || 'var(--accent)'};${glow}" title="มอเตอร์ไซค์"></i>`
    : `<i class="fa-solid fa-car" style="color:${hex || 'var(--gray-400)'};${glow}" title="รถยนต์"></i>`;
}

function updateCarStatus(carId, status) {
  const idx = state.cars.findIndex(c => c.id === carId);
  if (idx > -1) { state.cars[idx].status = status; touch(state.cars[idx]); }
}

function populateCarSelect(selectId, availableOnly) {
  const el = document.getElementById(selectId);
  el.innerHTML = '<option value="">— เลือกรถ —</option>';
  state.cars
    .filter(c => !availableOnly || (c.status !== 'rented' && c.status !== 'blocked'))
    .forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.type === 'motorcycle' ? '🏍️ ' : ''}${c.plate} · ${c.brand} ${c.model}`;
      el.appendChild(opt);
    });
}

function todayStr() { return new Date().toISOString().slice(0,10); }

function daysBetween(start, end) {
  const a = new Date(start);
  const b = new Date(end);
  return Math.round((b - a) / 86400000);
}

// Minutes from (date1,time1) to (date2,time2). Returns null if either time is missing.
function minutesBetween(date1, time1, date2, time2) {
  if (!time1 || !time2) return null;
  const a = new Date(`${date1}T${time1}:00`);
  const b = new Date(`${date2}T${time2}:00`);
  return Math.round((b - a) / 60000);
}

function formatPrepTime(mins) {
  if (mins === null) return 'ไม่ทราบเวลาคืนที่แน่นอน';
  if (mins < 0) return `ช้ากว่ากำหนด ${Math.abs(mins)} นาที (คืนหลังลูกค้าใหม่มารับรถ)`;
  if (mins === 0) return 'มีเวลาเตรียมรถ 0 นาที (คืน-รับต่อกันพอดี)';
  if (mins < 60) return `มีเวลาเตรียมรถ ${mins} นาที`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return `มีเวลาเตรียมรถ ${h} ชม.${m ? ' ' + m + ' นาที' : ''}`;
}

function formatDateThai(d) {
  const DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];
  const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// ── Custom date/time pickers ────────────────────────────────────────────
// Native <input type="date"/"time"> popups are OS-rendered and can't be
// restyled with CSS, so every date/time field is made read-only and wired
// to one shared, theme-matching popup instead (value + change event stay
// identical, so all existing onchange handlers keep working untouched).
const PICKER_DOW   = ['อา','จ','อ','พ','พฤ','ศ','ส'];
const PICKER_MONTH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const PICKER_MINUTES = ['00', '15', '30', '45'];

let pickerActiveInput = null;
let pickerViewDate    = new Date();
let pickerTempTime    = { h: '00', m: '00' };
// When a picker was opened — the tap that opens it can itself fire
// scroll/resize on mobile (focus scroll-into-view, keyboard dismissing),
// which must not instantly close what the user just opened.
let pickerOpenedAt    = 0;

function initCustomPickers() {
  // Convert every date/time input to a plain readonly text field driven
  // solely by the custom popups. readOnly alone is NOT enough on mobile:
  // iOS/Android still open the OS calendar/time wheel on focus, so the user
  // saw both pickers stacked. Native date/time fields also keep an intrinsic
  // width on iOS (ignoring width:100%), which misaligned the form columns —
  // text fields obey the normal layout.
  document.querySelectorAll('input[type="date"]').forEach(el => {
    el.type = 'text';
    el.readOnly = true;
    el.setAttribute('inputmode', 'none');
    if (!el.placeholder) el.placeholder = 'เลือกวันที่';
    el.classList.add('dt-field');
    // Block focus entirely (click still fires): no focus means iOS never
    // scrolls the field into view or shows a caret — the tap only opens
    // the popup, nothing else moves.
    el.addEventListener('mousedown', (e) => e.preventDefault());
    el.addEventListener('click', (e) => { e.stopPropagation(); openDatePicker(el); });
  });
  document.querySelectorAll('input[type="time"]').forEach(el => {
    el.type = 'text';
    el.readOnly = true;
    el.setAttribute('inputmode', 'none');
    if (!el.placeholder) el.placeholder = 'เลือกเวลา';
    el.classList.add('dt-field');
    el.addEventListener('mousedown', (e) => e.preventDefault());
    el.addEventListener('click', (e) => { e.stopPropagation(); openTimePicker(el); });
  });
  document.querySelectorAll('.picker-popup').forEach(el => {
    el.addEventListener('click', (e) => e.stopPropagation());
  });
  document.addEventListener('click', closePickers);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePickers(); });
  // Close when the page behind scrolls, but not when the scroll happens
  // inside a popup itself (the time picker's hour/minute lists scroll),
  // and not in the instant after opening (see pickerOpenedAt).
  window.addEventListener('scroll', (e) => {
    if (Date.now() - pickerOpenedAt < 450) return;
    if (document.getElementById('datePickerPopup')?.contains(e.target) ||
        document.getElementById('timePickerPopup')?.contains(e.target)) return;
    closePickers();
  }, true);
  window.addEventListener('resize', () => {
    if (Date.now() - pickerOpenedAt < 450) return;
    closePickers();
  });
}

function closePickers() {
  document.getElementById('datePickerPopup')?.classList.remove('open');
  document.getElementById('timePickerPopup')?.classList.remove('open');
  pickerActiveInput = null;
}

function positionPickerPopup(popup, inputEl) {
  const rect = inputEl.getBoundingClientRect();
  const width = popup.offsetWidth || 280;
  let left = rect.left;
  if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
  popup.style.left = `${Math.max(8, left)}px`;
  // Flip above the field when there's no room below, so the popup never
  // opens off-screen (off-screen forced the user to scroll = instant close).
  const height = popup.offsetHeight || 320;
  const spaceBelow = window.innerHeight - rect.bottom - 14;
  popup.style.top = (spaceBelow >= height || spaceBelow >= rect.top - 14)
    ? `${rect.bottom + 6}px`
    : `${Math.max(8, rect.top - 6 - height)}px`;
}

function openDatePicker(inputEl) {
  // Dismiss the keyboard if another field was being typed in; the guard
  // window absorbs the resize event the closing keyboard fires.
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  pickerOpenedAt = Date.now();
  pickerActiveInput = inputEl;
  const base = inputEl.value ? new Date(inputEl.value + 'T00:00:00') : new Date();
  pickerViewDate = new Date(base.getFullYear(), base.getMonth(), 1);
  document.getElementById('timePickerPopup').classList.remove('open');
  renderDatePicker();
  const popup = document.getElementById('datePickerPopup');
  popup.classList.add('open');
  positionPickerPopup(popup, inputEl);
}

function shiftPickerMonth(n) {
  pickerViewDate.setMonth(pickerViewDate.getMonth() + n);
  renderDatePicker();
}

function renderDatePicker() {
  const popup = document.getElementById('datePickerPopup');
  const year  = pickerViewDate.getFullYear();
  const month = pickerViewDate.getMonth();
  const firstDow     = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const today        = todayStr();
  const selected     = pickerActiveInput?.value || '';

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push('<span></span>');
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cls = ['picker-day'];
    if (dateStr === today)    cls.push('picker-today');
    if (dateStr === selected) cls.push('picker-selected');
    cells.push(`<span class="${cls.join(' ')}" onclick="pickDate('${dateStr}')">${d}</span>`);
  }

  popup.innerHTML = `
    <div class="picker-header">
      <button type="button" onclick="shiftPickerMonth(-1)"><i class="fa-solid fa-chevron-left"></i></button>
      <span>${PICKER_MONTH[month]} ${year + 543}</span>
      <button type="button" onclick="shiftPickerMonth(1)"><i class="fa-solid fa-chevron-right"></i></button>
    </div>
    <div class="picker-dow">${PICKER_DOW.map(d => `<span>${d}</span>`).join('')}</div>
    <div class="picker-days">${cells.join('')}</div>
    <div class="picker-footer">
      <button type="button" class="btn btn-sm btn-secondary" onclick="pickDate('')">ล้าง</button>
      <button type="button" class="btn btn-sm btn-secondary" onclick="pickDate(todayStr())">วันนี้</button>
    </div>`;
}

function pickDate(dateStr) {
  if (!pickerActiveInput) return;
  pickerActiveInput.value = dateStr;
  pickerActiveInput.dispatchEvent(new Event('change', { bubbles: true }));
  closePickers();
}

function openTimePicker(inputEl) {
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  pickerOpenedAt = Date.now();
  pickerActiveInput = inputEl;
  const [h, m] = (inputEl.value || '').split(':');
  pickerTempTime = {
    h: h && /^\d{2}$/.test(h) ? h : '00',
    m: PICKER_MINUTES.includes(m) ? m : '00',
  };
  document.getElementById('datePickerPopup').classList.remove('open');
  renderTimePicker();
  const popup = document.getElementById('timePickerPopup');
  popup.classList.add('open');
  positionPickerPopup(popup, inputEl);
  popup.querySelector('.picker-selected')?.scrollIntoView({ block: 'center' });
}

function selectPickerHour(h)   { pickerTempTime.h = h; renderTimePicker(); }
function selectPickerMinute(m) { pickerTempTime.m = m; renderTimePicker(); }

function confirmPickerTime() {
  if (!pickerActiveInput) return;
  pickerActiveInput.value = `${pickerTempTime.h}:${pickerTempTime.m}`;
  pickerActiveInput.dispatchEvent(new Event('change', { bubbles: true }));
  closePickers();
}

function pickTimeNow() {
  const now = new Date();
  const nearestMinute = PICKER_MINUTES.reduce((best, m) =>
    Math.abs(+m - now.getMinutes()) < Math.abs(+best - now.getMinutes()) ? m : best
  );
  pickerTempTime = { h: String(now.getHours()).padStart(2, '0'), m: nearestMinute };
  confirmPickerTime();
}

function renderTimePicker() {
  const popup = document.getElementById('timePickerPopup');
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

  popup.innerHTML = `
    <div class="picker-time-cols">
      <div class="picker-time-col">
        ${hours.map(h => `<span class="picker-time-item ${h === pickerTempTime.h ? 'picker-selected' : ''}" onclick="selectPickerHour('${h}')">${h}</span>`).join('')}
      </div>
      <div class="picker-time-col">
        ${PICKER_MINUTES.map(m => `<span class="picker-time-item ${m === pickerTempTime.m ? 'picker-selected' : ''}" onclick="selectPickerMinute('${m}')">${m}</span>`).join('')}
      </div>
    </div>
    <div class="picker-footer">
      <button type="button" class="btn btn-sm btn-secondary" onclick="pickTimeNow()">ตอนนี้</button>
      <button type="button" class="btn btn-sm btn-primary" onclick="confirmPickerTime()">ตกลง</button>
    </div>`;
}

// ── Custom select dropdown ──────────────────────────────────────────────
// Native <select> popups are OS-rendered and can't be restyled either, so
// every <select> gets a theme-matching trigger next to it, while the
// native element stays in the DOM (visually hidden) as the real source of
// truth — existing code that reads/writes .value or rebuilds <option>s via
// innerHTML keeps working untouched.
//
// The dropdown panel itself is ONE shared element appended to <body>
// (mirroring the date/time pickers), not nested inside each trigger —
// several containers in this app (.section-card, .modal) use
// backdrop-filter + overflow:hidden, and backdrop-filter makes an element
// the containing block for any position:fixed descendant, silently
// clipping a panel that lived inside one of those instead of escaping to
// the viewport like it's supposed to.
let customSelectActive = null;
// Same guard as the date/time pickers: the tap that opens the panel can
// fire scroll/resize (keyboard dismissing) that must not close it instantly.
let customSelectOpenedAt = 0;

function enhanceAllSelects() {
  document.querySelectorAll('select').forEach(enhanceSelect);
}

function enhanceSelect(select) {
  if (select.dataset.csEnhanced) return;
  select.dataset.csEnhanced = '1';

  const wrap = document.createElement('div');
  wrap.className = 'custom-select-wrap';
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);
  select.classList.add('cs-native');
  select.tabIndex = -1;

  const trigger = document.createElement('div');
  trigger.className = 'custom-select-trigger';
  trigger.innerHTML = `<span class="cs-label"></span><i class="fa-solid fa-chevron-down"></i>`;
  wrap.appendChild(trigger);

  select._csTrigger = trigger;
  select._csWrap    = wrap;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (select.disabled) return;
    const wasOpen = customSelectActive === select;
    closeAllCustomSelects();
    if (!wasOpen) openCustomSelect(select, trigger);
  });

  // Options get rebuilt dynamically (brand/model cascading, car/maintenance/
  // expense pickers) — catch that even when nothing calls syncSelectLabel.
  new MutationObserver(() => syncSelectLabel(select)).observe(select, { childList: true });

  syncSelectLabel(select);
}

function syncSelectLabel(select) {
  const trigger = select._csTrigger;
  if (!trigger) return;
  const opt = select.options[select.selectedIndex];
  trigger.querySelector('.cs-label').textContent = opt ? opt.textContent : '';
  trigger.classList.toggle('placeholder', !opt || !opt.value);
  trigger.classList.toggle('disabled', select.disabled);
}

function openCustomSelect(select, trigger) {
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  customSelectOpenedAt = Date.now();
  const panel = document.getElementById('customSelectPanel');
  panel.innerHTML = Array.from(select.options).map((opt, i) => `
    <div class="custom-select-option ${opt.disabled ? 'disabled' : ''} ${i === select.selectedIndex ? 'selected' : ''}"
         data-index="${i}">${opt.textContent}</div>`).join('');
  panel.classList.add('open');
  trigger.parentElement.classList.add('open');
  customSelectActive = select;
  positionSelectPanel(panel, trigger);
  panel.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
}

function positionSelectPanel(panel, trigger) {
  const rect = trigger.getBoundingClientRect();
  panel.style.width = `${rect.width}px`;
  let left = rect.left;
  if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
  panel.style.left = `${Math.max(8, left)}px`;

  // Open downward when there's room; otherwise flip above the trigger.
  // Either way, cap the height to the available space so the whole list is
  // reachable by scrolling inside the panel instead of running off-screen.
  const spaceBelow = window.innerHeight - rect.bottom - 14;
  const spaceAbove = rect.top - 14;
  const openDown   = spaceBelow >= Math.min(panel.scrollHeight, 160) || spaceBelow >= spaceAbove;
  const maxH       = Math.max(120, Math.min(260, openDown ? spaceBelow : spaceAbove));
  panel.style.maxHeight = `${maxH}px`;
  panel.style.top = openDown
    ? `${rect.bottom + 6}px`
    : `${Math.max(8, rect.top - 6 - Math.min(maxH, panel.scrollHeight))}px`;
}

function closeAllCustomSelects() {
  document.getElementById('customSelectPanel')?.classList.remove('open');
  document.querySelectorAll('.custom-select-wrap.open').forEach(w => w.classList.remove('open'));
  customSelectActive = null;
}

document.getElementById('customSelectPanel')?.addEventListener('click', (e) => {
  const item = e.target.closest('.custom-select-option');
  if (!item || item.classList.contains('disabled') || !customSelectActive) return;
  const select = customSelectActive;
  select.selectedIndex = +item.dataset.index;
  syncSelectLabel(select);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  closeAllCustomSelects();
});

document.addEventListener('click', closeAllCustomSelects);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllCustomSelects(); });
// Close when the page/modal behind scrolls — but NOT when the scroll comes
// from inside the panel itself, otherwise scrolling a long option list
// (years, brands...) instantly closes the dropdown.
window.addEventListener('scroll', (e) => {
  if (Date.now() - customSelectOpenedAt < 450) return;
  const panel = document.getElementById('customSelectPanel');
  if (panel && (e.target === panel || panel.contains(e.target))) return;
  closeAllCustomSelects();
}, true);
window.addEventListener('resize', () => {
  if (Date.now() - customSelectOpenedAt < 450) return;
  closeAllCustomSelects();
});

// Catches every `select.value = ...` assignment app-wide (e.g. modals
// prefilling a field, goToCarsFiltered() setting the status filter) so the
// custom trigger's label never goes stale, without touching each call site.
(function interceptSelectValue() {
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(HTMLSelectElement.prototype, 'value', {
    get() { return desc.get.call(this); },
    set(v) { desc.set.call(this, v); syncSelectLabel(this); },
  });
})();

function showModal(id)  { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

let _toastTimer;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast' + (type ? ' toast-' + type : '');
  el.style.display = 'flex';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2800);
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.style.display = 'none';
  }
});
