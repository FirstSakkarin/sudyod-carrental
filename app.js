/* ====================================
   SUDYOD CARRENTAL — App Logic
   ==================================== */

// ── State ──────────────────────────────────────────────────────────────
let state = {
  user: null,           // { username, role }
  cars: [],
  bookings: [],
  maintenance: [],
  expenses: [],
  customerTags: {},     // { 'name||phone': 'vip' | 'regular' | 'new' | '' }
  sheetsUrl: '',
  syncing: false,
};

// ── Auto-init (no login) ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  state.user = { username: 'admin', role: 'owner', display: 'เจ้าของ' };
  document.body.classList.add('is-owner');
  initApp();
});

// ── Init ───────────────────────────────────────────────────────────────
function initApp() {
  loadFromStorage();
  state.sheetsUrl = localStorage.getItem('sheetsUrl') || '';
  document.getElementById('todayDate').textContent = formatDateThai(new Date());
  renderDashboard();
  navigate('dashboard');
  if (state.sheetsUrl) loadFromSheets();
}

function loadFromStorage() {
  state.cars          = JSON.parse(localStorage.getItem('cars')          || '[]');
  state.bookings      = JSON.parse(localStorage.getItem('bookings')      || '[]');
  state.maintenance   = JSON.parse(localStorage.getItem('maintenance')   || '[]');
  state.expenses      = JSON.parse(localStorage.getItem('expenses')      || '[]');
  state.customerTags  = JSON.parse(localStorage.getItem('customerTags')  || '{}');
  if (!state.cars.length) seedSampleData();
}

