"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Sidebar from "@/components/dashboard/Sidebar";
import { useTheme } from "@/lib/theme";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

const DAYS    = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
const DAY_KR  = ["월","화","수","목","금","토","일"];
const SLOTS   = ["오전","오후","저녁"];

// 학원 약칭 → 색상
const ACADEMY_COLORS: Record<string,string> = {
  "강남":"#1C1C1C","목동":"#444","분당":"#666","대구":"#888","대전":"#aaa",
  "대치":"#555","부천":"#777","센텀":"#999","영통":"#bbb",
  "울산":"#333","원주":"#666","전주":"#888","중계":"#aaa","청주":"#ccc","평촌":"#ddd",
};

function ChartTip({ active, payload, label, T }: any) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:T.bgCard, border:`0.5px solid ${T.border}`, borderRadius:8, padding:"9px 12px", fontSize:11, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
      <div style={{ fontWeight:500, color:T.textPri, marginBottom:5 }}>{label}</div>
      {payload.map((p:any)=>(
        <div key={p.dataKey} style={{ display:"flex", justifyContent:"space-between", gap:14, marginBottom:2 }}>
          <span style={{ color:T.textMuted }}>{p.name}</span>
          <span style={{ fontWeight:500, color:T.textPri }}>{p.value?.toLocaleString()}명</span>
        </div>
      ))}
    </div>
  );
}
function InstructorSearch({ instructorList, onSelect, T }: {
  instructorList: string[]; onSelect: (v:string)=>void; T:any;
}) {
  const [query,    setQuery]    = useState("");
  const [touched,  setTouched]  = useState(false);

  const matched = query.trim()
    ? instructorList.filter(n => n.includes(query.trim()))
    : [];
  const notFound = touched && query.trim().length > 0 && matched.length === 0;

  const handleSelect = (name: string) => {
    onSelect(name);
    setQuery("");     // 선택 후 검색창 초기화 → 바로 다음 강사 검색 가능
    setTouched(false);
  };

  return (
    <div style={{ position:"relative" }}>
      <input
        type="text"
        value={query}
        placeholder="강사명 입력"
        onChange={e=>{ setQuery(e.target.value); setTouched(true); }}
        style={{
          background:T.bgCard, border:`0.5px solid ${T.border}`,
          borderRadius:7, padding:"5px 10px",
          fontSize:11, color:T.textPri, outline:"none",
          width:120,
        }}
      />
      {/* 자동완성 드롭다운 */}
      {touched && query.trim().length > 0 && (
        <div style={{
          position:"absolute", top:"calc(100% + 4px)", left:0, zIndex:100,
          background:T.bgCard, border:`0.5px solid ${T.border}`,
          borderRadius:8, minWidth:140, boxShadow:"0 4px 16px rgba(0,0,0,0.1)",
          maxHeight:200, overflowY:"auto",
        }}>
          {notFound ? (
            <div style={{ padding:"10px 12px", fontSize:11, color:T.textMuted }}>
              해당 강사가 없습니다
            </div>
          ) : (
            matched.map(name=>(
              <div key={name}
                onClick={()=>handleSelect(name)}
                style={{
                  padding:"8px 12px", fontSize:11, cursor:"pointer",
                  color:T.textPri,
                  borderBottom:`0.5px solid ${T.gridLine}`,
                }}
                onMouseEnter={e=>(e.currentTarget.style.background=T.bgSurface)}
                onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
              >
                {name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
export default function InstructorPage() {
  const router   = useRouter();
  const supabase = createClient();
  const { T, theme } = useTheme();

  useEffect(()=>{
    const check=async()=>{ const{data:{user}}=await supabase.auth.getUser(); if(!user)router.replace("/login"); };
    check();
  },[]);

  const [area,       setArea]       = useState("전체");
  const [subject,    setSubject]    = useState("전체");
  const [instructor, setInstructor] = useState("");
  const [yearRange,  setYearRange]  = useState("2025~2026 전체");
  const [data,       setData]       = useState<any>(null);
  const [loading,    setLoading]    = useState(false);
 const [opts,     setOpts]     = useState<any>(null);
  const [allInstructors, setAllInstructors] = useState<string[]>([]); // 전체 강사 목록 (검색용)

  // 초기 필터 로드 + 전체 강사 목록 별도 저장
  useEffect(()=>{
    fetch("/api/sales/instructor").then(r=>r.json()).then(d=>{
      setOpts(d);
      setAllInstructors(d?.instructorList ?? []);
    });
  },[]);

  // 데이터 조회
  const fetchData = useCallback(async()=>{
    if (!instructor) return;
    setLoading(true);
    const [yFrom,yTo] = yearRange==="2026년"?["2026","2026"]:yearRange==="2025년"?["2025","2025"]:["2025","2026"];
    const p = new URLSearchParams({ instructor, area, subject, year_from:yFrom, year_to:yTo });
    const res = await fetch(`/api/sales/instructor?${p}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  },[instructor, area, subject, yearRange]);

  useEffect(()=>{ fetchData(); },[fetchData]);

  // 필터 변경 시 강사 목록 갱신
  useEffect(()=>{
    const p = new URLSearchParams({ area, subject });
    fetch(`/api/sales/instructor?${p}`).then(r=>r.json()).then(d=>setOpts(d));
  },[area, subject]);

  // 차트 데이터 — 1~12월 고정, 올해+전년 나란히 비교
  const chartData = (() => {
    if (!data?.monthly) return [];
    // 기간 설정에서 올해/전년 연도 결정
    const curYear  = yearRange==="2025년" ? 2025 : 2026;
    const prevYear = curYear - 1;
    return Array.from({length:12}, (_,i) => {
      const m   = String(i+1).padStart(2,"0");
      const cur  = data.monthly[`${curYear}-${m}`]  ?? null;
      const prev = data.monthly[`${prevYear}-${m}`] ?? null;
      return { label:`${i+1}월`, 올해:cur, 전년:prev };
    });
  })();

  const selStyle:React.CSSProperties = {
    background:T.bgCard, border:`0.5px solid ${T.border}`, borderRadius:7,
    padding:"5px 24px 5px 10px", fontSize:11, color:T.textPri,
    cursor:"pointer", outline:"none", appearance:"none",
    backgroundImage:`url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat:"no-repeat", backgroundPosition:"right 8px center",
    colorScheme: theme==="dark"?"dark":"light",
  };

  const barColor = theme==="dark" ? "#F5C418" : "#1C1C1C";
  const TipComp  = (props:any) => <ChartTip {...props} T={T} />;

  return (
    <div style={{ display:"flex", height:"100vh", width:"100vw", overflow:"hidden", fontFamily:"'SUIT','Pretendard','Noto Sans KR',sans-serif", background:T.bgBase, color:T.textPri }}>
      <Sidebar />
      <div style={{ flex:1, overflow:"auto", padding:"20px 24px" }}>

        {/* 헤더 */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:500, color:T.textPri }}>개별 강사 현황</div>
          <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>강사별 학원 · 강좌구분 · 월별 판매장수 상세</div>
        </div>

        {/* 필터 */}
        <div style={{ background:T.bgCard, borderRadius:10, padding:"12px 18px", border:`0.5px solid ${T.border}`, marginBottom:14, display:"flex", alignItems:"flex-end", gap:10, flexWrap:"wrap" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            <span style={{ fontSize:9, color:T.textMuted }}>영역</span>
            <select value={area} onChange={e=>{setArea(e.target.value);setInstructor("");}} style={selStyle}>
              <option value="전체">전체</option>
              {(opts?.areaList??[]).map((v:string)=><option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            <span style={{ fontSize:9, color:T.textMuted }}>과목</span>
            <select value={subject} onChange={e=>{setSubject(e.target.value);setInstructor("");}} style={selStyle}>
              <option value="전체">전체</option>
              {(opts?.subjectList??[]).map((v:string)=><option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            <span style={{ fontSize:9, color:T.textMuted }}>강사</span>
            <select value={instructor} onChange={e=>setInstructor(e.target.value)} style={{ ...selStyle, minWidth:120 }}>
              <option value="">강사 선택</option>
              {(opts?.instructorList??[]).map((v:string)=><option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* 강사명 검색 */}
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            <span style={{ fontSize:9, color:T.textMuted }}>강사명 검색</span>
            <InstructorSearch
              instructorList={allInstructors}
              onSelect={(name) => {
                // 영역/과목 필터 초기화 후 강사 지정
                setArea("전체");
                setSubject("전체");
                setInstructor(name);
              }}
              T={T}
            />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            <span style={{ fontSize:9, color:T.textMuted }}>기간</span>
            <select value={yearRange} onChange={e=>setYearRange(e.target.value)} style={selStyle}>
              {["2025~2026 전체","2026년","2025년"].map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        {!instructor ? (
          <div style={{ background:T.bgCard, borderRadius:10, padding:"60px", border:`0.5px solid ${T.border}`, textAlign:"center", color:T.textMuted }}>
            <div style={{ fontSize:32, marginBottom:12 }}>👨‍🏫</div>
            <div style={{ fontSize:13 }}>위에서 강사를 선택해 주세요.</div>
          </div>
        ) : loading ? (
          <div style={{ color:T.textMuted, fontSize:12, padding:40, textAlign:"center" }}>로딩 중...</div>
        ) : data && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

            {/* KPI */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
              {[
                { label:"누적 판매장수", val:`${data.kpi.total.toLocaleString()}명`, sub:yearRange },
                { label:"활동 학원", val:`${data.kpi.academies.length}개`, sub:data.kpi.academies.map((a:string)=>a.replace("러셀 ","")).join(", ") },
                { label:"이번달 판매", val:`${data.kpi.latestVal}명`, sub:`전월 ${data.kpi.prevVal}명 ${data.kpi.prevVal>0?`${data.kpi.latestVal>=data.kpi.prevVal?"▲":"▼"}${Math.abs(data.kpi.latestVal-data.kpi.prevVal)}명`:""}` },
                { label:"강좌구분", val:[...new Set((data.data??[]).map((r:any)=>r.course_type))].join(" / "), sub:"활동 강좌구분" },
              ].map((k,i)=>(
                <div key={i} style={{ background:T.bgCard, borderRadius:10, padding:"12px 14px", border:`0.5px solid ${T.border}`, borderTop:`2px solid ${["#1C1C1C","#555","#888","#aaa"][i]}` }}>
                  <div style={{ fontSize:9, color:T.textMuted, marginBottom:4 }}>{k.label}</div>
                  <div style={{ fontSize:16, fontWeight:500, color:T.textPri, letterSpacing:"-0.02em" }}>{k.val}</div>
                  <div style={{ fontSize:9, color:T.textMuted, marginTop:2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* 시간표 + 차트 */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1.5fr", gap:10 }}>

              {/* 주간 시간표 */}
              <div style={{ background:T.bgCard, borderRadius:10, padding:"14px 16px", border:`0.5px solid ${T.border}` }}>
                <div style={{ fontSize:12, fontWeight:500, color:T.textPri, marginBottom:2 }}>주간 강의 시간표(2026년)</div>
                <div style={{ fontSize:10, color:T.textMuted, marginBottom:10 }}>수업시간 기준 자동 파싱</div>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10, tableLayout:"fixed" }}>
                  <colgroup>
                    <col style={{ width:"44px" }} />
                    {DAYS.map(d=><col key={d} style={{ width:"calc((100% - 44px) / 7)" }} />)}
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom:`0.5px solid ${T.borderEm}` }}>
                      <th style={{ padding:"5px 4px", textAlign:"left", color:T.textMuted, fontWeight:500 }}></th>
                      {DAY_KR.map((d,i)=>(
                        <th key={d} style={{ padding:"5px 4px", textAlign:"center", color:i>=5?T.textHint:T.textMuted, fontWeight:500, fontSize:10 }}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SLOTS.map(slot=>(
                      <tr key={slot} style={{ borderBottom:`0.5px solid ${T.gridLine}` }}>
                        <td style={{ padding:"6px 4px", color:T.textMuted, fontWeight:500, fontSize:9, background:T.bgSurface, verticalAlign:"top" }}>{slot}</td>
                        {DAYS.map(day=>{
                          const academies = data.timetable?.[day]?.[slot] ?? [];
                          return (
                            <td key={day} style={{ padding:"4px", textAlign:"center", verticalAlign:"top" }}>
                              {academies.map((a:string)=>(
                                <div key={a} style={{
                                  padding:"2px 4px", borderRadius:4, marginBottom:2,
                                  fontSize:9, fontWeight:500,
                                  background:T.bgSurface, color:T.textPri,
                                  border:`0.5px solid ${T.border}`,
                                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                                }}>{a}</div>
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize:8, color:T.textHint, marginTop:8 }}>
                  오전: 10:00 포함 · 오후: 14:30 포함 · 저녁: 19:30 포함
                </div>
              </div>

              {/* 월별 판매 차트 — 올해/전년 그룹 막대 */}
              <div style={{ background:T.bgCard, borderRadius:10, padding:"14px 16px", border:`0.5px solid ${T.border}` }}>
                <div style={{ fontSize:12, fontWeight:500, color:T.textPri, marginBottom:2 }}>월별 판매장수 추이 (1~12월)</div>
                <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:8, marginTop:2 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:9, color:T.textMuted }}>
                    <span style={{ width:10,height:10,borderRadius:2,background:barColor,display:"inline-block" }}/>올해
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:9, color:T.textMuted }}>
                    <span style={{ width:10,height:10,borderRadius:2,background:"#aaa",display:"inline-block" }}/>전년
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top:8, right:8, left:0, bottom:0 }} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke={T.gridLine} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize:8, fill:T.textMuted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:8, fill:T.textMuted }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip content={<TipComp />} />
                    <Bar dataKey="올해" name="올해" fill={barColor} radius={[2,2,0,0]} barSize={10} />
                    <Bar dataKey="전년" name="전년" fill="#aaa" radius={[2,2,0,0]} barSize={10} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 상세 테이블 */}
            <div style={{ background:T.bgCard, borderRadius:10, padding:"14px 16px", border:`0.5px solid ${T.border}` }}>
              <div style={{ fontSize:12, fontWeight:500, color:T.textPri, marginBottom:8 }}>월별 · 학원 · 강좌구분별 판매장수</div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, tableLayout:"fixed" }}>
                  <thead>
                    <tr style={{ borderBottom:`0.5px solid ${T.borderEm}`, background:T.bgSurface }}>
                      <th style={{ padding:"6px 10px", textAlign:"left", color:T.textMuted, fontWeight:500, width:70 }}>년월</th>
                      <th style={{ padding:"6px 10px", textAlign:"left", color:T.textMuted, fontWeight:500, width:90 }}>학원</th>
                      <th style={{ padding:"6px 10px", textAlign:"left", color:T.textMuted, fontWeight:500, width:70 }}>강좌구분</th>
                      <th style={{ padding:"6px 10px", textAlign:"right", color:T.textMuted, fontWeight:500, width:70 }}>판매장수</th>
                      <th style={{ padding:"6px 10px", textAlign:"left", color:T.textMuted, fontWeight:500 }}>강좌명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.data ?? []).slice().reverse().map((row:any, i:number)=>(
                      <tr key={i} style={{ borderBottom:`0.5px solid ${T.gridLine}`, height:32 }}
                        onMouseEnter={e=>e.currentTarget.style.background=`rgba(0,0,0,0.02)`}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <td style={{ padding:"0 10px", color:T.textMuted }}>{row.year}.{String(row.month).padStart(2,"0")}</td>
                        <td style={{ padding:"0 10px", color:T.textPri }}>{row.academy?.replace("러셀 ","")}</td>
                        <td style={{ padding:"0 10px" }}>
                          <span style={{ display:"inline-block", padding:"2px 7px", borderRadius:20, fontSize:9, background:T.bgSurface, color:T.textMuted, border:`0.5px solid ${T.border}` }}>
                            {row.course_type}
                          </span>
                        </td>
                        <td style={{ padding:"0 10px", textAlign:"right", fontWeight:500, color:T.textPri }}>{row.student_count}</td>
                        <td style={{ padding:"0 10px", color:T.textMuted, fontSize:10, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{row.course_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}