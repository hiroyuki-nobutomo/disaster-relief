export type Kind = "task" | "milestone";
export type Status = "完了" | "進行中" | "未着手" | "遅延" | "予定";

export interface Task {
  /** タスクID（プロジェクト内で一意の文字列。例: "1-3"＝中項目1の小項目3、"M1"＝節目）。
   *  タスク＝小項目。ガント・予実・活動報告・ダッシュボードすべてこのIDを軸に管理する。 */
  id: string;
  /** 大項目。例: "大項目1：調査・研究" */
  phase: string;
  /** 中項目。例: "中項目1：実態調査"（任意・無いプロジェクトは空） */
  activity: string;
  kind: Kind;
  name: string;
  owner: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  progress: number; // 0..1 (milestone は 0 扱い)
}

/** 大切な連絡事項（箇条書き）。Sheet の `notices` タブ由来（任意）。 */
export interface Notice {
  text: string;
  date?: string; // YYYY-MM-DD など（任意）
}

/** カレンダー予定（ミーティング等）。Sheet の `events` タブ由来（任意）。ガントには出さない。 */
export interface CalendarEvent {
  startDate: string; // YYYY-MM-DD
  startTime?: string; // HH:MM（任意）
  endDate?: string; // YYYY-MM-DD（任意・空なら startDate と同じ）
  endTime?: string; // HH:MM（任意）
  title: string;
  place?: string; // 場所（任意）
  url?: string; // 関連URL（任意）
  note?: string; // メモ（任意）
  row?: number; // events タブ上の行番号（Web編集用）
}

/** 資料（Google ドライブの対象フォルダ内ファイル）。meta.drive_folder_id で対象を指定。 */
export interface Material {
  id: string;
  name: string;
  mimeType: string;
  size?: number; // bytes
  modifiedTime?: string;
  createdTime?: string; // アップロード日時（新しい順の並び替え・表示に使用）
  folder?: string; // 対象フォルダからの相対サブフォルダパス（直下なら未設定）
}

/** 活動報告（メール由来の5W1H）。Sheet の `reports` タブ由来（任意）。 */
export interface ActivityReport {
  /** いつ（作業日 YYYY-MM-DD） */
  date: string;
  /** 誰が */
  who: string;
  /** どのタスクで（tasks の id。対応付け不能なら未設定） */
  taskId?: string;
  /** タスク名（登録時のスナップショット。tasks 改名後も報告の文脈を保つ） */
  taskName?: string;
  /** どこで */
  where?: string;
  /** どんな作業を（What） */
  what: string;
  /** どうやって（How・手段や方法） */
  how?: string;
  /** なぜ・目的（Why・読み取れた場合のみ） */
  why?: string;
  /** 出典（元メールの件名・差出人等） */
  source?: string;
  /** 登録日時（JST） */
  createdAt?: string;
}

/** 予実（金額）。Sheet の `budget` タブ由来（任意）。タスクID単位で予算・実績を持つ。 */
export interface BudgetItem {
  /** 対象タスクの id（tasks タブの id 列に対応） */
  taskId: string;
  /** 予算額（円） */
  budget: number;
  /** 実績額（円） */
  actual: number;
  /** 備考（任意） */
  note?: string;
}

export interface DashboardData {
  /** プロジェクト名（meta.project_name）。フレームワークはこれに依存しない汎用。 */
  projectName: string;
  /** 組織・体制などの副題（meta.org）。 */
  org: string;
  basisDate: string; // YYYY-MM-DD
  tasks: Task[];
  links: { label: string; url: string }[];
  notices: Notice[];
  events: CalendarEvent[];
  materials: Material[];
  /** 活動報告（5W1H）。`reports` タブ由来（タブが無ければ空）。 */
  reports: ActivityReport[];
  /** 予実（金額）項目。`budget` タブ由来（タブが無ければ空）。 */
  budget: BudgetItem[];
  /** データの出所。"sheets" = Google Sheets 実データ / "seed" = 未接続時のサンプル */
  source?: "sheets" | "seed";
}
