"use client";

interface KpiData {
  cm: number;
  year: number;
  매출: {
    actual: number | null;
    plan: number | null;
    target: number | null;
    달성률_vs_plan: number | null;
    달성률_vs_target: number | null;
    yoy: number | null;
  };
  영업이익2: {
    actual: number | null;
    plan: number | null;
    target: number | null;
    달성률_vs_plan: number | null;
    달성률_vs_target: number | null;
    yoy: number | null;
  };
}

function fmt(v: number | null): string {
  if (v == null) return "—";
  return `${v < 0 ? "-" : ""}${Math.abs(v).toLocaleString("ko-KR")}억`;
}

function fmtYoy(v: number | null): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "▲" : "▼";
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

function RateBar({ value }: { value: number | null }) {
  if (value == null) return null;
  const capped = Math.min(value, 200);
  const isOver = value >= 100;
  return (
    <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden mt-2">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${(capped / 200) * 100}%`,
          background: isOver
            ? "linear-gradient(90deg, #3b82f6, #60a5fa)"
            : "linear-gradient(90deg, #ef4444, #f87171)",
        }}
      />
    </div>
  );
}

function KpiCard({
  label,
  actual,
  plan,
  target,
  rate,
  yoy,
  color,
}: {
  label: string;
  actual: number | null;
  plan: number | null;
  target: number | null;
  rate: number | null;
  yoy: number | null;
  color: string;
}) {
  const isOver = rate != null && rate >= 100;

  return (
    <div className="bg-[#12151c] border border-white/[0.06] rounded-2xl p-6 flex flex-col gap-5">

      {/* 레이블 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/40 uppercase tracking-widest">{label}</span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: isOver ? `${color}20` : "#ef444420",
            color: isOver ? color : "#f87171",
          }}
        >
          {isOver ? "목표초과" : "목표미달"}
        </span>
      </div>

      {/* 달성률 + 진행바 */}
      <div>
        <div className="flex items-end gap-2">
          <span
            className="text-5xl font-bold tabular-nums tracking-tighter"
            style={{ color: isOver ? color : "#f87171" }}
          >
            {rate != null ? `${rate}` : "—"}
          </span>
          <span className="text-xl text-white/30 mb-1">%</span>
          <span className="text-xs text-white/25 mb-2 ml-1">달성률</span>
        </div>
        <RateBar value={rate} />
      </div>

      {/* actual / plan / target */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/[0.03] rounded-xl p-3">
          <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider">실적</p>
          <p className="text-base font-semibold tabular-nums">{fmt(actual)}</p>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3">
          <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider">계획</p>
          <p className="text-base font-medium tabular-nums text-white/50">{fmt(plan)}</p>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3">
          <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider">목표</p>
          <p className="text-base font-medium tabular-nums text-white/50">{fmt(target)}</p>
        </div>
      </div>

      {/* YoY */}
      <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
        <span className="text-xs text-white/25">전년대비</span>
        <span
          className="text-sm font-semibold"
          style={{ color: yoy == null ? "#fff" : yoy >= 0 ? "#34d399" : "#f87171" }}
        >
          {fmtYoy(yoy)}
        </span>
      </div>
    </div>
  );
}

export default function KpiCards({ data }: { data: KpiData }) {
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="text-sm font-semibold text-white/80 tracking-wide">2026 계획대비</h2>
        <span className="text-xs text-white/25">2026년 1~{data.cm}월 누계 기준</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          label="매출 달성률"
          actual={data.매출.actual}
          plan={data.매출.plan}
          target={data.매출.target}
          rate={data.매출.달성률_vs_plan}
          yoy={data.매출.yoy}
          color="#60a5fa"
        />
        <KpiCard
          label="영업이익Ⅱ 달성률"
          actual={data.영업이익2.actual}
          plan={data.영업이익2.plan}
          target={data.영업이익2.target}
          rate={data.영업이익2.달성률_vs_plan}
          yoy={data.영업이익2.yoy}
          color="#a78bfa"
        />
      </div>
    </section>
  );
}
