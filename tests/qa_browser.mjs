#!/usr/bin/env node
/* ============================================================
   QA browser nyata via Chrome DevTools Protocol (CDP).
   Tanpa dependency: memakai WebSocket bawaan Node >= 22.

   Menguji:
     1. console error/warning, page error, request gagal (broken asset)
     2. overflow horizontal di banyak viewport (ponsel & desktop)
     3. kontras teks terhadap latar efektif (rumus WCAG)
     4. navigasi keyboard: tab order, skip link, fokus terlihat
     5. prefers-reduced-motion: animasi benar-benar mati
     6. fakta wajib tampil utuh di DOM
     7. suntikan config.js mengisi semua slot

   Pakai:  node tests/qa_browser.mjs [base_url]
   Butuh: chromium jalan dengan --remote-debugging-port=9222
   ============================================================ */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] || "http://localhost:8901";
const CDP_PORT = process.env.CDP_PORT || 9222;

const VIEWPORTS = [
  ["ponsel-kecil", 320, 568],
  ["ponsel", 390, 844],
  ["ponsel besar", 430, 932],
  ["tablet", 768, 1024],
  ["desktop", 1280, 800],
  ["desktop lebar", 1920, 1080],
];

const failures = [];
const notes = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Klien CDP minimal ---------- */
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        this.listeners.forEach((fn) => fn(msg));
      }
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    return new CDP(ws);
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout: ${method}`));
        }
      }, 30000);
    });
  }
  on(fn) {
    this.listeners.push(fn);
  }
  close() {
    this.ws.close();
  }
}

/* ---------- Skrip in-page ---------- */
const CONTRAST_JS = `(() => {
  function lum([r,g,b]) {
    const a = [r,g,b].map(v => { v/=255;
      return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2];
  }
  function parse(c) {
    const m = String(c).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map(s => parseFloat(s));
    return { rgb:[p[0],p[1],p[2]], a: p.length>3 ? p[3] : 1 };
  }
  function over(fg, bg) { return fg.rgb.map((v,i) => fg.a*v + (1-fg.a)*bg[i]); }
  /* Ambil semua warna stop dari linear-gradient supaya rasio dihitung
     untuk_case terburuk_ di sepanjang gradien, bukanasumsi putih. */
  function gradientStops(el) {
    const bi = getComputedStyle(el).backgroundImage;
    if (!bi || bi === 'none') return null;
    const stops = [];
    const re = /rgba?\\(([^)]+)\\)/g;
    let m;
    while ((m = re.exec(bi))) {
      const p = m[1].split(',').map(s => parseFloat(s));
      if (p.length >= 3) stops.push({ rgb:[p[0],p[1],p[2]], a: p.length>3?p[3]:1 });
    }
    return stops.length ? stops : null;
  }
  function effectiveBg(el) {
    let cur = el, acc = null;
    while (cur && cur !== document.documentElement) {
      const c = parse(getComputedStyle(cur).backgroundColor);
      if (c && c.a > 0) {
        acc = acc === null ? over(c,[255,255,255]) : over({rgb:acc,a:c.a}, acc);
        if (c.a >= 0.999) return acc;
      }
      cur = cur.parentElement;
    }
    return acc || [255,255,255];
  }
  const TEXT_SEL = 'h1,h2,p,button,figcaption,cite';
  const out = [], seen = new Set();
  document.querySelectorAll(TEXT_SEL).forEach(el => {
    const txt = (el.textContent||'').trim();
    if (!txt) return;
    if (el.querySelector(TEXT_SEL)) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    if (parseFloat(cs.opacity) < 0.15) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const fg = parse(cs.color);
    if (!fg) return;
    // Teks dengan background-clip:text diwarnai gradien, bukan background solid.
    const clipText = cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || cs.webkitTextFillColor === 'transparent';
    const grads = gradientStops(el);
    // Rasio terburuk: coba semua stop gradien sebagai latar.
    const bgs = grads ? grads.map(g => over(g, effectiveBg(el.parentElement || el))) : [effectiveBg(el)];
    let ratio = Infinity;
    for (const bg of bgs) {
      const l1 = lum(over(fg,bg)), l2 = lum(bg);
      ratio = Math.min(ratio, (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05));
    }
    if (clipText && grads) {
      // Warna teks sebenarnya adalah gradien itu sendiri.
      ratio = Infinity;
      for (const g of grads) {
        const l1 = lum(g.rgb), l2 = lum(effectiveBg(el.parentElement || el));
        ratio = Math.min(ratio, (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05));
      }
    }
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight,10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3.0 : 4.5;
    const key = txt.slice(0,40) + '|' + cs.color + '|' + cs.fontSize;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ sel: el.tagName.toLowerCase() + '.' + (el.className||''),
               text: txt.slice(0,45), ratio: Math.round(ratio*100)/100,
               size, need, ok: ratio >= need });
  });
  return out;
})()`;

const OVERFLOW_JS = `(() => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const bad = [];
  const limit = Math.max(2, Math.round(vw * 0.02));
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') return;
    if (r.right > vw + limit || r.left < -limit) {
      bad.push({ sel: el.tagName.toLowerCase() + '.' + (el.className||''),
                 left: Math.round(r.left), right: Math.round(r.right) });
    }
  });
  return { scrollW: de.scrollWidth, clientW: vw,
           horizontalScroll: de.scrollWidth > vw + 1, offenders: bad.slice(0,8) };
})()`;

const ANIM_JS = `(() => {
  const layer = document.getElementById('floating-layer');
  const canvas = document.getElementById('confetti-canvas');
  const hero = document.querySelector('.hero__title');
  return {
    floatingDisplay: layer ? getComputedStyle(layer).display : 'no-layer',
    canvasDisplay: canvas ? getComputedStyle(canvas).display : 'no-canvas',
    particleCount: document.querySelectorAll('.particle').length,
    heroOpacity: hero ? getComputedStyle(hero).opacity : null,
    revealed: document.querySelectorAll('.reveal.is-visible').length,
    totalReveal: document.querySelectorAll('.reveal').length
  };
})()`;

const FACTS_JS = `(() => {
  const t = document.body.innerText;
  return {
    adaNama: t.includes('DayDay'),
    adaTanggalLahir: t.includes('9 Oktober 1991'),
    adaUsia35: /ke-35/.test(t),
    adaTahun2026: t.includes('2026'),
    adaSambutan: t.includes('tibalah hari yang kita nantikan'),
    adaParagraf2: t.includes('Tiga puluh lima tahun bukan hanya angka'),
    adaKutipan: t.includes('Tahun ini, semoga setiap pagi membawa tenang'),
    adaKutipanTanda: t.includes('Tahun ini'),
    adaUcapanKeluarga: t.includes('Keluarga'),
    sisaPlaceholder: /\\[[A-Za-z]/.test(t),
    filled: document.querySelectorAll('[data-filled="true"]').length,
    slots: document.querySelectorAll('[data-config]').length
  };
})()`;

/* ---------- Harness ---------- */
async function openPage(cdp, w, h, reducedMotion) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });

  for (const d of ["Page", "Runtime", "Network", "Log"]) {
    await cdp.send(`${d}.enable`, {}, sessionId);
  }
  await cdp.send("Emulation.setDeviceMetricsOverride",
    { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 }, sessionId);
  await cdp.send("Emulation.setEmulatedMedia", {
    features: reducedMotion
      ? [{ name: "prefers-reduced-motion", value: "reduce" }] : []
  }, sessionId);

  const events = [];
  cdp.on((msg) => {
    if (["Runtime.consoleAPICalled", "Runtime.exceptionThrown",
         "Log.entryAdded", "Network.loadingFailed",
         "Network.responseReceived"].includes(msg.method)) {
      events.push(msg);
    }
  });

  const evaluate = async (expression) => {
    const r = await cdp.send("Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.exceptionDetails) {
      throw new Error("eval error: " + JSON.stringify(r.exceptionDetails).slice(0, 300));
    }
    return r.result.value;
  };

  return { sessionId, targetId, events, evaluate };
}

async function runViewport(cdp, name, w, h, reducedMotion) {
  const page = await openPage(cdp, w, h, reducedMotion);
  const label = `${name} ${w}x${h}${reducedMotion ? " [reduced-motion]" : ""}`;

  await cdp.send("Page.navigate", { url: `${BASE}/index.html` }, page.sessionId);
  await sleep(3000);
  await page.evaluate("window.scrollTo(0, document.body.scrollHeight); true");
  await sleep(1500);
  await page.evaluate("window.scrollTo(0, 0); true");
  await sleep(1200);

  const overflow = await page.evaluate(OVERFLOW_JS);
  const contrast = await page.evaluate(CONTRAST_JS);
  const anim = await page.evaluate(ANIM_JS);
  const facts = await page.evaluate(FACTS_JS);

  // --- console / network ---
  const consoleIssues = [];
  const failedReq = [];
  const httpErrors = [];
  for (const e of page.events) {
    const p = e.params || {};
    if (e.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(p.type)) {
      const txt = (p.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
      consoleIssues.push(`[${p.type}] ${txt.slice(0, 180)}`);
    } else if (e.method === "Runtime.exceptionThrown") {
      consoleIssues.push(`[exception] ${(p.exceptionDetails?.text || "").slice(0, 180)}`);
    } else if (e.method === "Log.entryAdded" && p.entry?.level === "error") {
      consoleIssues.push(`[log:${p.entry.source}] ${String(p.entry.text).slice(0, 180)}`);
    } else if (e.method === "Network.loadingFailed") {
      failedReq.push(String(p.errorText).slice(0, 120));
    } else if (e.method === "Network.responseReceived" && p.response?.status >= 400) {
      httpErrors.push(`${p.response.status} ${p.response.url}`);
    }
  }

  // Font CDN memang eksternal; tylko status >=400 yang relevan.
  if (consoleIssues.length) failures.push(`${label}: console -> ${consoleIssues.slice(0, 4)}`);
  else notes.push(`${label}: console bersih (0 error/warning)`);

  const realFailed = failedReq.filter((f) => !f.includes("ERR_ABORTED"));
  if (realFailed.length) failures.push(`${label}: request gagal -> ${realFailed.slice(0, 4)}`);
  if (httpErrors.length) failures.push(`${label}: HTTP >=400 -> ${httpErrors.slice(0, 4)}`);
  if (!realFailed.length && !httpErrors.length) notes.push(`${label}: semua request sukses (tanpa broken asset)`);

  // --- overflow ---
  if (overflow.horizontalScroll) {
    failures.push(`${label}: overflow horizontal scrollW=${overflow.scrollW} > clientW=${overflow.clientW}, offender=${JSON.stringify(overflow.offenders)}`);
  } else {
    notes.push(`${label}: tidak ada overflow horizontal`);
  }

  // --- kontras ---
  const bad = contrast.filter((c) => !c.ok);
  if (bad.length) {
    for (const c of bad.slice(0, 6)) {
      failures.push(`${label}: kontras ${c.ratio} < ${c.need} pada ${c.sel} (${c.size}px) "${c.text}"`);
    }
  } else {
    notes.push(`${label}: kontras semua teks lolos (${contrast.length} elemen diperiksa)`);
  }

  // --- animasi ---
  if (reducedMotion) {
    if (anim.floatingDisplay !== "none" || anim.canvasDisplay !== "none") {
      failures.push(`${label}: reduced-motion belum mematikan layer/canvas -> ${JSON.stringify(anim)}`);
    } else if (anim.particleCount !== 0) {
      failures.push(`${label}: reduced-motion tapi ${anim.particleCount} partikel tetap dibuat`);
    } else {
      notes.push(`${label}: animasi dimatikan (partikel 0, layer+canvas display:none)`);
    }
    if (anim.revealed !== anim.totalReveal) {
      failures.push(`${label}: reduced-motion tapi reveal ${anim.revealed}/${anim.totalReveal}`);
    } else {
      notes.push(`${label}: semua elemen reveal langsung terlihat (${anim.revealed})`);
    }
  } else {
    if (anim.particleCount === 0) failures.push(`${label}: partikel tidak dibuat padahal motion diizinkan`);
    else notes.push(`${label}: animasi hidup (${anim.particleCount} partikel)`);
    if (anim.revealed === 0) failures.push(`${label}: tidak ada elemen yang ter-reveal`);
    else notes.push(`${label}: reveal bekerja (${anim.revealed}/${anim.totalReveal})`);
    if (Number(anim.heroOpacity) < 0.9) {
      failures.push(`${label}: hero opacity ${anim.heroOpacity} - teks utama belum terlihat`);
    }
  }

  // --- fakta & konten ---
  const want = ["adaNama", "adaTanggalLahir", "adaUsia35", "adaTahun2026",
                "adaSambutan", "adaParagraf2", "adaKutipan", "adaKutipanTanda",
                "adaUcapanKeluarga"];
  for (const key of want) {
    if (facts[key] === true) notes.push(`${label}: ${key} = true`);
    else failures.push(`${label}: ${key} = false (fakta/konten wajib hilang)`);
  }
  if (facts.sisaPlaceholder) failures.push(`${label}: masih ada placeholder mentah di teks`);
  else notes.push(`${label}: tidak ada placeholder mentah di teks`);

  if (facts.filled !== facts.slots) {
    failures.push(`${label}: hanya ${facts.filled}/${facts.slots} slot terisi dari config.js`);
  } else {
    notes.push(`${label}: semua ${facts.slots} slot terisi dari config.js`);
  }

  // --- screenshot ---
  const shot = await cdp.send("Page.captureScreenshot",
    { format: "png", captureBeyondViewport: true }, page.sessionId);
  const outDir = join(ROOT, "qa-shots");
  mkdirSync(outDir, { recursive: true });
  const slug = name.replace(/ /g, "-") + (reducedMotion ? "-reduced" : "");
  writeFileSync(join(outDir, `${slug}.png`), Buffer.from(shot.data, "base64"));

  await cdp.send("Target.closeTarget", { targetId: page.targetId });
  return { label, anim, facts, contrastCount: contrast.length };
}

async function keyboardTest(cdp) {
  const page = await openPage(cdp, 1280, 800, false);
  const S = page.sessionId;
  await cdp.send("Page.navigate", { url: `${BASE}/index.html` }, S);
  await sleep(2500);

  const order = [];
  for (let i = 0; i < 9; i++) {
    // JANGAN reset scroll sebelum Tab. Scroll paksa ke 0 membuat browser
    // tidak menggulir ke elemen yang difokus, sehingga item terlihat
    // off-screen padahal perilaku aslinya benar.
    for (const type of ["keyDown", "keyUp"]) {
      await cdp.send("Input.dispatchKeyEvent",
        { type, key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 }, S);
    }
    // html punya scroll-behavior: smooth, jadi scroll-into-view dianimasikan.
    // Tunggu sampai scroll berhenti sebelum mengukur.
    let lastY = -1;
    for (let k = 0; k < 25; k++) {
      await sleep(120);
      const y = await page.evaluate("Math.round(window.scrollY)");
      if (y === lastY) break;
      lastY = y;
    }
    order.push(await page.evaluate(`(() => {
      const a = document.activeElement;
      if (!a) return { tag: 'none' };
      const cs = getComputedStyle(a);
      const r = a.getBoundingClientRect();
      return {
        tag: a.tagName.toLowerCase(),
        cls: String(a.className || ''),
        text: (a.textContent||'').trim().slice(0,34),
        ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
        offscreen: r.top < -80 || r.bottom > window.innerHeight + 80
      };
    })()`));
  }

  if (String(order[0].cls).includes("skip-link")) {
    notes.push(`keyboard: fokus pertama = skip link ("${order[0].text}")`);
  } else {
    failures.push(`keyboard: fokus pertama bukan skip link -> ${JSON.stringify(order[0])}`);
  }

  if (order.some((o) => o.tag === "button")) notes.push("keyboard: tombol rayakan terjangkau Tab");
  else failures.push(`keyboard: tombol tidak terjangkau Tab -> ${JSON.stringify(order.map(o=>o.tag))}`);

  const noRing = order.filter((o) => !o.ring && o.tag !== "body" && o.tag !== "none");
  if (noRing.length) failures.push(`keyboard: ${noRing.length} fokus tanpa outline -> ${JSON.stringify(noRing.slice(0,3))}`);
  else notes.push(`keyboard: semua ${order.length} fokus punya outline terlihat`);

  const offscreen = order.filter((o) => o.offscreen && o.tag !== "body");
  if (offscreen.length) failures.push(`keyboard: fokus masuk elemen yang terpotong atas -> ${JSON.stringify(offscreen.slice(0,2))}`);
  else notes.push("keyboard: tidak ada fokus yang terpotong / off-screen");

  // Skip link harus benar-benar terlihat setelah transisi selesai
  await page.evaluate("window.scrollTo(0,0); document.querySelector('.skip-link').focus(); true");
  await sleep(1200); // transisi .skip-link 0.2s + margin fokus
  const skip = await page.evaluate(`(() => {
    const a = document.querySelector('.skip-link');
    const r = a.getBoundingClientRect();
    return { top: Math.round(r.top), visible: r.top >= 0 && r.bottom <= window.innerHeight };
  })()`);
  if (skip.visible) notes.push(`keyboard: skip link terlihat saat difokus (top=${skip.top}px)`);
  else failures.push(`keyboard: skip link tidak terlihat saat difokus -> ${JSON.stringify(skip)}`);

  // Enter pada tombol -> canvas hidup, tanpa error
  await page.evaluate("document.getElementById('celebrate-btn').focus(); true");
  for (const type of ["keyDown", "keyUp"]) {
    await cdp.send("Input.dispatchKeyEvent",
      { type, key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: type === "keyDown" ? "\r" : undefined }, S);
  }
  await sleep(1400);
  const conf = await page.evaluate(`(() => {
    const c = document.getElementById('confetti-canvas');
    return { w: c.width, h: c.height, display: getComputedStyle(c).display };
  })()`);
  if (conf.w > 0 && conf.display !== "none") {
    notes.push(`keyboard: Enter memicu confetti (canvas ${conf.w}x${conf.h})`);
  } else {
    failures.push(`keyboard: Enter tidak memicu confetti -> ${JSON.stringify(conf)}`);
  }

  // Skip link -> #main
  await page.evaluate("document.querySelector('.skip-link').focus(); true");
  for (const type of ["keyDown", "keyUp"]) {
    await cdp.send("Input.dispatchKeyEvent",
      { type, key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: type === "keyDown" ? "\r" : undefined }, S);
  }
  await sleep(700);
  const hash = await page.evaluate("location.hash");
  if (String(hash).includes("#main")) notes.push("keyboard: skip link mengarahkan ke #main");
  else failures.push(`keyboard: skip link tidak ke #main (hash=${JSON.stringify(hash)})`);

  // Tombol 'c' untuk confetti
  await page.evaluate("window.scrollTo(0,0); document.body.focus(); true");
  for (const type of ["keyDown", "keyUp"]) {
    await cdp.send("Input.dispatchKeyEvent",
      { type, key: "c", code: "KeyC", windowsVirtualKeyCode: 67, text: type === "keyDown" ? "c" : undefined }, S);
  }
  await sleep(900);
  notes.push("keyboard: tombol 'c' untuk confetti dikirim tanpa error");

  await cdp.send("Target.closeTarget", { targetId: page.targetId });
  return order;
}

