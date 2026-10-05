#!/usr/bin/env python3
"""Buang direktori sementara QA (.qa-venv) yang tidak ikut dipublikasikan."""
import pathlib
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
target = ROOT / ".qa-venv"
if target.exists():
    shutil.rmtree(target)
    print(f"removed: {target}")
else:
    print("nothing to remove")