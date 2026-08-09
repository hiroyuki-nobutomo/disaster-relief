// 災害対応 情報管理のデータ型。Google Sheets の各タブと1対1に対応する。
// シート間は id（各シート A 列）で相互参照し、RDB 的に連携する（docs/DESIGN.md）。

/** 担当者（members タブ）。 */
export interface Member {
  id: string; // 例 M-01
  name: string;
  kana?: string;
  org?: string; // 所属（大学・団体等）
  role?: string; // 役割（統括・物資・記録 等）
  groupId?: string; // groups.id
  phone?: string;
  email?: string;
  note?: string;
}

/** 班・グループ（groups タブ）。 */
export interface Group {
  id: string; // 例 G-1
  name: string;
  mission?: string; // 任務・担当領域
  leaderId?: string; // members.id
  note?: string;
}

export type ScheduleScope = "全体" | "グループ" | "個人";

/** 現地スケジュール（schedule タブ）。scope で全体/グループ/個人を区別し、
 *  個人ビューでは 全体＋所属グループ＋本人＋本人の予約 を重ねて表示する。 */
export interface ScheduleItem {
  id: string; // 例 SC-001
  date: string; // YYYY-MM-DD
  start?: string; // HH:MM
  end?: string; // HH:MM
  scope: ScheduleScope;
  targetId?: string; // グループ→groups.id / 個人→members.id（全体は空）
  title: string;
  place?: string;
  note?: string;
}

export type BookingType = "ホテル" | "飛行機" | "新幹線" | "レンタカー" | "その他";
export type BookingStatus = "予約済" | "仮予約" | "キャンセル";

/** ホテル・移動の予約（bookings タブ）。担当者・日付でスケジュールと連動。 */
export interface Booking {
  id: string; // 例 B-001
  memberId: string; // members.id
  type: BookingType;
  startDate: string; // YYYY-MM-DD（チェックイン/出発日）
  endDate?: string; // YYYY-MM-DD（チェックアウト/帰着日）
  name: string; // ホテル名・便名など
  detail?: string; // 部屋・座席・区間など
  confNo?: string; // 予約番号
  status: BookingStatus;
  note?: string;
}

export type SupplyStatus = "手配中" | "輸送中" | "到着" | "配布済";

/** 災害支援品目（supplies タブ）。ロット単位で管理し、送付先は shelters.id と連携。 */
export interface Supply {
  id: string; // 例 SP-001
  lotNo?: string;
  item: string;
  category?: string; // 食料・水・衛生用品 等
  qty?: string; // 数量（"500" など。単位は unit）
  unit?: string;
  from?: string; // 送付元
  toShelterId?: string; // shelters.id（送付先）
  status: SupplyStatus;
  shipDate?: string; // YYYY-MM-DD
  arriveDate?: string; // YYYY-MM-DD
  requestId?: string; // requests.id（どの要請に応えたか）
  note?: string;
}

export type RequestUrgency = "高" | "中" | "低";
export type RequestStatus = "受付" | "手配中" | "対応済";

/** 支援要請・ニーズ（requests タブ）。避難所からの要請を受け付け、supplies の手配と紐づける。
 *  （国の物資調達・輸送調整等支援システムの「要請→調達→輸送」の流れを簡略化したもの） */
export interface SupportRequest {
  id: string; // 例 R-001
  date: string; // YYYY-MM-DD
  shelterId?: string; // shelters.id（要請元）
  content: string; // 要請内容（品目・支援内容）
  qty?: string;
  urgency: RequestUrgency;
  status: RequestStatus;
  note?: string;
}

export type ShelterStatus = "開設" | "閉鎖";

/** 支援先避難所・拠点（shelters タブ）。物資の送付先・要請元・記録の関連先。 */
export interface Shelter {
  id: string; // 例 SH-01
  name: string;
  type?: string; // 避難所・支援拠点 等
  address?: string;
  mapUrl?: string; // 空なら住所から Google マップ検索リンクを生成
  contactName?: string;
  phone?: string;
  capacity?: string; // 収容可能人数
  current?: string; // 現在の避難者数
  needs?: string; // 主なニーズ
  status: ShelterStatus;
  note?: string;
}

/** 連絡先（contacts タブ）。自治体・社協・医療・NPO 等の関係機関。 */
export interface Contact {
  id: string; // 例 C-01
  org: string;
  name?: string;
  role?: string;
  category?: string; // 自治体・政府・社協・医療・NPO・物流・その他
  phone?: string;
  email?: string;
  shelterId?: string; // 関連する避難所（任意）
  note?: string;
}

export type LogKind = "ヒアリング" | "時系列" | "指示・決定" | "申し送り";

/** 記録の公開範囲。既定は「共有」（全員に見える）。
 *  「下書き」「プライベート」は作成者（authorId）本人だけが閲覧できる。 */
export type LogVisibility = "共有" | "下書き" | "プライベート";

/** 現地記録（logs タブ）。ヒアリング内容の共有と、災害対応で標準的な
 *  クロノロジー（時系列の出来事・指示・決定の記録）を1つのタブで扱う。 */
export interface LogEntry {
  id: string; // 例 L-001
  datetime: string; // YYYY-MM-DD HH:MM（時刻省略可）
  kind: LogKind;
  reporter?: string; // 記録者（members の名前）
  shelterId?: string; // 関連避難所（任意）
  title: string;
  content?: string;
  tags?: string; // カンマ区切り
  source?: string; // 出典（メール件名・発話者等）
  visibility: LogVisibility;
  authorId?: string; // 作成者（members.id）。下書き・プライベートの閲覧判定に使う
  createdAt?: string;
}

/** 添付画像の索引（images タブ）。画像本体（base64チャンク）は重いので
 *  一覧には含めず、表示時に /api/relief/image?id=… で取得する。 */
export interface ImageIndex {
  id: string; // 例 IMG-001
  refIds: string[]; // 紐づく記録のID（例 ["R-005","L-010"]。ID接頭辞で表を判別）
  mime: string; // image/jpeg 等
}

/** アプリ全体のデータ。/api/relief/data が返す。
 *  logs はサーバ側で閲覧者に応じてフィルタ済み（共有以外は本人の分のみ含まれる）。 */
export interface ReliefData {
  disasterName: string; // meta.disaster_name
  hq: string; // meta.hq（現地本部・拠点）
  basisDate: string; // 今日（JST）
  /** ログイン中の担当者（未ログイン・認証無効時は未設定）。個人出し分けに使う。 */
  currentMemberId?: string;
  currentMemberName?: string;
  members: Member[];
  groups: Group[];
  schedule: ScheduleItem[];
  bookings: Booking[];
  supplies: Supply[];
  requests: SupportRequest[];
  shelters: Shelter[];
  contacts: Contact[];
  logs: LogEntry[];
  images: ImageIndex[];
  source: "sheets" | "seed";
}