async function contrastModeTest(cdp) {
  // prefers-contrast: more harus menaikkan kontras, tidak menurunkan.
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId: S } = await cdp.send("Target.attachToTarget",
    { targetId, flatten: true });
  await cdp.send("Runtime.enable", {}, S);
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-contrast", value: "more" }] }, S);
  await cdp.send("Page.enable", {}, S);
  await cdp.send("Page.navigate", { url: `${BASE}/index.html` }, S);
  await sleep(2800);
  const r = await cdp.send("Runtime.evaluate",
    { expression: CONTRAST_JS, returnByValue: true }, S);
  const res = r.result.value;
  const bad = res.filter((c) => !c.ok);
  if (bad.length) {
    for (const c of bad.slice(0, 5)) {
      failures.push(`prefers-contrast:more: kontras ${c.ratio} < ${c.need} pada ${c.sel} "${c.text}"`);
    }
  } else {
    notes.push(`prefers-contrast:more: kontras lolos (${res.length} elemen)`);
  }
  await cdp.send("Target.closeTarget", { targetId });
  return res;
}

async function noJsFallbackTest(cdp) {
  // JavaScript dimatikan: halaman harus tetap utuh (isi HTML fallback).
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId: S } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, S);
  await cdp.send("Emulation.setScriptExecutionDisabled", { value: true }, S);
  await cdp.send("Page.navigate", { url: `${BASE}/index.html` }, S);
  await sleep(2500);
  const r = await cdp.send("Runtime.evaluate", {
    expression: `(() => { const t = document.body.innerText;
      return { nama: t.includes('DayDay'), lahir: t.includes('9 Oktober 1991'),
               usia: /ke-35/.test(t), sambutan: t.includes('tibalah hari yang kita nantikan'),
               kutipan: t.includes('Tahun ini, semoga setiap pagi membawa tenang'),
               panjang: t.length }; })()`,
    returnByValue: true }, S);
  const f = r.result.value;
  const missing = Object.entries(f).filter(([k, v]) => k !== "panjang" && v !== true).map(([k]) => k);
  if (missing.length) failures.push(`tanpa-JS: halaman kehilangan konten -> ${missing.join(", ")}`);
  else notes.push(`tanpa-JS: halaman tetap utuh (${f.panjang} karakter teks, semua fakta ada)`);
  await cdp.send("Target.closeTarget", { targetId });
}

async function main() {
  const ver = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
  notes.push(`browser: ${ver.Browser}`);
  const cdp = await CDP.connect(ver.webSocketDebuggerUrl);

  console.log("=== QA BROWSER (CDP) ===");
  for (const [name, w, h] of VIEWPORTS) {
    await runViewport(cdp, name, w, h, false);
  }
  for (const [name, w, h] of [["ponsel", 390, 844], ["desktop", 1280, 800]]) {
    await runViewport(cdp, name, w, h, true);
  }
  await keyboardTest(cdp);
  await contrastModeTest(cdp);
  await noJsFallbackTest(cdp);
  cdp.close();

  for (const n of notes) console.log("  ok  ", n);
  console.log("");
  if (failures.length) {
    console.log(`FAIL (${failures.length} masalah):`);
    for (const f of failures) console.log("  -  ", f);
    process.exit(1);
  }
  console.log(`PASS - ${notes.length} pemeriksaan lolos, 0 masalah`);
}

main().catch((e) => {
  console.error("QA error:", e.message);
  process.exit(2);
});