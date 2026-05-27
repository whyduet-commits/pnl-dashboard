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

// 손익 상세 항목 (account_id → 계정명)
const ACCOUNT_LABELS: Record<number, string> = {
  1:   "매출(사업부)",
  5:   "단과매출",
  6:   "종합매출",
  7:   "특강매출",
  9:   "교재매출",
  10:  "모의고사매출",
  13:  "바자관매출",
  105: "매출원가",
  106: "단과매출원가",
  107: "종합매출원가",
  128: "판매관리비",
  129: "급여",
  130: "상여금",
  131: "잡급",
  285: "영업이익Ⅱ",
};
const ALL_ACCOUNT_IDS = Object.keys(ACCOUNT_LABELS).map(Number);

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

  const orgLabel = orgId !== 1 ? String(orgId)
    : hq2 !== "전체" ? hq2
    : hq1 !== "전체" ? hq1 : "전체";

  try {
    // 전체 손익 항목 조회
    const { data } = await supabaseAdmin
      .from("pnl_fact_annual_total")
      .select("org_id, account_id, scenario_label, value")
      .in("org_id", orgIds)
      .in("account_id", ALL_ACCOUNT_IDS)
      .in("scenario_label", [labelA, labelP, labelPr]);

    const sum = (accountId: number, label: string) =>
      (data ?? [])
        .filter((r: any) => r.account_id === accountId && r.scenario_label === label)
        .reduce((acc: number, r: any) => acc + Number(r.value || 0), 0);

    // 핵심 지표
    const revA  = sum(1,   labelA);  const revP  = sum(1,   labelP);  const revPr = sum(1,   labelPr);
    const opA   = sum(285, labelA);  const opP   = sum(285, labelP);  const opPr  = sum(285, labelPr);
    const sgaA  = sum(128, labelA);  const sgaPr = sum(128, labelPr);
const cogA  = sum(105, labelA);  const cogPr = sum(105, labelPr);

    const opMarginA  = revA  ? Math.round(opA  / revA  * 1000) / 10 : 0;
    const opMarginPr = revPr ? Math.round(opPr / revPr * 1000) / 10 : 0;

    // 판관비 세부 항목 YoY 변화 (TOP3 증감)
    const sgaItems = [129,130,131].map(id => {
      const curr = eok(sum(id, labelA));
      const prev = eok(sum(id, labelPr));
      const diff = Math.round((curr - prev) * 10) / 10;
      return { name: ACCOUNT_LABELS[id], curr, prev, diff };
    }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    // 매출 세부 항목 YoY
    const revItems = [5,6,7,9,10,13].map(id => {
      const curr = eok(sum(id, labelA));
      const prev = eok(sum(id, labelPr));
      const diff = Math.round((curr - prev) * 10) / 10;
      return { name: ACCOUNT_LABELS[id], curr, prev, diff };
    }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    // 매출원가 세부 항목 YoY
    const cogItems = [106,107].map(id => {
      const curr = eok(sum(id, labelA));
      const prev = eok(sum(id, labelPr));
      const diff = Math.round((curr - prev) * 10) / 10;
      return { name: ACCOUNT_LABELS[id], curr, prev, diff };
    });

    const prompt = `
당신은 교육 학원 경영 전문 분석가입니다. 아래 ${year}년 ${orgLabel} 손익 데이터를 분석하고 경영진을 위한 상세 분석 코멘트를 작성해주세요.

※ 주의: ${year === 2026 ? `2026년은 4월까지 실적, 5~12월은 추정치입니다. 반드시 "추정" 또는 "예상" 표현을 사용하고 과거형(~했습니다, ~달성했습니다) 사용 금지. "~될 것으로 보입니다", "~예상됩니다" 형태로 작성하세요.` : `${year}년은 확정 실적입니다.`}

[핵심 손익 지표]
- 매출: ${eok(revA)}억원 (전년 ${eok(revPr)}억원, YoY ${yoyPct(revA, revPr)}%, 계획대비 ${ratePct(revA, revP)}%)
- 매출원가: ${eok(cogA)}억원 (전년 ${eok(cogPr)}억원, YoY ${yoyPct(cogA, cogPr)}%)
- 판관비: ${eok(sgaA)}억원 (전년 ${eok(sgaPr)}억원, YoY ${yoyPct(sgaA, sgaPr)}%)
- 영업이익Ⅱ: ${eok(opA)}억원 (전년 ${eok(opPr)}억원, YoY ${yoyPct(opA, opPr)}%)
- 영업이익률: ${opMarginA}% (전년 ${opMarginPr}%)
- 영업이익 계획 달성률: ${ratePct(opA, opP)}%

[매출 세부 항목 TOP3 변화]
${revItems.slice(0,3).map(i => `- ${i.name}: ${i.curr}억원 (전년 ${i.prev}억원, ${i.diff >= 0 ? '+' : ''}${i.diff}억원)`).join('\n')}

[판관비 세부 항목 TOP3 변화 (절대값 기준)]
${sgaItems.slice(0,3).map(i => `- ${i.name}: ${i.curr}억원 (전년 ${i.prev}억원, ${i.diff >= 0 ? '+' : ''}${i.diff}억원)`).join('\n')}

[매출원가 세부 항목]
${cogItems.map(i => `- ${i.name}: ${i.curr}억원 (전년 ${i.prev}억원, ${i.diff >= 0 ? '+' : ''}${i.diff}억원)`).join('\n')}

다음 형식으로 작성해주세요:
1. **종합 평가** (2~3문장)
2. **긍정 지표** (bullet 2~3개, 구체적 수치 포함)
3. **주의 지표** (bullet 2~3개, 구체적 수치 포함)
4. **세부 항목 분석** (판관비/매출원가 증감 TOP 항목 중심으로 2~3문장)
5. **향후 제언** (2~3문장)
`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
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
