"use client";
// C:\pnl-dashboard\src\app\instructor\profile\page.tsx
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Sidebar from "@/components/dashboard/Sidebar";
import { useTheme } from "@/lib/theme";

// ── 타입 ─────────────────────────────────────────────────────
interface InstructorProfile {
  id: number;
  name: string;
  photo_url?: string | null;
  subject?: string | null;
  gender?: string | null;
  birth_year?: number | null;
  phone?: string | null;
  education?: string | null;
  contract_type?: string | null;
  contract_start?: string | null;
  contract_end?: string | null;
  status?: "재직" | "퇴직" | null;
  memo?: string | null;
  subjects?: string | null; // 복수 과목 콤마 구분
}

// ── 더미 데이터 (Supabase 연동 전 UI 확인용) ─────────────────
const DUMMY: InstructorProfile[] = [
  { id:1, name:"강민철", subject:"국어", gender:"M", birth_year:1985, phone:"010-0000-0000", education:"서울대 국어국문학과", contract_type:"-", contract_start:"-", contract_end:"-", status:"재직", memo:"-", subjects:"국어" },
  { id:2, name:"홍길동", subject:"수학", gender:"M", birth_year:1990, phone:"010-1111-1111", education:"연세대 수학과", contract_type:"-", contract_start:"-", contract_end:"-", status:"재직", memo:"-", subjects:"수학" },
];

