"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PAL } from "@/lib/palette";
import SectionTitle from "@/components/ui/SectionTitle";
import FieldLabel from "@/components/ui/FieldLabel";
import { taskRows } from "@/lib/derive";
import type { Task } from "@/lib/types";

// 活動報告メールの取り込み（機能①）。
// 貼り付け → /api/reports(action=analyze) で5W1Hの下書きを得る → ユーザーが確認・修正 →
// /api/reports(action=save) で reports タブへ追記（確認してから書き込み）。

type Draft = {
  date: string;
  who: string;
  taskId?: string;
  taskName?: string;
  where?: string;
  what: string;
  how?: string;
  why?: string;
  source?: string;
};

export default function ReportIntakePanel({ tasks }: { tasks: Task[] }) {
  const [email, setEmail] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [note, setNote] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState<"analyze" | "save" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const items = taskRows(tasks); // milestone を除いたタスク

  const analyze = async () => {
    if (busy || !email.trim()) return;
    setBusy("analyze");
    setMessage(null);
    setDrafts(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze", emailText: email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "分析に失敗しました。");
      } else {
        setDrafts(data.reports ?? []);
        setNote(data.note);
        if ((data.reports ?? []).length === 0) {
          setMessage(data.note || "作業の事実が読み取れませんでした。本文をご確認ください。");
        }
      }
    } catch {
      setMessage("通信エラーが発生しました。");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (busy || !drafts || drafts.length === 0) return;
    setBusy("save");
    setMessage(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", entries: drafts }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "保存に失敗しました。");
      } else {
        setMessage(`${data.count}件の報告を登録しました（反映まで最大1分ほどかかります）。`);
        setDrafts(null);
        setNote(undefined);
        setEmail("");
        router.refresh();
      }
    } catch {
      setMessage("通信エラーが発生しました。");
    } finally {
      setBusy(null);
    }
  };

  const update = (i: number, patch: Partial<Draft>) => {
    setDrafts((ds) => {
      if (!ds) return ds;
      const next = [...ds];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const remove = (i: number) => {
    setDrafts((ds) => (ds ? ds.filter((_, j) => j !== i) : ds));
  };

  const inputStyle = { border: `1px solid ${PAL.border}`, color: PAL.body } as const;

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>メール取り込み（5W1H分析）</SectionTitle>
        <span style={{ color: PAL.slateLt }} className="text-xs">
          貼り付け → 分析 → 確認して登録
        </span>
      </div>

      <textarea
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        rows={6}
        placeholder="活動報告メールの本文（件名・差出人を含めると精度が上がります）をここに貼り付けてください。"
        style={inputStyle}
        className="w-full rounded bg-white px-3 py-2 text-sm"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={analyze}
          disabled={busy !== null || !email.trim()}
          style={{
            background: busy !== null || !email.trim() ? PAL.slateLt : PAL.brand,
            color: "#fff",
          }}
          className="rounded px-4 py-2 text-sm font-semibold whitespace-nowrap"
        >
          {busy === "analyze" ? "分析中…" : "分析する"}
        </button>
        {message && (
          <div style={{ color: PAL.slate }} className="text-xs">
            {message}
          </div>
        )}
      </div>

      {drafts && drafts.length > 0 && (
        <div className="mt-4">
          <div style={{ color: PAL.slate }} className="mb-2 text-xs">
            読み取った報告（{drafts.length}件）。内容を確認・修正して「登録する」を押してください。
            {note && <span className="ml-2">※{note}</span>}
          </div>
          <div className="flex flex-col gap-3">
            {drafts.map((d, i) => (
              <div
                key={i}
                style={{ border: `1px solid ${PAL.border}`, background: PAL.tint2 }}
                className="rounded-lg p-3"
              >
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <label className="flex flex-col gap-1">
                    <FieldLabel>いつ（作業日）</FieldLabel>
                    <input
                      type="date"
                      value={d.date}
                      onChange={(e) => update(i, { date: e.target.value })}
                      style={inputStyle}
                      className="rounded bg-white px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <FieldLabel>誰が</FieldLabel>
                    <input
                      value={d.who}
                      onChange={(e) => update(i, { who: e.target.value })}
                      style={inputStyle}
                      className="rounded bg-white px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="col-span-2 flex flex-col gap-1">
                    <FieldLabel>どの小項目（タスク）で</FieldLabel>
                    <select
                      value={d.taskId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        const id = v === "" ? undefined : v;
                        update(i, {
                          taskId: id,
                          taskName:
                            id === undefined ? undefined : items.find((t) => t.id === id)?.name,
                        });
                      }}
                      style={inputStyle}
                      className="rounded bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="">（対応付けなし）</option>
                      {items.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.id}. {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="col-span-2 flex flex-col gap-1">
                    <FieldLabel>どこで</FieldLabel>
                    <input
                      value={d.where ?? ""}
                      onChange={(e) => update(i, { where: e.target.value || undefined })}
                      style={inputStyle}
                      className="rounded bg-white px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="col-span-2 flex flex-col gap-1">
                    <FieldLabel>どうやって</FieldLabel>
                    <input
                      value={d.how ?? ""}
                      onChange={(e) => update(i, { how: e.target.value || undefined })}
                      style={inputStyle}
                      className="rounded bg-white px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="col-span-2 flex flex-col gap-1 lg:col-span-4">
                    <FieldLabel>どんな作業を</FieldLabel>
                    <textarea
                      value={d.what}
                      onChange={(e) => update(i, { what: e.target.value })}
                      rows={2}
                      style={inputStyle}
                      className="rounded bg-white px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span style={{ color: PAL.slateLt }} className="text-xs">
                    {d.source ? `出典: ${d.source}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    style={{ color: PAL.red }}
                    className="text-xs"
                  >
                    この報告を除外
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={busy !== null}
            style={{ background: busy !== null ? PAL.slateLt : PAL.brand, color: "#fff" }}
            className="mt-3 rounded px-4 py-2 text-sm font-semibold whitespace-nowrap"
          >
            {busy === "save" ? "登録中…" : `${drafts.length}件を登録する`}
          </button>
        </div>
      )}
    </div>
  );
}
