import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instructor = searchParams.get("instructor");
  const area       = searchParams.get("area");
  const subject    = searchParams.get("subject");
  const yearFrom   = searchParams.get("year_from") ?? "2025";
  const yearTo     = searchParams.get("year_to")   ?? "2026";

  // 강사 목록 (필터용)
  // 전체 강사 목록은 필터 없이 조회 (검색 기능에서 누락 방지)
// range로 전체 페이징 처리
const fetchAll = async () => {
  const pageSize = 1000;
  let from = 0;
  let all: any[] = [];
  while (true) {
    const { data: chunk } = await supabase
      .from("sales_daily")
      .select("instructor, area, subject")
      .range(from, from + pageSize - 1);
    if (!chunk || chunk.length === 0) break;
    all = all.concat(chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return all;
};
const allData = await fetchAll();
const instructorList = [...new Set((allData??[]).map((r:any)=>r.instructor).filter(Boolean))].sort();
const areaList       = [...new Set((allData??[]).map((r:any)=>r.area).filter(Boolean))].sort();
const subjectList    = [...new Set((allData??[]).map((r:any)=>r.subject).filter(Boolean))].sort();

  if (!instructor) {
    return NextResponse.json({ instructorList, areaList, subjectList, data:[] });
  }

  // 강사 상세 데이터
  const { data, error } = await supabase
    .from("sales_daily")
    .select("*")
    .eq("instructor", instructor)
    .gte("year", Number(yearFrom))
    .lte("year", Number(yearTo))
    .order("year", { ascending: true })
    .order("month", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 시간표용 2026년 데이터 별도 조회
  const { data: data2026 } = await supabase
    .from("sales_daily")
    .select("*")
    .eq("instructor", instructor)
    .eq("year", 2026);

  // 시간표 파싱 (class_time_parsed JSON)
  const timetable: Record<string, Record<string, string[]>> = {};
  const DAYS = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
  const SLOTS = ["오전","오후","저녁"];
  DAYS.forEach(d => { timetable[d] = {}; SLOTS.forEach(s => { timetable[d][s] = []; }); });

  for (const row of data2026 ?? []) {
    if (!row.class_time_parsed) continue;
    try {
      const parsed = JSON.parse(row.class_time_parsed);
      for (const item of parsed) {
        const { day, time_slot } = item;
        if (timetable[day]?.[time_slot]) {
          const acad = row.academy.replace("러셀 ","");
          if (!timetable[day][time_slot].includes(acad)) {
            timetable[day][time_slot].push(acad);
          }
        }
      }
    } catch {}
  }

  // 월별 집계
  const monthly: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = `${row.year}-${String(row.month).padStart(2,"0")}`;
    monthly[key] = (monthly[key] ?? 0) + (row.student_count ?? 0);
  }

  // KPI
  const total = (data??[]).reduce((s,r:any) => s+(r.student_count??0), 0);
  const academies = [...new Set((data??[]).map((r:any)=>r.academy))];
  const latestMonth = Object.keys(monthly).sort().pop();
  const prevMonth   = Object.keys(monthly).sort().slice(-2,-1)[0];
  const latestVal   = latestMonth ? monthly[latestMonth] : 0;
  const prevVal     = prevMonth   ? monthly[prevMonth]   : 0;

  return NextResponse.json({
    instructorList, areaList, subjectList,
    data: data ?? [],
    timetable,
    monthly,
    kpi: { total, academies, latestMonth, latestVal, prevVal },
  });
}
