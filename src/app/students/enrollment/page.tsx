"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { useTheme } from "@/lib/theme";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

const SINAI  = ["강남","목동","분당","대구","대전"];
const GISOUK = ["최상위권 전문관","남학생 전문관","여학생(+여수)","기숙 종합관"];
const ACADEMIES = [...SINAI, ...GISOUK];

type EnrollRow = {
  record_date:string; org_id:number; academy_name:string;
  students_cur:number; nsu_cur:number; total_cur:number;
  students_prev:number; nsu_prev:number; total_prev:number;
  students_tgt:number; nsu_tgt:number; total_tgt:number;
  achievement_rate:number|null; yoy_total_diff:number|null; yoy_total_rate:number|null;
};
type ViewMode = "total"|"students"|"nsu";
const VIEW_LABELS:Record<ViewMode,string> = { total:"총인원", students:"재학생", nsu:"N수" };

// 툴팁
function ChartTip({ active, payload, label, T }: any) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:T.bgCard, border:`0.5px solid ${T.border}`, borderRadius:8, padding:"9px 12px", fontSize:11, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
      <div style={{ fontWeight:500, color:T.textPri, marginBottom:6 }}>{label}</div>
      {payload.map((p:any) => (
        <div key={p.dataKey} style={{ display:"flex", justifyContent:"space-between", gap:14, marginBottom:2 }}>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ width:7, height:7, borderRadius:2, background:p.fill||p.stroke, display:"inline-block" }} />
            <span style={{ color:T.textMuted }}>{p.name}</span>
          </div>
          <span style={{ fontWeight:500, color:T.textPri }}>{p.value?.toLocaleString()}명</span>
        </div>
      ))}
    </div>
  );
}

