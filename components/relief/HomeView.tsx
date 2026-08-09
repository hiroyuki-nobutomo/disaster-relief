"use client";

import { useEffect, useRef } from "react";
import type { ReliefData } from "@/lib/relief/types";
import { fmtDate, groupName, memberName, shelterName, splitDateTime } from "@/lib/relief/derive";
import { Card, CardHeader, Empty, Pill } from "@/components/relief/ui";
import type { PillTone } from "@/components/relief/ui";
import type { NavTarget, Navigate } from "@/lib/relief/nav";

// ホーム: 「今どうなっているか」「次に何を為すべきか」を端的に示す画面。
//  1. 状況チップ — 1行のコンパクトな概況（タイトルなし）
//  2. タイムライン — 上=これからの予定 /「いま」区切り / 下=これまでの実績（新しい順）
//  3. ネクストアクション — データから導出するアクションキュー（緊急度順）

type Action = { tone: PillTone; tag: string; text: string; sub?: string; nav: NavTarget };

/** ネクストアクションをデータから導出する（表示は最大8件・緊急度順）。 */
function deriveActions(data: ReliefData): Action[] {
  const today = data.basisDate;
  const actions: Action[] = [];

  // 1) 未着手（受付のまま）の支援要請 — 緊急度高を先に
  const open = data.requests.filter((r) => r.status === "受付");
  for (const r of [...open].sort((a, b) => (a.urgency === "高" ? -1 : 1) - (b.urgency === "高" ? -1 : 1))) {
    actions.push({
      tone: r.urgency === "高" ? "red" : "amber",
      tag: `要請・${r.urgency}`,
      text: `「${r.content}」の手配を始める`,
      sub: [shelterName(data, r.shelterId), r.qty, `${fmtDate(r.date)}受付`].filter(Boolean).join("・"),
      nav: { tab: "supplies", seg: "requests", focusId: r.id },
    });
  }

  // 2) 到着予定日を迎えた輸送中の物資 — 到着確認
  for (const s of data.supplies) {
    if (s.status === "輸送中" && s.arriveDate && s.arriveDate <= today) {
      actions.push({
        tone: "amber",
        tag: "物資",
        text: `${s.item} の到着を確認する`,
        sub: [shelterName(data, s.toShelterId), s.arriveDate && `${fmtDate(s.arriveDate)}着予定`]
          .filter(Boolean)
          .join("・"),
        nav: { tab: "supplies", seg: "supplies", focusId: s.id },
      });
    }
  }

  // 3) 本日のこれからの予定（直近2件）
  const upcoming = data.schedule
    .filter((e) => e.date === today)
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
    .slice(0, 2);
  for (const e of upcoming) {
    actions.push({
      tone: "blue",
      tag: "予定",
      text: e.title,
      sub: [e.start ? `${e.start}${e.end ? `–${e.end}` : ""}` : "終日", e.place].filter(Boolean).join("・"),
      nav: { tab: "schedule", seg: "schedule", focusId: e.id },
    });
  }

  // 4) 自分の未共有の下書き（ログイン時のみ届いている）
  for (const l of data.logs) {
    if (l.visibility === "下書き" && (!data.currentMemberId || l.authorId === data.currentMemberId)) {
      actions.push({
        tone: "gray",
        tag: "下書き",
        text: `「${l.title}」を確認して共有する`,
        sub: l.reporter,
        nav: { tab: "logs", focusId: l.id },
      });
    }
  }

  return actions.slice(0, 8);
}

type TimelineItem = {
  key: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  tag: string;
  tone: PillTone;
  title: string;
  sub?: string;
  nav: NavTarget;
};

/** これからの予定（今日以降・昇順）。 */
function futureItems(data: ReliefData): TimelineItem[] {
  const today = data.basisDate;
  return data.schedule
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date === b.date ? (a.start ?? "").localeCompare(b.start ?? "") : a.date.localeCompare(b.date)))
    .slice(0, 30)
    .map((e) => ({
      key: `sc-${e.id}`,
      date: e.date,
      time: e.start,
      tag:
        e.scope === "全体" ? "全体" : e.scope === "グループ" ? groupName(data, e.targetId) : memberName(data, e.targetId),
      tone: e.scope === "全体" ? "blue" : e.scope === "グループ" ? "green" : "gray",
      title: e.title,
      sub: [e.start ? `${e.start}${e.end ? `–${e.end}` : ""}` : "終日", e.place].filter(Boolean).join("・"),
      nav: { tab: "schedule", seg: "schedule", focusId: e.id },
    }));
}

