// C:\pnl-dashboard\src\app\api\admission\route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAJOR_UNIV = ["서울대","연세대(서울)","성균관대","가톨릭대(성의)","울산대","고려대(안암)"];
const SKY        = ["서울대","연세대(서울)","고려대(안암)"];

const ORG_MAP: Record<string,{hq1:string;hq2:string}> = {
  "강남":           { hq1:"중점본부", hq2:"시내" },
  "목동":           { hq1:"중점본부", hq2:"시내" },
  "분당":           { hq1:"중점본부", hq2:"시내" },
  "대구":           { hq1:"중점본부", hq2:"시내" },
  "대전":           { hq1:"중점본부", hq2:"시내" },
  "최상위권 전문관": { hq1:"중점본부", hq2:"기숙" },
  "남학생":         { hq1:"중점본부", hq2:"기숙" },
  "여학생":         { hq1:"중점본부", hq2:"기숙" },
  "종합관":         { hq1:"중점본부", hq2:"기숙" },
};

// 전체 데이터 페이지네이션으로 가져오기
async function fetchAll(query: any): Promise<any[]> {
  const PAGE = 1000;
  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function categorize(row: any): string[] {
  const cats: string[] = [];
  // 공백 trim 처리
  const g2 = (row.univ_group2 ?? "").trim();
  const u  = (row.university   ?? "").trim();
  const g  = (row.univ_group   ?? "").trim();

  if (u === "서울대" && g2 === "의예과") cats.push("cat1");
  if (MAJOR_UNIV.includes(u) && g2 === "의예과") cats.push("cat2");
  if (g2 === "의예과") cats.push("cat3");
  if (["의예과","치의예과","한의예과","수의예과","약학과"].includes(g2)) cats.push("cat4");
  if (SKY.includes(u) || ["KAIST","포항공대"].includes(g2)) cats.push("cat5");
  if (g === "서성한이") cats.push("cat6");
  if (g === "중경외시") cats.push("cat7");
  if (cats.length === 0) cats.push("cat8");

  return cats;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const hq1    = searchParams.get("hq1") ?? "전체";
  const hq2    = searchParams.get("hq2") ?? "전체";
  const academy= searchParams.get("academy") ?? "전체";

  let data: any[];
  try {
    // ✅ 페이지네이션으로 전체 데이터 조회
    data = await fetchAll(
      supabase
        .from("admission_results")
        .select("year,academy,university,univ_group,univ_group2")
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  // 학원/본부/부문 필터
  const filtered = data.filter((r: any) => {
    const ac  = (r.academy ?? "").trim();
    const org = ORG_MAP[ac] ?? { hq1:"기타", hq2:"기타" };
    if (academy !== "전체" && ac !== academy.trim()) return false;
    if (academy === "전체") {
      if (hq2 !== "전체" && org.hq2 !== hq2) return false;
      if (hq1 !== "전체" && hq2 === "전체" && org.hq1 !== hq1) return false;
    }
    return true;
  });

  // 연도별 × 카테고리별 집계
  const years = [2021,2022,2023,2024,2025,2026];
  const cats  = ["cat1","cat2","cat3","cat4","cat5","cat6","cat7","cat8"];

  const countMap: Record<number, Record<string,number>> = {};
  years.forEach(y => { countMap[y] = {}; cats.forEach(c => { countMap[y][c] = 0; }); });

  filtered.forEach((r: any) => {
    const y = Number(r.year);
    if (!years.includes(y)) return;
    categorize(r).forEach(c => { countMap[y][c]++; });
  });

  // KPI: 전체 학원 2026년 기준 (필터 완전 무시)
  const kpi: Record<string,number> = {};
  cats.forEach(c => { kpi[c] = 0; });
  data
    .filter((r: any) => Number(r.year) === 2026)
    .forEach((r: any) => { categorize(r).forEach(c => { kpi[c]++; }); });

  // 학원 목록 (전체 데이터 기준)
  const academyList = [...new Set(
    data.map((r: any) => (r.academy ?? "").trim()).filter(Boolean)
  )].sort() as string[];

  // 디버그: 개발 중 확인용 (배포 시 제거)
  console.log(`[admission] total=${data.length}, filtered=${filtered.length}, academies=${academyList.length}`);

  return NextResponse.json({ countMap, kpi, academyList });
}