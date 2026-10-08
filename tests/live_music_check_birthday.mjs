#!/usr/bin/env node
/* QA final di PRODUKSI dengan simulasi hari-H (9 Okt 2026):
   player HARUS tampil, track switching bekerja, lirik termuat. */
import { spawn } from "node:child_process";

const BASE = "https://yuliuspratama.github.io/ucapan-ulang-tahun-35/index.html";
const CHROME_DBG = 9342;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const proc = spawn("chromium", [
    "--headless=new", "--no-sandbox", "--disable-gpu",
    `--remote-debugging-port=${CHROME_DBG}`,
    "--remote-allow-origins=*",
    "--user-data-dir=/tmp/qa-livebd-" + Date.now(),
    "--autoplay-policy=no-user-gesture-required",
    "--mute-audio",
    "--window-size=1280,2400",
    "about:blank"
  ], { stdio: "ignore" });
  await sleep(2500);

  const res = await fetch(`http://127.0.0.1:${CHROME_DBG}/json/new?${BASE}`, { method: "PUT" });
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
  await send("Network.enable");
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
  await sleep(4500);

  // Klik putar, tunggu, cek playback dari CDN
  await evalJS("document.getElementById('music-play').click()");
  await sleep(3500);
  let st1 = await evalJS(`(function(){
    const a = document.getElementById('music-audio');
    return { src: a.src.split('/').pop(), paused: a.paused, t: +a.currentTime.toFixed(1), dur: Math.round(a.duration) };
  })()`);

  // Ganti ke V2
  await evalJS("document.getElementById('track-tab-2').click()");
  await sleep(2500);

  // Buka lirik
  await evalJS("document.getElementById('music-lyrics-btn').click()");
  await sleep(2000);

  const final = await evalJS(`(function(){
    const a = document.getElementById('music-audio');
    const lyr = document.getElementById('music-lyrics-text').textContent;
    return {
      playerVisible: !document.getElementById('music-player').hasAttribute('hidden'),
      isBirthday: document.documentElement.classList.contains('is-birthday'),
      bannerVisible: getComputedStyle(document.getElementById('birthday-banner')).display !== 'none',
      track2Loaded: a.src.includes('V2.mp3'),
      track2Label: document.getElementById('music-name').textContent,
      lyricsOpen: !document.getElementById('music-lyrics').hasAttribute('hidden'),
      lyricsLoaded: lyr.includes('Selamat ulang tahun, Dayday'),
      lyricsLen: lyr.length,
      durationLabel: document.getElementById('music-duration').textContent
    };
  })()`);

  console.log(JSON.stringify({ afterPlay: st1, ...final }, null, 2));

  const ok = final.playerVisible && final.isBirthday && final.bannerVisible &&
    final.track2Loaded && final.lyricsOpen && final.lyricsLoaded && st1.t > 0;
  console.log(ok ? "LIVE HARI-H QA: LOLOS — besok player tampil & berfungsi di produksi" : "LIVE HARI-H QA: GAGAL");
  proc.kill("SIGTERM");
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error("live bd QA error:", e); process.exit(2); });