/** これまでの実績（記録・物資の発送/到着・要請受付・過去の予定）。新しい順。 */
function pastItems(data: ReliefData): TimelineItem[] {
  const today = data.basisDate;
  const items: TimelineItem[] = [];

  for (const l of data.logs) {
    const { date, time } = splitDateTime(l.datetime);
    items.push({
      key: `log-${l.id}`,
      date,
      time,
      tag: l.kind,
      tone: l.kind === "指示・決定" ? "red" : l.kind === "ヒアリング" ? "blue" : "gray",
      title: l.visibility === "共有" ? l.title : `${l.title}（${l.visibility}）`,
      sub: [l.reporter, l.shelterId && `@${shelterName(data, l.shelterId)}`].filter(Boolean).join("・"),
      nav: { tab: "logs", focusId: l.id },
    });
  }
  for (const s of data.supplies) {
    if (s.shipDate) {
      items.push({
        key: `sp-ship-${s.id}`,
        date: s.shipDate,
        tag: "発送",
        tone: "amber",
        title: `${s.item} ${s.qty ?? ""}${s.unit ?? ""} を発送`,
        sub: [s.from, "→", shelterName(data, s.toShelterId)].filter(Boolean).join(" "),
        nav: { tab: "supplies", seg: "supplies", focusId: s.id },
      });
    }
    if (s.arriveDate && (s.status === "到着" || s.status === "配布済")) {
      items.push({
        key: `sp-arr-${s.id}`,
        date: s.arriveDate,
        tag: "到着",
        tone: "green",
        title: `${s.item} ${s.qty ?? ""}${s.unit ?? ""} が到着`,
        sub: shelterName(data, s.toShelterId),
        nav: { tab: "supplies", seg: "supplies", focusId: s.id },
      });
    }
  }
  for (const r of data.requests) {
    items.push({
      key: `req-${r.id}`,
      date: r.date,
      tag: `要請受付・${r.urgency}`,
      tone: r.urgency === "高" ? "red" : "amber",
      title: r.content,
      sub: [shelterName(data, r.shelterId), r.qty, `現在: ${r.status}`].filter(Boolean).join("・"),
      nav: { tab: "supplies", seg: "requests", focusId: r.id },
    });
  }
  // 過去の予定は「実施済み」として実績側に出す
  for (const e of data.schedule) {
    if (e.date < today) {
      items.push({
        key: `sc-past-${e.id}`,
        date: e.date,
        time: e.start,
        tag: "実施",
        tone: "gray",
        title: e.title,
        sub: e.place,
        nav: { tab: "schedule", seg: "schedule", focusId: e.id },
      });
    }
  }

  return items
    .filter((x) => x.date !== "" && x.date <= today)
    .sort((a, b) => (a.date === b.date ? (b.time ?? "").localeCompare(a.time ?? "") : b.date.localeCompare(a.date)))
    .slice(0, 50);
}

function TimelineRow({
  item,
  dim,
  navigate,
}: {
  item: TimelineItem;
  dim?: boolean;
  navigate: Navigate;
}) {
  return (
    <li className={`relative flex gap-3.5 ${dim ? "opacity-80" : ""}`}>
      <div className="flex w-[4.2rem] shrink-0 flex-col items-end pt-0.5">
        <span className="text-[12px] font-semibold tabular-nums text-mute">
          {fmtDate(item.date)}
        </span>
        {item.time && <span className="text-[11px] tabular-nums text-faint">{item.time}</span>}
      </div>
      <div className="flex flex-col items-center">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-line" />
        <span className="w-px flex-1 bg-line" />
      </div>
      {/* 行全体が該当タブへのジャンプボタン */}
      <button
        onClick={() => navigate(item.nav)}
        title="該当タブで見る"
        className="group -mx-1 mb-4 min-w-0 flex-1 rounded-lg px-1 pb-0 text-left transition-colors hover:bg-paper"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={item.tone}>{item.tag}</Pill>
          <p className="text-[13.5px] font-medium text-body">{item.title}</p>
          <span
            aria-hidden
            className="text-[12px] text-faint opacity-0 transition-opacity group-hover:opacity-100"
          >
            ›
          </span>
        </div>
        {item.sub && <p className="mt-0.5 text-[12px] text-faint">{item.sub}</p>}
      </button>
    </li>
  );
}

