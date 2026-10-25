// "รถทั้งหมด" page: phone-first list, cars and motorcycles on separate tabs,
// grouped by what each vehicle is doing right now (free / out / in repair).
// Loads after app.js and replaces its renderCarsPage().
(function () {
  const CSS = `
.cp-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px; border-radius: 16px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); margin-bottom: 10px; }
.cp-tabs button { min-height: 46px; border: 0; border-radius: 12px; background: transparent; color: var(--gray-700); font: inherit; font-weight: 700; font-size: 1rem; }
.cp-tabs button[aria-pressed="true"] { background: var(--primary); color: #1a1400; box-shadow: 0 4px 14px rgba(250,204,21,.3); }
.cp-tabs small { font-weight: 600; opacity: .75; margin-left: 4px; }
.cp-chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 12px; scrollbar-width: none; }
.cp-chips::-webkit-scrollbar { display: none; }
.cp-chips button { flex-shrink: 0; min-height: 38px; padding: 0 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); color: var(--gray-700); font: inherit; font-weight: 600; font-size: .92rem; }
.cp-chips button[aria-pressed="true"] { border-color: currentColor; background: rgba(255,255,255,.1); }
.cp-chips .s-available { color: var(--available); } .cp-chips .s-rented { color: var(--rented); } .cp-chips .s-off { color: var(--maintenance); }
.cp-sec { display: flex; align-items: center; gap: 8px; margin: 14px 2px 8px; font-weight: 700; font-size: .95rem; color: var(--gray-600); }
.cp-sec::after { content: ""; flex: 1; height: 1px; background: rgba(255,255,255,.08); }
.cp-sec i { width: 9px; height: 9px; border-radius: 99px; background: currentColor; }
.cp-sec.s-available { color: var(--available); } .cp-sec.s-rented { color: var(--rented); } .cp-sec.s-off { color: var(--maintenance); }
.cp-list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
@media (min-width: 760px) { .cp-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1200px) { .cp-list { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.cp-row { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; min-width: 0; box-sizing: border-box; padding: 8px 10px; border-radius: 16px; border: 1px solid rgba(255,255,255,.08); border-left: 4px solid var(--st); background: rgba(255,255,255,.04); color: inherit; font: inherit; cursor: pointer; }
.cp-row:active { background: rgba(255,255,255,.08); }
.cp-row.s-available { --st: var(--available); } .cp-row.s-rented { --st: var(--rented); } .cp-row.s-maintenance { --st: var(--maintenance); } .cp-row.s-blocked { --st: var(--blocked); }
.cp-ic { flex-shrink: 0; width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; font-size: 1.15rem; background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.1); overflow: hidden; position: relative; }
.cp-ic img { width: 100%; height: 100%; object-fit: cover; }
.cp-ic .dot { position: absolute; right: 3px; bottom: 3px; width: 11px; height: 11px; border-radius: 99px; border: 2px solid #111; }
.cp-mid { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.cp-plate { font-weight: 800; font-size: 1.05rem; color: var(--gray-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cp-model { font-size: .86rem; color: var(--gray-600); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cp-info { font-size: .82rem; color: var(--gray-500); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cp-info b { color: var(--st); font-weight: 700; }
.cp-pill { flex-shrink: 0; font-size: .78rem; font-weight: 800; padding: 4px 10px; border-radius: 999px; color: var(--st); background: rgba(255,255,255,.06); border: 1px solid currentColor; }
.cp-hev { font-size: .68rem; font-weight: 800; padding: 1px 6px; border-radius: 99px; background: #22c55e; color: #052e16; margin-left: 6px; vertical-align: 2px; }
.cp-empty { text-align: center; padding: 2rem 1rem; color: var(--gray-500); }
#page-cars .custom-select-wrap:has(#carStatusFilter), #page-cars #carStatusFilter { display: none !important; }
#page-cars .page-header { flex-direction: row !important; flex-wrap: nowrap; align-items: center !important; justify-content: space-between !important; text-align: left !important; gap: 10px; }
#page-cars .page-header > * { align-items: flex-start; }
#page-cars .filter-bar { margin-bottom: 10px; }
`;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  const LABEL = { available: 'ว่าง', rented: 'เช่าอยู่', maintenance: 'ซ่อมบำรุง', blocked: 'ปิดตา' };
  const store = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
  let tab = store.get('carsTab') === 'moto' ? 'moto' : 'car', filt = '';

  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const at = (d, t) => new Date(`${d}T${(t || '00:00').padStart(5, '0')}:00`).getTime();
  const dm = (d, t) => { const [, m, dd] = d.split('-'); return `${+dd}/${+m}${t ? ' ' + t.replace(':', '.') : ''}`; };
  const isHybrid = c => c.type === 'ehev' || /e:?HEV|HEV|hybrid|e-POWER/i.test(c.model || '');

  // What the vehicle is doing now, from bookings rather than the saved flag.
  function liveOf(c, now) {
    if (c.status === 'maintenance' || c.status === 'blocked') return { s: c.status };
    const bks = (state.bookings || []).filter(b => b.carId === c.id && b.start && b.end && b.status !== 'cancelled' && b.status !== 'completed');
    const cur = bks.find(b => at(b.start, b.startTime) <= now && now < at(b.end, b.endTime || '23:59'));
    if (cur) return { s: 'rented', b: cur };
    const next = bks.filter(b => at(b.start, b.startTime) > now).sort((a, z) => at(a.start, a.startTime) - at(z.start, z.startTime))[0];
    const late = bks.find(b => at(b.end, b.endTime || '23:59') <= now && b.status === 'active');
    return late ? { s: 'rented', b: late, late: true } : { s: 'available', next };
  }

  function rowHtml(c, L) {
    const hex = (typeof CAR_COLOR_HEX !== 'undefined' && CAR_COLOR_HEX[c.color]) || '#555';
    const icon = c.photo ? `<img src="${esc(c.photo)}" alt="">` : (c.type === 'motorcycle' ? '🏍️' : '🚗');
    let info = '';
    if (L.s === 'rented') info = L.late ? `<b>เลยกำหนดคืน ${dm(L.b.end, L.b.endTime)}</b> · ${esc(L.b.customer || '')}` : `คืน <b>${dm(L.b.end, L.b.endTime)}</b> · ${esc(L.b.customer || '')}`;
    else if (L.s === 'available') info = L.next ? `คิวถัดไป <b>${dm(L.next.start, L.next.startTime)}</b> · ${esc(L.next.customer || '')}` : 'ยังไม่มีคิว';
    else info = esc(c.blockedReason || c.note || '');
    const model = [c.brand, c.model].filter(Boolean).join(' ') + (c.color ? ` · ${c.color}` : '');
    return `<button class="cp-row s-${L.s}" onclick="openCarDetail('${c.id}')">
      <span class="cp-ic">${icon}<span class="dot" style="background:${hex}"></span></span>
      <span class="cp-mid"><span class="cp-plate">${esc(c.plate)}${isHybrid(c) ? '<span class="cp-hev">HEV</span>' : ''}</span>
        <span class="cp-model">${esc(model)}${c.ownerName ? ` · ${esc(c.ownerName)}` : ''}</span>
        ${info ? `<span class="cp-info">${info}</span>` : ''}</span>
      <span class="cp-pill">${LABEL[L.s] || L.s}</span></button>`;
  }

  window.renderCarsPage = function () {
    const box = document.getElementById('carsTableContainer'); if (!box) return;
    const q = (document.getElementById('carSearch')?.value || '').toLowerCase().trim();
    const now = Date.now();
    const all = (state.cars || []).map(c => ({ c, L: liveOf(c, now) }));
    const moto = x => x.c.type === 'motorcycle';
    const inTab = all.filter(x => (tab === 'moto') === moto(x));
    const hit = inTab.filter(x => !q || `${x.c.plate} ${x.c.brand} ${x.c.model} ${x.c.color || ''} ${x.c.ownerName || ''}`.toLowerCase().includes(q));
    const grp = s => s === 'off' ? ['maintenance', 'blocked'] : [s];
    const n = s => hit.filter(x => grp(s).includes(x.L.s)).length;
    const shown = hit.filter(x => !filt || grp(filt).includes(x.L.s));
    document.getElementById('carsCount').textContent = `รถยนต์ ${all.filter(x => !moto(x)).length} คัน · มอเตอร์ไซค์ ${all.filter(moto).length} คัน`;

    let h = `<div class="cp-tabs" role="group" aria-label="ประเภทรถ">
        <button data-cptab="car" aria-pressed="${tab === 'car'}">🚗 รถยนต์<small>${all.filter(x => !moto(x)).length}</small></button>
        <button data-cptab="moto" aria-pressed="${tab === 'moto'}">🏍️ มอเตอร์ไซค์<small>${all.filter(moto).length}</small></button></div>
      <div class="cp-chips" role="group" aria-label="สถานะ">
        <button data-cpf="" aria-pressed="${!filt}">ทั้งหมด ${hit.length}</button>
        <button class="s-available" data-cpf="available" aria-pressed="${filt === 'available'}">● ว่าง ${n('available')}</button>
        <button class="s-rented" data-cpf="rented" aria-pressed="${filt === 'rented'}">● เช่าอยู่ ${n('rented')}</button>
        <button class="s-off" data-cpf="off" aria-pressed="${filt === 'off'}">● ซ่อม/ปิด ${n('off')}</button></div>`;
    if (!shown.length) h += `<div class="cp-empty">ไม่พบ${tab === 'moto' ? 'มอเตอร์ไซค์' : 'รถ'}</div>`;
    [['available', 'ว่าง'], ['rented', 'เช่าอยู่'], ['off', 'ซ่อมบำรุง / ปิดตา']].forEach(([s, t]) => {
      const rows = shown.filter(x => grp(s).includes(x.L.s));
      if (!rows.length) return;
      rows.sort((a, z) => s === 'rented' ? at(a.L.b.end, a.L.b.endTime) - at(z.L.b.end, z.L.b.endTime) : String(a.c.plate).localeCompare(String(z.c.plate), 'th'));
      h += `<div class="cp-sec s-${s}"><i></i>${t} (${rows.length})</div><div class="cp-list">${rows.map(x => rowHtml(x.c, x.L)).join('')}</div>`;
    });
    box.innerHTML = h;
  };

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-cptab],[data-cpf]'); if (!t) return;
    if (t.dataset.cptab) { tab = t.dataset.cptab; filt = ''; store.set('carsTab', tab); }
    else filt = t.dataset.cpf;
    window.renderCarsPage();
  });

  if (typeof currentPage !== 'undefined' && currentPage === 'cars') window.renderCarsPage();
})();
