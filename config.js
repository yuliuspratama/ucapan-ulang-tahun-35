/* ============================================================
   KONFIGURASI SINGLE-SOURCE - SATU-SATUNYA TEMPAT UNTUK MENGEDIT
   ============================================================
   Ubah nilai di blok SITE_CONFIG di bawah, lalu muat ulang halaman.

   Tidak ada nilai yang perlu diubah di file lain:
   - index.html memuat salinan teks yang sama sebagai fallback,
     agar halaman tetap utuh dan rapi bila JavaScript tidak aktif.
   - tests/validate_consistency.py memaksa config dan HTML tetap
     identik, sehingga tidak mungkin ada dua sumber kebenaran.

   FITUR OTOMATIS (label `auto`):
   - lahirISO: tanggal lahir ISO 8601 + offset zona WIB (+07:00).
     script.js menghitung countdown ke ulang tahun berikutnya dan
     meng-update `usia` + `tanggalPerayaan` otomatis saat hari H
     bergeser. Tidak perlu edit manual tiap tahun.
   - zonaWIB: penanda zona waktu (Asia/Jakarta, UTC+7). */

window.SITE_CONFIG = {
  /* NAMA - ganti "DayDay" dengan nama lengkap bila berbeda. */
  nama: "DayDay",

  /* TANGGAL - lahirISO memakai format ISO 8601 dengan offset WIB.
     Dari sini, script.js menghitung:
       * ulang tahun berikutnya (9 Oktober tahun berjalan atau tahun depan)
       * usia otomatis (ke-35 di 2026, ke-36 di 2027, dst.)
     Nilai `tanggalLahir` di bawah tetap statis untuk fallback. */
  lahirISO: "1991-10-09T00:00:00+07:00", // WIB
  tanggalLahir: "9 Oktober 1991",

  /* auto: diisi oleh script.js saat runtime.
     Nilai di sini hanya fallback awal jika JS tidak aktif. */
  tanggalPerayaan: "9 Oktober 2026",
  usia: "ke-35",

  /* Ucapan utama. Token {{nama}} diganti otomatis dengan nilai `nama` di atas. */
  sambutan: [
    "Hari ini, 9 Oktober 2026, tibalah hari yang kita nantikan: ulang tahun ke-35 {{nama}}. Tepat tiga puluh lima tahun lalu, pada 9 Oktober 1991, dunia diberi hadiah seorang perempuan yang hangat, kuat, dan penuh kasih.",
    "Tiga puluh lima tahun bukan hanya angka — ia adalah jejak langkah, tawa yang dibagi, air mata yang diusap, dan mimpi-mimpi yang perlahan menjadi nyata. Terima kasih sudah menjadi dirimu, {{nama}} — persis sebagaimana adanya."
  ],

  quote: {
    text: "Tahun ini, semoga setiap pagi membawa tenang, dan setiap malam membawa syukur.",
    by: "Untuk DayDay, dengan kasih"
  },

  /* Alias agar cocok dengan nama field di index.html (legacy).
     kenangan = galleryAlt (array string); kutipan = quote.text (string). */
  kenangan: [
    "Tempat untuk foto kenangan pertama - ganti dengan foto yang paling kamu sayangi.",
    "Tempat untuk foto kenangan kedua - ganti dengan foto yang paling membuatmu tersenyum.",
    "Tempat untuk foto kenangan ketiga - ganti dengan foto yang paling ingin kamu ingat."
  ],
  kutipan: "Tahun ini, semoga setiap pagi membawa tenang, dan setiap malam membawa syukur.",

  gallery: [
    { alt: "Kenangan pertama", caption: "Tempat untuk foto kenangan pertama - ganti dengan foto yang paling kamu sayangi." },
    { alt: "Kenangan kedua", caption: "Tempat untuk foto kenangan kedua - ganti dengan foto yang paling membuatmu tersenyum." },
    { alt: "Kenangan ketiga", caption: "Tempat untuk foto kenangan ketiga - ganti dengan foto yang paling ingin kamu ingat." }
  ],

  ucapan: [
    [
      "Selamat ulang tahun, {{nama}}! Semoga tahun ini penuh kebahagiaan yang sederhana namun berarti.",
      "Keluarga"
    ],
    [
      "Semoga setiap impian yang kamu simpan perlahan menemukan jalannya menuju kenyataan.",
      "Teman-teman"
    ],
    [
      "Semoga tahun ini memberimu keberanian untuk percaya pada setiap keputusan besar yang kamu ambil.",
      "Rekan kerja"
    ]
  ],

  galleryAlt: [
    "Tempat untuk foto kenangan pertama - ganti dengan foto yang paling kamu sayangi.",
    "Tempat untuk foto kenangan kedua - ganti dengan foto yang paling membuatmu tersenyum.",
    "Tempat untuk foto kenangan ketiga - ganti dengan foto yang paling ingin kamu ingat."
  ]
};
