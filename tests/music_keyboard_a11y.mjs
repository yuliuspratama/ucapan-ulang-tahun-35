#!/usr/bin/env node
/* Keyboard-nav & aksesibilitas khusus music player saat hari-H:
   - Tab menjangkau semua kontrol player (tab versi, putar, lirik, slider)
   - Fokus punya outline terlihat
   - role/aria konsisten */
import { spawn } from "node:child_process";

const PORT = 8931;
const CHROME_DBG = 9340;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const proc = spawn("chromium", [
    "--headless=new", "--no-sandbox", "--disable-gpu",
    `--remote-debugging-port=${CHROME_DBG}`,
    "--remote-allow-origins=*",
    "--user-data-dir=/tmp/qa-kb-" + Date.now(),
    "--window-size=1280,2400",
    "about:blank"
  ], { stdio: "ignore" });
  await sleep(2500);

  const res = await fetch(`http://127.0.0.1:${CHROME_DBG}/json/new?http://127.0.0.1:${PORT}/index.html`, { method: "PUT" });
  const tab = await res.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });

  let msgId = 0;
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++msgId;
    const onmsg = (ev) => {
      const d = JSON.parse(ev.data);
      if (d.id === id) { ws.removeEventListener("message", onmsg); resolve(d.result); }
    };
    ws.addEventListener("message", onmsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send("Page.enable");
  const evalJS = (expr) => send("Runtime.evaluate", { expression: expr, returnByValue: true }).then(r => r.result.value);

  const override = `(function(){
    const RealDate = Date;
    const FAKE_NOW = RealDate.parse('2026-10-09T10:00:00+07:00');
    function FakeDate(...args){ return args.length ? new RealDate(...args) : new RealDate(FAKE_NOW); }
    FakeDate.prototype = RealDate.prototype;
    FakeDate.now = () => FAKE_NOW;
    FakeDate.parse = RealDate.parse; FakeDate.UTC = RealDate.UTC;
    Object.setPrototypeOf(FakeDate, RealDate);
    window.Date = FakeDate;
  })()`;
  await send("Page.addScriptToEvaluateOnNewDocument", { source: override });
  await evalJS("location.reload()");
  await sleep(3000);

  const results = await send("Runtime.evaluate", { expression: `(async function(){
    // Pendekatan deterministik: enumerasi elemen fokusable dalam urutan DOM
    const focusables = Array.from(document.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea'
    )).filter(el => {
      if (el.closest('[hidden]')) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none';
    });
    const playerIds = ['track-tab-1','track-tab-2','music-play','music-lyrics-btn','music-progress'];
    const playerIdx = {};
    focusables.forEach((el, i) => {
      playerIds.forEach(pid => { if (el.id === pid) playerIdx[pid] = i; });
    });
    const outlines = {};
    for (const pid of playerIds) {
      const el = document.getElementById(pid);
      if (!el) { outlines[pid] = 'missing'; continue; }
      el.focus();
      const cs = getComputedStyle(el);
      outlines[pid] = {
        focused: document.activeElement === el,
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth
      };
    }
    return {
      totalFocusables: focusables.length,
      playerOrder: playerIdx,
      outlines,
      progressRole: document.getElementById('music-progress').getAttribute('role'),
      playAria: document.getElementById('music-play').getAttribute('aria-label'),
      tab1Aria: document.getElementById('track-tab-1').getAttribute('aria-selected'),
      tab2Aria: document.getElementById('track-tab-2').getAttribute('aria-selected'),
      lyricsAria: document.getElementById('music-lyrics-btn').getAttribute('aria-expanded')
    };
  })()`, returnByValue: true, awaitPromise: true });
  console.log(JSON.stringify(results.result.value, null, 2));

  proc.kill("SIGTERM");
  process.exit(0);
})().catch(e => { console.error("kb error:", e); process.exit(2); });
