/* ============================================================
   MUSIC PLAYER KHUSUS HARI ULANG TAHUN - music-player.js
   ------------------------------------------------------------
   Modul MANDIRI: tidak mengubah perilaku script.js maupun
   komponen lain. Section #music-player di index.html selalu
   tersembunyi (atribut hidden); modul ini hanya menampilkannya
   saat tanggal kalender WIB == tanggal lahir di SITE_CONFIG
   (9 Oktober) — sama persis dengan logika script.js.

   Cara kerja:
     1. Baca window.SITE_CONFIG.lahirISO (dari config.js).
     2. Cek hari-H dengan logika WIB identik script.js.
     3. Jika BUKAN hari-H: tidak melakukan apa pun (player
        tetap tersembunyi, audio tidak pernah dimuat penuh —
        hanya metadata karena preload="metadata").
     4. Jika hari-H: buka atribut hidden, pasang pemutar
        2 lagu + lirik (fetch assets/lirik-35.txt).
     5. Guard ganda: jika script.js sudah menandai
        <html>.is-birthday, pakai itu; jika belum (mis. race
        load), hitung sendiri.

   Menghormati prefers-reduced-motion (cakram tidak berputar).
   Tidak ada console.error; kegagalan non-fatal diabaikan.
   ============================================================ */
