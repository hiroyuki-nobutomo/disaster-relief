"use client";

import { useMemo, useState } from "react";
import type { Booking, ReliefData, ScheduleItem } from "@/lib/relief/types";
import {
  bookingsForMember,
  fmtDate,
  groupByDate,
  groupName,
  memberName,
  scheduleForMember,
} from "@/lib/relief/derive";
import { Card, CardHeader, Empty, Pill, Segmented, statusTone } from "@/components/relief/ui";

// 予定: ［スケジュール｜予約］のセグメント切替。
// スケジュールは表示対象（全体一覧／担当者ごと）を選べ、担当者を選ぶと
// 全体＋所属グループ＋本人の予定に、本人の予約（ホテル・移動）を重ねて表示する。

const BOOKING_ICON: Record<Booking["type"], string> = {
  ホテル: "🏨",
  飛行機: "✈️",
  新幹線: "🚄",
  レンタカー: "🚗",
  その他: "🎫",
};

function scopeBadge(data: ReliefData, e: ScheduleItem) {
  if (e.scope === "全体") return <Pill tone="blue">全体</Pill>;
  if (e.scope === "グループ") return <Pill tone="green">{groupName(data, e.targetId)}</Pill>;
  return <Pill tone="gray">{memberName(data, e.targetId)}</Pill>;
}

/** 予約を「その日の帯」としてスケジュールに重ねるための擬似予定行。 */
function bookingRows(bookings: Booking[], date: string): Booking[] {
  return bookings.filter((b) => {
    const end = b.endDate ?? b.startDate;
    return b.startDate <= date && date <= end;
  });
}

export default function ScheduleView({ data }: { data: ReliefData }) {
  const [seg, setSeg] = useState<"schedule" | "bookings">("schedule");
  // ログイン中はまず「自分のスケジュール」（全体＋所属グループ＋本人＋本人の予約）を表示する。
  const [target, setTarget] = useState<string>(data.currentMemberId ?? "all");

  const items = useMemo(
    () => (target === "all" ? data.schedule : scheduleForMember(data, target)),
    [data, target],
  );
  const myBookings = useMemo(
    () => (target === "all" ? [] : bookingsForMember(data, target)),
    [data, target],
  );
  const byDate = useMemo(() => groupByDate(items), [items]);

  const sortedBookings = useMemo(
    () => [...data.bookings].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [data],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          options={[
            { value: "schedule", label: "スケジュール", count: data.schedule.length },
            { value: "bookings", label: "予約", count: data.bookings.length },
          ]}
          value={seg}
          onChange={setSeg}
        />
        {seg === "schedule" && (
          <label className="flex items-center gap-2 text-[13px] text-mute">
            表示対象
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-body focus:border-accent focus:outline-none"
            >
              <option value="all">全体一覧</option>
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {seg === "schedule" ? (
        byDate.length === 0 ? (
          <Card>
            <Empty>予定が登録されていません。「取り込み」から登録できます。</Empty>
          </Card>
        ) : (
          byDate.map(([date, list]) => {
            const stays = bookingRows(myBookings, date);
            return (
              <Card key={date}>
                <CardHeader
                  title={fmtDate(date)}
                  right={
                    date === data.basisDate ? (
                      <Pill tone="red">今日</Pill>
                    ) : undefined
                  }
                />
                <ul className="divide-y divide-line px-4 pb-2 sm:px-5">
                  {list.map((e) => (
                    <li key={e.id} className="flex items-baseline gap-3 py-2.5">
                      <span className="w-24 shrink-0 text-[13px] font-semibold tabular-nums text-ink">
                        {e.start ? `${e.start}${e.end ? `–${e.end}` : ""}` : "終日"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-body">{e.title}</p>
                        {(e.place || e.note) && (
                          <p className="text-[12px] text-faint">
                            {[e.place, e.note].filter(Boolean).join("・")}
                          </p>
                        )}
                      </div>
                      {scopeBadge(data, e)}
                    </li>
                  ))}
                  {/* 本人の予約（宿泊・移動）を同じ日に重ねて表示 */}
                  {stays.map((b) => (
                    <li key={b.id} className="flex items-baseline gap-3 py-2.5">
                      <span className="w-24 shrink-0 text-[13px] text-faint">
                        {BOOKING_ICON[b.type]} {b.type}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] text-body">{b.name}</p>
                        {b.detail && <p className="text-[12px] text-faint">{b.detail}</p>}
                      </div>
                      <Pill tone={statusTone(b.status)}>{b.status}</Pill>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })
        )
      ) : (
        <Card>
          <CardHeader title="予約一覧" count={sortedBookings.length} />
          {sortedBookings.length === 0 ? (
            <Empty>予約が登録されていません。予約確認メールを「取り込み」に貼り付けると登録できます。</Empty>
          ) : (
            <ul className="divide-y divide-line px-4 pb-2 sm:px-5">
              {sortedBookings.map((b) => (
                <li key={b.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[15px]">{BOOKING_ICON[b.type]}</span>
                    <span className="text-[14px] font-semibold text-ink">
                      {memberName(data, b.memberId)}
                    </span>
                    <span className="text-[13px] tabular-nums text-mute">
                      {fmtDate(b.startDate)}
                      {b.endDate && b.endDate !== b.startDate ? ` 〜 ${fmtDate(b.endDate)}` : ""}
                    </span>
                    <Pill tone={statusTone(b.status)}>{b.status}</Pill>
                  </div>
                  <p className="mt-0.5 text-[13.5px] text-body">{b.name}</p>
                  <p className="text-[12px] text-faint">
                    {[b.detail, b.confNo && `予約番号 ${b.confNo}`, b.note]
                      .filter(Boolean)
                      .join("・")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
