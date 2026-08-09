# 管理指標（評価パネル）の定義と根拠

ダッシュボードの「評価（管理指標）」は **3枠**で、各枠の指標は差し替え可能（`lib/metrics.ts` のレジストリに登録、UIのドロップダウンで選択・`localStorage` 保存）。
予算は扱わないため、**スケジュール＋進捗のみで算出できる**指標に限定している。すべて既存の Sheet データから計算され、外部データは不要。

各タスクの基準時点の「計画進捗」 `pp = clamp((基準日 − 開始) / (終了 − 開始), 0, 1)`、実績は `progress (0..1)`。

## 実装済み

### ① スケジュール健全度 SPI

- **意味**: 全体が予定より先行/遅延か。`SPI = EV / PV`（期間で重み付け）。`>1` 先行、`<1` 遅延。
  - `PV = Σ 期間 × pp`（本来あるべき進捗）、`EV = Σ 期間 × progress`（実績）。
- **表示**: 値=SPI、`予定比 ±x%`、色（緑 `≥1` / 黄 `0.9–1` / 赤 `<0.9`）。
- **根拠**: EVM の Schedule Performance Index。時間版は **Earned Schedule**（Lipke 2003、PMI EVM 実務標準2011に収録）。コスト項目が不要なため予算除外の本件に適合。
  - [Earned Schedule (Lipke) — Introduction](https://www.earnedschedule.com/Docs/Lipke-introduction-to-earned-schedule-utd.pdf) ／ [PMI: Advances in earned schedule and EVM](https://www.pmi.org/learning/library/advances-earned-schedule-value-management-6217)

### ③ 要注意タスク（リード指標）

- **意味**: 締切前なのに計画ペースから **20%超**遅れているタスク数＝**遅延になる前の予兆**。
  - 条件: `kind=task`、`progress < 1`、`基準日 ≤ 終了`（締切超過＝ラグ側の「遅延」は除外）、`pp − progress > 0.20`。
- **表示**: 件数＋該当 No.、色（緑=0件 / 黄=1件以上）。しきい値 `0.20` は `lib/metrics.ts` で調整可。
- **根拠**: リード指標 vs ラグ指標（現ダッシュボードの「完了/遅延」は事後＝ラグ）。早期兆候・外れ値重視は HBR/McKinsey の知見と整合。
  - [HBR: Why Your IT Project May Be Riskier Than You Think (Flyvbjerg & Budzier, 2011)](https://hbr.org/2011/09/why-your-it-project-may-be-riskier-than-you-think)
  - [McKinsey × Oxford: Delivering large-scale IT projects on time, on budget, and on value](https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/delivering-large-scale-it-projects-on-time-on-budget-and-on-value)

### ④ フェーズ別 RAG

- **意味**: 各フェーズの計画比健全度を緑/黄/赤で信号化（未着手は灰）。フェーズ SPI（= フェーズ内 `EV/PV`）で判定。
  - 緑 `SPI≥1` / 黄 `0.9–1` / 赤 `<0.9` / 灰 `PV=0`（未着手）。ヘッドラインは最悪フェーズの状態語（順調/注意/要対応）。
- **表示**: 状態語＋フェーズ別の色チップ（P1/P2/P3）。
- **根拠**: RAG ステータスはガバナンス実務の標準。「少数の明快な指標」（MIT Sloan）に沿い、フェーズ単位の早期把握に有効。

## 候補（未実装・差し替え枠に追加予定）

- **② 計画 vs 実績 Sカーブ**: 累積進捗の計画曲線と実績点。軌道とギャップを可視化（PM標準実務）。チャート形状のため枠ではなく単独配置が向く。

## 設計メモ

- 「指標は少数で明快に」（MIT Sloan）。枠は3つだが既定で2指標＋空き1。
- 「長期ほど超過しやすい」（McKinsey/Oxford：1年ごと+15%）「小さく短く刻むほど成功率が高い」（Standish CHAOS）を踏まえ、Phase 3（7ヶ月）は特に SPI/予兆の監視対象。
- これらの指標は**計算ロジック**であり、PMエージェント（自然言語編集）からは変更できない（データのみ編集可）。