function saveToStorage() {
  localStorage.setItem('cars',         JSON.stringify(state.cars));
  localStorage.setItem('bookings',     JSON.stringify(state.bookings));
  localStorage.setItem('maintenance',  JSON.stringify(state.maintenance));
  localStorage.setItem('expenses',     JSON.stringify(state.expenses));
  localStorage.setItem('customerTags', JSON.stringify(state.customerTags));
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

function navigate(page) {
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

  document.getElementById('topbarTitle').textContent = PAGE_LABELS[page] || page;
  closeSidebar();

  if (page === 'dashboard')   renderDashboard();
  if (page === 'cars')        renderCarsPage();
  if (page === 'bookings')    renderBookingsPage();
  if (page === 'maintenance') renderMaintenancePage();
  if (page === 'finance')     renderFinancePage();
  if (page === 'customers')   renderCustomersPage();
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
  const blocked     = cars.filter(c => c.status === 'blocked').length;

  document.getElementById('statTotal').textContent       = cars.length;
  document.getElementById('statAvailable').textContent   = available;
  document.getElementById('statRented').textContent      = rented;
  document.getElementById('statMaintenance').textContent = maintenance;
  document.getElementById('statBlocked').textContent     = blocked;

  // (blockedDueCard removed from dashboard — will be placed elsewhere)

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
            <div class="return-customer">${b.customer} · ${b.phone || '-'}</div>
          </div>
          <div>
            <span class="return-tag">คืนวันนี้</span>
            <button class="btn btn-sm btn-success" style="margin-top:.35rem;" onclick="openReturnModal('${b.id}')">คืนรถ</button>
          </div>
        </div>`;
    }).join('');
  }

  // Car mini grid
  const gridEl = document.getElementById('dashboardCarList');
  gridEl.innerHTML = cars.map(car => {
    const statusLabel = { available: 'ว่าง', rented: 'เช่าอยู่', maintenance: 'ซ่อมบำรุง', blocked: 'ปิดตา' }[car.status] || car.status;
    return `
      <div class="car-mini-card status-${car.status}" onclick="openCarDetail('${car.id}')">
        <div class="car-mini-plate">${car.plate}</div>
        <div class="car-mini-model">${car.brand} ${car.model} · ${car.color}</div>
        <span class="car-mini-status pill pill-${car.status}">${statusLabel}</span>
      </div>`;
  }).join('');
}

// ── Cars Page ──────────────────────────────────────────────────────────
function renderCarsPage() {
  const q      = (document.getElementById('carSearch')?.value || '').toLowerCase();
  const status = document.getElementById('carStatusFilter')?.value || '';

  let cars = state.cars.filter(c => {
    const matchQ = !q || `${c.plate} ${c.brand} ${c.model}`.toLowerCase().includes(q);
    const matchS = !status || c.status === status;
    return matchQ && matchS;
  });

  document.getElementById('carsCount').textContent = `${cars.length} คัน`;

  const STATUS_LABEL = { available: 'ว่าง', rented: 'เช่าอยู่', maintenance: 'ซ่อมบำรุง', blocked: 'ปิดตา' };

  const html = cars.length ? `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>ทะเบียน</th>
            <th>ยี่ห้อ / รุ่น</th>
            <th>สถานะ</th>
            <th>เลขไมล์</th>
            <th>ราคา/วัน</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${cars.map(car => `
            <tr>
              <td><strong>${car.plate}</strong></td>
              <td>${car.brand} ${car.model} <span style="color:var(--gray-400);font-size:.78rem;">${car.year || ''} · ${car.color || ''}</span></td>
              <td>
                <span class="pill pill-${car.status}">${STATUS_LABEL[car.status] || car.status}</span>
                ${car.status === 'blocked' && car.blockedUntil ? `<br><span style="font-size:.72rem;color:var(--blocked);">ถึง ${car.blockedUntil}</span>` : ''}
                ${car.status === 'blocked' && car.blockedReason ? `<br><span style="font-size:.72rem;color:var(--gray-500);">${car.blockedReason}</span>` : ''}
              </td>
              <td>${car.mileage.toLocaleString()} กม.</td>
              <td>${car.dailyRate.toLocaleString()} ฿</td>
              <td>
                <div class="actions">
                  <button class="btn btn-sm btn-outline btn-icon" onclick="openCarDetail('${car.id}')" title="รายละเอียด"><i class="fa-solid fa-eye"></i></button>
                  ${car.status === 'blocked'
                    ? `<button class="btn btn-sm btn-icon" onclick="unblockCar('${car.id}')" title="เปิดตา"
                        style="background:var(--blocked-bg);color:var(--blocked);border:1px solid rgba(167,139,250,0.25);">
                        <i class="fa-solid fa-lock-open"></i></button>`
                    : `<button class="btn btn-sm btn-icon" onclick="openBlockCarModal('${car.id}')" title="ปิดตา"
                        style="background:var(--blocked-bg);color:var(--blocked);border:1px solid rgba(167,139,250,0.25);">
                        <i class="fa-solid fa-lock"></i></button>`}
                  <button class="btn btn-sm btn-warning btn-icon" onclick="openEditCarModal('${car.id}')" title="แก้ไข"><i class="fa-solid fa-pen"></i></button>
                  <button class="btn btn-sm btn-danger btn-icon" onclick="deleteCar('${car.id}')" title="ลบ"><i class="fa-solid fa-trash"></i></button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '<p class="empty-state" style="text-align:center;padding:2rem;">ไม่พบรถ</p>';

  document.getElementById('carsTableContainer').innerHTML = html;
}

// Car modals
function openAddCarModal() {
  document.getElementById('carModalTitle').textContent = 'เพิ่มรถ';
  document.getElementById('carModalId').value   = '';
  document.getElementById('carPlate').value     = '';
  document.getElementById('carType').value      = 'sedan';
  document.getElementById('carBrand').value     = '';
  document.getElementById('carModel').value     = '';
  document.getElementById('carYear').value      = '';
  document.getElementById('carColor').value     = '';
  document.getElementById('carMileage').value   = '';
  document.getElementById('carNextService').value = '';
  document.getElementById('carDailyRate').value = '';
  document.getElementById('carStatus').value    = 'available';
  document.getElementById('carNote').value      = '';
  showModal('carModal');
}

function openEditCarModal(id) {
  const car = getCarById(id);
  if (!car) return;
  document.getElementById('carModalTitle').textContent    = 'แก้ไขข้อมูลรถ';
  document.getElementById('carModalId').value            = car.id;
  document.getElementById('carPlate').value              = car.plate;
  document.getElementById('carType').value               = car.type || 'sedan';
  document.getElementById('carBrand').value              = car.brand;
  document.getElementById('carModel').value              = car.model;
  document.getElementById('carYear').value               = car.year || '';
  document.getElementById('carColor').value              = car.color || '';
  document.getElementById('carMileage').value            = car.mileage;
  document.getElementById('carNextService').value        = car.nextService || '';
  document.getElementById('carDailyRate').value          = car.dailyRate;
  document.getElementById('carStatus').value             = car.status;
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
    note:        document.getElementById('carNote').value.trim(),
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
  pushToSheets();
  showToast(id ? 'อัปเดตข้อมูลรถเรียบร้อย' : 'เพิ่มรถเรียบร้อย', 'success');
}

function deleteCar(id) {
  if (!confirm('ต้องการลบรถคันนี้?')) return;
  state.cars = state.cars.filter(c => c.id !== id);
  saveToStorage();
  renderCarsPage();
  renderDashboard();
  pushToSheets();
  showToast('ลบรถเรียบร้อย');
}

function openCarDetail(id) {
  const car = getCarById(id);
  if (!car) return;

  const STATUS_LABEL = { available: 'ว่าง', rented: 'เช่าอยู่', maintenance: 'ซ่อมบำรุง', blocked: 'ปิดตา' };
  const activeBooking = state.bookings.find(b => b.carId === id && b.status === 'active');
  const history = state.bookings.filter(b => b.carId === id && b.status === 'completed').slice(-5).reverse();

  document.getElementById('carDetailTitle').textContent = `${car.plate}`;
  document.getElementById('carDetailBody').innerHTML = `
    <div style="margin-bottom:.75rem;">
      <span class="pill pill-${car.status}">${STATUS_LABEL[car.status] || car.status}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem .75rem;font-size:.88rem;margin-bottom:1rem;">
      <div><span style="color:var(--gray-500);">ยี่ห้อ/รุ่น</span><br><strong>${car.brand} ${car.model}</strong></div>
      <div><span style="color:var(--gray-500);">ปี</span><br><strong>${car.year || '-'}</strong></div>
      <div><span style="color:var(--gray-500);">สี</span><br><strong>${car.color || '-'}</strong></div>
      <div><span style="color:var(--gray-500);">ประเภท</span><br><strong>${car.type || '-'}</strong></div>
      <div><span style="color:var(--gray-500);">เลขไมล์</span><br><strong>${car.mileage.toLocaleString()} กม.</strong></div>
      <div><span style="color:var(--gray-500);">ซ่อมถัดไป</span><br><strong>${car.nextService ? car.nextService.toLocaleString() + ' กม.' : '-'}</strong></div>
      <div><span style="color:var(--gray-500);">ราคา/วัน</span><br><strong>${car.dailyRate.toLocaleString()} ฿</strong></div>
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
      ${history.map(b => `<div style="font-size:.83rem;padding:.35rem 0;border-bottom:1px solid var(--gray-100);">${b.start} – ${b.end} · ${b.customer}</div>`).join('')}` : ''}
    ${car.note ? `<div style="margin-top:.75rem;font-size:.82rem;color:var(--gray-500);">หมายเหตุ: ${car.note}</div>` : ''}
  `;
  document.getElementById('carDetailEditBtn').onclick = () => openEditCarModal(id);
  showModal('carDetailModal');
}

// ── Bookings Page ──────────────────────────────────────────────────────
function renderBookingsPage() {
  const filter = document.getElementById('bookingFilter')?.value || 'active';
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
              <tr>
                <td><strong>${car ? car.plate : '-'}</strong><br><span style="font-size:.78rem;color:var(--gray-400);">${car ? car.brand+' '+car.model : ''}</span></td>
                <td>${b.customer}<br><span style="font-size:.78rem;color:var(--gray-400);">${b.phone || '-'}</span></td>
                <td>${b.start}<br>– ${b.end}${isOverdue ? ' <span class="pill pill-overdue" style="font-size:.68rem;">เกินกำหนด</span>' : ''}</td>
                <td><strong>${(b.total||0).toLocaleString()} ฿</strong></td>
                <td><span class="pill pill-${STATUS_PILL[b.status]||'completed'}">${STATUS_LABEL[b.status]||b.status}</span></td>
                <td>
                  <div class="actions">
                    ${b.status !== 'completed' ? `<button class="btn btn-sm btn-success btn-icon" onclick="openReturnModal('${b.id}')" title="คืนรถ"><i class="fa-solid fa-rotate-left"></i></button>` : ''}
                    <button class="btn btn-sm btn-warning btn-icon" onclick="openEditBookingModal('${b.id}')" title="แก้ไข"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-sm btn-danger btn-icon" onclick="deleteBooking('${b.id}')" title="ลบ"><i class="fa-solid fa-trash"></i></button>
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : '<p class="empty-state" style="text-align:center;padding:2rem;">ไม่มีรายการ</p>';

  document.getElementById('bookingsTableContainer').innerHTML = html;
}

function openAddBookingModal() {
  populateCarSelect('bookingCar', true);
  document.getElementById('bookingModalTitle').textContent = 'เพิ่มการจอง';
  document.getElementById('bookingModalId').value    = '';
  document.getElementById('bookingCustomer').value   = '';
  document.getElementById('bookingPhone').value      = '';
  document.getElementById('bookingStart').value      = '';
  document.getElementById('bookingEnd').value        = '';
  document.getElementById('bookingMileageOut').value = '';
  document.getElementById('bookingRate').value       = '';
  document.getElementById('bookingNote').value       = '';
  document.getElementById('bookingTotalBox').style.display = 'none';
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
  document.getElementById('bookingEnd').value        = b.end;
  document.getElementById('bookingMileageOut').value = b.mileageOut || '';
  document.getElementById('bookingRate').value       = b.rate || '';
  document.getElementById('bookingNote').value       = b.note || '';
  calcBookingTotal();
  showModal('bookingModal');
}

function calcBookingTotal() {
  const start = document.getElementById('bookingStart').value;
  const end   = document.getElementById('bookingEnd').value;
  const carId = document.getElementById('bookingCar').value;
  const rateOverride = +document.getElementById('bookingRate').value || 0;
  const box   = document.getElementById('bookingTotalBox');

  if (!start || !end || !carId) { box.style.display = 'none'; return; }

  const days = daysBetween(start, end);
  if (days <= 0) { box.style.display = 'none'; return; }

  const car  = getCarById(carId);
  const rate = rateOverride || (car ? car.dailyRate : 0);
  const total = days * rate;

  document.getElementById('bookingDays').textContent  = days;
  document.getElementById('bookingTotal').textContent = '฿' + total.toLocaleString();
  box.style.display = 'flex';
}

function saveBooking() {
  const carId    = document.getElementById('bookingCar').value;
  const customer = document.getElementById('bookingCustomer').value.trim();
  const start    = document.getElementById('bookingStart').value;
  const end      = document.getElementById('bookingEnd').value;
  if (!carId || !customer || !start || !end) { showToast('กรุณากรอกข้อมูลที่จำเป็น', 'error'); return; }

  const car   = getCarById(carId);
  const days  = daysBetween(start, end);
  const rateOverride = +document.getElementById('bookingRate').value || 0;
  const rate  = rateOverride || (car ? car.dailyRate : 0);
  const total = days * rate;

  const id   = document.getElementById('bookingModalId').value;
  const today = todayStr();
  const status = start <= today ? 'active' : 'upcoming';

  const data = {
    carId, customer, start, end, rate, total, status,
    phone:        document.getElementById('bookingPhone').value.trim(),
    mileageOut:   +document.getElementById('bookingMileageOut').value || null,
    note:         document.getElementById('bookingNote').value.trim(),
    extra: 0, returnMileage: null,
  };

  if (id) {
    const idx = state.bookings.findIndex(b => b.id === id);
    if (idx > -1) state.bookings[idx] = { ...state.bookings[idx], ...data };
  } else {
    state.bookings.push({ id: 'b' + Date.now(), ...data });
    // Mark car as rented if active
    if (status === 'active') updateCarStatus(carId, 'rented');
  }

  saveToStorage();
  closeModal('bookingModal');
  renderBookingsPage();
  renderDashboard();
  pushToSheets();
  showToast(id ? 'อัปเดตการจองเรียบร้อย' : 'เพิ่มการจองเรียบร้อย', 'success');
}

function deleteBooking(id) {
  if (!confirm('ต้องการลบการจองนี้?')) return;
  state.bookings = state.bookings.filter(b => b.id !== id);
  saveToStorage();
  renderBookingsPage();
  renderDashboard();
  pushToSheets();
  showToast('ลบการจองเรียบร้อย');
}

// ── Return Car ─────────────────────────────────────────────────────────
function openReturnModal(bookingId) {
  const b   = state.bookings.find(x => x.id === bookingId);
  const car = b ? getCarById(b.carId) : null;
  if (!b || !car) return;

  document.getElementById('returnBookingId').value = bookingId;
  document.getElementById('returnDate').value      = todayStr();
  document.getElementById('returnMileage').value   = '';
  document.getElementById('returnExtra').value     = '0';
  document.getElementById('returnNote').value      = '';

  const days  = daysBetween(b.start, b.end);
  document.getElementById('returnSummary').innerHTML = `
    <strong>${car.plate}</strong> ${car.brand} ${car.model}<br>
    ลูกค้า: ${b.customer} · เบอร์: ${b.phone || '-'}<br>
    วันรับรถ: ${b.start} · กำหนดคืน: ${b.end} (${days} วัน)<br>
    ยอดเช่า: <strong>${(b.total||0).toLocaleString()} ฿</strong>
  `;
  showModal('returnModal');
}

function confirmReturn() {
  const bookingId   = document.getElementById('returnBookingId').value;
  const returnDate  = document.getElementById('returnDate').value;
  const returnMile  = +document.getElementById('returnMileage').value || null;
  const extra       = +document.getElementById('returnExtra').value  || 0;
  const returnNote  = document.getElementById('returnNote').value.trim();

  const idx = state.bookings.findIndex(b => b.id === bookingId);
  if (idx < 0) return;

  const b = state.bookings[idx];
  const days = daysBetween(b.start, returnDate);
  const finalTotal = (days * b.rate) + extra;

  state.bookings[idx] = { ...b, status: 'completed', returnDate, returnMileage: returnMile, extra, finalTotal, returnNote };

  // Update car mileage & status
  const carIdx = state.cars.findIndex(c => c.id === b.carId);
  if (carIdx > -1) {
    state.cars[carIdx].status  = 'available';
    if (returnMile) state.cars[carIdx].mileage = returnMile;
  }

  saveToStorage();
  closeModal('returnModal');
  renderBookingsPage();
  renderDashboard();
  pushToSheets();
  showToast('บันทึกการคืนรถเรียบร้อย ✅', 'success');
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
  };

  const id = document.getElementById('maintenanceModalId').value;
  if (id) {
    const idx = state.maintenance.findIndex(m => m.id === id);
    if (idx > -1) state.maintenance[idx] = { ...state.maintenance[idx], ...data };
  } else {
    state.maintenance.push({ id: 'm' + Date.now(), ...data });
    // Update car next service mileage
    if (data.nextService) {
      const cIdx = state.cars.findIndex(c => c.id === carId);
      if (cIdx > -1) state.cars[cIdx].nextService = data.nextService;
    }
  }

  saveToStorage();
  closeModal('maintenanceModal');
  renderMaintenancePage();
  pushToSheets();
  showToast('บันทึกการซ่อมเรียบร้อย', 'success');
}

function deleteMaintenance(id) {
  if (!confirm('ต้องการลบรายการนี้?')) return;
  state.maintenance = state.maintenance.filter(m => m.id !== id);
  saveToStorage();
  renderMaintenancePage();
  showToast('ลบรายการเรียบร้อย');
}

// ── Suggest Page ───────────────────────────────────────────────────────
function runSuggest() {
  const start   = document.getElementById('suggestDate').value;
  const end     = document.getElementById('suggestEndDate').value;
  const type    = document.getElementById('suggestType').value;
  const results = document.getElementById('suggestResults');

  if (!start || !end) { results.innerHTML = ''; return; }

  const days = daysBetween(start, end);
  if (days <= 0) {
    results.innerHTML = '<p class="empty-state">กรุณาเลือกวันคืนหลังวันรับรถ</p>';
    return;
  }

  // Find available cars (no active booking in date range)
  const available = state.cars.filter(car => {
    if (car.status === 'maintenance') return false;
    if (car.status === 'blocked')     return false;
    if (type && car.type !== type)    return false;
    // Check for booking conflicts
    const conflict = state.bookings.some(b =>
      b.carId === car.id &&
      b.status !== 'completed' &&
      b.start < end && b.end > start
    );
    return !conflict;
  });

  if (!available.length) {
    results.innerHTML = `<div class="section-card"><div class="modal-body"><p class="empty-state">ไม่พบรถว่างในช่วงเวลานี้</p></div></div>`;
    return;
  }

  results.innerHTML = `
    <div class="section-card">
      <div class="section-card-header">
        <h3>รถว่าง ${available.length} คัน · ${days} วัน</h3>
      </div>
      ${available.map(car => `
        <div class="suggest-car-card">
          <div class="suggest-car-info">
            <div class="suggest-car-plate">${car.plate} <span class="pill pill-available" style="font-size:.7rem;">ว่าง</span></div>
            <div class="suggest-car-model">${car.brand} ${car.model} · ${car.color||'-'} · ปี ${car.year||'-'}</div>
          </div>
          <div style="text-align:right;">
            <div class="suggest-rate">${car.dailyRate.toLocaleString()} ฿/วัน</div>
            <div style="font-size:.78rem;color:var(--gray-400);">รวม ${(car.dailyRate*days).toLocaleString()} ฿</div>
            <button class="btn btn-primary btn-sm" style="margin-top:.35rem;"
              onclick="prefillBooking('${car.id}','${start}','${end}')">
              <i class="fa-solid fa-plus"></i> จอง
            </button>
          </div>
        </div>`).join('')}
    </div>`;
}

function prefillBooking(carId, start, end) {
  openAddBookingModal();
  document.getElementById('bookingCar').value  = carId;
  document.getElementById('bookingStart').value = start;
  document.getElementById('bookingEnd').value   = end;
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

  // Filter expenses
  let expenseList = [...state.expenses, ...state.maintenance.map(m => ({ ...m, expenseType: 'maintenance', amount: m.cost }))];
  if (selectedCar)   expenseList = expenseList.filter(e => e.carId === selectedCar);
  if (selectedMonth) expenseList = expenseList.filter(e => e.date.startsWith(selectedMonth));

  const totalIncome  = incomeList.reduce((s,b) => s + (b.finalTotal || b.total || 0), 0);
  const totalExpense = expenseList.reduce((s,e) => s + (e.amount || e.cost || 0), 0);
  const net = totalIncome - totalExpense;

  document.getElementById('financeSummaryCards').innerHTML = `
    <div class="stat-card stat-available">
      <div class="stat-icon"><i class="fa-solid fa-arrow-trend-up"></i></div>
      <div class="stat-info"><div class="stat-num">${totalIncome.toLocaleString()}</div><div class="stat-label">รายรับ (฿)</div></div>
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
    ...expenseList.map(e => {
      const car = getCarById(e.carId);
      return { date: e.date, label: `${e.expenseType||e.type||'รายจ่าย'} ${car ? car.plate : ''}`, income: 0, expense: e.amount||e.cost||0 };
    }),
  ].sort((a,b) => b.date.localeCompare(a.date));

  document.getElementById('financeTableContainer').innerHTML = rows.length ? `
    <div class="table-wrap" style="margin-top:1rem;">
      <table class="data-table">
        <thead>
          <tr><th>วันที่</th><th>รายการ</th><th>รายรับ</th><th>รายจ่าย</th></tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${r.date}</td>
              <td>${r.label}</td>
              <td class="finance-income">${r.income ? r.income.toLocaleString()+' ฿' : '-'}</td>
              <td class="finance-expense">${r.expense ? r.expense.toLocaleString()+' ฿' : '-'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '<p class="empty-state" style="text-align:center;padding:2rem;">ไม่มีรายการ</p>';
}

function openAddExpenseModal() {
  populateCarSelect('expenseCar', false);
  document.getElementById('expenseModalId').value = '';
  document.getElementById('expenseDate').value    = todayStr();
  document.getElementById('expenseType').value    = 'insurance';
  document.getElementById('expenseAmount').value  = '';
  document.getElementById('expenseDetail').value  = '';
  showModal('expenseModal');
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
  pushToSheets();
  showToast('บันทึกรายจ่ายเรียบร้อย', 'success');
}

// ── Block / Unblock Car ────────────────────────────────────────────────

function openBlockCarModal(id) {
  const car = getCarById(id);
  if (!car) return;
  document.getElementById('blockCarId').value = id;
  document.getElementById('blockUntil').value  = '';
  document.getElementById('blockReason').value = '';
  document.getElementById('blockCarInfo').innerHTML =
    `<i class="fa-solid fa-lock"></i> <strong>${car.plate}</strong> — ${car.brand} ${car.model} (${car.color || ''})`;
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
  saveToStorage();
  closeModal('blockCarModal');
  renderCarsPage();
  renderDashboard();
  pushToSheets();
  const car = state.cars[idx];
  showToast(`ปิดตา ${car.plate} เรียบร้อย${until ? ' ถึง ' + until : ''}`, 'success');
}

function unblockCar(id) {
  const idx = state.cars.findIndex(c => c.id === id);
  if (idx < 0) return;
  state.cars[idx].status        = 'available';
  state.cars[idx].blockedUntil  = null;
  state.cars[idx].blockedReason = null;
  saveToStorage();
  renderCarsPage();
  renderDashboard();
  pushToSheets();
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
              <tr>
                <td><strong>${c.name}</strong></td>
                <td>${c.phone}</td>
                <td><strong style="color:var(--primary);text-shadow:0 0 8px var(--glow-primary-sm);">${c.bookings.length}</strong> ครั้ง</td>
                <td><strong>${c.totalSpent.toLocaleString()} ฿</strong></td>
                <td>${c.lastDate || '-'}</td>
                <td>${tagHtml}</td>
                <td>
                  <div class="actions">
                    <button class="btn btn-sm btn-outline btn-icon" onclick="openCustomerDetail('${encodeKey(c.key)}')" title="ดูประวัติ">
                      <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-primary btn-icon" onclick="prefillBookingForCustomer('${encodeKey(c.key)}')" title="จองให้ลูกค้านี้">
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
      <div><i class="fa-solid fa-phone" style="color:var(--gray-500);width:16px;"></i> ${c.phone}</div>
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
    showToast('บันทึกการตั้งค่าเรียบร้อย กำลัง sync...', 'success');
  } else {
    showToast('ปิดการ sync กับ Google Sheets');
  }
}

async function testSheetsConnection() {
  const url = document.getElementById('settingsUrl').value.trim();
  const el  = document.getElementById('testResult');
  if (!url) { el.textContent = '⚠️ กรุณากรอก URL ก่อน'; el.style.color = 'var(--maintenance)'; return; }
  el.textContent = 'กำลังทดสอบ...'; el.style.color = 'var(--gray-500)';
  try {
    const res = await fetch(url + '?action=ping');
    const json = await res.json();
    if (json.status === 'ok') { el.textContent = '✅ เชื่อมต่อสำเร็จ'; el.style.color = 'var(--success)'; }
    else                      { el.textContent = '⚠️ ตอบกลับแต่ไม่ถูกต้อง'; el.style.color = 'var(--maintenance)'; }
  } catch {
    el.textContent = '❌ เชื่อมต่อไม่ได้'; el.style.color = 'var(--danger)';
  }
}

// โหลดข้อมูลจาก Sheets ตอนเปิดแอป
async function loadFromSheets() {
  if (!state.sheetsUrl) return;
  setSyncStatus('syncing');
  try {
    const res  = await fetch(state.sheetsUrl);
    const json = await res.json();
    if (json.status === 'ok' && json.data) {
      const d = json.data;
      if (d.cars?.length)        state.cars        = d.cars;
      if (d.bookings?.length)    state.bookings    = d.bookings;
      if (d.maintenance?.length) state.maintenance = d.maintenance;
      if (d.expenses?.length)    state.expenses    = d.expenses;
      saveToStorage();
      renderDashboard();
      setSyncStatus('on');
      showToast('โหลดข้อมูลจาก Google Sheets เรียบร้อย ✅', 'success');
    } else {
      // Sheets ว่างอยู่ → push ข้อมูล local ขึ้นไป
      syncNow();
    }
  } catch {
    setSyncStatus('error');
    showToast('โหลดข้อมูลจาก Sheets ไม่ได้ ใช้ข้อมูล local แทน', '');
  }
}

// Push ข้อมูลไปยัง Sheets
async function syncNow() {
  if (!state.sheetsUrl || state.syncing) return;
  state.syncing = true;
  setSyncStatus('syncing');
  try {
    const payload = {
      cars:        state.cars,
      bookings:    state.bookings,
      maintenance: state.maintenance,
      expenses:    state.expenses,
    };
    const res  = await fetch(state.sheetsUrl, {
      method: 'POST',
      body:   JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await res.json();
    if (json.status === 'ok') setSyncStatus('on');
    else setSyncStatus('error');
  } catch {
    setSyncStatus('error');
  }
  state.syncing = false;
}

function pushToSheets() { if (state.sheetsUrl) syncNow(); }

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

function updateCarStatus(carId, status) {
  const idx = state.cars.findIndex(c => c.id === carId);
  if (idx > -1) state.cars[idx].status = status;
}

function populateCarSelect(selectId, availableOnly) {
  const el = document.getElementById(selectId);
  el.innerHTML = '<option value="">— เลือกรถ —</option>';
  state.cars
    .filter(c => !availableOnly || (c.status !== 'rented' && c.status !== 'blocked'))
    .forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.plate} · ${c.brand} ${c.model}`;
      el.appendChild(opt);
    });
}

function todayStr() { return new Date().toISOString().slice(0,10); }

function daysBetween(start, end) {
  const a = new Date(start);
  const b = new Date(end);
  return Math.round((b - a) / 86400000);
}

function formatDateThai(d) {
  const DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];
  const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

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
// Enter key on login
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('loginScreen').style.display !== 'none') {
    handleLogin();
  }
});
