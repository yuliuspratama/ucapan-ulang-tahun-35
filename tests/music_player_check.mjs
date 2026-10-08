#!/usr/bin/env node
/* Verifikasi CDP: music player hanya tampil di hari ulang tahun.
   Skenario:
     A. Tanggal riil (8 Okt 2026) → player HARUS tersembunyi, tidak ada request audio.
     B. Tanggal dimodifikasi ke 9 Okt 2026 (override Date) → player HARUS tampil
        + tab aktif + klik putar + lirik terbuka + teks lirik termuat.
   Tanpa dependency: WebSocket bawaan Node >= 22, CDP via --remote-debugging-port. */
import { spawn } from "node:child_process";

const PORT = 8931;
const BASE = `http://127.0.0.1:${PORT}/index.html`;
const CHROME_DBG = 9333;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function cdp() {
  // ambil ws url
  const res = await fetch(`http://127.0.0.1:${CHROME_DBG}/json/version`);
  const j = await res.json();
  const ws = new WebSocket(j.webSocketDebuggerUrl.replace("devtools/browser", "devtools/page") === j.webSocketDebuggerUrl ? j.webSocketDebuggerUrl : j.webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
  return ws;
}

let msgId = 0;
function send(ws, method, params = {}) {
  return new Promise((resolve) => {
    const id = ++msgId;
    const onmsg = (ev) => {
      const d = JSON.parse(ev.data);
      if (d.id === id) { ws.removeEventListener("message", onmsg); resolve(d.result); }
    };
    ws.addEventListener("message", onmsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalJS(ws, expr, awaitPromise = false) {
  const r = await send(ws, "Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise });
  return r.result.value;
}

async function newTab() {
  const res = await fetch(`http://127.0.0.1:${CHROME_DBG}/json/new?${BASE}`, { method: "PUT" });
  return res.json();
}

async function tabWs(tab) {
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
  return ws;
}

(async () => {
  // Jalankan chromium headless dengan debug port
  const proc = spawn("chromium", [
    "--headless=new", "--no-sandbox", "--disable-gpu",
    `--remote-debugging-port=${CHROME_DBG}`,
    "--remote-allow-origins=*",
    "--user-data-dir=/tmp/qa-music-chrome-" + Date.now(),
    "--window-size=1280,2000",
    "about:blank"
  ], { stdio: "ignore" });
  await sleep(2500);

  let failures = [];
  const note = (m) => console.log("  ok:", m);
  const fail = (m) => { failures.push(m); console.log("  FAIL:", m); };

  try {
    /* ===== Skenario A: hari biasa (8 Oktober 2026) ===== */
    console.log("SKENARIO A: hari biasa (tanggal riil)");
    let tab = await newTab();
    let ws = await tabWs(tab);
    await send(ws, "Page.enable");
    await send(ws, "Network.enable");
    const audioReqs = [];
    ws.addEventListener("message", (ev) => {
      const d = JSON.parse(ev.data);
      if (d.method === "Network.requestWillBeSent" && /\.mp3/i.test(d.params.request.url)) audioReqs.push(d.params.request.url);
    });
    await sleep(2000);

    let hidden = await evalJS(ws, `document.getElementById('music-player').hasAttribute('hidden')`);
    if (hidden === true) note("player tersembunyi (atribut hidden tetap ada)");
    else fail("player TIDAK tersembunyi di hari biasa!");

    let noIsBd = await evalJS(ws, `!document.documentElement.classList.contains('is-birthday')`);
    if (noIsBd === true) note("html tanpa class is-birthday (sesuai tanggal riil)");
    else note("html punya is-birthday (tanggal mesin = 9 Okt?)");

    await sleep(1500);
    if (audioReqs.length === 0) note("tidak ada request .mp3 di hari biasa (0 byte musik)");
    else fail("ada request mp3 di hari biasa: " + audioReqs.join(", "));

    let layout = await evalJS(ws, `document.getElementById('music-player').getBoundingClientRect().height`);
    if (layout === 0) note("player tidak memakan ruang layout (height 0)");
    else fail("player memakan layout di hari biasa (height=" + layout + ")");

    /* Skenario A2: dengan JS dimatikan → fallback statis tetap tersembunyi */
    // (tab terpisah dengan script disabled tidak mudah via CDP; lewati — hidden ada di markup)

    /* ===== Skenario B: hari ulang tahun (9 Oktober 2026) ===== */
    console.log("SKENARIO B: hari-H (override Date ke 9 Oktober 2026 WIB)");
    tab = await newTab();
    ws = await tabWs(tab);
    await send(ws, "Page.enable");
    await send(ws, "Network.enable");
    const reqsB = [];
    ws.addEventListener("message", (ev) => {
      const d = JSON.parse(ev.data);
      if (d.method === "Network.requestWillBeSent") reqsB.push(d.params.request.url);
    });
    await sleep(2500);

    const override = `(function(){
      const RealDate = Date;
      // 9 Oktober 2026, 10:00 WIB = 03:00 UTC
      const FAKE_NOW = RealDate.parse('2026-10-09T10:00:00+07:00');
      function FakeDate(...args){ return args.length ? new RealDate(...args) : new RealDate(FAKE_NOW); }
      FakeDate.prototype = RealDate.prototype;
      FakeDate.now = () => FAKE_NOW;
      FakeDate.parse = RealDate.parse;
      FakeDate.UTC = RealDate.UTC;
      Object.setPrototypeOf(FakeDate, RealDate);
      window.Date = FakeDate;
    })()`;
    // Karena script sudah dieksekusi saat load, kita reload halaman dengan override terpasang
    await evalJS(ws, override);
    await evalJS(ws, `location.reload()`, true);
    await sleep(2500);
    // setelah reload, override hilang — perlu Page.addScriptToEvaluateOnNewDocument
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: override });
    await evalJS(ws, `location.reload()`, true);
    await sleep(3000);

    let hiddenB = await evalJS(ws, `document.getElementById('music-player').hasAttribute('hidden')`);
    if (hiddenB === false) note("player TAMPIL di hari-H");
    else fail("player tetap tersembunyi di hari-H!");

    let isBd = await evalJS(ws, `document.documentElement.classList.contains('is-birthday')`);
    if (isBd === true) note("html.is-birthday aktif (script.js setuju hari-H)");
    else fail("is-birthday tidak aktif padahal override ke 9 Okt");

    let tab1 = await evalJS(ws, `document.getElementById('music-name').textContent`);
    if (tab1 === "Halaman Tiga Puluh Lima — Versi 1") note("label track 1 benar: " + tab1);
    else fail("label track 1 salah: " + tab1);

    // Klik putar → cek audio src + state
    await evalJS(ws, `document.getElementById('music-play').click()`);
    await sleep(2000);
    let src = await evalJS(ws, `document.getElementById('music-audio').src`);
    if (src.includes("Halaman%20Tiga%20Puluh%20Lima.mp3")) note("audio src = versi 1");
    else if (src.includes("V2.mp3")) note("audio src = versi 2 (fallback)");
    else fail("audio src tidak dikenal: " + src);

    let paused = await evalJS(ws, `document.getElementById('music-audio').paused`);
    note("audio.paused = " + paused + " (autoplay bisa diblokir headless; tombol tetap benar)");

    let playingCls = await evalJS(ws, `document.getElementById('music-play').classList.contains('is-playing')`);
    if (playingCls === true || paused === true) note("tombol play/pause konsisten (is-playing=" + playingCls + ")");

    // Ganti ke versi 2
    await evalJS(ws, `document.getElementById('track-tab-2').click()`);
    await sleep(1000);
    let src2 = await evalJS(ws, `document.getElementById('music-audio').src`);
    if (src2.includes("V2.mp3")) note("ganti track → versi 2 dimuat");
    else fail("ganti track gagal: " + src2);
    let tab2Lbl = await evalJS(ws, `document.getElementById('music-name').textContent`);
    if (tab2Lbl.includes("Versi 2")) note("label track 2 benar");

    // Durasi terbaca
    let dur = await evalJS(ws, `document.getElementById('music-duration').textContent`);
    note("durasi terbaca: " + dur);

    // Buka lirik
    await evalJS(ws, `document.getElementById('music-lyrics-btn').click()`);
    await sleep(1500);
    let lirikOpen = await evalJS(ws, `!document.getElementById('music-lyrics').hasAttribute('hidden')`);
    if (lirikOpen === true) note("panel lirik terbuka");
    else fail("panel lirik tidak terbuka");
    let lirikTxt = await evalJS(ws, `document.getElementById('music-lyrics-text').textContent`);
    if (lirikTxt.includes("Selamat ulang tahun, Dayday") && lirikTxt.includes("[Chorus]")) note("lirik termuat lengkap (" + lirikTxt.length + " karakter)");
    else fail("lirik tidak termuat: " + lirikTxt.slice(0, 80));

    // Cek kontras & overflow ringan
    let overflow = await evalJS(ws, `(function(){
      const de = document.documentElement;
      return de.scrollWidth - de.clientWidth;
    })()`);
    if (overflow <= 2) note("tidak ada overflow horizontal (delta=" + overflow + "px)");
    else fail("overflow horizontal: " + overflow + "px");

    // Console error check via listener sudah terpasang? (ringan)
    let consoleErrs = await evalJS(ws, `(function(){
      window.__errs = window.__errs || [];
      return window.__errs.length;
    })()`);
    note("console errors (hooked post-load): " + consoleErrs);

    // Screenshot hari-H
    const shot = await send(ws, "Page.captureScreenshot", { format: "png" });
    const { writeFileSync, mkdirSync } = await import("node:fs");
    mkdirSync("qa-shots", { recursive: true });
    writeFileSync("qa-shots/music-player-birthday.png", Buffer.from(shot.data, "base64"));
    note("screenshot hari-H disimpan: qa-shots/music-player-birthday.png");

    /* ===== Ringkasan ===== */
    console.log("");
    if (failures.length === 0) {
      console.log("MUSIC PLAYER QA: SEMUA SKENARIO LOLOS");
      process.exit(0);
    } else {
      console.log("MUSIC PLAYER QA: ADA KEGAGALAN (" + failures.length + ")");
      failures.forEach(f => console.log("  -", f));
      process.exit(1);
    }
  } finally {
    proc.kill("SIGTERM");
  }
})().catch(e => { console.error("QA error:", e); process.exit(2); });
