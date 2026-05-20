// src/app/api/pnl/ai-comment/route.ts
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year  = Number(searchParams.get("year")   ?? 2026);
  const orgId = Number(searchParams.get("org_id") ?? 1);
  const hq1   = searchParams.get("hq1") ?? "전체";
  const hq2   = searchParams.get("hq2") ?? "전체";

  // KPI 데이터 조회
  const p = new URLSearchParams({
    year: String(year), org_id: String(orgId), hq1, hq2,
  });

  try {
    const [kpiRes, kpiPrevRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/pnl/kpi?${p}`),
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/pnl/kpi?${new URLSearchParams({ year: String(year - 1), org_id: String(orgId), hq1, hq2 })}`),
    ]);

    const kpi     = await kpiRes.json();
    const kpiPrev = await kpiPrevRes.json();

    const orgLabel = orgId !== 1 ? String(orgId)
      : hq2 !== "전체" ? hq2
      : hq1 !== "전체" ? hq1 : "전체";

    const prompt = `
당신은 교육 학원 경영 전문 분석가입니다. 아래 ${year}년 ${orgLabel} 연간 손익 데이터를 분석하고 경영진을 위한 분석 코멘트를 작성해주세요.

[${year}년 연간 실적]
- 매출: ${kpi?.revenue?.actual ?? "—"}억원 (전년 ${kpiPrev?.revenue?.actual ?? "—"}억원, YoY ${kpi?.revenue?.yoy ?? "—"}%)
- 영업이익Ⅱ: ${kpi?.op_profit2?.actual ?? "—"}억원 (전년 ${kpiPrev?.op_profit2?.actual ?? "—"}억원, YoY ${kpi?.op_profit2?.yoy ?? "—"}%)
- 영업이익률: ${kpi?.op_margin?.actual ?? "—"}% (전년 ${kpiPrev?.op_margin?.actual ?? "—"}%)
- 매출 계획 달성률: ${kpi?.revenue?.achievement ?? "—"}%
- 영업이익 계획 달성률: ${kpi?.op_profit2?.achievement ?? "—"}%

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