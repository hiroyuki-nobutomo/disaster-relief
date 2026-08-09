# セットアップ手順（disaster-relief）

ブラウザ操作だけで、データ層（Google Sheets）→ サービスアカウント → Vercel デプロイまでを設定する。
シート構成の詳細は [DESIGN.md](DESIGN.md) を参照。

## ① Google Sheet（データ層）を作る

1. <https://sheets.new> で新規スプレッドシートを作成。名前は任意（例: `disaster-relief-data`）。
2. 下部のタブを次の11個作成する（名前は半角小文字・完全一致）:
   `meta` / `members` / `groups` / `schedule` / `bookings` / `supplies` / `requests` / `shelters` / `contacts` / `logs` / `images`
3. 各タブの1行目にヘッダーを入れる。列構成は [DESIGN.md §2](DESIGN.md) の表のとおり
   （`docs/seed/` の CSV をタブごとに「ファイル > インポート > 現在のシートに追加」で取り込むと、
   ヘッダーとサンプル行がまとめて入る）。
4. `meta` に最低限 `disaster_name`（災害名）と `hq`（現地本部）を入れる。

## ② サービスアカウント（読み書き用の鍵）

1. <https://console.cloud.google.com/> → プロジェクト作成（例: `disaster-relief`）。
2. 「APIとサービス > ライブラリ」で **Google Sheets API** を有効化。
3. 「APIとサービス > 認証情報 > 認証情報を作成 > サービスアカウント」
   - 名前は任意（例: `disaster-relief-writer`）。ロール付与は不要（Sheet 側の共有で制御する）。
4. 作成したサービスアカウント > キー > 「鍵を追加 > 新しい鍵を作成 > JSON」→ ダウンロード。
5. Sheet の「共有」でサービスアカウントのメールアドレスを **編集者** として追加
   （取り込み保存を使わず閲覧だけなら「閲覧者」でもよい）。

## ③ ローカル確認（任意）

```bash
npm install
cp .env.local.example .env.local   # 値を設定
npm run dev                        # http://localhost:3000
```

`.env.local` の値:

| 変数                           | 内容                                                   |
| ------------------------------ | ------------------------------------------------------ |
| `SHEET_ID`                     | Sheet の URL の `/d/` と `/edit` の間の文字列          |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | サービスアカウントのメール                             |
| `GOOGLE_PRIVATE_KEY`           | JSON の `private_key` の値（改行含めそのまま）         |
| `ANTHROPIC_API_KEY`            | 貼り付け取り込みの解析（Claude）に必要                 |
| `ANTHROPIC_MODEL`              | 省略可（既定 `claude-sonnet-4-6`）                     |
| `AUTH_SECRET`                  | 担当者ログインを有効にする場合のみ。長いランダム文字列 |

環境変数なしでも起動でき、その場合は熊本想定のサンプルデータが表示される（保存は不可）。

## ④ 担当者ログイン（個人出し分け）

1. `AUTH_SECRET` を設定する（Vercel では Environment Variables）。設定した時点で全画面ログイン必須になる。
2. `members` タブの `password` 列（J列）に各担当者のパスワードを入れる。
   - 平文でも動くが、ハッシュ推奨:
     `AUTH_SECRET="…" node scripts/hash-password.mjs "パスワード"` の出力を貼る
     （**本番と同じ AUTH_SECRET で生成すること**）。
   - password 列が空の担当者はログインできない。
3. ログインすると、予定タブは本人初期表示・記録の「下書き/プライベート」は本人のみ閲覧になる。

## ⑤ Vercel へデプロイ

1. リポジトリを GitHub に push（このリポジトリは `hiroyuki-nobutomo/disaster-relief`）。
2. <https://vercel.com/new> → GitHub 連携 → `disaster-relief` を **Import**。
3. **Framework Preset**: Next.js（自動検出）。Build/Output は既定のまま。
4. **Environment Variables** に ③ の表の値を登録
   （`GOOGLE_PRIVATE_KEY` は JSON の `private_key` の値を改行ごと貼り付け）。
5. **Deploy**。以後 `main` への push で自動再デプロイ。

## ⑥ 動作確認チェックリスト

- [ ] ログイン画面が出る（AUTH_SECRET 設定時）。担当者ID＋パスワードで入れる
- [ ] ホームに Sheet の内容が出る（サイドバー下の表示が「データ: Google Sheets」）
- [ ] 予定タブが本人のスケジュール＋予約の重畳表示になっている
- [ ] 「取り込み」にメール文を貼ると行候補が出て、保存すると Sheet に追記される
- [ ] 記録タブで下書きが本人にだけ見え、「全体に共有する」で公開される
