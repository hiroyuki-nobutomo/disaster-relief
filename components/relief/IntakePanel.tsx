"use client";

import { useRef, useState } from "react";
import { Pill } from "@/components/relief/ui";

// 貼り付け取り込みパネル。
// メール・メッセージ・ヒアリングメモの貼り付け、または写真（手書きFAX・要請書・送り状等）の
// 添付 → Claude が各シートの行候補に整理 → ユーザーが確認・修正・選択 →
// Google Sheets へ追記（確認してから書き込み）。写真は圧縮して images タブに証跡として残す。

type Drafts = Record<string, Record<string, string>[]>;
type PhotoInput = { mime: string; base64: string }; // base64 は data URL

/** 写真をブラウザ側で縮小・JPEG圧縮する（Sheets 保存上限≒300KBに収める）。 */
async function compressImage(file: File): Promise<PhotoInput | null> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  // 大きい写真は段階的に品質を落として上限内に収める。
  for (const [maxDim, quality] of [
    [1280, 0.6],
    [1024, 0.5],
    [800, 0.4],
  ] as const) {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    // data URL のヘッダ分を除いた base64 長で判定（サーバ上限 400,000 文字）。
    if (dataUrl.length - "data:image/jpeg;base64,".length <= 380_000) {
      return { mime: "image/jpeg", base64: dataUrl };
    }
  }
  return null;
}

// 表示用: シート名と項目ラベル（列順はプレビューの見やすさ優先）。
const TABLE_META: Record<string, { label: string; fields: [string, string][] }> = {
  members: {
    label: "担当者名簿",
    fields: [
      ["name", "氏名"],
      ["kana", "かな"],
      ["org", "所属"],
      ["role", "役割"],
      ["groupId", "グループID"],
      ["phone", "電話"],
      ["email", "メール"],
      ["note", "備考"],
    ],
  },
  schedule: {
    label: "スケジュール",
    fields: [
      ["date", "日付"],
      ["start", "開始"],
      ["end", "終了"],
      ["scope", "区分"],
      ["targetId", "対象ID"],
      ["title", "内容"],
      ["place", "場所"],
      ["note", "備考"],
    ],
  },
  bookings: {
    label: "予約",
    fields: [
      ["memberId", "担当者ID"],
      ["type", "種別"],
      ["startDate", "開始日"],
      ["endDate", "終了日"],
      ["name", "名称（ホテル・便名）"],
      ["detail", "詳細"],
      ["confNo", "予約番号"],
      ["status", "状態"],
      ["note", "備考"],
    ],
  },
  supplies: {
    label: "支援品目",
    fields: [
      ["item", "品目"],
      ["qty", "数量"],
      ["unit", "単位"],
      ["lotNo", "ロット番号"],
      ["category", "分類"],
      ["from", "送付元"],
      ["toShelterId", "送付先ID"],
      ["status", "状態"],
      ["shipDate", "発送日"],
      ["arriveDate", "到着日"],
      ["requestId", "要請ID"],
      ["note", "備考"],
    ],
  },
  requests: {
    label: "支援要請",
    fields: [
      ["date", "受付日"],
      ["shelterId", "要請元ID"],
      ["content", "内容"],
      ["qty", "数量"],
      ["urgency", "緊急度"],
      ["status", "状態"],
      ["note", "備考"],
    ],
  },
  shelters: {
    label: "避難所・拠点",
    fields: [
      ["name", "名称"],
      ["type", "種別"],
      ["address", "住所"],
      ["contactName", "窓口"],
      ["phone", "電話"],
      ["capacity", "収容"],
      ["current", "現在"],
      ["needs", "ニーズ"],
      ["status", "状態"],
      ["note", "備考"],
    ],
  },
  contacts: {
    label: "連絡先",
    fields: [
      ["org", "組織"],
      ["name", "氏名"],
      ["role", "役職"],
      ["category", "分類"],
      ["phone", "電話"],
      ["email", "メール"],
      ["shelterId", "関連避難所ID"],
      ["note", "備考"],
    ],
  },
  images: { label: "元写真", fields: [] },
  logs: {
    label: "記録",
    fields: [
      ["datetime", "日時"],
      ["kind", "種別"],
      ["reporter", "記録者"],
      ["shelterId", "関連避難所ID"],
      ["title", "見出し"],
      ["content", "内容"],
      ["tags", "タグ"],
      ["source", "出典"],
      ["visibility", "公開範囲（共有/下書き/プライベート）"],
    ],
  },
};

