// Queue table (week view) for phones: Liquid Glass look, tap a booking for
// big buttons, hold-and-drag to move it (up/down = car, left/right = half a
// day, then pick the exact time), two-finger pinch to zoom out to a month,
// prep-time chips between back-to-back queues, and a tapped-day highlight.
// It draws inside shadow roots so its styles and the app's never collide:
// the table lives in #ganttChart, the bottom sheet/toast in a body-level layer.
(function () {
  const CSS = `/* Layout: phone-first queue on a deep, softly lit backdrop; every surface is layered "liquid glass" (translucent, blurred, specular top edge). Tap a booking → glass bottom sheet. Single deliberate dark look. */
:host {
  display: block;
  color-scheme: dark;
  --glass: rgba(255, 255, 255, .09);
  --glass-2: rgba(255, 255, 255, .14);
  --glass-3: rgba(255, 255, 255, .22);
  --glass-edge: rgba(255, 255, 255, .22);
  --glass-edge-soft: rgba(255, 255, 255, .10);
  --glass-dark: rgba(18, 20, 28, .58);
  --specular: inset 0 1px 0 rgba(255, 255, 255, .38), inset 0 -1px 0 rgba(255, 255, 255, .05);
  --lift: 0 10px 30px rgba(0, 0, 0, .35);
  --blur: blur(22px) saturate(180%);
  --text: #f5f6fa;
  --muted: rgba(235, 238, 245, .62);
  --brand: #fde047;
  --brand-2: #f5b70a;
  --brand-ink: #1c1603;
  --ok: #4ade80;
  --ok-ink: #052e16;
  --bad: #fca5a5;
  --bad-solid: #ef4444;
  --rule: rgba(255, 255, 255, .06);
  --rule-strong: rgba(255, 255, 255, .16);
  --today: rgba(253, 224, 71, .30);
  --today-wash: rgba(253, 224, 71, .09);
  --today-edge: rgba(253, 224, 71, .75);
  --font: 'Sarabun', 'Segoe UI', system-ui, sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace;
}
:host { color: var(--text); font-family: var(--font); font-size: 15px; -webkit-tap-highlight-color: transparent; }
* { box-sizing: border-box; }
button { font-family: inherit; color: inherit; cursor: pointer; }
button:focus-visible { outline: 3px solid var(--brand); outline-offset: 2px; }
.glass, .seg, .nav button, .sheet, .bs, .toast, .dragtip {
  backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur);
}

.top { display: flex; flex-direction: column; gap: 10px; max-width: 1200px; margin: 0 auto; }
.title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.title-row h1 { margin: 0; font-size: 1.5rem; font-weight: 700; letter-spacing: -.01em; text-wrap: balance; }
.badge-demo {
  font-size: .78rem; font-weight: 700; color: var(--brand); padding: 4px 12px; border-radius: 999px;
  background: rgba(253, 224, 71, .14); border: 1px solid rgba(253, 224, 71, .35); box-shadow: var(--specular);
}
.lede { margin: 0; color: var(--muted); font-size: .9rem; max-width: 62ch; }

.controls { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.seg {
  display: inline-flex; background: var(--glass); border: 1px solid var(--glass-edge-soft);
  border-radius: 999px; padding: 4px; box-shadow: var(--specular);
}
.seg button { border: 0; background: transparent; padding: 9px 15px; border-radius: 999px; font-size: .9rem; font-weight: 600; color: var(--muted); min-height: 40px; transition: background .2s, color .2s; }
.seg button[aria-pressed="true"] {
  color: var(--brand-ink);
  background: linear-gradient(180deg, var(--brand), var(--brand-2));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .6), 0 4px 14px rgba(245, 183, 10, .35);
}
.nav { display: inline-flex; gap: 6px; }
.nav button {
  min-width: 46px; min-height: 46px; border-radius: 999px; padding: 0 14px; font-size: 1rem; font-weight: 700;
  background: var(--glass); border: 1px solid var(--glass-edge-soft); box-shadow: var(--specular);
}
.sortlab { color: var(--muted); font-size: .85rem; }
.nav button.impbtn { font-size: .9rem; font-weight: 600; }

/* ---- queue sheet ---- */
.wrap { max-width: 1200px; margin: 14px auto 0; overflow-x: auto; border-radius: 22px; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }
.sheet {
  background: var(--glass); color: var(--text); border: 1px solid var(--glass-edge);
  border-radius: 22px; overflow: clip; min-width: 100%; box-shadow: var(--specular), var(--lift);
}
/* width follows the zoom: 146px of car columns + one --dw per day */
.sheet { width: calc(146px + var(--dw, 90px) * var(--nd, 42)); min-width: 0; }
.dh .d .mini, .dh .d .mon { display: none; }
.hrow .lab .curmon { color: var(--brand); font-size: .72rem; font-weight: 700; }
.sheet.z-s .dh .h span, .sheet.z-s .bar small { display: none; }
.sheet.z-s .dh .h { min-height: 6px; }
.sheet.z-s .bar { padding: 2px 6px; }
.sheet.z-xs .dh .d .full { display: none; }
.sheet.z-xs .dh .d .mini { display: inline; font-size: .74rem; }
.sheet.z-xs .dh .d .mon { display: block; font-size: .62rem; color: var(--brand); font-weight: 700; white-space: nowrap; }
.sheet.z-xs .bar { padding: 0 3px; border-radius: 8px; }
.sheet.z-xs .bar b { font-size: .66rem; }
.sheet.z-xs .gap { display: none; }
.sheet.z-xs .cols i.am { border-right-color: transparent; }
.sheet.z-xxs .dh .d .mini { visibility: hidden; }
.sheet.z-xxs .dh .d .mini.major { visibility: visible; overflow: visible; display: inline-block; width: 0; white-space: nowrap; }
.sheet.z-xxs .dh { border-right-color: var(--rule); }
.pinchtip { max-width: 1200px; margin: 8px auto 0; color: var(--muted); font-size: .8rem; text-align: center; }
.zoomhint { position: fixed; left: 50%; top: 18px; transform: translateX(-50%); z-index: 2100; padding: 8px 16px; border-radius: 999px; font-weight: 700; color: #fff;
  background: rgba(20, 22, 30, .6); border: 1px solid var(--glass-edge); backdrop-filter: blur(18px) saturate(180%); -webkit-backdrop-filter: blur(18px) saturate(180%); box-shadow: var(--specular); pointer-events: none; }
.hrow, .row { display: flex; align-items: stretch; }
.hrow { background: rgba(255, 255, 255, .06); border-bottom: 1px solid var(--rule-strong); position: sticky; top: 0; z-index: 4; }
.row { border-bottom: 1px solid var(--rule); min-height: 52px; }
.row:last-child { border-bottom: 0; }
.no, .lab {
  position: sticky; z-index: 3; flex-shrink: 0; display: flex; align-items: center;
  backdrop-filter: blur(16px) saturate(160%); -webkit-backdrop-filter: blur(16px) saturate(160%);
}
.no { left: 0; width: 34px; justify-content: center; background: rgb(22, 24, 32); border-right: 1px solid var(--rule); font: 600 .8rem var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
.lab {
  left: 34px; width: 112px; padding: 4px 9px; flex-direction: column; align-items: flex-start; justify-content: center;
  border-right: 1px solid var(--rule-strong); color: #fff; line-height: 1.15;
  background: linear-gradient(180deg, hsl(var(--h) 65% 46% / .93), hsl(var(--h) 60% 30% / .95));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .28);
}
.lab b { font-size: .86rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.lab small { font-size: .7rem; opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.hrow .no { font: 600 .7rem var(--font); background: rgb(22, 24, 32); }
.hrow .lab { flex-direction: column; justify-content: center; gap: 1px; background: rgb(22, 24, 32); color: var(--muted); font-size: .8rem; align-items: center; box-shadow: none; }
.days { flex: 1; display: flex; min-width: 0; }
.dh { flex: 1; min-width: 0; display: flex; flex-direction: column; border-right: 1px solid var(--rule-strong); }
.dh:last-child { border-right: 0; }
.dh .d { text-align: center; padding: 7px 0 3px; font-size: .84rem; font-weight: 700; }
.dh .d span { font-weight: 500; color: var(--muted); }
.dh .h { display: flex; border-top: 1px solid var(--rule); }
.dh .h span { flex: 1; text-align: center; font-size: .68rem; color: var(--muted); padding: 2px 0 3px; }
.dh .h span + span { border-left: 1px solid var(--rule); }
/* tapped day: a lit glass column through the whole table */
.sheet { position: relative; }
.daysel { position: absolute; top: 0; bottom: 0; left: calc(146px + var(--dw) * var(--di)); width: var(--dw); pointer-events: none;
  background: linear-gradient(180deg, rgba(96, 165, 250, .20), rgba(96, 165, 250, .12));
  box-shadow: inset 2px 0 0 rgba(147, 197, 253, .85), inset -2px 0 0 rgba(147, 197, 253, .85), 0 0 24px rgba(96, 165, 250, .25); }
.dh { cursor: pointer; }
.dh.sel { background: linear-gradient(180deg, rgba(96, 165, 250, .75), rgba(37, 99, 235, .65)) !important; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .5); }
.dh.sel .d, .dh.sel .d span, .dh.sel .h span { color: #fff !important; }
.daypill { position: fixed; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 1500; display: flex; align-items: center; gap: 10px;
  padding: 10px 10px 10px 16px; border-radius: 999px; color: #fff; font-weight: 600; font-size: .92rem; white-space: nowrap; max-width: calc(100vw - 24px);
  background: rgba(30, 58, 138, .55); border: 1px solid rgba(147, 197, 253, .5); backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .35), 0 10px 30px rgba(0, 0, 0, .4); }
.daypill span { overflow: hidden; text-overflow: ellipsis; }
.daypill button { min-width: 36px; min-height: 36px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, .3); background: rgba(255, 255, 255, .15); color: #fff; font-size: 1rem; }
.dh.today { var(--today); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .4); }
.dh.today .d, .dh.today .d span, .dh.today .h span { color: #fff7c2; }
.track { flex: 1; position: relative; min-width: 0; }
.cols { position: absolute; inset: 0; display: grid; pointer-events: none; }
.cols i { border-right: 1px solid var(--rule); }
.cols i.pm { border-right-color: var(--rule-strong); }
.cols i:last-child { border-right: 0; }
.cols i.t { background: var(--today-wash); }
.cols i.t.am { box-shadow: inset 1.5px 0 0 var(--today-edge); }
.cols i.t.pm { box-shadow: inset -1.5px 0 0 var(--today-edge); }
.bar {
  position: absolute; height: 54px; margin-left: 2px; border-radius: 14px;
  border: 1px solid hsl(var(--h) 80% 80% / .45);
  background: linear-gradient(180deg, hsl(var(--h) 72% 60% / .78) 0%, hsl(var(--h) 65% 42% / .78) 100%);
  color: #fff; padding: 3px 10px; text-align: left; overflow: clip;
  display: flex; flex-direction: column; justify-content: center; line-height: 1.15;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .5), inset 0 -8px 16px hsl(var(--h) 70% 20% / .25), 0 6px 16px hsl(var(--h) 70% 15% / .35);
  text-shadow: 0 1px 2px rgba(0, 0, 0, .3); max-width: calc(100% - 4px); min-width: 26px;
}
/* text stays readable when the bar starts off to the left, under the car columns */
.bar .in { display: flex; will-change: transform; flex-direction: column; min-width: 0; max-width: 100%; }
.bar .ln1 { display: flex; flex-direction: row; align-items: center; gap: 7px; margin: 0; max-width: none; min-width: 0; white-space: nowrap; }
.bar b { font-size: .86rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 0 1 auto; min-width: 2.4em; }
/* place sits right after the customer's name, big enough to read at a glance */
.bar .pl { font-size: .95rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 0 1 auto; min-width: 0; line-height: 1.2; }
.sheet.z-xxs .bar .pl { display: none; }
.sheet.z-xs .bar .pl { font-size: .8rem; }
.spot { display: inline-flex; align-items: center; gap: 3px; font-size: .95em; }
.spot em { font-style: normal; font-weight: 700; font-size: .82em; padding: 0 5px; border-radius: 6px; background: rgba(255, 255, 255, .22); border: 1px solid rgba(255, 255, 255, .3); }
.bar .pl .spot { font-size: 1.15em; }
.bar .pl .spot em { font-size: .7em; padding: 1px 5px; }
.when small { color: var(--text); opacity: .85; font-size: .85rem; line-height: 1.25; margin-top: 2px; }
.bar small { font: 500 .68rem var(--mono); opacity: .9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bar.clash {
  background: linear-gradient(180deg, rgba(239, 68, 68, .55), rgba(185, 28, 28, .5));
  border: 1.5px solid rgba(254, 202, 202, .95); color: #fff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .45), 0 0 0 1.5px rgba(248, 113, 113, .85), 0 0 14px 3px rgba(239, 68, 68, .7), 0 0 30px 6px rgba(239, 68, 68, .35);
  animation: clashglow 1.6s ease-in-out infinite; z-index: 2;
}
@keyframes clashglow { 50% { box-shadow: inset 0 1px 0 rgba(255, 255, 255, .45), 0 0 0 1.5px rgba(248, 113, 113, .95), 0 0 20px 5px rgba(239, 68, 68, .85), 0 0 40px 10px rgba(239, 68, 68, .45); } }
.bar.flash { animation: flash 1.4s ease-out; }
@keyframes flash { 0%, 40% { box-shadow: 0 0 0 3px var(--brand), 0 0 24px rgba(253, 224, 71, .6); } 100% { box-shadow: inset 0 1px 0 rgba(255, 255, 255, .5), 0 6px 16px rgba(0, 0, 0, .3); } }

.legend { max-width: 1200px; margin: 12px auto 0; color: var(--muted); font-size: .82rem; display: flex; gap: 14px; flex-wrap: wrap; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 14px; height: 14px; border-radius: 5px; display: inline-block; border: 1px solid var(--glass-edge); }

/* ---- bottom sheet ---- */
.ov { position: fixed; inset: 0; z-index: 2000; background: rgba(0, 0, 0, .28); display: flex; align-items: flex-end; justify-content: center; backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); }
.bs {
  width: 100%; max-width: 520px; max-height: 88vh; overflow-y: auto; color: var(--text);
  background: linear-gradient(180deg, rgba(40, 44, 58, .62), rgba(16, 18, 26, .72));
  border-radius: 30px 30px 0 0; border: 1px solid var(--glass-edge); border-bottom: 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .35), 0 -10px 40px rgba(0, 0, 0, .45);
  padding: 8px max(16px, env(safe-area-inset-right, 0px)) calc(18px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
  display: flex; flex-direction: column; gap: 12px; animation: up .22s cubic-bezier(.2, .9, .3, 1.1);
}
@keyframes up { from { transform: translateY(40px) scale(.98); opacity: .4; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .bs, .bar.flash, .bar.clash, .tchip.clash { animation: none; } }
.grip { width: 46px; height: 5px; border-radius: 3px; background: rgba(255, 255, 255, .3); margin: 0 auto; }
.bs-head { display: flex; gap: 12px; align-items: flex-start; }
.bs-head .who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.chip-car {
  align-self: flex-start; color: #fff; font-weight: 700; font-size: .9rem; border-radius: 999px; padding: 4px 12px;
  background: linear-gradient(180deg, hsl(var(--h) 70% 55% / .85), hsl(var(--h) 62% 36% / .85));
  border: 1px solid hsl(var(--h) 80% 80% / .4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .45);
}
.bs-head h2 { margin: 0; font-size: 1.45rem; font-weight: 700; letter-spacing: -.01em; }
.bs-head p { margin: 0; color: var(--muted); font-size: .92rem; }
.x { width: 52px; height: 52px; border-radius: 999px; border: 1px solid var(--glass-edge-soft); background: var(--glass-2); font-size: 1.5rem; line-height: 1; flex-shrink: 0; box-shadow: var(--specular); }
.when { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.when div, .phone, .car, .nudge, .confirm, .turn {
  background: var(--glass); border: 1px solid var(--glass-edge-soft); box-shadow: var(--specular);
}
.when div { border-radius: 18px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; }
.when span { color: var(--muted); font-size: .85rem; }
.when strong { font-size: 1.1rem; font-variant-numeric: tabular-nums; }
.btn {
  min-height: 60px; width: 100%; border-radius: 20px; border: 1px solid var(--glass-edge-soft);
  background: var(--glass-2); font-size: 1.08rem; font-weight: 600; box-shadow: var(--specular);
  display: flex; align-items: center; justify-content: center; gap: 10px; transition: transform .12s;
}
.btn:active, .nudge .b button:active, .car:active { transform: scale(.98); }
.btn.main {
  color: var(--brand-ink); border: 1px solid rgba(255, 245, 180, .7); font-weight: 700;
  background: linear-gradient(180deg, rgba(254, 240, 138, .96), rgba(245, 183, 10, .92));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .75), 0 8px 22px rgba(245, 183, 10, .28);
}
.btn.save {
  color: var(--ok-ink); border: 1px solid rgba(187, 247, 208, .7); font-weight: 700;
  background: linear-gradient(180deg, rgba(134, 239, 172, .96), rgba(34, 197, 94, .92));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .7), 0 8px 22px rgba(34, 197, 94, .25);
}
.btn:disabled { opacity: .4; }
.two { display: grid; grid-template-columns: 1fr 1.5fr; gap: 8px; }
.phone { display: flex; align-items: center; justify-content: space-between; gap: 10px; border-radius: 18px; padding: 10px 12px; }
.phone span { font: 600 1.1rem var(--mono); user-select: all; }
.phone a {
  color: var(--brand-ink); text-decoration: none; font-weight: 700; padding: 10px 18px; border-radius: 999px;
  background: linear-gradient(180deg, var(--brand), var(--brand-2)); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .6);
}
.hint { color: var(--muted); font-size: .9rem; margin: 0; }
.cars { display: flex; flex-direction: column; gap: 8px; }
.car { min-height: 64px; display: flex; align-items: center; gap: 12px; padding: 8px 12px; text-align: left; border-radius: 20px; transition: transform .12s; }
.car.busy { opacity: .5; }
.car .dot { width: 14px; height: 40px; border-radius: 7px; flex-shrink: 0; background: linear-gradient(180deg, hsl(var(--h) 70% 60%), hsl(var(--h) 62% 38%)); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .5); }
.car .nm { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.car .nm b { font-size: 1.05rem; }
.car .nm small { color: var(--muted); font-size: .82rem; }
.tag { font-size: .85rem; font-weight: 700; padding: 4px 11px; border-radius: 999px; background: var(--glass-2); border: 1px solid var(--glass-edge-soft); white-space: nowrap; }
.tag.free { background: rgba(74, 222, 128, .16); border-color: rgba(74, 222, 128, .4); color: var(--ok); }
.grp { color: var(--muted); font-size: .8rem; letter-spacing: .03em; margin: 4px 4px 0; }
.nudge { border-radius: 20px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.nudge .l { display: flex; justify-content: space-between; align-items: baseline; color: var(--muted); font-size: .9rem; }
.nudge .l strong { color: var(--text); font-size: 1.2rem; font-variant-numeric: tabular-nums; }
.nudge .b { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.nudge .b button { min-height: 56px; border-radius: 16px; border: 1px solid var(--glass-edge-soft); background: var(--glass-2); box-shadow: var(--specular); font-weight: 700; font-size: .98rem; transition: transform .12s; }
.warn { background: rgba(239, 68, 68, .16); border: 1px solid rgba(252, 165, 165, .35); color: var(--bad); border-radius: 16px; padding: 10px 12px; font-weight: 600; font-size: .95rem; }
.confirm { border-color: rgba(252, 165, 165, .5); border-radius: 20px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }

.bar { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: pan-x pan-y; }
.bar.lifting { transform: scale(.97); transition: transform .25s; }
.bar.src { opacity: .25; }
.ghost { position: fixed; z-index: 2050; pointer-events: none; transform: scale(1.07) rotate(-1.5deg); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .6), 0 18px 40px rgba(0, 0, 0, .5) !important; margin: 0; }
.row.drop { background: rgba(253, 224, 71, .12); box-shadow: inset 0 0 0 1.5px rgba(253, 224, 71, .7); }
.ghost.clash { box-shadow: 0 0 0 2px rgba(248, 113, 113, .95), 0 0 22px 6px rgba(239, 68, 68, .8), 0 18px 40px rgba(0, 0, 0, .5) !important; }
/* time picker after dropping into the other half of a day */
.tgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.tchip { min-height: 54px; border-radius: 16px; border: 1px solid var(--glass-edge-soft); background: var(--glass-2); box-shadow: var(--specular); font: 700 1.02rem var(--mono); color: var(--text); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; transition: transform .12s; }
.tchip small { font: 600 .66rem system-ui, sans-serif; opacity: .85; }
.tchip:active { transform: scale(.96); }
/* :30 buttons get a cooler tint so the eye can tell them from whole hours */
.tchip.half { background: rgba(96, 165, 250, .16); border-color: rgba(147, 197, 253, .35); color: #dbeafe; }
.tchip.on { background: linear-gradient(180deg, rgba(253, 224, 71, .9), rgba(234, 179, 8, .85)); color: #1a1405; border-color: rgba(254, 240, 138, .9); }
.tchip.clash { background: linear-gradient(180deg, rgba(239, 68, 68, .5), rgba(185, 28, 28, .45)); border-color: rgba(254, 202, 202, .9); color: #fff; box-shadow: 0 0 0 1px rgba(248, 113, 113, .8), 0 0 12px 2px rgba(239, 68, 68, .6); animation: clashglow 1.6s ease-in-out infinite; }
.typetime { display: flex; align-items: center; gap: 10px; border-radius: 18px; padding: 10px 12px; background: var(--glass-2); border: 1px solid var(--glass-edge-soft); box-shadow: var(--specular); }
.typetime label { flex: 1; color: var(--muted); font-size: .9rem; }
.typetime input { min-height: 48px; min-width: 130px; border-radius: 14px; border: 1px solid var(--glass-edge); background: rgba(0, 0, 0, .25); color: var(--text); font: 700 1.15rem var(--mono); padding: 0 10px; color-scheme: dark; }
.typetime.custom { border-color: rgba(253, 224, 71, .8); }
.tchip.clash.on { outline: 3px solid rgba(253, 224, 71, .95); outline-offset: 1px; }
.row.drop.bad { background: rgba(239, 68, 68, .14); box-shadow: inset 0 0 0 1.5px rgba(252, 165, 165, .8); }
.dragtip {
  position: fixed; z-index: 2060; pointer-events: none; left: 50%; transform: translateX(-50%);
  top: calc(10px + env(safe-area-inset-top, 0px)); width: min(520px, calc(100% - 32px));
  background: rgba(22, 24, 34, .6); color: var(--text); border: 1px solid var(--glass-edge); border-radius: 22px; padding: 10px 16px;
  display: flex; flex-direction: column; gap: 2px; box-shadow: var(--specular), var(--lift);
}
.dragtip b { font-size: 1.05rem; }
.dragtip span { font-size: .9rem; color: rgba(235, 238, 245, .8); font-variant-numeric: tabular-nums; }
.dragtip .bad { color: var(--bad); font-weight: 700; }
/* Turnaround chip: a small glass lozenge floating in the gap between two queues. */
.gap {
  position: absolute; transform: translate(-50%, -50%); z-index: 2; pointer-events: none;
  font: 700 .72rem var(--font); white-space: nowrap; padding: 3px 9px; border-radius: 999px;
  color: #fff; border: 1px solid rgba(255, 255, 255, .45);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .45), 0 3px 10px rgba(0, 0, 0, .25);
  text-shadow: 0 1px 2px rgba(0, 0, 0, .55); opacity: .88;
}
.gap.tight { background: rgba(239, 68, 68, .58); border-color: rgba(254, 202, 202, .8); }
.gap.short, .gap.busy { background: rgba(234, 179, 8, .55); border-color: rgba(254, 240, 138, .85); }
.gap.ok    { background: rgba(34, 197, 94, .50); border-color: rgba(187, 247, 208, .8); }

.turn { border-radius: 18px; padding: 10px 12px; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; align-items: baseline; }
.turn span { font-size: .85rem; color: var(--muted); }
.turn strong { font-size: 1.05rem; text-align: right; }
.turn small { grid-column: 1 / -1; font-size: .85rem; color: var(--muted); }
.turn.tight { background: rgba(239, 68, 68, .14); border-color: rgba(252, 165, 165, .4); } .turn.tight strong { color: #fca5a5; }
.turn.short, .turn.busy { background: rgba(245, 158, 11, .13); border-color: rgba(252, 211, 77, .4); } .turn.short strong, .turn.busy strong { color: #fcd34d; }
.turn.ok    { background: rgba(34, 197, 94, .12); border-color: rgba(134, 239, 172, .35); } .turn.ok strong { color: #86efac; }
.dragtip .g-tight { color: #fca5a5; font-weight: 700; } .dragtip .g-short { color: #fcd34d; font-weight: 700; } .dragtip .g-ok { color: #86efac; } .dragtip .g-busy { color: #fcd34d; font-weight: 700; }
.toast {
  position: fixed; left: 50%; transform: translateX(-50%); z-index: 2100;
  bottom: calc(18px + env(safe-area-inset-bottom, 0px)); width: min(520px, calc(100% - 32px));
  background: rgba(255, 255, 255, .72); color: #14161f; border: 1px solid rgba(255, 255, 255, .8); border-radius: 22px; padding: 10px 10px 10px 18px;
  display: flex; align-items: center; gap: 12px; box-shadow: inset 0 1px 0 #fff, 0 14px 36px rgba(0, 0, 0, .45); font-weight: 600;
}
.toast span { flex: 1; min-width: 0; }
.toast button { min-height: 46px; padding: 0 18px; border-radius: 999px; border: 0; background: rgba(20, 22, 31, .88); color: #fff; font-weight: 700; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .2); }

.row.off { opacity: .55; }
.daypill .hrs { min-width: 0; padding: 0 12px; font-size: .85rem; font-weight: 700; }
.top { margin-bottom: 4px; }
.legend { margin-top: 10px; font-size: .78rem; }
`;
  const TOP = `<div class="top"><div class="controls">
      <div class="nav"><button id="prev" aria-label="ย้อนไป">‹</button><button id="today">วันนี้</button><button id="next" aria-label="ถัดไป">›</button></div>
      <div class="seg" role="group" aria-label="จำนวนวันที่แสดง"><button id="span3" aria-pressed="false">3 วัน</button><button id="span7" aria-pressed="false">7 วัน</button><button id="span30" aria-pressed="false">เดือน</button></div>
      <div class="nav"><button id="imp" class="impbtn" title="นำเข้าคิวจากไฟล์ที่ยูทำให้">⇪ นำเข้าคิว</button></div>
      <input type="file" id="impFile" accept=".json,application/json,text/plain" hidden>
    </div></div>`;
  const LEGEND = `<div class="legend">
    <span><i style="background:rgba(253,224,71,.45)"></i>วันนี้</span>
    <span><i style="background:rgba(239,68,68,.3);border:1.5px solid #fca5a5"></i>คิวชนกัน</span>
    <span><i style="background:rgba(34,197,94,.42)"></i>เตรียมรถ 3 ชม.+</span>
    <span><i style="background:rgba(245,158,11,.45)"></i>1–3 ชม. หรือหลายคันพร้อมกัน</span>
    <span><i style="background:rgba(239,68,68,.45)"></i>ต่ำกว่า 1 ชม.</span>
    <span>✈️ สนามบิน · 🚆 รถไฟ · 🚌 ขนส่ง · 🏠 ร้าน · 📍 ที่อื่น</span>
    <span>แตะคิว = ปุ่มคำสั่ง · แตะค้างแล้วลาก = ย้าย · สองนิ้ว = ซูม · แตะหัววัน = ไฮไลต์</span>
  </div>`;

  function create(R, L, alive) {

  // ---------- data: the app's own cars and bookings ----------
  const iso = d => d.toISOString().slice(0, 10);
  // Local calendar day (the shop is in Thailand), not the UTC one.
  const localToday = () => { const n = new Date(); return iso(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))); };
  let todayISO = localToday();
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  let CARS = [], bookings = [];
  // Cars of the current tab in the current sort (app's sort buttons), and
  // every booking still on the road or coming up for those cars. Bookings are
  // the app's live objects, so a change here is a change to state.bookings.
  function loadData() {
    todayISO = localToday();
    CARS = ganttCarsInScope().map(c => {
      const cc = c.engineCC !== '' && c.engineCC != null && !isNaN(+c.engineCC) ? (+c.engineCC).toFixed(1) : '';
      const name = [c.brand, c.model].filter(Boolean).join(' ');
      return { id: c.id, no: c.orderNo || '', plate: c.plate || '-', name, model: `${c.brand || ''}|${c.model || ''}`,
        spec: [c.model, cc, c.seats ? c.seats + ' ที่' : ''].filter(Boolean).join(' · ') + (c.status === 'maintenance' ? ' · 🔧 ซ่อม' : c.status === 'blocked' ? ' · งดให้บริการ' : ''),
        hue: ganttCarHue(c), off: c.status === 'maintenance' || c.status === 'blocked' };
    });
    const ids = new Set(CARS.map(c => c.id));
    bookings = state.bookings.filter(x => x.status !== 'completed' && ids.has(x.carId) && x.start && x.end);
  }
  const who = x => (x && x.customer) || '-';
  const LANE = 58;
  // Regular drop-off spots become an icon (plus a short tag for the Arcade bus terminals); anything else stays as 📍 text.
  const SPOTS = [
    [/สนามบิน|airport|cnx/i, '✈️', ''],
    [/สถานีรถไฟ|รถไฟ|train/i, '🚆', ''],
    [/สมบัติ/, '🚌', 'สมบัติทัวร์'],
    [/นครชัย/, '🚌', 'นครชัยแอร์'],
    [/(อาเขต|ขนส่ง)\s*(1|๑|หนึ่ง)/, '🚌', 'อาเขต1'],
    [/(อาเขต|ขนส่ง)\s*(2|๒|สอง)/, '🚌', 'อาเขต2'],
    [/อาเขต|สถานีขนส่ง|บขส/, '🚌', 'อาเขต'],
    [/หน้าร้าน|^ร้าน/, '🏠', 'ร้าน'],
  ];
  const spot = p => { if (!p) return null; const m = SPOTS.find(([re]) => re.test(p)); return m ? { icon: m[1], tag: m[2] } : null; };
  const placeShort = p => { const k = spot(p); return !p ? '–' : k ? `<span class="spot">${k.icon}${k.tag ? `<em>${k.tag}</em>` : ''}</span>` : `📍 ${p}`; };
  const placeLine = b => { const a = b.pickupLocation || '', z = b.returnLocation || ''; return a === z ? placeShort(a) : `${placeShort(a)} → ${placeShort(z)}`; };
  const placeHtml = p => { if (!p) return ''; const k = spot(p); return `<small>${k ? `<span class="spot">${k.icon}${k.tag ? `<em>${k.tag}</em>` : ''}</span> ` : '📍 '}${k && k.tag && p.replace(/\s/g, '') === k.tag ? '' : p}</small>`; };

  // ---------- view state ----------
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  let offset = 0;
  // Zoom like Google Sheets on a phone: one day = dw px. A 6-week window is drawn
  // (1 week back, 5 ahead) and re-centred when you scroll near its edge.
  const DAYS = 42, BACK = 7, CARCOLS = 146, DW_MIN = 9, DW_MAX = 260;
  const wrapEl = () => R.getElementById('wrap');
  const fitDw = n => Math.max(DW_MIN, Math.min(DW_MAX, (Math.min(wrapEl().clientWidth || innerWidth, 1200) - CARCOLS) / n));
  let dw = +store.get('qlab.dw', 0);
  let selDay = null;   // ISO date of the highlighted day column
  let sheet = null;     // { id, view, start, startTime, end, endTime, pendingCar }
  let undo = null;      // { snapshot, label }
  let flashId = null;

  const hue = car => car.hue;
  const hueVar = car => `--h:${hue(car).toFixed(1)}`;
  const car = id => CARS.find(c => c.id === id);
  const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const dm = s => { const d = new Date(s + 'T00:00:00Z'); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };
  const dayText = (s, t) => { const d = new Date(s + 'T00:00:00Z'); return `${DOW[d.getUTCDay()]} ${dm(s)}` + (t ? ` · ${t}` : ''); };
  const stamp = (s, t) => dm(s) + (t ? ':' + t.replace(':', '.') : '');
  const moment = (s, t) => `${s}T${t || '10:00'}`;
  const overlaps = (a, b) => moment(a.start, a.startTime) < moment(b.end, b.endTime) && moment(b.start, b.startTime) < moment(a.end, a.endTime);
  const clashFor = (b, carId, range = b) => bookings.find(o => o.id !== b.id && o.carId === carId && overlaps(range, o));
  const mins = (a, b) => Math.round((Date.parse(b + ':00Z') - Date.parse(a + ':00Z')) / 60000);
  const GAP_WATCH = 3 * 24 * 60; // call out turnarounds under 3 days
  // Biggest sensible units: 45 นาที · 1 ชม. 30 นาที · 1 วัน 4 ชม.
  const gapText = m => {
    if (m < 60) return `${m} นาที`;
    const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    if (d) return `${d} วัน` + (h ? ` ${h} ชม.` : '');
    return `${h} ชม.` + (mm ? ` ${mm} นาที` : '');
  };
  // Colour of a turnaround: under 1 hour red; under 3 hours yellow; 3 hours+
  // green, unless several cars need cleaning in the same window, so the time
  // per car (gap ÷ cars) drops under 3 hours: then it is yellow too.
  const gapLevel = (m, together = 1) => m < 60 ? 'tight' : m < 180 ? 'short' : (m / together < 180 ? 'busy' : 'ok');
  // Every turnaround on every car: the gap between one queue's return and the
  // next queue's pickup on that same car.
  function allTurnarounds(skipId) {
    const out = [];
    CARS.forEach(c => {
      const list = bookings.filter(b => b.carId === c.id && b.id !== skipId)
        .sort((x, y) => moment(x.start, x.startTime).localeCompare(moment(y.start, y.startTime)));
      for (let i = 0; i + 1 < list.length; i++) {
        const from = moment(list[i].end, list[i].endTime), to = moment(list[i + 1].start, list[i + 1].startTime);
        const m = mins(from, to);
        if (m >= 0 && m < GAP_WATCH) out.push({ carId: c.id, from, to, m });
      }
    });
    return out;
  }
  // How many cars (this one included) need preparing during [from, to].
  // Only same-day turnarounds compete for the team's time; a car that sits
  // free for a day or more can be cleaned whenever.
  const BUSY_WINDOW = 24 * 60;
  const togetherIn = (from, to, carId, skipId) => 1 + allTurnarounds(skipId).filter(t => t.carId !== carId && t.m < BUSY_WINDOW && t.from < to && t.to > from).length;
  const gapInfo = (from, to, carId, skipId) => {
    const m = mins(from, to), together = m < BUSY_WINDOW ? togetherIn(from, to, carId, skipId) : 1;
    return { m, together, level: gapLevel(m, together) };
  };
  // Neighbours of a booking (or a proposed range) on one car: the queue just
  // before it and just after it, with the minutes left to clean/prepare the car.
  function neighbours(b, carId, range = b) {
    const s0 = moment(range.start, range.startTime), e0 = moment(range.end, range.endTime);
    const others = bookings.filter(o => o.id !== b.id && o.carId === carId);
    const prev = others.filter(o => moment(o.end, o.endTime) <= s0).sort((x, y) => moment(y.end, y.endTime).localeCompare(moment(x.end, x.endTime)))[0];
    const next = others.filter(o => moment(o.start, o.startTime) >= e0).sort((x, y) => moment(x.start, x.startTime).localeCompare(moment(y.start, y.startTime)))[0];
    const out = {};
    if (prev) { const g = gapInfo(moment(prev.end, prev.endTime), s0, carId, b.id); if (g.m < GAP_WATCH) out.prev = { o: prev, ...g }; }
    if (next) { const g = gapInfo(e0, moment(next.start, next.startTime), carId, b.id); if (g.m < GAP_WATCH) out.next = { o: next, ...g }; }
    return out;
  }
  // Position in half-day slot units, placed by the real clock time
  // (12 hours = 1 slot), so back-to-back queues sit side by side instead of
  // both filling the same เช้า/บ่าย cell and covering each other's text.
  const half = (start, s, t) => {
    const day = Math.round((new Date(s) - new Date(start)) / 864e5) * 2;
    const [h, m] = (t || '10:00').split(':').map(Number);
    return day + (h * 60 + m) / 720;
  };

  const sortedCars = () => CARS;

  // ---------- render queue ----------
  function render() {
    loadData();
    const startW = addDays(todayISO, offset - BACK);
    const days = Array.from({ length: DAYS }, (_, i) => addDays(startW, i));
    const end = addDays(startW, DAYS);
    const slots = DAYS * 2;
    const tIdx = days.indexOf(todayISO);
    const cols = `<div class="cols" style="grid-template-columns:repeat(${slots},1fr)">` +
      Array.from({ length: slots }, (_, i) => `<i class="${i % 2 ? 'pm' : 'am'}${Math.floor(i / 2) === tIdx ? ' t' : ''}"></i>`).join('') + '</div>';

    const head = `<div class="hrow"><div class="no">ลำดับ</div><div class="lab"><span>รถ</span><span class="curmon"></span></div><div class="days">` +
      days.map(d => { const dt = new Date(d + 'T00:00:00Z');
        const first = dt.getUTCDate() === 1 || d === startW;
        return `<div class="dh${d === todayISO ? ' today' : ''}"><div class="d"><span class="full">${dm(d)} <span>${DOW[dt.getUTCDay()]}</span></span><span class="mini${[1, 5, 10, 15, 20, 25].includes(dt.getUTCDate()) ? ' major' : ''}">${dt.getUTCDate()}</span>${first ? `<span class="mon">${MON[dt.getUTCMonth()]}</span>` : ''}</div><div class="h"><span>เช้า</span><span>บ่าย</span></div></div>`;
      }).join('') + '</div></div>';

    const rows = sortedCars().map(c => {
      const mine = bookings.filter(b => b.carId === c.id && b.start < end && b.end >= startW)
        .sort((a, b) => moment(a.start, a.startTime).localeCompare(moment(b.start, b.startTime)));
      const lanes = []; const laneOf = {};
      mine.forEach(b => { let l = lanes.findIndex(e => e <= moment(b.start, b.startTime)); if (l < 0) { l = lanes.length; lanes.push(''); } lanes[l] = moment(b.end, b.endTime); laneOf[b.id] = l; });
      const bars = mine.map(b => {
        const rs = half(startW, b.start, b.startTime, false), re = half(startW, b.end, b.endTime, true);
        const s = Math.max(0, rs), e = Math.min(slots, Math.max(re, rs + 0.3));
        if (e <= s) return '';
        const clash = !!clashFor(b, c.id);
        return `<button class="bar${clash ? ' clash' : ''}${b.id === flashId ? ' flash' : ''}" data-id="${b.id}"
          style="left:${s / slots * 100}%;width:${(e - s) / slots * 100}%;top:${5 + laneOf[b.id] * LANE}px;${hueVar(c)}"
          aria-label="${who(b)} ${dayText(b.start, b.startTime)} ถึง ${dayText(b.end, b.endTime)}">
          <span class="in"><span class="ln1"><b>${clash ? '⚠ ' : ''}${rs < 0 ? '‹ ' : ''}${who(b)}</b><span class="pl">${placeLine(b)}</span></span>
          <small>${stamp(b.start, b.startTime)}-${stamp(b.end, b.endTime)}</small></span></button>`;
      }).join('');
      // Turnaround chips: where one queue ends and the next one on this car starts soon after.
      const gaps = [];
      bookings.filter(b => b.carId === c.id).forEach(b => {
        const n = neighbours(b, c.id).next; if (!n) return;
        // Sit midway between the end of this queue and the start of the next one.
        const xe = half(startW, b.end, b.endTime, true), xs = half(startW, n.o.start, n.o.startTime, false);
        const x = (xe + xs) / 2;
        if (x < 0 || x > slots) return;
        const lane = laneOf[n.o.id] ?? laneOf[b.id] ?? 0;
        gaps.push(`<span class="gap ${n.level}" style="left:${Math.min(Math.max(x / slots * 100, .4), 99.6)}%;top:${5 + lane * LANE + 62}px">⏱ ${gapText(n.m)}${n.together > 1 ? ` · ${n.together} คัน` : ''}</span>`);
      });
      // Chips hang just under the bar line, bridging the two queues without covering their text.
      const rowH = Math.max(66, lanes.length * LANE + 8) + (gaps.length ? 18 : 0);
      return `<div class="row${c.off ? ' off' : ''}" data-car="${c.id}" style="min-height:${rowH}px">
        <div class="no">${c.no}</div>
        <div class="lab" style="${hueVar(c)}"><b>${c.plate}</b><small>${c.spec}</small></div>
        <div class="track">${cols}${bars}${gaps.join('')}</div></div>`;
    }).join('');

    const di = selDay ? days.indexOf(selDay) : -1;
    wrapEl().innerHTML = `<div class="sheet" style="--nd:${DAYS}">${di >= 0 ? `<div class="daysel" style="--di:${di}"></div>` : ''}${head}${rows}</div>`;
    if (di >= 0) wrapEl().querySelectorAll('.dh')[di].classList.add('sel');
    dayPill();
    applyZoom();
  }

  // ---------- bottom sheet ----------
  function openSheet(id) {
    const b = bookings.find(x => x.id === id); if (!b) return;
    sheet = { id, view: 'main', start: b.start, startTime: b.startTime, end: b.end, endTime: b.endTime, pendingCar: null };
    renderSheet();
  }
  function closeSheet() { sheet = null; L.getElementById('sheetHost').innerHTML = ''; }

  function turnHtml(nb) {
    const line = (label, g, when) => `<div class="turn ${g.level}"><span>${label}</span><strong>⏱ เตรียมรถ ${gapText(g.m)}</strong><small>${when}${g.together > 1 ? `<br>ช่วงนี้ต้องเตรียมรถพร้อมกัน ${g.together} คัน · เฉลี่ยคันละ ${gapText(Math.round(g.m / g.together))}` : ''}</small></div>`;
    return (nb.prev ? line('ก่อนรับรถ', nb.prev, `คิวก่อน ${who(nb.prev.o)} คืน ${dayText(nb.prev.o.end, nb.prev.o.endTime)}`) : '') +
           (nb.next ? line('หลังคืนรถ', nb.next, `คิวต่อ ${who(nb.next.o)} รับ ${dayText(nb.next.o.start, nb.next.o.startTime)}`) : '');
  }

  function renderSheet() {
    const host = L.getElementById('sheetHost');
    if (!sheet) { host.innerHTML = ''; return; }
    const b = bookings.find(x => x.id === sheet.id); const c = car(b.carId);
    const head = `<div class="grip"></div><div class="bs-head"><div class="who">
        <span class="chip-car" style="${hueVar(c)}">${c.no ? c.no + ' · ' : ''}${c.plate}</span>
        <h2>${who(b)}</h2><p>${c.spec}</p></div>
        <button class="x" data-act="close" aria-label="ปิด">×</button></div>`;
    let body = '';
    if (sheet.view === 'main') {
      const digits = (b.phone || '').replace(/[^\d+]/g, '');
      body = `<div class="when"><div><span>ส่งรถ</span><strong>${dayText(b.start, b.startTime)}</strong>${placeHtml(b.pickupLocation)}</div><div><span>รับรถคืน</span><strong>${dayText(b.end, b.endTime)}</strong>${placeHtml(b.returnLocation)}</div></div>
        ${turnHtml(neighbours(b, b.carId))}
        <button class="btn main" data-act="view:car">⇄ ย้ายไปรถคันอื่น</button>
        <button class="btn main" data-act="view:time">⏱ เลื่อนวัน / เวลา</button>
        ${digits ? `<div class="phone"><span>${b.phone}</span><a href="tel:${digits}">โทร</a></div>` : ''}
        <button class="btn" data-act="edit">แก้ไขทั้งหมด</button>`;
    } else if (sheet.view === 'car') {
      const others = CARS.filter(x => x.id !== c.id);
      const free = x => !clashFor(b, x.id);
      const same = x => x.model === c.model;
      const pick = (list, title) => list.length ? `<div class="grp">${title}</div>` + list.map(x => {
        const cl = clashFor(b, x.id);
        return `<button class="car${cl ? ' busy' : ''}" data-act="car:${x.id}"><span class="dot" style="${hueVar(x)}"></span>
          <span class="nm"><b>${x.no ? x.no + '. ' : ''}${x.plate}</b><small>${x.name}${same(x) ? ' · รุ่นเดียวกัน' : ''}${(() => { if (cl) return ''; const nb = neighbours(b, x.id); const m = Math.min(nb.prev ? nb.prev.m : 1e9, nb.next ? nb.next.m : 1e9); return m < 1e9 ? ` · เตรียมรถ ${gapText(m)}` : ''; })()}</small></span>
          <span class="tag${cl ? '' : ' free'}">${cl ? 'ติดคิว' : 'ว่าง'}</span></button>`;
      }).join('') : '';
      const byNo = (a, d) => (+a.no || 999) - (+d.no || 999);
      let confirmBox = '';
      if (sheet.pendingCar) {
        const pc = car(sheet.pendingCar), cl = clashFor(b, pc.id);
        confirmBox = `<div class="confirm"><div class="warn">${pc.plate} ติดคิว ${who(cl)} (${dayText(cl.start, cl.startTime)} → ${dayText(cl.end, cl.endTime)})</div>
          <div class="two"><button class="btn" data-act="cancelpending">ไม่ย้าย</button><button class="btn main" data-act="force:${pc.id}">ย้ายซ้อนไปเลย</button></div></div>`;
      }
      body = `<p class="hint">${dayText(b.start, b.startTime)} → ${dayText(b.end, b.endTime)}</p>${confirmBox}
        <div class="cars">${pick(others.filter(x => free(x) && same(x)).sort(byNo), 'ว่าง · รุ่นเดียวกัน')}${pick(others.filter(x => free(x) && !same(x)).sort(byNo), 'ว่าง · รุ่นอื่น')}${pick(others.filter(x => !free(x)).sort(byNo), 'ติดคิวช่วงนี้')}</div>
        <button class="btn" data-act="view:main">‹ กลับ</button>`;
    } else if (sheet.view === 'pick') {
      const p = sheet.plan, pc = car(p.carId), date = p.range.start;
      const chips = SLOTS[sheet.per].map(t => {
        const cl = clashFor(b, p.carId, rangeAt(b, date, t));
        return `<button class="tchip${t.endsWith(':30') ? ' half' : ''}${t === sheet.pick ? ' on' : ''}${cl ? ' clash' : ''}" data-act="pick:${t.replace(':', '.')}">${t.replace(':', '.')}${cl ? '<small>⚠ ชนคิว</small>' : ''}</button>`;
      }).join('');
      const r = rangeAt(b, date, sheet.pick), cl = clashFor(b, p.carId, r);
      body = `<p class="hint">เลือกเวลาส่งรถ <b>${sheet.per === 'am' ? 'ช่วงเช้า' : 'ช่วงบ่าย'} ${dayText(date)}</b>${p.carId !== b.carId ? ` · รถ ${pc.no ? pc.no + '. ' : ''}${pc.plate}` : ''}</p>
        <div class="tgrid">${chips}</div>
        <div class="typetime${SLOTS[sheet.per].includes(sheet.pick) ? '' : ' custom'}"><label for="pickTime">ไม่มีเวลาที่ต้องการ? พิมพ์เอง</label><input id="pickTime" type="time" step="300" value="${sheet.pick}"></div>
        <div class="when"><div><span>ส่งรถ</span><strong>${dayText(r.start, r.startTime)}</strong>${placeHtml(b.pickupLocation)}</div><div><span>รับรถคืน</span><strong>${dayText(r.end, r.endTime)}</strong>${placeHtml(b.returnLocation)}</div></div>
        ${cl ? `<div class="warn">⚠ ชนกับคิว ${who(cl)} (${dayText(cl.start, cl.startTime)} → ${dayText(cl.end, cl.endTime)})</div>` : turnHtml(neighbours(b, p.carId, r))}
        <div class="two"><button class="btn" data-act="close">ไม่ย้าย</button><button class="btn save" data-act="applypick">${cl ? 'วางทั้งที่ชน' : 'วางคิวเวลานี้'}</button></div>`;
    } else if (sheet.view === 'drop') {
      const p = sheet.plan, pc = car(p.carId);
      body = `<div class="when"><div><span>รถ</span><strong>${pc.no ? pc.no + '. ' : ''}${pc.plate}</strong></div><div><span>เวลา</span><strong>${dayText(p.range.start, p.range.startTime)} → ${dayText(p.range.end, p.range.endTime)}</strong></div></div>
        <div class="warn">⚠ ชนกับคิว ${who(p.clash)} (${dayText(p.clash.start, p.clash.startTime)} → ${dayText(p.clash.end, p.clash.endTime)})</div>
        <div class="two"><button class="btn" data-act="close">ไม่ย้าย</button><button class="btn main" data-act="applydrop">ย้ายซ้อนไปเลย</button></div>`;
    } else {
      const range = { start: sheet.start, startTime: sheet.startTime, end: sheet.end, endTime: sheet.endTime };
      const bad = moment(range.end, range.endTime) <= moment(range.start, range.startTime);
      const cl = bad ? null : clashFor(b, b.carId, range);
      const changed = range.start !== b.start || range.startTime !== b.startTime || range.end !== b.end || range.endTime !== b.endTime;
      const row = (k, label) => `<div class="nudge"><div class="l">${label}<strong>${dayText(sheet[k], sheet[k + 'Time'])}</strong></div>
        <div class="b"><button data-act="nudge:${k}:-1440">−1 วัน</button><button data-act="nudge:${k}:-60">−1 ชม.</button><button data-act="nudge:${k}:60">+1 ชม.</button><button data-act="nudge:${k}:1440">+1 วัน</button></div></div>`;
      body = `${row('start', 'ส่งรถ')}${row('end', 'รับรถคืน')}
        ${bad ? '<div class="warn">เวลารับรถคืนต้องหลังเวลาส่งรถ</div>' : ''}
        ${cl ? `<div class="warn">⚠ ชนกับคิว ${who(cl)} (${dayText(cl.start, cl.startTime)} → ${dayText(cl.end, cl.endTime)})</div>` : (bad ? '' : turnHtml(neighbours(b, b.carId, range)))}
        <div class="two"><button class="btn" data-act="view:main">ยกเลิก</button><button class="btn save" data-act="savetime" ${changed && !bad ? '' : 'disabled'}>${cl ? 'บันทึกทั้งที่ชน' : 'บันทึกเวลาใหม่'}</button></div>`;
    }
    host.innerHTML = `<div class="ov" data-act="backdrop"><div class="bs" role="dialog" aria-modal="true" aria-label="จัดการคิว">${head}${body}</div></div>`;
  }

  // ---------- long-press drag (phone + mouse) ----------
  // Hold ~0.45s on a bar to lift it; then up/down picks the car row under the
  // finger and left/right shifts the booking by whole days. A quick swipe
  // still scrolls the table, and a quick tap still opens the button sheet.
  const HOLD_MS = 450, SLOP = 10;
  let drag = null; // { b, el, ghost, tip, x0, y0, timer, active, carId, days, slotW }
  let suppressClick = false;

  function dropPlan(d) {
    const b = d.b;
    const h = d.halves || 0;
    let range = b;
    if (h) {
      const s = shift(b.start, b.startTime, h * 720), e = shift(b.end, b.endTime, h * 720);
      range = { start: s.date, startTime: s.time, end: e.date, endTime: e.time };
    }
    const carId = d.carId || b.carId;
    // An odd number of half-days lands in the other half (บ่าย -> เช้า): ask for the exact time after dropping.
    const pickTime = h % 2 !== 0;
    return { carId, range, halves: h, pickTime, clash: clashFor(b, carId, range), changed: carId !== b.carId || !!h };
  }

  function updateDrag(x, y) {
    const d = drag;
    d.ghost.style.left = (x - d.offX) + 'px';
    d.ghost.style.top = (y - d.offY) + 'px';
    d.ghost.style.display = 'none';
    const under = R.elementFromPoint(x, y);
    d.ghost.style.display = '';
    const row = under && under.closest('.row[data-car]');
    R.querySelectorAll('.row.drop').forEach(r => r.classList.remove('drop', 'bad'));
    d.carId = row ? row.dataset.car : d.b.carId;
    d.halves = Math.round((x - d.x0) / d.slotW);
    const plan = dropPlan(d);
    if (row) { row.classList.add('drop'); if (plan.clash) row.classList.add('bad'); }
    d.ghost.classList.toggle('clash', !!plan.clash);
    const c = car(plan.carId);
    d.tip.innerHTML = `<b>${plan.carId !== d.b.carId ? '→ ' : ''}${c.no ? c.no + '. ' : ''}${c.plate} · ${c.name}</b>
      <span>${plan.pickTime ? `ส่งรถ${period(plan.range.startTime) === 'am' ? 'ช่วงเช้า' : 'ช่วงบ่าย'} ${dayText(plan.range.start)} · ปล่อยแล้วเลือกเวลา` : `${dayText(plan.range.start, plan.range.startTime)} → ${dayText(plan.range.end, plan.range.endTime)}`}</span>
      ${!plan.clash ? (() => { const nb = neighbours(d.b, plan.carId, plan.range); return (nb.prev ? `<span class="g-${nb.prev.level}">⏱ ก่อนรับ เตรียม ${gapText(nb.prev.m)}${nb.prev.together > 1 ? ` (พร้อมกัน ${nb.prev.together} คัน)` : ''}</span>` : '') + (nb.next ? `<span class="g-${nb.next.level}">⏱ หลังคืน เตรียม ${gapText(nb.next.m)}${nb.next.together > 1 ? ` (พร้อมกัน ${nb.next.together} คัน)` : ''}</span>` : ''); })() : ''}
      ${plan.clash ? `<span class="bad">⚠ ชนคิว ${who(plan.clash)}</span>` : (plan.changed ? '<span>ปล่อยนิ้วเพื่อวาง</span>' : '<span>ลากขึ้นลงเพื่อเปลี่ยนรถ · ซ้ายขวาเพื่อเลื่อนครึ่งวัน</span>')}`;
  }

  // Keep the dragged bar reachable: nudge the table/page when the finger nears an edge.
  function autoScroll() {
    if (!drag || !drag.active) return;
    const wrap = R.getElementById('wrap'), r = wrap.getBoundingClientRect(), E = 48;
    let moved = false;
    if (drag.x < r.left + 150 && wrap.scrollLeft > 0) { wrap.scrollLeft -= 8; moved = true; }
    if (drag.x > r.right - E) { wrap.scrollLeft += 8; moved = true; }
    if (drag.y < E + 60) { window.scrollBy(0, -10); moved = true; }
    if (drag.y > innerHeight - E) { window.scrollBy(0, 10); moved = true; }
    if (moved) updateDrag(drag.x, drag.y);
    drag.raf = requestAnimationFrame(autoScroll);
  }

  function liftBar() {
    const d = drag; d.active = true;
    d.el.classList.remove('lifting');
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch {} }
    const r = d.el.getBoundingClientRect();
    d.offX = d.x0 - r.left; d.offY = d.y0 - r.top;
    const track = d.el.closest('.track');
    d.slotW = track.getBoundingClientRect().width / (DAYS * 2);
    d.ghost = d.el.cloneNode(true);
    d.ghost.classList.add('ghost'); d.ghost.classList.remove('flash');
    Object.assign(d.ghost.style, { width: r.width + 'px', left: r.left + 'px', top: r.top + 'px' });
    L.appendChild(d.ghost);
    d.el.classList.add('src');
    d.tip = document.createElement('div'); d.tip.className = 'dragtip';
    L.appendChild(d.tip);
    document.body.classList.add('dragging');
    d.x = d.x0; d.y = d.y0;
    updateDrag(d.x0, d.y0);
    d.raf = requestAnimationFrame(autoScroll);
  }

  function endDrag(commit) {
    const d = drag; if (!d) return;
    clearTimeout(d.timer);
    d.el.classList.remove('lifting', 'src');
    if (!d.active) { drag = null; return; }
    cancelAnimationFrame(d.raf);
    d.ghost.remove(); d.tip.remove();
    document.body.classList.remove('dragging');
    R.querySelectorAll('.row.drop').forEach(r => r.classList.remove('drop', 'bad'));
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 350);
    const plan = dropPlan(d);
    drag = null;
    if (!commit || !plan.changed) return;
    if (plan.pickTime) { openTimePick(d.b, plan); return; }
    if (plan.clash) {
      sheet = { id: d.b.id, view: 'drop', plan, start: d.b.start, startTime: d.b.startTime, end: d.b.end, endTime: d.b.endTime };
      renderSheet();
    } else applyPlan(d.b, plan);
  }

  // ---------- pick an exact time after crossing เช้า/บ่าย ----------
  const period = t => (+((t || '10:00').split(':')[0]) < 12 ? 'am' : 'pm');
  const SLOTS = {
    am: ['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'],
    pm: ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00'],
  };
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  // New pickup time on the dropped day. The return day moves by the same number
  // of days and keeps its clock time, so the rental keeps its day count.
  function rangeAt(b, date, time) {
    const days = Math.round((Date.parse(date) - Date.parse(b.start)) / 864e5);
    let end = addDays(b.end, days), endTime = b.endTime;
    if (moment(end, endTime) <= moment(date, time)) { // very short rental: keep its length instead
      const e = shift(date, time, mins(moment(b.start, b.startTime), moment(b.end, b.endTime)));
      end = e.date; endTime = e.time;
    }
    return { start: date, startTime: time, end, endTime };
  }
  function openTimePick(b, plan) {
    const per = period(plan.range.startTime), list = SLOTS[per];
    const want = toMin(plan.range.startTime);
    const near = [...list].sort((x, y) => Math.abs(toMin(x) - want) - Math.abs(toMin(y) - want));
    // Start on the nearest time that is free; fall back to the nearest time at all.
    const pick = near.find(t => !clashFor(b, plan.carId, rangeAt(b, plan.range.start, t))) || near[0];
    sheet = { id: b.id, view: 'pick', plan, per, pick, start: b.start, startTime: b.startTime, end: b.end, endTime: b.endTime };
    renderSheet();
  }

  function applyPlan(b, plan) {
    const movedCar = plan.carId !== b.carId;
    commit(b, { carId: plan.carId, start: plan.range.start, startTime: plan.range.startTime, end: plan.range.end, endTime: plan.range.endTime },
      movedCar ? `ย้าย ${who(b)} ไป ${car(plan.carId).plate} แล้ว` : null);
  }
  // Save one booking's new car/time to the app (phone storage + Google Sheet)
  // and offer undo. Price follows the day count, like the booking form.
  function commit(b, patch, msg) {
    const before = { carId: b.carId, start: b.start, startTime: b.startTime, end: b.end, endTime: b.endTime, total: b.total };
    const oldDays = daysBetween(b.start, b.end);
    Object.assign(b, patch);
    const days = daysBetween(b.start, b.end);
    if (days !== oldDays && b.rate) b.total = days * b.rate + (+b.otFee || 0);
    persist(b, [before.carId, b.carId]);
    undo = { b, before };
    flashId = b.id; closeSheet(); renderKeep();
    toast((msg || `เลื่อน ${who(b)} เป็น ${dayText(b.start, b.startTime)} → ${dayText(b.end, b.endTime)}`) +
      (days !== oldDays ? ` · ${days} วัน ${(+b.total || 0).toLocaleString()} ฿` : ''), true);
  }
  function persist(b, carIds) {
    b.updatedAt = nowISO();
    [...new Set(carIds)].forEach(id => syncCarActiveStatus(id));
    saveToStorage();
    pushToSheets(['bookings', 'cars']);
    renderCurrentPage();
  }
  function doUndo() {
    if (undo.ids) { undoImport(); return; }
    const { b, before } = undo; undo = null;
    const from = b.carId;
    Object.assign(b, before);
    persist(b, [from, b.carId]);
    flashId = null; renderKeep();
    L.getElementById('toastHost').innerHTML = '';
  }

  R.addEventListener('pointerdown', e => {
    const el = e.target.closest('.bar');
    if (!el || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const b = bookings.find(x => x.id === el.dataset.id); if (!b) return;
    drag = { b, el, x0: e.clientX, y0: e.clientY, active: false, mouse: e.pointerType === 'mouse', pid: e.pointerId };
    if (!drag.mouse) {
      el.classList.add('lifting');
      drag.timer = setTimeout(() => { if (drag && !drag.active) liftBar(); }, HOLD_MS);
    }
  });
  document.addEventListener('pointermove', e => { if (!alive()) return;
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.active) {
      const far = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > SLOP;
      if (drag.mouse && far) liftBar();          // mouse: drag straight away
      else if (far) { endDrag(false); return; }  // finger moved before the hold: it's a scroll
      else return;
    }
    drag.x = e.clientX; drag.y = e.clientY;
    updateDrag(e.clientX, e.clientY);
  });
  document.addEventListener('pointerup', e => { if (!alive()) return; if (drag && e.pointerId === drag.pid) endDrag(true); });
  document.addEventListener('pointercancel', e => { if (!alive()) return; if (drag && e.pointerId === drag.pid) endDrag(false); });
  // Once a bar is lifted, stop the page from scrolling under the finger.
  document.addEventListener('touchmove', e => { if (!alive()) return; if (drag && drag.active) e.preventDefault(); }, { passive: false });
  R.addEventListener('contextmenu', e => { if (e.target.closest('.bar')) e.preventDefault(); });

  function toast(msg, withUndo) {
    const host = L.getElementById('toastHost');
    host.innerHTML = `<div class="toast" role="status"><span>${msg}</span>${withUndo ? '<button data-act="undo">เลิกทำ</button>' : ''}</div>`;
    clearTimeout(toast.t); toast.t = setTimeout(() => { host.innerHTML = ''; undo = null; }, 6000);
  }
  function moveCar(carId) {
    const b = bookings.find(x => x.id === sheet.id);
    commit(b, { carId }, `ย้าย ${who(b)} ไป ${car(carId).plate} แล้ว`);
  }
  function shift(date, time, minutes) {
    const [h, m] = (time || '10:00').split(':').map(Number);
    const d = new Date(date + 'T00:00:00Z'); d.setUTCMinutes(h * 60 + m + minutes);
    const p = n => String(n).padStart(2, '0');
    return { date: iso(d), time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` };
  }

  const onClick = e => {
    if (!alive()) return;
    // Tap a day header, or an empty spot in the table, to light up that day.
    if (!e.target.closest('.bar, [data-act], .gap') && !suppressClick) {
      const dh = e.target.closest('.dh'), track = e.target.closest('.track');
      if (dh || track) {
        const start = addDays(todayISO, offset - BACK);
        const idx = dh ? [...dh.parentNode.children].indexOf(dh) : Math.floor((e.clientX - track.getBoundingClientRect().left) / dw);
        const d = addDays(start, idx);
        selDay = selDay === d ? null : d;
        const sl = wrapEl().scrollLeft; render(); wrapEl().scrollLeft = sl;
        return;
      }
    }
    const t = e.target.closest('[data-act], .bar');
    if (!t) return;
    if (suppressClick && t.classList.contains('bar')) return;
    if (t.classList.contains('bar')) { openSheet(t.dataset.id); return; }
    const [act, a1, a2] = t.dataset.act.split(':');
    if (act === 'backdrop') { if (e.target === t) closeSheet(); return; }
    if (act === 'close') closeSheet();
    else if (act === 'view') { sheet.view = a1; sheet.pendingCar = null; renderSheet(); }
    else if (act === 'edit') { const id = sheet.id; closeSheet(); openEditBookingModal(id); }
    else if (act === 'hours') { const d = selDay; selDay = null; dayPill(); openGanttDay(d); }
    else if (act === 'car') {
      const b = bookings.find(x => x.id === sheet.id);
      if (clashFor(b, a1)) { sheet.pendingCar = a1; renderSheet(); L.querySelector('.bs').scrollTop = 0; }
      else moveCar(a1);
    }
    else if (act === 'force') moveCar(a1);
    else if (act === 'applydrop') { const b = bookings.find(x => x.id === sheet.id); applyPlan(b, sheet.plan); }
    else if (act === 'unsel') { selDay = null; const sl = wrapEl().scrollLeft; render(); wrapEl().scrollLeft = sl; }
    else if (act === 'pick') { sheet.pick = a1.replace('.', ':'); renderSheet(); }
    else if (act === 'applypick') {
      const b = bookings.find(x => x.id === sheet.id), p = sheet.plan;
      const range = rangeAt(b, p.range.start, sheet.pick);
      applyPlan(b, { ...p, range });
    }
    else if (act === 'cancelpending') { sheet.pendingCar = null; renderSheet(); }
    else if (act === 'nudge') {
      const n = shift(sheet[a1], sheet[a1 + 'Time'], +a2);
      sheet[a1] = n.date; sheet[a1 + 'Time'] = n.time; renderSheet();
    }
    else if (act === 'savetime') {
      const b = bookings.find(x => x.id === sheet.id);
      commit(b, { start: sheet.start, startTime: sheet.startTime, end: sheet.end, endTime: sheet.endTime });
    }
    else if (act === 'undo' && undo) doUndo();
  };
  R.addEventListener('click', onClick); L.addEventListener('click', onClick);

  // ---------- zoom + endless scroll ----------
  const visDays = () => (wrapEl().clientWidth - CARCOLS) / dw;
  const leftDay = () => wrapEl().scrollLeft / dw; // days from the window start
  function applyZoom() {
    const sh = wrapEl().querySelector('.sheet'); if (!sh) return;
    wrapEl().style.setProperty('--dw', dw + 'px');
    sh.classList.toggle('z-s', dw < 60);
    sh.classList.toggle('z-xs', dw < 40);
    sh.classList.toggle('z-xxs', dw < 20);
    monthLabel(); pinText();
    const v = visDays();
    [['span3', 3], ['span7', 7], ['span30', 30]].forEach(([id, n]) => R.getElementById(id).setAttribute('aria-pressed', Math.abs(v - n) < n * .15));
  }
  // Slide each bar's text right when the bar starts behind the car columns, so it stays readable.
  let pinRaf = 0;
  function pinText() {
    cancelAnimationFrame(pinRaf);
    pinRaf = requestAnimationFrame(() => {
      const sl = wrapEl().scrollLeft;
      wrapEl().querySelectorAll('.bar').forEach(el => {
        const hidden = sl - el.offsetLeft, inn = el.firstElementChild;
        const shift = hidden > 0 ? Math.min(hidden + 4, el.offsetWidth - 70) : 0;
        inn.style.transform = shift > 0 ? `translateX(${shift}px)` : '';
      });
    });
  }
  // Summary of the highlighted day: how many cars go out and come back.
  function dayPill() {
    let el = L.querySelector('.daypill');
    if (!selDay) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.className = 'daypill'; el.setAttribute('role', 'status'); L.appendChild(el); }
    const out = bookings.filter(b => b.start === selDay).length, back = bookings.filter(b => b.end === selDay).length;
    const busy = bookings.filter(b => b.start <= selDay && b.end >= selDay).length;
    el.innerHTML = `<span>📅 ${dayText(selDay)} · ส่ง ${out} · รับคืน ${back} · ใช้งาน ${busy} คัน</span><button data-act="hours" class="hrs">รายชั่วโมง</button><button data-act="unsel" aria-label="เลิกไฮไลต์">×</button>`;
  }
  // Month of the left-most visible day, shown in the header's car cell.
  function monthLabel() {
    const el = wrapEl().querySelector('.curmon'); if (!el) return;
    const d = new Date(addDays(todayISO, offset - BACK + Math.floor(leftDay() + .5)) + 'T00:00:00Z');
    el.textContent = `${MON[d.getUTCMonth()]} ${(d.getUTCFullYear() + 543) % 100}`;
  }
  // Put day `idx` (days from today) at the left edge.
  function goTo(idx, frac = 0) { offset = idx; render(); wrapEl().scrollLeft = (BACK + frac) * dw; }
  function setZoom(nd, anchorX) {
    const w = wrapEl(), r = w.getBoundingClientRect();
    const ax = anchorX == null ? CARCOLS : Math.max(CARCOLS, anchorX - r.left);
    const at = (w.scrollLeft + ax - CARCOLS) / dw; // the day under the fingers stays put
    dw = Math.max(DW_MIN, Math.min(DW_MAX, nd));
    applyZoom();
    w.scrollLeft = at * dw - (ax - CARCOLS);
  }
  let hintT;
  function zoomHint() {
    let h = L.querySelector('.zoomhint');
    if (!h) { h = document.createElement('div'); h.className = 'zoomhint'; L.appendChild(h); }
    const v = visDays(); h.textContent = `เห็น ${v < 10 ? (Math.round(v * 2) / 2) : Math.round(v)} วัน`;
    clearTimeout(hintT); hintT = setTimeout(() => h.remove(), 900);
  }
  let pinch = null;
  wrapEl().addEventListener('touchstart', e => {
    if (e.touches.length !== 2 || (drag && drag.active)) return;
    if (drag) endDrag(false);
    const [a, b] = e.touches;
    pinch = { d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), dw0: dw };
  }, { passive: true });
  wrapEl().addEventListener('touchmove', e => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault(); // our zoom, not the browser's
    const [a, b] = e.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    setZoom(pinch.dw0 * d / pinch.d0, (a.clientX + b.clientX) / 2);
    zoomHint();
  }, { passive: false });
  wrapEl().addEventListener('touchend', e => { if (pinch && e.touches.length < 2) { pinch = null; store.set('qlab.dw', dw); recentre(); } });
  ['gesturestart', 'gesturechange'].forEach(t => wrapEl().addEventListener(t, e => e.preventDefault()));
  // Trackpad pinch / Ctrl+wheel on a computer.
  wrapEl().addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(dw * Math.exp(-e.deltaY / 120), e.clientX); zoomHint();
    clearTimeout(wrapEl().zt); wrapEl().zt = setTimeout(() => { store.set('qlab.dw', dw); recentre(); }, 200);
  }, { passive: false });
  // Endless: near either end of the 6-week window, redraw around where you are.
  function recentre() {
    const l = leftDay(), v = visDays();
    if (l > 1 && l + v < DAYS - 1) return;
    goTo(Math.floor(l) - BACK + offset, l - Math.floor(l));
  }
  let scrollT;
  wrapEl().addEventListener('scroll', () => { monthLabel(); pinText(); if (pinch || (drag && drag.active)) return; clearTimeout(scrollT); scrollT = setTimeout(recentre, 160); }, { passive: true });

  const jump = dir => goTo(Math.round(leftDay()) - BACK + offset + dir * Math.max(1, Math.round(visDays())));
  R.getElementById('prev').onclick = () => jump(-1);
  R.getElementById('next').onclick = () => jump(1);
  // Typed pickup time (any minute) in the time picker.
  L.addEventListener('change', e => {
    if (!alive()) return;
    if (e.target.id !== 'pickTime' || !sheet || sheet.view !== 'pick' || !/^\d\d:\d\d/.test(e.target.value)) return;
    sheet.pick = e.target.value.slice(0, 5); renderSheet();
  });
  R.getElementById('today').onclick = () => goTo(0);
  // ---------- import bookings from a file (e.g. the shop's queue Sheet, converted by Yu) ----------
  const impFile = R.getElementById('impFile');
  R.getElementById('imp').onclick = () => { impFile.value = ''; impFile.click(); };
  impFile.onchange = async () => {
    const f = impFile.files && impFile.files[0]; if (!f) return;
    let list;
    try { const d = JSON.parse(await f.text()); list = Array.isArray(d) ? d : d.bookings; } catch (_) { list = null; }
    if (!Array.isArray(list)) { alert('ไฟล์นี้อ่านไม่ได้ ต้องเป็นไฟล์นำเข้าคิวที่ยูส่งให้'); return; }
    const carIds = new Set(state.cars.map(c => c.id));
    const key = b => `${b.carId}|${b.start}|${b.startTime || ''}`;
    const have = new Set(state.bookings.map(b => b.id)), haveKey = new Set(state.bookings.map(key));
    const add = [], dup = [], bad = [];
    list.forEach(b => {
      if (!b || !b.id || !b.start || !b.end || !carIds.has(b.carId)) bad.push(b);
      else if (have.has(b.id) || haveKey.has(key(b))) dup.push(b);
      else add.push(b);
    });
    if (!add.length) { alert(`ไม่มีคิวใหม่ให้นำเข้า (ซ้ำ ${dup.length} · ใช้ไม่ได้ ${bad.length})`); return; }
    const msg = `นำเข้า ${add.length} คิวลงเว็บและชีต?` + (dup.length ? `\nข้าม ${dup.length} คิวที่มีอยู่แล้ว` : '') + (bad.length ? `\nข้าม ${bad.length} คิวที่ไม่เจอรถ` : '');
    if (!confirm(msg)) return;
    const now = nowISO(), ids = [];
    add.forEach(b => {
      const rec = Object.assign({ phone: '', customerAddress: '', pickupLocation: '', returnLocation: '', mileageOut: 0, rate: 0, otFee: 0, total: 0, deposit: 0, bookingDeposit: 0, note: '' }, b, { updatedAt: now });
      if (state.tombstones && state.tombstones.bookings) delete state.tombstones.bookings[rec.id];
      state.bookings.push(rec); ids.push(rec.id);
    });
    [...new Set(add.map(b => b.carId))].forEach(id => syncCarActiveStatus(id));
    saveToStorage(); pushToSheets(['bookings', 'cars']); renderCurrentPage();
    undo = { ids, carIds: [...new Set(add.map(b => b.carId))] };
    toast(`นำเข้าแล้ว ${add.length} คิว` + (dup.length ? ` · ข้ามที่ซ้ำ ${dup.length}` : ''), true);
  };
  function undoImport() {
    const { ids, carIds } = undo; undo = null;
    const gone = new Set(ids);
    state.bookings = state.bookings.filter(b => !gone.has(b.id));
    ids.forEach(id => markDeleted('bookings', id));
    carIds.forEach(id => syncCarActiveStatus(id));
    saveToStorage(); pushToSheets(['bookings', 'cars']); renderCurrentPage();
    L.getElementById('toastHost').innerHTML = '';
  }
  [['span3', 3], ['span7', 7], ['span30', 30]].forEach(([id, n]) => {
    R.getElementById(id).onclick = () => { const l = Math.round(leftDay()) - BACK + offset; dw = fitDw(n); store.set('qlab.dw', dw); goTo(l); };
  });
  document.addEventListener('keydown', e => { if (!alive()) return; if (e.key === 'Escape' && sheet) closeSheet(); });
  function first() { if (!dw) dw = fitDw(matchMedia('(max-width: 700px)').matches ? 3 : 7); goTo(0); }
  // Redraw in place (after a save or a tab/sort change) without losing the scroll position.
  function renderKeep() { const w = wrapEl(), sl = w.scrollLeft; render(); w.scrollLeft = sl; }
  addEventListener('resize', () => { if (alive()) applyZoom(); });
  return { first, renderKeep, closeSheet: () => closeSheet() };
  }

  let inst = null, layerRoot = null;
  function layer() {
    if (!layerRoot || !layerRoot.host.isConnected) {
      const h = document.createElement('div'); h.id = 'qvLayer';
      document.body.appendChild(h);
      layerRoot = h.attachShadow({ mode: 'open' });
      layerRoot.innerHTML = `<style>${CSS}</style><div id="sheetHost"></div><div id="toastHost"></div>`;
    }
    return layerRoot;
  }

  // Replaces the app's week view. The hourly day view stays the app's own.
  window.renderGanttWeekView = function () {
    const chart = document.getElementById('ganttChart');
    if (!chart) return;
    chart.style.touchAction = 'auto'; // native scrolling; the table handles its own gestures
    let host = chart.querySelector(':scope > #qvHost');
    if (!host || !inst) {
      chart.innerHTML = '';
      host = document.createElement('div'); host.id = 'qvHost';
      chart.appendChild(host);
      const R = host.attachShadow({ mode: 'open' });
      R.innerHTML = `<style>${CSS}</style>${TOP}<div class="wrap" id="wrap"></div>${LEGEND}`;
      inst = create(R, layer(), () => host.isConnected);
      inst.first();
    } else inst.renderKeep();
  };
  // The old pointer-driven pan/drag would fight the new table's gestures.
  window.initGanttDragScroll = function () {
    const w = document.getElementById('ganttChart');
    if (w) w.style.touchAction = 'auto';
  };
  // Week view brings its own ‹ วันนี้ › and zoom buttons.
  const origControls = window.renderGanttControls;
  window.renderGanttControls = function () {
    if (ganttDayView) return origControls();
    const el = document.getElementById('ganttControls');
    if (el) el.innerHTML = '';
  };
  // Leaving the week view (day view) drops the old table; a fresh one is built on return.
  const origDay = window.renderGanttDayView;
  window.renderGanttDayView = function (d) { inst = null; return origDay(d); };
})();
