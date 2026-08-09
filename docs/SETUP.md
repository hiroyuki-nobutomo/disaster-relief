# セットアップ手順（Google Sheets / Vercel / API）

ゼロから本番稼働までの手順書。`README.md` の「セットアップ／デプロイ」を、実作業の順序で詳細化したもの。

順序は **① Google Sheets を作る → ② サービスアカウント（読み取り認証）→ ③ ローカル動作確認 → ④ Vercel デプロイ → ⑤ v2（PMエージェント）有効化** を推奨。

---

## ① Google スプレッドシートを作る

1. <https://sheets.new> で新規スプレッドシートを作成。名前は任意（例: `disaster-relief-data`）。
2. 下部のタブを使い、**7つのタブ**を作る。タブ名は**完全一致**で（大文字小文字・全半角に注意）:
   - `tasks` / `meta` / `links` / `notices` / `events` / `budget` / `reports`
   - `notices` / `events` / `budget` / `reports` は任意（無くても本体は動作）
3. 各タブの**1行目はヘッダ固定**。`docs/seed/` の CSV をそのまま貼ると形が揃う。
   - 取り込み方: タブを選択 →〔ファイル〕→〔インポート〕→〔アップロード〕で対応する CSV を選び、
     **インポート場所＝「現在のシートを置き換える」**、**区切り文字＝カンマ** を選ぶ。
   - もしくは CSV をテキストで開いて A1 セルに貼り付け（〔データ〕→〔テキストを列に分割〕）。

| タブ      | 範囲   | ヘッダ（1行目）                                                                | seed CSV                                                  |
| --------- | ------ | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `tasks`   | `A2:I` | `id, phase(大項目), activity(中項目), kind, name, owner, start, end, progress` | `docs/seed/tasks.csv`                                     |
| `meta`    | `A2:B` | `key, value`                                                                   | `docs/seed/meta.csv`                                      |
| `links`   | `A2:B` | `label, url`                                                                   | `docs/seed/links.csv`                                     |
| `notices` | `A2:B` | `text, date`                                                                   | `docs/seed/notices.csv`                                   |
| `events`  | `A2:H` | `startdate, starttime, enddate, endtime, title, place, url, note`              | `docs/seed/events.csv`                                    |
| `budget`  | `A2:D` | `task_id, budget, actual, note`                                                | `docs/seed/budget.csv`                                    |
| `reports` | `A2:J` | `date, who, task_id, task_name, where, what, how, why, source, created_at`     | `docs/seed/reports.csv`（ヘッダのみ・本文はアプリが追記） |

データ契約の詳細（`kind` は `task|milestone`、`progress` は 0..1、`start/end` は `YYYY-MM-DD`）は
`README.md`「Google Sheets のタブ構成」と `docs/HANDOFF.md` §2 を参照。

4. URL から **`SHEET_ID`** を控える: `https://docs.google.com/spreadsheets/d/`〈**この部分**〉`/edit`

---

## ② サービスアカウント（Sheets 読み取り認証）

1. **Google Cloud プロジェクト**を用意: <https://console.cloud.google.com/projectcreate>
2. **Google Sheets API を有効化**: 〔APIとサービス〕→〔ライブラリ〕→「Google Sheets API」→〔有効にする〕
   - 直リンク: <https://console.cloud.google.com/apis/library/sheets.googleapis.com>
3. **サービスアカウントを作成**: 〔APIとサービス〕→〔認証情報〕→〔認証情報を作成〕→〔サービスアカウント〕
   - 名前は任意（例: `disaster-relief-reader`）。ロール付与は不要（Sheet 側の共有で制御する）。
4. **JSON キーを発行**: 作成したサービスアカウント →〔キー〕タブ →〔鍵を追加〕→〔新しい鍵を作成〕→ **JSON** →〔作成〕。
   JSON ファイルがダウンロードされる（**Git にコミットしない**）。
5. **スプレッドシートを共有**: ① のシートを開き〔共有〕→ JSON 内の **`client_email`**（`...@....iam.gserviceaccount.com`）を
   **閲覧者**として追加。
   - v2（書き込み）を使う場合のみ、後で**編集者**に昇格する（→ ⑤）。

### JSON キーから環境変数への対応

ダウンロードした JSON の中身と、設定する環境変数の対応:

| JSON のキー    | 環境変数                       | 注意                                               |
| -------------- | ------------------------------ | -------------------------------------------------- |
| `client_email` | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | そのまま                                           |
| `private_key`  | `GOOGLE_PRIVATE_KEY`           | 改行を `\n` にして**ダブルクオートで囲む**（下記） |
| （シート URL） | `SHEET_ID`                     | ①で控えた ID                                       |

