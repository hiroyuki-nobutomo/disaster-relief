# プロジェクト・マネジメント ダッシュボード — ハンドオフ仕様書

**目的**: プロジェクトの進捗を可視化する Web ダッシュボード（汎用テンプレート）を構築する。
**この文書の役割**: 設計・デザイン・データ契約をすべて確定済みとして引き渡す。Claude Code はこの仕様に沿って実装・デプロイのみを行えばよい。

---

## 0. 確定事項（前提・スコープ）

| 項目                   | 決定                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- |
| アーキテクチャ         | UI層 = Vercel (Next.js) ／ データ層 = Google Sheets ／ コード = GitHub                |
| データ取得             | サービスアカウントで Google Sheets を**読み取り**（決定 **A1：閲覧専用**）            |
| 自然言語(Claude)パネル | **v1では載せない**（決定 **B1**）。v2で追加                                           |
| 予算管理               | **本システムでは扱わない**（意図的に除外）                                            |
| 既存UI実装             | App Router に実装済み。`SEED`（`lib/seed.ts`）を `/api/data` 取得データに差し替え済み |
| カラー                 | 指定パレットに準拠（後述）                                                            |

参照:

- 実装は `app/` `components/` `lib/` に反映済み（初期データは `lib/seed.ts`）。

---

## 1. 技術スタック

- **Next.js（App Router）/ React / TypeScript**
- デプロイ: **Vercel**（GitHub連携）
- Sheets読み取り: **googleapis**（`google.sheets('v4')`）または `google-spreadsheet`。いずれもサービスアカウント認証
- スタイル: 既存プレビューは Tailwind ユーティリティ + インラインスタイル。プロジェクト方針に合わせてよい（Tailwind 推奨）
- 文字: `Inter` + `Noto Sans JP`（日本語）

> バージョンは導入時点の安定版に合わせる。データ取得・キャッシュは導入する Next.js のバージョンの作法に従う。

---

## 2. データ層（Google Sheets）契約

源泉は Google Sheets。**人が直接編集・閲覧できる**こと（クライアントもSheetをそのままTeams/ブラウザで確認可）。集計はすべて UI 側で行うため、Sheet は生データのみ持つ。

### 2.1 `tasks` タブ（1行目ヘッダ固定）

作業は **大項目（phase）→ 中項目（activity）→ 小項目（タスク）** の3階層で整理する。
1行＝1小項目（タスク）で、**タスクID（`id`）が全機能（ガント・予実・活動報告・ダッシュボード）の軸**。

| 列  | キー       | 型     | 説明                                                                                  |
| --- | ---------- | ------ | ------------------------------------------------------------------------------------- |
| A   | `id`       | string | タスクID（一意。`<中項目番号>-<小項目No>` 推奨・例 `1-3`。節目は `M1`, `M2`, …）      |
| B   | `phase`    | string | 大項目（プロジェクトごとに自由定義。UIは登場順に自動抽出し、期間も `tasks` から算出） |
| C   | `activity` | string | 中項目（任意。予実管理の中間集計に使用）                                              |
| D   | `kind`     | enum   | `task` / `milestone`                                                                  |
| E   | `name`     | string | 小項目（タスク）名                                                                    |
| F   | `owner`    | string | 担当                                                                                  |
| G   | `start`    | date   | 開始（`YYYY-MM-DD`）                                                                  |
| H   | `end`      | date   | 終了（`YYYY-MM-DD`）                                                                  |
| I   | `progress` | number | 進捗 0〜1（milestone は空欄）                                                         |

> 初期データは `lib/seed.ts` の `SEED` を投入する（汎用サンプル）。
> 予実は `budget` タブ（`A2:D` = `task_id, budget, actual, note`）、活動報告は `reports` タブ
> （`A2:J` = `date, who, task_id, task_name, where, what, how, why, source, created_at`）に持ち、
> いずれも `tasks.id` を参照する（詳細は README）。

### 2.2 `meta` タブ（key/value）

| key            | value 例               |
| -------------- | ---------------------- |
| `project_name` | `サンプルプロジェクト` |
| `org`          | `サンプル組織`         |

> 注: `basis_date` は廃止（基準日はアクセス日＝今日を採用）。「次回ミーティング」は予定(events)の
> 直近から自動表示するため `next_meeting_*` も廃止した。いずれも `meta` には不要。

### 2.3 `links` タブ

| 列A `label`                              | 列B `url` |
| ---------------------------------------- | --------- |
| 企画書                                   | （URL）   |
| 要求仕様書（Phase1）                     | （URL）   |
| サンドボックス（Claude・Vercel・GitHub） | （URL）   |
| 共有フォルダ                             | （URL）   |