export default function EnrollmentPage() {
  const router   = useRouter();
  const supabase = createClient();
  const { T, theme } = useTheme();

  useEffect(()=>{
    const checkAuth=async()=>{ const{data:{user}}=await supabase.auth.getUser(); if(!user)router.replace("/login"); };
    checkAuth();
  },[]);

  const [rows,       setRows]       = useState<EnrollRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [viewMode,   setViewMode]   = useState<ViewMode>("total");
  const [selected,   setSelected]   = useState<string>("강남");
  const [latestDate, setLatestDate] = useState<string>("");

  useEffect(()=>{
    const fetchData=async()=>{
      setLoading(true);
      try {
        const res=await fetch("/api/enrollment");
        const json=await res.json();
        if(json.data){
          setRows(json.data as EnrollRow[]);
          const dates=[...new Set(json.data.map((r:any)=>r.record_date))].sort() as string[];
          setLatestDate(dates[dates.length-1]??"");
        }
      } catch(e){ console.error(e); }
      setLoading(false);
    };
    fetchData();
  },[]);

  // 선택 학원 데이터
  const academyRows = rows.filter(r=>r.academy_name===selected);
  const latestRow   = academyRows.find(r=>r.record_date===latestDate);

  const getCur  = (r:EnrollRow) => viewMode==="total"?r.total_cur  :viewMode==="students"?r.students_cur  :r.nsu_cur;
  const getPrev = (r:EnrollRow) => viewMode==="total"?r.total_prev :viewMode==="students"?r.students_prev :r.nsu_prev;
  const getTgt  = (r:EnrollRow) => viewMode==="total"?r.total_tgt  :viewMode==="students"?r.students_tgt  :r.nsu_tgt;

  const curVal  = latestRow ? getCur(latestRow)  : null;
  const prevVal = latestRow ? getPrev(latestRow) : null;
  const tgtVal  = latestRow ? getTgt(latestRow)  : null;
  const yoy     = curVal!=null&&prevVal!=null&&prevVal>0 ? ((curVal-prevVal)/prevVal*100) : null;
  const ach     = curVal!=null&&tgtVal!=null&&tgtVal>0   ? (curVal/tgtVal*100) : null;
  const diff    = curVal!=null&&prevVal!=null ? curVal-prevVal : null;
  const remain  = curVal!=null&&tgtVal!=null  ? tgtVal-curVal : null;

  // 차트 데이터
  const chartData = [...new Set(rows.map(r=>r.record_date))].sort().map(date=>{
    const row = rows.find(r=>r.record_date===date&&r.academy_name===selected);
    return {
      date:  date.slice(5).replace("-","/"),
      올해:  row ? getCur(row)  : null,
      전년:  row ? getPrev(row) : null,
      목표:  row ? getTgt(row)  : null,
    };
  });

  // Y축 범위 자동
  const allVals = chartData.flatMap(d=>[d.올해,d.전년,d.목표]).filter(v=>v!=null) as number[];
  const minV = allVals.length ? Math.min(...allVals) : 0;
  const maxV = allVals.length ? Math.max(...allVals) : 500;
  const pad  = Math.ceil((maxV-minV)*0.2)||50;
  const yMin = Math.max(0, Math.floor((minV-pad)/50)*50);
  const yMax = Math.ceil((maxV+pad)/50)*50;



  const selStyle:React.CSSProperties = {
    padding:"5px 12px", borderRadius:20, fontSize:10, cursor:"pointer", transition:"all 0.12s",
  };

  const TooltipWrapper=(props:any)=><ChartTip {...props} T={T} />;

  // 다크 모드 차트 색상
  const barColor  = theme==="dark" ? "#F5C418"            : "#1C1C1C";
  const lineColor = theme==="dark" ? "rgba(180,180,180,0.8)" : "#aaaaaa";
  const tgtColor  = "#e24b4a";

  return (
    <div style={{ display:"flex", height:"100vh", width:"100vw", overflow:"hidden", fontFamily:"'SUIT','Pretendard','Noto Sans KR',sans-serif", background:T.bgBase, color:T.textPri }}>
      <Sidebar />
      <div style={{ flex:1, overflow:"auto", padding:"20px 24px" }}>

        {/* 헤더 */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:500, color:T.textPri }}>재원생 등록 추이</div>
          <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>
            2026년 학원별 일자별 재원생 현황 · 최신 기준일: <span style={{ color:T.textPri, fontWeight:500 }}>{latestDate||"—"}</span>
          </div>
        </div>

        {/* 학원 선택 */}
        <div style={{ background:T.bgCard, borderRadius:10, padding:"14px 18px", border:`0.5px solid ${T.border}`, marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:500, color:T.textPri, marginBottom:10 }}>
            학원 선택
            <span style={{ fontSize:9, color:"#e24b4a", fontWeight:400, marginLeft:6 }}>* 1개만 선택 가능</span>
          </div>
          <div style={{ fontSize:9, color:T.textMuted, marginBottom:6, letterSpacing:"0.05em", textTransform:"uppercase" }}>시내</div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
            {SINAI.map(name=>(
              <button key={name} onClick={()=>setSelected(name)} style={{
                ...selStyle,
                border:`0.5px solid ${selected===name?T.textPri:T.border}`,
                background:selected===name?T.textPri:"transparent",
                color:selected===name?T.bgCard:T.textMuted,
                fontWeight:selected===name?500:400,
              }}>{name}</button>
            ))}
          </div>
          <div style={{ fontSize:9, color:T.textMuted, marginBottom:6, letterSpacing:"0.05em", textTransform:"uppercase" }}>기숙</div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {GISOUK.map(name=>(
              <button key={name} onClick={()=>setSelected(name)} style={{
                ...selStyle,
                border:`0.5px solid ${selected===name?T.textPri:T.border}`,
                background:selected===name?T.textPri:"transparent",
                color:selected===name?T.bgCard:T.textMuted,
                fontWeight:selected===name?500:400,
              }}>{name}</button>
            ))}
          </div>
        </div>

        {loading?(
          <div style={{ color:T.textMuted, fontSize:12, padding:40, textAlign:"center" }}>로딩 중...</div>
        ):(
          <div style={{ background:T.bgCard, borderRadius:10, padding:"16px 18px", border:`0.5px solid ${T.border}` }}>

            {/* 차트 헤더 + 뷰 탭 */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:500, color:T.textPri }}>{selected} · 재원생 등록 추이</div>
                <div style={{ fontSize:10, color:T.textMuted, marginTop:1 }}>최신 기준일: {latestDate||"—"}</div>
              </div>
              <div style={{ display:"flex", gap:4 }}>
                {(["total","students","nsu"] as ViewMode[]).map(m=>(
                  <button key={m} onClick={()=>setViewMode(m)} style={{
                    padding:"5px 12px", borderRadius:6, fontSize:10, cursor:"pointer", transition:"all 0.12s",
                    border:`0.5px solid ${viewMode===m?T.textPri:T.border}`,
                    background:viewMode===m?T.textPri:"transparent",
                    color:viewMode===m?T.bgCard:T.textMuted,
                    fontWeight:viewMode===m?500:400,
                  }}>{VIEW_LABELS[m]}</button>
                ))}
              </div>
            </div>

            {/* KPI 배지 4개 */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
              <div style={{ background:T.bgSurface, border:`0.5px solid ${T.border}`, borderTop:`2px solid ${T.textPri}`, borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:9, color:T.textMuted, marginBottom:4 }}>현재 ({latestDate.slice(5)||"—"})</div>
                <div style={{ fontSize:18, fontWeight:500, color:T.textPri, letterSpacing:"-0.02em" }}>{curVal?.toLocaleString()??"—"}명</div>
                <div style={{ fontSize:9, color:T.textMuted, marginTop:2 }}>전년 {prevVal?.toLocaleString()??"—"}명</div>
              </div>
              <div style={{ background:T.bgSurface, border:`0.5px solid ${T.border}`, borderTop:`2px solid ${yoy!=null&&yoy>=0?"#e24b4a":"#aaa"}`, borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:9, color:T.textMuted, marginBottom:4 }}>전년 대비</div>
                <div style={{ fontSize:18, fontWeight:500, letterSpacing:"-0.02em", color:yoy!=null?(yoy>=0?"#e24b4a":"#aaa"):T.textPri }}>
                  {yoy!=null?`${yoy>=0?"▲":"▼"}${Math.abs(yoy).toFixed(1)}%`:"—"}
                </div>
                <div style={{ fontSize:9, color:T.textMuted, marginTop:2 }}>
                  {diff!=null?`${diff>=0?"+":""}${diff.toLocaleString()}명`:"—"}
                </div>
              </div>
              <div style={{ background:T.bgSurface, border:`0.5px solid ${T.border}`, borderTop:`2px solid #888`, borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:9, color:T.textMuted, marginBottom:4 }}>목표 달성률</div>
                <div style={{ fontSize:18, fontWeight:500, color:T.textPri, letterSpacing:"-0.02em" }}>{ach!=null?`${ach.toFixed(1)}%`:"—"}</div>
                <div style={{ fontSize:9, color:T.textMuted, marginTop:2 }}>목표 {tgtVal?.toLocaleString()??"—"}명</div>
              </div>
              <div style={{ background:T.bgSurface, border:`0.5px solid ${T.border}`, borderTop:`2px solid #aaa`, borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:9, color:T.textMuted, marginBottom:4 }}>목표 잔여</div>
                <div style={{ fontSize:18, fontWeight:500, color:T.textPri, letterSpacing:"-0.02em" }}>
                  {remain!=null?(remain>0?`${remain.toLocaleString()}명 부족`:"달성!"):"—"}
                </div>
                <div style={{ fontSize:9, color:T.textMuted, marginTop:2 }}>
                  {ach!=null&&ach>=100?"목표 초과 달성":"목표까지 남은 인원"}
                </div>
              </div>
            </div>

            {/* 범례 */}
            <div style={{ display:"flex", gap:14, marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:T.textMuted }}>
                <span style={{ width:10, height:10, borderRadius:2, background:barColor, display:"inline-block" }} />
                올해 실적
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:T.textMuted }}>
                <span style={{ width:18, height:2, background:lineColor, display:"inline-block", borderRadius:1 }} />
                전년 실적
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:T.textMuted }}>
                <span style={{ width:18, height:2, background:tgtColor, display:"inline-block", borderRadius:1 }} />
                목표
              </div>
            </div>

            {/* 차트 */}
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top:10, right:20, left:0, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.gridLine} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize:8, fill:T.textMuted }} axisLine={false} tickLine={false} />
                <YAxis domain={[yMin,yMax]} tick={{ fontSize:8, fill:T.textMuted }} axisLine={false} tickLine={false} width={40}
                  tickFormatter={v=>v.toLocaleString()} />
                <Tooltip content={<TooltipWrapper />} cursor={{ fill:"rgba(0,0,0,0.03)" }} />
                {/* 올해 실적 — 막대 */}
                <Bar dataKey="올해" name="올해 실적" fill={barColor} radius={[2,2,0,0]} barSize={14} opacity={0.9} />
                {/* 전년 실적 — 회색 실선 */}
                <Line dataKey="전년" name="전년 실적" type="monotone"
                  stroke={lineColor} strokeWidth={1.8}
                  dot={false} activeDot={{ r:3, fill:lineColor, strokeWidth:0 }}
                  connectNulls />
                {/* 목표 — 빨강 점선 (날짜별) */}
                <Line dataKey="목표" name="목표" type="monotone"
                  stroke={tgtColor} strokeWidth={1.5} strokeDasharray="6 4"
                  dot={false} activeDot={{ r:3, fill:tgtColor, strokeWidth:0 }}
                  connectNulls />
              </ComposedChart>
            </ResponsiveContainer>

            {/* 일자별 상세 테이블 — 선택 학원 그룹 전체 표시 */}
            {(()=>{
              // 선택 학원이 시내면 시내 5개, 기숙이면 기숙 4개
              const isSinai   = SINAI.includes(selected);
              const groupList = isSinai ? SINAI : GISOUK;
              const groupLabel= isSinai ? "시내" : "기숙";
              const allDates  = [...new Set(rows.map(r=>r.record_date))].sort().reverse();
              // 열 너비: 기준일 + 그룹 학원 수 × (올해+전년+전년대비+달성률)
              // 가로 컬럼: 기준일 | 학원A(올해/전년/대비/달성) | 학원B ...
              return (
                <div style={{ marginTop:20 }}>
                  <div style={{ fontSize:11, fontWeight:500, color:T.textPri, marginBottom:8 }}>
                    일자별 상세 현황 — {groupLabel} 학원
                  </div>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10, tableLayout:"fixed" }}>
                      <colgroup>
                        <col style={{ width:"90px" }} />
                        {groupList.map(n=>[
                          <col key={n+"-c"} style={{ width:"60px" }} />,
                          <col key={n+"-p"} style={{ width:"55px" }} />,
                          <col key={n+"-d"} style={{ width:"65px" }} />,
                          <col key={n+"-a"} style={{ width:"60px" }} />,
                        ])}
                      </colgroup>
                      <thead>
                        {/* 1행: 학원명 */}
                        <tr style={{ background:T.bgSurface }}>
                          <th rowSpan={2} style={{ padding:"7px 12px", textAlign:"left", color:T.textMuted, fontWeight:500, borderBottom:`0.5px solid ${T.borderEm}`, fontSize:10 }}>기준일</th>
                          {groupList.map(name=>(
                            <th key={name} colSpan={4} style={{ padding:"5px 8px", textAlign:"center", color:T.textPri, fontWeight:500, fontSize:10, borderBottom:`0.5px solid ${T.border}`, borderLeft:`0.5px solid ${T.gridLine}` }}>{name}</th>
                          ))}
                        </tr>
                        {/* 2행: 올해/전년/전년대비/달성률 */}
                        <tr style={{ borderBottom:`0.5px solid ${T.borderEm}`, background:T.bgSurface }}>
                          {groupList.map(name=>(
                            <>
                              <th key={name+"-c"} style={{ padding:"5px 6px", textAlign:"right", color:T.textPri, fontWeight:500, fontSize:9, borderLeft:`0.5px solid ${T.gridLine}` }}>올해</th>
                              <th key={name+"-p"} style={{ padding:"5px 6px", textAlign:"right", color:T.textMuted, fontWeight:400, fontSize:9 }}>전년</th>
                              <th key={name+"-d"} style={{ padding:"5px 6px", textAlign:"right", color:T.textMuted, fontWeight:400, fontSize:9 }}>대비</th>
                              <th key={name+"-a"} style={{ padding:"5px 6px", textAlign:"right", color:T.textMuted, fontWeight:400, fontSize:9 }}>달성률</th>
                            </>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allDates.map(date=>(
                          <tr key={date} style={{ borderBottom:`0.5px solid ${T.gridLine}`, height:32 }}
                            onMouseEnter={e=>e.currentTarget.style.background=`rgba(0,0,0,0.02)`}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <td style={{ padding:"0 12px", color:T.textMuted, fontSize:10 }}>{date}</td>
                            {groupList.map(name=>{
                              const row = rows.find(r=>r.record_date===date&&r.academy_name===name);
                              const cur  = row ? getCur(row)  : null;
                              const prev = row ? getPrev(row) : null;
                              const tgt  = row ? getTgt(row)  : null;
                              const yoyR = cur!=null&&prev!=null&&prev>0 ? ((cur-prev)/prev*100) : null;
                              const achR = cur!=null&&tgt!=null&&tgt>0   ? (cur/tgt*100)         : null;
                              const dif  = cur!=null&&prev!=null ? cur-prev : null;
                              return (
                                <>
                                  <td key={name+"-c"} style={{ padding:"0 6px", textAlign:"right", color: name===selected?T.textPri:T.textMuted, fontWeight:name===selected?500:400, borderLeft:`0.5px solid ${T.gridLine}` }}>
                                    {cur?.toLocaleString()??"—"}
                                  </td>
                                  <td key={name+"-p"} style={{ padding:"0 6px", textAlign:"right", color:T.textMuted }}>
                                    {prev?.toLocaleString()??"—"}
                                  </td>
                                  <td key={name+"-d"} style={{ padding:"0 6px", textAlign:"right" }}>
                                    {yoyR!=null
                                      ? <span style={{ color:yoyR>=0?"#e24b4a":"#aaa", fontWeight:500 }}>{yoyR>=0?"▲":"▼"}{Math.abs(yoyR).toFixed(1)}%</span>
                                      : <span style={{ color:T.textHint }}>—</span>}
                                  </td>
                                  <td key={name+"-a"} style={{ padding:"0 6px", textAlign:"right" }}>
                                    {achR!=null
                                      ? <span style={{ color:achR>=100?"#e24b4a":T.textMuted, fontWeight:500 }}>{achR.toFixed(1)}%</span>
                                      : <span style={{ color:T.textHint }}>—</span>}
                                  </td>
                                </>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

          </div>
        )}
      </div>
    </div>
  );
}