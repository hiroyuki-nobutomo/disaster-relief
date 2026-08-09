"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PAL } from "@/lib/palette";
import type { EditState } from "@/lib/calendar-layout";

export default function EventEditorModal({
  init,
  onClose,
  onSaved,
}: {
  init: EditState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const editRef = init.mode === "edit" ? init.ref : null;
  const [kind, setKind] = useState<"event" | "milestone">(editRef ? editRef.kind : "event");
  const initDate =
    init.mode === "add"
      ? init.date
      : editRef!.kind === "event"
        ? editRef!.startDate
        : editRef!.date;
  const [startDate, setStartDate] = useState(initDate);
  const [startTime, setStartTime] = useState(
    editRef?.kind === "event" ? (editRef.startTime ?? "") : "",
  );
  const [endDate, setEndDate] = useState(editRef?.kind === "event" ? (editRef.endDate ?? "") : "");
  const [endTime, setEndTime] = useState(editRef?.kind === "event" ? (editRef.endTime ?? "") : "");
  const [place, setPlace] = useState(editRef?.kind === "event" ? (editRef.place ?? "") : "");
  const [url, setUrl] = useState(editRef?.kind === "event" ? (editRef.url ?? "") : "");
  const [note, setNote] = useState(editRef?.kind === "event" ? (editRef.note ?? "") : "");
  const [text, setText] = useState(
    editRef ? (editRef.kind === "event" ? editRef.title : editRef.name) : "",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const send = async (action: "add" | "update" | "delete") => {
    setBusy(true);
    setErr("");
    const body: Record<string, unknown> = { action, kind, title: text };
    if (kind === "event") {
      body.startDate = startDate;
      body.startTime = startTime;
      body.endDate = endDate;
      body.endTime = endTime;
      body.place = place;
      body.url = url;
      body.note = note;
    } else {
      body.date = startDate;
    }
    if (editRef?.kind === "event") body.row = editRef.row;
    if (editRef?.kind === "milestone") body.id = editRef.id;
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErr(data.error || "更新に失敗しました。");
        return;
      }
      router.refresh();
      onSaved();
    } catch {
      setErr("通信エラーが発生しました。");
    } finally {
      setBusy(false);
    }
  };

  const isAdd = init.mode === "add";
  const label = kind === "event" ? "内容" : "名称";

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 60 }}
      className="flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 12, width: 380, maxWidth: "100%" }}
        className="p-5"
      >
        <div style={{ color: PAL.ink }} className="mb-3 text-sm font-bold">
          {isAdd ? "カレンダーに追加" : kind === "event" ? "予定を編集" : "節目を編集"}
        </div>

        <label style={{ color: PAL.slate }} className="mb-1 block text-xs">
          種別
        </label>
        <div className="mb-3 flex gap-2">
          {(["event", "milestone"] as const).map((k) => (
            <button
              key={k}
              type="button"
              disabled={!isAdd}
              onClick={() => setKind(k)}
              style={{
                border: `1px solid ${kind === k ? PAL.brand : PAL.border}`,
                background: kind === k ? PAL.pale : "#fff",
                color: kind === k ? PAL.brand : PAL.slate,
                opacity: !isAdd && kind !== k ? 0.4 : 1,
              }}
              className="rounded-md px-3 py-1 text-xs font-semibold"
            >
              {k === "event" ? "予定（カレンダーのみ）" : "節目（ガントにも）"}
            </button>
          ))}
        </div>

        {kind === "event" ? (
          <>
            <label style={{ color: PAL.slate }} className="mb-1 block text-xs">
              開始（日・時刻）
            </label>
            <div className="mb-3 flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ border: `1px solid ${PAL.border}`, color: PAL.body }}
                className="flex-1 rounded bg-white px-2 py-2 text-sm"
              />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={{ border: `1px solid ${PAL.border}`, color: PAL.body, width: 96 }}
                className="rounded bg-white px-2 py-2 text-sm"
              />
            </div>
            <label style={{ color: PAL.slate }} className="mb-1 block text-xs">
              終了（日・時刻／省略可・空欄で終日）
            </label>
            <div className="mb-3 flex items-center gap-2">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ border: `1px solid ${PAL.border}`, color: PAL.body }}
                className="flex-1 rounded bg-white px-2 py-2 text-sm"
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={{ border: `1px solid ${PAL.border}`, color: PAL.body, width: 96 }}
                className="rounded bg-white px-2 py-2 text-sm"
              />
            </div>
          </>
        ) : (
          <>
            <label style={{ color: PAL.slate }} className="mb-1 block text-xs">
              日付
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ border: `1px solid ${PAL.border}`, color: PAL.body }}
              className="mb-3 w-full rounded bg-white px-3 py-2 text-sm"
            />
          </>
        )}

        <label style={{ color: PAL.slate }} className="mb-1 block text-xs">
          {label}
        </label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={kind === "event" ? "例：週次定例会" : "例：Phase 1 検収"}
          style={{ border: `1px solid ${PAL.border}`, color: PAL.body }}
          className="mb-3 w-full rounded bg-white px-3 py-2 text-sm"
        />

        {kind === "event" && (
          <>
            <label style={{ color: PAL.slate }} className="mb-1 block text-xs">
              場所（任意）
            </label>
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="例：新宿イーストサイドスクエア 8F"
              style={{ border: `1px solid ${PAL.border}`, color: PAL.body }}
              className="mb-3 w-full rounded bg-white px-3 py-2 text-sm"
            />
            <label style={{ color: PAL.slate }} className="mb-1 block text-xs">
              URL（任意）
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…（会議リンク等）"
              style={{ border: `1px solid ${PAL.border}`, color: PAL.body }}
              className="mb-1 w-full rounded bg-white px-3 py-2 text-sm"
            />
            {url && /^https?:\/\//.test(url) && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                style={{ color: PAL.brand }}
                className="mb-3 inline-block text-xs underline"
              >
                開く →
              </a>
            )}
            <label style={{ color: PAL.slate }} className="mt-2 mb-1 block text-xs">
              メモ（任意）
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="補足・持ち物・アジェンダ等"
              style={{ border: `1px solid ${PAL.border}`, color: PAL.body }}
              className="mb-3 w-full rounded bg-white px-3 py-2 text-sm"
            />
          </>
        )}

        {err && (
          <div style={{ color: PAL.red }} className="mb-2 text-xs">
            {err}
          </div>
        )}

        <div className="mt-1 flex items-center justify-between">
          {init.mode === "edit" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => send("delete")}
              style={{ color: PAL.red }}
              className="text-xs font-semibold"
            >
              削除
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              style={{ border: `1px solid ${PAL.border}`, color: PAL.slate }}
              className="rounded px-3 py-1.5 text-xs font-semibold"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={busy || !startDate || !text.trim()}
              onClick={() => send(isAdd ? "add" : "update")}
              style={{
                background: busy || !startDate || !text.trim() ? PAL.slateLt : PAL.brand,
                color: "#fff",
              }}
              className="rounded px-4 py-1.5 text-xs font-semibold"
            >
              {busy ? "…" : isAdd ? "追加" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
