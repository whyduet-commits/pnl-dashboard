// src/app/api/pnl/monthly/route.ts
// GET /api/pnl/monthly?org_id=1&year=2026&account_id=1&hq1=전체&hq2=전체
// → 선택 연도 vs 전년 월별 비교

import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
); 

// 본부/부문 → org_id 목록
const ORG_MAP: Record<string, number[]> = {
  "전체":    [1],
  "중점본부": [2,3,4,5,6,7,8,9,10],
  "대치본부": [11],
  "시내":    [2,3,4,5,6],
  "기숙":    [7,8,9,10],
  "대치":    [11],
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year       = Number(searchParams.get("year")       ?? 2026);
  const accountId  = Number(searchParams.get("account_id") ?? 1);
  const orgId      = Number(searchParams.get("org_id")     ?? 1);
  const hq1        = searchParams.get("hq1") ?? "전체";
  const hq2        = searchParams.get("hq2") ?? "전체";

  // org_id 목록 결정
  let orgIds: number[];
  if (orgId !== 1) {
    orgIds = [orgId];
  } else if (hq2 !== "전체") {
    orgIds = ORG_MAP[hq2] ?? [1];
  } else if (hq1 !== "전체") {
    orgIds = ORG_MAP[hq1] ?? [1];
  } else {
    orgIds = [1];
  }

  const labelCurr = `${year}년`;
  const labelPrev = `${year - 1}년`;

  const { data, error } = await supabaseAdmin
    .from("pnl_fact_monthly")
    .select("org_id, month, scenario_label, value")
    .in("org_id", orgIds)
    .eq("account_id", accountId)
    .in("scenario_label", [labelCurr, labelPrev])
    .order("month");

  if (error) return NextResponse.json({ error }, { status: 500 });

  // 월별 합산 (multi org_id인 경우)
  const byMonth: Record<number, { curr: number; prev: number }> = {};
  for (let m = 1; m <= 12; m++) {
    byMonth[m] = { curr: 0, prev: 0 };
  }

  for (const row of data ?? []) {
    const v = Number(row.value ?? 0);
    if (row.scenario_label === labelCurr) byMonth[row.month].curr += v;
    if (row.scenario_label === labelPrev) byMonth[row.month].prev += v;
  }

  const toMillion = (v: number) => Math.round(v / 1_000_000);

  const result = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const curr = toMillion(byMonth[m].curr);
    const prev = toMillion(byMonth[m].prev);
    return {
      month:  m,
      label:  `${m}월`,
      현재연도: curr || null,
      전년도:   prev || null,
      yoy:    prev ? Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10 : null,
    };
  });

  return NextResponse.json({
    year,
    prevYear: year - 1,
    accountId,
    orgIds,
    data: result,
  });
}
