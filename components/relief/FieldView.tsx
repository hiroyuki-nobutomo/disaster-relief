"use client";

import { useState } from "react";
import type { ReliefData } from "@/lib/relief/types";
import type { NavTarget, Navigate } from "@/lib/relief/nav";
import { shelterMapUrl, shelterName } from "@/lib/relief/derive";
import {
  Card,
  CardHeader,
  Chip,
  Empty,
  Field,
  Mail,
  Pill,
  Segmented,
  RefLink,
  statusTone,
  Tel,
  useFocusFlash,
} from "@/components/relief/ui";

// 現地: ［避難所・拠点｜連絡先］のセグメント切替。
// 避難所は収容状況バーと地図リンク付きのカード。連絡先はカテゴリで絞り込み。

function Occupancy({ capacity, current }: { capacity?: string; current?: string }) {
  const cap = Number(capacity);
  const cur = Number(current);
  if (!Number.isFinite(cap) || cap <= 0 || !Number.isFinite(cur)) return null;
  const ratio = Math.min(1, cur / cap);
  const tone = ratio >= 0.9 ? "bg-alert" : ratio >= 0.7 ? "bg-warn" : "bg-good";
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[12px] text-faint">
        <span>避難者数</span>
        <span className="tabular-nums">
          {cur} / {cap} 名
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-wash">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

export default function FieldView({
  data,
  navigate,
  focus,
}: {
  data: ReliefData;
  navigate: Navigate;
  focus: NavTarget | null;
}) {
  const [seg, setSeg] = useState<"shelters" | "contacts">("shelters");
  const [cat, setCat] = useState<string>("all");

  // 他タブからのジャンプ到着時: セグメント・絞り込みを合わせてからハイライト。
  // （props 由来の派生 state 調整はレンダー中に行う。effect 内 setState は避ける）
  const [seenFocusAt, setSeenFocusAt] = useState<number | undefined>(undefined);
  if (focus?.tab === "field" && focus.at !== seenFocusAt) {
    setSeenFocusAt(focus.at);
    if (focus.seg === "shelters" || focus.seg === "contacts") setSeg(focus.seg);
    else if (focus.focusId?.startsWith("SH-")) setSeg("shelters");
    else if (focus.focusId?.startsWith("C-")) setSeg("contacts");
    if (focus.focusId?.startsWith("C-")) setCat("all");
  }
  useFocusFlash(focus, "field");

  const categories = [...new Set(data.contacts.map((c) => c.category).filter(Boolean))] as string[];
  const contacts = cat === "all" ? data.contacts : data.contacts.filter((c) => c.category === cat);

  return (
    <div className="space-y-4">
      <Segmented
        options={[
          { value: "shelters", label: "避難所・拠点", count: data.shelters.length },
          { value: "contacts", label: "連絡先", count: data.contacts.length },
        ]}
        value={seg}
        onChange={setSeg}
      />

      {seg === "shelters" ? (
        data.shelters.length === 0 ? (
          <Card>
            <Empty>避難所・拠点が登録されていません。</Empty>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {data.shelters.map((sh) => (
              <Card key={sh.id} className="px-4 py-4 sm:px-5">
                <div id={`rec-${sh.id}`} className="px-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-[15px] font-semibold text-ink">{sh.name}</h3>
                      <p className="text-[12px] text-faint">
                        {[sh.id, sh.type].filter(Boolean).join("・")}
                      </p>
                    </div>
                    <Pill tone={statusTone(sh.status)}>{sh.status}</Pill>
                  </div>
                  <Occupancy capacity={sh.capacity} current={sh.current} />
                  <dl className="mt-2.5 space-y-1">
                    <Field label="住所" value={sh.address} />
                    <Field label="窓口" value={sh.contactName} />
                    <Field label="電話" value={<Tel phone={sh.phone} />} />
                    <Field label="ニーズ" value={sh.needs} />
                    <Field label="備考" value={sh.note} />
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={shelterMapUrl(sh)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-body transition-colors hover:border-faint hover:bg-paper"
                    >
                      📍 地図を開く
                    </a>
                    <button
                      onClick={() => navigate({ tab: "supplies", seg: "requests" })}
                      className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-body transition-colors hover:border-faint hover:bg-paper"
                    >
                      📦 要請・物資を見る ›
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card>
          <CardHeader
            title="関係機関 連絡先"
            count={contacts.length}
            right={
              categories.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={cat === "all"} onClick={() => setCat("all")}>
                    すべて
                  </Chip>
                  {categories.map((c) => (
                    <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                      {c}
                    </Chip>
                  ))}
                </div>
              ) : undefined
            }
          />
          {contacts.length === 0 ? (
            <Empty>連絡先が登録されていません。</Empty>
          ) : (
            <ul className="divide-y divide-line px-4 pb-2 sm:px-5">
              {contacts.map((c) => (
                <li key={c.id} id={`rec-${c.id}`} className="px-1 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[14px] font-semibold text-ink">{c.org}</span>
                    {c.category && (
                      <span className="rounded-md bg-wash px-1.5 py-0.5 text-[11.5px] font-medium text-mute">
                        {c.category}
                      </span>
                    )}
                    {c.shelterId && (
                      <span className="text-[12px] text-faint">
                        関連:{" "}
                        <RefLink
                          onClick={() =>
                            navigate({ tab: "field", seg: "shelters", focusId: c.shelterId })
                          }
                        >
                          {shelterName(data, c.shelterId)}
                        </RefLink>
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-mute">
                    {[c.name, c.role].filter(Boolean).join("・") && (
                      <span>{[c.name, c.role].filter(Boolean).join("・")}</span>
                    )}
                    <Tel phone={c.phone} />
                    <Mail email={c.email} />
                  </div>
                  {c.note && <p className="mt-1 text-[12.5px] text-faint">{c.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
