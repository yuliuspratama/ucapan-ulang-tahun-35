/* ============================================================
   Selamat Ulang Tahun DayDay - script.js
   Vanilla JS. Fitur:
     1. Suntik teks dari config.js
     2. Partikel melayang
     3. Confetti
     4. Reveal saat masuk viewport
     5. Tombol rayakan
     6. COUNTDOWN live ke ulang tahun berikutnya + AUTO-INCREMENT
        (otomatis pindah ke ultah tahun depan setelah hari H lewat)
     7. TEMA SPESIAL saat hari ulang tahun (banner + glow + confetti ekstra)
   Semua menghormati prefers-reduced-motion.
   Tidak ada dependensi eksternal, tidak ada console.error.
   ============================================================ */
(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Util ---------- */
  function on(el, ev, fn) {
    if (el) el.addEventListener(ev, fn);
  }
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }
  const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

  /* ============================================================
     0. COUNTDOWN + AUTO-INCREMENT + DETEKSI HARI H
     ============================================================
     Dari lahirISO (WIB), hitung ulang tahun berikutnya relatif
     terhadap "sekarang" di zona Asia/Jakarta. Saat hari H tiba,
     aktifkan tema spesial. Saat hari H berlalu, ultah berikutnya
     otomatis pindah ke tahun depan — situs tetap relevan tanpa
     edit manual. */
  function getBirthdayState(lahirISO) {
    if (!lahirISO) return null;
    const born = new Date(lahirISO);
    if (isNaN(born.getTime())) return null;

    // "Sekarang" di zona WIB — hitung dengan offset eksplisit
    // agar tidak tergantung timezone browser pengunjung.
    const now = new Date();

    // Tanggal ultah tahun berjalan (9 Oktober tahun ini)
    const yearNow = now.getUTCFullYear();
    // Karena lahirISO sudah +07:00, kita ambil bulan & tanggal UTC-nya
    // yang merepresentasikan 9 Oktober 00:00 WIB.
    const bdMonth = born.getUTCMonth();   // 9 (Oktober, 0-index)
    const bdDate  = born.getUTCDate();    // 9

    // Cek apakah HARI INI adalah hari ulang tahun (bandingkan tanggal kalender WIB)
    // WIB = UTC+7. Konversi now ke "tanggal WIB".
    const nowWIB = new Date(now.getTime() + 7 * 3600 * 1000);
    const todayMonth = nowWIB.getUTCMonth();
    const todayDate  = nowWIB.getUTCDate();
    const todayYearWIB = nowWIB.getUTCFullYear();

    const isBirthdayToday = (todayMonth === bdMonth && todayDate === bdDate);

    // Ulang tahun berikutnya: jika belum lewat bulan/tanggal ultah tahun ini
    // maka target tahun ini; jika sudah lewat, tahun depan.
    let nextYear = todayYearWIB;
    let alreadyPassedThisYear = (todayMonth > bdMonth) ||
                                (todayMonth === bdMonth && todayDate > bdDate);
    if (alreadyPassedThisYear) nextYear = todayYearWIB + 1;

    // Waktu ultah berikutnya dalam UTC (ekuivalen dengan 9 Okt 00:00 WIB)
    // Karena born.getUTCHours() = 17 (karena 00:00+07:00 → UTC day sebelumnya 17:00)
    // Lebih andal: hitung manual sebagai Date.UTC(nextYear, bdMonth, bdDate) - 7h
    const nextBirthdayUTC = new Date(Date.UTC(nextYear, bdMonth, bdDate, 0, 0, 0) - 7 * 3600 * 1000);

    // Usia pada ulang tahun berikutnya
    const nextAge = nextYear - born.getUTCFullYear();

    return {
      now: now,
      born: born,
      isBirthdayToday: isBirthdayToday,
      nextBirthday: nextBirthdayUTC,
      nextAge: nextAge,
      nextAgeRoman: toRoman(nextAge) // "ke-35"
    };
  }

  function toRoman(n) {
    // Ubah angka ke format "ke-N" (sederhana, bukan angka Romawi)
    return "ke-" + n;
  }

  function formatTanggalID(date) {
    // Format tanggal Indonesia: "9 Oktober 2026"
    // date diinterpretasikan sebagai WIB
    const wib = new Date(date.getTime() + 7 * 3600 * 1000);
    return wib.getUTCDate() + " " + MONTHS_ID[wib.getUTCMonth()] + " " + wib.getUTCFullYear();
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function getDurationParts(target, now) {
    let diff = Math.max(0, target.getTime() - now.getTime());
    const days = Math.floor(diff / 86400000); diff -= days * 86400000;
    const hours = Math.floor(diff / 3600000); diff -= hours * 3600000;
    const mins = Math.floor(diff / 60000); diff -= mins * 60000;
    const secs = Math.floor(diff / 1000);
    return { days, hours, mins, secs, total: target.getTime() - now.getTime() };
  }

  /* ---------- Inject config ( + override otomatis untuk auto-usia ) ---------- */
  function resolvePath(path) {
    return path.split(".").reduce(function (acc, key) {
      return acc == null ? undefined : acc[key];
    }, window.SITE_CONFIG);
  }

  function interpolate(text, nama) {
    return String(text).replace(/\{\{\s*nama\s*\}\}/gi, nama);
  }

  function applyAutoConfig() {
    const cfg = window.SITE_CONFIG;
    if (!cfg) return;
    const state = getBirthdayState(cfg.lahirISO);
    if (!state) return;

    // OVERRIDE nilai auto di config (untuk dipakai injection & komponen lain)
    cfg.tanggalPerayaan = formatTanggalID(state.nextBirthday);
    cfg.usia = state.nextAgeRoman;
    cfg._birthdayState = state; // simpan untuk modul countdown & tema

    // Update <time datetime> dan <title> agar relevan dengan ultah berikutnya
    const timeEl = document.querySelector('time[data-config="tanggalPerayaan"]');
    if (timeEl) {
      const iso = state.nextBirthday.toISOString();
      timeEl.setAttribute("datetime", iso.slice(0, 10));
    }
    // Update title dokumen dinamis: "Selamat Ulang Tahun ke-N DayDay"
    const titleAge = state.nextAgeRoman;
    document.title = "Selamat Ulang Tahun " + titleAge + " DayDay";
    // Update meta description dinamis (SEO tetap relevan tiap tahun)
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content",
        "Situs ucapan ulang tahun " + titleAge + " DayDay — penuh kasih, hangat, dan elegan. Dibuat dengan HTML, CSS, dan JavaScript murni.");
    }
    // og:title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", "Selamat Ulang Tahun " + titleAge + " DayDay");
  }

  function initConfigInjection() {
    const cfg = window.SITE_CONFIG;
    if (!cfg) return;
    const slots = document.querySelectorAll("[data-config]");
    slots.forEach(function (el) {
      const value = resolvePath(el.getAttribute("data-config"));
      if (typeof value !== "string") return;
      el.textContent = interpolate(value, cfg.nama || "");
    });
  }

  /* ============================================================
     1. COUNTDOWN - update tiap detik, auto-shift saat hari H
     ============================================================ */
  function initCountdown() {
    const stateEl = document.getElementById("countdown");
    if (!stateEl) return;
    const cfg = window.SITE_CONFIG;
    if (!cfg || !cfg._birthdayState) return;

    const dEl = stateEl.querySelector("[data-cd-days]");
    const hEl = stateEl.querySelector("[data-cd-hours]");
    const mEl = stateEl.querySelector("[data-cd-mins]");
    const sEl = stateEl.querySelector("[data-cd-secs]");
    const labelEl = stateEl.querySelector("[data-cd-label]");

    function tick() {
      // Re-evaluasi state setiap tick agar tetap akurat saat lewat tengah malam.
      const fresh = getBirthdayState(cfg.lahirISO);
      if (!fresh) return;
      cfg._birthdayState = fresh;
      cfg.tanggalPerayaan = formatTanggalID(fresh.nextBirthday);
      cfg.usia = fresh.nextAgeRoman;

      const parts = getDurationParts(fresh.nextBirthday, fresh.now);

      if (dEl) dEl.textContent = pad(parts.days);
      if (hEl) hEl.textContent = pad(parts.hours);
      if (mEl) mEl.textContent = pad(parts.mins);
      if (sEl) sEl.textContent = pad(parts.secs);

      if (labelEl) {
        if (fresh.isBirthdayToday) {
          labelEl.textContent = "Hari ini ulang tahun " + cfg.nama + "! 🎉 " + fresh.nextAgeRoman;
        } else if (parts.total <= 0) {
          labelEl.textContent = "Selamat ulang tahun, " + cfg.nama + "!";
        } else {
          labelEl.textContent = "Menuju ulang tahun " + fresh.nextAgeRoman + " " + cfg.nama;
        }
      }

      // Aktifkan tema hari-H jika hari ini ulang tahun
      if (fresh.isBirthdayToday) {
        document.documentElement.classList.add("is-birthday");
      } else {
        document.documentElement.classList.remove("is-birthday");
      }
    }

    tick();
    setInterval(tick, 1000);
  }

  /* ---------- 2. Partikel melayang ---------- */
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

  /* ---------- 3. Reveal saat masuk viewport ---------- */
  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 4. Confetti ---------- */
  let confettiRaf = null;
  const confettiPieces = [];
  let confettiCanvas, confettiCtx, confettiW, confettiH;

  function initConfetti() {
    confettiCanvas = document.getElementById("confetti-canvas");
    if (!confettiCanvas) return;
    confettiCtx = confettiCanvas.getContext("2d");
    resizeConfetti();
    on(window, "resize", resizeConfetti);

    // Saat hari-H, hujankan confetti perayaan otomatis saat load
    const state = window.SITE_CONFIG && window.SITE_CONFIG._birthdayState;
    if (state && state.isBirthdayToday && !prefersReducedMotion) {
      setTimeout(function () { spawnConfetti(180); }, 600);
      // Tambahan burst tiap 30 detik untuk suasana festif
      setInterval(function () { spawnConfetti(80); }, 30000);
    }
  }

  function resizeConfetti() {
    if (!confettiCanvas) return;
    confettiW = confettiCanvas.width = window.innerWidth;
    confettiH = confettiCanvas.height = window.innerHeight;
  }

  const CONFETTI_COLORS = ["#d98ba0", "#f3d4d8", "#9c4560", "#ffd9a3", "#e8b4bc", "#c77f94"];
  function spawnConfetti(n) {
    if (prefersReducedMotion || !confettiCtx) return;
    for (let i = 0; i < n; i++) {
      confettiPieces.push({
        x: rand(0, confettiW),
        y: rand(-20, 0),
        w: rand(6, 12),
        h: rand(8, 16),
        vx: rand(-2, 2),
        vy: rand(2, 6),
        rot: rand(0, Math.PI * 2),
        vrot: rand(-0.2, 0.2),
        color: CONFETTI_COLORS[Math.floor(rand(0, CONFETTI_COLORS.length))],
        life: 0
      });
    }
    if (!confettiRaf) confettiRaf = requestAnimationFrame(confettiLoop);
  }

  function confettiLoop() {
    confettiCtx.clearRect(0, 0, confettiW, confettiH);
    for (let i = confettiPieces.length - 1; i >= 0; i--) {
      const p = confettiPieces[i];
      p.x += p.vx; p.y += p.vy; p.rot += p.vrot; p.vy += 0.08; p.life++;
      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      confettiCtx.restore();
      if (p.y > confettiH + 40) confettiPieces.splice(i, 1);
    }
    if (confettiPieces.length) {
      confettiRaf = requestAnimationFrame(confettiLoop);
    } else {
      confettiRaf = null;
    }
  }

  /* ---------- 5. Tombol rayakan + keyboard ---------- */
  function initCTA() {
    const btn = document.getElementById("celebrate-btn");
    if (!btn) return;
    on(btn, "click", () => spawnConfetti(120));
    on(document, "keydown", (e) => {
      if (e.key === "c" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        spawnConfetti(120);
      }
    });
  }

  /* ---------- 6. Boot ---------- */
  function boot() {
    try {
      applyAutoConfig();        // HITUNG & OVERRIDE nilai auto lebih dulu
      initConfigInjection();    // SUNTIK teks (pakai nilai yang sudah di-override)
      initCountdown();          // COUNTDOWN live
      initFloating();
      initReveal();
      initConfetti();
      initCTA();
    } catch (err) {
      // Tidak ada console.error sesuai konvensi; hanya non-fatal warn.
      if (typeof console !== "undefined" && console.warn) {
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
