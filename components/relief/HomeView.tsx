"use client";

import type { ReliefData } from "@/lib/relief/types";
import { fmtDate, groupName, memberName, shelterName, splitDateTime } from "@/lib/relief/derive";
import { Card, CardHeader, Empty, Pill, statusTone } from "@/components/relief/ui";

// ホーム: 今日の概況。数値タイル → 本日の予定 → 未対応の要請 → 最新の記録。

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card className="px-4 py-3.5 sm:px-5">
      <p className="text-[12px] font-medium text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
        {value}
        {sub && <span className="ml-1 text-[13px] font-medium text-neutral-400">{sub}</span>}
      </p>
    </Card>
  );
}

export default function HomeView({ data }: { data: ReliefData }) {
  const today = data.basisDate;
  const todaySched = data.schedule
    .filter((e) => e.date === today)
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  const openRequests = data.requests.filter((r) => r.status !== "対応済");
  const moving = data.supplies.filter((s) => s.status === "手配中" || s.status === "輸送中");
  const recentLogs = [...data.logs]
    .sort((a, b) => b.datetime.localeCompare(a.datetime))
    .slice(0, 3);

  return (
    <div className="space-y-4">
      {/* 概況タイル */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="メンバー" value={data.members.length} sub="名" />
        <Stat label="本日の予定" value={todaySched.length} sub="件" />
        <Stat label="未対応の要請" value={openRequests.length} sub="件" />
        <Stat label="手配・輸送中の物資" value={moving.length} sub="件" />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {/* 本日の予定 */}
        <Card>
          <CardHeader title={`本日の予定 ${fmtDate(today)}`} count={todaySched.length} />
          {todaySched.length === 0 ? (
            <Empty>本日の予定はありません。</Empty>
          ) : (
            <ul className="divide-y divide-neutral-100 px-4 pb-2 sm:px-5">
              {todaySched.map((e) => (
                <li key={e.id} className="flex items-baseline gap-3 py-2.5">
                  <span className="w-24 shrink-0 text-[13px] font-semibold tabular-nums text-neutral-900">
                    {e.start ? `${e.start}${e.end ? `–${e.end}` : ""}` : "終日"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-neutral-800">{e.title}</p>
                    <p className="text-[12px] text-neutral-400">
                      {[
                        e.scope === "全体"
                          ? "全体"
                          : e.scope === "グループ"
                            ? groupName(data, e.targetId)
                            : memberName(data, e.targetId),
                        e.place,
                      ]
                        .filter(Boolean)
                        .join("・")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 未対応の要請 */}
        <Card>
          <CardHeader title="未対応の支援要請" count={openRequests.length} />
          {openRequests.length === 0 ? (
            <Empty>未対応の要請はありません。</Empty>
          ) : (
            <ul className="divide-y divide-neutral-100 px-4 pb-2 sm:px-5">
              {openRequests.map((r) => (
                <li key={r.id} className="flex items-start gap-2.5 py-2.5">
                  <Pill tone={statusTone(r.urgency)}>{r.urgency}</Pill>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-neutral-800">{r.content}</p>
                    <p className="text-[12px] text-neutral-400">
                      {[shelterName(data, r.shelterId), r.qty, fmtDate(r.date)]
                        .filter(Boolean)
                        .join("・")}
                    </p>
                  </div>
                  <Pill tone={statusTone(r.status)}>{r.status}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* 最新の記録 */}
      <Card>
        <CardHeader title="最新の記録" count={data.logs.length} />
        {recentLogs.length === 0 ? (
          <Empty>まだ記録がありません。「取り込み」からヒアリング内容などを登録できます。</Empty>
        ) : (
          <ul className="divide-y divide-neutral-100 px-4 pb-2 sm:px-5">
            {recentLogs.map((l) => {
              const { date, time } = splitDateTime(l.datetime);
              return (
                <li key={l.id} className="py-2.5">
                  <div className="flex items-center gap-2">
                    <Pill tone="gray">{l.kind}</Pill>
                    <span className="text-[12px] text-neutral-400">
                      {fmtDate(date)}
                      {time ? ` ${time}` : ""}
                      {l.reporter ? `・${l.reporter}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-[13.5px] font-medium text-neutral-800">{l.title}</p>
                  {l.content && (
                    <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-neutral-500">
                      {l.content}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
