#!/usr/bin/env python3
"""Validasi statis untuk situs ulang tahun.
Memeriksa: file wajib ada, link/aset internal terpenuhi, tidak ada
tag <script src>/<link href> yang mengarah ke file hilang, dan
konten inti (fakta wajib) tercantum. Tidak butuh dependensi."""
import os, re, sys, html.parser, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
errors = []
notes = []

# 1. File wajib
required = ["index.html", "styles.css", "script.js", "config.js",
            "assets/favicon.svg", "assets/placeholder-1.svg",
            "assets/placeholder-2.svg", "assets/placeholder-3.svg"]
for f in required:
    p = ROOT / f
    if not p.exists():
        errors.append(f"MISSING: {f}")
    else:
        notes.append(f"ok: {f} ({p.stat().st_size} bytes)")

# 2. Parse index.html untuk link/src internal
idx = (ROOT / "index.html").read_text(encoding="utf-8")

class LinkChecker(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "link" and d.get("rel") == "stylesheet":
            self.refs.append(("stylesheet", d.get("href","")))
        if tag == "link" and d.get("rel") == "icon":
            self.refs.append(("icon", d.get("href","")))
        if tag == "script" and "src" in d:
            self.refs.append(("script", d.get("src","")))
        if tag == "img":
            self.refs.append(("img", d.get("src","")))

lc = LinkChecker()
lc.feed(idx)
for kind, href in lc.refs:
    if href.startswith(("http://","https://","//","data:")):
        notes.append(f"external {kind}: {href} (skip)")
        continue
    p = ROOT / href
    if not p.exists():
        errors.append(f"BROKEN {kind} ref: {href}")
    else:
        notes.append(f"ok: {kind} -> {href}")

# 3. Cek fakta wajib & placeholder
must_contain = ["9 Oktober 1991", "ke-35", "2026", "prefers-reduced-motion", "birthday-name"]
low = idx.lower()
for m in must_contain:
    if m.lower() not in low:
        # fakta wajib +Birthday-name boleh fulfilled oleh config.js / styles.css
        alt = (ROOT / "config.js").read_text(encoding="utf-8").lower() if (ROOT / "config.js").exists() else ""
        if m == "prefers-reduced-motion" and m in (ROOT / "styles.css").read_text(encoding="utf-8"):
            notes.append(f"ok: '{m}' ada di styles.css")
        elif m in alt:
            notes.append(f"ok: '{m}' ada di config.js")
        else:
            errors.append(f"MISSING content: '{m}' tidak ditemukan")
    else:
        notes.append(f"ok: content '{m}'")

# 4. Cek tidak ada 'lorem' yang tertinggal (HTML maupun config)
for target in ("index.html", "config.js"):
    p = ROOT / target
    if p.exists() and re.search(r"lorem", p.read_text(encoding="utf-8"), re.I):
        errors.append(f"FOUND 'lorem' placeholder di {target} - ganti dengan konten asli")
    elif p.exists():
        notes.append(f"ok: tidak ada 'lorem' di {target}")

# 5. Cek tag semantik dasar
for tag in ["<header","<main","<section","<footer","<figure","<blockquote","<time"]:
    if tag not in idx:
        errors.append(f"MISSING semantic tag: {tag}")
    else:
        notes.append(f"ok: semantic {tag}")

print("=== VALIDATION ===")
for n in notes:
    print("  ", n)
print()
if errors:
    print("FAIL:")
    for e in errors:
        print("  -", e)
    sys.exit(1)
else:
    print("PASS — semua cek lolos")
