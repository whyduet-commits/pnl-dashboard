import csv
import requests
import json

SUPABASE_URL = "https://jaaluihlmvkqkqqwmbey.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphYWx1aWhsbXZrcWtxcXdtYmV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc1MzMzMCwiZXhwIjoyMDkzMzI5MzMwfQ.sUiPOe2kTIhZ0mW8P_Pcx1wFevlswDnNpzC1_tUluNo"

CSV_PATH = "registration_status_10_academies_web_data.csv"

ORG_MAP = {
    "강남": 2,
    "목동": 3,
    "분당": 4,
    "대구": 5,
    "대전": 6,
    "최상위권 전문관": 7,
    "남학생 전문관": 8,
    "여학생 전문관": 9,
    "기숙 종합관": 10,
}

DISPLAY_NAME = {
    "여학생 전문관": "여학생(+여수)",
}

def safe_int(v):
    try:
        return int(float(v)) if v and v.strip() else 0
    except:
        return 0

def safe_float(v):
    try:
        return float(v) if v and v.strip() else None
    except:
        return None

rows_to_insert = []

with open(CSV_PATH, encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row in reader:
        academy = row["학원명"].strip()
        if academy == "여학생 수학전문관":
            continue
        org_id = ORG_MAP.get(academy)
        if not org_id:
            print(f"[SKIP] org_id 없음: {academy}")
            continue
        display = DISPLAY_NAME.get(academy, academy)
        if academy == "여학생 전문관":
            total_cur = safe_int(row["올해_총인원_원본열"])
        else:
            total_cur = safe_int(row["올해_총인원"])
        rows_to_insert.append({
            "record_date": row["기준일"].strip(),
            "org_id": org_id,
            "academy_name": display,
            "students_cur": safe_int(row["올해_재학생"]),
            "nsu_cur": safe_int(row["올해_N수"]),
            "total_cur": total_cur,
            "students_prev": safe_int(row["전년_재학생"]),
            "nsu_prev": safe_int(row["전년_N수"]),
            "total_prev": safe_int(row["전년_총인원"]),
            "students_tgt": safe_int(row["목표_재학생"]),
            "nsu_tgt": safe_int(row["목표_N수"]),
            "total_tgt": safe_int(row["목표_총인원"]),
            "achievement_rate": safe_float(row["목표달성률_총원"]),
            "yoy_total_diff": safe_int(row["전년대비_총원_증감"]),
            "yoy_total_rate": safe_float(row["전년대비_총원_증감률"]),
        })

print(f"적재 예정: {len(rows_to_insert)}건")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}

BATCH = 50
for i in range(0, len(rows_to_insert), BATCH):
    batch = rows_to_insert[i:i+BATCH]
    res = requests.post(
        f"{SUPABASE_URL}/rest/v1/enrollment_daily",
        headers=headers,
        data=json.dumps(batch),
    )
    if res.status_code in (200, 201):
        print(f"  ✅ {i+1}~{i+len(batch)}건 완료")
    else:
        print(f"  ❌ 오류: {res.status_code} {res.text}")

print("적재 완료!")