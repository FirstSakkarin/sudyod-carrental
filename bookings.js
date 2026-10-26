// "การจอง" list: cards in the same style as the งานรับ-ส่งรถ page instead of a table.
// Grouped by เกินกำหนด / กำลังเช่า / กำลังจะถึง / คืนแล้ว. Loads after app.js and
// replaces its renderBookingsPage().
(function () {
  const CSS = `
#page-bookings .filter-bar:has(#bookingFilter) { display: none !important; }
.bk { --go: #4ade80; --go-wash: rgba(34,197,94,.14); --go-edge: rgba(134,239,172,.45);
  --back: #fb923c; --back-wash: rgba(249,115,22,.14); --back-edge: rgba(253,186,116,.45);
  --bad: #f87171; --edge: rgba(255,255,255,.12); --edge-2: rgba(255,255,255,.22); --glass: rgba(255,255,255,.06); --glass-2: rgba(255,255,255,.12);
  --mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace; }
.bk-chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 6px; scrollbar-width: none; }
.bk-chips::-webkit-scrollbar { display: none; }
.bk-chips button { flex-shrink: 0; min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--edge); background: var(--glass); color: var(--gray-700); font: inherit; font-weight: 600; font-size: .92rem; }
.bk-chips button[aria-pressed="true"] { border-color: currentColor; background: var(--glass-2); }
.bk-chips .c-late { color: var(--bad); } .bk-chips .c-active { color: var(--go); } .bk-chips .c-upcoming { color: #60a5fa; }
.bk-sec { display: flex; align-items: center; gap: 10px; margin: 14px 2px 8px; font-weight: 700; font-size: .92rem; color: var(--gray-600); }
.bk-sec::after { content: ""; flex: 1; height: 1px; background: var(--edge); }
.bk-sec.late { color: var(--bad); } .bk-sec.active { color: var(--go); } .bk-sec.upcoming { color: #60a5fa; }
.bk-list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
@media (min-width: 900px) { .bk-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.bk-card { border-radius: 20px; padding: 12px 14px; display: flex; flex-direction: column; gap: 5px; border: 1px solid var(--edge); background: var(--glass); cursor: pointer; min-width: 0; }
.bk-card:active { background: var(--glass-2); }
.bk-card.active { background: linear-gradient(180deg, var(--go-wash), rgba(255,255,255,.03)); border-color: var(--go-edge); }
.bk-card.upcoming { background: linear-gradient(180deg, rgba(96,165,250,.12), rgba(255,255,255,.03)); border-color: rgba(147,197,253,.4); }
.bk-card.late { box-shadow: 0 0 0 2px var(--bad), 0 0 18px rgba(239,68,68,.3); }
.bk-card.completed { opacity: .6; }
.bk-top { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.bk-plate { font-size: 1.2rem; font-weight: 800; color: var(--gray-900); white-space: nowrap; }
.bk-model { flex: 1; min-width: 0; color: var(--gray-500); font-size: .9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bk-pill { flex-shrink: 0; align-self: center; font-size: .76rem; font-weight: 800; padding: 3px 9px; border-radius: 999px; border: 1px solid currentColor; }
.bk-card.active .bk-pill { color: var(--go); } .bk-card.upcoming .bk-pill { color: #60a5fa; } .bk-card.late .bk-pill { color: var(--bad); } .bk-card.completed .bk-pill { color: var(--gray-500); }
.bk-when { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.bk-when > div { border-radius: 12px; padding: 5px 10px; background: rgba(0,0,0,.25); border: 1px solid var(--edge); min-width: 0; }
.bk-when small { display: block; font-size: .72rem; font-weight: 700; }
.bk-when b { font: 700 1rem var(--mono); white-space: nowrap; color: var(--gray-900); }
.bk-when .o small { color: var(--go); } .bk-when .r small { color: var(--back); }
.bk-card.late .bk-when .r { border-color: rgba(248,113,113,.6); }
.bk-who { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 1rem; min-width: 0; overflow-wrap: anywhere; }
.bk-who .tel-link { font-family: var(--mono); font-size: .92rem; }
.bk-where { font-size: .88rem; color: var(--gray-600); display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.bk-where > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bk-foot { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.bk-total { flex: 1; font: 700 1.05rem var(--mono); color: var(--primary); }
.bk-foot button { min-height: 42px; min-width: 46px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--edge-2); background: var(--glass-2); color: var(--gray-800); font: inherit; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.bk-foot .ret { border-color: var(--back-edge); color: #fed7aa; }
.bk-foot .del { color: var(--bad); }
.bk-more { width: 100%; min-height: 44px; margin-top: 10px; border-radius: 14px; border: 1px dashed var(--edge-2); background: transparent; color: var(--gray-600); font: inherit; font-weight: 600; }
.bk-empty { text-align: center; padding: 2rem 1rem; color: var(--gray-500); }
`;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const at = (d, t) => new Date(`${d}T${(t || '00:00').padStart(5, '0')}:00`).getTime();
  const DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const dm = (d, t) => { if (!d) return '-'; const [y, m, dd] = d.split('-').map(Number); const w = DOW[new Date(y, m - 1, dd).getDay()]; return `${w} ${dd}/${m}${t ? ' ' + t : ''}`; };
  let filt = '', showAllDone = false;

  // Which group a booking belongs to right now.
  function groupOf(b, now) {
    if (b.status === 'completed' || b.status === 'cancelled') return 'completed';
    if (b.status === 'active' && b.end && at(b.end, b.endTime || '23:59') <= now) return 'late';
    return b.status === 'active' ? 'active' : 'upcoming';
  }

  function cardHtml(b, g) {
    const car = getCarById(b.carId);
    const model = car ? [car.brand, car.model].filter(Boolean).join(' ') : '';
    const pill = { late: 'เกินกำหนด', active: 'กำลังเช่า', upcoming: 'กำลังจะถึง', completed: b.status === 'cancelled' ? 'ยกเลิก' : 'คืนแล้ว' }[g];
    const total = (b.status === 'completed' ? (b.finalTotal || b.total || 0) : (b.total || 0));
    const where = [b.pickupLocation ? `<span>🟢 ส่ง: ${mapLink(b.pickupLocation)}</span>` : '', b.returnLocation ? `<span>🟠 คืน: ${mapLink(b.returnLocation)}</span>` : ''].join('');
    return `<div class="bk-card ${g}" onclick="openEditBookingModal('${b.id}')">
      <div class="bk-top"><span class="bk-plate">${esc(car ? car.plate : '-')}</span><span class="bk-model">${esc(model)}</span><span class="bk-pill">${pill}</span></div>
      <div class="bk-when"><div class="o"><small>รับรถ</small><b>${dm(b.start, b.startTime)}</b></div><div class="r"><small>คืนรถ</small><b>${dm(b.end, b.endTime)}</b></div></div>
      <div class="bk-who"><span>${esc(b.customer || '-')}</span>${b.phone ? telLink(b.phone) : ''}</div>
      ${where ? `<div class="bk-where">${where}</div>` : ''}
      <div class="bk-foot"><span class="bk-total">${(+total || 0).toLocaleString()} ฿</span>
        ${g !== 'completed' ? `<button class="ret" onclick="event.stopPropagation(); openReturnModal('${b.id}')" aria-label="รับคืนรถ"><i class="fa-solid fa-rotate-left"></i> รับคืน</button>` : ''}
        <button onclick="event.stopPropagation(); openEditBookingModal('${b.id}')" aria-label="แก้ไข"><i class="fa-solid fa-pen"></i></button>
        <button class="del" onclick="event.stopPropagation(); deleteBooking('${b.id}')" aria-label="ลบ"><i class="fa-solid fa-trash"></i></button></div>
    </div>`;
  }

  window.renderBookingsPage = function () {
    const box = document.getElementById('bookingsTableContainer'); if (!box) return;
    const now = Date.now();
    const all = (state.bookings || []).filter(b => b.start).map(b => ({ b, g: groupOf(b, now) }));
    const n = g => all.filter(x => x.g === g).length;
    const SECS = [['late', 'เกินกำหนดคืน'], ['active', 'กำลังเช่า'], ['upcoming', 'กำลังจะถึง'], ['completed', 'คืนแล้ว']];
    let h = `<div class="bk"><div class="bk-chips" role="group" aria-label="สถานะการจอง">
      <button data-bkf="" aria-pressed="${!filt}">ทั้งหมด ${all.length}</button>
      ${n('late') ? `<button class="c-late" data-bkf="late" aria-pressed="${filt === 'late'}">● เกินกำหนด ${n('late')}</button>` : ''}
      <button class="c-active" data-bkf="active" aria-pressed="${filt === 'active'}">● กำลังเช่า ${n('active')}</button>
      <button class="c-upcoming" data-bkf="upcoming" aria-pressed="${filt === 'upcoming'}">● กำลังจะถึง ${n('upcoming')}</button>
      <button data-bkf="completed" aria-pressed="${filt === 'completed'}">คืนแล้ว ${n('completed')}</button></div>`;
    let any = false;
    SECS.forEach(([g, t]) => {
      if (filt && filt !== g) return;
      let rows = all.filter(x => x.g === g);
      if (!rows.length) return;
      any = true;
      // Soonest first; finished ones newest first.
      if (g === 'upcoming') rows.sort((a, z) => at(a.b.start, a.b.startTime) - at(z.b.start, z.b.startTime));
      else if (g === 'completed') rows.sort((a, z) => at(z.b.end, z.b.endTime) - at(a.b.end, a.b.endTime));
      else rows.sort((a, z) => at(a.b.end, a.b.endTime) - at(z.b.end, z.b.endTime));
      const cut = g === 'completed' && !filt && !showAllDone && rows.length > 6;
      h += `<div class="bk-sec ${g}">${t} (${rows.length})</div><div class="bk-list">${(cut ? rows.slice(0, 6) : rows).map(x => cardHtml(x.b, g)).join('')}</div>`;
      if (cut) h += `<button class="bk-more" data-bkmore>ดูที่คืนแล้วทั้งหมด (${rows.length})</button>`;
    });
    if (!any) h += '<div class="bk-empty">ไม่มีรายการ</div>';
    box.innerHTML = h + '</div>';
    if (typeof runBookingsSearch === 'function') runBookingsSearch();
  };

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-bkf],[data-bkmore]'); if (!t) return;
    if (t.hasAttribute('data-bkmore')) showAllDone = true; else filt = t.dataset.bkf;
    window.renderBookingsPage();
  });


  // Booking form: when a location is a pasted map link, ask for the place name
  // beside it so cards show the name. Saved as "name link" in the same field.
  const LOC_CSS = `.loc-name { margin-top: 6px; } .loc-name input { border-color: rgba(74,222,128,.45) !important; }
.loc-name small { display: block; font-size: .74rem; color: var(--gray-500); margin: 0 2px 3px; }`;
  const st2 = document.createElement('style'); st2.textContent = LOC_CSS; document.head.appendChild(st2);
  const URL_RE = /https?:\/\/\S+/;
  function wireLoc(id) {
    const main = document.getElementById(id); if (!main || main.dataset.locWired) return;
    main.dataset.locWired = '1';
    const box = document.createElement('div'); box.className = 'loc-name'; box.hidden = true;
    box.innerHTML = '<small>📍 ชื่อสถานที่นี้</small><input type="text" placeholder="เช่น ระรินจินดา">';
    main.insertAdjacentElement('afterend', box);
    const nameEl = box.querySelector('input');
    const sync = () => {
      const m = main.value.match(URL_RE);
      box.hidden = !m;
      if (m && document.activeElement !== nameEl) nameEl.value = main.value.replace(m[0], '').trim();
    };
    main.addEventListener('input', sync);
    nameEl.addEventListener('input', () => {
      const m = main.value.match(URL_RE); if (!m) return;
      main.value = (nameEl.value.trim() ? nameEl.value.trim() + ' ' : '') + m[0];
    });
    main._locSync = sync;
  }
  const LOCS = ['bookingPickupLocation', 'bookingReturnLocation'];
  LOCS.forEach(wireLoc);
  const syncLocs = () => LOCS.forEach(id => { const el = document.getElementById(id); el && el._locSync && el._locSync(); });
  ['openAddBookingModal', 'openEditBookingModal'].forEach(fn => {
    const orig = window[fn]; if (typeof orig !== 'function') return;
    window[fn] = function () { const r = orig.apply(this, arguments); syncLocs(); return r; };
  });

  if (typeof currentPage !== 'undefined' && currentPage === 'bookings') window.renderBookingsPage();
})();
