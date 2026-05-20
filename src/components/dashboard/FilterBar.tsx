// src/components/dashboard/FilterBar.tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme";

export interface FilterState {
  year:     number;
  scenario: string;
  hq1:      string;
  hq2:      string;
  orgId:    number;
}

interface FilterOptions {
  years:       number[];
  scenarios:   { value: string; label: string }[];
  hq1List:     string[];
  hq2List:     string[];
  academyList: { org_id: number; academy: string; hq_level1: string; hq_level2: string }[];
}

interface Props {
  filters:   FilterState;
  onChange:  (f: FilterState) => void;
  updatedAt?: string;
}

function FilterSelect({ label, value, options, onChange, T }: {
  label: string;
  value: string | number;
  options: { value: string | number; label: string }[];
  onChange: (v: string) => void;
  T: any;
}) {
  const isLight = T.bgCard === "#ffffff";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 400 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: T.bgCard,
          border: `0.5px solid ${T.border}`,
          borderRadius: 7,
          padding: "5px 28px 5px 10px",
          fontSize: 12,
          color: T.textPri,
          fontWeight: 400,
          cursor: "pointer",
          outline: "none",
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 8px center",
          minWidth: 90,
          colorScheme: isLight ? "light" : "dark",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function FilterBar({ filters, onChange, updatedAt }: Props) {
  const { theme, T, toggle } = useTheme();
  const [opts, setOpts] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);

  // 테마 전환 시 html 태그에 color-scheme 주입 → select 박스 색상 자동 반영
  useEffect(() => {
    document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
  }, [theme]);

  useEffect(() => {
    fetch("/api/filters")
      .then((r) => r.json())
      .then(setOpts)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !opts) {
    return (
      <div style={{
        background: T.bgSurface,
        borderBottom: `0.5px solid ${T.border}`,
        padding: "10px 24px", height: 56,
        display: "flex", alignItems: "center",
      }}>
        <span style={{ fontSize: 12, color: T.textMuted }}>필터 로딩 중...</span>
      </div>
    );
  }

  const filteredHq2 = (opts.hq2List ?? []).filter((h2) => {
    if (filters.hq1 === "전체") return true;
    if (filters.hq1 === "중점본부") return ["시내", "기숙"].includes(h2);
    if (filters.hq1 === "대치본부") return h2 === "대치";
    return true;
  });

  const filteredAcademies = (opts.academyList ?? []).filter((a) => {
    if (filters.hq1 !== "전체" && a.hq_level1 !== filters.hq1) return false;
    if (filters.hq2 !== "전체" && a.hq_level2 !== filters.hq2) return false;
    return true;
  });

  const validOrgId =
    (filters.orgId === 1 ||
    filteredAcademies.some((a) => a.org_id === filters.orgId))
      ? filters.orgId : 1;

  const update = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  return (
    <div style={{
      background: T.bgSurface,
      borderBottom: `0.5px solid ${T.border}`,
      padding: "8px 24px",
      display: "flex",
      alignItems: "flex-end",
      gap: 12,
      flexShrink: 0,
    }}>
      <FilterSelect label="연도" value={filters.year} T={T}
        options={(opts.years ?? []).map((y) => ({ value: y, label: `${y}` }))}
        onChange={(v) => update({ year: Number(v) })} />

      <FilterSelect label="본부" value={filters.hq1} T={T}
        options={[{ value: "전체", label: "전체" }, ...(opts.hq1List ?? []).map((h) => ({ value: h, label: h }))]}
        onChange={(v) => update({ hq1: v, hq2: "전체", orgId: 1 })} />

      <FilterSelect label="부문" value={filters.hq2} T={T}
        options={[{ value: "전체", label: "전체" }, ...filteredHq2.map((h) => ({ value: h, label: h }))]}
        onChange={(v) => update({ hq2: v, orgId: 1 })} />

      <FilterSelect label="학원" value={validOrgId} T={T}
        options={[{ value: 1, label: "전체" }, ...filteredAcademies.map((a) => ({ value: a.org_id, label: a.academy }))]}
        onChange={(v) => update({ orgId: Number(v) })} />

      {/* 우측 영역 */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        {updatedAt && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: T.textMuted }}>최종 데이터 업데이트</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.textPri }}>{updatedAt}</div>
          </div>
        )}

        {/* 다크/라이트 토글 버튼 */}
        <button
          onClick={toggle}
          title={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 20,
            border: `0.5px solid ${T.border}`,
            background: theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
            color: T.textMuted,
            cursor: "pointer", fontSize: 11, fontWeight: 500,
            transition: "all 0.2s",
          }}
        >
          <span style={{ fontSize: 13 }}>{theme === "dark" ? "☀️" : "🌙"}</span>
          <span style={{ color: T.textPri }}>{theme === "dark" ? "라이트" : "다크"}</span>
        </button>

        <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: T.textMuted, position: "relative", padding: 0 }}>
          🔔
          <span style={{ position: "absolute", top: 0, right: 0, width: 8, height: 8, background: "#ef4444", borderRadius: "50%", display: "block" }} />
        </button>
        <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: T.textMuted, padding: 0 }}>⬇</button>
      </div>
    </div>
  );
}