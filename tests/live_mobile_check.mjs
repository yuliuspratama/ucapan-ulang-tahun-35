// Mobile-width (390x844) live render check: no horizontal overflow, reveal fired,
// gallery images loaded, fonts applied.
const CDP_PORT = process.env.CDP_PORT || 9222;
const URL = process.argv[2];

let id = 0;
const pending = new Map();
const cdp = (m, p = {}) => {
  const msg = { id: ++id, method: m, params: p };
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => pending.set(msg.id, { res, rej }));
};
const t = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: "PUT" })).json();
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
const ev = async (x) => {
  const r = await cdp("Runtime.evaluate", { expression: x, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};

await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await cdp("Page.navigate", { url: URL });
await new Promise((r) => setTimeout(r, 4500));

const h = await ev("document.documentElement.scrollHeight");
for (let i = 0; i <= Math.ceil(h / 600); i++) {
  await ev(`window.scrollTo(0, ${i * 600})`);
  await new Promise((r) => setTimeout(r, 350));
}
await ev("window.scrollTo(0, 0)");
await new Promise((r) => setTimeout(r, 900));

console.log(
  await ev(`JSON.stringify({
    viewport: window.innerWidth + "x" + window.innerHeight,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    revealVisible: [...document.querySelectorAll(".reveal")].filter(e => getComputedStyle(e).opacity !== "0").length + "/" + document.querySelectorAll(".reveal").length,
    galleryLoaded: [...document.querySelectorAll(".gallery img")].filter(i => i.naturalWidth > 0).length + "/3",
    fontFamily: getComputedStyle(document.body).fontFamily.split(",")[0],
    fontLoaded: document.fonts ? document.fonts.status : "n/a",
    nama: (document.querySelector("[data-config='nama']") || {}).textContent,
    bodyBg: getComputedStyle(document.body).backgroundColor
  })`)
);
await cdp("Target.closeTarget", { targetId: t.id }).catch(() => {});
process.exit(0);
