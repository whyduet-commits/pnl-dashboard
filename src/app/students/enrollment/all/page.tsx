"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { useTheme } from "@/lib/theme";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const SINAI_COLORS_DARK  = ["#F5C418","#c8f04a","#a3e635","#eab308","#84cc16"];
const SINAI_COLORS_LIGHT = ["#1C1C1C","#444444","#666666","#888888","#aaaaaa"];
const GISOUK_COLORS_DARK  = ["#e0e0e0","#aaaaaa","#777777","#555555"];
const GISOUK_COLORS_LIGHT = ["#1C1C1C","#555555","#888888","#aaaaaa"];

const SINAI  = ["강남","목동","분당","대구","대전"];
const GISOUK = ["최상위권 전문관","남학생 전문관","여학생(+여수)","기숙 종합관"];
const ACADEMIES = [...SINAI, ...GISOUK];

const CARD_BORDER_COLORS: Record<string, string> = {
  "강남":"#1C1C1C","목동":"#444","분당":"#666","대구":"#888","대전":"#aaa",
  "최상위권 전문관":"#1C1C1C","남학생 전문관":"#555","여학생(+여수)":"#888","기숙 종합관":"#aaa",
};

type EnrollRow = {
  record_date:string; org_id:number; academy_name:string;
  students_cur:number; nsu_cur:number; total_cur:number;
  students_prev:number; nsu_prev:number; total_prev:number;
  students_tgt:number; nsu_tgt:number; total_tgt:number;
  achievement_rate:number|null; yoy_total_diff:number|null; yoy_total_rate:number|null;
};
type ViewMode = "total"|"students"|"nsu";
const VIEW_LABELS:Record<ViewMode,string> = { total:"총인원", students:"재학생", nsu:"N수" };

function ChartTooltip({ active, payload, label, T }: any) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:T.bgCard, border:`0.5px solid ${T.border}`, borderRadius:8, padding:"10px 14px", fontSize:11, minWidth:160, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
      <div style={{ color:T.textPri, fontWeight:500, marginBottom:8 }}>{label}</div>
      {payload.map((p:any)=>(
        <div key={p.dataKey} style={{ display:"flex", justifyContent:"space-between", gap:16, marginBottom:3 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ width:7,height:7,borderRadius:2,background:p.color,display:"inline-block" }} />
            <span style={{ color:T.textMuted }}>{p.name}</span>
          </div>
          <span style={{ fontWeight:500, color:T.textPri }}>{p.value?.toLocaleString()}명</span>
        </div>
      ))}
    </div>
  );
}

