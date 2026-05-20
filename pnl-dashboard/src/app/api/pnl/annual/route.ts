import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ACCOUNT } from "@/lib/accounts";
import { toEok } from "@/lib/format";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const org_id = Number(searchParams.get("org_id") ?? 1);

  // 연도 범위: 2021 ~ 현재+1 (E)
  const { data, error } = await supabaseAdmin
    .from("pnl_fact_annual_total")
    .select("account_id, scenario_label, year, value")
    .eq("org_id", org_id)
    .in("account_id", [
      ACCOUNT.REVENUE,
      ACCOUNT.COGS,
      ACCOUNT.SGA,
      ACCOUNT.OP_PROFIT_2,
    ])
    .gte("year", 2021)
    .order("year");

  if (error) return NextResponse.json({ error }, { status: 500 });

  // year → { accountId_scenarioLabel: value } 맵으로 집계
  const byYear: Record<number, Record<string, number | null>> = {};
  for (const row of data ?? []) {
    if (!byYear[row.year]) byYear[row.year] = {};
    // scenario_label 예: "2026년" / "2026 사업계획" / "2026 개선목표"
    const key = `${row.account_id}_${row.scenario_label}`;
    const prev = byYear[row.year][key];
    byYear[row.year][key] =
      row.value != null
        ? (prev ?? 0) + Number(row.value)
        : prev ?? null;
  }

  const result = Object.entries(byYear).map(([yearStr, vals]) => {
    const year = Number(yearStr);
    const labelActual = `${year}년`;
    const labelPlan   = `${year} 사업계획`;
    const labelTarget = `${year} 개선목표`;

    const rev  = vals[`${ACCOUNT.REVENUE}_${labelActual}`] ?? null;
    const op2  = vals[`${ACCOUNT.OP_PROFIT_2}_${labelActual}`] ?? null;

    return {
      year,
      매출_actual:      rev  != null ? toEok(rev)  : null,
      매출_plan:        vals[`${ACCOUNT.REVENUE}_${labelPlan}`]   != null ? toEok(vals[`${ACCOUNT.REVENUE}_${labelPlan}`]!)   : null,
      매출_target:      vals[`${ACCOUNT.REVENUE}_${labelTarget}`] != null ? toEok(vals[`${ACCOUNT.REVENUE}_${labelTarget}`]!) : null,
      영업이익2_actual: op2  != null ? toEok(op2)  : null,
      영업이익2_plan:   vals[`${ACCOUNT.OP_PROFIT_2}_${labelPlan}`]   != null ? toEok(vals[`${ACCOUNT.OP_PROFIT_2}_${labelPlan}`]!)   : null,
      영업이익2_target: vals[`${ACCOUNT.OP_PROFIT_2}_${labelTarget}`] != null ? toEok(vals[`${ACCOUNT.OP_PROFIT_2}_${labelTarget}`]!) : null,
      영업이익률_actual:
        rev && op2
          ? Math.round((op2 / rev) * 1000) / 10
          : null,
    };
  });

  return NextResponse.json(result);
}