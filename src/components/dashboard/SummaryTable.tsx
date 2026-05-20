"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme";

const ROWS = [
  { key: "매출_actual",      label: "매출"      },
  { key: "매출_plan",        label: "매출(계획)", muted: true },
  { key: "영업이익2_actual", label: "영업이익Ⅱ", highlight: true },
  { key: "영업이익2_plan",   label: "영업이익Ⅱ(계획)", muted: true },
  { key: "영업이익률_actual",label: "영업이익률", isRate: true },
];

const YEARS = [2021, 2022, 2023, 2024, 2025, 2026];

interface AnnualRow {
  year: number;
  매출_actual:      number | null;
  매출_plan:        number | null;
  매출_target:      number | null;
  영업이익2_actual: number | null;
  영업이익2_plan:   number | null;
  영업이익2_target: number | null;
  영업이익률_actual:number | null;
}

function fmt(v: number | null, isRate = false): string {
  if (v == null) return "—";
  if (isRate) return `${v.toFixed(1)}%`;
  return v.toLocaleString("ko-KR");
}

export default function SummaryTable({ orgId }: { orgId: number }) {
  const { T } = useTheme();
  const [data, setData] = useState<AnnualRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/pnl/annual?org_id=${orgId}`)
      .then((r) => r.json())
      .then((rows: AnnualRow[]) => {
        // YEARS 기준으로 정렬, 없는 연도는 null 패딩
        const yearMap: Record<number, AnnualRow> = {};
        for (const row of rows) yearMap[row.year] = row;
        setData(YEARS.map((y) => yearMap[y] ?? { year: y, 매출_actual: null, 매출_plan: null, 매출_target: null, 영업이익2_actual: null, 영업이익2_plan: null, 영업이익2_target: null, 영업이익률_actual: null }));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.borderEm}` }}>
            <th style={{ textAlign: "left", padding: "8px 10px", color: T.textMuted, fontWeight: 500, fontSize: 10, minWidth: 110 }}>
              구분
            </th>
            {YEARS.map((y) => (
              <th key={y} style={{ textAlign: "right", padding: "8px 10px", color: T.textMuted, fontWeight: 500, fontSize: 10 }}>
                {y === 2026 ? "2026E" : y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? (
              <tr>
                <td colSpan={YEARS.length + 1} style={{ textAlign: "center", padding: "24px", color: T.textMuted, fontSize: 11 }}>
                  로딩 중...
                </td>
              </tr>
            )
            : ROWS.map((row) => (
              <tr
                key={row.key}
                style={{
                  borderBottom: `1px solid ${T.gridLine}`,
                  background: row.highlight ? `rgba(245,196,24,0.04)` : "transparent",
                }}
              >
                <td style={{
                  padding: "7px 10px",
                  color: row.highlight ? T.yellow : row.muted ? T.textMuted : T.textPri,
                  fontWeight: row.highlight ? 700 : 400,
                  fontSize: 11,
                }}>
                  {row.label}
                </td>
                {data.map((yearRow) => (
                  <td key={yearRow.year} style={{
                    padding: "7px 10px",
                    textAlign: "right",
                    color: row.highlight ? T.yellow : row.muted ? T.textMuted : T.textPri,
                    fontWeight: row.highlight ? 700 : 400,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {fmt((yearRow as any)[row.key], row.isRate)}
                  </td>
                ))}
              </tr>
            ))
          }
        </tbody>
        <tfoot>
          <tr style={{ borderTop: `1px solid ${T.border}` }}>
            <td colSpan={YEARS.length + 1} style={{ padding: "6px 10px", fontSize: 10, color: T.textHint }}>
              단위: 억원 (영업이익률 제외)
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
