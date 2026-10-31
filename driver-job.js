// "งานคนขับ" — car + driver jobs for close customers, priced per trip.
// One job = one customer with several trips. Each trip is saved as an ordinary
// booking row (so it holds its car in the queue only for that trip's time, and
// each trip can use a different free car), plus a driverJob JSON column that
// keeps the trip's stops, driver and how its price was worked out.
// Price is suggested from the owner's rule and can always be changed:
//   full day = 1,800 + fuel for the route; city = hours × 200–300 (all-in);
//   or Grab price + a little. Fuel for the two legs shop → pickup and
//   drop-off → shop is always added. km ÷ km/L × fuel price. Rounded to 100.
// Loads after booking-picker.js. Chains onto the current window.* functions.
(function () {
  const CSS = `
.dj-ov { position: fixed; inset: 0; z-index: 3000; background: rgba(0,0,0,.6); display: flex; justify-content: center; align-items: flex-start; overflow-y: auto; -webkit-overflow-scrolling: touch;
  padding: calc(10px + env(safe-area-inset-top, 0px)) max(10px, env(safe-area-inset-right, 0px)) calc(20px + env(safe-area-inset-bottom, 0px)) max(10px, env(safe-area-inset-left, 0px)); }
.dj { --drv: #c084fc; --drv-w: rgba(192,132,252,.16); --drv-ink: #1e0b33; --edge: rgba(255,255,255,.12); --edge-2: rgba(255,255,255,.22); --glass: rgba(255,255,255,.06);
  --acc: var(--primary, #facc15); --ok: #4ade80; --bad: #f87171; --warn: #fb923c; --mono: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
  width: 100%; max-width: 560px; background: #0f0f12; color: var(--gray-900, #f4f4f5); border: 1px solid var(--edge); border-radius: 22px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.dj * { box-sizing: border-box; }
.dj input, .dj button, .dj textarea { font: inherit; color: inherit; }
.dj-top { display: flex; align-items: center; gap: 8px; }
.dj-top h2 { margin: 0; font-size: 1.3rem; flex: 1; }
.dj-x { width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--edge); background: var(--glass); font-size: 1.3rem; }
.dj-card { background: rgba(255,255,255,.04); border: 1px solid var(--edge); border-radius: 18px; padding: 12px; display: flex; flex-direction: column; gap: 9px; }
.dj-f { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.dj-f label, .dj-lbl { font-size: .76rem; color: var(--gray-500, #a1a1aa); font-weight: 600; }
.dj-f input { width: 100%; min-height: 42px; border-radius: 12px; border: 1px solid var(--edge); background: rgba(0,0,0,.35); padding: 0 10px; }
.dj-f input[disabled] { opacity: .75; }
.dj-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.dj-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 6px; }
.dj-mono, .dj-3 input { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.dj-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.dj-chip { min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--edge); background: var(--glass); font-weight: 600; font-size: .86rem; }
.dj-chip[aria-pressed="true"] { border-color: var(--drv); color: var(--drv); background: var(--drv-w); }
.dj-chip.y[aria-pressed="true"] { border-color: var(--acc); color: var(--acc); background: rgba(250,204,21,.1); }
.dj-trip { border-left: 4px solid var(--drv); }
.dj-th { display: flex; align-items: center; gap: 8px; }
.dj-th b { font-size: 1.02rem; } .dj-th .w { color: var(--gray-500, #a1a1aa); font: 500 .85rem var(--mono); }
.dj-th .amt { margin-left: auto; font: 700 1.1rem var(--mono); color: var(--drv); }
.dj-th .del { border: 0; background: transparent; color: var(--gray-500, #a1a1aa); font-size: .8rem; text-decoration: underline; }
.dj-route { display: flex; flex-direction: column; }
.dj-stop { display: grid; grid-template-columns: 22px 1fr 32px; align-items: center; gap: 6px; position: relative; }
.dj-stop::before { content: ""; position: absolute; left: 10px; top: 0; bottom: 0; width: 2px; background: var(--edge-2); }
.dj-stop:first-child::before { top: 50%; } .dj-stop:last-child::before { bottom: 50%; }
.dj-stop .pin { width: 12px; height: 12px; border-radius: 50%; background: #0f0f12; border: 2px solid var(--drv); justify-self: center; z-index: 1; }
.dj-stop.end .pin { background: var(--drv); }
.dj-stop input { min-height: 36px; border-radius: 10px; border: 1px solid transparent; background: transparent; padding: 0 8px; width: 100%; }
.dj-stop input:hover, .dj-stop input:focus { border-color: var(--edge); background: rgba(0,0,0,.35); }
.dj-stop .x { width: 30px; height: 30px; border-radius: 50%; border: 0; background: transparent; color: var(--gray-500, #a1a1aa); }
.dj-add { align-self: flex-start; border: 1px dashed var(--edge-2); background: transparent; color: var(--gray-500, #a1a1aa); border-radius: 999px; padding: 5px 12px; font-size: .82rem; }
.dj-maps { display: flex; gap: 6px; flex-wrap: wrap; }
.dj-maps a { font-size: .82rem; color: var(--gray-700, #d4d4d8); text-decoration: none; border: 1px solid var(--edge); border-radius: 999px; padding: 6px 12px; background: var(--glass); }
.dj-cars { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
.dj-cars::-webkit-scrollbar { display: none; }
.dj-car { flex-shrink: 0; min-width: 116px; text-align: left; border-radius: 14px; border: 1px solid var(--edge); background: var(--glass); padding: 7px 10px; display: flex; flex-direction: column; gap: 1px; }
.dj-car b { font-size: .9rem; } .dj-car small { font-size: .72rem; color: var(--gray-500, #a1a1aa); }
.dj-car .st { font-size: .72rem; font-weight: 700; color: var(--ok); }
.dj-car.busy { opacity: .45; } .dj-car.busy .st { color: var(--bad); }
.dj-car[aria-pressed="true"] { border-color: var(--drv); background: var(--drv-w); opacity: 1; }
.dj-calc { background: rgba(0,0,0,.3); border-radius: 14px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.dj-lines { display: flex; flex-direction: column; gap: 3px; font-size: .88rem; }
.dj-line { display: flex; gap: 8px; align-items: baseline; }
.dj-line .t { flex: 1; min-width: 0; } .dj-line .t small { display: block; color: var(--gray-500, #a1a1aa); font: .72rem var(--mono); }
.dj-line .v { font-family: var(--mono); white-space: nowrap; }
.dj-line.m { color: var(--gray-500, #a1a1aa); }
.dj-line.sum { border-top: 1px dashed var(--edge-2); padding-top: 5px; font-weight: 700; } .dj-line.sum .v { color: var(--acc); }
.dj-final { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: end; }
.dj-final input { font: 700 1.15rem var(--mono); color: var(--drv); }
.dj-final input.ed { border-color: var(--warn); color: var(--warn); }
.dj-reset { min-height: 42px; border-radius: 12px; border: 1px solid var(--edge); background: var(--glass); padding: 0 10px; font-size: .82rem; }
.dj-ed { font-size: .78rem; color: var(--warn); }
.dj-err { font-size: .82rem; color: var(--bad); font-weight: 600; }
.dj-addtrip { border: 1px dashed var(--edge-2); background: transparent; color: var(--gray-700, #d4d4d8); border-radius: 14px; padding: 11px; font-weight: 600; }
.dj-quote { width: 100%; min-height: 140px; border-radius: 12px; border: 1px solid var(--edge); background: rgba(0,0,0,.35); padding: 10px; font-size: .84rem; resize: vertical; }
.dj-total { position: sticky; bottom: 0; z-index: 2; background: var(--drv); color: var(--drv-ink); border-radius: 18px; padding: 10px 12px; display: flex; align-items: center; gap: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.5); }
.dj-total .s { font: 700 1.3rem var(--mono); } .dj-total .p { font: .74rem var(--mono); opacity: .8; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dj-total button { border: 0; border-radius: 12px; font-weight: 800; padding: 10px 12px; }
.dj .dj-copy { background: rgba(0,0,0,.18); color: var(--drv-ink); } .dj .dj-save { background: var(--drv-ink); color: var(--drv); }
.dj-tag { display: inline-block; font-size: .68rem; font-weight: 700; background: #c084fc; color: #1e0b33; padding: 1px 7px; border-radius: 999px; margin-right: 4px; vertical-align: 1px; }
`;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  const DRIVERS = [['Top', 'ท็อป'], ['Mink', 'มิ้งค์'], ['Jay', 'เจ']];
  const DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'], MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const pad = n => String(n).padStart(2, '0');
  const isoLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => isoLocal(new Date());
  const addDay = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoLocal(d); };
  const dayName = iso => { const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? '-' : `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
  const hrs = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) + (m || 0) / 60; };
  const ms = (d, t) => new Date(`${d}T${String(t || '00:00').padStart(5, '0')}:00`).getTime();
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const baht = n => (Math.round(+n || 0)).toLocaleString('en-US');
  const round100 = n => Math.round(n / 100) * 100;
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const parseJob = b => { if (!b || !b.driverJob) return null; try { const j = typeof b.driverJob === 'string' ? JSON.parse(b.driverJob) : b.driverJob; return j && j.g ? j : null; } catch (e) { return null; } };
  window.isDriverJob = b => !!parseJob(b);

  let job = null, saveTry = false, pressing = false, needDraw = false;
  // A redraw while a finger is down would swap the button out from under the tap,
  // so changes made just before a tap wait until the tap is done.
  const later = () => { if (pressing) needDraw = true; else draw(); };
  document.addEventListener('pointerup', () => { pressing = false; if (needDraw) setTimeout(() => { if (needDraw && job) { needDraw = false; draw(); } }, 0); }, true);
  document.addEventListener('pointercancel', () => { pressing = false; }, true);

  const fuelCost = km => (+km || 0) / (+job.kml || 12.5) * (+job.fuel || 0);
  // Trip end is on the trip date, or the next day when the end time is earlier than the start.
  const tripEnd = t => (t.end && t.start && hrs(t.end) <= hrs(t.start)) ? addDay(t.date, 1) : t.date;

  function breakdown(t) {
    const lines = [], kl = `÷ ${job.kml} × ${job.fuel} ฿`;
    if (t.mode === 'day') {
      lines.push(['ค่ารถ + คนขับ เหมาวัน', '', +t.dayRate || 0]);
      lines.push(['ค่าน้ำมันเส้นทางลูกค้า', `${+t.km || 0} กม. ${kl}`, fuelCost(t.km)]);
    } else if (t.mode === 'hour') {
      lines.push(['ในเมือง รายชั่วโมง (รวมน้ำมันแล้ว)', `${+t.hours || 0} ชม. × ${t.hourRate} ฿`, (+t.hours || 0) * t.hourRate]);
    } else {
      lines.push(['ราคา Grab อ้างอิง', '', +t.grab || 0]);
      lines.push(['บวกเพิ่ม', '', +t.grabAdd || 0]);
    }
    lines.push(['2 ขาไป-กลับร้าน', `${+t.kmOut || 0}+${+t.kmBack || 0} กม. ${kl}`, fuelCost((+t.kmOut || 0) + (+t.kmBack || 0))]);
    const raw = lines.reduce((a, l) => a + l[2], 0);
    return { lines, raw, suggest: round100(raw) };
  }
  const priceOf = t => (t.final === null || t.final === '' || t.final == null) ? breakdown(t).suggest : +t.final;

  // Which bookings already hold a car over [s,e). Rows of this job are ignored.
  const mine = id => job.trips.some(t => t.id === id);
  function clashes(carId, t) {
    const s = ms(t.date, t.start), e = ms(tripEnd(t), t.end);
    const other = (state.bookings || []).find(b => b.carId === carId && !mine(b.id) && b.status !== 'completed' && b.status !== 'cancelled' && b.start && b.end &&
      ms(b.start, b.startTime || '08:00') < e && ms(b.end, b.endTime || b.startTime || '20:00') > s);
    if (other) return `ติด ${other.customer || '-'}`;
    const sib = job.trips.find(o => o !== t && o.car === carId && ms(o.date, o.start) < e && ms(tripEnd(o), o.end) > s);
    return sib ? 'ติดทริปอื่นในงานนี้' : '';
  }
  const usableCars = () => (state.cars || []).filter(c => c.type !== 'motorcycle' && !/maintenance|blocked/.test(c.status || ''))
    .sort((a, b) => ((+a.orderNo || 1e9) - (+b.orderNo || 1e9)) || String(a.plate).localeCompare(String(b.plate), 'th'));

  function mapsUrl(points) {
    const p = points.map(s => String(s || '').trim()).filter(Boolean);
    if (p.length < 2) return '';
    const u = new URL('https://www.google.com/maps/dir/');
    u.searchParams.set('api', '1'); u.searchParams.set('origin', p[0]); u.searchParams.set('destination', p[p.length - 1]);
    if (p.length > 2) u.searchParams.set('waypoints', p.slice(1, -1).join('|'));
    return u.toString();
  }

  function newTrip(prev) {
    const date = prev ? addDay(prev.date, 1) : addDay(today(), 1);
    const from = prev ? prev.stops[prev.stops.length - 1] : '';
    return { id: '', date, start: '09:00', end: '12:00', driver: prev ? prev.driver : 'Top', car: '', mode: 'hour', stops: [from, ''], note: '',
      km: 0, kmOut: 10, kmBack: 10, hours: 3, hourRate: 250, dayRate: 1800, grab: '', grabAdd: 100, final: null };
  }

  // ---------- open ----------
  function openNew() {
    job = { g: 'g' + Date.now(), customer: '', phone: '', fuel: +store.get('djFuel', 32) || 32, kml: +store.get('djKml', 12.5) || 12.5,
      home: store.get('djHome', 'สุดยอดรถเช่าเชียงใหม่'), trips: [], removed: [] };
    job.trips.push(newTrip());
    saveTry = false; draw();
  }
  function openGroup(g) {
    const rows = (state.bookings || []).filter(b => (parseJob(b) || {}).g === g)
      .sort((a, b) => (a.start + (a.startTime || '')).localeCompare(b.start + (b.startTime || '')));
    if (!rows.length) return;
    const j0 = parseJob(rows[0]);
    job = { g, customer: rows[0].customer || '', phone: rows[0].phone || '', fuel: +j0.fuel || 32, kml: +j0.kml || 12.5,
      home: store.get('djHome', 'สุดยอดรถเช่าเชียงใหม่'), removed: [], trips: rows.map(b => { const j = parseJob(b);
        return { id: b.id, status: b.status, date: b.start, start: b.startTime || '09:00', end: b.endTime || '12:00', driver: j.driver || 'Top', car: b.carId, mode: j.mode || 'hour',
          stops: Array.isArray(j.stops) && j.stops.length >= 2 ? j.stops : [b.pickupLocation || '', b.returnLocation || ''], note: j.note || '',
          km: +j.km || 0, kmOut: +j.kmOut || 0, kmBack: +j.kmBack || 0, hours: +j.hours || 0, hourRate: +j.hourRate || 250, dayRate: +j.dayRate || 1800,
          grab: j.grab || '', grabAdd: j.grabAdd == null ? 100 : +j.grabAdd, final: j.edited ? +b.total || 0 : null }; }) };
    saveTry = false; draw();
  }

  // ---------- draw ----------
  const chip = (label, on, attrs, cls = '') => `<button type="button" class="dj-chip ${cls}" aria-pressed="${!!on}" ${attrs}>${esc(label)}</button>`;
  function tripHtml(t, i) {
    const b = breakdown(t), n = t.stops.length;
    const stops = t.stops.map((s, k) => `<div class="dj-stop ${k === 0 || k === n - 1 ? 'end' : ''}"><span class="pin"></span>
      <input id="dj-s${i}-${k}" data-i="${i}" data-stop="${k}" value="${esc(s)}" placeholder="${k === 0 ? 'จุดรับลูกค้า' : k === n - 1 ? 'จุดส่งลูกค้า' : 'จุดแวะ'}" aria-label="จุดที่ ${k + 1}">
      ${n > 2 ? `<button type="button" class="x" data-i="${i}" data-delstop="${k}" aria-label="ลบจุดนี้">✕</button>` : '<span></span>'}</div>`).join('');
    const cars = usableCars().map(c => { const why = clashes(c.id, t);
      return `<button type="button" class="dj-car ${why ? 'busy' : ''}" aria-pressed="${t.car === c.id}" data-i="${i}" data-car="${c.id}">
        <b>${esc(c.plate)}</b><small>${esc([c.brand, c.model].filter(Boolean).join(' '))}${c.seats ? ` · ${esc(c.seats)} ที่` : ''}</small><span class="st">● ${why ? esc(why) : 'ว่างช่วงนี้'}</span></button>`; }).join('');
    const custUrl = mapsUrl(t.stops), allUrl = mapsUrl([job.home, ...t.stops, job.home]);
    const mode = t.mode === 'day'
      ? `<div class="dj-f"><label for="dj-dr${i}">เหมาวัน ฿</label><input id="dj-dr${i}" type="number" inputmode="numeric" data-i="${i}" data-k="dayRate" value="${t.dayRate}"></div>
         <div class="dj-f"><label for="dj-km${i}">กม. เส้นทาง</label><input id="dj-km${i}" type="number" inputmode="numeric" data-i="${i}" data-k="km" value="${t.km}"></div>
         <div class="dj-f"><label>น้ำมัน</label><input disabled value="${baht(fuelCost(t.km))} ฿"></div>`
      : t.mode === 'hour'
      ? `<div class="dj-f"><label for="dj-h${i}">ชั่วโมง</label><input id="dj-h${i}" type="number" step="0.5" inputmode="decimal" data-i="${i}" data-k="hours" value="${t.hours}"></div>
         <div class="dj-f" style="grid-column:span 2"><span class="dj-lbl">฿ ต่อชั่วโมง</span><div class="dj-chips">${[200, 250, 300].map(r => chip(r, t.hourRate === r, `data-i="${i}" data-rate="${r}"`, 'y')).join('')}</div></div>`
      : `<div class="dj-f"><label for="dj-g${i}">ราคา Grab ฿</label><input id="dj-g${i}" type="number" inputmode="numeric" data-i="${i}" data-k="grab" value="${esc(t.grab)}" placeholder="เปิดแอปดู"></div>
         <div class="dj-f" style="grid-column:span 2"><span class="dj-lbl">บวกเพิ่ม</span><div class="dj-chips">${[0, 100, 200].map(r => chip('+' + r, +t.grabAdd === r, `data-i="${i}" data-gadd="${r}"`, 'y')).join('')}</div></div>`;
    const edited = t.final !== null && +t.final !== b.suggest;
    const why = t.car ? clashes(t.car, t) : '';
    const err = saveTry && (!t.car ? 'ยังไม่ได้เลือกรถ' : why ? `รถคันนี้${why} ช่วงเวลานี้ เลือกคันอื่น` : !t.stops[0].trim() ? 'ใส่จุดรับลูกค้าก่อน' : '');
    return `<div class="dj-card dj-trip">
      <div class="dj-th"><b>${dayName(t.date)}</b><span class="w">${esc(t.start)}–${esc(t.end)}</span><span class="amt">${baht(priceOf(t))} ฿</span>
        ${job.trips.length > 1 ? `<button type="button" class="del" data-deltrip="${i}">ลบทริป</button>` : ''}</div>
      <div class="dj-3">
        <div class="dj-f"><label for="dj-d${i}">วันที่</label><input id="dj-d${i}" type="date" data-i="${i}" data-t="date" value="${esc(t.date)}"></div>
        <div class="dj-f"><label for="dj-st${i}">รับลูกค้า</label><input id="dj-st${i}" type="time" data-i="${i}" data-t="start" value="${esc(t.start)}"></div>
        <div class="dj-f"><label for="dj-en${i}">เสร็จราว</label><input id="dj-en${i}" type="time" data-i="${i}" data-t="end" value="${esc(t.end)}"></div>
      </div>
      <div class="dj-route">${stops}</div>
      <button type="button" class="dj-add" data-addstop="${i}">+ เพิ่มจุดแวะ</button>
      <div class="dj-maps" id="dj-maps${i}"${custUrl ? '' : ' hidden'}><a href="${esc(custUrl)}" target="_blank" rel="noopener">🗺️ ดูระยะเส้นทางลูกค้า</a><a href="${esc(allUrl)}" target="_blank" rel="noopener">🏠 ดูระยะรวมไป-กลับร้าน</a></div>
      <div class="dj-f"><label for="dj-n${i}">โน้ต</label><input id="dj-n${i}" data-i="${i}" data-k="note" value="${esc(t.note)}" placeholder="เช่น ช่วยถ่ายรูป, มีเด็กเล็ก"></div>
      <span class="dj-lbl">คนขับ</span>
      <div class="dj-chips">${DRIVERS.map(([id, th]) => chip(th, t.driver === id, `data-i="${i}" data-driver="${id}"`)).join('')}</div>
      <span class="dj-lbl">รถ (ว่างช่วง ${esc(t.start)}–${esc(t.end)})</span>
      <div class="dj-cars">${cars || '<span class="dj-lbl">ยังไม่มีรถในระบบ</span>'}</div>
      <div class="dj-calc">
        <span class="dj-lbl">วิธีคิดราคา</span>
        <div class="dj-chips">${chip('เหมาวัน', t.mode === 'day', `data-i="${i}" data-mode="day"`, 'y')}${chip('ในเมือง รายชั่วโมง', t.mode === 'hour', `data-i="${i}" data-mode="hour"`, 'y')}${chip('เทียบ Grab', t.mode === 'grab', `data-i="${i}" data-mode="grab"`, 'y')}</div>
        <div class="dj-3">${mode}</div>
        <div class="dj-3">
          <div class="dj-f"><label for="dj-ko${i}">ร้าน→จุดรับ กม.</label><input id="dj-ko${i}" type="number" inputmode="numeric" data-i="${i}" data-k="kmOut" value="${t.kmOut}"></div>
          <div class="dj-f"><label for="dj-kb${i}">จุดส่ง→ร้าน กม.</label><input id="dj-kb${i}" type="number" inputmode="numeric" data-i="${i}" data-k="kmBack" value="${t.kmBack}"></div>
          <div class="dj-f"><label>น้ำมัน 2 ขา</label><input disabled value="${baht(fuelCost((+t.kmOut || 0) + (+t.kmBack || 0)))} ฿"></div>
        </div>
        <div class="dj-lines">
          ${b.lines.map(l => `<div class="dj-line"><span class="t">${esc(l[0])}${l[1] ? `<small>${esc(l[1])}</small>` : ''}</span><span class="v">${baht(l[2])}</span></div>`).join('')}
          <div class="dj-line m"><span class="t">รวมก่อนปัด</span><span class="v">${baht(b.raw)}</span></div>
          <div class="dj-line sum"><span class="t">ราคาแนะนำ (ปัดเป็นหลักร้อย)</span><span class="v">${baht(b.suggest)} ฿</span></div>
        </div>
        <div class="dj-final">
          <div class="dj-f"><label for="dj-f${i}">ราคาที่ตกลงกับลูกค้า ฿</label><input id="dj-f${i}" type="number" inputmode="numeric" class="${edited ? 'ed' : ''}" data-i="${i}" data-final="1" value="${priceOf(t)}"></div>
          ${edited ? `<button type="button" class="dj-reset" data-reset="${i}">ใช้ราคาแนะนำ</button>` : ''}
        </div>
        ${edited ? `<div class="dj-ed">แก้ราคาเอง ${+t.final > b.suggest ? 'สูงกว่า' : 'ต่ำกว่า'}ราคาแนะนำ ${baht(Math.abs(+t.final - b.suggest))} ฿</div>` : ''}
      </div>
      ${err ? `<div class="dj-err">⚠ ${esc(err)}</div>` : ''}
    </div>`;
  }

  function quoteText() {
    const L = [`สรุปงานรถพร้อมคนขับ ${/^คุณ/.test(job.customer) ? '' : 'คุณ'}${job.customer || '-'}`];
    sorted().forEach(t => {
      L.push('', `${dayName(t.date)} รับ ${String(t.start).replace(':', '.')} น.`);
      t.stops.filter(s => String(s).trim()).forEach((s, k, a) => L.push(`${k === 0 ? 'รับที่' : k === a.length - 1 ? 'ส่งที่' : '  •'} ${s}`));
      if (t.note) L.push(`(${t.note})`);
      L.push(`ราคา ${baht(priceOf(t))} บาท`);
    });
    const s = sorted();
    L.push('', `รวมทั้งหมด ${s.length > 1 ? s.map(t => baht(priceOf(t))).join(' + ') + ' = ' : ''}${baht(total())} บาท`, 'ราคารวมรถ คนขับ และน้ำมันแล้ว');
    return L.join('\n');
  }
  const sorted = () => job.trips.slice().sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const total = () => job.trips.reduce((a, t) => a + priceOf(t), 0);

  function draw(focusId) {
    let ov = document.getElementById('djOv');
    if (!job) { if (ov) ov.remove(); document.body.style.overflow = ''; return; }
    const keepY = ov ? ov.scrollTop : 0, act = document.activeElement;
    if (!focusId && ov && act && act.id && ov.contains(act)) focusId = act.id;
    if (!ov) { ov = document.createElement('div'); ov.id = 'djOv'; ov.className = 'dj-ov'; document.body.appendChild(ov);
      ov.addEventListener('click', onClick); ov.addEventListener('input', onInput); ov.addEventListener('change', onChange);
      ov.addEventListener('pointerdown', () => { pressing = true; }, true); }
    document.body.style.overflow = 'hidden';
    const editing = job.trips.some(t => t.id);
    ov.innerHTML = `<div class="dj" role="dialog" aria-modal="true" aria-label="งานคนขับ">
      <div class="dj-top"><h2>🧑‍✈️ ${editing ? 'แก้งานคนขับ' : 'งานคนขับ'}</h2><button type="button" class="dj-x" data-close="1" aria-label="ปิด">×</button></div>
      <div class="dj-card">
        <div class="dj-2">
          <div class="dj-f"><label for="dj-cust">ลูกค้า</label><input id="dj-cust" data-j="customer" value="${esc(job.customer)}" placeholder="ชื่อลูกค้า"></div>
          <div class="dj-f"><label for="dj-phone">เบอร์</label><input id="dj-phone" class="dj-mono" type="tel" data-j="phone" value="${esc(job.phone)}"></div>
        </div>
        ${saveTry && !job.customer.trim() ? '<div class="dj-err">⚠ ใส่ชื่อลูกค้าก่อน</div>' : ''}
        <div class="dj-2">
          <div class="dj-f"><label for="dj-fuel">ราคาน้ำมัน ฿/ลิตร</label><input id="dj-fuel" class="dj-mono" type="number" step="0.1" inputmode="decimal" data-j="fuel" value="${job.fuel}"></div>
          <div class="dj-f"><label for="dj-kml">รถกินน้ำมัน กม./ลิตร</label><input id="dj-kml" class="dj-mono" type="number" step="0.5" inputmode="decimal" data-j="kml" value="${job.kml}"></div>
        </div>
        <div class="dj-f"><label for="dj-home">จุดออกจากร้าน (ใช้เปิดแผนที่)</label><input id="dj-home" data-j="home" value="${esc(job.home)}"></div>
      </div>
      ${job.trips.map(tripHtml).join('')}
      <button type="button" class="dj-addtrip" data-addtrip="1">+ เพิ่มทริป</button>
      <div class="dj-card"><span class="dj-lbl">ข้อความส่งลูกค้า</span><textarea class="dj-quote" id="dj-quote" readonly aria-label="ข้อความส่งลูกค้า">${esc(quoteText())}</textarea></div>
      <div class="dj-total"><div><div style="font-size:.72rem;font-weight:700">รวมทั้งงาน</div><div class="s" id="dj-sum">${baht(total())} ฿</div></div>
        <div class="p">${job.trips.length > 1 ? sorted().map(t => baht(priceOf(t))).join(' + ') : ''}</div>
        <button type="button" class="dj-copy" data-copy="1">📋 คัดลอก</button><button type="button" class="dj-save" data-save="1">บันทึก</button></div>
    </div>`;
    ov.scrollTop = keepY;
    if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus({ preventScroll: true }); try { if (el.type === 'text' || el.type === 'tel' || !el.type) el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} } }
  }

  // ---------- events ----------
  function onClick(e) {
    if (e.target.classList.contains('dj-ov')) return; // tapping outside does nothing; use ×
    const el = e.target.closest('button'); if (!el) return;
    const d = el.dataset, t = job.trips[d.i];
    needDraw = false;
    if (d.close) { job = null; return draw(); }
    if (d.driver) t.driver = d.driver;
    else if (d.car) t.car = d.car;
    else if (d.mode) { t.mode = d.mode; t.final = null; }
    else if (d.rate) t.hourRate = +d.rate;
    else if (d.gadd) t.grabAdd = +d.gadd;
    else if (d.reset) job.trips[d.reset].final = null;
    else if (d.addstop) { const x = job.trips[d.addstop]; x.stops.splice(x.stops.length - 1, 0, ''); }
    else if (d.delstop) t.stops.splice(+d.delstop, 1);
    else if (d.deltrip) { const [x] = job.trips.splice(+d.deltrip, 1); if (x.id) job.removed.push(x.id); }
    else if (d.addtrip) job.trips.push(newTrip(sorted().pop()));
    else if (d.copy) return copy();
    else if (d.save) return save();
    else return;
    draw();
  }
  function onInput(e) {
    const el = e.target, d = el.dataset, t = job.trips[d.i];
    if (d.j) { job[d.j] = (d.j === 'fuel' || d.j === 'kml') ? (+el.value || 0) : el.value;
      if (d.j === 'fuel') store.set('djFuel', el.value); if (d.j === 'kml') store.set('djKml', el.value); if (d.j === 'home') store.set('djHome', el.value);
      if (d.j === 'fuel' || d.j === 'kml') return draw(el.id);
      return refreshText(); }
    if (!t) return;
    if (d.stop) { t.stops[+d.stop] = el.value; mapLinks(+d.i); return refreshText(); }
    if (d.k === 'note') { t.note = el.value; return refreshText(); }
    if (d.final) { t.final = el.value === '' ? null : +el.value; return refreshText(); }
    if (d.k) { t[d.k] = d.k === 'grab' ? el.value : (+el.value || 0); t.final = null; return draw(el.id); }
  }
  function onChange(e) {
    const el = e.target, d = el.dataset, t = job.trips[d.i];
    if (!t) return;
    if (d.final) { t.final = el.value === '' ? null : +el.value; return later(); }
    if (d.t && el.value) { t[d.t] = el.value; if (d.t !== 'date' && t.mode === 'hour') { const h = hrs(t.end) - hrs(t.start); if (h > 0) { t.hours = Math.round(h * 2) / 2; t.final = null; } } return later(); }
  }
  function mapLinks(i) {
    const box = document.getElementById('dj-maps' + i), t = job.trips[i]; if (!box || !t) return;
    const a = box.querySelectorAll('a'), u = mapsUrl(t.stops);
    box.hidden = !u; a[0].href = u || '#'; a[1].href = mapsUrl([job.home, ...t.stops, job.home]) || '#';
  }
  function refreshText() {
    const q = document.getElementById('dj-quote'); if (q) q.value = quoteText();
    const s = document.getElementById('dj-sum'); if (s) s.textContent = baht(total()) + ' ฿';
    document.querySelectorAll('.dj-trip .amt').forEach((a, i) => { if (job.trips[i]) a.textContent = baht(priceOf(job.trips[i])) + ' ฿'; });
  }
  function copy() {
    const txt = quoteText();
    const ok = () => showToast('คัดลอกข้อความแล้ว วางในแชตลูกค้าได้เลย', 'success');
    const old = () => { const q = document.getElementById('dj-quote'); q.removeAttribute('readonly'); q.select(); try { document.execCommand('copy'); ok(); } catch (e) {} q.setAttribute('readonly', ''); };
    try { navigator.clipboard.writeText(txt).then(ok, old); } catch (e) { old(); }
  }

  // ---------- save: one booking row per trip ----------
  function save() {
    saveTry = true;
    const bad = !job.customer.trim() || job.trips.some(t => !t.car || clashes(t.car, t) || !t.date || !t.start || !t.end || !String(t.stops[0]).trim());
    if (bad) { draw(); showToast('ยังบันทึกไม่ได้ ดูจุดที่ขึ้นสีแดง', 'error'); const er = document.querySelector('.dj-err'); if (er) er.scrollIntoView({ block: 'center' }); return; }
    const now = today(), touched = new Set();
    job.trips.forEach((t, n) => {
      const stops = t.stops.map(s => String(s).trim()).filter(Boolean), price = priceOf(t), b0 = breakdown(t);
      const via = stops.slice(1, -1);
      const data = {
        carId: t.car, customer: job.customer.trim(), phone: job.phone.trim(), start: t.date, startTime: t.start, end: tripEnd(t), endTime: t.end,
        pickupLocation: stops[0] || '', returnLocation: stops[stops.length - 1] || '', rate: price, total: price, otFee: 0, lateFee: 0, discount: 0,
        note: `🧑‍✈️ งานคนขับ${via.length ? ' · แวะ ' + via.join(' → ') : ''}${t.note ? ' · ' + t.note : ''}`,
        staffOut: t.driver, staffIn: t.driver,
        driverJob: JSON.stringify({ v: 1, g: job.g, n, driver: t.driver, stops, note: t.note, mode: t.mode, km: +t.km || 0, kmOut: +t.kmOut || 0, kmBack: +t.kmBack || 0,
          hours: +t.hours || 0, hourRate: t.hourRate, dayRate: +t.dayRate || 0, grab: t.grab, grabAdd: +t.grabAdd || 0, fuel: job.fuel, kml: job.kml,
          suggest: b0.suggest, edited: price !== b0.suggest }),
        updatedAt: nowISO(),
      };
      const i = t.id ? state.bookings.findIndex(b => b.id === t.id) : -1;
      if (i > -1) {
        const ex = state.bookings[i];
        touched.add(ex.carId);
        state.bookings[i] = { ...ex, ...data, status: ex.status === 'upcoming' || !ex.status ? (t.date <= now ? 'active' : 'upcoming') : ex.status };
      } else {
        state.bookings.push({ id: 'd' + Date.now() + n, ...data, deposit: 0, bookingDeposit: 0, extra: 0, returnMileage: null, status: t.date <= now ? 'active' : 'upcoming' });
      }
      touched.add(t.car);
    });
    job.removed.forEach(id => { const b = state.bookings.find(x => x.id === id); if (b) touched.add(b.carId); state.bookings = state.bookings.filter(x => x.id !== id); markDeleted('bookings', id); });
    let carsChanged = false;
    if (typeof syncCarActiveStatus === 'function') touched.forEach(id => { if (id && syncCarActiveStatus(id)) carsChanged = true; });
    const n = job.trips.length, sum = total();
    job = null; draw();
    saveToStorage();
    pushToSheets(carsChanged ? ['bookings', 'cars'] : ['bookings']);
    if (typeof renderCurrentPage === 'function') renderCurrentPage(); else { renderBookingsPage(); renderDashboard(); }
    showToast(`บันทึกงานคนขับ ${n} ทริป รวม ${baht(sum)} ฿ แล้ว`, 'success');
  }

  // ---------- hook into the app ----------
  // Fixed price: a driver trip never follows the rental-day / late-hour rule.
  const origPrice = window.priceBooking;
  window.priceBooking = function (b) {
    const live = b && b.id ? (state.bookings || []).find(x => x.id === b.id) : null;
    if (parseJob(b) || parseJob(live)) {
      const car = getCarById(b.carId), tot = +b.total || +(live && live.total) || 0;
      return { days: 1, lateH: 0, lateRate: carLateRate(car), lateFee: 0, seatFee: 0, rate: tot, otFee: 0, discount: 0, total: tot };
    }
    return origPrice.apply(this, arguments);
  };
  // Tapping a driver trip anywhere (bookings list, queue ✎) opens the whole job.
  const origEdit = window.openEditBookingModal;
  window.openEditBookingModal = function (id) {
    const j = parseJob((state.bookings || []).find(b => b.id === id));
    if (j) return openGroup(j.g);
    return origEdit.apply(this, arguments);
  };
  // Mark driver trips in the bookings list.
  const origList = window.renderBookingsPage;
  window.renderBookingsPage = function () {
    const r = origList.apply(this, arguments);
    document.querySelectorAll('#page-bookings .bk-card, #bookingsTableContainer tr.row-clickable').forEach(el => {
      const m = /openEditBookingModal\('([^']+)'\)/.exec(el.getAttribute('onclick') || ''); if (!m) return;
      const j = parseJob((state.bookings || []).find(x => x.id === m[1]));
      if (!j || el.querySelector('.dj-tag')) return;
      const spot = el.querySelector('.bk-who') || el.children[1];
      if (spot) spot.insertAdjacentHTML('afterbegin', `<span class="dj-tag">🧑‍✈️ คนขับ ${esc((DRIVERS.find(x => x[0] === j.driver) || [, j.driver])[1])}</span>`);
    });
    return r;
  };

  function addButton() {
    const hd = document.querySelector('#page-bookings .page-header'); if (!hd || document.getElementById('djBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'djBtn'; btn.className = 'btn btn-secondary'; btn.type = 'button';
    btn.innerHTML = '🧑‍✈️ งานคนขับ'; btn.style.cssText = 'background:#c084fc;color:#1e0b33;border-color:#c084fc;font-weight:700';
    btn.onclick = openNew;
    const add = hd.querySelector('.btn-primary');
    let box = hd.querySelector('.dj-btns');
    if (add && !box) { box = document.createElement('div'); box.className = 'dj-btns'; box.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap'; add.before(box); box.appendChild(btn); box.appendChild(add); }
    else hd.appendChild(btn);
  }
  addButton();
  window.openDriverJob = openNew;
  if (typeof currentPage !== 'undefined' && currentPage === 'bookings') renderBookingsPage();
})();
