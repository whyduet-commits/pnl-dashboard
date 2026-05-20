import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 페이지네이션으로 전체 데이터 가져오기
async function fetchAll(query: any) {
  const PAGE = 1000;
  let from = 0;
  let all: any[] = [];
  while (true) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    all = [...all, ...data];
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year       = searchParams.get("year");
  const academy    = searchParams.get("academy");
  const hq         = searchParams.get("hq");
  const area       = searchParams.get("area");
  const courseType = searchParams.get("course_type");
  const filterOnly = searchParams.get("filter_only");

  // ── 필터 옵션 — 전체 고유값 조회 (페이지네이션 적용) ──────
  const allMeta = await fetchAll(
    supabase.from("sales_daily").select("hq, academy, area, course_type")
  );

  const hqList = [...new Set(allMeta.map((r:any)=>r.hq).filter(Boolean))].sort();

  const academyFiltered = allMeta.filter((r:any) =>
    !hq || hq === "전체" ? true : r.hq === hq
  );
  const academyList    = [...new Set(academyFiltered.map((r:any)=>r.academy).filter(Boolean))].sort();
  const areaList       = [...new Set(allMeta.map((r:any)=>r.area).filter(Boolean))].sort();
  const courseTypeList = [...new Set(allMeta.map((r:any)=>r.course_type).filter(Boolean))].sort();

  if (filterOnly === "1") {
    return NextResponse.json({ filters: { hqList, academyList, areaList, courseTypeList } });
  }

  // ── 실제 데이터 조회 (페이지네이션 적용) ──────────────────
  let query = supabase
    .from("sales_daily")
    .select("year, month, month_label, academy, hq, area, course_type, instructor, student_count");

  if (year)                                query = query.eq("year", Number(year));
  if (academy && academy !== "전체")       query = query.eq("academy", academy);
  if (hq      && hq      !== "전체")       query = query.eq("hq", hq);
  if (area    && area    !== "전체")        query = query.eq("area", area);
  if (courseType && courseType !== "전체") query = query.eq("course_type", courseType);

  const data = await fetchAll(query);

  // ── 월별 집계 ─────────────────────────────────────────────
  const monthly: Record<string, any> = {};
  for (const row of data) {
    const key = `${row.year}-${String(row.month).padStart(2,"0")}`;
    if (!monthly[key]) {
      monthly[key] = { year:row.year, month:row.month, month_label:row.month_label, total:0, instructors:{} };
    }
    monthly[key].total += row.student_count ?? 0;
    if (row.instructor) {
      monthly[key].instructors[row.instructor] =
        (monthly[key].instructors[row.instructor] ?? 0) + (row.student_count ?? 0);
    }
  }

  // ── 강사별 집계 ───────────────────────────────────────────
  const byInstructor: Record<string, any> = {};
  for (const row of data) {
    if (!row.instructor) continue;
    if (!byInstructor[row.instructor]) byInstructor[row.instructor] = { total:0, monthly:{} };
    const key = `${row.year}-${String(row.month).padStart(2,"0")}`;
    byInstructor[row.instructor].total += row.student_count ?? 0;
    byInstructor[row.instructor].monthly[key] =
      (byInstructor[row.instructor].monthly[key] ?? 0) + (row.student_count ?? 0);
  }

  return NextResponse.json({
    monthly:     Object.values(monthly).sort((a:any,b:any) => a.year!==b.year ? a.year-b.year : a.month-b.month),
    byInstructor,
    filters:     { hqList, academyList, areaList, courseTypeList },
  });
}