type Phase = "input" | "analyzing" | "review" | "saving" | "done";

export default function IntakePanel({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("input");
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<PhotoInput[]>([]);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [savedMsg, setSavedMsg] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const rowKey = (table: string, i: number) => `${table}:${i}`;
  const draftCount = Object.values(drafts).reduce((n, rows) => n + rows.length, 0);

  const reset = () => {
    setPhase("input");
    setText("");
    setPhotos([]);
    setDrafts({});
    setIncluded(new Set());
    setNote(undefined);
    setError(undefined);
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    setError(undefined);
    const next = [...photos];
    for (const f of Array.from(files)) {
      if (next.length >= 5) {
        setError("画像は一度に5枚までです。");
        break;
      }
      const p = await compressImage(f);
      if (p) next.push(p);
      else setError(`「${f.name}」を読み込めませんでした（対応: JPEG/PNG/WebP）。`);
    }
    setPhotos(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  const analyze = async () => {
    setPhase("analyzing");
    setError(undefined);
    try {
      const res = await fetch("/api/relief/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze", text, images: photos }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "解析に失敗しました。");
      const d: Drafts = json.drafts ?? {};
      setDrafts(d);
      setNote(json.note);
      // 既定で全行を選択状態に。
      const all = new Set<string>();
      for (const [table, rows] of Object.entries(d)) {
        rows.forEach((_, i) => all.add(rowKey(table, i)));
      }
      setIncluded(all);
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析に失敗しました。");
      setPhase("input");
    }
  };

  const save = async () => {
    setPhase("saving");
    setError(undefined);
    const entries: Drafts = {};
    for (const [table, rows] of Object.entries(drafts)) {
      const sel = rows.filter((_, i) => included.has(rowKey(table, i)));
      if (sel.length) entries[table] = sel;
    }
    try {
      const res = await fetch("/api/relief/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", entries, images: photos }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存に失敗しました。");
      const parts = (json.results ?? [])
        .map((r: { table: string; ok: boolean; ids?: string[]; error?: string }) =>
          r.ok
            ? `${TABLE_META[r.table]?.label ?? r.table} ${r.ids?.length ?? 0}件`
            : `${TABLE_META[r.table]?.label ?? r.table}: ${r.error}`,
        )
        .join(" / ");
      setSavedMsg(`保存しました（${parts}）`);
      setPhase("done");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました。");
      setPhase("review");
    }
  };

  const updateCell = (table: string, i: number, key: string, value: string) => {
    setDrafts((prev) => {
      const rows = [...(prev[table] ?? [])];
      rows[i] = { ...rows[i], [key]: value };
      return { ...prev, [table]: rows };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/40 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[85dvh] sm:max-w-3xl sm:rounded-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-neutral-900">
            貼り付け取り込み
            <span className="ml-2 text-[12px] font-normal text-neutral-400">
              メール・メッセージ・メモ → シートへ反映
            </span>
          </h2>
          <button
            onClick={() => {
              onClose();
              if (phase === "done") reset();
            }}
            aria-label="閉じる"
            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 本文 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {phase === "input" || phase === "analyzing" ? (
            <>
              <p className="mb-2 text-[13px] leading-relaxed text-neutral-500">
                受信したメール・メッセージ・ヒアリングメモの貼り付け、または手書きの要請書・FAX・
                送り状などの<strong className="font-semibold text-neutral-700">写真</strong>から、
                「名簿・予定・予約・物資・要請・避難所・連絡先・記録」に整理します。
                <strong className="font-semibold text-neutral-700">
                  シートへの反映は、次の画面で内容を確認してからです。
                </strong>
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={phase === "analyzing"}
                placeholder={
                  "例）\n益城町総合体育館の運営者より。避難者は約620名。簡易トイレが不足しており、200個ほど追加を至急お願いしたい。…"
                }
                className="h-48 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 text-[13.5px] leading-relaxed text-neutral-800 placeholder:text-neutral-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
              {/* 写真の追加（カメラ撮影・ファイル選択）。圧縮して解析＋証跡保存に使う */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  multiple
                  hidden
                  onChange={(e) => addPhotos(e.target.files)}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={phase === "analyzing"}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2 text-[12.5px] font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
                >
                  📷 写真を追加（撮影・選択）
                </button>
                {photos.map((p, i) => (
                  <span key={i} className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.base64}
                      alt={`添付写真 ${i + 1}`}
                      className="h-14 w-14 rounded-lg border border-neutral-200 object-cover"
                    />
                    <button
                      onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                      aria-label={`写真 ${i + 1} を削除`}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-700 text-[10px] text-white"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              {error && <p className="mt-2 text-[13px] text-rose-600">{error}</p>}
            </>
          ) : phase === "done" ? (
            <div className="py-10 text-center">
              <p className="text-3xl">✅</p>
              <p className="mt-3 text-[14px] font-medium text-neutral-800">{savedMsg}</p>
              <button
                onClick={reset}
                className="mt-5 rounded-xl border border-neutral-200 px-4 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50"
              >
                続けて取り込む
              </button>
            </div>
          ) : (
            <>
              <p className="mb-3 text-[13px] leading-relaxed text-neutral-500">
                解析結果です。内容を確認し、必要なら修正のうえ、登録する行にチェックを入れて保存してください。
                {photos.length > 0 && (
                  <>（添付した写真 {photos.length} 枚は、圧縮して証跡としてシートに保存されます）</>
                )}
              </p>
              {note && (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-800">
                  {note}
                </p>
              )}
              {draftCount === 0 && (
                <p className="py-8 text-center text-[13px] text-neutral-400">
                  登録できる情報が見つかりませんでした。
                </p>
              )}
              <div className="space-y-4">
                {Object.entries(drafts).map(([table, rows]) =>
                  rows.length === 0 ? null : (
                    <div key={table}>
                      <div className="mb-1.5 flex items-center gap-2">
                        <Pill tone="blue">{TABLE_META[table]?.label ?? table}</Pill>
                        <span className="text-[12px] text-neutral-400">{rows.length}件</span>
                      </div>
                      <div className="space-y-2">
                        {rows.map((row, i) => {
                          const key = rowKey(table, i);
                          const checked = included.has(key);
                          return (
                            <div
                              key={key}
                              className={`rounded-xl border p-3 transition-colors ${
                                checked ? "border-blue-200 bg-blue-50/40" : "border-neutral-200 bg-neutral-50 opacity-60"
                              }`}
                            >
                              <label className="mb-2 flex items-center gap-2 text-[12.5px] font-medium text-neutral-600">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    setIncluded((prev) => {
                                      const next = new Set(prev);
                                      if (e.target.checked) next.add(key);
                                      else next.delete(key);
                                      return next;
                                    });
                                  }}
                                  className="h-4 w-4 accent-blue-600"
                                />
                                この行を登録する
                              </label>
                              <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                                {(TABLE_META[table]?.fields ?? Object.keys(row).map((k) => [k, k] as [string, string]))
                                  .filter(([k]) => row[k] !== undefined || ["date", "title", "name", "content", "item", "org", "datetime"].includes(k))
                                  .map(([k, label]) => (
                                    <label key={k} className="block">
                                      <span className="text-[11px] text-neutral-400">{label}</span>
                                      <input
                                        value={row[k] ?? ""}
                                        onChange={(e) => updateCell(table, i, k, e.target.value)}
                                        disabled={!checked}
                                        className="mt-0.5 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[13px] text-neutral-800 focus:border-blue-500 focus:outline-none disabled:bg-neutral-100"
                                      />
                                    </label>
                                  ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ),
                )}
              </div>
              {error && <p className="mt-3 text-[13px] text-rose-600">{error}</p>}
            </>
          )}
        </div>

        {/* フッター */}
        {phase !== "done" && (
          <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3.5">
            {phase === "review" || phase === "saving" ? (
              <button
                onClick={reset}
                disabled={phase === "saving"}
                className="text-[13px] font-medium text-neutral-500 hover:text-neutral-800 disabled:opacity-50"
              >
                ← 貼り付けからやり直す
              </button>
            ) : (
              <span className="text-[12px] text-neutral-400">{text.length.toLocaleString()} 文字</span>
            )}
            {phase === "input" || phase === "analyzing" ? (
              <button
                onClick={analyze}
                disabled={phase === "analyzing" || (text.trim() === "" && photos.length === 0)}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {phase === "analyzing" ? "解析中…" : "解析する"}
              </button>
            ) : (
              <button
                onClick={save}
                disabled={phase === "saving" || [...included].length === 0}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {phase === "saving"
                  ? "保存中…"
                  : `選択した ${[...included].length} 件をシートへ保存`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
