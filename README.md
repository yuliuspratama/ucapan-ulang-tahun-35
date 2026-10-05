# Selamat Ulang Tahun ke-35

Halaman statis ucapan ulang tahun — elegan, responsif, dibuat dengan **HTML, CSS, dan JavaScript murni** (tanpa framework, tanpa backend, tanpa proses build).

Fakta yang dirayakan: **lahir 9 Oktober 1991**, merayakan **usia ke-35 pada tahun 2026**.

## Struktur project

```
.
├── index.html              # markup semantik + metadata, dengan slot data-config
├── config.js               # SATU-SATUNYA tempat mengedit nama, tanggal, dan seluruh teks
├── styles.css              # palet feminin lembut, tipografi, responsif
├── script.js               # suntik config, partikel melayang, confetti, reveal, a11y
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
node tests/qa_browser.mjs             # PASS - 147 pemeriksaan
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

## Catatan teknis

- Struktur flat dengan path relatif (`styles.css`, `script.js`, `assets/...`), tanpa build — langsung bisa dipublikasikan ke GitHub Pages.
- Tanpa framework, jadi tidak ada hydration; yang perlu diwadai adalah layout shift dan FOUC. Keduanya sudah dicek: lebar dokumen selalu sama dengan lebar viewport dan tidak ada horizontal scroll.
- Font dimuat dari Google Fonts. Bila diblokir atau offline, halaman tetap rapi dengan font fallback (`Times New Roman` / `system-ui`).
- `config.js` sengaja dimuat tanpa `defer` agar tersedia sebelum `script.js` berjalan.