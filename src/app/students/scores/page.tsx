"use client";
// C:\pnl-dashboard\src\app\students\scores\page.tsx
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Sidebar from "@/components/dashboard/Sidebar";
import { useTheme } from "@/lib/theme";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";

// ── 카테고리 정의 ─────────────────────────────────────────────
const CATS = [
  { key:"cat1", label:"서울대 의예과",   color:"#1C1C1C" },
  { key:"cat2", label:"메이저 의예과",   color:"#3d3d3d" },
  { key:"cat3", label:"전국 의예과",     color:"#5a5a5a" },
  { key:"cat4", label:"의치한수약",      color:"#F5C418" },
  { key:"cat5", label:"SKY카포",         color:"#888" },
  { key:"cat6", label:"서성한이",        color:"#aaa"  },
  { key:"cat7", label:"중경외시",        color:"#bbb"  },
  { key:"cat8", label:"그 외",           color:"#ddd"  },
];

const YEARS = [2021,2022,2023,2024,2025,2026];

const HQ1_LIST = ["중점본부","대치본부"];
const HQ2_MAP: Record<string,string[]> = {
  "중점본부": ["시내","기숙"],
  "대치본부": ["대치"],
};

export default function ScoresPage() {
  const router   = useRouter();
  const supabase = createClient();
  const { T }    = useTheme();

  const [data,        setData]        = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [hq1,         setHq1]         = useState("전체");
  const [hq2,         setHq2]         = useState("전체");
  const [academy,     setAcademy]     = useState("전체");
  const [selYear,     setSelYear]     = useState(2026);
  const [academyList, setAcademyList] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/login");
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ hq1, hq2, academy });
    const res = await fetch(`/api/admission?${p}`);
    const json = await res.json();
    setData(json);
    if (json.academyList) setAcademyList(json.academyList);
    setLoading(false);
  }, [hq1, hq2, academy]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selStyle: React.CSSProperties = {
    background: T.bgCard, border: `0.5px solid ${T.borderEm}`,
    borderRadius: 7, padding: "6px 26px 6px 10px",
    fontSize: 11, color: T.textPri, fontWeight: 400,
    cursor: "pointer", outline: "none", appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
  };

  // 그래프 데이터: 연도별 (과거는 0)
  const buildChartData = (catKey: string) =>
    YEARS.map(y => ({
      year: `${y}`,
      count: data?.countMap?.[y]?.[catKey] ?? 0,
    }));

  // KPI 카드 (전체 학원 2026 기준)
  const kpi = data?.kpi ?? {};

  const ChartTip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 11 }}>
        <div style={{ fontWeight: 600, color: T.textPri, marginBottom: 4 }}>{label}학년도</div>
        <div style={{ color: T.textMuted }}>{payload[0]?.value?.toLocaleString()}명</div>
      </div>
    );
  };

  const MiniChart = ({ catKey, color }: { catKey: string; color: string }) => {
    const chartData = buildChartData(catKey);
    return (
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke={T.gridLine} vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 9, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: T.textMuted }} axisLine={false} tickLine={false} width={28} />
          <Tooltip content={<ChartTip />} />
          <Bar dataKey="count" radius={[3,3,0,0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.year === String(selYear) ? color : `${color}55`} />
            ))}
            <LabelList dataKey="count" position="top" style={{ fontSize: 9, fill: T.textPri }} formatter={(v: any) => v > 0 ? v : ""} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const filteredAcademies = academyList.filter(a => {
    const orgMap: Record<string,{hq1:string;hq2:string}> = {
      "강남":           { hq1:"중점본부", hq2:"시내" },
      "목동":           { hq1:"중점본부", hq2:"시내" },
      "분당":           { hq1:"중점본부", hq2:"시내" },
      "대구":           { hq1:"중점본부", hq2:"시내" },
      "대전":           { hq1:"중점본부", hq2:"시내" },
      "최상위권 전문관": { hq1:"중점본부", hq2:"기숙" },
      "남학생":         { hq1:"중점본부", hq2:"기숙" },
      "여학생":         { hq1:"중점본부", hq2:"기숙" },
      "종합관":         { hq1:"중점본부", hq2:"기숙" },
    };
    const org = orgMap[a] ?? { hq1:"기타", hq2:"기타" };
    if (hq2 !== "전체") return org.hq2 === hq2;
    if (hq1 !== "전체") return org.hq1 === hq1;
    return true;
  });

  return (
    <div style={{ display:"flex", height:"100vh", width:"100vw", overflow:"hidden", fontFamily:"'Pretendard','Noto Sans KR',sans-serif", background: T.bgBase, color: T.textPri }}>
      <Sidebar />
      <div style={{ flex:1, overflow:"auto", padding:"24px 28px" }}>

        {/* 헤더 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.textPri }}>입결 현황</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>2026학년도 합격 현황 · 카테고리별 분석</div>
        </div>

        {/* ── 전체 학원 KPI 카드 ── */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: T.textHint, marginBottom: 8, letterSpacing: "0.08em" }}>전체 학원 합계 (2026학년도)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8, marginBottom: 20 }}>
            {CATS.map(cat => (
              <div key={cat.key} style={{
                background: T.bgCard, borderRadius: 10,
                padding: "12px 14px",
                border: `0.5px solid ${T.border}`,
                borderTop: `2px solid ${cat.color}`,
              }}>
                <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 6, lineHeight: 1.4 }}>{cat.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: T.textPri, letterSpacing: "-0.02em" }}>
                  {loading ? "—" : (kpi[cat.key] ?? 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>명</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 필터 ── */}
        <div style={{ background: T.bgCard, borderRadius: 10, padding: "14px 18px", border: `0.5px solid ${T.border}`, marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 9, color: T.textMuted }}>학년도</span>
            <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} style={selStyle}>
              {YEARS.map(y => <option key={y} value={y}>{y}학년도</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 9, color: T.textMuted }}>본부</span>
            <select value={hq1} onChange={e => { setHq1(e.target.value); setHq2("전체"); setAcademy("전체"); }} style={selStyle}>
              <option value="전체">전체</option>
              {HQ1_LIST.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 9, color: T.textMuted }}>부문</span>
            <select value={hq2} onChange={e => { setHq2(e.target.value); setAcademy("전체"); }} style={selStyle}>
              <option value="전체">전체</option>
              {(hq1 !== "전체" ? HQ2_MAP[hq1] ?? [] : ["시내","기숙","대치"]).map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 9, color: T.textMuted }}>학원</span>
            <select value={academy} onChange={e => setAcademy(e.target.value)} style={selStyle}>
              <option value="전체">전체</option>
              {filteredAcademies.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 10, color: T.textMuted, alignSelf: "center" }}>
            * 2021~2025학년도는 추후 업데이트 예정
          </div>
        </div>

        {/* ── 차트 2×4 그리드 ── */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: T.textMuted, fontSize: 12 }}>로딩 중...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {CATS.map((cat, idx) => {
              const curVal = data?.countMap?.[selYear]?.[cat.key] ?? 0;
              return (
                <div key={cat.key} style={{
                  background: T.bgCard, borderRadius: 10,
                  padding: "14px 16px",
                  border: `0.5px solid ${T.border}`,
                  borderTop: `2px solid ${cat.color}`,
                }}>
                  {/* 카드 헤더 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.textPri }}>{idx + 1}. {cat.label}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                    <span style={{ fontSize: 24, fontWeight: 700, color: T.textPri, letterSpacing: "-0.02em" }}>
                      {curVal.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>명 ({selYear}학년도)</span>
                  </div>
                  <MiniChart catKey={cat.key} color={cat.color} />
                  <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 4 }}>
                    {YEARS.filter(y => y !== selYear).slice(-2).map(y => (
                      <div key={y} style={{ fontSize: 9, color: T.textHint }}>
                        {y}: {(data?.countMap?.[y]?.[cat.key] ?? 0).toLocaleString()}명
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}