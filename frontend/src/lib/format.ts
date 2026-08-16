export function fmtAmount(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '--';
  const y = v / 1e8;
  if (y >= 1e4) return (y / 1e4).toFixed(2) + '万亿';
  return y.toFixed(0) + '亿';
}

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || isNaN(v)) return '--';
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

export function pctClass(v: number | null | undefined): string {
  if (v == null || isNaN(v) || v === 0) return 'text-muted';
  return v > 0 ? 'text-bull' : 'text-bear';
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v == null || isNaN(v)) return '--';
  return v.toFixed(digits);
}
