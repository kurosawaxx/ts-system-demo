export const COL_LABELS = [
  'プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター',
  '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '直接外注費(実績)', '確度',
] as const;

export const DEFAULT_COL_WIDTHS = [160, 160, 260, 200, 110, 110, 110, 80, 110, 146, 146, 94];

export const RIGHT_ALIGN_COLS = new Set([8, 9, 10]);
export const CENTER_ALIGN_COLS = new Set([11]);
