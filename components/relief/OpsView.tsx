"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReliefData, Supply, SupportRequest } from "@/lib/relief/types";
import { fmtDate, groupName, memberName, shelterName, splitDateTime } from "@/lib/relief/derive";
import { Pill, statusTone, kindTone } from "@/components/relief/ui";
import type { PillTone } from "@/components/relief/ui";

// オペレーションルーム用の統合ボード（/ops）。
// 4K・大型ディスプレイで全員が同時に見る前提の「操作しない」画面:
//  - 45秒ごとに自動更新（LIVEインジケータ＋最終更新時刻を表示）
//  - 要請ボード／物資パイプライン／避難所の収容状況／本日の動き／ライブタイムライン
//  - 下部に最新記録のティッカー
// データは /api/relief/data（スマホUIと同一）。記録はサーバ側で公開範囲フィルタ済み。

const POLL_MS = 45_000;

/** マウント後にのみ時刻を返す（SSRとのハイドレーション不一致を避ける）。
 *  effect 内の同期 setState を避けるため、初回はごく短いタイマーで設定する。 */
function useClock(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  return now;
}

function jstClock(d: Date): { hms: string; date: string } {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
  const date = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(d);
  return { hms: parts, date };
}

/** パネルの外枠。 */
function Panel({
  title,
  count,
  children,
  className = "",
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(60,50,30,0.04),0_14px_30px_-22px_rgba(60,50,30,0.25)] ${className}`}
    >
      <h2 className="font-display flex items-baseline gap-2 border-b border-line px-5 pt-3.5 pb-2.5 text-[19px] font-bold text-ink">
        {title}
        {count !== undefined && (
          <span className="font-sans text-[13px] font-semibold text-faint">{count}</span>
        )}
      </h2>
      <div className="min-h-0 flex-1 overflow-hidden px-5 py-3">{children}</div>
    </section>
  );
}

/** 要請カード。 */
function RequestCard({ r, data }: { r: SupportRequest; data: ReliefData }) {
  return (
    <div className="rounded-xl border border-line bg-paper/60 px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <Pill tone={statusTone(r.urgency)}>{r.urgency}</Pill>
        <p className="min-w-0 flex-1 truncate text-[15.5px] font-semibold text-ink">{r.content}</p>
      </div>
      <p className="mt-1 text-[13px] text-mute">
        {[shelterName(data, r.shelterId), r.qty, `${fmtDate(r.date)}受付`].filter(Boolean).join("・")}
      </p>
    </div>
  );
}

/** 物資行。 */
function SupplyRow({ s, data }: { s: Supply; data: ReliefData }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-line/70 py-1.5 last:border-b-0">
      <p className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-body">
        {s.item}
        <span className="ml-1.5 text-[13px] text-mute">
          {s.qty}
          {s.unit}
        </span>
      </p>
      <p className="max-w-[45%] truncate text-[13px] text-faint">
        → {shelterName(data, s.toShelterId) || s.from || "—"}
      </p>
    </div>
  );
}

type Live = {
  key: string;
  date: string;
  time?: string;
  tag: string;
  tone: PillTone;
  title: string;
  sub?: string;
};

/** ライブタイムライン（実績系イベントの新しい順）。 */
function liveItems(data: ReliefData): Live[] {
  const today = data.basisDate;
  const items: Live[] = [];
  for (const l of data.logs) {
    if (l.visibility !== "共有") continue;
    const { date, time } = splitDateTime(l.datetime);
    items.push({
      key: `log-${l.id}`,
      date,
      time,
      tag: l.kind,
      tone: kindTone(l.kind),
      title: l.title,
      sub: [l.reporter, l.shelterId && shelterName(data, l.shelterId)].filter(Boolean).join("・"),
    });
  }
  for (const s of data.supplies) {
    if (s.shipDate) {
      items.push({
        key: `ship-${s.id}`,
        date: s.shipDate,
        tag: "発送",
        tone: "amber",
        title: `${s.item} ${s.qty ?? ""}${s.unit ?? ""}`,
        sub: `${s.from ?? ""} → ${shelterName(data, s.toShelterId)}`,
      });
    }
    if (s.arriveDate && (s.status === "到着" || s.status === "配布済")) {
      items.push({
        key: `arr-${s.id}`,
        date: s.arriveDate,
        tag: "到着",
        tone: "green",
        title: `${s.item} ${s.qty ?? ""}${s.unit ?? ""}`,
        sub: shelterName(data, s.toShelterId),
      });
    }
  }
  for (const r of data.requests) {
    items.push({
      key: `req-${r.id}`,
      date: r.date,
      tag: "要請受付",
      tone: r.urgency === "高" ? "red" : "amber",
      title: r.content,
      sub: shelterName(data, r.shelterId),
    });
  }
  return items
    .filter((x) => x.date !== "" && x.date <= today)
    .sort((a, b) =>
      a.date === b.date ? (b.time ?? "").localeCompare(a.time ?? "") : b.date.localeCompare(a.date),
    )
    .slice(0, 14);
}

export default function OpsView({ initial }: { initial: ReliefData }) {
  const [data, setData] = useState(initial);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const now = useClock();
  const clock = now ? jstClock(now) : { hms: "--:--:--", date: "" };

  // 自動更新（失敗時は表示中データを維持し、次の周期で再試行）。
  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch("/api/relief/data", { cache: "no-store" });
        if (res.ok) {
          setData((await res.json()) as ReliefData);
          setUpdatedAt(new Date());
        }
      } catch {
        /* keep current data */
      }
    };
    const t = setInterval(tick, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const today = data.basisDate;
  const openReq = useMemo(
    () =>
      [...data.requests]
        .filter((r) => r.status === "受付")
        .sort((a, b) => (a.urgency === "高" ? -1 : 1) - (b.urgency === "高" ? -1 : 1)),
    [data],
  );
  const workingReq = useMemo(() => data.requests.filter((r) => r.status === "手配中"), [data]);
  const preparing = useMemo(() => data.supplies.filter((s) => s.status === "手配中"), [data]);
  const moving = useMemo(() => data.supplies.filter((s) => s.status === "輸送中"), [data]);
  const arrived = useMemo(
    () =>
      data.supplies.filter(
        (s) => (s.status === "到着" || s.status === "配布済") && (s.arriveDate ?? "") >= today,
      ),
    [data, today],
  );
  const shelters = useMemo(() => data.shelters.filter((s) => s.status === "開設"), [data]);
  const evacuees = shelters.reduce((n, s) => n + (Number(s.current) || 0), 0);
  const todaySched = useMemo(
    () =>
      data.schedule
        .filter((e) => e.date === today)
        .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? "")),
    [data, today],
  );
  const live = useMemo(() => liveItems(data), [data]);
  const highCount = openReq.filter((r) => r.urgency === "高").length;
  const tickerLogs = useMemo(
    () => live.filter((x) => x.tag !== "発送" && x.tag !== "到着").slice(0, 8),
    [live],
  );

  return (
    <div className="flex h-dvh flex-col gap-4 overflow-hidden bg-paper p-5 text-ink 2xl:p-7">
      {/* ヘッダー: 災害名・時計・状況 */}
      <header className="flex shrink-0 items-center gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.3em] text-accent/70">
            DISASTER RELIEF — OPERATION ROOM
          </p>
          <h1 className="font-display truncate text-[34px] leading-tight font-bold text-ink 2xl:text-[42px]">
            {data.disasterName || "災害対応 情報管理"}
          </h1>
          {data.hq && <p className="text-[14px] tracking-wide text-mute">{data.hq}</p>}
        </div>
        <div className="ml-auto flex items-center gap-6">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Pill tone={highCount > 0 ? "red" : openReq.length > 0 ? "amber" : "green"}>
              未対応の要請 {openReq.length}件{highCount > 0 ? `（高 ${highCount}）` : ""}
            </Pill>
            <Pill tone={preparing.length + moving.length > 0 ? "amber" : "green"}>
              手配・輸送中 {preparing.length + moving.length}件
            </Pill>
            <Pill tone="blue">
              開設避難所 {shelters.length}・避難者 約{evacuees.toLocaleString()}名
            </Pill>
          </div>
          <div className="text-right">
            <p className="font-display text-[40px] leading-none font-bold tracking-wide tabular-nums 2xl:text-[52px]">
              {clock.hms}
            </p>
            <p className="mt-1 text-[13px] text-mute">{clock.date}</p>
            <p className="mt-0.5 flex items-center justify-end gap-1.5 text-[11.5px] text-faint">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-good" />
              LIVE
              {updatedAt &&
                `・最終更新 ${new Intl.DateTimeFormat("ja-JP", {
                  timeZone: "Asia/Tokyo",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                }).format(updatedAt)}`}
            </p>
          </div>
        </div>
      </header>

      {/* 本体3カラム */}
      <main className="grid min-h-0 flex-1 grid-cols-3 gap-4">
        {/* 要請ボード */}
        <Panel title="要請ボード" count={openReq.length + workingReq.length}>
          <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto_1fr] gap-2">
            <p className="text-[12.5px] font-bold tracking-wide text-alert">
              未対応（受付） {openReq.length}件
            </p>
            <div className="min-h-0 space-y-2 overflow-hidden">
              {openReq.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-faint">未対応の要請はありません</p>
              ) : (
                openReq.slice(0, 6).map((r) => <RequestCard key={r.id} r={r} data={data} />)
              )}
            </div>
            <p className="pt-1 text-[12.5px] font-bold tracking-wide text-warn">
              手配中 {workingReq.length}件
            </p>
            <div className="min-h-0 space-y-2 overflow-hidden">
              {workingReq.slice(0, 5).map((r) => (
                <RequestCard key={r.id} r={r} data={data} />
              ))}
            </div>
          </div>
        </Panel>

        {/* 物資パイプライン＋避難所 */}
        <div className="grid min-h-0 grid-rows-2 gap-4">
          <Panel title="物資パイプライン" count={preparing.length + moving.length + arrived.length}>
            <div className="grid h-full min-h-0 grid-cols-3 gap-3">
              {(
                [
                  ["手配中", preparing, "text-warn"],
                  ["輸送中", moving, "text-accent"],
                  ["本日到着", arrived, "text-good"],
                ] as const
              ).map(([label, list, cls]) => (
                <div key={label} className="min-h-0 overflow-hidden">
                  <p className={`text-[12.5px] font-bold tracking-wide ${cls}`}>
                    {label} {list.length}
                  </p>
                  <div className="mt-1">
                    {list.slice(0, 5).map((s) => (
                      <SupplyRow key={s.id} s={s} data={data} />
                    ))}
                    {list.length === 0 && <p className="py-3 text-[12.5px] text-faint">—</p>}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="避難所・拠点" count={shelters.length}>
            <div className="grid h-full min-h-0 auto-rows-min grid-cols-2 gap-x-5 gap-y-2 overflow-hidden">
              {shelters.map((sh) => {
                const cap = Number(sh.capacity) || 0;
                const cur = Number(sh.current) || 0;
                const ratio = cap > 0 ? Math.min(1, cur / cap) : 0;
                const barTone = ratio >= 0.9 ? "bg-alert" : ratio >= 0.7 ? "bg-warn" : "bg-good";
                return (
                  <div key={sh.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate text-[14.5px] font-semibold text-ink">
                        {sh.name}
                      </p>
                      <p className="shrink-0 text-[12.5px] text-mute tabular-nums">
                        {cap > 0 ? `${cur}/${cap}名` : ""}
                      </p>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-wash">
                      <div
                        className={`h-full rounded-full ${barTone}`}
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                    {sh.needs && (
                      <p className="mt-0.5 truncate text-[12px] text-faint">要: {sh.needs}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* 本日の動き＋ライブタイムライン */}
        <div className="grid min-h-0 grid-rows-2 gap-4">
          <Panel title={`本日の動き ${fmtDate(today)}`} count={todaySched.length}>
            <div className="h-full min-h-0 overflow-hidden">
              {todaySched.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-faint">本日の予定はありません</p>
              ) : (
                todaySched.slice(0, 9).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-baseline gap-3 border-b border-line/70 py-1.5 last:border-b-0"
                  >
                    <span className="w-24 shrink-0 text-[14px] font-bold text-ink tabular-nums">
                      {e.start ? `${e.start}${e.end ? `–${e.end}` : ""}` : "終日"}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[14.5px] text-body">{e.title}</p>
                    <Pill
                      tone={e.scope === "全体" ? "blue" : e.scope === "グループ" ? "green" : "gray"}
                    >
                      {e.scope === "全体"
                        ? "全体"
                        : e.scope === "グループ"
                          ? groupName(data, e.targetId)
                          : memberName(data, e.targetId)}
                    </Pill>
                  </div>
                ))
              )}
            </div>
          </Panel>
          <Panel title="ライブタイムライン" count={live.length}>
            <div className="h-full min-h-0 overflow-hidden">
              {live.slice(0, 9).map((x) => (
                <div
                  key={x.key}
                  className="flex items-baseline gap-2.5 border-b border-line/70 py-1.5 last:border-b-0"
                >
                  <span className="w-[4.6rem] shrink-0 text-[12.5px] text-mute tabular-nums">
                    {fmtDate(x.date)}
                    {x.time ? ` ${x.time}` : ""}
                  </span>
                  <Pill tone={x.tone}>{x.tag}</Pill>
                  <p className="min-w-0 flex-1 truncate text-[14px] text-body">
                    {x.title}
                    {x.sub && <span className="ml-1.5 text-[12px] text-faint">{x.sub}</span>}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </main>

      {/* ティッカー: 最新の記録が流れる */}
      <footer className="shrink-0 overflow-hidden rounded-xl border border-line bg-ink py-2 text-[#f2efe8]">
        <div className="ops-ticker flex w-max items-center gap-12 whitespace-nowrap">
          {[...tickerLogs, ...tickerLogs].map((x, i) => (
            <span key={`${x.key}-${i}`} className="flex items-center gap-2 text-[14px]">
              <span className="text-[12px] font-bold text-[#c9b58a]">{x.tag}</span>
              {x.title}
              {x.sub && <span className="text-[12px] opacity-60">（{x.sub}）</span>}
            </span>
          ))}
          {tickerLogs.length === 0 && <span className="text-[13px] opacity-60">記録なし</span>}
        </div>
      </footer>
    </div>
  );
}
