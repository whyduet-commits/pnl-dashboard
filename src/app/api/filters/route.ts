// src/app/api/filters/route.ts
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data: orgs } = await supabaseAdmin
    .from("dim_organization")
    .select("org_id, academy, academy_type, is_aggregate, hq_level1, hq_level2")
    .order("org_id");

  // 연도 목록: scenario_label 하드코딩 없이 account_id=1(매출) 기준으로 실존 연도 조회
  const { data: yearRows } = await supabaseAdmin
    .from("pnl_fact_annual_total")
    .select("year")
    .eq("org_id", 1)
    .eq("account_id", 1)
    .gte("year", 2021)
    .order("year", { ascending: false });

  const scenarios = [
    { value: "actual", label: "실적"     },
    { value: "plan",   label: "사업계획" },
    { value: "target", label: "개선목표" },
  ];

  const uniqueYears = [...new Set((yearRows ?? []).map((r: any) => Number(r.year)))];

  const hq1List = [...new Set((orgs ?? [])
    .filter((o: any) => o.is_aggregate === 0)
    .map((o: any) => o.hq_level1))];

  const hq2List = [...new Set((orgs ?? [])
    .filter((o: any) => o.is_aggregate === 0)
    .map((o: any) => o.hq_level2))];

  const academyList = (orgs ?? [])
    .filter((o: any) => o.is_aggregate === 0)
    .map((o: any) => ({
      org_id:       o.org_id,
      academy:      o.academy,
      academy_type: o.academy_type,
      hq_level1:    o.hq_level1,
      hq_level2:    o.hq_level2,
    }));

  return NextResponse.json({ years: uniqueYears, scenarios, hq1List, hq2List, academyList });
}