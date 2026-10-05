// Explicit live-site test: cold load -> in-page navigation via anchor -> hard refresh,
// checking console errors / failed requests on the LIVE https://*.github.io URL each pass.
const CDP_PORT = process.env.CDP_PORT || 9222;
const URL = process.argv[2];

let id = 0;
const pending = new Map();
async function cdp(method, params = {}, sessionId) {
  const msg = { id: ++id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => pending.set(msg.id, { res, rej }));
}

const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })).json();
const ws = new WebSocket(list.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
};

const problems = [];
const logs = [];
const failed = [];
await cdp("Runtime.enable");
await cdp("Log.enable");
await cdp("Network.enable");
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type))
    logs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`);
  if (m.method === "Runtime.exceptionThrown")
    logs.push(`exception: ${m.params.exceptionDetails.text} ${m.params.exceptionDetails.exception?.description ?? ""}`);
  if (m.method === "Log.entryAdded" && ["error", "warning"].includes(m.params.entry.level))
    logs.push(`log(${m.params.entry.level}): ${m.params.entry.text} ${m.params.entry.url ?? ""}`);
  if (m.method === "Network.loadingFailed") failed.push(`loadingFailed ${m.params.errorText} ${m.params.type}`);
  if (m.method === "Network.responseReceived" && m.params.response.status >= 400)
    failed.push(`HTTP ${m.params.response.status} ${m.params.response.url}`);
});

const evalJs = async (expr) => {
  const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description ?? ""));
  return r.result.value;
};

// ---- pass 1: cold load straight from the public URL
await cdp("Page.enable");
await cdp("Page.navigate", { url: URL });
await new Promise((r) => setTimeout(r, 5000));
const cold = await evalJs(`JSON.stringify({
  title: document.title,
  ready: document.readyState,
  nama: (document.querySelector('[data-config="nama"]')||{}).textContent,
  usia: (document.querySelector('[data-config="usia"]')||{}).textContent,
  lahir: (document.querySelector('[data-config="tanggalLahir"]')||{}).textContent,
  confettiCanvas: !!document.getElementById('confetti-canvas'),
  particles: document.querySelectorAll('.floating-layer > *').length,
  revealed: document.querySelectorAll('.reveal').length,
  revealedVisible: [...document.querySelectorAll('.reveal')].filter(e => getComputedStyle(e).opacity !== '0').length,
  stylesApplied: getComputedStyle(document.body).backgroundColor,
  fontFamily: getComputedStyle(document.body).fontFamily.split(',')[0],
  h1Size: getComputedStyle(document.querySelector('h1')).fontSize
})`);
console.log("cold load :", cold);

// ---- pass 2: in-page navigation (click the skip link to the #main anchor)
const before = await evalJs(`window.scrollY`);
await evalJs(`document.querySelector('.skip-link').click(); window.scrollY`);
await new Promise((r) => setTimeout(r, 1200));
const afterNav = await evalJs(`JSON.stringify({ hash: location.hash, scrollY: Math.round(window.scrollY), targetExists: !!document.getElementById('main'), beforeScrollY: Math.round(${before}) })`);
console.log("anchor nav:", afterNav);

// ---- pass 3: hard refresh of the same URL, then reload again from the same address bar URL
await cdp("Page.navigate", { url: URL });
await new Promise((r) => setTimeout(r, 4000));
await cdp("Page.reload", { ignoreCache: false });
await new Promise((r) => setTimeout(r, 5000));
const refreshed = await evalJs(`JSON.stringify({
  ready: document.readyState,
  url: location.href,
  nama: (document.querySelector('[data-config="nama"]')||{}).textContent,
  sections: document.querySelectorAll('main section').length,
  galleryImgs: [...document.querySelectorAll('.gallery img')].map(i => i.naturalWidth > 0),
  scriptApplied: typeof window.SITE_CONFIG === 'object' && document.querySelectorAll('[data-config]').length > 0,
  bodyBg: getComputedStyle(document.body).backgroundColor
})`);
console.log("refresh   :", refreshed);

// ---- pass 4: screenshot of the LIVE page for visual review
const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
const fs = await import("node:fs");
fs.writeFileSync(process.argv[3] || "/tmp/live-shot.png", Buffer.from(shot.data, "base64"));
console.log("screenshot:", process.argv[3] || "/tmp/live-shot.png");

console.log("");
console.log("console errors/warnings :", logs.length, logs.slice(0, 8));
console.log("failed/broken requests   :", failed.length, failed.slice(0, 8));
if (logs.length || failed.length) {
  console.log("");
  console.log("PROBLEMS FOUND");
  process.exit(1);
}
console.log("LIVE CHECK CLEAN - 0 console errors, 0 failed requests across cold load + anchor nav + refresh");
await cdp("Target.closeTarget", { targetId: list.id }).catch(() => {});
process.exit(0);
