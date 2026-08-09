"use client";

import type { ReactNode } from "react";
import type { ImageIndex } from "@/lib/relief/types";

// 災害対応アプリの共有 UI プリミティブ。
// 白基調のカード・角丸・薄い罫線・控えめな影で、ステータスは色つきピルで示す。

/** カード（セクションの基本容器）。 */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_24px_-18px_rgba(16,24,40,0.18)] ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  count,
  right,
}: {
  title: string;
  count?: number;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2 sm:px-5">
      <h2 className="text-[15px] font-semibold tracking-wide text-neutral-900">
        {title}
        {count !== undefined && (
          <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
            {count}
          </span>
        )}
      </h2>
      {right}
    </div>
  );
}

const PILL_TONES = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/25",
  red: "bg-rose-50 text-rose-700 ring-rose-600/20",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
  gray: "bg-neutral-100 text-neutral-600 ring-neutral-500/15",
} as const;

export type PillTone = keyof typeof PILL_TONES;

/** ステータスピル。 */
export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** ステータス→色の対応（データ層の語彙をここで一元的に色へ写す）。 */
export function statusTone(status: string): PillTone {
  switch (status) {
    case "到着":
    case "配布済":
    case "対応済":
    case "予約済":
    case "開設":
      return "green";
    case "輸送中":
    case "手配中":
    case "仮予約":
      return "amber";
    case "受付":
    case "高":
      return "red";
    case "中":
      return "blue";
    default:
      return "gray";
  }
}

/** セグメント切替（タブ内のサブビュー切替に使う）。 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-neutral-100 p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
            value === o.value
              ? "bg-white text-neutral-900 shadow-[0_1px_2px_rgba(16,24,40,0.12)]"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={`ml-1.5 text-xs ${value === o.value ? "text-neutral-400" : "text-neutral-400"}`}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** フィルタ用チップ。 */
export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${
        active
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}

/** 空状態。 */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="px-5 py-10 text-center text-[13px] leading-relaxed text-neutral-400">{children}</p>
  );
}

/** ラベル＋値（詳細行）。値が空なら描画しない。 */
export function Field({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex gap-2 text-[13px] leading-relaxed">
      <dt className="w-16 shrink-0 text-neutral-400">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-neutral-700">{value}</dd>
    </div>
  );
}

/** 電話リンク。 */
export function Tel({ phone }: { phone?: string }) {
  if (!phone) return null;
  return (
    <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="text-blue-600 hover:underline">
      {phone}
    </a>
  );
}

/** メールリンク。 */
export function Mail({ email }: { email?: string }) {
  if (!email) return null;
  return (
    <a href={`mailto:${email}`} className="break-all text-blue-600 hover:underline">
      {email}
    </a>
  );
}

/** レコードに紐づく添付写真のサムネイル（クリックで原寸表示）。無ければ描画しない。 */
export function AttachedImages({ images, recordId }: { images: ImageIndex[]; recordId: string }) {
  const mine = images.filter((img) => img.refIds.includes(recordId));
  if (mine.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {mine.map((img) => (
        <a
          key={img.id}
          href={`/api/relief/image?id=${encodeURIComponent(img.id)}`}
          target="_blank"
          rel="noreferrer"
          title="元写真を開く"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/relief/image?id=${encodeURIComponent(img.id)}`}
            alt="添付写真"
            loading="lazy"
            className="h-14 w-14 rounded-lg border border-neutral-200 object-cover"
          />
        </a>
      ))}
    </div>
  );
}
