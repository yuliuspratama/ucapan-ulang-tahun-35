#!/usr/bin/env python3
"""Verifikasi logika getBirthdayState dari script.js (countdown + auto-increment + deteksi hari-H).

Mengimplementasikan algoritma yang SAMA PERSIS dengan script.js dalam Python —
termasuk cara script.js membaca komponen kalender dari lahirISO — untuk
memastikan perhitungan benar di berbagai skenario tanggal.

Sejarah bug yang dijaga test ini: dulu script.js memakai born.getUTCDate()
pada lahirISO beroffset +07:00, yang menghasilkan 8 (bukan 9) karena
1991-10-09T00:00+07:00 = 1991-10-08T17:00Z → countdown salah target
8 Oktober. Test lama tidak menangkapnya karena hardcode (10, 9).
"""
from datetime import datetime, timezone, timedelta

WIB = timezone(timedelta(hours=7))
WITA = timezone(timedelta(hours=8))
BORN_ISO = "1991-10-09T00:00:00+07:00"

def get_birthday_state(now_utc: datetime):
    """Meniru getBirthdayState() di script.js langkah demi langkah."""
    born = datetime.fromisoformat(BORN_ISO)
    assert born.astimezone(timezone.utc).isoformat() == "1991-10-08T17:00:00+00:00"

    # script.js: bornWIB = born.getTime() + 7h; lalu getUTC* (komponen kalender WIB)
    born_wib = born.astimezone(WIB)
    bd_month = born_wib.month        # harus 10 (Oktober)
    bd_date = born_wib.day           # harus 9 — getUTCDate() mentah akan memberi 8!
    bd_year = born_wib.year          # 1991

    # script.js: nowWIB = now.getTime() + 7h; komponen kalender WIB
    now = now_utc.astimezone(timezone.utc)
    now_wib = now.astimezone(WIB)
    today_month = now_wib.month
    today_date = now_wib.day
    today_year_wib = now_wib.year

    is_birthday_today = (today_month == bd_month and today_date == bd_date)

    next_year = today_year_wib
    already_passed = (today_month > bd_month) or (today_month == bd_month and today_date > bd_date)
    if already_passed:
        next_year = today_year_wib + 1

    # Date.UTC(nextYear, bdMonth, bdDate, 0,0,0) - 7h  →  9 Okt nextYear 00:00 WIB
    next_birthday = datetime(next_year, bd_month, bd_date, 0, 0, 0, tzinfo=WIB)
    next_age = next_year - bd_year
    return {
        "is_birthday_today": is_birthday_today,
        "next_birthday": next_birthday,
        "next_age": next_age,
        "next_age_roman": f"ke-{next_age}",
    }