(function () {
  "use strict";

  var WIB_OFFSET_MS = 7 * 3600 * 1000; // UTC+7

  /* Tanggal WIB sekarang sebagai {y, m, d} — identik script.js */
  function todayWIB() {
    var wib = new Date(new Date().getTime() + WIB_OFFSET_MS);
    return {
      y: wib.getUTCFullYear(),
      m: wib.getUTCMonth(),   // 0-11
      d: wib.getUTCDate()
    };
  }

  /* Apakah hari ini ulang tahun menurut lahirISO? */
  function isBirthday(lahirISO) {
    if (!lahirISO) return false;
    var born = new Date(lahirISO);
    if (isNaN(born.getTime())) return false;
    var bornWIB = new Date(born.getTime() + WIB_OFFSET_MS);
    var t = todayWIB();
    return t.m === bornWIB.getUTCMonth() && t.d === bornWIB.getUTCDate();
  }

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ":" + (s < 10 ? "0" + s : s);
  }

  function init() {
    var section = document.getElementById("music-player");
    if (!section) return;

    var cfg = window.SITE_CONFIG;
    var lahirISO = cfg && cfg.lahirISO;

    /* Guard ganda: class is-birthday oleh script.js ATAU hitungan sendiri */
    var birthday =
      document.documentElement.classList.contains("is-birthday") ||
      isBirthday(lahirISO);

    if (!birthday) return; /* bukan hari-H: biarkan tersembunyi selamanya */

    /* ---- Hari-H: tampilkan & pasang kontrol ---- */
    section.removeAttribute("hidden");

    var audio = document.getElementById("music-audio");
    var playBtn = document.getElementById("music-play");
    var disc = document.getElementById("music-disc");
    var curEl = document.getElementById("music-current");
    var durEl = document.getElementById("music-duration");
    var progress = document.getElementById("music-progress");
    var progressFill = document.getElementById("music-progress-fill");
    var nameEl = document.getElementById("music-name");
    var hintEl = document.getElementById("music-hint");
    var lyricsBtn = document.getElementById("music-lyrics-btn");
    var lyricsBox = document.getElementById("music-lyrics");
    var lyricsText = document.getElementById("music-lyrics-text");
    var tabs = Array.prototype.slice.call(
      section.querySelectorAll(".music-player__track")
    );

    if (!audio || !playBtn) return;

    var TRACKS = [
      { src: "assets/music/Halaman Tiga Puluh Lima.mp3", label: "Halaman Tiga Puluh Lima — Versi 1" },
      { src: "assets/music/Halaman Tiga Puluh Lima V2.mp3", label: "Halaman Tiga Puluh Lima — Versi 2" }
    ];

    var current = 0;
    var lyricsLoaded = false;

    function setTrack(i) {
      current = i;
      var t = TRACKS[i];
      /* Set src langsung — cara paling andal agar browser memuat file baru */
      audio.src = t.src;
      audio.load();
      if (nameEl) nameEl.textContent = t.label;
      tabs.forEach(function (tab, idx) {
        var on = idx === i;
        tab.classList.toggle("is-active", on);
        tab.setAttribute("aria-selected", on ? "true" : "false");
      });
      curEl && (curEl.textContent = "0:00");
      progressFill && (progressFill.style.width = "0%");
      progress && progress.setAttribute("aria-valuenow", "0");
      stopUI();
    }

    function playUI() {
      playBtn.classList.add("is-playing");
      playBtn.setAttribute("aria-label", "Jeda lagu");
      disc && disc.classList.add("is-spinning");
      hintEl && (hintEl.textContent = "Selamat ulang tahun, DayDay \u2665");
    }
    function stopUI() {
      playBtn.classList.remove("is-playing");
      playBtn.setAttribute("aria-label", "Putar lagu");
      disc && disc.classList.remove("is-spinning");
    }

    function togglePlay() {
      if (audio.paused) {
        var p = audio.play();
        if (p && typeof p.catch === "function") p.catch(function () { /* autoplay/decode gagal: abaikan */ });
      } else {
        audio.pause();
      }
    }

    function loadLyrics() {
      if (lyricsLoaded) return;
      lyricsLoaded = true;
      fetch("assets/lirik-35.txt")
        .then(function (r) {
          if (!r.ok) throw new Error("lirik " + r.status);
          return r.text();
        })
        .then(function (txt) {
          if (lyricsText) lyricsText.textContent = txt.trim();
        })
        .catch(function () {
          if (lyricsText) lyricsText.textContent = "Lirik tidak dapat dimuat.";
        });
    }

    /* ---- Event ---- */
    playBtn.addEventListener("click", togglePlay);

    audio.addEventListener("play", playUI);
    audio.addEventListener("pause", stopUI);
    audio.addEventListener("ended", stopUI);

    audio.addEventListener("loadedmetadata", function () {
      if (durEl && isFinite(audio.duration)) durEl.textContent = fmt(audio.duration);
    });

    audio.addEventListener("timeupdate", function () {
      if (!curEl || !audio.duration) return;
      curEl.textContent = fmt(audio.currentTime);
      var pct = (audio.currentTime / audio.duration) * 100;
      progressFill.style.width = pct + "%";
      progress.setAttribute("aria-valuenow", String(Math.round(pct)));
      progress.setAttribute("aria-valuetext", fmt(audio.currentTime));
    });

    /* Klik / ketuk pada bar progres untuk loncat posisi */
    function seekTo(clientX) {
      if (!audio.duration) return;
      var rect = progress.getBoundingClientRect();
      var ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      audio.currentTime = ratio * audio.duration;
    }
    progress.addEventListener("click", function (e) { seekTo(e.clientX); });

    /* Keyboard: panah kiri/kanan pada slider (±5 detik) */
    progress.addEventListener("keydown", function (e) {
      if (!audio.duration) return;
      if (e.key === "ArrowRight" || e.key === "Right") {
        audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
        e.preventDefault();
      } else if (e.key === "ArrowLeft" || e.key === "Left") {
        audio.currentTime = Math.max(0, audio.currentTime - 5);
        e.preventDefault();
      }
    });

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var i = parseInt(tab.getAttribute("data-track"), 10);
        if (isNaN(i) || i === current) return;
        var wasPlaying = !audio.paused;
        setTrack(i);
        if (wasPlaying) {
          var p = audio.play();
          if (p && typeof p.catch === "function") p.catch(function () {});
        }
      });
    });

    lyricsBtn.addEventListener("click", function () {
      var open = lyricsBox.hasAttribute("hidden");
      if (open) {
        lyricsBox.removeAttribute("hidden");
        lyricsBtn.setAttribute("aria-expanded", "true");
        lyricsBtn.textContent = "Sembunyikan Lirik";
        loadLyrics();
      } else {
        lyricsBox.setAttribute("hidden", "");
        lyricsBtn.setAttribute("aria-expanded", "false");
        lyricsBtn.textContent = "Lihat Lirik";
      }
    });

    setTrack(0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
