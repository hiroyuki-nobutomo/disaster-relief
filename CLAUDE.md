# disaster-relief 作業ルール

## 目的

- 本アプリは**災害対応の情報管理**を実施する（最初の対象: 熊本での現地支援）。

## 原則（アーキテクチャ — 変更しない）

- **UI 層 = Vercel（Next.js / App Router）**
- **AI = Claude**（取り込み解析はすべて Claude API を使用。他社 LLM は使わない）
- **データ層 = Google Sheets**（災害対応データの正本。コードにデータをハードコードしない）
- コード = GitHub（`hiroyuki-nobutomo/disaster-relief`）

## 構成（docs/DESIGN.md が正）

- シートは11タブ（meta/members/groups/schedule/bookings/supplies/requests/shelters/contacts/logs/images）を
  ID で相互参照。列構成・許可値を変えるときは docs/DESIGN.md・docs/seed/・読み書き層を必ず同時に更新する
- 層の分離: `lib/relief/*`（型・読み書き・検証・認証＝業務ロジック）→ `app/api/relief/*` →
  `components/relief/*`（表示のみ）。**業務判断を画面側に書かない**
- 書き込みは「行の追記」のみ（logs の公開範囲変更を除く）。ID はサーバで自動採番
- 取り込み（テキスト・写真）は「Claude 解析 → 画面で確認 → 保存」。解析段階では書き込まない
- members の password 列は API から画面へ返さない。logs の共有以外はサーバ側で本人分のみ返す

## 言語

- UI・ドキュメント・成果物はすべて日本語。中国語フォント（簡体字・繁体字グリフ）は使用しない
- スクリーンショット生成時は日本語フォント（Noto Sans CJK JP 等）を確認してから実行する

## 検証

- UI 変更時は Playwright でスマホ 390px／タブレット 1180px／PC 1440px を実機レンダリングし、
  コンソールエラーが無いことを確認する
