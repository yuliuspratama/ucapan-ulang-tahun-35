// Scroll the live page through every section (so IntersectionObserver reveal fires),
// then capture full-page + per-section screenshots. Proves the "blank middle"
// is only a below-the-fold capture artifact, not a rendering fault.
const CDP_PORT = process.env.CDP_PORT || 9222;
const URL = process.argv[2];
const OUTDIR = process.argv[3] || "qa-shots";
const fs = await import("node:fs");
fs.mkdirSync(OUTDIR, { recursive: true });

let id = 0;
const pending = new Map();
async function cdp(method, params = {}, sessionId) {
  const msg = { id: ++id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => pending.set(msg.id, { res, rej }));
}
const t = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
};
const evalJs = async (expr) => {
  const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};

await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await cdp("Page.navigate", { url: URL });
await new Promise((r) => setTimeout(r, 4000));

// scroll down in steps so every .reveal element enters the viewport
const height = await evalJs(`document.documentElement.scrollHeight`);
const steps = Math.ceil(height / 600);
for (let i = 0; i <= steps; i++) {
  await evalJs(`window.scrollTo(0, ${i * 600})`);
  await new Promise((r) => setTimeout(r, 450));
}
await evalJs(`window.scrollTo(0, 0)`);
await new Promise((r) => setTimeout(r, 900));

const state = await evalJs(`JSON.stringify({
  scrollHeight: document.documentElement.scrollHeight,
  revealTotal: document.querySelectorAll('.reveal').length,
  revealVisible: [...document.querySelectorAll('.reveal')].filter(e => getComputedStyle(e).opacity !== '0').length,
  revealHidden: [...document.querySelectorAll('.reveal')].filter(e => getComputedStyle(e).opacity === '0').length,
  sections: [...document.querySelectorAll('main section')].map(s => ({
    id: s.className.replace('section section--',''),
    heading: (s.querySelector('h2')||{}).textContent || '(visually-hidden)',
    visibleText: s.innerText.replace(/\\s+/g,' ').trim().length
  })),
  galleryImgs: [...document.querySelectorAll('.gallery img')].map(i => ({ src: i.getAttribute('src'), loaded: i.naturalWidth > 0, w: i.naturalWidth, h: i.naturalHeight })),
  quoteText: (document.querySelector('.quote p')||{}).innerText,
  messages: document.querySelectorAll('.message').length,
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
})`);
console.log("after full scroll:", state);

const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
fs.writeFileSync(`${OUTDIR}/live-full-scrolled.png`, Buffer.from(shot.data, "base64"));
console.log("wrote", `${OUTDIR}/live-full-scrolled.png`);

// per-section shots at viewport size for detail review
for (const [name, sel] of [["sambutan", ".section--intro"], ["kutipan", ".section--quote"], ["galeri", ".section--gallery"], ["ucapan", ".section--messages"]]) {
  const box = await evalJs(`(() => { const e = document.querySelector('${sel}'); e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return JSON.stringify({x:Math.max(0,Math.round(r.x)), y:Math.round(r.y), width:Math.round(r.width), height:Math.round(r.height)}); })()`);
  await new Promise((r) => setTimeout(r, 700));
  const b = JSON.parse(box);
  const s = await cdp("Page.captureScreenshot", { format: "png", clip: { ...b, scale: 1 } });
  fs.writeFileSync(`${OUTDIR}/live-${name}.png`, Buffer.from(s.data, "base64"));
  console.log("wrote", `${OUTDIR}/live-${name}.png`, b);
}
await cdp("Target.closeTarget", { targetId: t.id }).catch(() => {});
process.exit(0);
