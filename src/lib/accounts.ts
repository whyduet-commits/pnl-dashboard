/** 핵심 account_id 상수 */
export const ACCOUNT = {
  REVENUE:          1,    // 매출 합계
  COGS:             29,   // 매출원가 합계
  GROSS_PROFIT:     126,  // 매출총이익
  SGA:              128,  // 판관비 합계
  OP_PROFIT_1:      272,  // 영업이익Ⅰ (K-IFRS)
  OP_PROFIT_COMMON: 277,  // 공통비배부후영업이익
  OP_PROFIT_2:      285,  // 영업이익Ⅱ (조정영업이익)
} as const;

/** 연간 요약 테이블 행 순서 */
export const SUMMARY_TABLE_ROWS = [
  { id: ACCOUNT.REVENUE,          label: "매출",               unit: "eok" as const },
  { id: ACCOUNT.COGS,             label: "매출원가",            unit: "eok" as const },
  { id: ACCOUNT.SGA,              label: "판관비",              unit: "eok" as const },
  { id: ACCOUNT.GROSS_PROFIT,     label: "매출총이익",          unit: "eok" as const },
  { id: ACCOUNT.OP_PROFIT_1,      label: "영업이익Ⅰ",          unit: "eok" as const },
  { id: ACCOUNT.OP_PROFIT_COMMON, label: "공통비배부후영업이익", unit: "eok" as const },
  { id: ACCOUNT.OP_PROFIT_2,      label: "영업이익Ⅱ",          unit: "eok" as const },
] as const;