export default function HomeView({ data, navigate }: { data: ReliefData; navigate: Navigate }) {
  const today = data.basisDate;
  const openReq = data.requests.filter((r) => r.status !== "対応済");
  const highReq = openReq.filter((r) => r.urgency === "高");
  const moving = data.supplies.filter((s) => s.status === "手配中" || s.status === "輸送中");
  const shelters = data.shelters.filter((s) => s.status === "開設");
  const evacuees = shelters.reduce((n, s) => n + (Number(s.current) || 0), 0);
  const todayLeft = data.schedule.filter((e) => e.date === today).length;

  const actions = deriveActions(data);
  const future = futureItems(data);
  const past = pastItems(data);

  // タイムラインの初期スクロール位置:「いま」の区切りを領域の中央に置く。
  const scrollRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = scrollRef.current;
    const m = nowRef.current;
    if (c && m) {
      c.scrollTop = m.offsetTop - (c.clientHeight - m.clientHeight) / 2;
    }
  }, [data]);

  const chips: { label: string; tone: PillTone }[] = [
    {
      label: highReq.length > 0 ? `未対応の要請 ${openReq.length}件（高 ${highReq.length}）` : `未対応の要請 ${openReq.length}件`,
      tone: highReq.length > 0 ? "red" : openReq.length > 0 ? "amber" : "green",
    },
    { label: `手配・輸送中の物資 ${moving.length}件`, tone: moving.length > 0 ? "amber" : "green" },
    { label: `開設避難所 ${shelters.length}・避難者 約${evacuees.toLocaleString()}名`, tone: "blue" },
    { label: `本日の予定 ${todayLeft}件`, tone: "gray" },
  ];

  return (
    <div className="space-y-4">
      {/* 1. 状況チップ（タイトルは置かず、チップだけで端的に示す） */}
      <Card className="px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <Pill key={c.label} tone={c.tone}>
              {c.label}
            </Pill>
          ))}
        </div>
      </Card>

      {/* 2. タイムライン（上=これから / いま / 下=これまで）。
             カード内の固定高スクロール領域にし、初期表示は「いま」を中央に置く */}
      <Card>
        <CardHeader
          title="タイムライン"
          right={<span className="text-[12px] text-faint">上へ: 予定 ／ 下へ: 実績</span>}
        />
        <div className="relative">
          {future.length === 0 && past.length === 0 ? (
            <Empty>まだ予定も実績もありません。「取り込み」から登録できます。</Empty>
          ) : (
            <>
              <div
                ref={scrollRef}
                className="relative max-h-[58dvh] overflow-y-auto overscroll-contain px-4 pt-2 pb-4 sm:px-5 lg:max-h-[34rem]"
              >
                {/* これから（近い順に上から。今に近いものが「いま」の直上に来るよう逆順表示） */}
                <ol>
                  {[...future].reverse().map((item) => (
                    <TimelineRow key={item.key} item={item} navigate={navigate} />
                  ))}
                </ol>
                {/* いま（初期スクロール位置の基準） */}
                <div ref={nowRef} className="my-1 flex items-center gap-3" aria-label="現在">
                  <span className="h-px flex-1 bg-alert/30" />
                  <span className="rounded-full bg-alert-soft px-3 py-1 text-[11.5px] font-bold text-alert ring-1 ring-alert/30 ring-inset">
                    いま（{fmtDate(today)}）
                  </span>
                  <span className="h-px flex-1 bg-alert/30" />
                </div>
                {/* これまで（新しい順） */}
                <ol className="pt-3">
                  {past.map((item) => (
                    <TimelineRow key={item.key} item={item} dim navigate={navigate} />
                  ))}
                </ol>
              </div>
              {/* 上下端のフェード（スクロールできることを示す） */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-b-none bg-gradient-to-b from-surface to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-2xl bg-gradient-to-t from-surface to-transparent" />
            </>
          )}
        </div>
      </Card>

      {/* 3. ネクストアクション（タイムラインの下）。文字階層は他セクションと同一 */}
      <Card>
        <CardHeader title="ネクストアクション" count={actions.length} />
        {actions.length === 0 ? (
          <Empty>いま対応が必要な項目はありません。</Empty>
        ) : (
          <ol className="divide-y divide-line px-4 pb-2 sm:px-5">
            {actions.map((a, i) => (
              <li key={i}>
                <button
                  onClick={() => navigate(a.nav)}
                  title="該当タブで見る"
                  className="group -mx-1 flex w-full items-start gap-2.5 rounded-lg px-1 py-2.5 text-left transition-colors hover:bg-paper"
                >
                  <span className="mt-0.5 w-5 shrink-0 text-center text-[11.5px] font-bold text-faint">
                    {i + 1}
                  </span>
                  <Pill tone={a.tone}>{a.tag}</Pill>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-body">
                      {a.text}
                      <span
                        aria-hidden
                        className="ml-1 text-[12px] text-faint opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        ›
                      </span>
                    </p>
                    {a.sub && <p className="mt-0.5 text-[12px] text-faint">{a.sub}</p>}
                  </div>
                </button>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