function EnrollChart({ title, subtitle, academies, data, selectedAcademies, T, lineColors }: {
  title:string; subtitle:string; academies:string[]; data:any[];
  selectedAcademies:string[]; T:any; lineColors:string[];
}) {
  const activeAcademies = academies.filter(n => selectedAcademies.includes(n));
  const allVals = data.flatMap(d => activeAcademies.map(n => d[n]).filter((v:any) => v != null)) as number[];
  const minVal = allVals.length ? Math.min(...allVals) : 0;
  const maxVal = allVals.length ? Math.max(...allVals) : 1000;
  const pad    = Math.ceil((maxVal - minVal) * 0.15) || 50;
  const yMin   = Math.max(0, Math.floor((minVal - pad) / 50) * 50);
  const yMax   = Math.ceil((maxVal + pad) / 50) * 50;
  const TooltipWrapper=(props:any)=><ChartTooltip {...props} T={T} />;
  return (
    <div style={{ background:T.bgCard, borderRadius:10, padding:"14px 16px", border:`0.5px solid ${T.border}`, flex:1 }}>
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:12, fontWeight:500, color:T.textPri }}>{title}</div>
        <div style={{ fontSize:10, color:T.textMuted, marginTop:1 }}>{subtitle}</div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top:8, right:16, left:0, bottom:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.gridLine} vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize:8, fill:T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis domain={[yMin,yMax]} tick={{ fontSize:8, fill:T.textMuted }} axisLine={false} tickLine={false} width={42}
            tickFormatter={v=>v.toLocaleString()} />
          <Tooltip content={<TooltipWrapper />} cursor={{ stroke:`rgba(0,0,0,0.06)`, strokeWidth:1 }} />
          <Legend
            content={() => (
              <div style={{ display:"flex", justifyContent:"center", gap:12, fontSize:9, paddingTop:8, flexWrap:"wrap" }}>
                {activeAcademies.map(name=>(
                  <div key={name} style={{ display:"flex", alignItems:"center", gap:4, color:T.textMuted }}>
                    <span style={{ width:9, height:9, borderRadius:2, background:lineColors[academies.indexOf(name)]??T.textMuted, display:"inline-block", flexShrink:0 }} />
                    {name}
                  </div>
                ))}
              </div>
            )}
          />
          {activeAcademies.map((name)=>{
            const color=lineColors[academies.indexOf(name)]??T.textMuted;
            return (
              <Line key={name} type="monotone" dataKey={name}
                stroke={color} strokeWidth={1.8}
                dot={{ r:2, fill:color, strokeWidth:0 }}
                activeDot={{ r:3.5, fill:color, strokeWidth:0 }}
                connectNulls />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function EnrollmentAllPage() {
  const router   = useRouter();
  const supabase = createClient();
  const { T, theme } = useTheme();

  useEffect(()=>{
    const checkAuth=async()=>{ const{data:{user}}=await supabase.auth.getUser(); if(!user)router.replace("/login"); };
    checkAuth();
  },[]);

  const [rows,setRows]=useState<EnrollRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [viewMode,setViewMode]=useState<ViewMode>("total");
  const [selectedAcademies,setSelectedAcademies]=useState<string[]>(["강남","최상위권 전문관"]);
  const [latestDate,setLatestDate]=useState<string>("");

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

  const chartData=useCallback(()=>{
    const dates=[...new Set(rows.map(r=>r.record_date))].sort();
    return dates.map(date=>{
      const dayRows=rows.filter(r=>r.record_date===date);
      const point:any={ date:date.slice(5).replace("-","/") };
      ACADEMIES.forEach(name=>{
        const row=dayRows.find(r=>r.academy_name===name);
        if(row){ point[name]=viewMode==="total"?row.total_cur:viewMode==="students"?row.students_cur:row.nsu_cur; }
      });
      return point;
    });
  },[rows,viewMode]);

  const latestRows=rows.filter(r=>r.record_date===latestDate);
  const sumCur =(arr:EnrollRow[])=>arr.reduce((s,r)=>s+(r.total_cur??0),0);
  const sumPrev=(arr:EnrollRow[])=>arr.reduce((s,r)=>s+(r.total_prev??0),0);
  const sumTgt =(arr:EnrollRow[])=>arr.reduce((s,r)=>s+(r.total_tgt??0),0);
  const sinaiRows  = latestRows.filter(r=>SINAI.includes(r.academy_name));
  const gisoukRows = latestRows.filter(r=>GISOUK.includes(r.academy_name));
  const totalCur=sumCur(latestRows),  totalPrev=sumPrev(latestRows),  totalTgt=sumTgt(latestRows);
  const sinaiCur=sumCur(sinaiRows),   sinaiPrev=sumPrev(sinaiRows),   sinaiTgt=sumTgt(sinaiRows);
  const gisoukCur=sumCur(gisoukRows), gisoukPrev=sumPrev(gisoukRows), gisoukTgt=sumTgt(gisoukRows);
  const yoyPct=(cur:number,prev:number)=>prev>0?((cur-prev)/prev*100):null;
  const achPct=(cur:number,tgt:number)=>tgt>0?(cur/tgt*100):null;
  const toggleAcademy=(name:string)=>setSelectedAcademies(prev=>prev.includes(name)?prev.filter(a=>a!==name):[...prev,name]);
  const cd=chartData();
  const sinaiColors  = theme==="dark" ? SINAI_COLORS_DARK  : SINAI_COLORS_LIGHT;
  const gisoukColors = theme==="dark" ? GISOUK_COLORS_DARK : GISOUK_COLORS_LIGHT;

  const AcademyCard=({ name }:{ name:string })=>{
    const row=latestRows.find(r=>r.academy_name===name);
    if(!row)return null;
    const cur =viewMode==="total"?row.total_cur:viewMode==="students"?row.students_cur:row.nsu_cur;
    const prev=viewMode==="total"?row.total_prev:viewMode==="students"?row.students_prev:row.nsu_prev;
    const tgt =viewMode==="total"?row.total_tgt:viewMode==="students"?row.students_tgt:row.nsu_tgt;
    const yoy=prev>0?((cur-prev)/prev*100):null;
    const ach=tgt>0?(cur/tgt*100):null;
    const topColor=CARD_BORDER_COLORS[name]??"#888";
    return (
      <div style={{ background:T.bgCard, borderRadius:10, padding:"12px 14px", border:`0.5px solid ${T.border}`, borderTop:`2px solid ${topColor}`, cursor:"pointer", opacity:selectedAcademies.includes(name)?1:0.35, transition:"opacity 0.15s" }}
        onClick={()=>toggleAcademy(name)}>
        <div style={{ fontSize:10, color:T.textMuted, marginBottom:3 }}>{name}</div>
        <div style={{ fontSize:18, fontWeight:500, color:T.textPri, letterSpacing:"-0.02em" }}>{cur.toLocaleString()}명</div>
        <div style={{ fontSize:9, color:T.textMuted, marginTop:3, display:"flex", gap:8 }}>
          <span>전년 {prev.toLocaleString()}</span>
          {yoy!=null&&<span style={{ fontWeight:500, color:yoy>=0?"#e24b4a":"#aaa" }}>{yoy>=0?"▲":"▼"}{Math.abs(yoy).toFixed(1)}%</span>}
        </div>
        {ach!=null&&(
          <div style={{ marginTop:5 }}>
            <div style={{ height:2, background:T.border, borderRadius:2, overflow:"hidden" }}>
              <div style={{ width:`${Math.min(ach,100)}%`, height:"100%", background:T.textPri, borderRadius:2 }} />
            </div>
            <div style={{ fontSize:9, color:T.textMuted, textAlign:"right", marginTop:2 }}>{ach.toFixed(1)}%</div>
          </div>
        )}
      </div>
    );
  };

  const SummaryCard=({ label,cur,prev,tgt,topColor }:{ label:string;cur:number;prev:number;tgt:number;topColor:string })=>{
    const yoy=yoyPct(cur,prev), ach=achPct(cur,tgt);
    return (
      <div style={{ background:T.bgCard, borderRadius:10, padding:"14px 16px", border:`0.5px solid ${T.border}`, borderTop:`2px solid ${topColor}` }}>
        <div style={{ fontSize:10, color:T.textMuted, marginBottom:4 }}>{label} (최신)</div>
        <div style={{ fontSize:22, fontWeight:500, color:T.textPri, letterSpacing:"-0.03em" }}>{cur.toLocaleString()}명</div>
        <div style={{ fontSize:10, color:T.textMuted, marginTop:4, display:"flex", gap:8 }}>
          <span>전년 {prev.toLocaleString()}명</span>
          {yoy!=null&&<span style={{ fontWeight:500, color:yoy>=0?"#e24b4a":"#aaa" }}>{yoy>=0?"▲":"▼"}{Math.abs(yoy).toFixed(1)}%</span>}
        </div>
        <div style={{ fontSize:10, color:T.textMuted, marginTop:2 }}>
          목표 {tgt.toLocaleString()}명
          {ach!=null&&<span style={{ marginLeft:6, fontWeight:500, color:ach>=100?"#e24b4a":T.dn }}>{ach.toFixed(1)}%</span>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display:"flex", height:"100vh", width:"100vw", overflow:"hidden", fontFamily:"'SUIT','Pretendard','Noto Sans KR',sans-serif", background:T.bgBase, color:T.textPri }}>
      <Sidebar />
      <div style={{ flex:1, overflow:"auto", padding:"20px 24px" }}>

        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:500, color:T.textPri }}>재원생 등록 추이 (전체)</div>
          <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>
            2026년 전체 학원 일자별 재원생 현황 · 최신 기준일: <span style={{ color:T.textPri, fontWeight:500 }}>{latestDate||"—"}</span>
          </div>
        </div>

        {/* 조회 조건 바 */}
        <div style={{ background:T.bgCard, borderRadius:10, padding:"12px 18px", border:`0.5px solid ${T.border}`, marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:12, fontWeight:500, color:T.textPri, marginRight:4 }}>조회 조건</div>
          <div style={{ display:"flex", gap:4 }}>
            {(["total","students","nsu"] as ViewMode[]).map(m=>(
              <button key={m} onClick={()=>setViewMode(m)} style={{
                padding:"5px 14px", borderRadius:6,
                border:`0.5px solid ${viewMode===m?T.textPri:T.border}`,
                background:viewMode===m?T.textPri:"transparent",
                color:viewMode===m?T.bgCard:T.textMuted,
                fontSize:11, fontWeight:viewMode===m?500:400,
                cursor:"pointer", transition:"all 0.12s",
              }}>{VIEW_LABELS[m]}</button>
            ))}
          </div>
          <span style={{ fontSize:10, color:"#e24b4a", fontWeight:500 }}>
            * 학원별 카드를 클릭하면 차트에서 해당 학원을 숨기거나 표시할 수 있습니다.
          </span>
          <button onClick={()=>setSelectedAcademies(ACADEMIES)} style={{ marginLeft:"auto", padding:"4px 10px", borderRadius:6, border:`0.5px solid ${T.border}`, background:"transparent", color:T.textMuted, fontSize:10, cursor:"pointer" }}>전체 표시</button>
        </div>

        {loading?(
          <div style={{ color:T.textMuted, fontSize:12, padding:40, textAlign:"center" }}>로딩 중...</div>
        ):(
          <>
            {/* 요약 KPI */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
              <SummaryCard label="전체 합계" cur={totalCur}  prev={totalPrev}  tgt={totalTgt}  topColor={T.textPri} />
              <SummaryCard label="시내 합계" cur={sinaiCur}  prev={sinaiPrev}  tgt={sinaiTgt}  topColor="#555" />
              <SummaryCard label="기숙 합계" cur={gisoukCur} prev={gisoukPrev} tgt={gisoukTgt} topColor="#aaa" />
            </div>

            {/* 학원별 카드 */}
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:500, color:T.textMuted, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>시내 학원</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:7, marginBottom:10 }}>
                {SINAI.map(name=><AcademyCard key={name} name={name} />)}
              </div>
              <div style={{ fontSize:10, fontWeight:500, color:T.textMuted, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>기숙 학원</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:7 }}>
                {GISOUK.map(name=><AcademyCard key={name} name={name} />)}
              </div>
            </div>

            {/* 차트 2개 */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <EnrollChart
                title="시내 학원"
                subtitle={selectedAcademies.filter(n=>SINAI.includes(n)).join(" · ")||"선택된 학원 없음"}
                academies={SINAI} data={cd} selectedAcademies={selectedAcademies} T={T} lineColors={sinaiColors} />
              <EnrollChart
                title="기숙 학원"
                subtitle={selectedAcademies.filter(n=>GISOUK.includes(n)).join(" · ")||"선택된 학원 없음"}
                academies={GISOUK} data={cd} selectedAcademies={selectedAcademies} T={T} lineColors={gisoukColors} />
            </div>

            {/* 테이블 */}
            <div style={{ background:T.bgCard, borderRadius:10, padding:"14px 16px", border:`0.5px solid ${T.border}` }}>
              <div style={{ fontSize:12, fontWeight:500, color:T.textPri, marginBottom:10 }}>일자별 상세 현황</div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, tableLayout:"fixed" }}>
                  <thead>
                    <tr style={{ background:T.bgSurface }}>
                      <th rowSpan={2} style={{ padding:"7px 12px", textAlign:"left", color:T.textMuted, fontWeight:500, borderBottom:`0.5px solid ${T.borderEm}`, width:"110px" }}>기준일</th>
                      <th colSpan={SINAI.length} style={{ padding:"4px 10px", textAlign:"center", color:T.textMuted, fontWeight:500, fontSize:10, borderBottom:`0.5px solid ${T.border}` }}>시내</th>
                      <th colSpan={GISOUK.length} style={{ padding:"4px 10px", textAlign:"center", color:T.textMuted, fontWeight:500, fontSize:10, borderBottom:`0.5px solid ${T.border}` }}>기숙</th>
                      <th rowSpan={2} style={{ padding:"7px 10px", textAlign:"right", color:T.textPri, fontWeight:500, borderBottom:`0.5px solid ${T.borderEm}`, width:"80px" }}>합계</th>
                    </tr>
                    <tr style={{ borderBottom:`0.5px solid ${T.borderEm}`, background:T.bgSurface }}>
                      {ACADEMIES.map(name=>(
                        <th key={name} style={{ padding:"5px 10px", textAlign:"right", color:T.textMuted, fontWeight:500, fontSize:10, width:"10%" }}>{name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...new Set(rows.map(r=>r.record_date))].sort().reverse().map(date=>{
                      const dayRows=rows.filter(r=>r.record_date===date);
                      const sum=dayRows.reduce((s,r)=>{ const v=viewMode==="total"?r.total_cur:viewMode==="students"?r.students_cur:r.nsu_cur; return s+(v??0); },0);
                      return (
                        <tr key={date} style={{ borderBottom:`0.5px solid ${T.gridLine}`, height:34 }}
                          onMouseEnter={e=>e.currentTarget.style.background=`rgba(0,0,0,0.02)`}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{ padding:"0 12px", color:T.textMuted, fontSize:11 }}>{date}</td>
                          {ACADEMIES.map(name=>{
                            const row=dayRows.find(r=>r.academy_name===name);
                            const val=row?(viewMode==="total"?row.total_cur:viewMode==="students"?row.students_cur:row.nsu_cur):null;
                            const prev=row?(viewMode==="total"?row.total_prev:viewMode==="students"?row.students_prev:row.nsu_prev):null;
                            const diff=val!=null&&prev!=null?val-prev:null;
                            return (
                              <td key={name} style={{ padding:"0 10px", textAlign:"right", verticalAlign:"middle" }}>
                                <div style={{ color:T.textPri, fontWeight:400 }}>{val?.toLocaleString()??"—"}</div>
                                {diff!=null&&diff!==0&&(
                                  <div style={{ fontSize:9, color:diff>0?"#e24b4a":"#aaa", fontWeight:500 }}>
                                    {diff>0?"▲":"▼"}{Math.abs(diff).toLocaleString()}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ padding:"0 10px", textAlign:"right", fontWeight:500, color:T.textPri }}>{sum.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}