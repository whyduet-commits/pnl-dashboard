// C:\pnl-dashboard\src\app\api\pnl\detail\route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── 계정 그룹 정의 ────────────────────────────────────────────
const GROUPS = {
  rev_total:        [1],
  rev_단과:         [5],
  rev_종합:         [6,7,8,11],
  rev_바자관:       [13],
  rev_교재모의고사:  [9,10],
  rev_기타:         [2,3,4,12,14,15,16,17,18,19,20,21,22,23,24,25,26,27],
  cogs_total:       [29],
  cogs_단과:        [106],
  cogs_종합:        [107,108,109,112],
  cogs_교재모의고사: [110,111],
  cogs_기타:        [113,114,116,117,119,120,121,122,123,124],
  sga_total:        [128],
  sga_급여:         [129,130,131,132],
  sga_복리후생비:   [133,134,135,136,137,138,139,140,141,142,143],
  sga_수도광열비:   [159,160,161],
  sga_감가상각비:   [168,169,170,171,172],
  sga_지급임차료:   [173,174,175,176],
  sga_소모품비:     [206,207,208,209,210,211,212,213,214,215,216,217,218],
  sga_지급수수료:   [219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235],
  sga_광고선전비:   [241,242,243,244,245,246,247,248,249,250,251,252,253,254,255,256,257,258,259],
  sga_건물관리비:   [261],
  op_kifrs:         [272],
  common:           [275,276],
  op_after_common:  [277],
  op2:              [285],
} as const;

const PNL_STRUCTURE = [
  { key:"rev_total",        label:"매출",                    indent:0, bold:true },
  { key:"rev_단과",         label:"단과",                    indent:1 },
  { key:"rev_종합",         label:"종합",                    indent:1 },
  { key:"rev_바자관",       label:"바자관",                  indent:1 },
  { key:"rev_교재모의고사", label:"교재/모의고사",           indent:1 },
  { key:"rev_기타",         label:"기타",                    indent:1 },
  { key:"cogs_total",       label:"매출원가",                indent:0, bold:true },
  { key:"cogs_단과",        label:"단과",                    indent:1 },
  { key:"cogs_종합",        label:"종합",                    indent:1 },
  { key:"cogs_교재모의고사",label:"교재/모의고사",           indent:1 },
  { key:"cogs_기타",        label:"기타",                    indent:1 },
  { key:"sga_total",        label:"판매관리비",              indent:0, bold:true },
  { key:"sga_급여",         label:"급여",                    indent:1 },
  { key:"sga_복리후생비",   label:"복리후생비",              indent:1 },
  { key:"sga_수도광열비",   label:"수도광열비",              indent:1 },
  { key:"sga_감가상각비",   label:"감가상각비",              indent:1 },
  { key:"sga_지급임차료",   label:"지급임차료",              indent:1 },
  { key:"sga_소모품비",     label:"소모품비",                indent:1 },
  { key:"sga_지급수수료",   label:"지급수수료",              indent:1 },
  { key:"sga_광고선전비",   label:"광고선전비",              indent:1 },
  { key:"sga_건물관리비",   label:"건물관리비",              indent:1 },
  { key:"sga_기타",         label:"기타",                    indent:1, derived:true,
    subtractFrom:"sga_total",
    subtractKeys:["sga_급여","sga_복리후생비","sga_수도광열비","sga_감가상각비",
                  "sga_지급임차료","sga_소모품비","sga_지급수수료","sga_광고선전비","sga_건물관리비"] },
  { key:"common",           label:"공통비",                  indent:0, bold:true },
  { key:"op_after_common",  label:"영업이익Ⅰ(공통비배부후)", indent:0, bold:true },
  { key:"op2",              label:"영업이익Ⅱ(조정)",        indent:0, bold:true, highlight:true },
  { key:"op_margin",        label:"영업이익률(Ⅱ)",          indent:0, isRate:true,
    numKey:"op2", denomKey:"rev_total" },
] as const;

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
  const orgId  = Number(searchParams.get("org_id") ?? 1);
  const hq1    = searchParams.get("hq1") ?? "전체";
  const hq2    = searchParams.get("hq2") ?? "전체";
  const labelA = searchParams.get("label_a") ?? "2026년";
  const labelB = searchParams.get("label_b") ?? "2025년";
  // month: "01"~"12" 지정 시 해당 월 단월 데이터, 미지정 시 연간 누계
  const month  = searchParams.get("month") ?? null;

  // org_id 목록
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

  const allIds = [...new Set(Object.values(GROUPS).flat())];

  // 월별 모드: pnl_fact_monthly 테이블 사용 (존재 시)
  // 연간 모드: pnl_fact_annual_total 테이블 사용
  const tableName = month ? "pnl_fact_monthly" : "pnl_fact_annual_total";

  let query = supabaseAdmin
    .from(tableName)
    .select("account_id, scenario_label, value")
    .in("org_id", orgIds)
    .in("account_id", allIds)
    .in("scenario_label", [labelA, labelB]);

  // 월별 테이블에 month 컬럼이 있는 경우 필터 추가
  if (month) {
    query = (query as any).eq("month", Number(month));
  }

  const { data, error } = await query;

  if (error) {
    // 월별 테이블이 없으면 연간 테이블로 fallback
    if (month) {
      const { data: fallback, error: fallbackError } = await supabaseAdmin
        .from("pnl_fact_annual_total")
        .select("account_id, scenario_label, value")
        .in("org_id", orgIds)
        .in("account_id", allIds)
        .in("scenario_label", [labelA, labelB]);

      if (fallbackError) return NextResponse.json({ error: fallbackError }, { status: 500 });
      return buildResponse(fallback ?? [], labelA, labelB);
    }
    return NextResponse.json({ error }, { status: 500 });
  }

  return buildResponse(data ?? [], labelA, labelB);
}

