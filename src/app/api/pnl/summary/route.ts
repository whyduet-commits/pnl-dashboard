import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
import { ACCOUNT } from "@/lib/accounts";
import { toEok } from "@/lib/format";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const org_id = Number(searchParams.get("org_id") ?? 1);
  const year   = Number(searchParams.get("year") ?? 2026);
  const cm     = Number(searchParams.get("cm") ?? 4);

  const labelActual = `${year}년`;
  const labelPlan   = `${year} 사업계획`;
  const labelTarget = `${year} 개선목표`;
  const labelPrev   = `${year - 1}년`;

  const { data, error } = await supabaseAdmin
    .from("pnl_fact_monthly")
    .select("account_id, scenario_label, month, value")
    .eq("org_id", org_id)
    .in("account_id", [ACCOUNT.REVENUE, ACCOUNT.OP_PROFIT_2])
    .in("scenario_label", [labelActual, labelPlan, labelTarget, labelPrev])
    .lte("month", cm);

  if (error) return NextResponse.json({ error }, { status: 500 });

  // 시나리오 × 계정별 누계 합산
  const totals: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = `${row.account_id}_${row.scenario_label}`;
    if (row.value != null) {
      totals[key] = (totals[key] ?? 0) + Number(row.value);
    }
  }

  const get = (account_id: number, label: string) =>
    totals[`${account_id}_${label}`] ?? null;

  const revenue_actual = get(ACCOUNT.REVENUE,    labelActual);
  const revenue_plan   = get(ACCOUNT.REVENUE,    labelPlan);
  const revenue_target = get(ACCOUNT.REVENUE,    labelTarget);
  const revenue_prev   = get(ACCOUNT.REVENUE,    labelPrev);

  const op2_actual     = get(ACCOUNT.OP_PROFIT_2, labelActual);
  const op2_plan       = get(ACCOUNT.OP_PROFIT_2, labelPlan);
  const op2_target     = get(ACCOUNT.OP_PROFIT_2, labelTarget);
  const op2_prev       = get(ACCOUNT.OP_PROFIT_2, labelPrev);

  const rate = (a: number | null, b: number | null) =>
    a != null && b != null && b !== 0
      ? Math.round((a / b) * 100)
      : null;

  const yoy = (curr: number | null, prev: number | null) =>
    curr != null && prev != null && prev !== 0
      ? Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10
      : null;

  return NextResponse.json({
    cm,
    year,
    매출: {
      actual:           toEok(revenue_actual),
      plan:             toEok(revenue_plan),
      target:           toEok(revenue_target),
      달성률_vs_plan:   rate(revenue_actual, revenue_plan),
      달성률_vs_target: rate(revenue_actual, revenue_target),
      yoy:              yoy(revenue_actual, revenue_prev),
    },
    영업이익2: {
      actual:           toEok(op2_actual),
      plan:             toEok(op2_plan),
      target:           toEok(op2_target),
      달성률_vs_plan:   rate(op2_actual, op2_plan),
      달성률_vs_target: rate(op2_actual, op2_target),
      yoy:              yoy(op2_actual, op2_prev),
    },
  });
}