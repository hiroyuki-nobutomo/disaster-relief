"use client";

import { useState } from "react";
import type { ReliefData } from "@/lib/relief/types";
import { fmtDate, shelterName } from "@/lib/relief/derive";
import {
  AttachedImages,
  Card,
  CardHeader,
  Empty,
  Pill,
  Segmented,
  statusTone,
} from "@/components/relief/ui";

// 物資: ［支援要請｜品目］のセグメント切替。
// 要請（requests）は避難所からのニーズ、品目（supplies）はロット単位の発送・到着管理。
// supplies.requestId で「どの要請に応えた手配か」を辿れる。

export default function SuppliesView({ data }: { data: ReliefData }) {
  const [seg, setSeg] = useState<"requests" | "supplies">("requests");

  const requests = [...data.requests].sort((a, b) => {
    const order = { 受付: 0, 手配中: 1, 対応済: 2 } as const;
    return order[a.status] - order[b.status] || b.date.localeCompare(a.date);
  });
  const supplies = [...data.supplies].sort((a, b) =>
    (b.shipDate ?? "").localeCompare(a.shipDate ?? ""),
  );

  return (
    <div className="space-y-4">
      <Segmented
        options={[
          { value: "requests", label: "支援要請", count: data.requests.length },
          { value: "supplies", label: "品目", count: data.supplies.length },
        ]}
        value={seg}
        onChange={setSeg}
      />

      {seg === "requests" ? (
        <Card>
          <CardHeader title="支援要請・ニーズ" count={requests.length} />
          {requests.length === 0 ? (
            <Empty>
              要請はまだ登録されていません。避難所からの依頼メール等を「取り込み」に貼り付けると登録できます。
            </Empty>
          ) : (
            <ul className="divide-y divide-line px-4 pb-2 sm:px-5">
              {requests.map((r) => {
                const linked = data.supplies.filter((s) => s.requestId === r.id);
                return (
                  <li key={r.id} className="py-3">
                    <div className="flex items-start gap-2.5">
                      <Pill tone={statusTone(r.urgency)}>緊急度 {r.urgency}</Pill>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-ink">{r.content}</p>
                        <p className="mt-0.5 text-[12px] text-faint">
                          {[r.id, shelterName(data, r.shelterId), r.qty, fmtDate(r.date), r.note]
                            .filter(Boolean)
                            .join("・")}
                        </p>
                        {linked.length > 0 && (
                          <p className="mt-1 text-[12px] text-mute">
                            ↳ 手配:{" "}
                            {linked
                              .map((s) => `${s.item}（${s.status}）`)
                              .join("、")}
                          </p>
                        )}
                        <AttachedImages images={data.images} recordId={r.id} />
                      </div>
                      <Pill tone={statusTone(r.status)}>{r.status}</Pill>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : (
        <Card>
          <CardHeader title="支援品目（ロット管理）" count={supplies.length} />
          {supplies.length === 0 ? (
            <Empty>
              品目はまだ登録されていません。発送連絡メール等を「取り込み」に貼り付けると登録できます。
            </Empty>
          ) : (
            <div className="overflow-x-auto px-4 pb-4 sm:px-5">
              <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[13px]">
                <thead>
                  <tr className="text-left text-[12px] text-faint">
                    {["品目", "数量", "ロット番号", "送付元 → 送付先", "発送 / 到着", "状態"].map(
                      (h) => (
                        <th key={h} className="border-b border-line py-2 pr-4 font-medium">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {supplies.map((s) => (
                    <tr key={s.id} className="align-top">
                      <td className="border-b border-line py-2.5 pr-4">
                        <p className="font-medium text-ink">{s.item}</p>
                        <p className="text-[11.5px] text-faint">
                          {[s.id, s.category].filter(Boolean).join("・")}
                        </p>
                      </td>
                      <td className="border-b border-line py-2.5 pr-4 tabular-nums text-body">
                        {s.qty}
                        {s.unit}
                      </td>
                      <td className="border-b border-line py-2.5 pr-4 text-mute">
                        {s.lotNo ?? "—"}
                      </td>
                      <td className="border-b border-line py-2.5 pr-4 text-body">
                        {s.from ?? "—"} → {shelterName(data, s.toShelterId) || "—"}
                      </td>
                      <td className="border-b border-line py-2.5 pr-4 tabular-nums text-mute">
                        {[s.shipDate && fmtDate(s.shipDate), s.arriveDate && fmtDate(s.arriveDate)]
                          .filter(Boolean)
                          .join(" / ") || "—"}
                      </td>
                      <td className="border-b border-line py-2.5">
                        <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
