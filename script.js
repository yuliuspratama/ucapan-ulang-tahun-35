/* ============================================================
   Selamat Ulang Tahun ke-35 - script.js
   Vanilla JS. Fitur: suntik teks dari config.js, partikel
   melayang, confetti, reveal saat masuk viewport, tombol rayakan.
   Semua menghormati prefers-reduced-motion.
   Tidak ada dependensi eksternal, tidak ada console.error.
   ============================================================ */
(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Util kecil ---------- */
  const on = (el, ev, fn, opts) => {
    if (el) el.addEventListener(ev, fn, opts);
  };
  const rand = (min, max) => Math.random() * (max - min) + min;

  /* ---------- 0. Suntik teks dari config.js ----------
     config.js adalah satu-satunya sumber kebenaran untuk nama,
     tanggal, dan seluruh teks ucapan. Setiap elemen HTML menandai
     slotnya lewat atribut data-config="sambutan.0" (path dipisah
     titik). Teks di dalam elemen adalah fallback, sehingga halaman
     tetap utuh dan rapi ketika JavaScript tidak aktif. */
  function resolvePath(path) {
    return path.split(".").reduce(function (acc, key) {
      return acc == null ? undefined : acc[key];
    }, window.SITE_CONFIG);
  }

  function interpolate(text, nama) {
    return String(text).replace(/\{\{\s*nama\s*\}\}/gi, nama);
  }

  function initConfigInjection() {
    const cfg = window.SITE_CONFIG;
    if (!cfg) return; // tanpa config, fallback HTML yang tampil. Bukan kondisi fatal.
    const slots = document.querySelectorAll("[data-config]");
    slots.forEach(function (el) {
      const value = resolvePath(el.getAttribute("data-config"));
      if (typeof value !== "string") return;
      el.textContent = interpolate(value, cfg.nama);
      el.setAttribute("data-filled", "true");
    });
  }

  /* ---------- 1. Partikel melayang ---------- */
  function initFloating() {
    if (prefersReducedMotion) return;
    const layer = document.getElementById("floating-layer");
    if (!layer) return;
    const glyphs = ["✦", "✿", "❀", "♥", "✾", "❁"];
    const count = 14;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const s = document.createElement("span");
      s.className = "particle";
      s.textContent = glyphs[i % glyphs.length];
      s.style.left = rand(0, 100) + "%";
      s.style.top = rand(60, 100) + "%";
      s.style.setProperty("--dur", rand(14, 26) + "s");
      s.style.setProperty("--delay", rand(0, 10) + "s");
      s.style.setProperty("--drift", rand(-40, 40) + "px");
      s.style.setProperty("--size", rand(12, 22) + "px");
      frag.appendChild(s);
    }
    layer.appendChild(frag);
  }

  /* ---------- 2. Reveal saat masuk viewport ---------- */
  function initReveal() {
    const items = Array.from(document.querySelectorAll(".reveal"));
    if (!items.length) return;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((el) => io.observe(el));
  }

  /* ---------- 3. Confetti ---------- */
  let confettiCtx = null;
  let confettiPieces = [];
  let confettiRaf = null;

  function initConfetti() {
    if (prefersReducedMotion) return;
    const canvas = document.getElementById("confetti-canvas");
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    confettiCtx = ctx;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });
  }

  function spawnConfetti(amount) {
    if (prefersReducedMotion || !confettiCtx) return;
    const colors = ["#d98ba0", "#b8617a", "#c9a0b4", "#f3d4d8", "#ffd9a3", "#fff3a3"];
    const cx = window.innerWidth / 2;
    for (let i = 0; i < amount; i++) {
      confettiPieces.push({
        x: cx + rand(-60, 60),
        y: window.innerHeight * 0.35 + rand(-20, 20),
        vx: rand(-6, 6),
        vy: rand(-14, -4),
        size: rand(5, 10),
        color: colors[(Math.random() * colors.length) | 0],
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.3, 0.3),
        life: 0,
        maxLife: rand(120, 180)
      });
    }
    if (!confettiRaf) confettiLoop();
  }

  function confettiLoop() {
    if (!confettiCtx) {
      confettiRaf = null;
      return;
    }
    const ctx = confettiCtx;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    confettiPieces = confettiPieces.filter((p) => p.life < p.maxLife);
    confettiPieces.forEach((p) => {
      p.vy += 0.22; // gravitasi
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life += 1;
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    if (confettiPieces.length) {
      confettiRaf = requestAnimationFrame(confettiLoop);
    } else {
      confettiRaf = null;
    }
  }

  /* ---------- 4. Tombol rayakan + keyboard ---------- */
  function initCTA() {
    const btn = document.getElementById("celebrate-btn");
    if (!btn) return;
    on(btn, "click", () => spawnConfetti(120));
    // Keyboard: tombol "c" untuk confetti (tanpa mengganggu input)
    on(document, "keydown", (e) => {
      if (e.key === "c" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        spawnConfetti(120);
      }
    });
  }

  /* ---------- 5. Boot ---------- */
  function boot() {
    try {
      initConfigInjection();
      initFloating();
      initReveal();
      initConfetti();
      initCTA();
    } catch (err) {
      // Tangkap tanpa melempar ke console.error (jaga pengalaman pengguna)
      if (window.console && typeof console.warn === "function") {
        console.warn("Birthday script: non-fatal init issue", err);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();