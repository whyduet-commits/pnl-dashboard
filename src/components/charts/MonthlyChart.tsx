"use client";

import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from "recharts";

const MONTHS = ["1","2","3","4","5","6","7","8","9","10","11","12"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1c2030", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12, padding: "12px 16px", fontSize: 12, minWidth: 160,
    }}>
      <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 10, fontWeight: 600 }}>{label}월</p>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 24, marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block" }} />
            <span style={{ color: "rgba(255,255,255,0.4)" }}>{p.name}</span>
          </div>
          <span style={{ color: "#fff", fontWeight: 600 }}>
            {p.value != null ? p.value.toLocaleString("ko-KR") : "—"}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function MonthlyChart({ data, accentColor = "#60a5fa" }: { data: any[]; accentColor?: string }) {
  const chartData = data.map((d) => ({ ...d, name: MONTHS[d.month - 1] }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 12 }}
          tickFormatter={(v) => `${v}월`}
          axisLine={false} tickLine={false}
        />
        <YAxis
          tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
          axisLine={false} tickLine={false}
          tickFormatter={(v) => Math.abs(v) >= 10000 ? `${(v/10000).toFixed(0)}만` : `${v}`}
          width={42}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(v) => <span style={{ color: "rgba(255,255,255,0.35)" }}>{v}</span>}
        />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" />
        <Line type="monotone" dataKey="actual2025" name="2025 실적"
          stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} strokeDasharray="5 4" dot={false}
          activeDot={{ r: 4, fill: "rgba(255,255,255,0.4)", strokeWidth: 0 }}
        />
        <Line type="monotone" dataKey="actual2026" name="2026 실적"
          stroke={accentColor} strokeWidth={3} dot={false}
          activeDot={{ r: 5, fill: accentColor, strokeWidth: 0 }}
        />
        <Line type="monotone" dataKey="plan2026" name="2026 계획"
          stroke={accentColor} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.35} dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