function buildResponse(data: any[], labelA: string, labelB: string) {
  const sumMap: Record<string, number> = {};
  for (const row of data) {
    const k = `${row.account_id}::${row.scenario_label}`;
    sumMap[k] = (sumMap[k] ?? 0) + Number(row.value || 0);
  }

  const getSum = (ids: readonly number[], label: string): number =>
    ids.reduce((s, id) => s + (sumMap[`${id}::${label}`] ?? 0), 0);

  const groupVals: Record<string, { a: number; b: number }> = {};
  for (const [gk, ids] of Object.entries(GROUPS)) {
    groupVals[gk] = {
      a: getSum([...ids] as number[], labelA),
      b: getSum([...ids] as number[], labelB),
    };
  }

  const eok = (v: number) => Math.round(v / 1e8 * 10) / 10;
  const diffPct = (a: number, b: number) =>
    b ? Math.round(((a - b) / Math.abs(b)) * 100 * 10) / 10 : null;

  const rows = PNL_STRUCTURE.map(row => {
    if ((row as any).isRate) {
      const numA = groupVals[(row as any).numKey]?.a ?? 0;
      const denA = groupVals[(row as any).denomKey]?.a ?? 0;
      const numB = groupVals[(row as any).numKey]?.b ?? 0;
      const denB = groupVals[(row as any).denomKey]?.b ?? 0;
      const rateA = denA ? Math.round(numA / denA * 1000) / 10 : 0;
      const rateB = denB ? Math.round(numB / denB * 1000) / 10 : 0;
      return {
        label: row.label, indent: row.indent,
        bold: (row as any).bold ?? false,
        highlight: (row as any).highlight ?? false,
        isRate: true,
        valueA: rateA, valueB: rateB,
        diffAbs: Math.round((rateA - rateB) * 10) / 10,
        diffPct: null,
      };
    }

    if ((row as any).derived) {
      const totalA = groupVals[(row as any).subtractFrom]?.a ?? 0;
      const totalB = groupVals[(row as any).subtractFrom]?.b ?? 0;
      const namedA = ((row as any).subtractKeys as string[]).reduce((s: number, k: string) => s + (groupVals[k]?.a ?? 0), 0);
      const namedB = ((row as any).subtractKeys as string[]).reduce((s: number, k: string) => s + (groupVals[k]?.b ?? 0), 0);
      const valA = totalA - namedA;
      const valB = totalB - namedB;
      return {
        label: row.label, indent: row.indent,
        bold: false, highlight: false, isRate: false,
        valueA: eok(valA), valueB: eok(valB),
        diffAbs: Math.round((eok(valA) - eok(valB)) * 10) / 10,
        diffPct: diffPct(valA, valB),
      };
    }

    const valA = groupVals[row.key]?.a ?? 0;
    const valB = groupVals[row.key]?.b ?? 0;
    return {
      label: row.label, indent: row.indent,
      bold: (row as any).bold ?? false,
      highlight: (row as any).highlight ?? false,
      isRate: false,
      valueA: eok(valA), valueB: eok(valB),
      diffAbs: Math.round((eok(valA) - eok(valB)) * 10) / 10,
      diffPct: diffPct(valA, valB),
    };
  });

  return NextResponse.json({ labelA, labelB, rows });
}