export default function InstructorProfilePage() {
  const router   = useRouter();
  const supabase = createClient();
  const { T }    = useTheme();

  const [profiles,   setProfiles]   = useState<InstructorProfile[]>([]);
  const [filtered,   setFiltered]   = useState<InstructorProfile[]>([]);
  const [selected,   setSelected]   = useState<InstructorProfile | null>(null);
  const [subjectOpts,setSubjectOpts] = useState<string[]>([]);
  const [filterSubj, setFilterSubj] = useState("전체");
  const [filterStatus,setFilterStatus] = useState("전체");
  const [searchQ,    setSearchQ]    = useState("");
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/login");
    });
  }, []);

  // 데이터 로드: instructor_profiles 테이블 우선, 없으면 더미
  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("instructor_profiles")
        .select("*")
        .order("name", { ascending: true });

      if (error || !data || data.length === 0) {
        // 테이블 없으면 더미 데이터 사용
        setProfiles(DUMMY);
        setFiltered(DUMMY);
        if (DUMMY.length > 0) setSelected(DUMMY[0]);
      } else {
        setProfiles(data);
        setFiltered(data);
        if (data.length > 0) setSelected(data[0]);
      }

      // 과목 목록: sales_daily에서 가져오기
      const { data: subjectData } = await supabase
        .from("sales_daily")
        .select("subject");
      const subjects = [...new Set((subjectData ?? []).map((r: any) => r.subject).filter(Boolean))].sort() as string[];
      setSubjectOpts(subjects);
    } catch {
      setProfiles(DUMMY);
      setFiltered(DUMMY);
      if (DUMMY.length > 0) setSelected(DUMMY[0]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // 필터링
  useEffect(() => {
    let result = [...profiles];
    if (filterSubj !== "전체") result = result.filter(p => p.subjects?.includes(filterSubj) || p.subject === filterSubj);
    if (filterStatus !== "전체") result = result.filter(p => p.status === filterStatus);
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.subjects?.toLowerCase().includes(q) ||
        p.education?.toLowerCase().includes(q) ||
        p.memo?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
    if (result.length > 0 && (!selected || !result.find(r => r.id === selected.id))) {
      setSelected(result[0]);
    }
  }, [filterSubj, filterStatus, searchQ, profiles]);

  const selStyle: React.CSSProperties = {
    background: T.bgCard, border: `0.5px solid ${T.borderEm}`,
    borderRadius: 7, padding: "6px 28px 6px 10px",
    fontSize: 12, color: T.textPri, fontWeight: 400,
    cursor: "pointer", outline: "none", appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
  };

  const infoBox = (label: string, value: string | null | undefined) => (
    <div style={{ background: T.bgBase, borderRadius: 8, padding: "12px 14px", border: `0.5px solid ${T.border}` }}>
      <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: T.textPri }}>{value || "-"}</div>
    </div>
  );

  const age = selected?.birth_year ? `${selected.birth_year}년생 (만 ${new Date().getFullYear() - selected.birth_year}세)` : "-";

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden", fontFamily: "'Pretendard','Noto Sans KR',sans-serif", background: T.bgBase, color: T.textPri }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>

        {/* 헤더 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.textPri }}>강사 프로필</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>강사별 기본 정보, 학력, 계약 정보와 메모를 확인합니다.</div>
        </div>

        {/* 필터 바 */}
        <div style={{ background: T.bgCard, borderRadius: 10, padding: "14px 18px", border: `0.5px solid ${T.border}`, marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 9, color: T.textMuted }}>과목</span>
            <select value={filterSubj} onChange={e => setFilterSubj(e.target.value)} style={selStyle}>
              <option value="전체">전체</option>
              {subjectOpts.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 9, color: T.textMuted }}>상태</span>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selStyle}>
              <option value="전체">전체</option>
              <option value="재직">재직</option>
              <option value="퇴직">퇴직</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 200 }}>
            <span style={{ fontSize: 9, color: T.textMuted }}>검색</span>
            <input
              type="text"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="강사명, 과목, 학력, 메모 검색"
              style={{
                background: T.bgCard, border: `0.5px solid ${T.borderEm}`,
                borderRadius: 7, padding: "6px 12px", fontSize: 12,
                color: T.textPri, outline: "none", width: "100%",
              }}
            />
          </div>
          <button
            onClick={() => { setFilterSubj("전체"); setFilterStatus("전체"); setSearchQ(""); }}
            style={{ padding: "6px 16px", borderRadius: 7, border: `0.5px solid ${T.border}`, background: T.bgBase, color: T.textMuted, fontSize: 12, cursor: "pointer" }}
          >
            초기화
          </button>
        </div>

        {/* 메인 레이아웃 */}
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>

          {/* 좌측: 강사 목록 */}
          <div style={{ background: T.bgCard, borderRadius: 10, border: `0.5px solid ${T.border}`, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: `0.5px solid ${T.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textPri }}>강사 목록</div>
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>총 {filtered.length}명</div>
            </div>
            <div style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 11 }}>로딩 중...</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 11 }}>검색 결과가 없습니다.</div>
              ) : (
                filtered.map(p => (
                  <div
                    key={p.id}
                    onClick={() => setSelected(p)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "12px 16px", cursor: "pointer",
                      borderBottom: `0.5px solid ${T.gridLine}`,
                      background: selected?.id === p.id ? `rgba(245,196,24,0.06)` : "transparent",
                      borderLeft: selected?.id === p.id ? `2px solid #F5C418` : "2px solid transparent",
                      transition: "all 0.1s",
                    }}
                    onMouseEnter={e => { if (selected?.id !== p.id) e.currentTarget.style.background = T.bgBase; }}
                    onMouseLeave={e => { e.currentTarget.style.background = selected?.id === p.id ? `rgba(245,196,24,0.06)` : "transparent"; }}
                  >
                    {/* 아바타 */}
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: p.photo_url ? "transparent" : T.bgBase,
                      border: `0.5px solid ${T.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, overflow: "hidden",
                    }}>
                      {p.photo_url
                        ? <img src={p.photo_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : "👤"
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.textPri }}>{p.name}</span>
                        {p.status && (
                          <span style={{
                            fontSize: 9, padding: "1px 6px", borderRadius: 10, fontWeight: 600,
                            background: p.status === "재직" ? "rgba(200,240,74,0.15)" : "rgba(200,200,200,0.15)",
                            color: p.status === "재직" ? "#5a9a00" : T.textMuted,
                          }}>
                            {p.status}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {p.subjects || p.subject || "-"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 우측: 프로필 상세 */}
          {selected ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* 프로필 헤더 */}
              <div style={{ background: T.bgCard, borderRadius: 10, border: `0.5px solid ${T.border}`, padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
                  {/* 사진 */}
                  <div style={{
                    width: 90, height: 90, borderRadius: 12, flexShrink: 0,
                    background: T.bgBase, border: `0.5px solid ${T.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 36, overflow: "hidden",
                  }}>
                    {selected.photo_url
                      ? <img src={selected.photo_url} alt={selected.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : "👤"
                    }
                  </div>

                  {/* 이름 + 배지 + 기본 정보 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: T.textPri }}>{selected.name}</span>
                      {selected.status && (
                        <span style={{
                          fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 600,
                          background: selected.status === "재직" ? "rgba(200,240,74,0.15)" : "rgba(200,200,200,0.15)",
                          color: selected.status === "재직" ? "#5a9a00" : T.textMuted,
                          border: `0.5px solid ${selected.status === "재직" ? "rgba(200,240,74,0.3)" : T.border}`,
                        }}>
                          {selected.status}
                        </span>
                      )}
                    </div>

                    {/* 과목 */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {infoBox("과목", selected.subjects || selected.subject)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 기본 정보 */}
              <div style={{ background: T.bgCard, borderRadius: 10, border: `0.5px solid ${T.border}`, padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.textPri }}>기본 정보</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  {infoBox("성별", selected.gender === "M" ? "M" : selected.gender === "F" ? "F" : selected.gender)}
                  {infoBox("나이", age)}
                  {infoBox("연락처", selected.phone)}
                  {infoBox("학력", selected.education)}
                </div>
              </div>

              {/* 계약 정보 + 메모 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ background: T.bgCard, borderRadius: 10, border: `0.5px solid ${T.border}`, padding: "20px 24px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.textPri, marginBottom: 14 }}>계약 정보</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    {infoBox("계약형태", selected.contract_type)}
                    {infoBox("계약시작일", selected.contract_start)}
                    {infoBox("계약종료일", selected.contract_end)}
                  </div>
                </div>
                <div style={{ background: T.bgCard, borderRadius: 10, border: `0.5px solid ${T.border}`, padding: "20px 24px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.textPri, marginBottom: 14 }}>메모</div>
                  <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.7, minHeight: 60 }}>
                    {selected.memo || "-"}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div style={{ background: T.bgCard, borderRadius: 10, border: `0.5px solid ${T.border}`, padding: 60, textAlign: "center", color: T.textMuted }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
              <div style={{ fontSize: 13 }}>좌측 목록에서 강사를 선택해주세요.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
