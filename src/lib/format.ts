/** 원 → 억원 (소수점 1자리) */
export function toEok(won: number | null | undefined): number | null {
  if (won == null) return null;
  return Math.round(won / 100_000_000 * 10) / 10;
}

/** 원 → 백만원 (정수) */
export function toMillion(won: number | null | undefined): number | null {
  if (won == null) return null;
  return Math.round(won / 1_000_000);
}

/** 억원 표시: "1,256억" */
export function fmtEok(won: number | null | undefined): string {
  const v = toEok(won);
  if (v == null) return "—";
  return `${v.toLocaleString("ko-KR")}억`;
}

/** 백만원 표시: "10,309백만" */
export function fmtMillion(won: number | null | undefined): string {
  const v = toMillion(won);
  if (v == null) return "—";
  return `${v.toLocaleString("ko-KR")}백만`;
}

/** 달성률: actual ÷ base × 100 */
export function calcRate(actual: number | null, base: number | null): number | null {
  if (actual == null || base == null || base === 0) return null;
  return Math.round((actual / base) * 100);
}

/** 달성률 표시: "103%" */
export function fmtRate(actual: number | null, base: number | null): string {
  const v = calcRate(actual, base);
  if (v == null) return "—";
  return `${v}%`;
}

/** YoY 표시: "▲10.2%" 또는 "▼3.1%" */
export function fmtYoy(current: number | null, prev: number | null): string {
  if (current == null || prev == null || prev === 0) return "—";
  const pct = ((current - prev) / Math.abs(prev)) * 100;
  const sign = pct >= 0 ? "▲" : "▼";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

/** 비율 표시: "7.0%" */
export function fmtPct(ratio: number | null | undefined): string {
  if (ratio == null) return "—";
  const val = Math.abs(ratio) <= 1 ? ratio * 100 : ratio;
  return `${val.toFixed(1)}%`;
}