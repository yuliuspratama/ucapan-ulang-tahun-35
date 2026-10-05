#!/usr/bin/env python3
"""Memastikan config.js dan index.html tidak berbeda.

index.html memuat salinan teks sebagai fallback (agar halaman tetap utuh
tanpa JavaScript). File ini memaksa kedua sumber itu tetap identik,
sehingga tidak mungkin ada dua sumber kebenaran yang berbeda diam-diam.

Catatan: nilai di HTML ditulis sebagai entitas HTML (&ldquo; &mdash;),
sedangkan config.js memakai karakter aslinya. Teks HTML di-decode dulu
sebelum dibandingkan.

Jalankan: python3 tests/validate_consistency.py
"""
import html as html_mod
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
errors = []
notes = []

# 1. Ambil SITE_CONFIG dari config.js lewat node (JSON.stringify)
node_src = (
    "const fs=require('fs');"
    f"const s=fs.readFileSync({str(ROOT / 'config.js')!r},'utf8');"
    "const w={window:{}};"
    "eval(s.replace(/window\\.SITE_CONFIG/,'w.SITE_CONFIG'));"
    "process.stdout.write(JSON.stringify(w.SITE_CONFIG));"
)
try:
    out = subprocess.run(
        ["node", "-e", node_src], capture_output=True, text=True, timeout=30, check=True
    ).stdout
    cfg = json.loads(out)
    notes.append("ok: config.js terbaca dan valid JS")
except Exception as exc:  # noqa: BLE001
    errors.append(f"config.js tidak bisa dibaca via node: {exc}")
    cfg = {}

if cfg:
    # 2. Semua slot HTML harus ada nilainya di config
    idx = (ROOT / "index.html").read_text(encoding="utf-8")

    def resolve(cfg_obj, path):
        """Samakan dengan Javascript: path dipisah titik, angka = indeks array."""
        node = cfg_obj
        for key in path.split("."):
            if isinstance(node, dict):
                node = node.get(key)
            elif isinstance(node, list) and key.isdigit():
                idx_n = int(key)
                node = node[idx_n] if idx_n < len(node) else None
            else:
                return None
        return node

    slots = re.findall(r'data-config="([^"]+)"', idx)
    if not slots:
        errors.append("index.html tidak punya slot data-config sama sekali")
    for path in sorted(set(slots)):
        if isinstance(resolve(cfg, path), str):
            notes.append(f"ok: slot {path} -> config")
        else:
            errors.append(f"slot data-config=\"{path}\" tidak ada / bukan teks di config.js")

    # 3. Teks fallback di HTML harus sama dengan nilai config
    for m in re.finditer(r'data-config="([^"]+)"[^>]*>([^<]*)</', idx):
        path, fallback = m.group(1), m.group(2)
        node = resolve(cfg, path)
        if isinstance(node, str):
            expected = re.sub(r"\{\{\s*nama\s*\}\}", cfg.get("nama", ""), node)
            # HTML di-decode: &ldquo; -> ", &mdash; -> -, dll.
            got = html_mod.unescape(fallback).strip()
            if got != expected.strip():
                errors.append(
                    f"fallback HTML untuk \"{path}\" berbeda dari config.\n"
                    f"      html  : {got[:90]}\n"
                    f"      config: {expected.strip()[:90]}"
                )
            else:
                notes.append(f"ok: fallback '{path}' identik dengan config")

    # 4. Fakta wajib harus ada, sekali di config saja
    facts = {
        "tanggal lahir 9 Oktober 1991": any(
            isinstance(v, str) and "9 Oktober 1991" in v for v in cfg.values()
        ),
        "usia ke-35": cfg.get("usia") == "ke-35",
        "perayaan 2026": any(
            isinstance(v, str) and "2026" in v for v in cfg.values()
        ),
    }
    for label, ok in facts.items():
        (notes if ok else errors).append(
            ("ok: fakta wajib - " if ok else "MISSING fakta wajib - ") + label
        )

    # 5. Tidak boleh ada placeholder mentah yang tertinggal di config
    for token in ("[Nama]", "[Tulis", "[Ganti", "lorem"):
        blob = json.dumps(cfg, ensure_ascii=False)
        if token.lower() in blob.lower():
            errors.append(f"config.js masih memuat placeholder mentah: {token}")
        else:
            notes.append(f"ok: tidak ada '{token}'")

    # 6. Nama default tidak boleh TER-HARDCODE di teks Sambutan.
    # Kalau iya, mengganti `nama` akan meninggalkan teks basi di halaman.
    default_nama = cfg.get("nama", "")
    for key in ("sambutan", "ucapan", "kenangan"):
        vals = cfg.get(key, [])
        flat = [s for item in (vals if isinstance(vals, list) else [vals])
                for s in (item if isinstance(item, list) else [item])]
        for s in flat:
            if isinstance(s, str) and default_nama and default_nama in s:
                errors.append(
                    f"config.js.{key} masih menulis nama default '{default_nama}' secara literal. "
                    f"Gunakan token {{{{nama}}}} supaya ikut berubah saat nama diganti."
                )
    # Halaman hanya boleh menampilkan nama lewat slot data-config="nama"
    html_names = re.findall(
        r'data-config="nama"[^>]*>([^<]*)<', idx)
    for n in set(html_names):
        if n.strip() != default_nama:
            errors.append(f'fallback slot "nama" ({n!r}) beda dari config ({default_nama!r})')
    if not any("{{nama}}" in s for key in ("sambutan",)
               for s in cfg.get(key, [])):
        errors.append("sambutan tidak memakai token {{nama}} - nama tidak akan ikut berubah")

print("=== KONSISTENSI CONFIG <-> HTML ===")
for n in notes:
    print("  ", n)
print()
if errors:
    print("FAIL:")
    for e in errors:
        print("  -", e)
    sys.exit(1)
print("PASS - config.js dan index.html konsisten")