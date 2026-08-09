"use client";

import { useState } from "react";
import type { ReliefData } from "@/lib/relief/types";
import type { NavTarget, Navigate } from "@/lib/relief/nav";
import { memberName } from "@/lib/relief/derive";
import { Card, CardHeader, Chip, Empty, Mail, RefLink, Tel, useFocusFlash } from "@/components/relief/ui";

// 名簿: グループの帯 → 担当者カード（連絡先はタップで発信/メール）。
// 各担当者から「予定を見る」で予定タブへ、グループのリーダー名から本人へジャンプできる。

export default function RosterView({
  data,
  navigate,
  focus,
}: {
  data: ReliefData;
  navigate: Navigate;
  focus: NavTarget | null;
}) {
  const [groupFilter, setGroupFilter] = useState<string>("all");

  // 他タブからのジャンプ到着時: 絞り込みで対象が隠れないよう解除してからハイライト。
  // （props 由来の派生 state 調整はレンダー中に行う。effect 内 setState は避ける）
  const [seenFocusAt, setSeenFocusAt] = useState<number | undefined>(undefined);
  if (focus?.tab === "roster" && focus.at !== seenFocusAt) {
    setSeenFocusAt(focus.at);
    if (focus.focusId) setGroupFilter("all");
  }
  useFocusFlash(focus, "roster");

  const members =
    groupFilter === "all" ? data.members : data.members.filter((m) => m.groupId === groupFilter);

  return (
    <div className="space-y-4">
      {/* グループ概要 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.groups.map((g) => (
          <Card key={g.id} className="px-4 py-3.5 sm:px-5">
            <div id={`rec-${g.id}`} className="px-1 py-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[14.5px] font-semibold text-ink">{g.name}</h3>
                <span className="text-[12px] text-faint">
                  {data.members.filter((m) => m.groupId === g.id).length}名
                </span>
              </div>
              {g.mission && <p className="mt-1 text-[13px] text-mute">{g.mission}</p>}
              {g.leaderId && (
                <p className="mt-1 text-[12px] text-faint">
                  リーダー:{" "}
                  <RefLink
                    onClick={() => navigate({ tab: "roster", focusId: g.leaderId })}
                  >
                    {memberName(data, g.leaderId)}
                  </RefLink>
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="担当者名簿"
          count={members.length}
          right={
            <div className="flex flex-wrap gap-1.5">
              <Chip active={groupFilter === "all"} onClick={() => setGroupFilter("all")}>
                すべて
              </Chip>
              {data.groups.map((g) => (
                <Chip
                  key={g.id}
                  active={groupFilter === g.id}
                  onClick={() => setGroupFilter(g.id)}
                >
                  {g.name}
                </Chip>
              ))}
            </div>
          }
        />
        {members.length === 0 ? (
          <Empty>担当者が登録されていません。</Empty>
        ) : (
          <ul className="divide-y divide-line px-4 pb-2 sm:px-5">
            {members.map((m) => (
              <li key={m.id} id={`rec-${m.id}`} className="px-1 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[14px] font-semibold text-ink">{m.name}</span>
                  {m.kana && <span className="text-[12px] text-faint">{m.kana}</span>}
                  <span className="text-[12px] text-faint">{m.id}</span>
                  {m.role && (
                    <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11.5px] font-medium text-accent">
                      {m.role}
                    </span>
                  )}
                  <RefLink
                    onClick={() =>
                      navigate({ tab: "schedule", seg: "schedule", memberId: m.id })
                    }
                  >
                    予定を見る
                  </RefLink>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-mute">
                  {m.org && <span>{m.org}</span>}
                  <Tel phone={m.phone} />
                  <Mail email={m.email} />
                </div>
                {m.note && <p className="mt-1 text-[12.5px] text-faint">{m.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
