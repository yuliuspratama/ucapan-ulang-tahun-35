# Selamat Ulang Tahun ke-35

Halaman statis ucapan ulang tahun — elegan, responsif, dibuat dengan **HTML, CSS, dan JavaScript murni** (tanpa framework, tanpa backend, tanpa proses build).

**Situs live:** <https://yuliuspratama.github.io/ucapan-ulang-tahun-35/>

## Daftar Isi

- [Fitur Otomatis (Countdown + Auto-Increment)](#fitur-otomatis-countdown--auto-increment)
- [Tema Spesial Hari Ulang Tahun](#tema-spesial-hari-ulang-tahun)
- [CI Workflow](#ci-workflow)
- [Struktur Project](#struktur-project)

Fakta yang dirayakan: **lahir 9 Oktober 1991**, merayakan **usia ke-35 pada tahun 2026**.

## Fitur Otomatis (Countdown + Auto-Increment)

Situs ini tetap relevan tanpa edit manual tiap tahun. `script.js` menghitung dari `lahirISO` di `config.js` (zona WIB, `Asia/Jakarta`):

1. **Countdown live** — hitung mundur hari-jam-menit-detik menuju ulang tahun berikutnya, update tiap 1 detik.
2. **Auto-increment usia** — saat hari ulang tahun berlalu (10 Okt 00:00 WIB), target otomatis pindah ke 9 Okt tahun depan dan usia naik 1. Tidak perlu ubah config.
3. **Deteksi hari-H** — saat tanggal kalender WIB == 9 Oktober, class `is-birthday` ditambahkan ke `<html>`, memicu tema spesial.

Contoh perilaku:
- 6 Okt 2026 → countdown ke 9 Okt 2026, usia `ke-35`
- 9 Okt 2026 00:00–23:59 WIB → `isBirthdayToday=true`, tema spesial aktif
- 10 Okt 2026 00:01 WIB → auto-shift ke 9 Okt 2027, usia `ke-36`
- 2030 → tetap relevan, usia `ke-39`

Logika terverifikasi oleh `tests/verify_countdown_logic.py` (8 skenario).

## Tema Spesial Hari Ulang Tahun

Saat hari H tiba, situs otomatis berubah suasana:

- **Banner ucapan** di atas hero: "Selamat ulang tahun, DayDay! ❤" dengan animasi glow
- **Palet hero berubah** jadi festive (oranye-pink gradient)
- **Title usia** dengan gradient emas-pink + text-shadow glow
- **Tombol "Rayakan bersama"** lebih menonjol (gradient + pulse animation)
- **Confetti otomatis** saat load + burst tiap 30 detik
- **Partikel melayang** lebih cepat + glow bunga

Semua animasi tema **dihormati `prefers-reduced-motion`** — pengguna yang menyimpan preferensi ini tetap melihat banner dan warna festive, tapi tanpa animasi.

## CI Workflow

GitHub Actions workflow di `.github/workflows/ci.yml` menjalankan:

1. **`validate.py`** — cek file wajib, link/aset internal, fakta inti, semantik HTML
2. **`validate_consistency.py`** — paksa `config.js` ↔ `index.html` tetap sinkron
3. **Cek placeholder tersisa** — tolak `Saudari`, `lorem`, `[Nama]`, dll.
4. **Cek field `lahirISO`** — pastikan countdown + auto-increment berfungsi
5. **Verifikasi struktur HTML** — elemen countdown (`data-cd-days`) + banner hari-H ada
6. **Upload artifact** — situs statis siap deploy

Workflow berjalan pada: `push` ke `main`, `pull_request` ke `main`, dan `workflow_dispatch` (manual trigger dari tab Actions).

## Struktur project

```
.
├── index.html              # markup semantik + metadata, dengan slot data-config
├── config.js               # SATU-SATUNYA tempat mengedit nama, tanggal, dan seluruh teks
├── styles.css              # palet feminin lembut, tipografi, responsif
├── script.js               # suntik config, partikel melayang, confetti, reveal, a11y
├── .nojekyll               # matikan Jekyll saat Pages mem-build dari branch
├── assets/
│   ├── favicon.svg
│   ├── placeholder-1.svg
│   ├── placeholder-2.svg
│   └── placeholder-3.svg
├── tests/
│   ├── validate.py             # file & referensi internal, fakta wajib, semantik
│   ├── validate_consistency.py # config.js harus identik dengan fallback di HTML
│   ├── sync_html.py            # salin nilai config.js ke fallback HTML
│   ├── qa_browser.mjs          # QA browser nyata via CDP (butuh chromium)
│   ├── live_check.mjs          # uji URL live: cold load, navigasi anchor, refresh
│   ├── live_scroll_shot.mjs    # scroll seluruh halaman + screenshot per section
│   └── cleanup.py              # buang artefak sementara QA
├── qa-shots/               # screenshot hasil QA (diabaikan oleh git)
└── README.md
```

## Cara mengganti nama (satu konfigurasi)

**Semua teks yang bisa diganti ada di satu file: `config.js`.** Buka file itu, ubah nilai yang diperlukan, lalu muat ulang halaman. Tidak ada nilai lain yang perlu diedit di file mana pun.

| Kunci di `config.js` | Tampil di |
|---|---|
| `nama` | hero ("Untuk …") dan footer |
| `tanggalLahir` | kalimat "Lahir pada …" di hero |
| `tanggalPerayaan` | tanggal di hero dan footer |
| `usia` | angka besar "ke-35" di hero |
| `sambutan[0]`, `sambutan[1]` | dua paragraf utama di section Sambutan |
| `kutipan` | satu quotation di section Kutipan |
| `ucapan[i][0]`, `ucapan[i][1]` | teks ucapan + nama pengirim (3 kartu) |
| `kenangan[i]` | takarir di bawah foto galeri (3 buah) |

Contoh — mengganti nama:

```js
// config.js
window.SITE_CONFIG = {
  nama: "Siti Rahmawati",   // <- satu-satunya baris yang perlu diubah
  tanggalLahir: "9 Oktober 1991",
  tanggalPerayaan: "9 Oktober 2026",
  usia: "ke-35",
  sambutan: [
    "... boleh menulis {{nama}} di mana saja ...",
    "..."
  ],
  // ...
};
```

Token `{{nama}}` di dalam teks akan otomatis diganti dengan nilai `nama`.

Setelah mengubah `config.js`, jalankan sekali:

```sh
python3 tests/sync_html.py             # salin nilai baru ke fallback HTML
python3 tests/validate_consistency.py  # pastikan tidak ada sumber yang beda
```

`validate_consistency.py` juga gagal bila nama default masih ditulis
literal di teks — itu tanda teksnya belum memakai `{{nama}}`, sehingga
nama lama akan tertinggal setelah nama diganti.

### Kenapa teksnya ada dua kali?

Setiap elemen yang menampilkan teks dari config juga memuat salinan teks yang sama di dalam HTML, dipakai sebagai **fallback**. Gunanya: halaman tetap utuh dan rapi meski JavaScript tidak aktif atau `config.js` gagal dimuat.

Supaya kedua sumber itu tidak diam-diam berbeda, `tests/validate_consistency.py` memeriksa tiap slot `data-config` dan membandingkan teks fallback di HTML dengan nilai di `config.js`. Kalau berbeda, test gagal dan menyebut slot yang bermasalah.

## Fitur

- **Semantic HTML** (`header`, `main`, `section`, `footer`, `figure`, `blockquote`, `cite`, `time`).
- Palet feminin lembut (blush, rose, mauve, cream) yang sudah **lolos kontras WCAG AA** untuk semua teks.
- Tipografi: Cormorant Garamond (display) + Poppins (body).
- Animasi halus: partikel melayang, confetti (canvas + `requestAnimationFrame`, dipicu tombol atau tekan `c`), reveal saat elemen masuk viewport.
- **`prefers-reduced-motion`**: semua animasi dimatikan, konten tetap tampil lengkap.
- **`prefers-contrast: more`**: palet beralih ke kontras maksimum.
- **Responsif**: mobile-first, `clamp()` untuk skala tipografi, grid adaptif.
- **Aksesibilitas**: skip link, `:focus-visible` yang terlihat, navigasi keyboard penuh, `aria-label`, alt teks.
- **Tanpa console error** — semua inisialisasi dibungkus try/catch.

## Menjalankan

Buka `index.html` langsung di browser, atau lewat server statis:

```sh
python3 -m http.server 8901
# buka http://localhost:8901
```

## Menjalankan test

```sh
python3 tests/validate.py              # PASS
python3 tests/validate_consistency.py  # PASS
```

QA browser nyata (butuh `chromium` dan Node >= 22):

```sh
chromium --headless=new --no-sandbox --remote-debugging-port=9222 about:blank &
python3 -m http.server 8901 &
node tests/qa_browser.mjs              # PASS - 147 pemeriksaan
```

Yang diperiksa `qa_browser.mjs`:
- console error/warning, `exceptionThrown`, request gagal, dan HTTP >= 400 (broken asset)
- overflow horizontal di 6 viewport (320, 390, 430, 768, 1280, 1920)
- kontras teks WCAG terhadap latar efektif, termasuk warna di dalam `linear-gradient` dan teks dengan `background-clip: text`
- navigasi keyboard: tab order, skip link, outline fokus, elemen fokus tidak terpotong
- `prefers-reduced-motion` (partikel 0, canvas/layer `display:none`, semua elemen langsung terlihat)
- `prefers-contrast: more`
- isi halaman tanpa JavaScript (fallback tetap utuh)
- fakta wajib benar-benar tampil, dan seluruh slot terisi dari `config.js`

Screenshot tiap viewport tersimpan di `qa-shots/`.

## Verifikasi situs live

`qa_browser.mjs` menerima URL sebagai argumen pertama, sehingga suite yang sama bisa dijalankan langsung terhadap URL publik:

```sh
node tests/qa_browser.mjs https://yuliuspratama.github.io/ucapan-ulang-tahun-35/
# PASS - 147 pemeriksaan lolos, 0 masalah
```

Tambahan dua skrip khusus untuk deployment:

```sh
# cold load + klik skip-link (anchor #main) + hard refresh, satu tab CDP
node tests/live_check.mjs https://yuliuspratama.github.io/ucapan-ulang-tahun-35/

# scroll seluruh halaman supaya animasi reveal fired, lalu screenshot per section
node tests/live_scroll_shot.mjs https://yuliuspratama.github.io/ucapan-ulang-tahun-35/ qa-shots
```

`live_scroll_shot.mjs` diperlukan saat meninjau visual: `Page.captureScreenshot` dengan `captureBeyondViewport` **tidak** memicu `IntersectionObserver`, jadi elemen `.reveal` di bawah fold tetap `opacity: 0` dan tampak seperti halaman kosong. Setelah halaman di-scroll dulu, seluruh 14 elemen reveal terlihat dan ketiga gambar galeri termuat (`naturalWidth` 200).

## Cara deploy ulang

Pages memakai **build_type `legacy`** dari branch `main` (bukan GitHub Actions), karena token `gh` pada account ini ber-scope `gist, read:org, repo` — **tanpa scope `workflow`**, sehingga file `.github/workflows/*.yml` akan ditolak saat push. Publishing dari branch otomatis membangun ulang setiap kali `main` berubah.

```sh
git push origin main
# tunggu ~30 detik, lalu cek:
gh api repos/yuliuspratama/ucapan-ulang-tahun-35/pages/builds/latest --jq .status
```

## Catatan teknis

- Struktur flat dengan path relatif (`styles.css`, `script.js`, `assets/...`), tanpa build — langsung bisa dipublikasikan ke GitHub Pages.
- `.nojekyll` disables Jekyll sehingga file served apa adanya.
- Tanpa framework, jadi tidak ada hydration; yang perlu diwadai adalah layout shift dan FOUC. Keduanya sudah dicek: lebar dokumen selalu sama dengan lebar viewport dan tidak ada horizontal scroll.
- Font dimuat dari Google Fonts. Bila diblokir atau offline, halaman tetap rapi dengan font fallback (`Times New Roman` / `system-ui`).
- `config.js` sengaja dimuat tanpa `defer` agar tersedia sebelum `script.js` berjalan.
- Nilai `nama` masih `"Saudari"` (placeholder netral) karena nama asli belum diberikan. Ganti satu baris di `config.js`.
