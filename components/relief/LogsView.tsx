"use client";

import { useState } from "react";
import type { LogKind, ReliefData } from "@/lib/relief/types";
import type { NavTarget, Navigate } from "@/lib/relief/nav";
import { fmtDate, shelterName, splitDateTime } from "@/lib/relief/derive";
import {
  AttachedImages,
  Card,
  CardHeader,
  Chip,
  Empty,
  Pill,
  RefLink,
  kindTone,
  useFocusFlash,
} from "@/components/relief/ui";

// 記録: ヒアリング内容の共有と、クロノロジー（時系列の出来事・指示・決定）を
// 新しい順のタイムラインで表示。種別チップで絞り込み。
// 公開範囲が「下書き」「プライベート」の記録はサーバ側で本人の分だけ届くため、
// ここに表示されるのは全員共有＋自分の非公開分。自分の非公開分は「共有する」で公開できる。

const KINDS: LogKind[] = ["ヒアリング", "時系列", "指示・決定", "申し送り"];

export default function LogsView({
  data,
  onChanged,
  navigate,
  focus,
}: {
  data: ReliefData;
  onChanged: () => void;
  navigate: Navigate;
  focus: NavTarget | null;
}) {
  const [kind, setKind] = useState<"all" | LogKind>("all");
  const [sharing, setSharing] = useState<string | null>(null);

  // 他タブからのジャンプ到着時: 種別絞り込みで対象が隠れないよう解除してからハイライト。
  // （props 由来の派生 state 調整はレンダー中に行う。effect 内 setState は避ける）
  const [seenFocusAt, setSeenFocusAt] = useState<number | undefined>(undefined);
  if (focus?.tab === "logs" && focus.at !== seenFocusAt) {
    setSeenFocusAt(focus.at);
    if (focus.focusId) setKind("all");
  }
  useFocusFlash(focus, "logs");
  const logs = [...data.logs]
    .filter((l) => kind === "all" || l.kind === kind)
    .sort((a, b) => b.datetime.localeCompare(a.datetime));

  const share = async (id: string) => {
    setSharing(id);
    try {
      const res = await fetch("/api/relief/logs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, visibility: "共有" }),
      });
      if (res.ok) onChanged();
      else {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "共有に失敗しました。");
      }
    } finally {
      setSharing(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="現地の記録"
        count={logs.length}
        right={
          <div className="flex flex-wrap gap-1.5">
            <Chip active={kind === "all"} onClick={() => setKind("all")}>
              すべて
            </Chip>
            {KINDS.map((k) => (
              <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                {k}
              </Chip>
            ))}
          </div>
        }
      />
      {logs.length === 0 ? (
        <Empty>
          記録がありません。ヒアリングメモやメールを「取り込み」に貼り付けると、ここに時系列で蓄積されます。
        </Empty>
      ) : (
        <ol className="px-4 pb-4 sm:px-5">
          {logs.map((l, i) => {
            const { date, time } = splitDateTime(l.datetime);
            return (
              <li key={l.id} id={`rec-${l.id}`} className="relative flex gap-4 px-1">
                {/* タイムラインの縦線とドット */}
                <div className="flex flex-col items-center">
                  <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-accent bg-surface" />
                  {i < logs.length - 1 && <span className="w-px flex-1 bg-line" />}
                </div>
                <div className="min-w-0 flex-1 pb-5">
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="text-[12.5px] font-semibold text-mute tabular-nums">
                      {fmtDate(date)}
                      {time ? ` ${time}` : ""}
                    </span>
                    <Pill tone={kindTone(l.kind)}>{l.kind}</Pill>
                    {l.visibility !== "共有" && (
                      <Pill tone="amber">
                        {l.visibility === "下書き" ? "下書き（自分のみ）" : "プライベート"}
                      </Pill>
                    )}
                    {l.reporter && <span className="text-[12px] text-faint">{l.reporter}</span>}
                    {l.shelterId && (
                      <RefLink
                        onClick={() =>
                          navigate({ tab: "field", seg: "shelters", focusId: l.shelterId })
                        }
                      >
                        <span className="text-[12px]">@{shelterName(data, l.shelterId)}</span>
                      </RefLink>
                    )}
                    {l.visibility !== "共有" &&
                      data.currentMemberId &&
                      l.authorId === data.currentMemberId && (
                        <button
                          onClick={() => share(l.id)}
                          disabled={sharing === l.id}
                          className="rounded-full border border-accent/30 bg-accent-soft px-2.5 py-0.5 text-[11.5px] font-semibold text-accent transition-colors hover:border-accent/60 hover:bg-accent/15 disabled:opacity-50"
                        >
                          {sharing === l.id ? "共有中…" : "全体に共有する"}
                        </button>
                      )}
                  </div>
                  <p className="mt-1 text-[14px] font-medium text-ink">{l.title}</p>
                  {l.content && (
                    <p className="mt-1 text-[13px] leading-relaxed break-words whitespace-pre-wrap text-body">
                      {l.content}
                    </p>
                  )}
                  <AttachedImages images={data.images} recordId={l.id} />
                  <p className="mt-1 text-[11.5px] text-faint">
                    {[
                      l.tags &&
                        l.tags
                          .split(",")
                          .map((t) => `#${t.trim()}`)
                          .join(" "),
                      l.source && `出典: ${l.source}`,
                    ]
                      .filter(Boolean)
                      .join("　")}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
