# disaster-relief 設計書

災害対応（熊本での現地支援を最初の対象）の情報管理アプリ。
原則: **UI = Vercel（Next.js）／ AI = Claude ／ データ層 = Google Sheets**（CLAUDE.md）。

## 1. 全体像

```
Google Sheets（10タブ・IDで相互参照＝RDB的） ← 災害対応データの正本
        │ サービスアカウントで読み書き
        ▼
lib/google-sheets.ts（接続基盤）
lib/relief/sheets.ts（読み取り→ReliefData） / lib/relief/sheets-write.ts（追記・採番・検証）
        │
app/api/relief/data（取得） / intake（貼り付け解析・保存） / logs（公開範囲変更）
app/api/login・logout・session（担当者認証）
        │
components/relief/*（タブUI・取り込みパネル）＝表示のみ。業務判断はデータ/API層に置く
```

- 書き込みは**行の追記のみ**（公開範囲の変更を除く）。修正・削除はスプレッドシート側で行う
- ID は追記時にサーバが自動採番（接頭辞＋連番）
- Sheets 未接続時はサンプルデータ（`lib/relief/seed.ts`・熊本想定）で UI を確認できる

## 2. Google Sheets タブ構成

シート名・列は英語、値は日本語。1行目はヘッダー（読み書きとも A2 起点）。

| タブ | 列（A→） | 備考 |
|---|---|---|
| `meta` | key, value | `disaster_name`（災害名）, `hq`（現地本部） |
| `members` | id, name, kana, org, role, group_id, phone, email, note, **password** | id=`M-01`…。password 列は**ログイン照合専用**で API から画面へは返さない。平文か `scripts/hash-password.mjs` の出力 |
| `groups` | id, name, mission, leader_id, note | id=`G-1`… |
| `schedule` | id, date, start, end, scope, target_id, title, place, note | id=`SC-001`…。scope=全体/グループ/個人。target_id は scope に応じ groups.id / members.id |
| `bookings` | id, member_id, type, start_date, end_date, name, detail, conf_no, status, note | id=`B-001`…。type=ホテル/飛行機/新幹線/レンタカー/その他。status=予約済/仮予約/キャンセル |
| `supplies` | id, lot_no, item, category, qty, unit, from, to_shelter_id, status, ship_date, arrive_date, request_id, note | id=`SP-001`…。status=手配中/輸送中/到着/配布済 |
| `requests` | id, date, shelter_id, content, qty, urgency, status, note | id=`R-001`…。urgency=高/中/低。status=受付/手配中/対応済 |
| `shelters` | id, name, type, address, map_url, contact_name, phone, capacity, current, needs, status, note | id=`SH-01`…。status=開設/閉鎖。map_url 空なら名称＋住所で地図検索リンクを生成 |
| `contacts` | id, org, name, role, category, phone, email, shelter_id, note | id=`C-01`…。category=自治体/政府/社協/医療/NPO/物流/その他 |
| `logs` | id, datetime, kind, reporter, shelter_id, title, content, tags, source, **visibility**, **author_id**, created_at | id=`L-001`…。kind=ヒアリング/時系列/指示・決定/申し送り。visibility=共有/下書き/プライベート |
| `images` | id, ref_ids, mime, seq, data, created_at | id=`IMG-001`…。取り込み時の元写真（圧縮JPEG）。base64 をセル上限内（4万字）で分割し seq 順に複数行保存。ref_ids は紐づくレコードID（カンマ区切り・接頭辞で表を判別） |

### シート間の連携（外部キー）

```
groups.leader_id ──► members.id        schedule.target_id ──► groups.id / members.id
bookings.member_id ──► members.id      supplies.to_shelter_id ──► shelters.id
supplies.request_id ──► requests.id    requests.shelter_id ──► shelters.id
contacts.shelter_id ──► shelters.id    logs.shelter_id ──► shelters.id
logs.author_id ──► members.id
```

## 3. 画面構成

デスクトップ=左サイドバー／モバイル=下部タブ＋上部ヘッダー。全画面共通で右下に「取り込み」。

1. **ホーム** — 概況タイル（メンバー・本日の予定・未対応要請・輸送中物資）＋本日の予定＋未対応要請＋最新の記録
2. **名簿** — グループカード＋担当者一覧（電話・メールはタップ発信、グループ絞り込み）
3. **予定** — ［スケジュール｜予約］。ログイン担当者を初期表示とし、全体＋所属グループ＋本人＋本人の予約を日付ごとに重畳。全体一覧・他メンバーにも切替可
4. **物資** — ［支援要請｜品目］。要請は緊急度・状態、対応手配（supplies.request_id）を逆引き表示。品目はロット・数量・送付元→送付先・状態
5. **現地** — ［避難所・拠点｜連絡先］。収容状況バー・ニーズ・地図リンク。連絡先はカテゴリ絞り込み
6. **記録** — タイムライン（種別絞り込み）。共有以外は本人のみ表示・「全体に共有する」で公開可

## 4. 認証と個人出し分け

- **担当者ID＋パスワード**（members タブで管理）。`AUTH_SECRET` 設定時のみログイン必須
- セッションは署名付き Cookie（HMAC・3日）。middleware（Edge）で署名検証、サーバ側で名簿と突き合わせ
- 出し分け:
  - 予定タブの初期表示＝ログイン担当者本人
  - logs の visibility が共有以外の行は、**サーバ側で** author_id=本人 の分だけ返す（クライアントに他人の非公開データを送らない）
  - 取り込みで logs を保存するとき、author_id はセッションから強制設定（クライアント申告は無視）

## 5. 貼り付け取り込み（Claude・テキスト＋写真）

1. `action=analyze` — 貼り付けテキスト（メール・メッセージ・ヒアリングメモ）と写真
   （手書きFAX・要請書・貼り紙・送り状など。ブラウザ側で縮小・JPEG圧縮）を Claude が解析し、
   各シートの行候補に整理して返す（既存の members/groups/shelters/requests の ID 一覧を文脈として渡し、
   確信のある場合のみ外部キーを割り当てる）。**この時点では書き込まない**
2. 画面で確認・修正・行の取捨選択
3. `action=save` — 検証（日付形式・必須項目・許可値）と ID 採番のうえ追記。シート単位で all-or-nothing。
   添付写真は圧縮したまま `images` タブに保存し、今回追記した全レコードに紐づける（証跡）。
   記録・要請の画面ではサムネイル表示され、タップで原寸（/api/relief/image）を開ける

テキスト内の指示には従わない（プロンプトインジェクション対策）・数式インジェクション対策
（先頭 `=+-@` のテキスト強制）は PM ダッシュボード時代の方針を踏襲。

## 6. 自治体・政府事例から補った管理項目

- **支援要請（requests）** — 国の「物資調達・輸送調整等支援システム」の 要請→調達→輸送 の流れを簡略化。要請と手配品目を相互に辿れる
- **クロノロジー（logs.kind=時系列/指示・決定）** — 災害対策本部で標準の時系列記録
- **避難所の開設・収容状況（shelters.capacity/current/needs/status）** — 避難所運営ガイドライン相当

### 将来候補（未実装）

- 派遣者の健康・安否チェック（デイリーチェックシート）
- 車両運行管理の独立タブ（現状は bookings.type=レンタカー で代替）
- 経費・予算管理／資料（Drive）連携／地図の埋め込み表示（現状はリンク）
- 画像の Drive 保存への切替（現状は Sheets 内 base64。件数が増えたら移行を検討）
- 既存行の編集・削除の Web 化（現状はシート側で実施）