`private_key` は元々改行を含む長い文字列。`.env.local` ではダブルクオートで囲めば JSON の `\n` 表記のまま使える
（コード側 `lib/sheets.ts` が `replace(/\\n/g, "\n")` で復元する）。

---

## ③ ローカル動作確認

```bash
npm install
cp .env.local.example .env.local   # 値を ② に従って記入
npm run dev
```

- <http://localhost:3000> … ダッシュボード
- <http://localhost:3000/api/data> … `DashboardData`（JSON）。`"source": "sheets"` なら実データ接続成功。
  - `"source": "seed"` の場合は環境変数が未設定 → `.env.local` を確認。
- 画面右下に「サンプルデータを表示中」が出ていなければ実データ表示。

> **環境変数なしでも seed データで起動する**ので、まず `.env.local` 無しで `npm run dev` して UI を確認 → その後 ② を設定、の順でも可。

---

## ④ Vercel へデプロイ（GitHub 連携・ブラウザ）

1. リポジトリを GitHub に push（このリポジトリは既に `hiroyuki-nobutomo/disaster-relief` にある）。
2. <https://vercel.com/new> → GitHub アカウントを連携 → `disaster-relief` を **Import**。
3. **Framework Preset**: Next.js（自動検出）。Build/Output 設定は既定のままで可。
4. **Environment Variables** に3つ（v1）を登録:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY` … **JSON の `private_key` の値を貼る**。Vercel の入力欄は改行をそのまま受け付けるので、
     `\n` に変換せず**実際の改行を含む値（`-----BEGIN PRIVATE KEY-----` … `-----END PRIVATE KEY-----`）をそのまま貼って良い**。
     （`lib/sheets.ts` は `\n` リテラルも実改行も両対応。）
   - `SHEET_ID`
   - 環境は Production / Preview / Development すべてに付与しておくと安全。
5. 〔Deploy〕。完了後の本番 URL で `"/api/data"` を開き `"source": "sheets"` を確認。
6. 以降は `main`（または接続ブランチ）への push で自動再デプロイ。

> SSR は `revalidate 60s`、`/api/data` は CDN で `s-maxage=60`。Sheet を編集してから反映まで最大1分程度。

---

## ⑤ v2：PMエージェント（自然言語編集）の有効化

> **実装済み**。`app/api/assistant/route.ts`（Anthropic tool use）＋ `lib/sheets-write.ts`（検証付き書き込み）。
> 反映方式は **「確認してから書き込み」**（指示→対象と新値を復唱して確認→同意した次ターンで書き込み）。
> 残りは**設定だけ**：

1. **`ANTHROPIC_API_KEY`** を `.env.local` / Vercel の環境変数に設定（`sk-ant-...`）。
   - モデルを変えたい場合のみ `ANTHROPIC_MODEL`（既定 `claude-sonnet-4-6`）。
2. **Sheets 書き込み権限**: ② のサービスアカウント `client_email` を、シートの**編集者**に昇格。
   - 昇格前は、書き込み時に「編集者か確認」エラーを返して安全に止まる。

### 実装済みのガードレール（コード側で担保）

- 書き込み用の認証は `lib/sheets-write.ts` に分離（読み取り `lib/sheets.ts` は `spreadsheets.readonly` のまま）。
- 触れてよいのは **データセルのみ**：`tasks` の 名称/担当/開始/終了/進捗、`meta` の許可キー、`links` の URL。
  - `tasks` の `id` / `phase` / `activity` / `kind`、行削除、シート構造、レイアウト・計算ロジック・コードは**変更不可**。
- 値は書き込み前に検証：`progress` は 0..1（または 0〜100%）、`start`/`end` は `YYYY-MM-DD`。
- 反映方式＝確認してから書き込み（`route.ts` のシステムプロンプトで強制）。

### 動作確認（設定後）

ダッシュボード／ガント各ページの「PMエージェント」窓で例えば「タスク1-3の進捗を50%に」と入力 →
エージェントが変更内容を復唱して確認 → 「はい」で Sheet に反映（反映表示まで最大1分）。

---

## ⑥ 資料（Google ドライブ連携・任意）

「概要」ページの「資料」に、指定フォルダ内のファイルを自動一覧＋ダウンロード（プロキシ）表示する。

1. Google Cloud で **Drive API を有効化**: <https://console.cloud.google.com/apis/library/drive.googleapis.com>
2. 対象フォルダを開き〔共有〕→ サービスアカウントの `client_email` を**閲覧者**で追加。
3. フォルダ URL（`https://drive.google.com/drive/folders/`〈**この部分**〉）の ID を、`meta` タブに
   `drive_folder_id` というキーで設定（A 列＝`drive_folder_id` / B 列＝ID）。
