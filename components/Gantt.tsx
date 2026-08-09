import { PAL } from "@/lib/palette";
import { DAY, d, fmt, statusOf } from "@/lib/derive";
import Pill from "@/components/Pill";
import SectionTitle from "@/components/ui/SectionTitle";
import type { Task } from "@/lib/types";

// レイアウト定数（プロジェクトに依存しない）。期間レンジはデータから算出する。
const PXDAY = 3.0;
const LABEL_W = 270;
const ROW_H = 34;

function Legend({ c, t }: { c: string; t: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        style={{ background: c, width: 14, height: 10, borderRadius: 2, display: "inline-block" }}
      />
      {t}
    </span>
  );
}

export default function Gantt({
  tasks,
  basis,
  sel,
  onSel,
}: {
  tasks: Task[];
  basis: string;
  sel: string | null;
  onSel: (id: string | null) => void;
}) {
  const Title = <SectionTitle>ガントチャート</SectionTitle>;

  if (!tasks.length) {
    return (
      <div className="card mb-5 p-5">
        {Title}
        <div style={{ color: PAL.slateLt }} className="mt-3 text-xs">
          表示できるスケジュールがありません。
        </div>
      </div>
    );
  }

  // ── 期間レンジをデータから算出（最小開始の月初〜最大終了の月末）──────────
  const T0 = (() => {
    const a = new Date(Math.min(...tasks.map((t) => +d(t.start))));
    return new Date(a.getFullYear(), a.getMonth(), 1);
  })();
  const T1 = (() => {
    const b = new Date(Math.max(...tasks.map((t) => +d(t.end))));
    return new Date(b.getFullYear(), b.getMonth() + 1, 0);
  })();
  const CHART_W = ((+T1 - +T0) / DAY) * PXDAY + PXDAY;
  const xOf = (s: string) => ((+d(s) - +T0) / DAY) * PXDAY;
  const xOfDate = (date: Date) => ((+date - +T0) / DAY) * PXDAY;

  const months: Date[] = [];
  for (
    let cur = new Date(T0);
    +cur <= +T1;
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  ) {
    months.push(new Date(cur));
  }

  const milestones = tasks.filter((t) => t.kind === "milestone");

  return (
    <div className="card mb-5 p-5">
      <div className="mb-3 flex items-center justify-between">
        {Title}
        <div className="flex items-center gap-3 text-xs" style={{ color: PAL.slate }}>
          <Legend c={PAL.brandLt} t="計画" />
          <Legend c={PAL.brand} t="実績" />
          <Legend c={PAL.red} t="遅延（期日超過・未完）" />
          <Legend c={PAL.gold} t="節目" />
          <span className="flex items-center gap-1">
            <span style={{ background: PAL.red, width: 2, height: 12, display: "inline-block" }} />
            基準日
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ width: LABEL_W + CHART_W }}>
          {/* 月ヘッダ */}
          <div className="flex" style={{ height: 22 }}>
            <div
              style={{
                width: LABEL_W,
                flexShrink: 0,
                position: "sticky",
                left: 0,
                zIndex: 6,
                background: PAL.surface,
              }}
            />
            <div style={{ position: "relative", width: CHART_W }}>
              {months.map((mo, i) => {
                const label =
                  i === 0 || mo.getMonth() === 0
                    ? `${mo.getFullYear()}/${mo.getMonth() + 1}`
                    : `${mo.getMonth() + 1}月`;
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: xOfDate(mo),
                      color: PAL.slateLt,
                      fontSize: 11,
                    }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 本体 */}
          <div style={{ position: "relative" }}>
            {/* 基準日ライン（全行を貫通） */}
            <div
              style={{
                position: "absolute",
                left: LABEL_W + xOf(basis),
                top: 0,
                bottom: 0,
                width: 2,
                background: PAL.red,
                zIndex: 3,
              }}
            />
            {tasks.map((t) => {
              const planL = xOf(t.start);
              const planW = Math.max(((+d(t.end) - +d(t.start)) / DAY) * PXDAY + PXDAY, PXDAY);
              const isSel = sel === t.id;
              // 期日超過＆未完（statusOf==="遅延"）は赤で警告。完了(100%)・予定内は通常色。
              const overdue = statusOf(t, basis) === "遅延";
              return (
                <div
                  key={t.id}
                  onClick={() => onSel(isSel ? null : t.id)}
                  style={{
                    height: ROW_H,
                    background: isSel ? PAL.pale : "transparent",
                    cursor: "pointer",
                    borderBottom: `1px solid ${PAL.borderLt}`,
                  }}
                  className="flex items-center"
                >
                  <div
                    style={{
                      width: LABEL_W,
                      flexShrink: 0,
                      paddingRight: 8,
                      position: "sticky",
                      left: 0,
                      zIndex: 5,
                      background: isSel ? PAL.pale : PAL.surface,
                    }}
                    className="flex items-center gap-2"
                  >
                    <span style={{ color: PAL.slateLt, width: 34 }} className="text-right text-xs">
                      {t.id}
                    </span>
                    <span style={{ color: PAL.body }} className="truncate text-xs" title={t.name}>
                      {t.name}
                    </span>
                    <span
                      style={{ color: PAL.slateLt }}
                      className="ml-auto text-xs whitespace-nowrap"
                    >
                      {t.owner}
                    </span>
                  </div>
                  <div style={{ position: "relative", width: CHART_W, height: ROW_H }}>
                    {t.kind === "milestone" ? (
                      <div
                        title={t.name}
                        style={{
                          position: "absolute",
                          left: xOf(t.start) - 6,
                          top: ROW_H / 2 - 6,
                          width: 12,
                          height: 12,
                          background: overdue ? PAL.red : PAL.gold,
                          transform: "rotate(45deg)",
                        }}
                      />
                    ) : (
                      <>
                        <div
                          style={{
                            position: "absolute",
                            left: planL,
                            top: ROW_H / 2 - 6,
                            width: planW,
                            height: 12,
                            background: overdue ? PAL.todayBand : PAL.brandLt,
                            border: overdue ? `1px solid ${PAL.red}` : "none",
                            borderRadius: 3,
                          }}
                        />
                        {t.progress > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              left: planL,
                              top: ROW_H / 2 - 6,
                              width: planW * t.progress,
                              height: 12,
                              background: overdue ? PAL.red : PAL.brand,
                              borderRadius: 3,
                            }}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 主要マイルストーン（スケジュールの一部として同じカード内に表示） */}
      {milestones.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${PAL.borderLt}` }}>
          <div style={{ color: PAL.slate }} className="mb-2 text-xs font-semibold">
            主要マイルストーン
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {milestones.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2">
                <span style={{ color: PAL.body }} className="truncate text-xs" title={m.name}>
                  {m.name}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span style={{ color: PAL.slateLt }} className="text-xs">
                    {fmt(m.start)}
                  </span>
                  <Pill s={statusOf(m, basis)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
