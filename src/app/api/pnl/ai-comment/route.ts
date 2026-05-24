// src/app/api/pnl/ai-comment/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const ORG_MAP: Record<string, number[]> = {
  "전체":    [1],
  "중점본부": [2,3,4,5,6,7,8,9,10],
  "시내":    [2,3,4,5,6],
  "기숙":    [7,8,9,10],
};
function eok(v: number) { return Math.round(v / 1e8 * 10) / 10; }
function yoyPct(c: number, p: number) {
  if (!p) return null;
  return Math.round((c - p) / Math.abs(p) * 1000) / 10;
}
function ratePct(a: number, b: number) {
  if (!b) return null;
  if (b < 0) return a !== 0 ? Math.round((b / a) * 100 * 10) / 10 : null;
  return Math.round((a / b) * 100 * 10) / 10;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year  = Number(searchParams.get("year")   ?? 2026);
  const orgId = Number(searchParams.get("org_id") ?? 1);
  const hq1   = searchParams.get("hq1") ?? "전체";
  const hq2   = searchParams.get("hq2") ?? "전체";

  let orgIds: number[];
  if (orgId !== 1)        orgIds = [orgId];
  else if (hq2 !== "전체") orgIds = ORG_MAP[hq2] ?? [1];
  else if (hq1 !== "전체") orgIds = ORG_MAP[hq1] ?? [1];
  else                    orgIds = [1];

  const labelA  = `${year}년`;
  const labelP  = `${year} 사업계획`;
  const labelPr = `${year - 1}년`;

  try {
    // Supabase 직접 조회 (localhost fetch 없음)
    const { data } = await supabaseAdmin
      .from("pnl_fact_annual_total")
      .select("org_id, account_id, scenario_label, value")
      .in("org_id", orgIds)
      .in("account_id", [1, 285])
      .in("scenario_label", [labelA, labelP, labelPr]);

    const sum = (accountId: number, label: string) =>
      (data ?? [])
        .filter((r: any) => r.account_id === accountId && r.scenario_label === label)
        .reduce((acc: number, r: any) => acc + Number(r.value || 0), 0);

    const revA  = sum(1,   labelA);
    const revP  = sum(1,   labelP);
    const revPr = sum(1,   labelPr);
    const opA   = sum(285, labelA);
    const opP   = sum(285, labelP);
    const opPr  = sum(285, labelPr);

    const opMarginA  = revA  ? Math.round(opA  / revA  * 1000) / 10 : 0;
    const opMarginPr = revPr ? Math.round(opPr / revPr * 1000) / 10 : 0;

    const orgLabel = orgId !== 1 ? String(orgId)
      : hq2 !== "전체" ? hq2
      : hq1 !== "전체" ? hq1 : "전체";

    const prompt = `
당신은 교육 학원 경영 전문 분석가입니다. 아래 ${year}년 ${orgLabel} 연간 손익 데이터를 분석하고 경영진을 위한 분석 코멘트를 작성해주세요.

[${year}년 연간 실적]
- 매출: ${eok(revA)}억원 (전년 ${eok(revPr)}억원, YoY ${yoyPct(revA, revPr)}%)
- 영업이익Ⅱ: ${eok(opA)}억원 (전년 ${eok(opPr)}억원, YoY ${yoyPct(opA, opPr)}%)
- 영업이익률: ${opMarginA}% (전년 ${opMarginPr}%)
- 매출 계획 달성률: ${ratePct(revA, revP)}%
- 영업이익 계획 달성률: ${ratePct(opA, opP)}%

다음 형식으로 간결하게 작성해주세요:
1. **종합 평가** (2~3문장)
2. **긍정 지표** (bullet 2~3개)
3. **주의 지표** (bullet 2~3개)
4. **향후 제언** (2~3문장)
`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const aiComment = message.content[0].type === "text"
      ? message.content[0].text : "";

    return NextResponse.json({ aiComment });

  } catch (e: any) {
    return NextResponse.json({
      aiComment: `AI 분석 오류: ${e?.message ?? "알 수 없는 오류"}\n\n크레딧을 충전하시면 AI 분석이 활성화됩니다.`,
    });
  }
}