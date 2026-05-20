// src/app/api/pnl/academy/route.ts
// GET /api/pnl/academy?year=2026&hq1=전체&hq2=전체
// → 학원별 실적 비교 테이블 데이터

import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ORG_NAMES: Record<number, string> = {
  2: "강남", 3: "목동", 4: "분당", 5: "대구", 6: "대전",
  7: "최상위권", 8: "남학생", 9: "여학생", 10: "종합관", 11: "대치",
};
const ORG_HQ1: Record<number, string> = {
  2:"중점본부",3:"중점본부",4:"중점본부",5:"중점본부",6:"중점본부",
  7:"중점본부",8:"중점본부",9:"중점본부",10:"중점본부",11:"대치본부",
};
const ORG_HQ2: Record<number, string> = {
  2:"시내",3:"시내",4:"시내",5:"시내",6:"시내",
  7:"기숙",8:"기숙",9:"기숙",10:"기숙",11:"대치",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year") ?? 2026);
  const hq1  = searchParams.get("hq1") ?? "전체";
  const hq2  = searchParams.get("hq2") ?? "전체";

  const labelCurr = `${year}년`;
  const labelPrev = `${year - 1}년`;
  const labelPlan = `${year} 사업계획`;

  // 필터링할 org_id 목록
  const orgIds = Object.keys(ORG_NAMES).map(Number).filter((id) => {
    if (hq1 !== "전체" && ORG_HQ1[id] !== hq1) return false;
    if (hq2 !== "전체" && ORG_HQ2[id] !== hq2) return false;
    return true;
  });

  const { data, error } = await supabaseAdmin
    .from("pnl_fact_annual_total")
    .select("org_id, account_id, scenario_label, value")
    .in("org_id", orgIds)
    .in("account_id", [1, 285])
    .in("scenario_label", [labelCurr, labelPrev, labelPlan]);

  if (error) return NextResponse.json({ error }, { status: 500 });

  // org_id × account_id × scenario_label 값 추출
  const get = (orgId: number, accountId: number, label: string): number => {
    const row = (data ?? []).find(
      (r: any) => r.org_id === orgId && r.account_id === accountId && r.scenario_label === label
    );
    return row ? Number(row.value) : 0;
  };

  const eok = (v: number) => Math.round(v / 1e8 * 10) / 10;
  const pct = (a: number, b: number) => b ? Math.round((a / b) * 1000) / 10 : null;

  const rows = orgIds.map((orgId) => {
    const revCurr = get(orgId, 1,   labelCurr);
    const revPrev = get(orgId, 1,   labelPrev);
    const revPlan = get(orgId, 1,   labelPlan);
    const op2Curr = get(orgId, 285, labelCurr);

    return {
      org_id:      orgId,
      name:        ORG_NAMES[orgId],
      hq1:         ORG_HQ1[orgId],
      hq2:         ORG_HQ2[orgId],
      revenue:     eok(revCurr),
      yoy:         revPrev ? pct(revCurr - revPrev, revPrev) : null,
      target_rate: revPlan ? pct(revCurr, revPlan)           : null,
      op_margin:   revCurr ? Math.round((op2Curr / revCurr) * 1000) / 10 : null,
    };
  })
  .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
  .map((row, i) => ({ ...row, rank: i + 1 }));

  // 합계 행
  const totalRevCurr = orgIds.reduce((s, id) => s + get(id, 1,   labelCurr), 0);
  const totalRevPrev = orgIds.reduce((s, id) => s + get(id, 1,   labelPrev), 0);
  const totalRevPlan = orgIds.reduce((s, id) => s + get(id, 1,   labelPlan), 0);
  const totalOp2     = orgIds.reduce((s, id) => s + get(id, 285, labelCurr), 0);

  const total = {
    org_id: 0, name: "합계", hq1: "", hq2: "",
    revenue:     eok(totalRevCurr),
    yoy:         totalRevPrev ? pct(totalRevCurr - totalRevPrev, totalRevPrev) : null,
    target_rate: totalRevPlan ? pct(totalRevCurr, totalRevPlan)                : null,
    op_margin:   totalRevCurr ? Math.round((totalOp2 / totalRevCurr) * 1000) / 10 : null,
    rank: -1,
  };

  return NextResponse.json({ year, rows, total });
}