# Test scenarios: (now_utc, deskripsi, cek-ekspetasi)
tests = [
    (datetime(2026, 10, 6, 5, 0, tzinfo=timezone.utc), "H-3: 6 Okt 2026 12:00 WIB - countdown ke 9 Okt 2026, usia ke-35",
     dict(birthday=False, next="2026-10-09", age=35)),
    (datetime(2026, 10, 8, 17, 0, tzinfo=timezone.utc), "Hari H tepat: 9 Okt 2026 00:00 WIB - hari ulang tahun, usia ke-35",
     dict(birthday=True, next="2026-10-09", age=35)),
    (datetime(2026, 10, 9, 16, 59, tzinfo=timezone.utc), "Hari H malam: 9 Okt 2026 23:59 WIB - masih hari ulang tahun",
     dict(birthday=True, next="2026-10-09", age=35)),
    (datetime(2026, 10, 9, 17, 1, tzinfo=timezone.utc), "H+1: 10 Okt 2026 00:01 WIB - sudah lewat, auto-increment ke 2027, usia ke-36",
     dict(birthday=False, next="2027-10-09", age=36)),
    # KRITIS: bug lama (bdDate=8) akan menganggap 8 Okt sebagai hari-H
    # dan countdown meleset satu hari.
    (datetime(2026, 10, 7, 16, 59, tzinfo=timezone.utc), "BUG-GUARD: 7 Okt 23:59 WIB - BUKAN hari ulang tahun, countdown masih ke 9 Okt 2026",
     dict(birthday=False, next="2026-10-09", age=35)),
    (datetime(2026, 10, 8, 23, 59, tzinfo=timezone.utc), "BUG-GUARD: 9 Okt 06:59 WIB pagi - hari ulang tahun",
     dict(birthday=True, next="2026-10-09", age=35)),
    (datetime(2026, 10, 9, 17, 0, tzinfo=timezone.utc), "BUG-GUARD: 10 Okt 00:00 WIB tepat - sudah lewat, auto-increment",
     dict(birthday=False, next="2027-10-09", age=36)),
    (datetime(2027, 10, 8, 5, 0, tzinfo=timezone.utc), "H-1 ultah 2027: 8 Okt 2027 12:00 WIB - countdown ke 9 Okt 2027, usia ke-36",
     dict(birthday=False, next="2027-10-09", age=36)),
    (datetime(2027, 10, 9, 5, 0, tzinfo=timezone.utc), "Hari H 2027: 9 Okt 2027 12:00 WIB - hari ulang tahun, usia ke-36",
     dict(birthday=True, next="2027-10-09", age=36)),
    (datetime(2027, 12, 31, 17, 0, tzinfo=timezone.utc), "Tahun baru 2028: sudah lewat ultah 2027, target 9 Okt 2028, usia ke-37",
     dict(birthday=False, next="2028-10-09", age=37)),
    (datetime(2030, 5, 15, 1, 0, tzinfo=timezone.utc), "Tengah 2030: target 9 Okt 2030, usia ke-39",
     dict(birthday=False, next="2030-10-09", age=39)),
    # Uji pembacaan komponen kalender: 8 Okt 2026 18:00 UTC = 9 Okt 01:00 WIB = 9 Okt 02:00 WITA
    (datetime(2026, 10, 8, 18, 0, tzinfo=timezone.utc), "CROSS-ZONE: 9 Okt 01:00 WIB / 02:00 WITA - hari ulang tahun di kedua zona",
     dict(birthday=True, next="2026-10-09", age=35)),
]

print("=== VERIFIKASI LOGIKA COUNTDOWN + AUTO-INCREMENT ===\n")
all_pass = True
for now_utc, desc, expect in tests:
    r = get_birthday_state(now_utc)
    ok = True
    if r["is_birthday_today"] != expect["birthday"]:
        ok = False
        print(f"  ❌ FAIL isBirthdayToday={r['is_birthday_today']}, ekspektasi {expect['birthday']}")
    if not r["next_birthday"].isoformat().startswith(expect["next"]):
        ok = False
        print(f"  ❌ FAIL nextBirthday={r['next_birthday'].isoformat()}, ekspektasi {expect['next']}")
    if r["next_age"] != expect["age"]:
        ok = False
        print(f"  ❌ FAIL nextAge={r['next_age']}, ekspektasi {expect['age']}")

    if not ok:
        all_pass = False
    wib = now_utc.astimezone(WIB).strftime("%d %b %Y %H:%M")
    wita = now_utc.astimezone(WITA).strftime("%H:%M")
    print(f"{'✅' if ok else '❌'} {desc}")
    print(f"   now={now_utc.isoformat()} (WIB {wib} / WITA {wita})")
    print(f"   → isBirthday={r['is_birthday_today']}, target={r['next_birthday'].astimezone(WIB).isoformat()}, usia={r['next_age_roman']}")
    print()

# Verifikasi tambahan: target dalam WITA
target = get_birthday_state(datetime(2026, 10, 7, 8, 0, tzinfo=timezone.utc))
tw = target["next_birthday"].astimezone(WITA)
print(f"Target dalam WITA: {tw.isoformat()} (harus 9 Okt 01:00 WITA)")
if tw == datetime(2026, 10, 9, 1, 0, 0, tzinfo=WITA):
    print("✅ Konversi WITA benar")
else:
    print("❌ Konversi WITA SALAH")
    all_pass = False

print()
if all_pass:
    print("✅ SEMUA SKENARIO LOLOS - logika countdown + auto-increment benar")
    raise SystemExit(0)
print("❌ ADA SKENARIO GAGAL")
raise SystemExit(1)
