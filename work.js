// Dashboard "งานส่ง-รับรถ" for staff: one time-ordered list of today's (or
// tomorrow's) deliveries and returns, each a compact card that opens to the
// phone number, who does it, water / carseat / fuel top-up, team notes, a
// navigate button and a big done button. "📋 คัดลอก" copies the whole day as
// text for LINE. Drawn in shadow roots so its styles never touch the app's.
// Loaded after app.js and queue.js; replaces the dashboard's two old lists.
// Like prompt(), but the phone shows the number pad. Resolves to the text, or null on cancel.
function numPrompt(title, value) {
  return new Promise(done => {
    const o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    o.innerHTML = `<form style="width:100%;max-width:340px;background:#1c1d24;color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:12px;font-family:inherit">
      <b style="font-size:1.05rem"></b>
      <input inputmode="numeric" pattern="[0-9]*" autocomplete="off" style="min-height:50px;border-radius:14px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.3);color:#fff;font-size:1.3rem;padding:0 14px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button type="button" data-x style="min-height:48px;border-radius:14px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;font:inherit;font-weight:700">ยกเลิก</button>
        <button type="submit" style="min-height:48px;border-radius:14px;border:0;background:#facc15;color:#1a1400;font:inherit;font-weight:800">ตกลง</button>
      </div></form>`;
    o.querySelector('b').textContent = title;
    const inp = o.querySelector('input'); inp.value = value || '';
    const end = v => { o.remove(); done(v); };
    o.querySelector('form').onsubmit = e => { e.preventDefault(); end(inp.value); };
    o.querySelector('[data-x]').onclick = () => end(null);
    o.addEventListener('click', e => { if (e.target === o) end(null); });
    document.body.appendChild(o); setTimeout(() => inp.focus(), 30);
  });
}

