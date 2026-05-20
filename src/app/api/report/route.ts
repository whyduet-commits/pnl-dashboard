// src/app/api/report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const ORG_MAP: Record<string, number[]> = {
  "전체":    [1],
  "중점본부": [2,3,4,5,6,7,8,9,10],
  "대치본부": [11],
  "시내":    [2,3,4,5,6],
  "기숙":    [7,8,9,10],
  "대치":    [11],
};

const ORG_NAMES: Record<number, string> = {
  1:"전체", 2:"강남", 3:"목동", 4:"분당", 5:"대구",
  6:"대전", 7:"최상위권", 8:"남학생", 9:"여학생", 10:"종합관", 11:"대치"
};

function eok(v: number): number {
  return Math.round(v / 1e8 * 10) / 10;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year   = Number(searchParams.get("year")   ?? 2026);
  const month  = Number(searchParams.get("month")  ?? 1);
  const orgId  = Number(searchParams.get("org_id") ?? 1);
  const hq1    = searchParams.get("hq1") ?? "전체";
  const hq2    = searchParams.get("hq2") ?? "전체";

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

  const labelCurr   = `${year}년`;
  const labelPrev   = `${year - 1}년`;
  const labelPlan   = `${year} 사업계획`;
  const labelTarget = `${year} 개선목표`;

  // 월별 데이터 조회 (전체 월 — 차트용)
  const { data: monthlyData, error: monthlyError } = await supabaseAdmin
    .from("pnl_fact_monthly")
    .select("org_id, account_id, month, scenario_label, value")
    .in("org_id", orgIds)
    .in("account_id", [1, 29, 128, 285])
    .in("scenario_label", [labelCurr, labelPrev, labelPlan, labelTarget])
    .order("month");

  if (monthlyError) return NextResponse.json({ error: monthlyError }, { status: 500 });

  // 연간 계획/목표 데이터 조회
  const { data: planData } = await supabaseAdmin
    .from("pnl_fact_annual_total")
    .select("account_id, scenario_label, value")
    .in("org_id", orgIds)
    .in("account_id", [1, 29, 128, 285])
    .in("scenario_label", [labelPlan, labelTarget]);

  // 집계 함수
  // 특정 월만
  const sumMonth = (accountId: number, label: string) =>
    (monthlyData ?? [])
      .filter((r: any) => r.account_id === accountId && r.scenario_label === label && r.month === month)
      .reduce((acc: number, r: any) => acc + Number(r.value || 0), 0);

  // 선택월까지 누계
  const sumYtd = (accountId: number, label: string) =>
    (monthlyData ?? [])
      .filter((r: any) => r.account_id === accountId && r.scenario_label === label && r.month <= month)
      .reduce((acc: number, r: any) => acc + Number(r.value || 0), 0);

  // 연간 계획 합계
  const sumPlan = (accountId: number, label: string) =>
    (planData ?? [])
      .filter((r: any) => r.account_id === accountId && r.scenario_label === label)
      .reduce((acc: number, r: any) => acc + Number(r.value || 0), 0);

  // 월간 지표
  const revM      = sumMonth(1,   labelCurr);
  const cogsM     = sumMonth(29,  labelCurr);
  const sgaM      = sumMonth(128, labelCurr);
  const opM       = sumMonth(285, labelCurr);
  const revMPrev  = sumMonth(1,   labelPrev);
  const cogsMPrev = sumMonth(29,  labelPrev);
  const sgaMPrev  = sumMonth(128, labelPrev);
  const opMPrev   = sumMonth(285, labelPrev);

  // 누계 지표
  const revY     = sumYtd(1,   labelCurr);
  const opY      = sumYtd(285, labelCurr);
  const revYPrev = sumYtd(1,   labelPrev);
  const opYPrev  = sumYtd(285, labelPrev);

  // 연간 계획/목표 합계
  const revPlan   = sumPlan(1,   labelPlan);
  const opPlan    = sumPlan(285, labelPlan);
  const revTarget = sumPlan(1,   labelTarget);
  const opTarget  = sumPlan(285, labelTarget);

  // 당월 계획/목표
  const revPlanM  = sumMonth(1,   labelPlan);
  const opPlanM   = sumMonth(285, labelPlan);
  const sgaPlanM  = sumMonth(128, labelPlan);
  const yoy = (curr: number, prev: number) =>
    prev ? Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10 : null;

  const metrics = {
    month, year, orgIds,
    monthly: {
      revenue:   { actual: eok(revM),  prev: eok(revMPrev),  yoy: yoy(revM, revMPrev) },
      cogs:      { actual: eok(cogsM), prev: eok(cogsMPrev), yoy: yoy(cogsM, cogsMPrev) },
      sga:       { actual: eok(sgaM),  prev: eok(sgaMPrev),  yoy: yoy(sgaM, sgaMPrev) },
      op_profit: { actual: eok(opM),   prev: eok(opMPrev),   yoy: yoy(opM, opMPrev) },
      op_margin:     revM ? Math.round(opM  / revM  * 1000) / 10 : 0,
      op_margin_prev: revMPrev ? Math.round(opMPrev / revMPrev * 1000) / 10 : 0,
      op_margin_plan: revPlanM ? Math.round(opPlanM / revPlanM * 1000) / 10 : 0,
      cogs_ratio:    revM ? Math.round(cogsM / revM * 1000) / 10 : 0,
      sga_ratio:     revM ? Math.round(sgaM  / revM * 1000) / 10 : 0,
      // 당월 계획 달성률
      rev_plan_m:    eok(revPlanM),
      op_plan_m:     eok(opPlanM),
      sga_plan_m:    eok(sgaPlanM),
      rev_achievement_m:  revPlanM ? Math.round(revM  / revPlanM * 1000) / 10 : null,
      op_achievement_m:   opPlanM  ? Math.round(opM   / opPlanM  * 1000) / 10 : null,
      sga_achievement_m:  sgaPlanM ? Math.round(sgaM  / sgaPlanM * 1000) / 10 : null,
    },
    ytd: {
      revenue:   { actual: eok(revY), prev: eok(revYPrev), yoy: yoy(revY, revYPrev) },
      op_profit: { actual: eok(opY),  prev: eok(opYPrev),  yoy: yoy(opY, opYPrev) },
      op_margin: revY ? Math.round(opY / revY * 1000) / 10 : 0,
      rev_achievement: revPlan ? Math.round(revY / revPlan * 1000) / 10 : null,
      op_achievement:  opPlan  ? Math.round(opY  / opPlan  * 1000) / 10 : null,
    },
  };

  // orgLabel
  const orgLabel = orgId !== 1
    ? (ORG_NAMES[orgId] ?? "전체")
    : hq2 !== "전체" ? hq2
    : hq1 !== "전체" ? hq1 : "전체";

  // Claude AI 분석 프롬프트
  const prompt = `
당신은 교육 학원 경영 전문 분석가입니다. 아래 ${year}년 ${month}월 ${orgLabel} 손익 데이터를 분석하고 경영진을 위한 월간 보고서 코멘트를 작성해주세요.

[월간 실적]
- 매출: ${eok(revM)}억원 (전년동월 ${eok(revMPrev)}억원, YoY ${yoy(revM, revMPrev)}%)
- 매출원가: ${eok(cogsM)}억원 (전년동월 ${eok(cogsMPrev)}억원, YoY ${yoy(cogsM, cogsMPrev)}%)
- 판관비: ${eok(sgaM)}억원 (전년동월 ${eok(sgaMPrev)}억원, YoY ${yoy(sgaM, sgaMPrev)}%)
- 영업이익: ${eok(opM)}억원 (전년동월 ${eok(opMPrev)}억원, YoY ${yoy(opM, opMPrev)}%)
- 영업이익률: ${metrics.monthly.op_margin}%

[연간 누계 (1월~${month}월)]
- 누계 매출: ${eok(revY)}억원 (전년동기 ${eok(revYPrev)}억원, YoY ${yoy(revY, revYPrev)}%)
- 누계 영업이익: ${eok(opY)}억원 (전년동기 ${eok(opYPrev)}억원)
- 누계 영업이익률: ${metrics.ytd.op_margin}%
- 매출 계획 달성률: ${metrics.ytd.rev_achievement}%
- 영업이익 계획 달성률: ${metrics.ytd.op_achievement}%

다음 형식으로 작성해주세요:
1. **종합 평가** (2~3문장)
2. **긍정 지표** (bullet 2~3개)
3. **주의 지표** (bullet 2~3개)
4. **다음 달 제언** (2~3문장)

간결하고 핵심적으로 작성해주세요.
`;

  let aiComment = "";
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });
    aiComment = message.content[0].type === "text" ? message.content[0].text : "";
  } catch (e: any) {
    console.error("Anthropic API 오류:", e?.message ?? e);
    aiComment = `AI 분석 오류: ${e?.message ?? "알 수 없는 오류"}\n\n크레딧을 충전하시면 AI 분석이 활성화됩니다.`;
  }

  // 월별 차트 데이터 (1~12월)
  const monthlyChartData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const getVal = (accountId: number, label: string) =>
      (monthlyData ?? [])
        .filter((r: any) => r.account_id === accountId && r.scenario_label === label && r.month === m)
        .reduce((acc: number, r: any) => acc + Number(r.value || 0), 0);

    const revC  = getVal(1,   labelCurr);
    const revP  = getVal(1,   labelPrev);
    const revPl = getVal(1,   labelPlan);
    const revTg = getVal(1,   labelTarget);
    const opC   = getVal(285, labelCurr);
    const opP   = getVal(285, labelPrev);
    const opPl  = getVal(285, labelPlan);
    const opTg  = getVal(285, labelTarget);

    return {
      month: m, label: `${m}월`,
      매출_전년: eok(revP),
      매출_올해: eok(revC),
      매출_계획: revPl > 0 ? eok(revPl) : null,
      매출_목표: revTg > 0 ? eok(revTg) : null,
      영업이익_전년: eok(opP),
      영업이익_올해: eok(opC),
      영업이익_계획: opPl > 0 ? eok(opPl) : null,
      영업이익_목표: opTg > 0 ? eok(opTg) : null,
    };
  });

  // 누계 차트 데이터 (1~12월)
  let cumRevC = 0, cumRevP = 0, cumRevPl = 0, cumRevTg = 0;
  let cumOpC  = 0, cumOpP  = 0, cumOpPl  = 0, cumOpTg  = 0;
  const ytdChartData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const getVal = (accountId: number, label: string) =>
      (monthlyData ?? [])
        .filter((r: any) => r.account_id === accountId && r.scenario_label === label && r.month === m)
        .reduce((acc: number, r: any) => acc + Number(r.value || 0), 0);

    cumRevC  += getVal(1,   labelCurr);
    cumRevP  += getVal(1,   labelPrev);
    cumRevPl += getVal(1,   labelPlan);
    cumRevTg += getVal(1,   labelTarget);
    cumOpC   += getVal(285, labelCurr);
    cumOpP   += getVal(285, labelPrev);
    cumOpPl  += getVal(285, labelPlan);
    cumOpTg  += getVal(285, labelTarget);

    return {
      month: m, label: `${m}월`,
      매출_전년: eok(cumRevP),
      매출_올해: eok(cumRevC),
      매출_계획: cumRevPl > 0 ? eok(cumRevPl) : null,
      매출_목표: cumRevTg > 0 ? eok(cumRevTg) : null,
      영업이익_전년: eok(cumOpP),
      영업이익_올해: eok(cumOpC),
      영업이익_계획: cumOpPl > 0 ? eok(cumOpPl) : null,
      영업이익_목표: cumOpTg > 0 ? eok(cumOpTg) : null,
    };
  });

  return NextResponse.json({ metrics, aiComment, orgLabel, monthlyChartData, ytdChartData });
}