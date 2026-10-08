#!/usr/bin/env node
/* QA final di PRODUKSI (github.io): player tersembunyi hari biasa,
   nol request mp3, tanpa console error, tanpa overflow. */
import { spawn } from "node:child_process";

const BASE = "https://yuliuspratama.github.io/ucapan-ulang-tahun-35/index.html";
const CHROME_DBG = 9341;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const proc = spawn("chromium", [
    "--headless=new", "--no-sandbox", "--disable-gpu",
    `--remote-debugging-port=${CHROME_DBG}`,
    "--remote-allow-origins=*",
    "--user-data-dir=/tmp/qa-live-" + Date.now(),
    "--window-size=1280,2400",
    "about:blank"
  ], { stdio: "ignore" });
  await sleep(2500);

  const res = await fetch(`http://127.0.0.1:${CHROME_DBG}/json/new?${BASE}`, { method: "PUT" });
  const tab = await res.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });

  let msgId = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener("message", (ev) => {
    const d = JSON.parse(ev.data);
    if (d.id && pending.has(d.id)) {
      pending.get(d.id)(d.result);
      pending.delete(d.id);
    } else if (d.method) {
      events.push(d);
    }
  });
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  const evalJS = (expr) => send("Runtime.evaluate", { expression: expr, returnByValue: true }).then(r => r.result.value);

  await sleep(4000);

  const mp3Reqs = events.filter(e =>
    e.method === "Network.requestWillBeSent" && /\.mp3/i.test(e.params.request?.url || "")).map(e => e.params.request.url);
  const httpErrs = events.filter(e =>
    e.method === "Network.responseReceived" && e.params.response.status >= 400).map(e => `${e.params.response.status} ${e.params.response.url}`);
  const consoleErrs = events.filter(e =>
    e.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(e.params.type)).map(e => JSON.stringify(e.params.args?.slice(0, 2)));

  const state = await evalJS(`(function(){
    const mp = document.getElementById('music-player');
    return {
      playerHidden: mp.hasAttribute('hidden'),
      playerHeight: mp.getBoundingClientRect().height,
      htmlIsBirthday: document.documentElement.classList.contains('is-birthday'),
      musicScriptLoaded: !!document.querySelector('script[src="music-player.js"]'),
      title: document.title,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      mp3Requested: document.getElementById('music-audio').src === ''
    };
  })()`);

  console.log(JSON.stringify({
    mp3Requests: mp3Reqs.length,
    httpErrors: httpErrs,
    consoleIssues: consoleErrs,
    ...state
  }, null, 2));

  const ok = state.playerHidden && state.playerHeight === 0 &&
    mp3Reqs.length === 0 && httpErrs.length === 0 &&
    consoleErrs.length === 0 && state.overflowX <= 2;
  console.log(ok ? "LIVE QA: LOLOS" : "LIVE QA: GAGAL");
  proc.kill("SIGTERM");
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error("live QA error:", e); process.exit(2); });
