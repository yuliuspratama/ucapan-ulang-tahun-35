#!/usr/bin/env python3
"""Verifikasi logika getBirthdayState dari script.js (countdown + auto-increment + deteksi hari-H).

Mengimplementasikan algoritma yang sama dengan script.js dalam Python
untuk memastikan perhitungan benar di berbagai skenario tanggal.
"""
from datetime import datetime, timezone, timedelta

WIB = timezone(timedelta(hours=7))
BORN_ISO = "1991-10-09T00:00:00+07:00"

def get_birthday_state(now_iso):
    born = datetime.fromisoformat(BORN_ISO)
    now = datetime.fromisoformat(now_iso)
    # Konversi now ke WIB
    now_wib = now.astimezone(WIB)
    bd_month, bd_date = 10, 9  # 9 Oktober
    today_month = now_wib.month
    today_date = now_wib.day
    today_year_wib = now_wib.year
    is_birthday_today = (today_month == bd_month and today_date == bd_date)
    next_year = today_year_wib
    already_passed = (today_month > bd_month) or (today_month == bd_month and today_date > bd_date)
    if already_passed:
        next_year = today_year_wib + 1
    # Ultah berikutnya: 9 Okt next_year 00:00 WIB
    next_birthday = datetime(next_year, bd_month, bd_date, 0, 0, 0, tzinfo=WIB)
    next_age = next_year - born.year
    return {
        "now": now.isoformat(),
        "is_birthday_today": is_birthday_today,
        "next_birthday": next_birthday.isoformat(),
        "next_age": next_age,
        "next_age_roman": f"ke-{next_age}",
    }

# Test scenarios
tests = [
    ("2026-10-06T12:00:00+07:00", "H-3: 6 Okt 2026 - countdown ke 9 Okt 2026, usia ke-35"),
    ("2026-10-09T00:00:00+07:00", "Hari H pagi: 9 Okt 2026 00:00 WIB - hari ulang tahun, usia ke-35"),
    ("2026-10-09T23:59:00+07:00", "Hari H malam: 9 Okt 2026 23:59 WIB - masih hari ulang tahun"),
    ("2026-10-10T00:01:00+07:00", "H+1: 10 Okt 2026 00:01 WIB - sudah lewat, auto-increment ke 2027, usia ke-36"),
    ("2027-10-08T12:00:00+07:00", "H-1 ultah 2027: 8 Okt 2027 - countdown ke 9 Okt 2027, usia ke-36"),
    ("2027-10-09T12:00:00+07:00", "Hari H 2027: 9 Okt 2027 - hari ulang tahun, usia ke-36"),
    ("2028-01-01T00:00:00+07:00", "Tahun baru 2028: sudah lewat ultah 2027, target 9 Okt 2028, usia ke-37"),
    ("2030-05-15T08:00:00+07:00", "Tengah 2030: target 9 Okt 2030, usia ke-39"),
]

print("=== VERIFIKASI LOGIKA COUNTDOWN + AUTO-INCREMENT ===\n")
all_pass = True
for now_iso, desc in tests:
    r = get_birthday_state(now_iso)
    print(f"Input: {now_iso}")
    print(f"  Skenario: {desc}")
    print(f"  isBirthdayToday: {r['is_birthday_today']}")
    print(f"  nextBirthday:    {r['next_birthday']}")
    print(f"  nextAge:         {r['next_age_roman']}")
    print()
    # Verifikasi ekspektasi kunci
    if "hari ulang tahun" in desc.lower() and not r["is_birthday_today"]:
        print(f"  ❌ FAIL: seharusnya isBirthdayToday=True")
        all_pass = False
    if "auto-increment" in desc.lower():
        if r["next_age"] != 36:
            print(f"  ❌ FAIL: seharusnya next_age=36")
            all_pass = False
        if "2027" not in r["next_birthday"]:
            print(f"  ❌ FAIL: seharusnya next_birthday di 2027")
            all_pass = False

if all_pass:
    print("✅ SEMUA SKENARIO LOLOS - logika countdown + auto-increment benar")
else:
    print("❌ ADA SKENARIO GAGAL")