---

## 3. 型定義（`lib/types.ts`）

```ts
export type Kind = "task" | "milestone";
export type Status = "完了" | "進行中" | "未着手" | "遅延" | "予定";

export interface Task {
  no: number;
  phase: string;
  kind: Kind;
  name: string;
  owner: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  progress: number; // 0..1 (milestone は 0 扱い)
}

export interface DashboardData {
  basisDate: string; // YYYY-MM-DD
  nextMeeting: { datetime: string; agenda: string };
  tasks: Task[];
  links: { label: string; url: string }[];
}
```

---

## 4. 派生ロジック（`lib/derive.ts`）— プレビューと完全一致させること

```ts
const DAY = 86400000;
const d = (s: string) => new Date(s + "T00:00:00");

export function statusOf(t: Task, basis: string): Status {
  const b = d(basis);
  if (t.kind === "milestone") return b > d(t.end) ? "遅延" : "予定";
  if (t.progress >= 1) return "完了";
  if (t.progress === 0 && b < d(t.start)) return "未着手";
  if (b > d(t.end)) return "遅延";
  return "進行中";
}

export const taskRows = (tasks: Task[]) => tasks.filter((t) => t.kind === "task");

export const overallProgress = (tasks: Task[]) => {
  const r = taskRows(tasks);
  return r.length ? r.reduce((a, t) => a + t.progress, 0) / r.length : 0;
};

export const phaseProgress = (tasks: Task[], phase: string) => {
  const r = tasks.filter((t) => t.phase === phase && t.kind === "task");
  return r.length ? r.reduce((a, t) => a + t.progress, 0) / r.length : 0;
};

export function statusCounts(tasks: Task[], basis: string) {
  const c = { 完了: 0, 進行中: 0, 未着手: 0, 遅延: 0 } as Record<Status, number>;
  taskRows(tasks).forEach((t) => {
    c[statusOf(t, basis)]++;
  });
  return c;
}
```

---

## 5. デザインシステム

### 5.1 パレット（`lib/palette.ts`）

```ts
export const PAL = {
  brand: "#1A7EC4",
  brandLt: "#A8D4EE",
  pale: "#EAF4FB",
  ink: "#202020",
  body: "#333333",
  slate: "#5A6B7B",
  slateLt: "#8B9BAB",
  surface: "#FFFFFF",
  tint: "#F7FAFC",
  tint2: "#F0F4F8",
  border: "#E0E6EC",
  borderLt: "#EAEEF2",
  red: "#C00000",
  todayBand: "#F7DADA",
  gold: "#D9954F",
  green: "#5DA070",
};
export const CHIP: Record<string, [string, string]> = {
  完了: ["#E3F0E7", "#2E6B43"],
  進行中: ["#E6F1FA", "#135E92"],
  遅延: ["#FBE3E3", "#B02020"],
  未着手: ["#EEF1F4", "#5A6B7B"],
  予定: ["#F2F4F7", "#6B7785"],
};
```

### 5.2 トーン

白基調・細罫線・ブランドブルー一点差し・余白多め・角丸カード（rounded-xl）。「シンプルかつ先進的」。装飾的な色帯やタイトル下線は使わない（セクション見出しのみブランドブルーの細い下線）。

### 5.3 コンポーネント一覧

- ヘッダ（プロジェクト名／クライアント／次回MTG／基準日 input）
- KPIカード ×4：**全体進捗率** / **完了・全タスク** / **進行中** / **遅延**（※出来高は廃止）
- フェーズ別進捗（横バー ×3）
- 状況別タスク数（ステータスチップ + 件数）
- **ガントチャート**（後述）
- 主要マイルストーン一覧
- 資料リンク一覧
- タスク編集パネル（v1はSheets編集が正なので**閲覧表示のみ**でよい。プレビューのスライダーはv2書き戻しの意匠）

### 5.4 ガント描画仕様（`components/Gantt.tsx`）

```ts
const T0 = d("2026-06-01"),
  T1 = d("2027-03-31");
const PXDAY = 3.0;
const CHART_W = ((+T1 - +T0) / DAY) * PXDAY + PXDAY;
const LABEL_W = 270,
  ROW_H = 34;
const xOf = (s: string) => ((+d(s) - +T0) / DAY) * PXDAY;
```

