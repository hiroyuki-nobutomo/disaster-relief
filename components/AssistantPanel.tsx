"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PAL } from "@/lib/palette";
import SectionTitle from "@/components/ui/SectionTitle";

type Msg = { role: "user" | "assistant"; text: string };

const EXAMPLES: Record<"dashboard" | "gantt", string[]> = {
  dashboard: [
    "タスク1-3の進捗を50%にして",
    "定例会を 2026-07-03 10:00 にカレンダー追加",
    "資料リンク「共有フォルダ」のURLを更新",
  ],
  gantt: [
    "タスク2-4の終了日を 2026-08-05 に",
    "中項目1のタスクを1週間後ろ倒しに",
    "タスク1-5を1-2の上に移動",
    "中項目2に「結合テスト」を 2026-08-17〜08-21 で追加",
  ],
};

export default function AssistantPanel({ page }: { page: "dashboard" | "gantt" }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // 案内文は開いた当初のみ表示し、入力が始まったら（または送信したら）消す。
  const [touched, setTouched] = useState(false);
  const router = useRouter();

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setTouched(true);
    setInput("");
    // 「確認してから書き込み」のため、履歴を含めて送る（確認→同意の文脈を保持）。
    const next: Msg[] = [...msgs, { role: "user", text: t }];
    setMsgs(next);
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, page }),
      });
      const data = await res.json();
      setMsgs((m) => [
        ...m,
        { role: "assistant", text: data.reply ?? data.error ?? "（応答がありません）" },
      ]);
      // 書き込みがあった場合に画面へ反映されるよう、サーバーコンポーネントを再取得。
      router.refresh();
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "通信エラーが発生しました。" }]);
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || !input.trim();

  return (
    <div className="card p-5">
      <SectionTitle className="mb-2">PMエージェント（データ編集）</SectionTitle>

      {!touched && msgs.length === 0 && (
        <div
          style={{ color: PAL.slate, background: PAL.tint2, borderRadius: 8 }}
          className="mb-3 p-2.5 text-xs"
        >
          ここではタスク固有のデータ（タスクの名称・担当・期間・進捗等）のみ編集できます。
        </div>
      )}

      <div style={{ maxHeight: 260, overflowY: "auto" }} className="mb-3">
        {msgs.length === 0 ? (
          <div>
            <div style={{ color: PAL.slateLt }} className="mb-2 text-xs">
              例：
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES[page].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => send(ex)}
                  disabled={busy}
                  style={{ border: `1px solid ${PAL.border}`, color: PAL.body }}
                  className="rounded-full px-3 py-1 text-xs"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          msgs.map((m, i) => (
            <div
              key={i}
              className="mb-2 flex"
              style={{ justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}
            >
              <div
                style={{
                  background: m.role === "user" ? PAL.pale : PAL.tint2,
                  color: PAL.body,
                  maxWidth: "85%",
                }}
                className="rounded-lg px-3 py-2 text-xs whitespace-pre-wrap"
              >
                {m.text}
              </div>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (!touched) setTouched(true);
          }}
          placeholder="データの変更を指示…（例：タスク1-3の進捗を50%に）"
          style={{ border: `1px solid ${PAL.border}`, color: PAL.body }}
          className="flex-1 rounded bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={disabled}
          style={{ background: disabled ? PAL.slateLt : PAL.brand, color: "#fff" }}
          className="rounded px-4 py-2 text-sm font-semibold whitespace-nowrap"
        >
          {busy ? "…" : "送信"}
        </button>
      </form>
    </div>
  );
}
