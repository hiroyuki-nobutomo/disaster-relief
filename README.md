# disaster-relief — 災害対応 情報管理ダッシュボード

災害対応の情報管理を実施する Web アプリケーション。
進捗可視化・**活動報告メールの5W1H分析レポート蓄積**・**項目別予実管理**の基盤を備える。

## 原則（アーキテクチャの基本方針）

- **UI 層 = Vercel（Next.js / App Router）**
- **AI = Claude**（分析・エージェント機能はすべて Claude を使用）
- **データ層 = Google Sheets**（災害対応データの正本）
- コード = **GitHub**（`hiroyuki-nobutomo/disaster-relief`）

> v1 スコープ：**閲覧専用・予算項目なし・自然言語(Claude)パネルなし**。書き戻しと NL パネルは v2（[HANDOFF](docs/HANDOFF.md) §11）。
>
> **v2 着手中**：画面を `/`（ダッシュボード）と `/gantt`（ガント）に分割。両ページに **PMエージェント窓** を設置（Google Sheet 上の **データのみ** 編集可能・フレーム/ロジックは変更不可）。PMエージェントは「**確認してから書込み**」方式で実装予定・現在は未有効化（`ANTHROPIC_API_KEY` と Sheets 書き込み権限が必要）。
> ダッシュボードは Apple 志向で再構成：KPIストリップ／**評価（管理指標）3枠**（差し替え可・SPI／要注意タスク／フェーズRAG）／**進捗サマリー**（フェーズ別＋状況別を1カードに統合）＋資料リンク／**連絡**＋**カレンダー**／**PMエージェント**。主要マイルストーンはガントページへ。指標の定義と出典は [docs/METRICS.md](docs/METRICS.md)。

## アーキテクチャ

```
Google Sheets (tasks / meta / links / notices / events)   ← プロジェクト固有データ
        │  サービスアカウントで読み取り（spreadsheets.values.batchGet）
        ▼
lib/sheets.ts ── getDashboardData() ──► DashboardData
        │                                   │
   app/api/data/route.ts (GET)         app/page.tsx・app/gantt（SSR, revalidate 60s）
        │                                   │
        └────────────► components/*（UI・ロジック・デザイン＝汎用フレームワーク）
```

### データ と フレームワークの分離（重要）

- **プロジェクト固有情報はすべて Google Sheets 側のデータ**：プロジェクト名・組織（`meta`）、フェーズ名・作業項目・スケジュール・期日（`tasks`）、節目（`tasks` の milestone 行）、資料（`links`）、基準日・次回MTG（`meta`）。
- **UI・ロジック・デザインはプロジェクトに依存しない汎用フレームワーク**：コードに特定プロジェクトの値をハードコードしない。
  - フェーズ名・フェーズ期間は `tasks` から算出（`derive.phasesOf` / `phasePeriod`）。
  - ガントの期間レンジ・月ヘッダは `tasks` の最小開始〜最大終了から算出（`derive.projectRange`）。
  - プロジェクト名・組織はヘッダがデータ（`meta`）から表示。
- 集計（進捗率・状況別件数・ステータス判定・管理指標）はすべて UI 側（`lib/derive.ts` / `lib/metrics.ts`）。Sheet は生データのみ持つ。

### 別プロジェクトへの切替

環境変数 **`SHEET_ID` を別の Google Sheets に向け替える**だけで、全データ（プロジェクト名・スケジュール・フェーズ・節目・連絡・資料）が再ロードされ、フレームワークはそのままに別プロジェクトを管理できる。

### マルチテナント（ID＋パスワードで切替）

`PROJECTS` 環境変数を設定すると **要ログインモード**になり、ログインID（例: `AI-BCP` / `ASC`）ごとに対応する Google Sheet を開く。未設定なら従来どおり `SHEET_ID` のシングルテナント（ログインなし）で動作（後方互換）。手順は [docs/SETUP.md ⑦](docs/SETUP.md) を参照。

- `AUTH_SECRET`（署名・ハッシュ鍵）と `PROJECTS`（`{"ID":{"sheetId","passwordHash"}}`）を設定。
- パスワードハッシュは `AUTH_SECRET="…" node scripts/hash-password.mjs "パスワード"` で生成。
- パスワードは平文保存せず `AUTH_SECRET` を鍵にした HMAC-SHA256 で照合。セッションは署名付き Cookie（12時間）。

