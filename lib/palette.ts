// 色の実値は app/globals.css の @theme（CSS 変数）が単一情報源。
// PAL はインライン style 用に同じ変数を参照する薄いエイリアス（値の二重管理を避ける）。
// 段階的に style={{color:PAL.x}} → className="text-brand" 等へ移行できる。
export const PAL = {
  brand: "var(--color-brand)",
  brandLt: "var(--color-brand-lt)",
  pale: "var(--color-pale)",
  ink: "var(--color-ink)",
  body: "var(--color-body)",
  slate: "var(--color-slate)",
  slateLt: "var(--color-slate-lt)",
  surface: "var(--color-surface)",
  tint: "var(--color-tint)",
  tint2: "var(--color-tint2)",
  border: "var(--color-border)",
  borderLt: "var(--color-border-lt)",
  red: "var(--color-red)",
  todayBand: "var(--color-today-band)",
  gold: "var(--color-gold)",
  green: "var(--color-green)",
} as const;

export const CHIP: Record<string, [string, string]> = {
  完了: ["#E3F0E7", "#2E6B43"],
  進行中: ["#E6F1FA", "#135E92"],
  遅延: ["#FBE3E3", "#B02020"],
  未着手: ["#EEF1F4", "#5A6B7B"],
  予定: ["#F2F4F7", "#6B7785"],
};
