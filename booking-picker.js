// "เช็คคิวรถด่วน" on the การจอง page, redesigned (owner picked mockup C5 + Yu's picks).
// Tap a day (shows how many cars are free) → time → how many days, or type dates.
// Every car shows, grouped by model + engine + daily price, coloured by how easy it is
// to rent for those dates. Tight queues get advice (rush cleaning, pick up later,
// return earlier) with one-tap buttons that open the normal booking form prefilled.
// Each booking made from here stores pickLog (what Yu suggested vs what was chosen)
// so suggestions can learn later. Loads after app.js / bookings.js.
(function () {
  const CSS = `
#page-bookings .quick-check-card { display: none !important; }
.bp { --free: #4ade80; --free-w: rgba(34,197,94,.14); --ok: #fbbf24; --ok-w: rgba(251,191,36,.13); --rush: #f97316; --rush-w: rgba(249,115,22,.2);
  --near: #c084fc; --near-w: rgba(192,132,252,.15); --busy: #f87171; --busy-w: rgba(239,68,68,.16); --off: #71717a; --off-w: rgba(161,161,170,.1);
  --edge: rgba(255,255,255,.12); --edge-2: rgba(255,255,255,.22); --glass: rgba(255,255,255,.06); --glass-2: rgba(255,255,255,.11);
  --acc: var(--primary, #facc15); --mono: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
  display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
.bp-card { border-radius: 20px; border: 1px solid var(--edge); background: var(--glass); padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.bp-h { font-weight: 700; color: var(--acc); display: flex; align-items: center; gap: 8px; }
.bp-mode { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 3px; border-radius: 12px; background: rgba(0,0,0,.35); border: 1px solid var(--edge); }
.bp-mode button { min-height: 38px; border: 0; border-radius: 9px; background: transparent; color: var(--gray-500); font: inherit; font-weight: 600; font-size: .86rem; }
.bp-mode button[aria-pressed="true"] { background: var(--glass-2); color: var(--gray-900); }
.bp-days, .bp-chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
.bp-days::-webkit-scrollbar, .bp-chips::-webkit-scrollbar { display: none; }
.bp-day { flex-shrink: 0; width: 58px; min-height: 70px; border-radius: 14px; border: 1px solid var(--edge); background: var(--glass); color: var(--gray-500); font: inherit; font-size: .74rem; font-weight: 600; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.bp-day b { font: 700 1.2rem var(--mono); color: var(--gray-900); }
.bp-day i { font-style: normal; font-size: .68rem; color: var(--free); }
.bp-day i.low { color: var(--ok); } .bp-day i.none { color: var(--busy); }
.bp-day[aria-pressed="true"] { background: var(--acc); border-color: var(--acc); color: #1a1400; }
.bp-day[aria-pressed="true"] b, .bp-day[aria-pressed="true"] i { color: #1a1400; }
.bp-row { display: flex; align-items: center; gap: 8px; }
.bp-row > span { font-size: .76rem; color: var(--gray-500); font-weight: 600; width: 44px; flex-shrink: 0; }
.bp-row .bp-chips { flex: 1; }
.bp-chip { flex-shrink: 0; min-height: 38px; padding: 0 13px; border-radius: 999px; border: 1px solid var(--edge); background: var(--glass); color: var(--gray-700); font: inherit; font-weight: 600; font-size: .88rem; }
.bp-chip[aria-pressed="true"] { border-color: var(--acc); color: var(--acc); background: rgba(250,204,21,.1); }
.bp-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.bp-pair label { display: flex; flex-direction: column; gap: 3px; font-size: .76rem; color: var(--gray-500); font-weight: 600; min-width: 0; }
.bp-pair input { width: 100%; min-height: 44px; border-radius: 12px; border: 1px solid var(--edge); background: rgba(0,0,0,.35); color: var(--gray-900); padding: 0 10px; font: inherit; }
.bp-when { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; border-radius: 14px; background: rgba(250,204,21,.08); border: 1px solid rgba(250,204,21,.35); font-size: .88rem; color: var(--gray-700); }
.bp-when b { font-family: var(--mono); color: var(--acc); }
.bp-legend { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: .78rem; color: var(--gray-500); }
.bp-legend span { display: inline-flex; align-items: center; gap: 4px; }
.bp-sw { width: 12px; height: 12px; border-radius: 4px; display: inline-block; background: var(--kc); }
.bp .k-free { --kc: var(--free); --kw: var(--free-w); } .bp .k-ok { --kc: var(--ok); --kw: var(--ok-w); } .bp .k-rush { --kc: var(--rush); --kw: var(--rush-w); }
.bp .k-near { --kc: var(--near); --kw: var(--near-w); } .bp .k-busy { --kc: var(--busy); --kw: var(--busy-w); } .bp .k-off { --kc: var(--off); --kw: var(--off-w); }
.bp-ttl { font-weight: 800; color: var(--gray-900); }
.bp-pick { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 2px 10px; align-items: center; padding: 9px 10px; border-radius: 14px; background: var(--kw); border: 1px solid color-mix(in srgb, var(--kc) 45%, transparent); }
.bp-pick b { font-size: 1rem; color: var(--gray-900); } .bp-pick small { color: var(--gray-500); font-size: .78rem; }
.bp-pick .why { font-size: .8rem; color: var(--kc); font-weight: 600; }
.bp-pick button { grid-row: 1 / span 2; grid-column: 2; }
.bp-btn { min-height: 44px; border-radius: 14px; border: 1px solid var(--acc); background: var(--acc); color: #1a1400; font: inherit; font-weight: 800; padding: 0 14px; }
.bp-gh { display: flex; align-items: baseline; gap: 8px; margin: 6px 2px 0; flex-wrap: wrap; }
.bp-gh b { font-size: 1.02rem; color: var(--gray-900); } .bp-gh small { color: var(--gray-500); font-size: .8rem; }
.bp-gh .cnt { margin-left: auto; font: 700 .9rem var(--mono); color: var(--free); } .bp-gh .cnt.none { color: var(--busy); }
.bp-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
@media (min-width: 700px) { .bp-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
.bp-t { position: relative; min-height: 84px; border-radius: 16px; border: 1px solid color-mix(in srgb, var(--kc) 40%, transparent); background: var(--kw); padding: 7px 9px; display: flex; flex-direction: column; align-items: flex-start; text-align: left; min-width: 0; color: var(--gray-900); font: inherit; cursor: pointer; }
.bp-t .no { font: 700 .7rem var(--mono); color: var(--gray-500); }
.bp-t .ic { position: absolute; top: 6px; right: 8px; font-size: .9rem; font-style: normal; color: var(--kc); }
.bp-t .pl { font-weight: 800; font-size: .98rem; line-height: 1.15; }
.bp-t .md { font-size: .72rem; color: var(--gray-500); width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bp-t .st { margin-top: auto; font-size: .74rem; font-weight: 700; color: var(--kc); width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bp-t.k-busy, .bp-t.k-off { opacity: .75; }
.bp-t.wide { grid-column: 1 / -1; min-height: 0; padding: 9px 11px; gap: 3px; opacity: 1; }
.bp-t.wide .row1 { display: flex; align-items: baseline; gap: 6px; width: 100%; padding-right: 22px; flex-wrap: wrap; }
.bp-t.wide .st { margin-top: 0; white-space: normal; }
.bp-t.wide .tips { font-size: .8rem; color: var(--gray-700); display: flex; flex-direction: column; gap: 1px; }
.bp-opts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.bp-ob { min-height: 40px; border-radius: 10px; border: 1px solid var(--kc); background: rgba(0,0,0,.3); color: var(--gray-900); font: inherit; font-weight: 700; font-size: .84rem; padding: 0 12px; }
.bp-empty { text-align: center; color: var(--gray-500); padding: 1rem; }
`;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  const DAY = 864e5, H = 36e5;
  const DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const pad = n => String(n).padStart(2, '0');
  const hm = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const dm = t => { const d = new Date(t); return `${d.getDate()}/${d.getMonth() + 1}`; };
  const fmt = t => `${DOW[new Date(t).getDay()]} ${dm(t)} ${hm(t)}`;
  const isoD = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const at = (d, t) => d ? new Date(`${d}T${(t || '10:00').padStart(5, '0')}:00`).getTime() : NaN;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const baht = n => (Math.round(n) || 0).toLocaleString();
  const dur = ms => { const m = Math.round(ms / 60000), h = Math.floor(m / 60), mm = m % 60; return h ? `${h} ชม.${mm ? ` ${mm} น.` : ''}` : `${mm} น.`; };
  const halfUp = t => Math.ceil(t / (H / 2)) * (H / 2);
  const halfDown = t => Math.floor(t / (H / 2)) * (H / 2);
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  const T0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const Q = { s: T0() + DAY + 10 * H, e: T0() + 2 * DAY + 10 * H, type: '' };
  let mode = 'tap', CLEAN = (+store.get('bpClean', 1.5) || 1.5) * H, expanded = new Set();
  const TIMES = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'], DURS = [1, 2, 3, 4, 5, 7, 10];
  const TYPE_NAME = { sedan: 'เก๋ง', hatchback: 'แฮทช์', suv: 'SUV', mpv: 'MPV/7 ที่', ppv: 'PPV', van: 'รถตู้', pickup: 'กระบะ', ev: 'EV', ehev: 'ไฮบริด', motorcycle: 'มอไซค์' };

  // Bookings that hold a car. Missing times: pickup 08:00, return = pickup time (24h rule) or 20:00.
  // A car still out past its return time stays busy until it is returned.
  function holds() {
    const now = Date.now();
    return (state.bookings || []).filter(b => b.carId && b.start && b.end && b.status !== 'completed' && b.status !== 'cancelled').map(b => {
      const s = at(b.start, b.startTime || '08:00');
      let e = at(b.end, b.endTime || b.startTime || '20:00');
      if (b.status === 'active' && e < now) e = now + H;
      return { car: b.carId, s, e, cust: b.customer || '-' };
    }).filter(x => !isNaN(x.s) && !isNaN(x.e));
  }
  let HOLD = [];
  const bookingsOf = id => HOLD.filter(b => b.car === id).sort((a, b) => a.s - b.s);
  const offLabel = c => {
    if (c.status === 'maintenance') return 'ซ่อมบำรุง';
    if (c.status === 'blocked' && !(c.blockedUntil && c.blockedUntil < isoD(Q.s))) return 'งดให้บริการ';
    return '';
  };
  function nextFree(car, from, span) {
    let t = from;
    for (let i = 0; i < 30; i++) {
      const c = bookingsOf(car.id).filter(b => b.s < t + span && b.e > t);
      if (!c.length) return t;
      t = halfUp(Math.max(...c.map(b => b.e)) + CLEAN);
    }
    return null;
  }

  const KIND = { free: ['✓', 'ว่าง', 0], ok: ['⏱', 'ทันพอดี', 1], rush: ['⚡', 'ต้องเร่งล้าง', 2], near: ['↔', 'ปรับเวลานิดเดียว', 3], busy: ['✕', 'ติดคิว', 4], off: ['🔧', 'ไม่พร้อม', 5] };
  function advise(car, S, E) {
    const span = E - S, off = offLabel(car);
    if (off) return { k: 'off', head: off, short: off, tips: ['ยังไม่ให้เช่า แนะนำคันอื่นในรุ่นเดียวกัน'], opts: [], score: 99 };
    const bs = bookingsOf(car.id), clash = bs.filter(b => b.s < E && b.e > S);
    if (clash.length) {
      const tips = [], opts = [], t = nextFree(car, S, span);
      if (t && t - S <= 6 * H) { tips.push(`ถ้าลูกค้ารับ ${fmt(t)} แทน (ช้าลง ${dur(t - S)}) จะว่างและล้างทัน`); opts.push({ label: `รับ ${hm(t)} แทน`, s: t, e: t + span }); }
      if (clash.every(b => b.s >= S)) {
        const latest = halfDown(Math.min(...clash.map(b => b.s)) - CLEAN);
        if (E - latest <= 6 * H && latest - S >= 12 * H) { tips.push(`หรือคืนเร็วขึ้นเป็น ${fmt(latest)} (ก่อนคิว ${clash[0].cust} + เวลาล้าง)`); opts.push({ label: `คืน ${hm(latest)}`, s: S, e: latest }); }
      }
      if (opts.length) return { k: 'near', head: `ชน ${clash[0].cust} นิดเดียว ปรับเวลาได้`, short: opts[0].label, tips, opts, score: 30 + (t ? (t - S) / H : 6) };
      const b = clash[0];
      return { k: 'busy', head: `ติด ${b.cust} ${dm(b.s)} ${hm(b.s)} – ${dm(b.e)} ${hm(b.e)}`, short: t ? `ว่าง ${dm(t)} ${hm(t)}` : 'ติดคิว',
        tips: [t ? `ว่างอีกทีตั้งแต่ ${fmt(t)}` : 'ช่วงนี้ไม่ว่าง'], opts: t ? [{ label: `ย้ายไป ${dm(t)} ${hm(t)}`, s: t, e: t + span }] : [], score: 60 };
    }
    const prev = bs.filter(b => b.e <= S).pop(), next = bs.find(b => b.s >= E);
    const gP = prev ? S - prev.e : Infinity, gN = next ? next.s - E : Infinity;
    const tips = [], opts = []; let k = 'free';
    if (gP < CLEAN) {
      k = 'rush';
      const s2 = halfUp(prev.e + CLEAN);
      tips.push(`รถเข้า ${hm(prev.e)} (${prev.cust}) เหลือ ${dur(gP)} ต้องเร่งล้าง`, `แนะนำนัดรับ ${hm(s2)} แทน จะล้างทันสบาย`, `ถ้าลูกค้ารับเวลาเดิม โทรเช็ค ${prev.cust} ให้คืนตรงเวลา`);
      opts.push({ label: `รับ ${hm(s2)} แทน`, s: s2, e: s2 + span });
    } else if (gP < 3 * H) {
      k = 'ok'; tips.push(`รถเข้า ${hm(prev.e)} มีเวลาล้าง ${dur(gP)} · โทรเช็ค ${prev.cust} ว่าคืนตรงเวลา`);
    }
    if (gN < CLEAN) {
      k = 'rush';
      const e2 = halfDown(next.s - CLEAN);
      tips.push(`มีคิว ${next.cust} ต่อ ${hm(next.s)} ลูกค้าต้องคืนไม่เกิน ${hm(e2)}`);
      opts.push({ label: `คืน ${hm(e2)}`, s: S, e: e2 });
    } else if (gN < 3 * H) {
      if (k === 'free') k = 'ok';
      tips.push(`มีคิวต่อ ${hm(next.s)} · ห้ามคืนเลท (เลทได้ไม่เกิน ${dur(gN - CLEAN)})`);
    }
    if (k === 'free') tips.push(next ? `คิวถัดไป ${fmt(next.s)} · ยืดวันได้` : 'ไม่มีคิวต่อ ยืดวันได้สบาย');
    const head = { free: 'ว่างสบาย', ok: 'ว่าง แต่เวลาพอดี', rush: 'ว่าง แต่ต้องเร่งล้าง' }[k];
    const short = k === 'free' ? 'ว่าง' : k === 'rush' ? 'เร่งล้าง' : (prev && gP < 3 * H) ? `เข้า ${hm(prev.e)} ทันพอดี` : `คิวต่อ ${hm(next.s)}`;
    return { k, head, short, tips, opts, score: KIND[k][2] * 10 - Math.min(Math.min(gP, gN, 7 * DAY) / H, 72) / 100 };
  }
  const isFree = ad => ad.k === 'free' || ad.k === 'ok' || ad.k === 'rush';

  // Cars: motorbikes only when มอไซค์ is picked. Order = queue order (ลำดับ).
  const ord = c => (c.orderNo === '' || c.orderNo == null || isNaN(+c.orderNo)) ? 1e9 : +c.orderNo;
  const visible = () => (state.cars || []).filter(c => Q.type ? (c.type === Q.type || (Q.type === 'ehev' && c.type !== 'motorcycle' && isHybridName(c))) : c.type !== 'motorcycle')
    .sort((a, b) => ord(a) - ord(b) || String(a.plate).localeCompare(String(b.plate), 'th'));
  const isHybridName = c => /hev|hybrid|e-power|dm-i|ไฮบริด/i.test(`${c.model}`);
  const groupLabel = c => `${c.brand || ''} ${c.model || ''}`.trim() + (c.type === 'ehev' && !isHybridName(c) ? ' Hybrid' : c.type === 'ev' ? ' EV' : '');
  function byModel(rows) {
    const m = new Map();
    rows.forEach(r => { const key = groupLabel(r.c) + '|' + (+r.c.dailyRate || 0); if (!m.has(key)) m.set(key, []); m.get(key).push(r); });
    const labels = [...m.keys()].map(k => k.split('|')[0]);
    return [...m.entries()].map(([key, cars]) => {
      const label = key.split('|')[0], rate = +cars[0].c.dailyRate || 0;
      return { name: labels.filter(x => x === label).length > 1 ? `${label} (${baht(rate)} ฿)` : label, cars, rate, free: cars.filter(r => isFree(r.ad)).length };
    }).sort((a, b) => (b.free > 0) - (a.free > 0) || ord(a.cars[0].c) - ord(b.cars[0].c));
  }
  const quote = (car, s, e) => priceBooking({ carId: car.id, start: isoD(s), startTime: hm(s), end: isoD(e), endTime: hm(e) });
  const countFree = (cars, s, e) => cars.filter(c => isFree(advise(c, s, e))).length;

  function pickerHtml(cars) {
    const span = Q.e - Q.s > 0 ? Q.e - Q.s : DAY, h0 = hm(Q.s), t0 = T0();
    const days = Array.from({ length: 14 }, (_, i) => t0 + i * DAY).map(t => {
      const s = at(isoD(t), h0), f = countFree(cars, s, s + span), d = new Date(t);
      return `<button class="bp-day" data-bpd="${isoD(t)}" aria-pressed="${isoD(t) === isoD(Q.s)}">${t === t0 ? 'วันนี้' : DOW[d.getDay()]}<b>${d.getDate()}</b><i class="${f === 0 ? 'none' : f < 4 ? 'low' : ''}">ว่าง ${f}</i></button>`;
    }).join('');
    const durNow = Math.round(span / DAY * 100) / 100;
    const types = [...new Set((state.cars || []).map(c => c.type).filter(Boolean))].sort((a, b) => (a === 'motorcycle') - (b === 'motorcycle'));
    return `<div class="bp-card"><div class="bp-h"><i class="fa-solid fa-bolt"></i> เช็คคิวรถด่วน</div>
      <div class="bp-mode" role="group" aria-label="วิธีเลือกวัน"><button data-bpm="tap" aria-pressed="${mode === 'tap'}">👆 กดเลือก</button><button data-bpm="type" aria-pressed="${mode === 'type'}">⌨️ พิมพ์วันเวลา</button></div>
      ${mode === 'tap' ? `<div class="bp-days">${days}</div>
        <div class="bp-row"><span>เวลารับ</span><div class="bp-chips">${TIMES.map(t => `<button class="bp-chip" data-bpt="${t}" aria-pressed="${h0 === t}">${t}</button>`).join('')}</div></div>
        <div class="bp-row"><span>เช่า</span><div class="bp-chips">${DURS.map(d => `<button class="bp-chip" data-bpdur="${d}" aria-pressed="${durNow === d}">${d} วัน</button>`).join('')}</div></div>`
      : `<div class="bp-pair"><label>วันรับรถ<input type="date" id="bpSd" value="${isoD(Q.s)}"></label><label>วันคืนรถ<input type="date" id="bpEd" value="${isoD(Q.e)}"></label>
        <label>เวลารับรถ<input type="time" id="bpSt" value="${hm(Q.s)}"></label><label>เวลาคืนรถ<input type="time" id="bpEt" value="${hm(Q.e)}"></label></div>`}
      <div class="bp-row"><span>ประเภท</span><div class="bp-chips"><button class="bp-chip" data-bptype="" aria-pressed="${!Q.type}">รถยนต์ทุกแบบ</button>${types.map(t => `<button class="bp-chip" data-bptype="${t}" aria-pressed="${Q.type === t}">${TYPE_NAME[t] || t}</button>`).join('')}</div></div>
      <div class="bp-row"><span>ล้างรถ</span><div class="bp-chips">${[1, 1.5, 2, 3].map(h => `<button class="bp-chip" data-bpclean="${h}" aria-pressed="${CLEAN === h * H}">${h} ชม.</button>`).join('')}</div></div>
      <div class="bp-when"><span>รับ <b>${fmt(Q.s)}</b><br>คืน <b>${fmt(Q.e)}</b></span></div></div>`;
  }

  function tileHtml(c, ad) {
    const color = c.color ? esc(c.color) : '';
    const optBtns = ad.opts.map(o => `<button class="bp-ob" data-bpo="${c.id},${o.s},${o.e}">${esc(o.label)}</button>`).join('');
    if (['ok', 'rush', 'near'].includes(ad.k) || expanded.has(c.id)) {
      return `<div class="bp-t wide k-${ad.k}" data-bpcar="${c.id}" role="button" tabindex="0"><i class="ic">${KIND[ad.k][0]}</i>
        <div class="row1"><span class="no">#${esc(c.orderNo || '-')}</span><span class="pl">${esc(c.plate)}</span><span class="md" style="width:auto">${color}</span></div>
        <span class="st">${esc(ad.head)}</span><div class="tips">${ad.tips.map(t => `<span>• ${esc(t)}</span>`).join('')}</div>
        <div class="bp-opts">${isFree(ad) || ad.k === 'busy' ? `<button class="bp-ob" data-bpo="${c.id},${Q.s},${Q.e}">${isFree(ad) ? 'จองเวลาเดิม' : 'จองทับ (เช็คอีกที)'}</button>` : ''}${optBtns}</div></div>`;
    }
    return `<button class="bp-t k-${ad.k}" data-bpcar="${c.id}"><span class="no">#${esc(c.orderNo || '-')}</span><i class="ic">${KIND[ad.k][0]}</i><span class="pl">${esc(c.plate)}</span><span class="md">${color || esc(c.model)}</span><span class="st">${esc(ad.short)}</span></button>`;
  }

  let lastPicks = [];
  function render() {
    const mount = ensureMount(); if (!mount) return;
    HOLD = holds();
    const cars = visible();
    const rows = cars.map(c => ({ c, ad: advise(c, Q.s, Q.e) }));
    const ranked = rows.filter(r => isFree(r.ad)).sort((a, b) => a.ad.score - b.ad.score || ord(a.c) - ord(b.c));
    const picks = [], seen = new Set();
    for (const r of ranked) { const g = groupLabel(r.c) + '|' + r.c.dailyRate; if (!seen.has(g)) { seen.add(g); picks.push(r); } if (picks.length === 3) break; }
    lastPicks = picks.map(r => r.c.id);
    const groups = byModel(rows);
    const order = { free: 0, ok: 1, rush: 1, near: 1, busy: 2, off: 3 };
    const html = `<div class="bp">${pickerHtml(cars)}
      ${picks.length ? `<div class="bp-card"><div class="bp-ttl">⭐ ยูแนะนำ</div>${picks.map(({ c, ad }) => { const p = quote(c, Q.s, Q.e);
        return `<div class="bp-pick k-${ad.k}"><span><b>${esc(c.plate)}</b> <small>#${esc(c.orderNo || '-')} ${esc(c.brand)} ${esc(c.model)} · ${baht(p.total)} ฿</small></span><span class="why">${KIND[ad.k][0]} ${esc(ad.tips[0] || ad.head)}</span><button class="bp-btn" data-bpo="${c.id},${Q.s},${Q.e}">+ จอง</button></div>`; }).join('')}</div>`
        : `<div class="bp-card bp-empty">ช่วงนี้ไม่มีรถว่าง ดูคันที่ "ปรับเวลานิดเดียว" ข้างล่างได้</div>`}
      <div class="bp-legend">${['free', 'ok', 'rush', 'near', 'busy', 'off'].map(k => `<span class="k-${k}"><i class="bp-sw"></i>${KIND[k][1]}</span>`).join('')}</div>
      ${groups.map(g => { const p = quote(g.cars[0].c, Q.s, Q.e);
        return `<div class="bp-gh"><b>${esc(g.name)}</b><small>${baht(g.rate)} ฿/วัน · ช่วงนี้ ${baht(p.total)} ฿</small><span class="cnt ${g.free ? '' : 'none'}">ว่าง ${g.free}/${g.cars.length}</span></div>
          <div class="bp-grid">${[...g.cars].sort((a, b) => order[a.ad.k] - order[b.ad.k] || ord(a.c) - ord(b.c)).map(r => tileHtml(r.c, r.ad)).join('')}</div>`; }).join('') || '<div class="bp-empty">ยังไม่มีรถในระบบ</div>'}
    </div>`;
    if (mount._html === html) return;
    const sx = mount.querySelector('.bp-days')?.scrollLeft;
    mount._html = html; mount.innerHTML = html;
    const days = mount.querySelector('.bp-days');
    if (days) { if (sx != null && mount._keepScroll) days.scrollLeft = sx; else { const on = days.querySelector('[aria-pressed="true"]'); if (on) days.scrollLeft = on.offsetLeft - days.clientWidth / 2 + on.clientWidth / 2; } }
    mount._keepScroll = false;
    if (mode === 'type') {
      const g = id => mount.querySelector('#' + id);
      const onStart = () => { const sp = Q.e - Q.s > 0 ? Q.e - Q.s : DAY; Q.s = at(g('bpSd').value, g('bpSt').value); Q.e = Q.s + sp; render(); };
      g('bpSd').onchange = onStart; g('bpSt').onchange = onStart;
      g('bpEd').onchange = g('bpEt').onchange = () => { Q.e = at(g('bpEd').value, g('bpEt').value); render(); };
    }
  }

  function ensureMount() {
    const page = document.getElementById('page-bookings'); if (!page) return null;
    let m = document.getElementById('bpMount');
    if (!m) { m = document.createElement('div'); m.id = 'bpMount'; const qc = page.querySelector('.quick-check-card'); if (qc) qc.before(m); else page.appendChild(m); m.addEventListener('click', onClick); }
    return m;
  }

  function onClick(e) {
    const t = e.target.closest('button,[data-bpcar]'); if (!t) return;
    const span = Q.e - Q.s > 0 ? Q.e - Q.s : DAY;
    const d = t.dataset;
    if (d.bpm) { mode = d.bpm; return render(); }
    if (d.bpd) { Q.s = at(d.bpd, hm(Q.s)); Q.e = Q.s + span; expanded.clear(); return render(); }
    if (d.bpt) { Q.s = at(isoD(Q.s), d.bpt); Q.e = Q.s + span; expanded.clear(); return render(); }
    if (d.bpdur) { Q.e = Q.s + +d.bpdur * DAY; expanded.clear(); return render(); }
    if (d.bptype != null && t.matches('[data-bptype]')) { Q.type = d.bptype; ensureMount()._keepScroll = true; return render(); }
    if (d.bpclean) { CLEAN = +d.bpclean * H; store.set('bpClean', d.bpclean); ensureMount()._keepScroll = true; return render(); }
    if (d.bpo) { e.stopPropagation(); const [id, s, en] = d.bpo.split(','); return openBooking(id, +s, +en); }
    if (d.bpcar) {
      const car = getCarById(d.bpcar); if (!car) return;
      const ad = advise(car, Q.s, Q.e);
      if (isFree(ad) && !t.classList.contains('wide')) return openBooking(car.id, Q.s, Q.e);
      if (!t.classList.contains('wide')) { expanded.add(car.id); ensureMount()._keepScroll = true; return render(); }
      if (expanded.has(car.id) && e.target === t) { expanded.delete(car.id); ensureMount()._keepScroll = true; return render(); }
    }
  }

  // Open the normal booking form, prefilled, and remember what Yu suggested.
  let pending = null;
  function openBooking(carId, s, e) {
    HOLD = holds();
    const car = getCarById(carId); if (!car) return;
    const ad = advise(car, Q.s, Q.e);
    openAddBookingModal();
    document.getElementById('bookingCar').value = carId;
    document.getElementById('bookingStart').value = isoD(s);
    document.getElementById('bookingStartTime').value = hm(s);
    document.getElementById('bookingEnd').value = isoD(e);
    document.getElementById('bookingEndTime').value = hm(e);
    calcBookingTotal();
    pending = { v: 1, at: new Date().toISOString(), ask: [isoD(Q.s), hm(Q.s), isoD(Q.e), hm(Q.e)], picks: lastPicks.slice(), car: carId,
      rank: lastPicks.indexOf(carId), advice: ad.k, shifted: s !== Q.s || e !== Q.e, clean: CLEAN / H };
  }
  const origOpen = window.openAddBookingModal;
  window.openAddBookingModal = function () { pending = null; return origOpen.apply(this, arguments); };
  const origSave = window.saveBooking;
  window.saveBooking = function () {
    const before = new Set((state.bookings || []).map(b => b.id));
    const p = pending;
    const r = origSave.apply(this, arguments);
    const added = (state.bookings || []).find(b => !before.has(b.id));
    if (p && added) {
      // picks are plates-free ids; store which car was really saved (staff may switch car in the form)
      added.pickLog = JSON.stringify({ ...p, saved: added.carId, savedRank: p.picks.indexOf(added.carId) });
      touch(added); saveToStorage(); pushToSheets(['bookings']);
      pending = null;
    }
    return r;
  };

  window.runBookingsSearch = render;
  if (typeof currentPage !== 'undefined' && currentPage === 'bookings') render();
})();
