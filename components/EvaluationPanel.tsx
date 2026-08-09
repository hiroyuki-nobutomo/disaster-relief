"use client";

import { useEffect, useState } from "react";
import { PAL } from "@/lib/palette";
import SectionTitle from "@/components/ui/SectionTitle";
import { METRICS, METRIC_BY_KEY, type Tone } from "@/lib/metrics";
import type { Task } from "@/lib/types";

// 3枠。差し替え可能（各枠のドロップダウンで指標を選択、localStorage に保存）。
const STORAGE_KEY = "pmdash.evalSlots.v1";
const DEFAULT_SLOTS = ["spi", "atrisk", "rag"];

const TONE_COLOR: Record<Tone, string> = {
  good: PAL.green,
  warn: PAL.gold,
  bad: PAL.red,
  neutral: PAL.slateLt,
};

export default function EvaluationPanel({ tasks, basis }: { tasks: Task[]; basis: string }) {
  const [slots, setSlots] = useState<string[]>(DEFAULT_SLOTS);

  // SSR と一致させるため、localStorage 読み込みはマウント後に行う
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 3) {
          // 意図的: SSR の初期描画と一致させるためマウント後に保存値へ更新する（ハイドレーション不一致を回避）
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSlots(parsed.map((x) => (typeof x === "string" ? x : "")));
        }
      }
    } catch {
      /* noop */
    }
  }, []);

  const setSlot = (i: number, key: string) => {
    setSlots((prev) => {
      const next = [...prev];
      next[i] = key;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  };

  return (
    <div>
      <SectionTitle className="mb-3">評価（管理指標）</SectionTitle>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {slots.map((key, i) => {
          const metric = METRIC_BY_KEY[key];
          const r = metric ? metric.compute(tasks, basis) : null;
          return (
            <div key={i} className="card px-5 py-4">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span style={{ color: PAL.slateLt }} className="text-xs">
                  指標 {i + 1}
                </span>
                <select
                  value={key}
                  onChange={(e) => setSlot(i, e.target.value)}
                  style={{ color: PAL.slate, border: `1px solid ${PAL.border}`, maxWidth: "62%" }}
                  className="rounded bg-white px-1.5 py-0.5 text-xs"
                >
                  <option value="">（なし）</option>
                  {METRICS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              {r && metric ? (
                <>
                  <div style={{ color: PAL.body }} className="mb-0.5 text-xs">
                    {metric.name}
                  </div>
                  <div style={{ color: TONE_COLOR[r.tone] }} className="text-2xl font-bold">
                    {r.value}
                  </div>
                  <div style={{ color: PAL.slate }} className="mt-0.5 text-xs">
                    {r.sub}
                  </div>
                  {r.detail && r.detail.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {r.detail.map((dt, j) => (
                        <span
                          key={j}
                          className="inline-flex items-center gap-1 text-xs"
                          style={{ color: PAL.slate }}
                        >
                          <span
                            style={{
                              background: TONE_COLOR[dt.tone],
                              width: 8,
                              height: 8,
                              borderRadius: 9999,
                              display: "inline-block",
                            }}
                          />
                          {dt.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.caption && (
                    <div style={{ color: PAL.slateLt, fontSize: 10 }} className="mt-1">
                      {r.caption}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: PAL.slateLt }} className="py-3 text-xs">
                  指標を選択してください（差し替え可能）。
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
