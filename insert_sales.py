import pandas as pd
import requests
import json
import re
import glob
import os

# ── 설정 ──────────────────────────────────────────────────────
SUPABASE_URL = "https://jaaluihlmvkqkqqwmbey.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphYWx1aWhsbXZrcWtxcXdtYmV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc1MzMzMCwiZXhwIjoyMDkzMzI5MzMwfQ.sUiPOe2kTIhZ0mW8P_Pcx1wFevlswDnNpzC1_tUluNo"

# 데이터 폴더 — 모든 xlsm 파일 자동 처리
DATA_FOLDER = r"C:\Users\whydu\Desktop\data-upload"

# ── 월 변환 ───────────────────────────────────────────────────
MONTH_MAP = {
    "1월":1, "2월":2, "3월":3, "4월":4, "5월":5, "6월":6,
    "7월":7, "8월":8, "9월":9, "10월":10, "11월":11, "12월":12,
    "썸머특강":7, "추석특강":9,
}

# ── 수업시간 파싱 → 요일/시간대 ──────────────────────────────
DAY_MAP = {"월":"MON","화":"TUE","수":"WED","목":"THU","금":"FRI","토":"SAT","일":"SUN"}

def parse_class_time(text):
    """
    "수 09:00~12:00  금 09:00~12:00" 형태 파싱
    → [{"day":"WED","time_slot":"오전"}, {"day":"FRI","time_slot":"오전"}]
    시간대 기준: 10:00 포함 → 오전 / 14:30 포함 → 오후 / 19:30 포함 → 저녁
    """
    if not text or str(text).strip() == "-":
        return []

    results = []
    # "요일 HH:MM~HH:MM" 패턴 추출
    pattern = r"([월화수목금토일])\s*(\d{1,2}):(\d{2})~(\d{1,2}):(\d{2})"
    matches = re.findall(pattern, str(text))

    for match in matches:
        day_kr, sh, sm, eh, em = match
        start_h, start_m = int(sh), int(sm)
        end_h,   end_m   = int(eh), int(em)

        # 시간대 판별 (해당 시간 범위에 기준 시각이 포함되는지)
        def in_range(h, m):
            t = h * 60 + m
            s = start_h * 60 + start_m
            e = end_h   * 60 + end_m
            return s <= t <= e

        if   in_range(10,  0): slot = "오전"
        elif in_range(14, 30): slot = "오후"
        elif in_range(19, 30): slot = "저녁"
        else:                  slot = "오전"   # 기본값

        results.append({
            "day":       DAY_MAP.get(day_kr, day_kr),
            "day_kr":    day_kr,
            "time_slot": slot,
        })

    return results

def parse_fee(text):
    """"675,000 원" → 675000"""
    if not text or str(text).strip() == "-":
        return None
    nums = re.sub(r"[^\d]", "", str(text))
    return int(nums) if nums else None

# ── 메인 ─────────────────────────────────────────────────────
all_files = glob.glob(os.path.join(DATA_FOLDER, "*.xlsm")) + \
            glob.glob(os.path.join(DATA_FOLDER, "*.xlsx"))

# 단과판매현황 파일만 처리
files = [f for f in all_files if "단과판매" in os.path.basename(f)]

if not files:
    print(f"[오류] {DATA_FOLDER} 에서 엑셀 파일을 찾을 수 없습니다.")
    exit(1)

print(f"처리할 파일 {len(files)}개:")
for f in files:
    print(f"  - {os.path.basename(f)}")
print()

rows_to_insert = []

for filepath in files:
    print(f"읽는 중: {os.path.basename(filepath)}")
    df = pd.read_excel(filepath, engine="openpyxl")

    for _, row in df.iterrows():
        year     = int(row["년도"])
        month_str = str(row["과정"]).strip()
        month    = MONTH_MAP.get(month_str)

        if month is None:
            continue  # 알 수 없는 과정 스킵

        academy  = str(row["학원"]).strip()
        hq       = str(row["본부"]).strip()
        category = str(row["반분류"]).strip()
        course_type = str(row["강좌구분"]).strip()
        series   = str(row["계열"]).strip()
        code     = str(row["강좌코드"]).strip()
        area     = str(row["영역"]).strip()
        grade    = str(row["학년"]).strip()
        subject  = str(row["과목"]).strip()
        subj_det = str(row["선택과목"]).strip() if pd.notna(row["선택과목"]) else ""
        course_name = str(row["강좌명"]).strip()
        instructor  = str(row["강사"]).strip()
        sessions = int(row["회차"]) if pd.notna(row["회차"]) else None
        fee      = parse_fee(row["수강료"])
        fee_ps   = parse_fee(row["1회차 기준 수강료"])
        class_time = str(row["수업시간"]).strip() if pd.notna(row["수업시간"]) else ""

        # 판매상태 → 숫자 변환
        sales_raw = str(row["판매"]).strip()
        try:
            sales_count = int(sales_raw)
        except:
            sales_count = 0

        student_count = int(row["완납&분납수강생수"]) if pd.notna(row["완납&분납수강생수"]) else 0

        # 수업시간 파싱 → JSON 저장
        parsed_time = parse_class_time(class_time)
        class_time_json = json.dumps(parsed_time, ensure_ascii=False)

        rows_to_insert.append({
            "year":            year,
            "month":           month,
            "month_label":     month_str,
            "academy":         academy,
            "hq":              hq,
            "category":        category,
            "course_type":     course_type,
            "series":          series,
            "course_code":     code,
            "area":            area,
            "grade":           grade,
            "subject":         subject,
            "subject_detail":  subj_det,
            "course_name":     course_name,
            "instructor":      instructor,
            "sessions":        sessions,
            "fee":             fee,
            "fee_per_session": fee_ps,
            "class_time":      class_time,
            "class_time_parsed": class_time_json,
            "sales_count":     sales_count,
            "student_count":   student_count,
        })

print(f"적재 예정: {len(rows_to_insert)}건\n")

# ── Supabase upsert ───────────────────────────────────────────
headers = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "resolution=merge-duplicates",
}

BATCH = 100
success = 0
for i in range(0, len(rows_to_insert), BATCH):
    batch = rows_to_insert[i:i+BATCH]
    res = requests.post(
        f"{SUPABASE_URL}/rest/v1/sales_daily",
        headers=headers,
        data=json.dumps(batch),
    )
    if res.status_code in (200, 201):
        success += len(batch)
        print(f"  ✅ {i+1}~{i+len(batch)}건 완료")
    else:
        print(f"  ❌ 오류 ({i+1}~{i+len(batch)}): {res.status_code}")
        print(f"     {res.text[:200]}")

print(f"\n적재 완료! 총 {success}건")
