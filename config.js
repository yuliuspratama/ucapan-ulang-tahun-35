/* ============================================================
   KONFIGURASI SINGLE-SOURCE - SATU-SATUNYA TEMPAT UNTUK MENGEDIT
   ============================================================
   Ubah nilai di blok SITE_CONFIG di bawah, lalu muat ulang halaman.

   Tidak ada nilai yang perlu diubah di file lain:
   - index.html memuat salinan teks yang sama sebagai fallback,
     agar halaman tetap utuh dan rapi bila JavaScript tidak aktif.
   - tests/validate_consistency.py memaksa config dan HTML tetap
     identik, sehingga tidak mungkin ada dua sumber kebenaran.

   Token {{nama}} diganti otomatis dengan nilai `nama` di bawah.
   ------------------------------------------------------------ */

window.SITE_CONFIG = {
  /* --- 1. Nama yang dirayakan ---------------------------------
     GANTI nilai ini dengan nama lengkap yang dirayakan.
     Semua kemunculan nama (hero, sambutan, footer) ikut berubah. */
  nama: "Saudari",

  /* --- 2. Tanggal penting -------------------------------------
     Angka-angka ini disalin apa adanya ke hero dan footer. */
  tanggalLahir: "9 Oktober 1991",
  tanggalPerayaan: "9 Oktober 2026",
  usia: "ke-35",

  /* --- 3. Sambutan (dua paragraf utama) -----------------------
     Boleh memakai {{nama}} di mana saja. */
  sambutan: [
    "Hari ini, 9 Oktober 2026, tibalah hari yang kita nantikan: ulang tahun ke-35 {{nama}}. Tepat tiga puluh lima tahun lalu, pada 9 Oktober 1991, dunia diberi hadiah seorang perempuan yang hangat, lembut, dan penuh cahaya. Sejak saat itu, setiap hari yang kita jalani terasa sedikit lebih terang.",
    "Halaman kecil ini bukan sekadar ucapan. Ia adalah ruang untuk mengenang senyum, ketawa, dan semua momen yang telah {{nama}} bagi kepada kita. Semoga setiap kata di sini menjadi pengingat: kau dihargai, kau dicintai, dan kau tidak pernah berjalan sendirian."
  ],

  /* --- 4. Satu quotation -------------------------------------
     Tanda kutip ikut di sini supaya hasil suntikan di browser
     tetap sama persis dengan teks aslinya. */
  kutipan:
    "“Bahagia bukan soal bertambahnya angka, melainkan bertambahnya alasan untuk cerah di hari esok.”",

  /* --- 5. Ucapan keluarga: [teks ucapan, nama pengirim] ------ */
  ucapan: [
    [
      "Semoga setiap langkahmu ke depan terasa ringan, dan selalu ada tempat pulang yang hangat.",
      "Keluarga"
    ],
    [
      "Terima kasih sudah menjadi teman yang selalu hadir dalam hal-hal kecil yang justru paling penting.",
      "Teman-teman"
    ],
    [
      "Semoga tahun ini memberimu keberanian untuk percaya pada setiap keputusan besar yang kamu ambil.",
      "Rekan kerja"
    ]
  ],

  /* --- 6. Takarir foto galeri (untuk tiga placeholder) ------- */
  kenangan: [
    "Tempat untuk foto kenangan pertama - ganti dengan foto yang paling kamu sayangi.",
    "Tempat untuk foto kenangan kedua - ganti dengan foto yang paling membuatmu tersenyum.",
    "Tempat untuk foto kenangan ketiga - ganti dengan foto yang paling ingin kamu ingat."
  ]
};