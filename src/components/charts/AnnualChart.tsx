"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
} from "recharts";

interface AnnualRow {
  year: number;
  매출_actual: number | null;
  영업이익2_actual: number | null;
  영업이익률_actual: number | null;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c2030] border border-white/10 rounded-xl p-4 text-xs shadow-2xl min-w-[160px]">
      <p className="text-white/50 font-medium mb-3 text-sm">{label}년</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between items-center gap-6 mb-2 last:mb-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-white/50">{p.name}</span>
          </div>
          <span className="text-white font-semibold tabular-nums">
            {p.name.includes("률") ? `${p.value}%` : `${p.value?.toLocaleString("ko-KR")}억`}
          </span>
        </div>
      ))}
    </div>
  );
};

const CustomLegend = ({ payload }: any) => (
  <div className="flex items-center justify-center gap-6 mt-2">
    {payload?.map((entry: any) => (
      <div key={entry.value} className="flex items-center gap-1.5">
        <span
          className="w-3 h-3 rounded-sm"
          style={{ background: entry.color }}
        />
        <span className="text-xs text-white/40">{entry.value}</span>
      </div>
    ))}
  </div>
);

export default function AnnualChart({ data }: { data: AnnualRow[] }) {
  const chartData = data
    .filter((d) => d.매출_actual != null)
    .map((d) => ({
      year: `${d.year}`,
      매출: d.매출_actual,
      영업이익Ⅱ: d.영업이익2_actual,
      영업이익률: d.영업이익률_actual,
    }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="year"
          tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}억`}
          width={60}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
          width={45}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Legend content={<CustomLegend />} />
        <Bar
          yAxisId="left"
          dataKey="매출"
          fill="#3b82f6"
          radius={[6, 6, 0, 0]}
          maxBarSize={52}
          opacity={0.85}
        />
        <Bar
          yAxisId="left"
          dataKey="영업이익Ⅱ"
          fill="#7c3aed"
          radius={[6, 6, 0, 0]}
          maxBarSize={52}
          opacity={0.85}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="영업이익률"
          stroke="#34d399"
          strokeWidth={2.5}
          dot={{ fill: "#34d399", r: 5, strokeWidth: 0 }}
          activeDot={{ r: 7, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