- 計画バー：`left=xOf(start)`, `width=(end-start)日*PXDAY + PXDAY`、色 `brandLt`、角丸
- 実績バー：計画と同じ left、`width=計画幅*progress`、色 `brand`（progress>0のとき）
- マイルストーン：`xOf(start)` に金色の菱形（rotate45, 12px, `gold`）
- 基準日ライン：`left = LABEL_W + xOf(basisDate)` に赤(`red`)の縦線、全行を貫通
- 月ヘッダ：6月〜翌3月を `xOf(各月1日)` に配置
- 横スクロール、左ラベル列は固定（sticky）

---

## 6. API（`app/api/data/route.ts`）

- `GET /api/data` → `DashboardData` を JSON で返す
- サーバー側でサービスアカウント認証 → `tasks` / `meta` / `links` を `spreadsheets.values.batchGet` で取得 → 整形
- キャッシュ：60秒程度の再検証（Sheetsを開いている人の編集が概ね1分以内に反映）
- 失敗時は 5xx と簡潔なエラーメッセージ

```ts
// 概略
const sheets = google.sheets({ version: "v4", auth });
const { data } = await sheets.spreadsheets.values.batchGet({
  spreadsheetId: process.env.SHEET_ID!,
  ranges: ["tasks!A2:I", "meta!A2:B", "links!A2:B"],
});
// rows → Task[] / meta map / links[] に変換して返す
```

---

## 7. 環境変数（**鍵はコミットしない**）

| 変数                           | 用途                                  |
| ------------------------------ | ------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | サービスアカウントの client_email     |
| `GOOGLE_PRIVATE_KEY`           | 秘密鍵（`\n` のエスケープ復元に注意） |
| `SHEET_ID`                     | スプレッドシートID                    |

- ローカル: `.env.local`（`.gitignore` 済み）
- 本番: **Vercel の Environment Variables**
- 秘密鍵・JSONキーは**リポジトリに置かない**。チャットにも貼らない。

---

## 8. リポジトリ構成（目安）

```
disaster-relief/
  app/
    page.tsx                 # ダッシュボード（preview.jsx を移植・データはfetch）
    api/data/route.ts        # Sheets 読み取り
    components/
      Header.tsx  KPI.tsx  PhaseProgress.tsx  StatusPills.tsx
      Gantt.tsx  Milestones.tsx  Links.tsx  Pill.tsx
  lib/
    sheets.ts   derive.ts   types.ts   palette.ts
  .env.local                 # gitignore
  README.md
```

---

## 9. セットアップ手順

1. Google Cloud プロジェクト作成 → **Google Sheets API を有効化**
2. **サービスアカウント**作成 → JSON キーを発行
3. 対象スプレッドシートを、サービスアカウントの `client_email` に**共有（閲覧者）**
4. `client_email` / `private_key` / スプレッドシートID を `.env.local` と Vercel 環境変数へ
5. `npm i googleapis`（or `google-spreadsheet`）→ `npm run dev`
6. GitHub に push → Vercel で連携 → 環境変数設定 → デプロイ
7. **ガバナンス**：源泉Sheetは管理側の **Google Workspace** に置き、閲覧者へは閲覧共有

---

## 10. v1 受け入れ条件

- [ ] `/api/data` が Sheets の実データ（tasks/meta/links）を返す
- [ ] ダッシュボードが実データで描画（KPI・フェーズ別・状況別・ガント・マイルストーン・リンク）
- [ ] 基準日で状況・基準線が更新される（既定値はアクセス日＝今日。画面の日付ピッカーで一時変更可）
- [ ] パレット・トーンがプレビューと一致、日本語フォント適用
- [ ] **閲覧専用**：Sheetsの編集が再検証時間内に反映
- [ ] 予算項目が存在しないこと

---

## 11. スコープ外 / v2 ロードマップ

- **書き戻し（決定A2）**: サービスアカウントを編集者に昇格 → `/api/update` → 画面から進捗編集（楽観的更新）。プレビューのスライダーUIをそのまま接続
- **Claude 自然言語パネル（決定B2）**: `/api/ask` で Anthropic API にシート文脈を渡し、要約・Q&A・「○○のタスクを××に」等の操作補助
- 認証/SSO（クライアント側でアクセス制限が要る場合）
- 予算は引き続き対象外

---

## 12. Claude Code への着手指示（要約）

1. 上記 6〜9 を実装（型 → derive → palette → sheets → api → components → page）
2. UI は実装済み。`SEED` を `/api/data` 取得に置換。派生ロジックは §4 と一致させる
3. `.env.local` でローカル確認 → Vercel デプロイ
4. v1 は **閲覧専用・予算なし・NLなし**。受け入れ条件(§10)を満たしたら完了
