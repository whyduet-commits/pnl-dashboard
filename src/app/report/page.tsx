"use client";
// C:\pnl-dashboard\src\app\report\page.tsx
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Sidebar from "@/components/dashboard/Sidebar";
import { useTheme } from "@/lib/theme";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LabelList,
  ReferenceLine, Cell,
} from "recharts";

const MONTHS = Array.from({ length:12 }, (_,i) => ({ value:i+1, label:`${i+1}월` }));

interface FilterOpts {
  hq1List: string[];
  hq2List: string[];
  academyList: { org_id:number; academy:string; hq_level1:string; hq_level2:string }[];
}

const S = {
  s25:  { bar:"#aaaaaa", label:"'25 실적"    },
  s26:  { bar:"#1C1C1C", label:"'26 실적"    },
  plan: { bar:"#777777", label:"'26 사업계획" },
  tgt:  { bar:"#cccccc", label:"'26 개선목표" },
};

function MetricCard({ title, actual, prev, yoy, unit="억원", planVal, achievement, highlight=false, isRate=false, achievementUnit, T }: {
  title:string; actual:number|null; prev:number|null; yoy:number|null; unit?:string;
  planVal?:number|null; achievement?:number|null; highlight?:boolean; isRate?:boolean; achievementUnit?:string; T:any;
}) {
  const fmt=(v:number|null)=>v!=null?`${v.toLocaleString("ko-KR")}${unit}`:"—";
  return (
    <div style={{ background:T.bgCard, borderRadius:10, padding:"13px 15px", border:`0.5px solid ${highlight?"rgba(28,28,28,0.25)":T.border}`, borderTop:`2px solid ${highlight?T.textPri:"#888"}`, display:"flex", flexDirection:"column", gap:5 }}>
      <div style={{ fontSize:10, color:T.textMuted }}>{title}</div>
      <div style={{ fontSize:19, fontWeight:500, color:T.textPri, letterSpacing:"-0.03em", lineHeight:1.1 }}>{fmt(actual)}</div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:10 }}>
        <span style={{ color:T.textMuted }}>전년 {fmt(prev)}</span>
        {yoy!=null&&<span style={{ fontWeight:500, color:yoy>=0?T.up:T.dn }}>{yoy>=0?"▲":"▼"}{Math.abs(yoy).toFixed(1)}{isRate?"%p":"%"}</span>}
      </div>
      {planVal!=null&&(
        <div style={{ borderTop:`0.5px solid ${T.gridLine}`, paddingTop:5 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:10 }}>
  <span style={{ color:T.textMuted }}>계획 {fmt(planVal)}</span>
            {achievement!=null&&(
              <span style={{ fontWeight:500, color:isRate?(achievement>=0?T.up:T.dn):(achievement>=100?T.up:T.dn) }}>
                {isRate
  ? <span style={{ display:"flex", alignItems:"center", gap:2 }}>
      <span>{achievement>=0?"▲":"▼"}</span>
      <span>{Math.abs(achievement).toFixed(1)}{achievementUnit??"%p"}</span>
    </span>
  : `${achievement.toFixed(1)}%`
}
              </span>
            )}
          </div>
          {achievement!=null&&!isRate&&(
            <div style={{ marginTop:4, height:2, background:T.border, borderRadius:2, overflow:"hidden" }}>
              <div style={{ width:`${Math.min(achievement,100)}%`, height:"100%", background:T.textPri, borderRadius:2, transition:"width 0.6s ease" }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AiComment({ text, T }: { text:string; T:any }) {
  if (!text) return null;
  const lines=text.split("\n");
  return (
    <div style={{ background:T.bgCard, border:`0.5px solid ${T.border}`, borderRadius:10, padding:"18px 20px" }}>
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:12, fontWeight:500, color:T.textPri }}>AI 분석 코멘트</div>
        <div style={{ fontSize:10, color:T.textMuted }}>Claude Sonnet 4 분석</div>
      </div>
      <div style={{ fontSize:12, lineHeight:1.8, color:T.textPri }}>
        {lines.map((line,i)=>{
          if(!line.trim())return<div key={i} style={{ height:6 }}/>;
          if(line.startsWith("**")&&line.endsWith("**"))
            return<div key={i} style={{ fontSize:12, fontWeight:500, color:T.textPri, marginTop:10, marginBottom:3, paddingLeft:8, borderLeft:`2px solid ${T.textPri}` }}>{line.replace(/\*\*/g,"")}</div>;
          if(line.startsWith("- ")||line.startsWith("• "))
            return<div key={i} style={{ display:"flex", gap:6, marginBottom:3, paddingLeft:6 }}><span style={{ color:T.textMuted, flexShrink:0 }}>•</span><span>{line.replace(/^[-•]\s/,"")}</span></div>;
          return<p key={i} style={{ margin:"0 0 4px", color:T.textMuted }}>{line}</p>;
        })}
      </div>
    </div>
  );
}

function MonthlyChart({ data, chartTab, T }: { data:any[]; chartTab:"매출"|"영업이익"; T:any }) {
  const isRev = chartTab === "매출";
  const ChartTip=({ active,payload,label }:any)=>{
    if(!active||!payload?.length)return null;
    return(
      <div style={{ background:T.bgCard, border:`0.5px solid ${T.border}`, borderRadius:8, padding:"8px 12px", fontSize:11, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
        <div style={{ fontWeight:500, marginBottom:6, color:T.textPri }}>{label}</div>
        {payload.map((p:any)=>(
          <div key={p.dataKey} style={{ display:"flex", justifyContent:"space-between", gap:16, marginBottom:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ width:7,height:7,borderRadius:2,background:p.fill,display:"inline-block" }}/>
              <span style={{ color:T.textMuted }}>{p.name}</span>
            </div>
            <span style={{ fontWeight:500, color:T.textPri }}>{p.value!=null?`${p.value}억`:"—"}</span>
          </div>
        ))}
      </div>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top:14, right:8, left:0, bottom:0 }} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" stroke={T.gridLine} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize:9, fill:T.textMuted }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize:9, fill:T.textMuted }} axisLine={false} tickLine={false} width={35} />
        <ReferenceLine y={0} stroke={T.border} />
        <Tooltip content={<ChartTip />} />
        <Legend content={() => (
          <div style={{ display:"flex", justifyContent:"center", gap:14, fontSize:9, paddingTop:4 }}>
            {[
              { label:S.s25.label, color:S.s25.bar },{ label:S.s26.label, color:S.s26.bar },
              { label:S.plan.label,color:S.plan.bar },{ label:S.tgt.label, color:S.tgt.bar },
            ].map(item=>(
              <div key={item.label} style={{ display:"flex", alignItems:"center", gap:4, color:"#888" }}>
                <span style={{ width:9,height:9,borderRadius:2,background:item.color,display:"inline-block",flexShrink:0 }}/>
                {item.label}
              </div>
            ))}
          </div>
        )}/>
        <Bar dataKey={isRev?"s25rev":"s25op"} name={S.s25.label} fill={S.s25.bar} radius={[2,2,0,0]} barSize={10}/>
        <Bar dataKey={isRev?"s26rev":"s26op"} name={S.s26.label} fill={S.s26.bar} radius={[2,2,0,0]} barSize={10}/>
        <Bar dataKey={isRev?"planrev":"planop"} name={S.plan.label} fill={S.plan.bar} radius={[2,2,0,0]} barSize={10}/>
        <Bar dataKey={isRev?"tgtrev":"tgtop"} name={S.tgt.label} fill={S.tgt.bar} radius={[2,2,0,0]} barSize={10}/>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ════════════════════════════════════════════════════════════
// 손익 다년도 비교표
// ════════════════════════════════════════════════════════════
const YEAR_COLS    = ["2021년","2022년","2023년","2024년","2025년","2026년"];
const PLAN_LABEL   = "2026 사업계획";
const TARGET_LABEL = "2026 개선목표";
// 연도별 label_b (전년대비 계산용)
const PREV_OF: Record<string,string> = {
  "2021년":"2020년","2022년":"2021년","2023년":"2022년",
  "2024년":"2023년","2025년":"2024년","2026년":"2025년",
  [PLAN_LABEL]:"2025년",[TARGET_LABEL]:"2025년",
};

function PnlMultiYearTable({ orgId, hq1, hq2, T }: {
  orgId:number; hq1:string; hq2:string; T:any;
}) {
  // "year" = 연도별 비교 (연간 누계, 2021~2026 + 계획/목표)
  // "month" = 월별 비교 (선택한 월의 2021~2026 + 계획/목표)
  const [mode,     setMode]     = useState<"year"|"month">("year");
  const [selMonth, setSelMonth] = useState(4);
  const [cache,    setCache]    = useState<Record<string,any[]>>({});
  const [loading,  setLoading]  = useState(false);

  // 항상 8개 라벨을 fetch (연도별/월별 모두 동일한 컬럼 구조)
  const ALL_LABELS = [...YEAR_COLS, PLAN_LABEL, TARGET_LABEL];

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const baseParams: Record<string,string> = { org_id:String(orgId), hq1, hq2 };
    // 월별 모드: month 파라미터 추가 (API가 지원 시 해당 월 누계 반환)
    if (mode === "month") baseParams.month = String(selMonth).padStart(2,"0");

    try {
      const results = await Promise.all(
        ALL_LABELS.map(label => {
          const params = new URLSearchParams({
            ...baseParams,
            label_a: label,
            label_b: PREV_OF[label] ?? "",
          });
          return fetch(`/api/pnl/detail?${params}`).then(r=>r.json());
        })
      );
      const map: Record<string,any[]> = {};
      ALL_LABELS.forEach((label,i) => { map[label] = results[i]?.rows ?? []; });
      setCache(map);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [mode, selMonth, orgId, hq1, hq2]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // 표 컬럼: 2021~2026년 + 사업계획 + 개선목표
  const dataCols = ALL_LABELS;

  // 비교 지표 기준: 2026년 실적
  const curLabel  = "2026년";
  const prevLabel = "2025년";

  const baseRows: any[] = cache[dataCols[0]] ?? [];

  const getVal = (label:string, ri:number): number|null =>
    cache[label]?.[ri]?.valueA ?? null;

  const calcGrowth = (cur:number|null, prev:number|null) => {
    if (cur==null||prev==null||prev===0) return null;
    return Math.round(((cur-prev)/Math.abs(prev))*1000)/10;
  };
  const calcAchieve = (cur:number|null, base:number|null) => {
    if (cur==null||base==null||base===0) return null;
    return Math.round((cur/base)*1000)/10;
  };

  // 전년대비: ▲▼ + 색상
  const pctNode = (v:number|null) => {
    if (v==null) return <span style={{color:T.textHint}}>—</span>;
    const str = Math.abs(v) >= 1000
      ? Math.abs(v).toLocaleString("ko-KR",{maximumFractionDigits:1})
      : Math.abs(v).toFixed(1);
    return <span style={{color:v>=0?T.up:T.dn,fontWeight:600}}>{v>=0?"▲":"▼"} {str}%</span>;
  };

  // 달성률: ▲▼ 없이 숫자%만, 색상만 적용
  const achColor = (v:number|null) => {
    if (v==null) return T.textHint;
    if (v>=100) return T.up;
    if (v>=80)  return T.yellow;
    return T.dn;
  };
  const achBg = (v:number|null) => {
    if (v==null) return undefined;
    if (v>=100) return "rgba(200,240,74,0.07)";
    if (v>=80)  return "rgba(245,196,24,0.05)";
    return undefined;
  };
  const achNode = (cur:number|null, base:number|null) => {
    const v = calcAchieve(cur, base);
    if (v==null) return <span style={{color:T.textHint}}>—</span>;
    const str = Math.abs(v) >= 1000
      ? Math.abs(v).toLocaleString("ko-KR",{maximumFractionDigits:1})
      : Math.abs(v).toFixed(1);
    // ▲▼ 없이 숫자%만 표시
    return <span style={{color:achColor(v),fontWeight:600}}>{str}%</span>;
  };

  const selStyle: React.CSSProperties = {
    background:T.bgCard, border:`0.5px solid ${T.borderEm}`,
    borderRadius:7, padding:"5px 26px 5px 10px",
    fontSize:11, color:T.textPri, fontWeight:400,
    cursor:"pointer", outline:"none", appearance:"none",
    backgroundImage:`url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat:"no-repeat", backgroundPosition:"right 7px center",
  };

  return (
    <div style={{ background:T.bgCard, borderRadius:10, border:`0.5px solid ${T.border}`, padding:"18px 20px" }}>

      {/* 헤더 */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:500, color:T.textPri }}>손익 상세 현황 (다년도 비교)</div>
          <div style={{ fontSize:10, color:T.textMuted, marginTop:2 }}>
            {mode==="year" ? "단위: 억원 · 연간 누계 기준" : `단위: 억원 · ${selMonth}월 기준`}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* 모드 토글 */}
          <div style={{ display:"flex", background:T.bgSurface, borderRadius:8, padding:2, gap:1, border:`0.5px solid ${T.border}` }}>
            {(["year","month"] as const).map(m=>(
              <button key={m} onClick={()=>setMode(m)} style={{
                padding:"4px 14px", borderRadius:6, border:"none", cursor:"pointer",
                fontSize:11, fontWeight:mode===m?500:400,
                background:mode===m?T.textPri:"transparent",
                color:mode===m?T.bgCard:T.textMuted,
                transition:"all 0.12s",
              }}>
                {m==="year"?"연도별 비교":"월별 비교"}
              </button>
            ))}
          </div>
          {/* 월별 모드: 월 선택 */}
          {mode==="month"&&(
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ fontSize:10, color:T.textMuted }}>기준 월</span>
              <select value={selMonth} onChange={e=>setSelMonth(Number(e.target.value))} style={selStyle}>
                {Array.from({length:12},(_,i)=>i+1).map(m=>(
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 표 본문 */}
      {loading ? (
        <div style={{ textAlign:"center", padding:"50px 0", color:T.textMuted, fontSize:11 }}>로딩 중...</div>
      ) : baseRows.length===0 ? (
        <div style={{ textAlign:"center", padding:"50px 0", color:T.textMuted, fontSize:11 }}>데이터가 없습니다.</div>
      ) : (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, tableLayout:"fixed" }}>
            <colgroup>
              <col style={{ width:148 }}/>
              {dataCols.map(c=><col key={c} style={{ width:88 }}/>)}
              <col style={{ width:88 }}/>{/* 전년대비 */}
              <col style={{ width:88 }}/>{/* 사업계획대비 */}
              <col style={{ width:88 }}/>{/* 개선목표대비 */}
            </colgroup>

            <thead>
              {/* 1행: 그룹 헤더 */}
              <tr style={{ background:T.bgSurface }}>
                <th rowSpan={2} style={{
                  padding:"8px 10px", textAlign:"left", fontSize:10,
                  color:T.textMuted, fontWeight:500,
                  borderBottom:`1.5px solid ${T.borderEm}`,
                  borderRight:`0.5px solid ${T.border}`,
                  verticalAlign:"bottom",
                }}>계정</th>
                <th colSpan={dataCols.length} style={{
                  padding:"5px 8px", textAlign:"center", fontSize:9,
                  color:T.textMuted, fontWeight:500,
                  borderBottom:`0.5px solid ${T.border}`,
                  borderRight:`0.5px solid ${T.border}`,
                }}>
                  {mode==="year" ? "연도별 실적 · 계획" : `${selMonth}월 기준 연도별 비교`}
                </th>
                <th colSpan={3} style={{
                  padding:"5px 8px", textAlign:"center", fontSize:9,
                  color:T.textMuted, fontWeight:500,
                  borderBottom:`0.5px solid ${T.border}`,
                  background:"rgba(0,0,0,0.015)",
                }}>
                  비교 지표 (2026년 기준)
                </th>
              </tr>

              {/* 2행: 세부 컬럼 헤더 */}
              <tr style={{ background:T.bgSurface, borderBottom:`1.5px solid ${T.borderEm}` }}>
                {dataCols.map((col,ci)=>{
                  const isExtra = col===PLAN_LABEL||col===TARGET_LABEL;
                  const isCur   = col===curLabel;
                  return (
                    <th key={col} style={{
                      padding:"5px 6px", textAlign:"right", fontSize:10,
                      color: isExtra ? T.yellow : isCur ? T.textPri : T.textMuted,
                      fontWeight: isCur||isExtra ? 600 : 400,
                      background: isExtra ? "rgba(245,196,24,0.04)" : undefined,
                      borderRight: ci===dataCols.length-1 ? `0.5px solid ${T.border}` : undefined,
                      whiteSpace:"nowrap",
                    }}>
                      {col}
                    </th>
                  );
                })}
                {[
                  { label:"전년대비",     sub:"성장률" },
                  { label:"사업계획대비", sub:"달성률" },
                  { label:"개선목표대비", sub:"달성률" },
                ].map(h=>(
                  <th key={h.label} style={{
                    padding:"5px 6px", textAlign:"right", fontSize:10,
                    color:T.textMuted, fontWeight:400,
                    background:"rgba(0,0,0,0.015)",
                    whiteSpace:"nowrap",
                  }}>
                    <div>{h.label}</div>
                    <div style={{ fontSize:9, color:T.textHint, fontWeight:400 }}>({h.sub})</div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {baseRows.map((row:any, ri:number)=>{
                const curVal  = getVal(curLabel,  ri);
                const prevVal = getVal(prevLabel, ri);
                const planVal = getVal(PLAN_LABEL, ri);
                const tgtVal  = getVal(TARGET_LABEL, ri);
                const growthV = row.isRate ? null : calcGrowth(curVal, prevVal);
                const planAch = row.isRate ? null : calcAchieve(curVal, planVal);
                const tgtAch  = row.isRate ? null : calcAchieve(curVal, tgtVal);

                return (
                  <tr key={ri} style={{
                    borderBottom:`0.5px solid ${T.gridLine}`,
                    background:row.highlight ? "rgba(28,28,28,0.04)" : "transparent",
                    fontWeight:row.bold ? 600 : 400,
                    height:33,
                  }}
                    onMouseEnter={e=>{ if(!row.highlight) e.currentTarget.style.background=T.bgSurface; }}
                    onMouseLeave={e=>{ e.currentTarget.style.background=row.highlight?"rgba(28,28,28,0.04)":"transparent"; }}
                  >
                    {/* 계정명 */}
                    <td style={{
                      padding:"0 10px", height:33, verticalAlign:"middle",
                      borderRight:`0.5px solid ${T.border}`,
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                    }}>
                      <span style={{ paddingLeft:row.indent*13, display:"flex", alignItems:"center", gap:3 }}>
                        {row.indent>0 && <span style={{ color:T.textHint, fontSize:9 }}>└</span>}
                        <span style={{ fontSize:row.bold?11:10 }}>{row.label}</span>
                      </span>
                    </td>

                    {/* 데이터 컬럼 (균등 너비) */}
                    {dataCols.map((col,ci)=>{
                      const val     = getVal(col, ri);
                      const isExtra = col===PLAN_LABEL||col===TARGET_LABEL;
                      const isCur   = col===curLabel;
                      return (
                        <td key={col} style={{
                          padding:"0 6px", textAlign:"right",
                          height:33, verticalAlign:"middle", fontSize:11,
                          color: isExtra ? T.yellow : T.textPri,
                          fontWeight: (row.bold||isExtra||isCur) ? 600 : 400,
                          background: isExtra ? "rgba(245,196,24,0.03)" : undefined,
                          borderRight: ci===dataCols.length-1 ? `0.5px solid ${T.border}` : undefined,
                        }}>
                          {val==null ? "—" : row.isRate ? `${val.toFixed(1)}%` : val.toLocaleString("ko-KR")}
                        </td>
                      );
                    })}

                    {/* 전년대비 (성장률): ▲▼ + 색상 */}
                    <td style={{ padding:"0 8px", textAlign:"right", height:33, verticalAlign:"middle", background:"rgba(0,0,0,0.01)", fontSize:11 }}>
                      {pctNode(growthV)}
                    </td>

                    {/* 사업계획대비 (달성률): 숫자%만 */}
                    <td style={{ padding:"0 8px", textAlign:"right", height:33, verticalAlign:"middle", background:achBg(planAch), fontSize:11 }}>
                      {row.isRate ? <span style={{color:T.textHint}}>—</span> : achNode(curVal, planVal)}
                    </td>

                    {/* 개선목표대비 (달성률): 숫자%만 */}
                    <td style={{ padding:"0 8px", textAlign:"right", height:33, verticalAlign:"middle", background:achBg(tgtAch), fontSize:11 }}>
                      {row.isRate ? <span style={{color:T.textHint}}>—</span> : achNode(curVal, tgtVal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 범례 */}
      {!loading && baseRows.length>0 && (
        <div style={{
          display:"flex", gap:14, marginTop:12, paddingTop:10,
          borderTop:`0.5px solid ${T.gridLine}`,
          fontSize:9, color:T.textHint, flexWrap:"wrap",
        }}>
          <span>전년대비: ▲ 성장 / ▼ 감소</span>
          <span style={{ background:"rgba(200,240,74,0.07)", padding:"1px 6px", borderRadius:3 }}>달성률 100% 이상</span>
          <span style={{ background:"rgba(245,196,24,0.05)", padding:"1px 6px", borderRadius:3 }}>달성률 80~100%</span>
          <span style={{ color:T.dn }}>달성률 80% 미만</span>
          <span style={{ marginLeft:"auto" }}>
            * 비교 지표 기준: 2026년 {mode==="month" ? `${selMonth}월` : "연간 누계"} 실적
          </span>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 메인 페이지 (기존 코드 유지 + 하단에 PnlMultiYearTable 추가)
// ════════════════════════════════════════════════════════════
export default function ReportPage() {
  const router  = useRouter();
  const supabase= createClient();
  const { T }  = useTheme();

  useEffect(()=>{
    const checkAuth=async()=>{ const{data:{user}}=await supabase.auth.getUser(); if(!user)router.replace("/login"); };
    checkAuth();
  },[]);

  const [month,    setMonth]    = useState(4);
  const [hq1,      setHq1]      = useState("전체");
  const [hq2,      setHq2]      = useState("전체");
  const [orgId,    setOrgId]    = useState(1);
  const [opts,     setOpts]     = useState<FilterOpts|null>(null);
  const [data,     setData]     = useState<any>(null);
  const [loading,  setLoading]  = useState(false);
  const [chartTab, setChartTab] = useState<"매출"|"영업이익">("매출");

  useEffect(()=>{ fetch("/api/filters").then(r=>r.json()).then(setOpts); },[]);

  const filteredHq2=(opts?.hq2List??[]).filter(h2=>{
    if(hq1==="전체")return true;
    if(hq1==="중점본부")return["시내","기숙"].includes(h2);
    if(hq1==="대치본부")return h2==="대치";
    return true;
  });
  const filteredAcademies=(opts?.academyList??[]).filter(a=>{
    if(hq1!=="전체"&&a.hq_level1!==hq1)return false;
    if(hq2!=="전체"&&a.hq_level2!==hq2)return false;
    return true;
  });

  const fetchReport=async()=>{
    setLoading(true); setData(null);
    const p=new URLSearchParams({year:"2026",month:String(month),org_id:String(orgId),hq1,hq2});
    try { const res=await fetch(`/api/report?${p}`); setData(await res.json()); }
    finally { setLoading(false); }
  };

  const selStyle:React.CSSProperties={
    background:T.bgCard, border:`0.5px solid ${T.borderEm}`,
    borderRadius:7, padding:"6px 26px 6px 10px",
    fontSize:12, color:T.textPri, fontWeight:400,
    cursor:"pointer", outline:"none", appearance:"none",
    backgroundImage:`url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat:"no-repeat", backgroundPosition:"right 8px center",
  };

  const buildMonthlyChartData=()=>(data.monthlyChartData??[]).map((d:any)=>({
    label:d.label,
    s25rev: d.매출_전년     !=null?+Number(d.매출_전년).toFixed(1):null,
    s26rev: d.매출_올해     !=null?+Number(d.매출_올해).toFixed(1):null,
    planrev:d.매출_계획     !=null?+Number(d.매출_계획).toFixed(1):0,
    tgtrev: d.매출_목표     !=null?+Number(d.매출_목표).toFixed(1):0,
    s25op:  d.영업이익_전년 !=null?+Number(d.영업이익_전년).toFixed(1):null,
    s26op:  d.영업이익_올해 !=null?+Number(d.영업이익_올해).toFixed(1):null,
    planop: d.영업이익_계획 !=null?+Number(d.영업이익_계획).toFixed(1):0,
    tgtop:  d.영업이익_목표 !=null?+Number(d.영업이익_목표).toFixed(1):0,
  }));

  const buildYtdChart=()=>{
    const prevRev=data.metrics.ytd.revenue.prev??0, prevOp=data.metrics.ytd.op_profit.prev??0;
    const currRev=data.metrics.ytd.revenue.actual??0, currOp=data.metrics.ytd.op_profit.actual??0;
    const planRev=data.ytdChartData[month-1]?.매출_계획??0, planOp=data.ytdChartData[month-1]?.영업이익_계획??0;
    const tgtRev=data.ytdChartData[month-1]?.매출_목표??0, tgtOp=data.ytdChartData[month-1]?.영업이익_목표??0;
    const mk=(rev:number,op:number)=>({ 이익:+op.toFixed(1), 매출_위:+Math.max(rev-op,0).toFixed(1), 합계:+rev.toFixed(1) });
    return [
      { label:"'25 실적",    ...mk(prevRev,prevOp), 이익색:"#bbb",    매출색:"rgba(190,190,190,0.4)" },
      { label:"'26 실적",    ...mk(currRev,currOp), 이익색:"#1C1C1C", 매출색:"rgba(28,28,28,0.3)"   },
      { label:"'26 사업계획",...mk(planRev,planOp), 이익색:"#888",    매출색:"rgba(136,136,136,0.3)" },
      { label:"'26 개선목표",...mk(tgtRev,tgtOp),   이익색:"#ddd",    매출색:"rgba(220,220,220,0.35)"},
    ];
  };

  return (
    <div style={{ display:"flex", height:"100vh", width:"100vw", overflow:"hidden", fontFamily:"'SUIT','Pretendard','Noto Sans KR',sans-serif", background:T.bgBase, color:T.textPri }}>
      <Sidebar />
      <div style={{ flex:1, overflow:"auto", background:T.bgBase, padding:"20px 26px" }}>

        {/* 헤더 */}
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:16, fontWeight:500, color:T.textPri }}>월간 보고서</div>
          <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>학원별 월간 손익 분석 + AI 코멘트</div>
        </div>

        {/* 필터 */}
        <div style={{ background:T.bgCard, borderRadius:10, padding:"14px 18px", border:`0.5px solid ${T.border}`, marginBottom:18 }}>
          <div style={{ fontSize:11, fontWeight:500, color:T.textPri, marginBottom:10 }}>조회 조건</div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
              <span style={{ fontSize:9, color:T.textMuted }}>연도</span>
              <div style={{ ...selStyle, display:"flex", alignItems:"center", background:T.bgBase, border:`0.5px solid ${T.border}`, color:T.textMuted, pointerEvents:"none" as const, padding:"6px 12px" }}>2026년</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
              <span style={{ fontSize:9, color:T.textMuted }}>월</span>
              <select value={month} onChange={e=>setMonth(Number(e.target.value))} style={selStyle}>
                {MONTHS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
              <span style={{ fontSize:9, color:T.textMuted }}>본부</span>
              <select value={hq1} onChange={e=>{ setHq1(e.target.value); setHq2("전체"); setOrgId(1); }} style={selStyle}>
                <option value="전체">전체</option>
                {(opts?.hq1List??[]).map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
              <span style={{ fontSize:9, color:T.textMuted }}>부문</span>
              <select value={hq2} onChange={e=>{ setHq2(e.target.value); setOrgId(1); }} style={selStyle}>
                <option value="전체">전체</option>
                {filteredHq2.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
              <span style={{ fontSize:9, color:T.textMuted }}>학원</span>
              <select value={orgId} onChange={e=>setOrgId(Number(e.target.value))} style={selStyle}>
                <option value={1}>전체</option>
                {filteredAcademies.map(a=><option key={a.org_id} value={a.org_id}>{a.academy}</option>)}
              </select>
            </div>
            <button onClick={fetchReport} disabled={loading} style={{ padding:"6px 22px", borderRadius:7, border:"none", background:loading?T.border:T.textPri, color:loading?T.textMuted:T.bgCard, fontSize:12, fontWeight:500, cursor:loading?"not-allowed":"pointer" }}>
              {loading?"조회 중...":"보고서 생성"}
            </button>
            <span style={{ fontSize:10, color:T.textMuted, alignSelf:"center" }}>* 2026년은 4월까지의 실적과 5~12월의 추정치입니다.</span>
          </div>
        </div>

        {/* 빈 상태 */}
        {!data&&!loading&&(
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ background:T.bgCard, borderRadius:10, padding:"60px", border:`0.5px solid ${T.border}`, textAlign:"center", color:T.textMuted }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
              <div style={{ fontSize:13 }}>조회 조건을 선택하고 보고서 생성 버튼을 클릭해주세요.</div>
            </div>
            {/* 표는 보고서 생성 전에도 독립 조회 가능 */}
            <PnlMultiYearTable orgId={orgId} hq1={hq1} hq2={hq2} T={T} />
          </div>
        )}

        {data&&(
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ fontSize:13, fontWeight:500, color:T.textPri }}>{data.orgLabel} · 2026년 {month}월 월간 보고서</div>

            {/* ── 기존 콘텐츠 (AI 코멘트, KPI, 차트) ── */}
            <AiComment text={data.aiComment} T={T} />

            <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:8 }}>
              <MetricCard T={T} title={`매출 (${month}월)`} actual={data.metrics.monthly.revenue.actual} prev={data.metrics.monthly.revenue.prev} yoy={data.metrics.monthly.revenue.yoy} planVal={data.metrics.monthly.rev_plan_m} achievement={data.metrics.monthly.rev_achievement_m} highlight />
              <MetricCard T={T} title={`영업이익 (${month}월)`} actual={data.metrics.monthly.op_profit.actual} prev={data.metrics.monthly.op_profit.prev} yoy={data.metrics.monthly.op_profit.yoy} planVal={data.metrics.monthly.op_plan_m} achievement={data.metrics.monthly.op_achievement_m} />
              <MetricCard T={T} title={`판관비 (${month}월)`} actual={data.metrics.monthly.sga.actual} prev={data.metrics.monthly.sga.prev} yoy={data.metrics.monthly.sga.yoy} planVal={data.metrics.monthly.sga_plan_m} achievement={data.metrics.monthly.sga_achievement_m} />
              <MetricCard T={T} title={`영업이익률 (${month}월)`} actual={data.metrics.monthly.op_margin} prev={data.metrics.monthly.op_margin_prev}
                yoy={data.metrics.monthly.op_margin!=null&&data.metrics.monthly.op_margin_prev!=null?+(data.metrics.monthly.op_margin-data.metrics.monthly.op_margin_prev).toFixed(1):null}
                planVal={data.metrics.monthly.op_margin_plan}
                achievement={data.metrics.monthly.op_margin_plan!=null&&data.metrics.monthly.op_margin!=null?+(data.metrics.monthly.op_margin-data.metrics.monthly.op_margin_plan).toFixed(1):null}
                unit="%" isRate achievementUnit="%p" />
              <MetricCard T={T} title={`누계 매출 (1~${month}월)`} actual={data.metrics.ytd.revenue.actual} prev={data.metrics.ytd.revenue.prev} yoy={data.metrics.ytd.revenue.yoy} planVal={null} achievement={data.metrics.ytd.rev_achievement} highlight />
              <MetricCard T={T} title={`누계 영업이익 (1~${month}월)`} actual={data.metrics.ytd.op_profit.actual} prev={data.metrics.ytd.op_profit.prev} yoy={data.metrics.ytd.op_profit.yoy} planVal={null} achievement={data.metrics.ytd.op_achievement} />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"3fr 1fr", gap:12 }}>
              <div style={{ background:T.bgCard, borderRadius:10, padding:"16px 18px", border:`0.5px solid ${T.border}` }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:500, color:T.textPri }}>월별 {chartTab} 추이 (1~12월)</div>
                    <div style={{ fontSize:10, color:T.textMuted, marginTop:1 }}>단위: 억원 · 4개 시나리오 비교</div>
                  </div>
                  <div style={{ display:"flex", gap:4 }}>
                    {(["매출","영업이익"] as const).map(tab=>(
                      <button key={tab} onClick={()=>setChartTab(tab)} style={{
                        padding:"5px 14px", borderRadius:6,
                        border:`0.5px solid ${chartTab===tab?T.textPri:T.border}`,
                        background:chartTab===tab?T.textPri:"transparent",
                        color:chartTab===tab?T.bgCard:T.textMuted,
                        fontSize:11, fontWeight:chartTab===tab?500:400,
                        cursor:"pointer", transition:"all 0.12s",
                      }}>{tab}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                  <div style={{ width:1, height:12, background:T.borderEm }} />
                  <span style={{ fontSize:9, color:T.textHint }}>5월 이후는 추정치입니다</span>
                </div>
                <MonthlyChart data={buildMonthlyChartData()} chartTab={chartTab} T={T} />
              </div>

              {(()=>{
                const ytdChart=buildYtdChart();
                const YtdTip=({ active,payload,label }:any)=>{
                  if(!active||!payload?.length)return null;
                  const entry=payload[0]?.payload; if(!entry)return null;
                  return(
                    <div style={{ background:T.bgCard, border:`0.5px solid ${T.border}`, borderRadius:8, padding:"8px 12px", fontSize:11, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
                      <div style={{ fontWeight:500, marginBottom:5, color:T.textPri }}>{label}</div>
                      <div style={{ color:T.textMuted, marginBottom:2 }}>매출: <span style={{ color:T.textPri, fontWeight:500 }}>{entry.합계}억원</span></div>
                      <div style={{ color:T.textMuted }}>영업이익: <span style={{ color:T.textPri, fontWeight:500 }}>{entry.이익}억원</span></div>
                    </div>
                  );
                };
                return(
                  <div style={{ background:T.bgCard, borderRadius:10, padding:"16px 18px", border:`0.5px solid ${T.border}` }}>
                    <div style={{ fontSize:12, fontWeight:500, color:T.textPri, marginBottom:2 }}>1~{month}월 누계</div>
                    <div style={{ fontSize:10, color:T.textMuted, marginBottom:10 }}>하단 = 영업이익 · 상단 = 매출</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={ytdChart} margin={{ top:18, right:8, left:0, bottom:0 }} barCategoryGap="25%">
                        <CartesianGrid strokeDasharray="3 3" stroke={T.gridLine} vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize:9, fill:T.textMuted }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize:9, fill:T.textMuted }} axisLine={false} tickLine={false} width={30} />
                        <ReferenceLine y={0} stroke={T.border} />
                        <Tooltip content={<YtdTip />} />
                        <Legend wrapperStyle={{ fontSize:9 }} payload={[
                          { value:"매출",    type:"square" as const, color:"#aaa"    },
                          { value:"영업이익", type:"square" as const, color:"#1C1C1C" },
                        ]}/>
                        <Bar dataKey="이익" name="영업이익" stackId="a" radius={[0,0,0,0]}>
                          {ytdChart.map((e:any,i:number)=><Cell key={i} fill={e.이익색}/>)}
                        </Bar>
                        <Bar dataKey="매출_위" name="매출" stackId="a" radius={[3,3,0,0]}>
                          {ytdChart.map((e:any,i:number)=><Cell key={i} fill={e.매출색}/>)}
                          <LabelList dataKey="합계" position="top" style={{ fontSize:10, fill:T.textPri, fontWeight:500 }} formatter={(v:any)=>v!=null&&v>0?`${v}억`:""}/>
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </div>

            {/* ── 손익 다년도 비교표 (기존 콘텐츠 하단에 추가) ── */}
            <PnlMultiYearTable orgId={orgId} hq1={hq1} hq2={hq2} T={T} />

          </div>
        )}
      </div>
    </div>
  );
}