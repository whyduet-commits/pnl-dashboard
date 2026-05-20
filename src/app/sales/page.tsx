"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Sidebar from "@/components/dashboard/Sidebar";
import { useTheme } from "@/lib/theme";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

function ChartTip({ active, payload, label, T }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:T.bgCard, border:`0.5px solid ${T.border}`, borderRadius:8, padding:"9px 12px", fontSize:11, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
      <div style={{ fontWeight:500, color:T.textPri, marginBottom:6 }}>{label}</div>
      {payload.map((p:any) => (
        <div key={p.dataKey} style={{ display:"flex", justifyContent:"space-between", gap:14, marginBottom:2 }}>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ width:7,height:7,borderRadius:2,background:p.color||p.fill,display:"inline-block" }} />
            <span style={{ color:T.textMuted }}>{p.name}</span>
          </div>
          <span style={{ fontWeight:500, color:T.textPri }}>{p.value?.toLocaleString()}명</span>
        </div>
      ))}
    </div>
  );
}

export default function SalesPage() {
  const router   = useRouter();
  const supabase = createClient();
  const { T, theme } = useTheme();

  useEffect(() => {
    const check = async () => {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) router.replace("/login");
    };
    check();
  }, []);

  const [filters, setFilters] = useState({ year:"2026", hq:"전체", academy:"전체", area:"전체", courseType:"전체" });
  const [opts,    setOpts]    = useState<any>(null);
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selInstructor, setSelInstructor] = useState<string|null>(null);

  const fetchOpts = useCallback(async (hq: string) => {
    const p = new URLSearchParams({ filter_only:"1", hq });
    const res = await fetch(`/api/sales/monthly?${p}`);
    const json = await res.json();
    setOpts(json.filters);
  }, []);

  useEffect(() => { fetchOpts(filters.hq); }, [filters.hq, fetchOpts]);

  const fetch25 = useCallback(async () => {
    const p = new URLSearchParams({ year:"2025", hq:filters.hq, academy:filters.academy, area:filters.area, course_type:filters.courseType });
    const res = await fetch(`/api/sales/monthly?${p}`);
    return res.json();
  }, [filters]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ year:filters.year, hq:filters.hq, academy:filters.academy, area:filters.area, course_type:filters.courseType });
    const [cur, prev] = await Promise.all([
      fetch(`/api/sales/monthly?${p}`).then(r=>r.json()),
      filters.year==="2026" ? fetch25() : Promise.resolve(null),
    ]);
    setOpts(cur.filters);
    setData({ cur, prev });
    setLoading(false);
  }, [filters, fetch25]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 월별 추이 차트 데이터
  const chartData = (() => {
    if (!data?.cur?.monthly) return [];
    const months = Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0"));
    return months.map(m => {
      const key   = `${filters.year}-${m}`;
      const key25 = `2025-${m}`;
      const cur  = data.cur.monthly.find((d:any) => `${d.year}-${String(d.month).padStart(2,"0")}` === key);
      const prev = data.prev?.monthly?.find((d:any) => `${d.year}-${String(d.month).padStart(2,"0")}` === key25);
      return { label:`${parseInt(m)}월`, 올해:cur?.total??null, 전년:prev?.total??null };
    });
  })();

  // 강사별 TOP10
  const topInstructors = (() => {
    if (!data?.cur?.byInstructor) return [];
    return Object.entries(data.cur.byInstructor)
      .map(([name, d]:any) => ({ name, total:d.total }))
      .sort((a,b) => b.total - a.total)
      .slice(0, 10);
  })();

  // 선택 강사 월별
  const instructorChart = (() => {
    if (!selInstructor || !data?.cur?.byInstructor?.[selInstructor]) return [];
    const months = Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0"));
    return months.map(m => ({
      label: `${parseInt(m)}월`,
      판매: data.cur.byInstructor[selInstructor].monthly[`${filters.year}-${m}`] ?? null,
    }));
  })();

  // KPI 계산
  const maxMonth = data?.cur?.monthly?.length
    ? Math.max(...(data.cur.monthly.map((d:any)=>d.month) as number[]))
    : 12;
  const totalCur  = data?.cur?.monthly?.reduce((s:number,d:any)=>s+(d.total??0),0) ?? 0;
  const totalPrev = data?.prev?.monthly?.filter((d:any)=>d.month<=maxMonth)?.reduce((s:number,d:any)=>s+(d.total??0),0) ?? 0;
  const yoy = totalPrev > 0 ? ((totalCur-totalPrev)/totalPrev*100) : null;
  const instructorCount     = Object.keys(data?.cur?.byInstructor ?? {}).length;
  const instructorCountPrev = Object.keys(data?.prev?.byInstructor ?? {}).length;
  const instructorYoy = instructorCountPrev > 0 ? ((instructorCount-instructorCountPrev)/instructorCountPrev*100) : null;
  const top3 = (() => {
    if (!data?.cur?.byInstructor) return [];
    return Object.entries(data.cur.byInstructor)
      .map(([name, d]:any) => ({ name, cur:d.total, prev:data?.prev?.byInstructor?.[name]?.total??null }))
      .sort((a,b)=>b.cur-a.cur).slice(0,3);
  })();
  const monthLabel = maxMonth > 0 ? `1~${maxMonth}월 기준` : "—";

  const selStyle:React.CSSProperties = {
    background:T.bgCard, border:`0.5px solid ${T.border}`, borderRadius:7,
    padding:"5px 24px 5px 10px", fontSize:11, color:T.textPri,
    cursor:"pointer", outline:"none", appearance:"none",
    backgroundImage:`url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat:"no-repeat", backgroundPosition:"right 8px center",
    colorScheme: theme==="dark" ? "dark" : "light",
  };
  const TipComp = (props:any) => <ChartTip {...props} T={T} />;
  const barColor = theme==="dark" ? "#F5C418" : "#1C1C1C";

  return (
    <div style={{ display:"flex", height:"100vh", width:"100vw", overflow:"hidden", fontFamily:"'SUIT','Pretendard','Noto Sans KR',sans-serif", background:T.bgBase, color:T.textPri }}>
      <Sidebar />
      <div style={{ flex:1, overflow:"auto", padding:"20px 24px" }}>

        {/* 헤더 */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:500, color:T.textPri }}>단과 판매 분석</div>
          <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>학원별 강사별 월별 판매장수 현황 · 2025~2026년</div>
        </div>

        {/* 필터 */}
        <div style={{ background:T.bgCard, borderRadius:10, padding:"12px 18px", border:`0.5px solid ${T.border}`, marginBottom:14, display:"flex", alignItems:"flex-end", gap:10, flexWrap:"wrap" }}>
          {[
            { label:"연도", key:"year", options:[{v:"2025",l:"2025년"},{v:"2026",l:"2026년"}] },
            { label:"본부", key:"hq", options:[{v:"전체",l:"전체"}, ...(opts?.hqList??[]).map((v:string)=>({v,l:v}))] },
            { label:"학원", key:"academy", options:[{v:"전체",l:"전체"}, ...(opts?.academyList??[]).map((v:string)=>({v,l:v}))] },
            { label:"영역", key:"area", options:[{v:"전체",l:"전체"}, ...(opts?.areaList??[]).map((v:string)=>({v,l:v}))] },
            { label:"강좌구분", key:"courseType", options:[{v:"전체",l:"전체"}, ...(opts?.courseTypeList??[]).map((v:string)=>({v,l:v}))] },
          ].map(f=>(
            <div key={f.key} style={{ display:"flex", flexDirection:"column", gap:3 }}>
              <span style={{ fontSize:9, color:T.textMuted }}>{f.label}</span>
              <select value={(filters as any)[f.key]} onChange={e=>{
                const val = e.target.value;
                setFilters(p => { const n={...p,[f.key]:val}; if(f.key==="hq") n.academy="전체"; return n; });
              }} style={selStyle}>
                {f.options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* KPI 카드 */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
          <div style={{ background:T.bgCard, borderRadius:10, padding:"12px 14px", border:`0.5px solid ${T.border}`, borderTop:"2px solid #1C1C1C" }}>
            <div style={{ fontSize:9, color:T.textMuted, marginBottom:4 }}>총 판매장수 (1~{maxMonth}월)</div>
            <div style={{ fontSize:18, fontWeight:500, color:T.textPri, letterSpacing:"-0.02em" }}>{totalCur.toLocaleString()}명</div>
            <div style={{ fontSize:9, color:T.textMuted, marginTop:2 }}>
              전년 동기 {totalPrev.toLocaleString()}명
              {yoy!=null&&<span style={{ marginLeft:6, fontWeight:500, color:yoy>=0?"#e24b4a":"#aaa" }}>{yoy>=0?"▲":"▼"}{Math.abs(yoy).toFixed(1)}%</span>}
            </div>
          </div>
          <div style={{ background:T.bgCard, borderRadius:10, padding:"12px 14px", border:`0.5px solid ${T.border}`, borderTop:"2px solid #555" }}>
            <div style={{ fontSize:9, color:T.textMuted, marginBottom:4 }}>강사 수</div>
            <div style={{ fontSize:18, fontWeight:500, color:T.textPri, letterSpacing:"-0.02em" }}>{instructorCount}명</div>
            <div style={{ fontSize:9, color:T.textMuted, marginTop:2 }}>
              전년 {instructorCountPrev}명
              {instructorYoy!=null&&<span style={{ marginLeft:6, fontWeight:500, color:instructorYoy>=0?"#e24b4a":"#aaa" }}>{instructorYoy>=0?"▲":"▼"}{Math.abs(instructorYoy).toFixed(1)}%</span>}
            </div>
          </div>
          <div style={{ background:T.bgCard, borderRadius:10, padding:"12px 14px", border:`0.5px solid ${T.border}`, borderTop:"2px solid #888" }}>
            <div style={{ fontSize:9, color:T.textMuted, marginBottom:6 }}>판매 TOP 3 강사</div>
            {top3.map((ins, i) => (
              <div key={ins.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:3 }}>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ fontSize:9, color:T.textHint, width:12 }}>{i+1}.</span>
                  <span style={{ fontSize:10, fontWeight:i===0?500:400, color:T.textPri }}>{ins.name}</span>
                </div>
                <div style={{ fontSize:9, textAlign:"right" }}>
                  <span style={{ color:T.textPri, fontWeight:500 }}>{ins.cur.toLocaleString()}</span>
                  {ins.prev!=null && ins.prev > 0 ? (
                    <>
                      <span style={{ marginLeft:4, color:T.textHint }}>/ 전년 {ins.prev.toLocaleString()}</span>
                      <span style={{ marginLeft:4, fontWeight:500, color:((ins.cur-ins.prev)/ins.prev*100)>=0?"#e24b4a":"#aaa" }}>
                        {((ins.cur-ins.prev)/ins.prev*100)>=0?"▲":"▼"}{Math.abs((ins.cur-ins.prev)/ins.prev*100).toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <span style={{ marginLeft:4, color:T.textHint }}>/ —</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:T.bgCard, borderRadius:10, padding:"12px 14px", border:`0.5px solid ${T.border}`, borderTop:"2px solid #aaa" }}>
            <div style={{ fontSize:9, color:T.textMuted, marginBottom:4 }}>월평균 판매</div>
            <div style={{ fontSize:18, fontWeight:500, color:T.textPri, letterSpacing:"-0.02em" }}>
              {Math.round(totalCur/Math.max(maxMonth,1)).toLocaleString()}명
            </div>
            <div style={{ fontSize:9, color:T.textMuted, marginTop:2 }}>{monthLabel}</div>
          </div>
        </div>

        {loading ? (
          <div style={{ color:T.textMuted, fontSize:12, padding:40, textAlign:"center" }}>로딩 중...</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

            {/* ── 월별 추이 차트 ── */}
            <div style={{ background:T.bgCard, borderRadius:10, padding:"16px 18px", border:`0.5px solid ${T.border}` }}>
              <div style={{ fontSize:12, fontWeight:500, color:T.textPri, marginBottom:2 }}>월별 판매장수 추이</div>
              <div style={{ display:"flex", gap:14, marginBottom:8, marginTop:4 }}>
                <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:T.textMuted }}>
                  <span style={{ width:16,height:2,background:barColor,display:"inline-block",borderRadius:1 }} />{filters.year}년
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:T.textMuted }}>
                  <span style={{ width:16,height:1,background:"#aaa",display:"inline-block",borderRadius:1 }} />전년
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top:8, right:20, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.gridLine} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize:9, fill:T.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:9, fill:T.textMuted }} axisLine={false} tickLine={false} width={45} tickFormatter={v=>v.toLocaleString()} />
                  <Tooltip content={<TipComp />} cursor={{ stroke:"rgba(0,0,0,0.04)" }} />
                  <Line dataKey="올해" stroke={barColor} strokeWidth={2} dot={{ r:2.5, fill:barColor, strokeWidth:0 }} activeDot={{ r:4 }} connectNulls />
                  <Line dataKey="전년" stroke="#aaa" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* ── 강사별 비교 ── */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {/* TOP 10 */}
              <div style={{ background:T.bgCard, borderRadius:10, padding:"14px 16px", border:`0.5px solid ${T.border}` }}>
                <div style={{ fontSize:12, fontWeight:500, color:T.textPri, marginBottom:2 }}>강사별 판매장수 TOP 10</div>
                <div style={{ fontSize:10, color:T.textMuted, marginBottom:10 }}>클릭 시 우측에 월별 추이 표시</div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topInstructors} layout="vertical" margin={{ top:0, right:30, left:60, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.gridLine} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize:8, fill:T.textMuted }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize:9, fill:T.textMuted }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<TipComp />} />
                    <Bar dataKey="total" name="판매장수" fill={barColor} radius={[0,2,2,0]} barSize={14}
                      onClick={(d:any)=>setSelInstructor(d.name)} cursor="pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 선택 강사 월별 */}
              <div style={{ background:T.bgCard, borderRadius:10, padding:"14px 16px", border:`0.5px solid ${T.border}` }}>
                <div style={{ fontSize:12, fontWeight:500, color:T.textPri, marginBottom:2 }}>
                  {selInstructor ? `${selInstructor} · 월별 추이` : "강사를 선택해 주세요"}
                </div>
                <div style={{ fontSize:10, color:T.textMuted, marginBottom:10 }}>{filters.year}년 월별 판매장수</div>
                {selInstructor ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={instructorChart} margin={{ top:8, right:16, left:0, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.gridLine} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize:9, fill:T.textMuted }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize:9, fill:T.textMuted }} axisLine={false} tickLine={false} width={35} />
                      <Tooltip content={<TipComp />} />
                      <Bar dataKey="판매" fill={barColor} radius={[2,2,0,0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height:300, display:"flex", alignItems:"center", justifyContent:"center", color:T.textHint, fontSize:12 }}>
                    왼쪽 차트에서 강사를 클릭하세요
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}