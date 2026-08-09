import type { Task } from "@/lib/types";
import { DAY, phasesOf, d, taskRows } from "@/lib/derive";

// ── 管理指標（評価パネル用）─────────────────────────────────────────────
// すべて既存データ（schedule + progress）から算出。予算は扱わない。
// ※ これらは「計算ロジック」であり、AIアシスタントからは変更できない（コード側に固定）。

export type Tone = "good" | "warn" | "bad" | "neutral";

export interface MetricResult {
  value: string;
  sub: string;
  tone: Tone;
  caption?: string;
  /** 色付きの内訳チップ（例：フェーズ別RAG）。 */
  detail?: { label: string; tone: Tone }[];
}

export interface MetricDef {
  key: string;
  name: string;
  compute: (tasks: Task[], basis: string) => MetricResult;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const durDays = (t: Task) => Math.max((+d(t.end) - +d(t.start)) / DAY, 1);

/** 基準日時点で「本来あるべき進捗」（計画進捗）。 */
const plannedPp = (t: Task, basis: string) => {
  const den = +d(t.end) - +d(t.start);
  if (den <= 0) return +d(basis) >= +d(t.start) ? 1 : 0;
  return clamp01((+d(basis) - +d(t.start)) / den);
};

const bandOf = (spi: number | null): Tone =>
  spi == null ? "neutral" : spi >= 1 ? "good" : spi >= 0.9 ? "warn" : "bad";

// ① スケジュール健全度 SPI（EVM の Schedule Performance Index、期間重み付け）
//    SPI = 実績(EV) / 計画(PV)。>1 先行 / <1 遅延。コスト不要のため予算除外でも成立。
const spi: MetricDef = {
  key: "spi",
  name: "スケジュール健全度 SPI",
  compute(tasks, basis) {
    const rows = taskRows(tasks);
    let pv = 0;
    let ev = 0;
    for (const t of rows) {
      const w = durDays(t);
      pv += w * plannedPp(t, basis);
      ev += w * t.progress;
    }
    if (pv <= 0) {
      return {
        value: "—",
        sub: "計画開始前",
        tone: "neutral",
        caption: "Schedule Performance Index (EVM)",
      };
    }
    const v = ev / pv;
    const dev = Math.round((v - 1) * 100);
    const tone: Tone = v >= 1 ? "good" : v >= 0.9 ? "warn" : "bad";
    const word = v >= 1 ? "予定通り／先行" : v >= 0.9 ? "やや遅延" : "遅延";
    return {
      value: v.toFixed(2),
      sub: `予定比 ${dev >= 0 ? "+" : ""}${dev}%・${word}`,
      tone,
      caption: "Schedule Performance Index（EVM／Earned Schedule）",
    };
  },
};

// ③ 要注意タスク（リード指標）：締切前なのに計画ペースから所定以上遅れている＝遅延の予兆
const AT_RISK_GAP = 0.2;
const atRisk: MetricDef = {
  key: "atrisk",
  name: "要注意タスク（予兆）",
  compute(tasks, basis) {
    const rows = taskRows(tasks);
    const flagged = rows.filter((t) => {
      if (t.progress >= 1) return false; // 完了は対象外
      if (+d(basis) > +d(t.end)) return false; // 既に締切超過＝ラグ指標(遅延)側
      return plannedPp(t, basis) - t.progress > AT_RISK_GAP;
    });
    const names = flagged
      .slice(0, 2)
      .map((t) => t.id)
      .join("・");
    return {
      value: `${flagged.length}件`,
      sub: flagged.length
        ? `計画ペース比 −${Math.round(AT_RISK_GAP * 100)}%超：${names}${flagged.length > 2 ? " 他" : ""}`
        : "予兆なし",
      tone: flagged.length === 0 ? "good" : "warn",
      caption: "リード指標：遅延になる前の予兆",
    };
  },
};

// ④ フェーズ別 RAG：各フェーズの計画比健全度を信号化（緑=順調 / 黄=注意 / 赤=要対応 / 灰=未着手）
const phaseSpi = (tasks: Task[], phase: string, basis: string): number | null => {
  let pv = 0;
  let ev = 0;
  for (const t of tasks) {
    if (t.kind !== "task" || t.phase !== phase) continue;
    const w = durDays(t);
    pv += w * plannedPp(t, basis);
    ev += w * t.progress;
  }
  return pv > 0 ? ev / pv : null;
};

const rag: MetricDef = {
  key: "rag",
  name: "フェーズ別 RAG",
  compute(tasks, basis) {
    const perPhase = phasesOf(tasks).map((p, i) => ({
      label: `P${i + 1}`,
      tone: bandOf(phaseSpi(tasks, p, basis)),
    }));
    const rank: Record<Tone, number> = { bad: 3, warn: 2, good: 1, neutral: 0 };
    const worst = perPhase.reduce((a, b) => (rank[b.tone] > rank[a.tone] ? b : a), perPhase[0]);
    const word =
      worst.tone === "bad"
        ? "要対応"
        : worst.tone === "warn"
          ? "注意"
          : worst.tone === "good"
            ? "順調"
            : "—";
    return {
      value: word,
      sub: "フェーズ健全度（計画比）",
      tone: worst.tone,
      detail: perPhase,
      caption: "RAG：緑=順調 / 黄=注意 / 赤=要対応 / 灰=未着手",
    };
  },
};

export const METRICS: MetricDef[] = [spi, atRisk, rag];
export const METRIC_BY_KEY: Record<string, MetricDef> = Object.fromEntries(
  METRICS.map((m) => [m.key, m]),
);
