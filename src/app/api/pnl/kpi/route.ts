// src/app/api/pnl/kpi/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);  

const ACCOUNT = { REVENUE: 1, OP_PROFIT2: 285 };

// 본부/부문 → org_id 목록 매핑
const ORG_MAP: Record<string, number[]> = {
  "전체":    [1],          // 계(합산) 단일 row
  "중점본부": [2,3,4,5,6,7,8,9,10],
  "대치본부": [11],
  "시내":    [2,3,4,5,6],
  "기숙":    [7,8,9,10],
  "대치":    [11],
};

function eok(v: number): number {
  return Math.round(v / 1e8 * 10) / 10;
}
function ratePct(a: number, b: number): number | null {
  if (!b) return null;
  return Math.round((a / b) * 100 * 10) / 10;
}
function yoyPct(curr: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round((curr - prev) / Math.abs(prev) * 1000) / 10;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year    = Number(searchParams.get("year")   ?? 2026);
  const orgId   = Number(searchParams.get("org_id") ?? 1);
  const hq1     = searchParams.get("hq1")  ?? "전체";
  const hq2     = searchParams.get("hq2")  ?? "전체";

  // org_id 목록 결정
  let orgIds: number[];
  if (orgId !== 1) {
    // 특정 학원이 선택된 경우
    orgIds = [orgId];
  } else if (hq2 !== "전체") {
    // 부문 선택
    orgIds = ORG_MAP[hq2] ?? [1];
  } else if (hq1 !== "전체") {
    // 본부 선택
    orgIds = ORG_MAP[hq1] ?? [1];
  } else {
    // 전체 → org_id=1 (계) 사용
    orgIds = [1];
  }

  const labelActual = `${year}년`;
  const labelPlan   = `${year} 사업계획`;
  const labelTarget = `${year} 개선목표`;
  const labelPrev   = `${year - 1}년`;

  // 데이터 조회
  const { data, error } = await supabaseAdmin
    .from("pnl_fact_annual_total")
    .select("org_id, account_id, scenario_label, value")
    .in("org_id", orgIds)
    .in("account_id", [ACCOUNT.REVENUE, ACCOUNT.OP_PROFIT2])
    .in("scenario_label", [labelActual, labelPlan, labelTarget, labelPrev]);

  if (error) return NextResponse.json({ error }, { status: 500 });

  // org_id × account_id × scenario_label 합산
  const sum = (accountId: number, label: string): number =>
    (data ?? [])
      .filter((r: any) => r.account_id === accountId && r.scenario_label === label)
      .reduce((acc: number, r: any) => acc + Number(r.value || 0), 0);

  const revA  = sum(ACCOUNT.REVENUE,    labelActual);
  const revP  = sum(ACCOUNT.REVENUE,    labelPlan);
  const revT  = sum(ACCOUNT.REVENUE,    labelTarget);
  const revPr = sum(ACCOUNT.REVENUE,    labelPrev);
  const op2A  = sum(ACCOUNT.OP_PROFIT2, labelActual);
  const op2P  = sum(ACCOUNT.OP_PROFIT2, labelPlan);
  const op2T  = sum(ACCOUNT.OP_PROFIT2, labelTarget);
  const op2Pr = sum(ACCOUNT.OP_PROFIT2, labelPrev);

  const opRateA  = revA  ? op2A  / revA  * 100 : 0;
  const opRateP  = revP  ? op2P  / revP  * 100 : 0;
  const opRatePr = revPr ? op2Pr / revPr * 100 : 0;

  return NextResponse.json({
    year, orgIds,
    revenue: {
      actual:      eok(revA),
      plan:        revP  ? eok(revP)  : null,
      target:      revT  ? eok(revT)  : null,
      prev:        eok(revPr),
      achievement: revP  ? ratePct(revA, revP)  : null,
      yoy:         revPr ? yoyPct(revA, revPr)  : null,
      yoyAbs:      eok(revA - revPr),
    },
    op_profit2: {
      actual:      eok(op2A),
      plan:        op2P  ? eok(op2P)  : null,
      target:      op2T  ? eok(op2T)  : null,
      prev:        eok(op2Pr),
      achievement: op2P  ? ratePct(op2A, op2P)  : null,
      yoy:         op2Pr ? yoyPct(op2A, op2Pr)  : null,
      yoyAbs:      eok(op2A - op2Pr),
    },
    op_margin: {
      actual:   Math.round(opRateA  * 10) / 10,
      plan:     revP  ? Math.round(opRateP  * 10) / 10 : null,
      prev:     revPr ? Math.round(opRatePr * 10) / 10 : null,
      yoy:      revPr ? Math.round((opRateA - opRatePr) * 10) / 10 : null,
      vs_plan:  revP  ? Math.round((opRateA - opRateP)  * 10) / 10 : null,
    },
    target_achievement: {
      revenue_rate:   revP  ? ratePct(revA, revP)  : null,
      op_profit_rate: op2P  ? ratePct(op2A, op2P)  : null,
      actual_revenue: eok(revA),
      plan_revenue:   revP  ? eok(revP)  : null,
    },
  });
}
