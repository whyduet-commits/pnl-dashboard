"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Sidebar from "@/components/dashboard/Sidebar";
import { useTheme } from "@/lib/theme";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

const DAYS   = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
const DAY_KR = ["월","화","수","목","금","토","일"];
const SLOTS  = ["오전","오후","저녁"];

function ChartTip({ active, payload, label, T }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:T.bgCard, border:`0.5px solid ${T.border}`, borderRadius:8, padding:"9px 12px", fontSize:11 }}>
      <div style={{ fontWeight:500, color:T.textPri, marginBottom:5 }}>{label}</div>
      {payload.map((p:any) => (
        <div key={p.dataKey} style={{ display:"flex", justifyContent:"space-between", gap:14, marginBottom:2 }}>
          <span style={{ color:T.textMuted }}>{p.name}</span>
          <span style={{ fontWeight:500, color:T.textPri }}>{p.value?.toLocaleString()}명</span>
        </div>
      ))}
    </div>
  );
}

export default function InstructorPage() {
  const router   = useRouter();
  const supabase = createClient();
  const { T, theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/login");
    });
  }, []);

  // ── 상태 ──────────────────────────────────────────────────────
  const [profiles,    setProfiles]    = useState<any[]>([]);   // instructor_profiles
  const [opts,        setOpts]        = useState<any>(null);   // 필터 옵션
  const [area,        setArea]        = useState("전체");
  const [subject,     setSubject]     = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected,    setSelected]    = useState<string | null>(null);
  const [yearRange,   setYearRange]   = useState("2025~2026 전체");
  const [detailData,  setDetailData]  = useState<any>(null);
  const [loading,     setLoading]     = useState(false);
  const [profileMap,  setProfileMap]  = useState<Record<string, string>>({});

  // ── 초기 로드 ─────────────────────────────────────────────────
  useEffect(() => {
    // 필터 옵션 + 강사 목록
    fetch("/api/sales/instructor").then(r => r.json()).then(setOpts);
    // 프로필 사진 매핑
    supabase.from("instructor_profiles").select("name_kr, photo_url").then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((r: any) => { if (r.photo_url) map[r.name_kr] = r.photo_url; });
        setProfileMap(map);
      }
    });
  }, []);

  // ── 상세 데이터 조회 ──────────────────────────────────────────
  const fetchDetail = useCallback(async (name: string) => {
    setLoading(true);
    const [yFrom, yTo] = yearRange === "2026년" ? ["2026","2026"]
      : yearRange === "2025년" ? ["2025","2025"] : ["2025","2026"];
    const p = new URLSearchParams({ instructor: name, area, subject, year_from: yFrom, year_to: yTo });
    const res = await fetch(`/api/sales/instructor?${p}`);
    const json = await res.json();
    setDetailData(json);
    setLoading(false);
  }, [area, subject, yearRange]);

  useEffect(() => {
    if (selected) fetchDetail(selected);
  }, [selected, fetchDetail]);

  // ── 필터된 강사 목록 ──────────────────────────────────────────
  const instructorList: string[] = opts?.instructorList ?? [];
  const filteredList = instructorList.filter(name => {
    if (searchQuery.trim() && !name.includes(searchQuery.trim())) return false;
    return true;
  });

  // ── 차트 데이터 ───────────────────────────────────────────────
  const chartData = (() => {
    if (!detailData?.monthly) return [];
    const curYear  = yearRange === "2025년" ? 2025 : 2026;
    const prevYear = curYear - 1;
    return Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, "0");
      return {
        label: `${i + 1}월`,
        올해:  detailData.monthly[`${curYear}-${m}`]  ?? null,
        전년:  detailData.monthly[`${prevYear}-${m}`] ?? null,
      };
    });
  })();

  const selStyle: React.CSSProperties = {
    background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 7,
    padding: "5px 24px 5px 10px", fontSize: 11, color: T.textPri,
    cursor: "pointer", outline: "none", appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
    colorScheme: isDark ? "dark" : "light",
  };
  const barColor = isDark ? "#F5C418" : "#1C1C1C";
  const TipComp  = (props: any) => <ChartTip {...props} T={T} />;

  const photoUrl = selected ? profileMap[selected] : null;

  return (
    <div style={{ display:"flex", height:"100vh", width:"100vw", overflow:"hidden",
      fontFamily:"'SUIT','Pretendard','Noto Sans KR',sans-serif",
      background: T.bgBase, color: T.textPri }}>
      <Sidebar />

      {/* ── 좌측: 강사 카드 목록 ── */}
      <div style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${T.border}`,
        background: T.bgSurface, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* 검색 + 필터 */}
        <div style={{ padding: "14px 12px 10px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textPri, marginBottom: 10 }}>강사 목록</div>
          <input
            type="text"
            placeholder="강사명 검색"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: "100%", background: T.bgCard, border: `0.5px solid ${T.border}`,
              borderRadius: 7, padding: "6px 10px", fontSize: 11, color: T.textPri,
              outline: "none", boxSizing: "border-box", marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <select value={area} onChange={e => { setArea(e.target.value); setSelected(null); }}
              style={{ ...selStyle, flex: 1, padding: "4px 20px 4px 8px" }}>
              <option value="전체">전체영역</option>
              {(opts?.areaList ?? []).map((v: string) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={subject} onChange={e => { setSubject(e.target.value); setSelected(null); }}
              style={{ ...selStyle, flex: 1, padding: "4px 20px 4px 8px" }}>
              <option value="전체">전체과목</option>
              {(opts?.subjectList ?? []).map((v: string) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 9, color: T.textMuted, marginTop: 6 }}>
            {filteredList.length}명
          </div>
        </div>

        {/* 강사 카드 스크롤 영역 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {filteredList.map(name => {
            const isActive = selected === name;
            const photo    = profileMap[name];
            return (
              <div key={name} onClick={() => setSelected(name)}
                style={{ display: "flex", alignItems: "center", gap: 9,
                  padding: "7px 8px", borderRadius: 8, cursor: "pointer",
                  marginBottom: 2,
                  background: isActive
                    ? (isDark ? "rgba(245,196,24,0.12)" : "rgba(0,0,0,0.06)")
                    : "transparent",
                  border: isActive
                    ? `1px solid ${isDark ? "rgba(245,196,24,0.3)" : "rgba(0,0,0,0.15)"}`
                    : "1px solid transparent",
                  borderLeft: isActive ? `3px solid ${T.yellow}` : "3px solid transparent",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                {/* 프로필 사진 */}
                <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: T.bgCard, border: `1px solid ${T.border}`,
                  overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {photo
                    ? <img src={photo} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 14 }}>👤</span>
                  }
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: isActive ? 700 : 400,
                    color: isActive ? T.yellow : T.textPri,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 우측: 상세 영역 ── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

        {!selected ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", height: "100%", gap: 12, color: T.textMuted }}>
            <div style={{ fontSize: 48 }}>👨‍🏫</div>
            <div style={{ fontSize: 13 }}>좌측에서 강사를 선택해 주세요.</div>
          </div>
        ) : loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", color: T.textMuted, fontSize: 12 }}>로딩 중...</div>
        ) : detailData && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* 프로필 헤더 */}
            <div style={{ display: "flex", alignItems: "center", gap: 16,
              background: T.bgCard, borderRadius: 12, padding: "16px 20px",
              border: `0.5px solid ${T.border}` }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", flexShrink: 0,
                background: T.bgSurface, border: `2px solid ${T.border}`,
                overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {photoUrl
                  ? <img src={photoUrl} alt={selected} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 32 }}>👤</span>
                }
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.textPri }}>{selected}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>
                  {[...new Set((detailData.data ?? []).map((r: any) => r.area))].join(" · ")}
                  {" "}
                  {[...new Set((detailData.data ?? []).map((r: any) => r.subject))].join(", ")}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                  {detailData.kpi.academies.map((a: string) => a.replace("러셀 ", "")).join(", ")}
                </div>
              </div>
              {/* 기간 선택 */}
              <select value={yearRange} onChange={e => setYearRange(e.target.value)} style={selStyle}>
                {["2025~2026 전체","2026년","2025년"].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            {/* KPI */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[
                { label: "누적 판매장수", val: `${detailData.kpi.total.toLocaleString()}명`, sub: yearRange },
                { label: "활동 학원", val: `${detailData.kpi.academies.length}개`,
                  sub: detailData.kpi.academies.map((a: string) => a.replace("러셀 ","")).join(", ") },
                { label: "최근달 판매", val: `${detailData.kpi.latestVal}명`,
                  sub: `전월 ${detailData.kpi.prevVal}명 ${detailData.kpi.prevVal > 0
                    ? `${detailData.kpi.latestVal >= detailData.kpi.prevVal ? "▲" : "▼"}${Math.abs(detailData.kpi.latestVal - detailData.kpi.prevVal)}명` : ""}` },
                { label: "강좌구분", val: [...new Set((detailData.data ?? []).map((r: any) => r.course_type))].join(" / "), sub: "활동 강좌구분" },
              ].map((k, i) => (
                <div key={i} style={{ background: T.bgCard, borderRadius: 10, padding: "12px 14px",
                  border: `0.5px solid ${T.border}`,
                  borderTop: `2px solid ${["#1C1C1C","#555","#888","#aaa"][i]}` }}>
                  <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: T.textPri }}>{k.val}</div>
                  <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* 시간표 + 차트 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 10 }}>

              {/* 시간표 */}
              <div style={{ background: T.bgCard, borderRadius: 10, padding: "14px 16px", border: `0.5px solid ${T.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.textPri, marginBottom: 2 }}>주간 강의 시간표 (2026년)</div>
                <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 10 }}>수업시간 기준 자동 파싱</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, tableLayout: "fixed" }}>
                  <thead>
                    <tr style={{ borderBottom: `0.5px solid ${T.borderEm}` }}>
                      <th style={{ padding: "5px 4px", textAlign: "left", color: T.textMuted, fontWeight: 500, width: 44 }}></th>
                      {DAY_KR.map((d, i) => (
                        <th key={d} style={{ padding: "5px 4px", textAlign: "center",
                          color: i >= 5 ? T.textHint : T.textMuted, fontWeight: 500, fontSize: 10 }}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SLOTS.map(slot => (
                      <tr key={slot} style={{ borderBottom: `0.5px solid ${T.gridLine}` }}>
                        <td style={{ padding: "6px 4px", color: T.textMuted, fontWeight: 500,
                          fontSize: 9, background: T.bgSurface, verticalAlign: "top" }}>{slot}</td>
                        {DAYS.map(day => {
                          const academies = detailData.timetable?.[day]?.[slot] ?? [];
                          return (
                            <td key={day} style={{ padding: "4px", textAlign: "center", verticalAlign: "top" }}>
                              {academies.map((a: string) => (
                                <div key={a} style={{ padding: "2px 4px", borderRadius: 4, marginBottom: 2,
                                  fontSize: 9, fontWeight: 500, background: T.bgSurface, color: T.textPri,
                                  border: `0.5px solid ${T.border}`, whiteSpace: "nowrap",
                                  overflow: "hidden", textOverflow: "ellipsis" }}>{a}</div>
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: 8, color: T.textHint, marginTop: 8 }}>
                  오전: 10:00 포함 · 오후: 14:30 포함 · 저녁: 19:30 포함
                </div>
              </div>

              {/* 월별 차트 */}
              <div style={{ background: T.bgCard, borderRadius: 10, padding: "14px 16px", border: `0.5px solid ${T.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.textPri, marginBottom: 2 }}>월별 판매장수 추이</div>
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, marginTop: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: T.textMuted }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: barColor, display: "inline-block" }}/>올해
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: T.textMuted }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: "#aaa", display: "inline-block" }}/>전년
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke={T.gridLine} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 8, fill: T.textMuted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 8, fill: T.textMuted }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip content={<TipComp />} />
                    <Bar dataKey="올해" name="올해" fill={barColor} radius={[2,2,0,0]} barSize={10} />
                    <Bar dataKey="전년" name="전년" fill="#aaa" radius={[2,2,0,0]} barSize={10} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 상세 테이블 */}
            <div style={{ background: T.bgCard, borderRadius: 10, padding: "14px 16px", border: `0.5px solid ${T.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: T.textPri, marginBottom: 8 }}>월별 · 학원 · 강좌구분별 판매장수</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, tableLayout: "fixed" }}>
                  <thead>
                    <tr style={{ borderBottom: `0.5px solid ${T.borderEm}`, background: T.bgSurface }}>
                      <th style={{ padding: "6px 10px", textAlign: "left", color: T.textMuted, fontWeight: 500, width: 70 }}>년월</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", color: T.textMuted, fontWeight: 500, width: 90 }}>학원</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", color: T.textMuted, fontWeight: 500, width: 70 }}>강좌구분</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", color: T.textMuted, fontWeight: 500, width: 70 }}>판매장수</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", color: T.textMuted, fontWeight: 500 }}>강좌명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailData.data ?? []).slice().reverse().map((row: any, i: number) => (
                      <tr key={i} style={{ borderBottom: `0.5px solid ${T.gridLine}`, height: 32 }}
                        onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "0 10px", color: T.textMuted }}>{row.year}.{String(row.month).padStart(2,"0")}</td>
                        <td style={{ padding: "0 10px", color: T.textPri }}>{row.academy?.replace("러셀 ","")}</td>
                        <td style={{ padding: "0 10px" }}>
                          <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 20,
                            fontSize: 9, background: T.bgSurface, color: T.textMuted, border: `0.5px solid ${T.border}` }}>
                            {row.course_type}
                          </span>
                        </td>
                        <td style={{ padding: "0 10px", textAlign: "right", fontWeight: 500, color: T.textPri }}>{row.student_count}</td>
                        <td style={{ padding: "0 10px", color: T.textMuted, fontSize: 10,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.course_name}</td>
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