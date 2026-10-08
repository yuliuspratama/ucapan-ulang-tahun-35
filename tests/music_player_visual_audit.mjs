#!/usr/bin/env node
/* Audit visual DOM untuk music player saat hari-H:
   ukur bounding box, warna terkomputasi, kontras WCAG elemen kunci. */
import { spawn } from "node:child_process";

const PORT = 8931;
const BASE = `http://127.0.0.1:${PORT}/index.html`;
const CHROME_DBG = 9334;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function newTab() {
  const res = await fetch(`http://127.0.0.1:${CHROME_DBG}/json/new?${BASE}`, { method: "PUT" });
  return res.json();
}

(async () => {
  const proc = spawn("chromium", [
    "--headless=new", "--no-sandbox", "--disable-gpu",
    `--remote-debugging-port=${CHROME_DBG}`,
    "--remote-allow-origins=*",
    "--user-data-dir=/tmp/qa-music-audit-" + Date.now(),
    "--window-size=1280,2400",
    "about:blank"
  ], { stdio: "ignore" });
  await sleep(2500);

  let ws;
  {
    const tab = await newTab();
    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
  }
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
  const evalJS = (expr, awaitPromise = false) => send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise }).then(r => r.result.value);

  // Override tanggal ke hari-H sebelum script jalan
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
  await evalJS("location.reload()", true);
  await sleep(3000);

  const audit = await evalJS(`(function(){
    function lum(c){ const a=c.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2]; }
    function ratio(f,b){ const L1=Math.max(lum(f),lum(b)), L2=Math.min(lum(f),lum(b)); return (L1+0.05)/(L2+0.05); }
    function parse(c){ const m=String(c).match(/rgba?\\(([^)]+)\\)/); if(!m) return null; const p=m[1].split(',').map(Number); return {rgb:[p[0],p[1],p[2]], a:p.length>3?p[3]:1}; }
    function effBg(el){ // naik pohon sampai background solid
      let e=el; while(e){ const c=parse(getComputedStyle(e).backgroundColor); if(c && c.a>0.85) return c.rgb; e=e.parentElement; } return [255,255,255];
    }
    function info(id){ const el=document.getElementById(id); if(!el) return {missing:true};
      const r=el.getBoundingClientRect(); const cs=getComputedStyle(el);
      const fg=parse(cs.color); const bg=effBg(el);
      return { id, x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height),
        color:cs.color, fontSize:cs.fontSize, contrast: fg?Math.round(ratio(fg.rgb,bg)*10)/10:null,
        visible: r.width>0 && r.height>0 };
    }
    const sec=document.querySelector('.music-player');
    const sr=sec.getBoundingClientRect();
    const disc=document.getElementById('music-disc');
    const discCS=getComputedStyle(disc);
    return {
      section: { x:Math.round(sr.x), y:Math.round(sr.y), w:Math.round(sr.width), h:Math.round(sr.height) },
      docHeight: document.documentElement.scrollHeight,
      title: info('music-title'),
      tab1: info('track-tab-1'), tab2: info('track-tab-2'),
      play: info('music-play'), progress: info('music-progress'),
      current: info('music-current'), duration: info('music-duration'),
      lyricsBtn: info('music-lyrics-btn'),
      discRound: discCS.borderRadius,
      playRound: getComputedStyle(document.getElementById('music-play')).borderRadius,
      tab1ActiveBg: getComputedStyle(document.getElementById('track-tab-1')).backgroundImage.slice(0,60),
      tab2Bg: getComputedStyle(document.getElementById('track-tab-2')).backgroundColor,
      viewportW: document.documentElement.clientWidth
    };
  })()`);
  console.log(JSON.stringify(audit, null, 2));

  proc.kill("SIGTERM");
  process.exit(0);
})().catch(e => { console.error("audit error:", e); process.exit(2); });