4. 反映後、「資料」枠にフォルダ配下のファイル（**サブフォルダ内も再帰的に**・サブフォルダ名を併記）が並び、各行の「↓ DL」でダウンロードできる。
   - ダウンロードは `/api/drive/[id]` がサービスアカウント権限で配信（閲覧者の Google 権限は不要）。
   - 配信対象は `drive_folder_id` フォルダ配下（サブフォルダ含む）のファイルに限定。

## ⑦ マルチテナント（ID＋パスワードでプロジェクトを切り替える・任意）

ログインID（例: `AI-BCP` / `ASC`）ごとに別々の Google Sheet を開く運用。
`PROJECTS` 環境変数を設定すると **要ログインモード**になり、未設定なら従来どおり `SHEET_ID` の
シングルテナント（ログインなし）で動く（**後方互換**）。

1. **対象シートを用意**（①の手順を各プロジェクト分）。サービスアカウントの `client_email` を
   **すべての対象シート**に共有（閲覧者／書き込みするなら編集者）。
2. **`AUTH_SECRET`** を決める（セッション署名・パスワードハッシュの鍵。長いランダム文字列）。
3. **各プロジェクトのパスワードハッシュを生成**:
   ```bash
   AUTH_SECRET="（2で決めた値）" node scripts/hash-password.mjs "そのプロジェクトのパスワード"
   ```
   出力された文字列が `passwordHash`。
4. **`PROJECTS`**（JSON・1行）を設定:

   ```
   PROJECTS={"AI-BCP":{"sheetId":"…AI-BCPのシートID…","passwordHash":"…"},"ASC":{"sheetId":"…ASCのシートID…","passwordHash":"…"}}
   ```

   - ログインIDは大文字小文字を区別しない（`ai-bcp` でも `AI-BCP` でログイン可）。
   - プロジェクトを増やす/減らす/パスワード変更は、`PROJECTS` を更新して**再デプロイ**。

5. **Vercel**: `AUTH_SECRET` と `PROJECTS` を環境変数に登録（**ビルド時から**有効にする＝Production/Preview/Development に付与）。
   - ビルド時に「要ログイン＝ページを動的描画」へ切り替える判定をするため、ビルド前に設定が必要。

### 動作

- 未ログインで任意ページを開くと `/login` に誘導。ID＋パスワードでログインすると、その ID の
  Google Sheet を読み込んだ管理画面が開く。ヘッダ右に現在のプロジェクトID と「ログアウト」を表示。
- セッションは署名付き Cookie（既定 12 時間）。`AUTH_SECRET` を変更すると既存セッションは無効化される。
- PMエージェント・カレンダー編集・資料DL も、ログイン中プロジェクトのシートに対して動作する。

> セキュリティ補足: パスワードは平文保存せず `AUTH_SECRET` を鍵にした HMAC-SHA256 で照合する。
> ただしこれは「プロジェクト単位の共有パスワード」による簡易ゲートで、個人別アカウントや
> 総当たり対策（レート制限）は含まない。機微なプロジェクトでは Vercel のアクセス保護も併用すること。

## トラブルシュート

- ログインできない（要ログインモード）→ `AUTH_SECRET` がハッシュ生成時と本番で一致しているか／`PROJECTS` の JSON が壊れていないか。
- ログイン後も「サンプルデータ」→ そのプロジェクトの `sheetId` 共有・正しさ、サービスアカウント共有を確認。
- `/api/data` が 502 → サービスアカウントにシートが共有されているか／`SHEET_ID`（または `PROJECTS` の各 sheetId）が正しいか／Sheets API が有効か。
- `"source": "seed"` のまま → 環境変数3つが揃っていない（`hasCreds()` の判定）。
- `error:invalid_grant` / 署名エラー → `GOOGLE_PRIVATE_KEY` の改行が壊れている。`.env.local` ではダブルクオート＋`\n`、
  Vercel では実改行で貼り直す。
- タブが無い系のエラー → `tasks` / `meta` / `links` は必須。`notices` / `events` は任意（無くても動く）。
