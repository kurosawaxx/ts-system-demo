const HOURS_PER_DAY = 8;

export function roundDays(days: number): number {
  return Math.round(days * 100) / 100;
}

export function hoursToDays(hours: number): number {
  return roundDays(hours / HOURS_PER_DAY);
}

export function formatPersonDays(hours: number): string {
  return `${hoursToDays(hours)}人日`;
}

export function formatDaysAndYen(days: number, yen: number): string {
  return `${days}人日(¥${Math.round(yen).toLocaleString()})`;
}

/**
 * 工数入力時/インポート時にスナップショットされた「当時の単価」を表示する。
 * 案件途中で単価改定があった場合は min !== max になるので範囲で見せる。
 * 単価が一度も使われていない(実績も計画もない)場合は空文字を返し、呼び出し側で非表示にする。
 */
export function formatDayCostRange(min?: number | null, max?: number | null): string {
  if (min == null || max == null) return '';
  const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;
  return min === max ? `${yen(min)}/人日` : `${yen(min)}〜${Math.round(max).toLocaleString()}`;
}
