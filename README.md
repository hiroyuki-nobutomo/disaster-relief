# disaster-relief — 災害対応 情報管理ダッシュボード

災害対応の現地支援（最初の対象: 熊本）に必要な情報を一元管理する Web アプリ。
名簿・スケジュール・宿泊/移動の予約・支援物資・避難所・関係機関連絡先・現地記録を、
タブ切替のレスポンシブ UI で扱う。

## 原則（アーキテクチャの基本方針）

- **UI 層 = Vercel（Next.js / App Router）**
- **AI = Claude**（貼り付け・写真取り込みの解析はすべて Claude を使用）
- **データ層 = Google Sheets**（災害対応データの正本。11タブを ID で相互参照＝RDB的に連携）
- コード = **GitHub**（`hiroyuki-nobutomo/disaster-relief`）

## 主な機能

- **タブ切替 UI** — ホーム／名簿／予定／物資／現地（避難所・連絡先）／記録。
  デスクトップは左サイドバー、スマホは下部タブ（レスポンシブ）
- **貼り付け・写真取り込み** — メール・メッセージ・ヒアリングメモの貼り付け、または
  手書き要請書・FAX・送り状などの写真から、Claude が各シートの行候補に整理。
  **画面で確認・修正してから** Sheets へ追記（勝手に書き込まない）。
  写真は圧縮して `images` タブに証跡保存し、記録・要請にサムネイル表示
- **担当者ログイン** — 担当者ID＋パスワード（members タブで管理）。
  予定タブは本人初期表示（全体＋所属グループ＋本人＋本人の予約を重畳）
- **記録の公開範囲** — 既定は全体共有。「下書き」「プライベート」は本人のみ閲覧でき、
  下書きは後から「全体に共有する」で公開できる
- **支援要請 ⇄ 物資手配の連携** — 避難所からの要請（requests）と手配ロット（supplies）を相互参照

## セットアップ・設計

- 導入手順（Sheet 作成 → サービスアカウント → Vercel）: [docs/SETUP.md](docs/SETUP.md)
- 設計書（シート構成・画面構成・認証・取り込みの仕組み）: [docs/DESIGN.md](docs/DESIGN.md)
- シートの雛形: [docs/seed/](docs/seed/)（各 CSV をタブにインポート）

```bash
npm install
npm run dev   # 環境変数なしでもサンプルデータで起動する
```

## リポジトリ構成

```
app/
  page.tsx                    # 本体（タブUI）
  login/                      # 担当者ログイン
  api/login|logout|session    # 認証
  api/relief/data             # データ取得（閲覧者に応じた出し分け）
  api/relief/intake           # 貼り付け・写真の解析（Claude）と保存
  api/relief/logs             # 記録の公開範囲変更
  api/relief/image            # 添付写真の表示
components/
  relief/                     # タブUI・取り込みパネル（表示のみ）
  LoginForm.tsx
lib/
  google-sheets.ts            # Sheets 接続基盤
  relief/                     # 型・読み書き・認証・表示ヘルパー（業務ロジックはここ）
docs/                         # SETUP / DESIGN / seed
```
