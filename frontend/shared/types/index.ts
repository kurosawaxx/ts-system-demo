export type Role = 'admin' | 'user' | 'director';
export type Probability = 'won' | 'lost' | 'pending';
export type WorkStatus = 'in_progress' | 'completed';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  day_cost?: number;
  employee_code?: string | null;
  is_active?: boolean;
  // 無効化(退職等)した日時。有効化でクリアされる。
  deactivated_at?: string | null;
}

export interface Project {
  id: number;
  ts_project_code?: string | null;
  ts_job_id?: string | null;
  client_name?: string | null;
  project_name: string;
  account_director?: string | null;
  sales_rep?: string | null;
  ts_created_date?: string | null;
  currency: string;
  amount?: number;
  gross_profit_plan?: number | null;
  gross_profit_actual?: number | null;
  direct_outsourcing_cost_plan?: number | null;
  internal_hours_plan?: number | null;
  internal_hours_input?: number | null;
  billing_confirmed?: boolean;
  billing_pd_confirmed?: boolean;
  probability?: Probability;
  billing_month?: string | null;
  acceptance_month?: string | null;
  start_month?: string | null;
  end_month?: string | null;
  work_status: WorkStatus;
  notes?: string | null;
  ts_last_synced_at?: string | null;
  // 管理者一覧APIは role を含み、actual_hours(案件×担当者ごとのwork_hours合計)を付与する。
  // monthly は明細月(計画明細の work_month と実績の月の和集合)ごとの実働工数の内訳で、
  // エクスポートを取込元ファイルと同じ明細行に分解するために使う。
  // is_active は無効化されたメンバーを「（無効）」付きで表示するために返る。
  users?: (Pick<User, 'id' | 'name' | 'role' | 'is_active'> & {
    actual_hours?: number;
    monthly?: { month: string; actual_hours: number }[];
  })[];
  // 担当案件一覧(一般ユーザー向け)API が付与する案件単位の工数(いずれも role=user 分のみ、単位は時間)
  // total_planned_hours: 計画明細(project_work_items)の計画額を人日単価で割って時間換算したもの
  // total_actual_hours:  work_hours の実入力時間の合計
  total_planned_hours?: number;
  total_actual_hours?: number;
  // Admin-only profit fields (computed from work hours)
  total_cost?: number;
  gross_profit?: number;
  margin?: number;
}

export interface ImportResult {
  message: string;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface WorkHour {
  id: number;
  project_id: number;
  user_id: number;
  work_date: string;
  hours: number;
  memo?: string | null;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}
