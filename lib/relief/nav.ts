// タブ間の相互リンク（ジャンプ）の共通型。
// 各レコードは id 接頭辞（M-/G-/SC-/B-/SP-/R-/SH-/C-/L-）で所属タブが判別できる。
// ジャンプ先の要素は DOM id `rec-<レコードID>` を持ち、到着時に自動スクロール＋ハイライトされる。

export type TabKey = "home" | "roster" | "schedule" | "supplies" | "field" | "logs";

export type NavTarget = {
  tab: TabKey;
  /** タブ内セグメント（schedule|bookings / requests|supplies / shelters|contacts） */
  seg?: string;
  /** ハイライト対象のレコードID */
  focusId?: string;
  /** 予定タブの表示対象にする担当者ID */
  memberId?: string;
  /** 同一ターゲットへの再ジャンプでも効果が再発火するようにするノンス */
  at?: number;
};

export type Navigate = (target: NavTarget) => void;