(function () {
  const CSS = `:host { display: block; color: var(--text); font-family: var(--font); font-size: 15px; line-height: 1.45; -webkit-tap-highlight-color: transparent; }

/* Layout: one time-ordered job list for the day (deliveries green, returns orange), phone-first, same dark "liquid glass" look as the queue page. Each card = one job with its own big action button. */
:host {
  color-scheme: dark;
  --app: #07080d;
  --glass: rgba(255, 255, 255, .08);
  --glass-2: rgba(255, 255, 255, .14);
  --edge: rgba(255, 255, 255, .12);
  --edge-2: rgba(255, 255, 255, .22);
  --specular: inset 0 1px 0 rgba(255, 255, 255, .32), inset 0 -1px 0 rgba(255, 255, 255, .04);
  --blur: blur(20px) saturate(170%);
  --text: #f5f6fa;
  --muted: rgba(235, 238, 245, .62);
  --brand: #fde047;
  --brand-2: #f5b70a;
  --brand-ink: #1c1603;
  --go: #4ade80; --go-ink: #052e16; --go-wash: rgba(34, 197, 94, .14); --go-edge: rgba(134, 239, 172, .45);
  --back: #fb923c; --back-ink: #2a1203; --back-wash: rgba(249, 115, 22, .14); --back-edge: rgba(253, 186, 116, .45);
  --warn: #fbbf24; --bad: #f87171; --bad-wash: rgba(239, 68, 68, .16);
  --font: 'Sarabun', 'Segoe UI', system-ui, sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace;
}
* { box-sizing: border-box; }
button { font-family: inherit; color: inherit; cursor: pointer; }
button:focus-visible, a:focus-visible { outline: 3px solid var(--brand); outline-offset: 2px; }
.page { max-width: 760px; margin: 0 auto; padding: 14px; display: flex; flex-direction: column; gap: 14px; }
.badge-demo { align-self: flex-start; font-size: .78rem; font-weight: 700; color: var(--brand); padding: 4px 12px; border-radius: 999px; background: rgba(253, 224, 71, .12); border: 1px solid rgba(253, 224, 71, .35); }

/* ---- summary header ---- */
.head { border-radius: 24px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px;
  background: rgba(20, 22, 32, .72); border: 1px solid var(--edge-2); box-shadow: var(--specular), 0 10px 30px rgba(0, 0, 0, .35); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); }
.h1 { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.h1 h1 { margin: 0; font-size: 1.4rem; font-weight: 700; text-wrap: balance; }
.h1 .clock { font: 600 1.05rem var(--mono); color: var(--muted); }
.days { display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--glass); border: 1px solid var(--edge); }
.days button { border: 0; background: transparent; padding: 8px 14px; border-radius: 999px; font-weight: 600; color: var(--muted); min-height: 40px; }
.days button[aria-pressed="true"] { color: var(--brand-ink); background: linear-gradient(180deg, var(--brand), var(--brand-2)); }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.stat { border: 1px solid var(--edge); background: var(--glass); border-radius: 16px; padding: 8px 10px; display: flex; flex-direction: column; gap: 0; min-height: 64px; text-align: left; }
.stat b { font: 700 1.5rem var(--mono); line-height: 1.2; }
.stat span { font-size: .82rem; color: var(--muted); font-weight: 600; }
.stat.go b { color: var(--go); } .stat.back b { color: var(--back); }
.stat[aria-pressed="true"] { border-color: var(--edge-2); background: var(--glass-2); box-shadow: var(--specular); }
.stat.go[aria-pressed="true"] { border-color: var(--go-edge); background: var(--go-wash); }
.stat.back[aria-pressed="true"] { border-color: var(--back-edge); background: var(--back-wash); }
.prog { height: 8px; border-radius: 99px; background: var(--glass); overflow: hidden; }
.prog i { display: block; height: 100%; width: 0; border-radius: 99px; background: linear-gradient(90deg, var(--go), var(--brand)); transition: width .3s; }
.tools { display: flex; gap: 8px; align-items: center; }
.h1 { flex-wrap: nowrap; }
.h1 h1 { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: clamp(.95rem, 4.6vw, 1.3rem); }
.h1 .days { flex-shrink: 0; }
.h1 h1 small { display: block; font: 600 .78rem var(--mono); color: var(--muted); margin-top: 2px; }
.copyday { flex-shrink: 0; white-space: nowrap; min-height: 40px; padding: 0 14px; border-radius: 999px; border: 0; background: linear-gradient(180deg, var(--back), #f97316); color: var(--back-ink); box-shadow: 0 4px 14px rgba(249,115,22,.35); font-weight: 700; font-size: .95rem; }
.next { font-size: .95rem; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.next b { color: var(--brand); }

/* ---- job list ---- */
.sec { display: flex; align-items: center; gap: 10px; color: var(--muted); font-weight: 700; font-size: .9rem; margin-top: 4px; }
.sec::after { content: ""; flex: 1; height: 1px; background: var(--edge); }
.sec.late { color: var(--bad); }
.nowline { display: flex; align-items: center; gap: 8px; color: var(--brand); font: 600 .85rem var(--mono); }
.nowline::before, .nowline::after { content: ""; height: 2px; background: var(--brand); border-radius: 2px; }
.nowline::before { width: 14px; } .nowline::after { flex: 1; opacity: .5; }
.list { display: flex; flex-direction: column; gap: 10px; }
.job { border-radius: 22px; padding: 14px; display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--edge); background: var(--glass); box-shadow: var(--specular); }
.job.go { background: linear-gradient(180deg, var(--go-wash), rgba(255,255,255,.04)); border-color: var(--go-edge); }
.job.back { background: linear-gradient(180deg, var(--back-wash), rgba(255,255,255,.04)); border-color: var(--back-edge); }
.job.isLate { box-shadow: 0 0 0 2px var(--bad), 0 0 22px rgba(239, 68, 68, .35); }
.job.done { opacity: .55; background: var(--glass); border-color: var(--edge); }
.when { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.when .t { font: 700 1.9rem var(--mono); line-height: 1; letter-spacing: -.02em; }
.phone { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; border-radius: 16px; padding: 6px 8px 8px 14px; background: rgba(0,0,0,.28); border: 1px solid var(--edge); }
.phone .num { flex: 10 1 auto; min-width: 0; padding: 6px 0; font: 600 1.25rem var(--mono); letter-spacing: .01em; user-select: all; -webkit-user-select: all; white-space: nowrap; }
.phone .num.none { font: 500 1rem var(--font); color: var(--muted); }
.phone a, .phone button { flex: 1 0 auto; max-width: 100%; padding: 0 18px !important; justify-content: center; min-height: 46px; border-radius: 12px; padding: 0 14px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; text-decoration: none; flex-shrink: 0; }
.phone button { border: 1px solid var(--edge-2); background: var(--glass-2); color: var(--text); }
.phone a { color: var(--brand-ink); background: linear-gradient(180deg, var(--brand), var(--brand-2)); }
.xlist { display: flex; flex-direction: column; gap: 4px; border-radius: 14px; padding: 10px 12px; background: rgba(0,0,0,.25); border: 1px dashed var(--back-edge); font-size: .95rem; }
.xlist .r { display: flex; justify-content: space-between; gap: 10px; }
.xlist .r b { font-family: var(--mono); white-space: nowrap; }
.xlist .tot { border-top: 1px solid var(--edge); padding-top: 4px; margin-top: 2px; font-weight: 700; color: var(--brand); }
.xlist .memo { color: var(--muted); white-space: pre-wrap; }
.kind { font-size: .8rem; font-weight: 700; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.go .kind { background: var(--go); color: var(--go-ink); }
.back .kind { background: var(--back); color: var(--back-ink); }
.done .kind { background: var(--glass-2); color: var(--text); }
.lateb { font-size: .75rem; font-weight: 700; color: var(--bad); }
.car { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; min-width: 0; }
.car .plate { font-size: 1.3rem; font-weight: 700; }
.car .model { color: var(--muted); font-size: .92rem; }
.who { font-size: 1.05rem; min-width: 0; overflow-wrap: anywhere; }
.where { font-size: 1.05rem; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.where em { font-style: normal; font-size: .78rem; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: var(--glass-2); border: 1px solid var(--edge-2); }
.chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
.chip { font-size: .86rem; font-weight: 600; padding: 5px 10px; border-radius: 12px; background: rgba(0,0,0,.25); border: 1px solid var(--edge); }
.chip.ok { color: var(--go); border-color: var(--go-edge); }
.chip.mid { color: var(--warn); border-color: rgba(251, 191, 36, .45); }
.chip.bad { color: var(--bad); border-color: rgba(248, 113, 113, .5); background: var(--bad-wash); }
.chip.money { color: var(--brand); border-color: rgba(253, 224, 71, .4); }
.acts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
.acts .main { grid-column: 1 / -1; min-height: 58px !important; font-size: 1.12rem !important; }
.acts .addx { border-color: var(--back-edge) !important; color: #fed7aa !important; }
.acts a, .acts button { min-height: 54px; white-space: nowrap; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 14px; font-weight: 700; font-size: 1rem; text-decoration: none; color: var(--text); border: 1px solid var(--edge-2); background: var(--glass-2); box-shadow: var(--specular); }
.acts a { min-width: 0; } .navto { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.acts .main { border: 0; }
.go .acts .main { background: linear-gradient(180deg, #86efac, #22c55e); color: var(--go-ink); }
.back .acts .main { background: linear-gradient(180deg, #fdba74, #f97316); color: var(--back-ink); }
.done .acts .main { background: var(--glass-2); color: var(--text); border: 1px solid var(--edge-2); }
.acts .off { opacity: .35; pointer-events: none; }
.empty { text-align: center; color: var(--muted); padding: 30px 10px; border: 1px dashed var(--edge-2); border-radius: 22px; }
.toast { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(84px + env(safe-area-inset-bottom, 0px)); z-index: 2100; display: flex; align-items: center; gap: 12px; padding: 10px 10px 10px 18px; border-radius: 999px; max-width: calc(100% - 32px);
  background: rgba(30, 32, 44, .92); border: 1px solid var(--edge-2); box-shadow: 0 10px 30px rgba(0,0,0,.5); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); }
.toast button { white-space: nowrap; flex-shrink: 0; border: 0; border-radius: 999px; padding: 10px 16px; font-weight: 700; background: var(--text); color: #111; }
.legend { color: var(--muted); font-size: .85rem; display: flex; flex-direction: column; gap: 4px; }
@container app (max-width: 480px) { .copyday { padding: 0 10px !important; font-size: .82rem !important; min-height: 36px; } .h1 { gap: 6px; } .h1 .days { padding: 3px; } .h1 .days button { padding: 6px 9px !important; min-height: 34px; font-size: .82rem; } }
@container app (max-width: 345px) { .copyday { padding: 0 9px !important; } .copyday span { display: none; } .h1 .days button { padding: 6px 7px !important; font-size: .76rem; } }
@container app (max-width: 380px) { .days button { padding: 8px 10px; } .copyday { font-size: .88rem; padding: 0 10px; } .stat span { font-size: .76rem; white-space: nowrap; } .stat b { font-size: 1.3rem; } .phone button { padding: 0 10px; } .when .t { font-size: 1.6rem; } }
/* ---- extras sheet (return jobs) ---- */
.ov { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,.55); display: flex; align-items: flex-end; justify-content: center; }
.bs { width: 100%; max-width: 560px; max-height: 92vh; overflow-y: auto; border-radius: 28px 28px 0 0; display: flex; flex-direction: column; gap: 12px;
  padding: 10px max(16px, env(safe-area-inset-right, 0px)) calc(18px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
  background: linear-gradient(180deg, rgba(42, 46, 60, .97), rgba(16, 18, 26, .98)); border: 1px solid var(--edge-2); border-bottom: 0; }
.grip { width: 46px; height: 5px; border-radius: 3px; background: rgba(255,255,255,.3); margin: 0 auto; }
.bs-h { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.bs-h h2 { margin: 0; font-size: 1.25rem; }
.bs-h p { margin: 2px 0 0; color: var(--muted); }
.bs-h .x { width: 48px; height: 48px; border-radius: 999px; border: 1px solid var(--edge-2); background: var(--glass-2); font-size: 1.4rem; flex-shrink: 0; }
.quick { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.quick button { min-height: 54px; border-radius: 16px; border: 1px solid var(--edge-2); background: var(--glass-2); font-weight: 700; font-size: 1rem; text-align: left; padding: 0 12px; }
.rows { display: flex; flex-direction: column; gap: 8px; }
.row { display: grid; grid-template-columns: minmax(0, 1fr) 100px 44px; gap: 8px; align-items: center; }
.row input, .bs textarea { width: 100%; min-height: 50px; border-radius: 14px; border: 1px solid var(--edge-2); background: rgba(0,0,0,.3); color: var(--text); font: inherit; font-size: 1.05rem; padding: 10px 12px; }
.row input.amt { font-family: var(--mono); text-align: right; }
.row button { min-height: 50px; border-radius: 14px; border: 1px solid var(--edge-2); background: var(--glass); font-size: 1.2rem; }
.bs textarea { min-height: 90px; resize: vertical; }
.bs label { color: var(--muted); font-weight: 600; font-size: .9rem; }
.sumbox { border-radius: 16px; padding: 12px 14px; background: rgba(253, 224, 71, .1); border: 1px solid rgba(253, 224, 71, .4); display: flex; flex-direction: column; gap: 2px; }
.sumbox .r { display: flex; justify-content: space-between; gap: 10px; }
.sumbox .r b { font-family: var(--mono); }
.sumbox .big { font-weight: 700; font-size: 1.1rem; color: var(--brand); }
.save { min-height: 58px; border-radius: 18px; border: 0; font-weight: 700; font-size: 1.1rem; background: linear-gradient(180deg, #fdba74, #f97316); color: var(--back-ink); }
@media (prefers-reduced-motion: reduce) { .prog i { transition: none; } }

/* compact card: summary rows always shown, details on tap */
.job { padding: 0; gap: 0; border-radius: 18px; }
.job .sum { all: unset; box-sizing: border-box; width: 100%; cursor: pointer; display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; -webkit-tap-highlight-color: transparent; }
.job .sum:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; border-radius: 18px; }
.sum .r1, .sum .r2 { display: flex; align-items: center; gap: 8px; min-width: 0; }
.sum .t { font: 700 1.2rem var(--mono); letter-spacing: -.02em; flex-shrink: 0; }
.sum .plate { font-weight: 700; font-size: 1.05rem; flex-shrink: 0; }
.sum .model { color: var(--muted); font-size: .85rem; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sum .kind { flex-shrink: 0; font-size: .75rem; padding: 2px 8px; }
.sum .chev { color: var(--muted); flex-shrink: 0; width: 14px; text-align: center; }
.sum .r2 { font-size: .9rem; color: var(--muted); }
.sum .who { color: var(--text); font-size: .92rem; flex-shrink: 1; min-width: 0; max-width: 45%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; overflow-wrap: normal; }
.sum .where { font-size: .88rem; font-weight: 500; flex: 1; min-width: 0; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sum .where em { font-size: .7rem; padding: 0 5px; }
.mini { flex-shrink: 0; font-size: .72rem; font-weight: 700; padding: 2px 7px; border-radius: 999px; border: 1px solid currentColor; }
.mini.mid { color: var(--warn); } .mini.bad { color: var(--bad); background: var(--bad-wash); }
.job .more { display: flex; flex-direction: column; gap: 6px; padding: 0 12px 12px; }
.job.open:not(.isLate) { box-shadow: var(--specular), 0 6px 22px rgba(0,0,0,.35); }
.list { gap: 8px; }

.prep { display: flex; align-items: center; gap: 10px; border-radius: 14px; padding: 6px 8px 6px 14px; background: rgba(0,0,0,.25); border: 1px solid var(--edge); }
.prep .pl { flex: 1; font-weight: 600; }
.prep b { font: 700 1.3rem var(--mono); min-width: 1.4em; text-align: center; }
.prep .u { color: var(--muted); font-size: .9rem; margin-left: -6px; }
.prep .st { width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--edge-2); background: var(--glass-2); color: var(--text); font-size: 1.4rem; font-weight: 700; }
.prep .st:disabled { opacity: .35; }
.tn { display: flex; flex-direction: column; gap: 4px; font-size: .9rem; font-weight: 600; }
.tn small { color: var(--muted); font-weight: 500; }
.tn textarea { width: 100%; box-sizing: border-box; resize: vertical; min-height: 54px; border-radius: 12px; padding: 10px 12px; font: 500 1rem var(--font); color: var(--text); background: rgba(0,0,0,.3); border: 1px solid var(--edge-2); }
.tn textarea:focus { outline: 2px solid var(--brand); outline-offset: 0; }
.mini.w { color: #7dd3fc; } .mini.n { color: var(--text); border-color: var(--edge-2); }

.scroll { container: app / inline-size; }

.fuel { display: flex; flex-direction: column; gap: 8px; border-radius: 14px; padding: 10px 10px 10px 14px; background: rgba(0,0,0,.25); border: 1px solid var(--edge); }
.fuel .pl { font-weight: 600; }
.fopts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.fopts button { min-height: 42px; border-radius: 12px; border: 1px solid var(--edge-2); background: var(--glass-2); color: var(--text); font-weight: 700; font-size: .92rem; }
.fopts button[aria-pressed="true"] { background: linear-gradient(180deg, var(--brand), var(--brand-2)); color: var(--brand-ink); border-color: transparent; }
.mini.cs { color: #f9a8d4; } .mini.fu { color: var(--brand); }
.fuel2 input { width: 110px; min-height: 44px; border-radius: 12px; padding: 0 12px; text-align: right; font: 700 1.2rem var(--mono); color: var(--text); background: rgba(0,0,0,.3); border: 1px solid var(--edge-2); }
.fuel2 input:focus { outline: 2px solid var(--brand); }
.fuel2 .u { margin-left: 0 !important; }
.staff { display: flex; align-items: center; gap: 10px; border-radius: 14px; padding: 6px 6px 6px 14px; background: rgba(0,0,0,.25); border: 1px solid var(--edge); }
.staff .pl { flex-shrink: 0; font-weight: 600; }
.sopts { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.sopts button { min-height: 44px; border-radius: 12px; border: 1px solid var(--edge-2); background: var(--glass-2); color: var(--text); font-weight: 700; }
.sopts button[aria-pressed="true"] { border-color: transparent; }
.sopts .p-Top[aria-pressed="true"] { background: linear-gradient(180deg, #86efac, #22c55e); color: #052e16; }
.sopts .p-Mink[aria-pressed="true"] { background: linear-gradient(180deg, #fde047, #eab308); color: #2a2003; }
.sopts .p-Jay[aria-pressed="true"] { background: linear-gradient(180deg, #fca5a5, #ef4444); color: #2a0606; }
.who3 { display: inline-flex; gap: 3px; flex-shrink: 0; }
.pb { font-size: .72rem; font-weight: 800; padding: 2px 7px; border-radius: 999px; }
.pb.p-Top { background: #22c55e; color: #052e16; } .pb.p-Mink { background: #eab308; color: #2a2003; } .pb.p-Jay { background: #ef4444; color: #fff; }
.mini.sf { color: #c4b5fd; } .mini.nost { color: var(--muted); border-style: dashed; font-weight: 600; }
.sum .r2 { flex-wrap: wrap; row-gap: 4px; }
.sum .where { min-width: 45%; }

.wk { border-radius: 26px; background: var(--app); background-image: radial-gradient(60% 40% at 10% 0%, rgba(253, 224, 71, .10), transparent 70%), radial-gradient(50% 40% at 100% 30%, rgba(56, 189, 248, .08), transparent 70%); border: 1px solid var(--edge); overflow: hidden; }
.acts .main:disabled { opacity: .7; cursor: default; }
/* Uncle Pod's hospital trips (shop's own trips, purple) */
.job.pod { background: linear-gradient(180deg, rgba(168,85,247,.16), rgba(255,255,255,.04)); border-color: rgba(216,180,254,.45); }
.pod .kind { background: #c084fc; color: #2e1065; }
.pod .acts .main { background: linear-gradient(180deg, #d8b4fe, #a855f7); color: #2e1065; }
.podbtn { width: 100%; min-height: 44px; border-radius: 14px; border: 1px solid rgba(216,180,254,.45); background: rgba(168,85,247,.14); color: #e9d5ff; font-weight: 700; font-size: .95rem; }
.pform { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; }
.pform label { display: flex; flex-direction: column; gap: 4px; font-size: .85rem; color: var(--muted); }
.pform .w { grid-column: 1 / -1; }
.pform input { min-height: 46px; border-radius: 14px; border: 1px solid var(--edge-2); background: rgba(0,0,0,.3); color: var(--text); font: inherit; font-size: 1.02rem; padding: 8px 12px; width: 100%; box-sizing: border-box; }
.pstaff { display: flex; flex-direction: column; gap: 6px; }
.pstaff .r { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pstaff .r > span:first-child { min-width: 74px; font-weight: 700; }
.pstaff button { min-height: 42px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--edge-2); background: var(--glass-2); color: var(--text); font-weight: 700; }
.pstaff button[aria-pressed="true"].p-Top { background: #22c55e; color: #052e16; }
.pstaff button[aria-pressed="true"].p-Jay { background: #ef4444; color: #fff; }
.pstaff small { color: var(--muted); font-size: .78rem; }
.pstaff small.busy { color: #fca5a5; }
.pcars { display: flex; flex-direction: column; gap: 6px; }
.pcars button { display: flex; align-items: center; gap: 8px; text-align: left; min-height: 50px; padding: 6px 12px; border-radius: 14px; border: 1px solid var(--edge-2); background: var(--glass-2); color: var(--text); font: inherit; }
.pcars button[aria-pressed="true"] { border-color: #c084fc; background: rgba(168,85,247,.22); box-shadow: 0 0 0 1px #c084fc inset; }
.pcars b { font-size: 1rem; } .pcars .m { color: var(--muted); font-size: .85rem; flex: 1; }
.pcars .e { font-size: .82rem; font-weight: 700; color: #86efac; white-space: nowrap; }
.pcars .rec { font-size: .72rem; font-weight: 800; padding: 2px 7px; border-radius: 99px; background: #c084fc; color: #2e1065; }
.pnone { color: #fca5a5; font-size: .92rem; }
`;

  function create(R, L) {
  const iso = d => d.toISOString().slice(0, 10);
  const localToday = () => { const n = new Date(); return iso(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))); };
  let todayISO = localToday();
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const D = n => addDays(todayISO, n);
  let CARS = {}, bookings = [];
  const SPOTS = [[/สนามบิน|airport|cnx/i, '✈️', ''], [/สถานีรถไฟ|รถไฟ|train/i, '🚆', ''], [/สมบัติ/, '🚌', 'สมบัติทัวร์'], [/นครชัย/, '🚌', 'นครชัยแอร์'],
    [/(อาเขต|ขนส่ง)\s*(1|๑)/, '🚌', 'อาเขต1'], [/(อาเขต|ขนส่ง)\s*(2|๒)/, '🚌', 'อาเขต2'], [/อาเขต|สถานีขนส่ง|บขส/, '🚌', 'อาเขต'], [/หน้าร้าน|^ร้าน/, '🏠', 'ร้าน']];
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const placeHtml = p => { if (!p) return '<span style="color:var(--muted)">ยังไม่ระบุที่</span>'; const m = SPOTS.find(([re]) => re.test(p));
    const t = (window.placeLabel ? placeLabel(p) : p) || 'มีลิงก์แผนที่';
    return m ? `${m[1]}${m[2] ? `<em>${m[2]}</em>` : ''} ${m[2] && t.replace(/\s/g, '') === m[2] ? '' : esc(t)}` : `📍 ${esc(t)}`; };
  const navText = p => { const t = window.placeLabel ? placeLabel(p) : ''; return t ? `🧭 <span class="navto">นำทางไป ${esc(t)}</span>` : '🧭 นำทาง'; };
  const mapUrl = p => { const u = String(p || '').match(/https?:\/\/\S+/); return u ? u[0] : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p)}`; };
  const opened = {};
  const name = b => String(b.customer || '-');
  const baht = n => Math.round(+n || 0).toLocaleString('en-US');
  const mins = (date, time) => { const [h, m] = (time || '00:00').split(':').map(Number); return Date.parse(date + 'T00:00:00Z') / 6e4 + h * 60 + m; };
  const nowMin = () => { const n = new Date(); return Date.parse(todayISO + 'T00:00:00Z') / 6e4 + n.getHours() * 60 + n.getMinutes(); };
  const gapText = m => { const d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60; return [d ? d + ' วัน' : '', h ? h + ' ชม.' : '', !d && mm ? mm + ' นาที' : ''].filter(Boolean).join(' ') || '0 นาที'; };
  const level = m => m >= 180 ? 'ok' : m >= 60 ? 'mid' : 'bad';
  const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const dayName = s => { const d = new Date(s + 'T00:00:00Z'); return `${DOW[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };

  let done = {}, extras = {}, prep = {}, day = todayISO, filter = 'all', undo = null;
  const csv = v => String(v || '').split(/[,\s]+/).filter(Boolean);
  const safeJSON = v => { try { const o = JSON.parse(v); return o && typeof o === 'object' ? o : null; } catch (_) { return null; } };
  // Everything shown comes from the app's own bookings (state.bookings), so
  // staff on every phone see the same thing once the Sheet syncs.
  function loadData() {
    todayISO = localToday();
    if (day < todayISO) day = todayISO;
    CARS = {};
    (state.cars || []).forEach(c => { CARS[c.id] = [c.plate || '-', [c.brand, c.model].filter(Boolean).join(' ')]; });
    bookings = (state.bookings || []).filter(b => b.start && b.end && b.status !== 'cancelled');
    bookings.forEach(b => { if (!CARS[b.carId]) CARS[b.carId] = ['-', '']; });
    done = {}; extras = {}; prep = {};
    bookings.forEach(b => {
      if (b.deliveredAt || b.status === 'completed') done[b.id + ':go'] = 1;
      if (b.status === 'completed') done[b.id + ':back'] = 1;
      prep[b.id + ':go'] = { staff: csv(b.staffOut), water: +b.water || 0, cs: +b.carseat || 0, fuelAmt: +b.fuelTopup || 0, note: b.teamNote || '' };
      prep[b.id + ':back'] = { staff: csv(b.staffIn) };
      const x = safeJSON(b.returnExtras); if (x && ((x.items || []).length || x.memo)) extras[b.id + ':back'] = x;
    });
  }
  const bookingOf = jid => state.bookings.find(x => x.id === jid.split(':')[0]);
  // Write one job's prep fields back to its booking and sync (typing waits a moment).
  let saveT = null;
  function savePrep(jid, later) {
    const b = bookingOf(jid), pr = prep[jid]; if (!b || !pr) return;
    if (jid.endsWith(':go')) Object.assign(b, { staffOut: (pr.staff || []).join(','), water: +pr.water || '', carseat: +pr.cs || '', fuelTopup: +pr.fuelAmt || '', teamNote: pr.note || '' });
    else b.staffIn = (pr.staff || []).join(',');
    b.updatedAt = nowISO();
    clearTimeout(saveT);
    const go = () => { saveToStorage(); pushToSheets(['bookings']); };
    if (later) saveT = setTimeout(go, 800); else go();
  }
  function persist(b, msg, withUndo) {
    b.updatedAt = nowISO();
    syncCarActiveStatus(b.carId);
    saveToStorage();
    pushToSheets(['bookings', 'cars']);
    renderCurrentPage();
    if (msg) toast(msg, withUndo);
  }

  function jobsFor(d) {
    const J = [];
    bookings.forEach(b => {
      if (b.start === d) J.push({ k: 'go', b, time: b.startTime, at: mins(b.start, b.startTime), place: b.pickupLocation, id: b.id + ':go' });
      if (b.end === d) J.push({ k: 'back', b, time: b.endTime, at: mins(b.end, b.endTime), place: b.returnLocation, id: b.id + ':back' });
    });
    return J.sort((a, z) => a.at - z.at || (a.k === 'back' ? -1 : 1));
  }
  // Same car: the booking right before / after this one.
  const prevOf = b => bookings.filter(x => x.carId === b.carId && x.id !== b.id && mins(x.end, x.endTime) <= mins(b.start, b.startTime)).sort((a, z) => mins(z.end, z.endTime) - mins(a.end, a.endTime))[0];
  const nextOf = b => bookings.filter(x => x.carId === b.carId && x.id !== b.id && mins(x.start, x.startTime) >= mins(b.end, b.endTime)).sort((a, z) => mins(a.start, a.startTime) - mins(z.start, z.startTime))[0];

  function chipsFor(j) {
    const b = j.b, out = [];
    if (j.k === 'go') {
      const p = prevOf(b);
      if (p && p.end === b.start) { const g = j.at - mins(p.end, p.endTime); out.push(`<span class="chip ${level(g)}">รถคืนจาก${esc(name(p))} ${p.endTime.replace(':', '.')} · เตรียม ${gapText(g)}</span>`); }
      else out.push('<span class="chip ok">รถอยู่ร้าน พร้อมเตรียม</span>');
      const due = (+b.total || 0) - (+b.bookingDeposit || 0) + (+b.deposit || 0);
      if (due > 0) out.push(`<span class="chip money">💰 เก็บเงิน ฿${baht(due)}${b.deposit ? ` (รวมประกัน ${baht(b.deposit)})` : ''}</span>`);
    } else {
      const n = nextOf(b);
      if (n && n.start === b.end) { const g = mins(n.start, n.startTime) - j.at; out.push(`<span class="chip ${level(g)}">ออกต่อ ${n.startTime.replace(':', '.')} ${esc(name(n))} · เตรียม ${gapText(g)}</span>`); }
      if (+b.deposit) out.push(`<span class="chip money">💰 คืนประกัน ฿${baht(b.deposit)}</span>`);
      out.push('<span class="chip">เช็กไมล์ · น้ำมัน · รอยรถ</span>');
    }
    if (b.note) out.push(`<span class="chip">📝 ${esc(b.note)}</span>`);
    return out.join('');
  }

  const STAFF = ['Top', 'Mink', 'Jay'], HEART = { Top: '💚', Mink: '💛', Jay: '❤️' };
  const staffOf = id => (prep[id] && prep[id].staff) || [];
  // ---------- Uncle Pod's hospital trips ----------
  // A trip is an ordinary booking for "ลุงป๊อด" (total 0), so it holds the car
  // in the queue like any rental. Its start = take him to hospital, its end =
  // bring him back; staffOut / staffIn say who drives each leg.
  const POD = 'ลุงป๊อด', POD_STAFF = ['Top', 'Jay'];
  const isPod = b => /ลุงป๊อด/.test(String(b.customer || ''));
  // Rough km per litre by model; car.kmpl (if ever set) wins. eHEV cars first.
  const KMPL = [[/e:?HEV|HEV|hybrid|ไฮบริด|e-POWER/i, 25], [/Yaris Ativ/i, 23], [/Yaris/i, 22], [/City/i, 22], [/Almera|March|Mirage|Attrage/i, 22], [/Vios/i, 20], [/Jazz/i, 20], [/Corolla Cross/i, 17], [/MG ?5/i, 16], [/Veloz/i, 15], [/Mazda ?3/i, 12]];
  const kmpl = c => +c.kmpl || (c.type === 'ehev' ? 25 : 0) || ((KMPL.find(([re]) => re.test(`${c.model || ''} ${c.note || ''}`)) || [])[1]) || 14;
  const BUF = 30; // minutes kept free around another booking
  function freeCars(d, t1, t2, skipId) {
    const s0 = mins(d, t1), e0 = mins(d, t2);
    return (state.cars || []).filter(c => c.type !== 'motorcycle' && c.type !== 'ev' && !/maintenance|blocked/.test(c.status || ''))
      .filter(c => !(state.bookings || []).some(b => b.carId === c.id && b.id !== skipId && b.status !== 'cancelled' && b.status !== 'completed' && b.start && b.end &&
        mins(b.start, b.startTime) < e0 + BUF && mins(b.end, b.endTime) > s0 - BUF))
      .sort((a, z) => kmpl(z) - kmpl(a) || String(a.plate).localeCompare(String(z.plate)));
  }
  // Other jobs this person already has within an hour of time t on day d.
  function busyAt(n, d, t, skipId) {
    const at = mins(d, t), out = [];
    bookings.forEach(b => { if (b.id === skipId) return;
      if (b.start === d && csv(b.staffOut).includes(n) && Math.abs(mins(b.start, b.startTime) - at) < 60) out.push(`${b.startTime.replace(':', '.')} ${isPod(b) ? 'ลุงป๊อด' : 'ส่งรถ'}`);
      if (b.end === d && csv(b.staffIn).includes(n) && Math.abs(mins(b.end, b.endTime) - at) < 60) out.push(`${b.endTime.replace(':', '.')} ${isPod(b) ? 'ลุงป๊อด' : 'รับรถ'}`);
    });
    return out;
  }
  const pickFree = (d, t, skip, avoid) => POD_STAFF.find(n => n !== avoid && !busyAt(n, d, t, skip).length) || POD_STAFF.find(n => !busyAt(n, d, t, skip).length) || 'Top';
  function openPod() {
    const last = [...(state.bookings || [])].reverse().find(b => isPod(b) && b.pickupLocation);
    const p = { pod: true, date: day, go: '08:00', back: '12:00', place: last ? last.pickupLocation : '' };
    p.sOut = pickFree(p.date, p.go); p.sIn = pickFree(p.date, p.back);
    sheet = p; drawSheet();
  }
  function drawPod() {
    const p = sheet, host = L.getElementById('sheetHost');
    const cars = p.back > p.go ? freeCars(p.date, p.go, p.back) : [];
    if (!cars.some(c => c.id === p.carId)) p.carId = cars[0] ? cars[0].id : '';
    const who = (leg, t) => `<div class="r"><span>${leg} ${t.replace(':', '.')}</span>${POD_STAFF.map(n => {
      const bz = busyAt(n, p.date, t); return `<button class="p-${n}" data-podstaff="${leg === 'ไปส่ง' ? 'sOut' : 'sIn'}:${n}" aria-pressed="${p[leg === 'ไปส่ง' ? 'sOut' : 'sIn'] === n}">${n}</button><small class="${bz.length ? 'busy' : ''}">${bz.length ? 'ติด ' + bz.join(', ') : 'ว่าง'}</small>`; }).join('')}</div>`;
    host.innerHTML = `<div class="ov" data-close="bg"><div class="bs" role="dialog" aria-modal="true" aria-label="นัดลุงป๊อดไปโรงพยาบาล">
      <div class="grip"></div>
      <div class="bs-h"><div><h2>🏥 นัดลุงป๊อด</h2><p>พาไปโรงพยาบาลและรับกลับ</p></div><button class="x" data-close="x" aria-label="ปิด">×</button></div>
      <div class="pform">
        <label class="w">วันที่นัด<input type="date" id="pd-date" value="${p.date}"></label>
        <label>ไปส่ง (ออกจากร้าน)<input type="time" id="pd-go" value="${p.go}"></label>
        <label>ไปรับกลับ<input type="time" id="pd-back" value="${p.back}"></label>
        <label class="w">โรงพยาบาล<input id="pd-place" value="${esc(p.place)}" placeholder="เช่น รพ.นครพิงค์"></label>
      </div>
      <label>👤 ใครไป</label>
      <div class="pstaff">${who('ไปส่ง', p.go)}${who('ไปรับ', p.back)}</div>
      <label>🚗 รถที่ว่าง (ประหยัดน้ำมันสุดอยู่บน)</label>
      <div class="pcars">${p.back <= p.go ? '<div class="pnone">เวลาไปรับต้องหลังเวลาไปส่ง</div>' : cars.length ? cars.slice(0, 6).map((c, i) => `<button data-podcar="${c.id}" aria-pressed="${c.id === p.carId}"><b>${esc(c.plate)}</b><span class="m">${esc([c.model, c.type === 'ehev' ? 'eHEV' : ''].filter(Boolean).join(' '))}</span><span class="e">⛽ ~${kmpl(c)} กม./ลิตร</span>${i === 0 ? '<span class="rec">แนะนำ</span>' : ''}</button>`).join('') : '<div class="pnone">ช่วงเวลานี้ไม่มีรถว่างเลย</div>'}</div>
      <button class="save" data-podsave="1"${p.carId ? '' : ' disabled'}>บันทึกนัด</button>
    </div></div>`;
  }
  function savePod() {
    const p = sheet; if (!p.carId) return;
    const b = { id: 'p' + Date.now(), carId: p.carId, customer: POD, phone: '', start: p.date, startTime: p.go, end: p.date, endTime: p.back,
      pickupLocation: p.place.trim(), returnLocation: p.place.trim(), rate: 0, otFee: 0, total: 0, deposit: 0, bookingDeposit: 0,
      status: p.date <= todayISO ? 'active' : 'upcoming', note: '', extra: 0, staffOut: p.sOut, staffIn: p.sIn, updatedAt: nowISO() };
    state.bookings.push(b); sheet = null; drawSheet();
    if (p.date === todayISO || p.date === D(1)) day = p.date;
    persist(b, `นัดลุงป๊อด ${dayName(p.date)} ${p.go.replace(':', '.')} · ${(CARS[b.carId] || [''])[0] || getCarById(b.carId).plate} · ${p.sOut}`, false);
  }
  function staffHtml(j) {
    const st = staffOf(j.id);
    return `<div class="staff"><span class="pl">👤 ใครทำ</span><div class="sopts">${(isPod(j.b) ? POD_STAFF : STAFF).map(n => `<button class="p-${n}" data-staff="${n}" data-j="${j.id}" aria-pressed="${st.includes(n)}">${n}</button>`).join('')}</div></div>`;
  }
  function prepHtml(j) {
    const pr = prep[j.id] || {}, w = +pr.water || 0, cs = +pr.cs || 0;
    return `<div class="prep"><span class="pl">💧 เตรียมน้ำ</span>
        <button class="st" data-w="-1" data-j="${j.id}" aria-label="ลดน้ำ"${w ? '' : ' disabled'}>−</button><b>${w}</b><span class="u">ชุด</span><button class="st" data-w="1" data-j="${j.id}" aria-label="เพิ่มน้ำ">+</button></div>
      <div class="prep"><span class="pl">👶 Carseat</span>
        <button class="st" data-cs="-1" data-j="${j.id}" aria-label="ลด carseat"${cs ? '' : ' disabled'}>−</button><b>${cs}</b><span class="u">ตัว</span><button class="st" data-cs="1" data-j="${j.id}" aria-label="เพิ่ม carseat">+</button></div>
      <label class="prep fuel2"><span class="pl">⛽ ซ่อมน้ำมัน</span><input data-fuelamt="${j.id}" inputmode="numeric" placeholder="0" value="${+pr.fuelAmt || ''}" aria-label="ซ่อมน้ำมัน (บาท)"><span class="u">บาท</span></label>
      <label class="tn"><span>🗒 โน้ตทีม <small>(ทีมเห็นกันเอง · ติดไปตอนคัดลอก)</small></span>
        <textarea data-tnote="${j.id}" rows="2" placeholder="เช่น ลูกค้ารอประตู 3, โทรก่อนถึง 10 นาที">${esc(pr.note || '')}</textarea></label>`;
  }
  function podCard(j, isLate) {
    const b = j.b, [plate, model] = CARS[b.carId], isDone = !!done[j.id], st = staffOf(j.id), isOpen = !!opened[j.id], go = j.k === 'go';
    return `<article class="job pod${isDone ? ' done' : ''}${isLate ? ' isLate' : ''}${isOpen ? ' open' : ''}">
      <button class="sum" data-open="${j.id}" aria-expanded="${isOpen}">
        <span class="r1"><span class="t">${j.time.replace(':', '.')}</span><span class="plate">${plate}</span><span class="model">${model}</span><span class="kind">${isDone ? '✓ ' : ''}${go ? '🏥 ไปส่งลุง' : '🏥 รับลุงกลับ'}</span><span class="chev">${isOpen ? '▴' : '▾'}</span></span>
        <span class="r2">${st.length ? `<span class="who3">${st.map(n => `<span class="pb p-${n}">${n}</span>`).join('')}</span>` : '<span class="mini nost">👤 ?</span>'}<span class="who">ลุงป๊อด</span><span class="where">${placeHtml(j.place)}</span>${isLate ? `<span class="mini bad">เลย ${gapText(nowMin() - j.at)}</span>` : ''}</span>
      </button>
      ${isOpen ? `<div class="more">
      ${staffHtml(j)}
      <div class="chips"><span class="chip">${go ? `🏥 พาลุงป๊อดไป${esc(j.place || 'โรงพยาบาล')} · รับกลับ ${b.endTime.replace(':', '.')}` : `🏥 รับลุงป๊อดกลับจาก${esc(j.place || 'โรงพยาบาล')}`}</span>${b.note ? `<span class="chip">📝 ${esc(b.note)}</span>` : ''}</div>
      <div class="acts">
        <a class="${j.place ? '' : 'off'}" href="${j.place ? mapUrl(j.place) : '#'}" target="_blank" rel="noopener">${navText(j.place)}</a>
        <button class="main" data-done="${j.id}"${isDone && !go ? ' disabled' : ''}>${isDone ? (go ? '↺ ยังไม่ได้ไป' : '✓ ลุงถึงบ้านแล้ว') : go ? '✓ ส่งลุงถึงแล้ว' : '✓ รับลุงกลับแล้ว'}</button>
      </div></div>` : ''}
    </article>`;
  }
  function card(j, isLate) {
    if (isPod(j.b)) return podCard(j, isLate);
    const b = j.b, [plate, model] = CARS[b.carId], isDone = !!done[j.id], digits = String(b.phone || '').replace(/[^\d+]/g, '');
    const lateMin = nowMin() - j.at, x = extras[j.id];
    const phone = b.phone
      ? `<div class="phone"><span class="num">${esc(formatPhone(b.phone))}</span><a href="tel:${digits}" target="_blank" rel="noopener">📞 โทร</a></div>`
      : `<div class="phone"><span class="num none">ไม่มีเบอร์ลูกค้า</span></div>`;
    const pr = (j.k === 'go' && prep[j.id]) || {}, st = staffOf(j.id);
    const isOpen = !!opened[j.id], b2 = j.k === 'go' ? prevOf(b) : nextOf(b);
    const gap = b2 && (j.k === 'go' ? b2.end === b.start : b2.start === b.end) ? (j.k === 'go' ? j.at - mins(b2.end, b2.endTime) : mins(b2.start, b2.startTime) - j.at) : null;
    const flag = gap !== null && level(gap) !== 'ok' ? `<span class="mini ${level(gap)}">⏱ ${gap <= 0 ? 'ต่อทันที' : gapText(gap)}</span>` : '';
    return `<article class="job ${j.k}${isDone ? ' done' : ''}${isLate ? ' isLate' : ''}${isOpen ? ' open' : ''}">
      <button class="sum" data-open="${j.id}" aria-expanded="${isOpen}">
        <span class="r1"><span class="t">${j.time.replace(':', '.')}</span><span class="plate">${plate}</span><span class="model">${model}</span><span class="kind">${isDone ? '✓ ' : ''}${j.k === 'go' ? 'ส่ง' : 'รับคืน'}</span><span class="chev">${isOpen ? '▴' : '▾'}</span></span>
        <span class="r2">${st.length ? `<span class="who3">${st.map(n => `<span class="pb p-${n}">${n}</span>`).join('')}</span>` : '<span class="mini nost">👤 ?</span>'}<span class="who">${esc(name(b))}</span><span class="where">${placeHtml(j.place)}</span>${isLate ? `<span class="mini bad">เลย ${gapText(lateMin)}</span>` : ''}${flag}${pr.water ? `<span class="mini w">💧${pr.water}</span>` : ''}${pr.cs ? `<span class="mini cs">👶${pr.cs}</span>` : ''}${+pr.fuelAmt ? `<span class="mini fu">⛽${baht(pr.fuelAmt)}</span>` : ''}${pr.note ? '<span class="mini n">🗒</span>' : ''}</span>
      </button>
      ${isOpen ? `<div class="more">
      ${phone}
      ${staffHtml(j)}
      ${j.k === 'go' ? prepHtml(j) : ''}
      <div class="chips">${chipsFor(j)}</div>
      ${j.k === 'back' && x ? xlistHtml(b, x) : ''}
      <div class="acts">
        <a class="${j.place ? '' : 'off'}" href="${j.place ? mapUrl(j.place) : '#'}" target="_blank" rel="noopener"${j.k === 'go' ? ' style="grid-column:1/-1"' : ''}>${navText(j.place)}</a>
        ${j.k === 'back' ? `<button class="addx" data-extra="${j.id}">${x ? '✎ แก้บันทึก' : '➕ บันทึกเพิ่ม'}</button>` : ''}
        <button class="main" data-done="${j.id}"${isDone && (j.k === 'back' || b.status === 'completed') ? ' disabled' : ''}>${isDone ? (j.k === 'back' || b.status === 'completed' ? '✓ คืนรถแล้ว' : '↺ ยังไม่ได้ส่ง') : j.k === 'go' ? '✓ ส่งรถแล้ว' : '✓ รับคืนแล้ว'}</button>
      </div></div>` : ''}
    </article>`;
  }
  // ---------- extra charges / events on a return ----------
  const QUICK = [['⛽', 'เติมน้ำมัน'], ['⏰', 'คืนช้า / ค่าปรับ'], ['🧽', 'ค่าทำความสะอาด'], ['🚗', 'รอย / ความเสียหาย'], ['🛣️', 'ค่าทางด่วน / ที่จอด'], ['🧾', 'อื่นๆ']];
  const xTotal = x => (x.items || []).reduce((t, i) => t + (+i.amt || 0), 0);
  function moneyLines(b, x) {
    const tot = xTotal(x), dep = +b.deposit || 0, back = dep - tot;
    return { tot, dep, line: dep ? (back >= 0 ? `คืนประกันลูกค้า ฿${baht(back)}` : `เก็บเพิ่มจากลูกค้าอีก ฿${baht(-back)}`) : (tot ? `เก็บเพิ่มจากลูกค้า ฿${baht(tot)}` : '') };
  }
  function xlistHtml(b, x) {
    const m = moneyLines(b, x);
    return `<div class="xlist">${(x.items || []).map(i => `<div class="r"><span>${esc(i.label)}</span><b>฿${baht(i.amt)}</b></div>`).join('')}
      ${x.memo ? `<div class="memo">📝 ${esc(x.memo)}</div>` : ''}
      ${m.line ? `<div class="r tot"><span>${m.dep && m.tot ? `ประกัน ${baht(m.dep)} − ${baht(m.tot)} → ` : ''}${m.line}</span></div>` : ''}</div>`;
  }
  let sheet = null;
  function openSheet(jid) {
    const [bid] = jid.split(':'), b = bookings.find(x => x.id === bid), cur = extras[jid] || { items: [], memo: '' };
    sheet = { jid, b, items: cur.items.map(i => ({ ...i })), memo: cur.memo || '' };
    drawSheet();
    setTimeout(() => { const f = L.querySelector('.bs .amt:last-of-type'); if (f && !f.value) f.focus(); }, 50);
  }
  function drawSheet() {
    const host = L.getElementById('sheetHost');
    if (!sheet) { host.innerHTML = ''; return; }
    if (sheet.pod) { drawPod(); return; }
    const b = sheet.b, m = moneyLines(b, sheet);
    host.innerHTML = `<div class="ov" data-close="bg"><div class="bs" role="dialog" aria-modal="true" aria-label="บันทึกเพิ่มตอนรับรถคืน">
      <div class="grip"></div>
      <div class="bs-h"><div><h2>บันทึกเพิ่ม · รับรถคืน</h2><p>${CARS[b.carId][0]} · ${esc(name(b))}</p></div><button class="x" data-close="x" aria-label="ปิด">×</button></div>
      <label>แตะเพื่อเพิ่มรายการ</label>
      <div class="quick">${QUICK.map(([ic, t], i) => `<button data-q="${i}">${ic} ${t}</button>`).join('')}</div>
      <div class="rows">${sheet.items.map((i, k) => `<div class="row"><input id="xl${k}" data-k="${k}" data-fld="label" value="${esc(i.label)}" aria-label="รายการ">
        <input id="xa${k}" class="amt" data-k="${k}" data-fld="amt" inputmode="numeric" placeholder="บาท" value="${i.amt || ''}" aria-label="จำนวนเงิน">
        <button data-rm="${k}" aria-label="ลบรายการ">×</button></div>`).join('')}</div>
      <label for="xmemo">เหตุการณ์ / หมายเหตุ</label>
      <textarea id="xmemo" placeholder="เช่น ลูกค้าแจ้งยางรั่ว, น้ำมันเหลือ 1/2, ไฟเตือนขึ้น">${esc(sheet.memo)}</textarea>
      <div class="sumbox" id="sumbox">${sumHtml(m)}</div>
      <button class="save" data-save="1">บันทึก</button>
    </div></div>`;
  }
  const sumHtml = m => `<div class="r"><span>รวมเก็บเพิ่ม</span><b>฿${baht(m.tot)}</b></div>${m.dep ? `<div class="r"><span>เงินประกัน</span><b>฿${baht(m.dep)}</b></div>` : ''}${m.line ? `<div class="big">${m.line}</div>` : ''}`;
  L.addEventListener('change', e => {
    if (!sheet || !sheet.pod) return;
    const t = e.target, k = { 'pd-date': 'date', 'pd-go': 'go', 'pd-back': 'back' }[t.id]; if (!k || !t.value) return;
    sheet[k] = t.value; drawPod();
  });
  L.addEventListener('input', e => {
    if (!sheet) return;
    const t = e.target;
    if (sheet.pod) { if (t.id === 'pd-place') sheet.place = t.value; return; }
    if (t.id === 'xmemo') sheet.memo = t.value;
    else if (t.dataset.k != null) { const it = sheet.items[+t.dataset.k]; if (t.dataset.fld === 'amt') { t.value = t.value.replace(/[^\d]/g, ''); it.amt = +t.value || 0; } else it.label = t.value; }
    L.getElementById('sumbox').innerHTML = sumHtml(moneyLines(sheet.b, sheet));
  });
  // Whole day's jobs as plain text, ready to paste into the shop's LINE group.
  function daySummary(d) {
    const J = jobsFor(d), pad = d.split('-'), yy = String((+pad[0] + 543) % 100).padStart(2, '0');
    const nPod = J.filter(j => isPod(j.b)).length, nGo = J.filter(j => j.k === 'go' && !isPod(j.b)).length;
    const L = [`📋 งานส่ง-รับรถ ${dayName(d)}/${yy}`, `🟢 ส่ง ${nGo} · 🟠 รับคืน ${J.length - nGo - nPod}${nPod ? ` · 🏥 ลุงป๊อด ${nPod}` : ''}`];
    if (!J.length) L.push('', 'ไม่มีงาน');
    J.forEach(j => {
      const b = j.b, [plate, model] = CARS[b.carId], p4 = (plate.match(/\d+(?=\D*$)/) || [plate])[0], short = model.replace(/^(Toyota|Honda|MG|Mazda|Mitsubishi|Nissan|Isuzu)\s+/, ''), mdl = /^\d+$/.test(short) ? model : short;
      const st = staffOf(j.id);
      if (isPod(b)) {
        L.push('', `${done[j.id] ? '✅' : '🏥'} ${j.time.replace(':', '.')} ${j.k === 'go' ? 'ไปส่งลุงป๊อด' : 'รับลุงป๊อดกลับ'} ${mdl} ${p4}`);
        L.push(`   👷 ${st.length ? st.map(n => HEART[n] + n).join(' ') : 'ยังไม่มีคน'}`);
        if (j.place) L.push(`   📍 ${j.place}`);
        if (b.note) L.push(`   📝 ${b.note}`);
        return;
      }
      L.push('', `${done[j.id] ? '✅' : j.k === 'go' ? '🟢' : '🟠'} ${j.time.replace(':', '.')} ${j.k === 'go' ? 'ส่งรถ' : 'รับรถคืน'} ${mdl} ${p4}`);
      L.push(`   👷 ${st.length ? st.map(n => HEART[n] + n).join(' ') : 'ยังไม่มีคน'}`);
      L.push(`   ${name(b)}${b.phone ? ' ' + formatPhone(b.phone) : ''}`);
      if (j.place) L.push(`   📍 ${j.place}`);
      const D = [];
      if (j.k === 'go') {
        const due = (+b.total || 0) - (+b.bookingDeposit || 0) + (+b.deposit || 0);
        if (due > 0) D.push(`💰 เก็บ ${baht(due)}`);
        const pr = prep[j.id] || {};
        if (+pr.water) D.push(`💧 น้ำ ${pr.water} ชุด`);
        if (+pr.cs) D.push(`👶 Carseat ${pr.cs} ตัว`);
        if (+pr.fuelAmt) D.push(`⛽ ซ่อมน้ำมัน ${baht(pr.fuelAmt)} บาท`);
        if (pr.note) D.push(`🗒 ${pr.note.replace(/\n+/g, ' / ')}`);
      } else {
        const n = nextOf(b);
        if (n && n.start === b.end) D.push(`🧽 ล้างออกต่อ ${n.startTime.replace(':', '.')}`);
        const x = extras[j.id];
        if (x) { (x.items || []).forEach(i => D.push(`${i.label} ${baht(i.amt)} บาท`)); if (x.memo) D.push(`📝 ${x.memo}`); }
      }
      if (b.note) D.push(`📝 ${b.note}`);
      D.forEach(t => L.push(`   ${t}`));
    });
    return L.join('\n');
  }
  function copy(t, msg) {
    const ok = () => toast(msg || `คัดลอกเบอร์ ${t} แล้ว`, false);
    const old = () => { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (_) { toast('คัดลอกไม่ได้ ลองใหม่อีกครั้ง', false); } ta.remove(); };
    try { navigator.clipboard.writeText(t).then(ok, old); } catch (_) { old(); }
  }

  function draw() {
    const J = jobsFor(day), nGo = J.filter(j => j.k === 'go').length, nBack = J.length - nGo, nDone = J.filter(j => done[j.id]).length;
    const isToday = day === todayISO, t = nowMin();
    const next = J.find(j => !done[j.id] && (!isToday || j.at >= t - 0)) || J.find(j => !done[j.id]);
    const n = new Date();
    R.getElementById('head').innerHTML = `
      <div class="h1"><h1>งานส่ง-รับรถ<small>${dayName(day)}</small></h1><button class="copyday" data-copyday="1" aria-label="คัดลอกสรุป">📋<span> คัดลอก</span></button><div class="days" role="group" aria-label="เลือกวัน"><button data-day="${todayISO}" aria-pressed="${isToday}">วันนี้</button><button data-day="${D(1)}" aria-pressed="${day === D(1)}">พรุ่งนี้</button></div></div>
      <div class="stats">
        <button class="stat" data-f="all" aria-pressed="${filter === 'all'}"><b>${nDone}/${J.length}</b><span>เสร็จแล้ว</span></button>
        <button class="stat go" data-f="go" aria-pressed="${filter === 'go'}"><b>${nGo}</b><span>🟢 ส่งรถ</span></button>
        <button class="stat back" data-f="back" aria-pressed="${filter === 'back'}"><b>${nBack}</b><span>🟠 รับคืน</span></button>
      </div>
      <div class="prog" aria-hidden="true"><i style="width:${J.length ? nDone / J.length * 100 : 0}%"></i></div>
      <button class="podbtn" data-pod="1">🏥 นัดลุงป๊อดไปโรงพยาบาล</button>
      ${next ? `<div class="next">ถัดไป <b>${next.time.replace(':', '.')} ${isPod(next.b) ? (next.k === 'go' ? 'ไปส่งลุงป๊อด' : 'รับลุงป๊อดกลับ') : next.k === 'go' ? 'ส่ง' : 'รับคืน'} ${CARS[next.b.carId][0]}</b><span>${placeHtml(next.place)}</span></div>` : J.length ? '<div class="next"><b>เสร็จครบทุกงานแล้ว 🎉</b></div>' : ''}`;

    const shown = J.filter(j => filter === 'all' || j.k === filter);
    const late = isToday ? shown.filter(j => !done[j.id] && j.at < t) : [];
    const todo = shown.filter(j => !done[j.id] && !late.includes(j));
    const fin = shown.filter(j => done[j.id]);
    let h = '';
    if (!shown.length) h = `<div class="empty">ไม่มีงาน${filter === 'go' ? 'ส่งรถ' : filter === 'back' ? 'รับรถคืน' : ''}${isToday ? 'วันนี้' : 'พรุ่งนี้'}</div>`;
    if (late.length) h += `<div class="sec late">⚠ เลยเวลาแล้ว ยังไม่ได้ทำ (${late.length})</div>` + late.map(j => card(j, true)).join('');
    if (todo.length) {
      if (isToday) h += `<div class="nowline">ตอนนี้ ${String(n.getHours()).padStart(2, '0')}.${String(n.getMinutes()).padStart(2, '0')}</div>`;
      let lastPart = '';
      todo.forEach(j => { const hr = +j.time.slice(0, 2), part = hr < 12 ? 'เช้า' : hr < 17 ? 'บ่าย' : 'เย็น–ค่ำ';
        if (part !== lastPart) { h += `<div class="sec">${part}</div>`; lastPart = part; } h += card(j, false); });
    }
    if (fin.length) h += `<div class="sec">✓ เสร็จแล้ว (${fin.length})</div>` + fin.map(j => card(j, false)).join('');
    R.getElementById('list').innerHTML = h;
  }

  function toast(msg, withUndo) {
    const host = L.getElementById('toastHost');
    host.innerHTML = `<div class="toast" role="status"><span>${msg}</span>${withUndo ? '<button data-undo="1">เลิกทำ</button>' : ''}</div>`;
    clearTimeout(toast.t); toast.t = setTimeout(() => { host.innerHTML = ''; undo = null; }, 5000);
  }
  const onClick = e => {
    const t = e.target.closest('[data-w],[data-cs],[data-staff],[data-open],[data-done],[data-day],[data-f],[data-undo],[data-copy],[data-copyday],[data-extra],[data-close],[data-q],[data-rm],[data-save],[data-pod],[data-podstaff],[data-podcar],[data-podsave]'); if (!t) return;
    if (t.dataset.close) { if (t.dataset.close === 'x' || e.target === t) { sheet = null; drawSheet(); } return; }
    if (t.dataset.pod) { openPod(); return; }
    if (t.dataset.podstaff) { const [leg, n] = t.dataset.podstaff.split(':'); sheet[leg] = n; drawPod(); return; }
    if (t.dataset.podcar) { sheet.carId = t.dataset.podcar; drawPod(); return; }
    if (t.dataset.podsave) { savePod(); return; }
    if (t.dataset.w) { const id = t.dataset.j, pr = prep[id] || (prep[id] = {}); pr.water = Math.max(0, (+pr.water || 0) + +t.dataset.w); savePrep(id); render(); return; }
    if (t.dataset.staff) { const id = t.dataset.j, pr = prep[id] || (prep[id] = {}), n = t.dataset.staff, cur = pr.staff || []; pr.staff = cur.includes(n) ? cur.filter(x => x !== n) : STAFF.filter(x => x === n || cur.includes(x)); savePrep(id); render(); return; }
    if (t.dataset.cs) { const id = t.dataset.j, pr = prep[id] || (prep[id] = {}); pr.cs = Math.max(0, (+pr.cs || 0) + +t.dataset.cs);
      const bk = bookingOf(id), dd = bk ? priceBooking(bk).days : 1, oldFee = bk ? carseatFee(bk.carseat, dd) : 0, newFee = carseatFee(pr.cs, dd);
      if (bk && newFee !== oldFee && (+bk.total || 0)) bk.total = Math.max(0, (+bk.total || 0) - oldFee + newFee);
      savePrep(id); render(); if (newFee !== oldFee) toast(newFee > oldFee ? `Carseat ตัวที่ ${pr.cs} คิดเพิ่มวันละ ${CARSEAT_FEE} × ${dd} วัน = ${(newFee - oldFee).toLocaleString()} บาท` : 'ลดค่า Carseat แล้ว', false); return; }
    if (t.dataset.open) { const o = t.dataset.open; if (opened[o]) delete opened[o]; else opened[o] = 1; render(); return; }
    if (t.dataset.copy) { copy(t.dataset.copy); return; }
    if (t.dataset.copyday) { copy(daySummary(day), 'คัดลอกสรุปงานแล้ว ไปวางในไลน์ได้เลย'); return; }
    if (t.dataset.extra) { openSheet(t.dataset.extra); return; }
    if (t.dataset.q) { const [ic, lb] = QUICK[+t.dataset.q]; sheet.items.push({ label: `${ic} ${lb}`, amt: 0 }); drawSheet(); const a = L.getElementById('xa' + (sheet.items.length - 1)); if (a) a.focus(); return; }
    if (t.dataset.rm) { sheet.items.splice(+t.dataset.rm, 1); drawSheet(); return; }
    if (t.dataset.save) {
      const x = { items: sheet.items.filter(i => i.label.trim() || i.amt), memo: sheet.memo.trim() };
      const bk = bookingOf(sheet.jid), m = moneyLines(sheet.b, x);
      if (bk) bk.returnExtras = x.items.length || x.memo ? JSON.stringify(x) : '';
      sheet = null; drawSheet();
      if (bk) persist(bk, `บันทึกแล้ว${m.line ? ' · ' + m.line : ''}`, false); return;
    }
    if (t.dataset.day) { day = t.dataset.day; render(); }
    else if (t.dataset.f) { filter = filter === t.dataset.f && t.dataset.f !== 'all' ? 'all' : t.dataset.f; render(); }
    else if (t.dataset.undo) { if (undo) { const u = undo; undo = null; Object.assign(u.b, u.before); persist(u.b); } L.getElementById('toastHost').innerHTML = ''; }
    else if (t.dataset.done) {
      const id = t.dataset.done, k = id.split(':')[1], b = bookingOf(id); if (!b) return;
      const plate = (CARS[b.carId] || ['-'])[0];
      if (isPod(b)) {
        const before = { deliveredAt: b.deliveredAt || '', status: b.status, returnDate: b.returnDate || '', returnTime: b.returnTime || '' };
        if (k === 'back') { if (b.status === 'completed') return; Object.assign(b, { status: 'completed', returnDate: b.end, returnTime: b.endTime, deliveredAt: b.deliveredAt || nowISO() }); undo = { b, before }; persist(b, `รับลุงป๊อดกลับแล้ว · ${plate} ว่าง`, true); return; }
        if (done[id]) { if (b.status === 'completed') return; b.deliveredAt = ''; } else { b.deliveredAt = nowISO(); b.status = 'active'; }
        undo = { b, before }; persist(b, done[id] ? 'ย้ายกลับไปงานที่ยังไม่ได้ทำ' : 'ส่งลุงป๊อดถึงแล้ว', true); return;
      }
      if (k === 'back') { if (b.status !== 'completed') openReturnModal(b.id); return; }
      const before = { mileageOut: b.mileageOut, deliveredAt: b.deliveredAt || '', status: b.status };
      if (done[id]) { if (b.status === 'completed') return; b.deliveredAt = ''; undo = { b, before }; persist(b, 'ย้ายกลับไปงานที่ยังไม่ได้ส่ง', true); return; }
      numPrompt(`เลขไมล์ออก ${plate} (ไม่กรอกก็ได้)`, b.mileageOut ? String(b.mileageOut) : '').then(v => {
        if (v === null) return;
        const mi = +String(v).replace(/[^\d]/g, '');
        if (mi) b.mileageOut = mi;
        b.deliveredAt = nowISO(); if (b.status !== 'completed') b.status = 'active';
        undo = { b, before }; persist(b, `ส่ง ${plate} เรียบร้อย` + (mi ? ` · ไมล์ ${mi.toLocaleString()}` : ''), true);
      });
    }
  };
  R.addEventListener('click', onClick); L.addEventListener('click', onClick);
  const onInput2 = e => {
    const fa = e.target.dataset && e.target.dataset.fuelamt;
    if (fa) { const v = e.target.value.replace(/[^\d]/g, ''); if (v !== e.target.value) e.target.value = v; (prep[fa] || (prep[fa] = {})).fuelAmt = +v || 0; savePrep(fa, true); return; }
    const id = e.target.dataset && e.target.dataset.tnote; if (!id) return;
    const pr = prep[id] || (prep[id] = {}); pr.note = e.target.value; savePrep(id, true);
  };
  R.addEventListener('input', onInput2);
  // Don't redraw under someone typing (the app re-renders on every sync).
  const typing = () => { const a = R.activeElement; return !!(a && /^(TEXTAREA|INPUT)$/.test(a.tagName)); };
  let pending = false;
  R.addEventListener('focusout', () => { if (pending) setTimeout(() => { if (!typing()) { pending = false; render(); } }, 400); });
  function render() {
    if (typing()) { pending = true; return; }
    loadData(); draw();
  }
  return { render };
  }

  // ---------- mount on the dashboard, in place of the old two lists ----------
  let inst = null, layerRoot = null;
  function layer() {
    if (!layerRoot || !layerRoot.host.isConnected) {
      const h = document.createElement('div'); h.id = 'wkLayer';
      document.body.appendChild(h);
      layerRoot = h.attachShadow({ mode: 'open' });
      layerRoot.innerHTML = `<style>${CSS}</style><div id="sheetHost"></div><div id="toastHost"></div>`;
      inst = null;
    }
    return layerRoot;
  }
  function mount() {
    const spot = document.getElementById('workMount');
    if (!spot) return;
    let host = document.getElementById('wkHost');
    if (!host || !inst) {
      if (host) host.remove();
      host = document.createElement('div'); host.id = 'wkHost';
      spot.appendChild(host);
      const R = host.attachShadow({ mode: 'open' });
      R.innerHTML = `<style>${CSS}</style><div class="wk"><div class="scroll"><div class="page"><header class="head" id="head"></header><main class="list" id="list" aria-live="polite"></main></div></div></div>`;
      inst = create(R, layer());
    }
    inst.render();
  }
  window.renderWorkPage = function () { try { mount(); } catch (err) { console.error('work page', err); } };
  setInterval(() => { const h = document.getElementById('wkHost'); if (inst && h && h.isConnected && h.offsetParent) inst.render(); }, 60000);

  // Return form: start from what staff already noted on the job card.
  const origReturn = window.openReturnModal;
  window.openReturnModal = function (id) {
    const r = origReturn.apply(this, arguments);
    const b = state.bookings.find(x => x.id === id);
    let x = null; try { x = b && b.returnExtras ? JSON.parse(b.returnExtras) : null; } catch (_) {}
    if (x) {
      const items = x.items || [], tot = items.reduce((t, i) => t + (+i.amt || 0), 0);
      const ex = document.getElementById('returnExtra'), nt = document.getElementById('returnNote');
      if (ex && tot) ex.value = tot;
      if (nt) nt.value = [...items.map(i => `${i.label} ${(+i.amt || 0).toLocaleString()} บาท`), x.memo || ''].filter(Boolean).join('\n');
    }
    return r;
  };
  if (typeof currentPage !== 'undefined' && currentPage === 'work') window.renderWorkPage();
})();
