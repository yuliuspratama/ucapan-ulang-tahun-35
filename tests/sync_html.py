#!/usr/bin/env python3
"""Sinkronkan teks fallback di index.html dengan nilai config.js.

Dipakai SETELAH mengubah config.js: nama baru harus ikut tertulis di
fallback HTML supaya halaman tetap utuh tanpa JavaScript.

Jalankan: python3 tests/sync_html.py
"""
import html as html_mod
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"

node_src = (
    "const fs=require('fs');"
    f"const s=fs.readFileSync({str(ROOT / 'config.js')!r},'utf8');"
    "const w={window:{}};"
    "eval(s.replace(/window\\.SITE_CONFIG/,'w.SITE_CONFIG'));"
    "process.stdout.write(JSON.stringify(w.SITE_CONFIG));"
)
cfg = json.loads(subprocess.run(
    ["node", "-e", node_src], capture_output=True, text=True, timeout=30, check=True
).stdout)


def resolve(path):
    node = cfg
    for key in path.split("."):
        if isinstance(node, dict):
            node = node.get(key)
        elif isinstance(node, list) and key.isdigit():
            i = int(key)
            node = node[i] if i < len(node) else None
        else:
            return None
    return node


html = INDEX.read_text(encoding="utf-8")
changed = 0

# Slot yang isinya teks: ganti isi di antara > dan </. Elemen <time> dan
# elemen lain yang punya atribut perlu dipertahankan utuh.
pattern = re.compile(r'(data-config="([^"]+)"[^>]*>)(.*?)(</)', re.DOTALL)


def repl(m):
    global changed
    open_tag, path, old_inner, close_tag = m.group(1), m.group(2), m.group(3), m.group(4)
    value = resolve(path)
    if not isinstance(value, str):
        return m.group(0)
    expected = re.sub(r"\{\{\s*nama\s*\}\}", cfg.get("nama", ""), value)
    new_inner = expected
    # Kurung kutip dicurl untuk teks kutipan & tempo, sama seperti aslinya.
    if path == "kutipan":
        new_inner = expected
    if old_inner == new_inner:
        return m.group(0)
    changed += 1
    print(f"  sync {path}: {html_mod.unescape(old_inner)[:40]!r} -> {new_inner[:40]!r}")
    return open_tag + new_inner + close_tag


new_html = pattern.sub(repl, html)
if changed:
    INDEX.write_text(new_html, encoding="utf-8")
print(f"{changed} slot disinkronkan")
sys.exit(0)