## セットアップ

### 1. 依存をインストール

```bash
npm install
```

### 2. Google サービスアカウント（読み取り）

1. Google Cloud プロジェクトで **Google Sheets API** を有効化
2. **サービスアカウント**を作成し JSON キーを発行
3. 対象スプレッドシートを、サービスアカウントの `client_email` に**閲覧者として共有**
4. `.env.local.example` を `.env.local` にコピーして値を設定

```bash
cp .env.local.example .env.local
```

| 変数                           | 用途                                                     |
| ------------------------------ | -------------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | サービスアカウントの client_email                        |
| `GOOGLE_PRIVATE_KEY`           | 秘密鍵（改行を `\n` にエスケープしダブルクオートで囲む） |
| `SHEET_ID`                     | スプレッドシート ID                                      |

> **環境変数が未設定の場合**は `lib/seed.ts` のサンプルデータ（26行）で描画します。
> 画面右下に「サンプルデータを表示中」と表示されるので、実データとの取り違えを防げます。

### 3. 開発サーバ

```bash
npm run dev
# http://localhost:3000        ダッシュボード
# http://localhost:3000/api/data  DashboardData (JSON)
```

## Google Sheets のタブ構成（[HANDOFF](docs/HANDOFF.md) §2）

- **`tasks`**（1行目ヘッダ固定 / `A2:I`）: `id, phase(大項目), activity(中項目), kind(task|milestone), name, owner, start(YYYY-MM-DD), end, progress(0..1)`
  - **タスクID（`id`）が全機能の軸**。プロジェクトを構成する個別の小項目（タスク）に一意のIDを付与し、ガント・予実管理・活動報告の分類・ダッシュボードの管理はすべてこのIDに基づく
  - 作業は **大項目（phase）→ 中項目（activity）→ 小項目（タスク）** の3階層で整理する。ID は `<中項目番号>-<小項目No>`（例: `1-3`＝中項目1の小項目3）を推奨。節目（milestone）は `M1`, `M2`, …（大項目・中項目は空欄可）
  - 階層のレベル感は全プロジェクト共通、名称・内容はプロジェクトごとに定義する（例: ASC では 大項目=柱（研究／教育／草の根／事業運営）、中項目=活動、小項目=予算項目 が対応）
- **`meta`**（`A2:B` の key/value）: `project_name`, `org`, `basis_date`, `next_meeting_datetime`, `next_meeting_agenda`, `drive_folder_id`（任意・資料フォルダ）
- **`links`**（`A2:B`）: `label`, `url`
- **`notices`**（任意 / `A2:B`）: `text, date` — 大切な連絡事項（箇条書き）。「概要」ページの「連絡事項」に表示。**タブが無くても本体は動作**（空表示）。
- **`reports`**（任意 / `A2:J`）: `date, who, task_id, task_name, where, what, how, why, source, created_at` — 活動報告（5W1H）。「活動報告」ページのメール取り込み（貼り付け→Claude分析→確認→登録）で追記され、一覧に蓄積表示される。`task_id` は `tasks` の id への対応付け（任意）。**タブが無くても本体は動作**（空表示・登録時はタブ作成を案内）。
- **`budget`**（任意 / `A2:D`）: `task_id, budget, actual, note` — タスクID単位の予実（金額・円）。小項目名・大項目・中項目は `tasks` から自動で引き、「予実管理」ページで 大項目→中項目→小項目（タスク） の階層で予算・実績・残額・消化率を集計表示。金額セルは `1,200,000` / `¥1200000` 等の表記も可。**タブが無くても本体は動作**（空表示）。
- **`events`**（任意 / `A2:H`）: `startdate, starttime, enddate, endtime, title, place, url, note` — カレンダー予定（ミーティング等）。`starttime`/`endtime`（`HH:MM`・任意）があれば週表示で**時間ブロック**、空なら終日。`enddate` を指定すると**日をまたぐ予定**（各日に表示）。「概要」ページのカレンダーに表示（**ガントには出ない**）。PMエージェントの「カレンダーに入れて」はここに追加。**タブが無くても本体は動作**（空表示）。

### 資料（Google ドライブ連携）

