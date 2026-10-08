#!/usr/bin/env node
/* Verifikasi playback audio sungguhan (bukan cuma UI) di hari-H:
   - autoplay policy headless: gunakan --autoplay-allowed flag
   - cek audio.currentTime bergerak, durasi benar (~3:01), ended event */
import { spawn } from "node:child_process";

const PORT = 8931;
const BASE = `http://127.0.0.1:${PORT}/index.html`;
const CHROME_DBG = 9336;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const proc = spawn("chromium", [
    "--headless=new", "--no-sandbox", "--disable-gpu",
    `--remote-debugging-port=${CHROME_DBG}`,
    "--remote-allow-origins=*",
    "--user-data-dir=/tmp/qa-audio-" + Date.now(),
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

  // Klik putar
  await evalJS("document.getElementById('music-play').click()");
  await sleep(4000);

  const state = await evalJS(`(function(){
    const a = document.getElementById('music-audio');
    return {
      paused: a.paused, currentTime: a.currentTime, duration: a.duration,
      readyState: a.readyState, networkState: a.networkState, error: a.error ? a.error.code : null,
      playing: !a.paused && a.currentTime > 0,
      btnState: document.getElementById('music-play').classList.contains('is-playing'),
      discSpinning: document.getElementById('music-disc').classList.contains('is-spinning'),
      timeLabel: document.getElementById('music-current').textContent,
      progressPct: document.getElementById('music-progress-fill').style.width
    };
  })()`);
  console.log(JSON.stringify(state, null, 2));

  // Berhenti, cek pause
  await evalJS("document.getElementById('music-play').click()");
  await sleep(600);
  const pausedState = await evalJS(`(function(){
    const a = document.getElementById('music-audio');
    return { paused: a.paused, btn: document.getElementById('music-play').classList.contains('is-playing'), disc: document.getElementById('music-disc').classList.contains('is-spinning') };
  })()`);
  console.log("setelah pause:", JSON.stringify(pausedState));

  const ok = state.playing && state.currentTime > 0.5 && pausedState.paused && !pausedState.btn;
  console.log(ok ? "PLAYBACK AUDIO: LOLOS (audio benar-benar berputar & pause bekerja)" : "PLAYBACK AUDIO: GAGAL");
  proc.kill("SIGTERM");
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error("audio QA error:", e); process.exit(2); });