「概要」ページの「資料」は、`meta.drive_folder_id` で指定した Google ドライブ**フォルダ配下のファイル（サブフォルダ内も再帰的に）を自動一覧**し、`/api/drive/[id]` 経由（サービスアカウント・プロキシ）でダウンロードできる。閲覧者は各自の Google アクセス権が無くても DL 可能。

有効化に必要:

1. Google Cloud で **Drive API を有効化**
2. 対象フォルダをサービスアカウントの `client_email` に**閲覧者**で共有
3. `meta` タブに `drive_folder_id`＝フォルダ ID（フォルダ URL の `/folders/` の後ろ）を設定

初期データは `lib/seed.ts` の `SEED`（汎用サンプル）を投入する。

## ページ構成（5画面）

タブ順: **プロジェクト概要／ダッシュボード／ガントチャート／予実管理／活動報告**

- **`/`（プロジェクト概要）**: KPI（全体進捗率・完了・進行中・遅延）／連絡事項（`notices`）／資料（Google ドライブ・`drive_folder_id`）／カレンダー
- **`/dashboard`（ダッシュボード）**: KPI／評価（管理指標3枠）／進捗サマリー／資料リンク
- **`/gantt`（ガントチャート)**: ガントチャート（タスクID付き）＋タスク詳細
- **`/budget`（予実管理）**: `budget` タブのタスクID単位の予算・実績を、大項目→中項目→小項目（タスク）の階層で集計表示（小計・合計・消化率・超過は赤表示）
- **`/reports`（活動報告）**: 活動報告メールの貼り付け → Claude が5W1H（誰が・どのタスクで・どこで・どんな作業を・いつ・どうやって）に整理・タスクIDに対応付け → 確認・修正して `reports` タブへ登録。蓄積分は「誰が」「タスク」で絞り込み表示

活動報告の分析（`/api/reports` の analyze）は PMエージェントと同じく `ANTHROPIC_API_KEY` が必要。登録（save）にはサービスアカウントの編集者権限が必要。**現状は貼り付け方式**で、将来は専用転送アドレス経由の自動取り込みへ拡張する想定。

PMエージェント窓は全ページ共通のフローティング窓（右下）。

## デプロイ（Vercel）

1. GitHub に push
2. Vercel で当リポジトリを連携
3. Vercel の **Environment Variables** に上記3変数を設定（鍵はコミットしない）
4. デプロイ。源泉 Sheet は管理側の Google Workspace に置き、閲覧者へは閲覧共有

## ディレクトリ

```
app/
  layout.tsx              フォント（Inter + Noto Sans JP）・メタ
  page.tsx                / = ダッシュボード（SSR → DashboardView）
  gantt/page.tsx          /gantt = ガントチャート（SSR → GanttView）
  api/data/route.ts       GET /api/data → DashboardData(JSON)
  api/assistant/route.ts  POST /api/assistant → PMエージェント（データ編集／※未有効化）
  globals.css             Tailwind ＋ 共通カード .card（角丸・極薄罫線・柔らかい陰影）
components/
  AppHeader.tsx           共通ヘッダ＋ページ切替タブ（基準日 input）
  DashboardView.tsx       client：ダッシュボード（KPI・評価指標・進捗・リンク・連絡・カレンダー・PMエージェント）
  GanttView.tsx           client：ガント＋タスク詳細＋主要マイルストーン
  EvaluationPanel.tsx     client：評価（管理指標）3枠・差し替え可能（localStorage 保存）
  ProgressOverview.tsx    フェーズ別進捗＋状況別タスク数を1カードに統合
  Calendar.tsx            client：月カレンダー（基準日・節目・MTGをマーク／月送り）
  ThreadsPanel.tsx        連絡（最近のスレッド）窓：threads タブの最新3件
  AssistantPanel.tsx      client：PMエージェント窓（データのみ編集／ガード付き）
  SourceNote.tsx KPI.tsx Gantt.tsx Milestones.tsx Links.tsx Pill.tsx
lib/
  types.ts derive.ts palette.ts seed.ts sheets.ts
  metrics.ts              管理指標レジストリ（SPI / 要注意タスク / フェーズRAG。出典は docs/METRICS.md）
docs/
  HANDOFF.md              仕様書（設計・データ契約）
```
