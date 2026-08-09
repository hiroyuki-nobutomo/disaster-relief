"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import type { ImageIndex } from "@/lib/relief/types";
import type { NavTarget } from "@/lib/relief/nav";

// 災害対応アプリの共有 UI プリミティブ。
// 生成りの紙色にわずかに暖かい白のカード、墨色の文字階調、藍のアクセント。
// ステータスは彩度を抑えた伝統色（苔・琥珀・紅・藍）のピルで示す。

/** カード（セクションの基本容器）。 */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(60,50,30,0.04),0_14px_30px_-22px_rgba(60,50,30,0.25)] ${className}`}
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
    <div className="flex items-center justify-between gap-3 px-4 pt-4.5 pb-2 sm:px-5">
      <h2 className="font-display text-[16px] font-bold text-ink">
        {title}
        {count !== undefined && (
          <span className="ml-2 align-[2px] font-sans text-[11.5px] font-semibold tracking-wide text-faint">
            {count}
          </span>
        )}
      </h2>
      {right}
    </div>
  );
}

const PILL_TONES = {
  green: "bg-good-soft text-good ring-good/20",
  amber: "bg-warn-soft text-warn ring-warn/25",
  red: "bg-alert-soft text-alert ring-alert/20",
  blue: "bg-accent-soft text-accent ring-accent/20",
  gray: "bg-wash text-mute ring-mute/15",
} as const;

export type PillTone = keyof typeof PILL_TONES;

/** ステータスピル。 */
export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ring-inset ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** 記録の種別→色（複数画面で使うためここに一元化）。 */
export function kindTone(kind: string): PillTone {
  return kind === "指示・決定" ? "red" : kind === "ヒアリング" ? "blue" : "gray";
}

/** 予定の対象区分→色（複数画面で使うためここに一元化）。 */
export function scopeTone(scope: string): PillTone {
  return scope === "全体" ? "blue" : scope === "グループ" ? "green" : "gray";
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
    <div className="inline-flex rounded-xl bg-wash p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
            value === o.value
              ? "bg-surface text-ink shadow-[0_1px_3px_rgba(60,50,30,0.15)]"
              : "text-mute hover:text-ink"
          }`}
        >
          {o.label}
          {o.count !== undefined && (
            <span className="ml-1.5 text-[11.5px] text-faint">{o.count}</span>
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
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${
        active
          ? "border-accent bg-accent text-white"
          : "border-line bg-surface text-mute hover:border-faint hover:text-body"
      }`}
    >
      {children}
    </button>
  );
}

/** 空状態。 */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="px-5 py-10 text-center text-[13px] leading-relaxed text-faint">{children}</p>
  );
}

/** ラベル＋値（詳細行）。値が空なら描画しない。 */
export function Field({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex gap-2 text-[13px] leading-relaxed">
      <dt className="w-16 shrink-0 text-faint">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-body">{value}</dd>
    </div>
  );
}

/** 他タブの関連情報へのジャンプリンク（避難所名・担当者名などに付ける）。 */
export function RefLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-0.5 text-accent underline-offset-2 hover:underline"
    >
      {children}
      <span aria-hidden className="text-[0.8em] opacity-70">
        ›
      </span>
    </button>
  );
}

/**
 * タブ間ジャンプの到着処理。focus が自タブ宛てなら、対象レコード
 * （DOM id: rec-<レコードID>）へスクロールし、一時ハイライトを付ける。
 * タブ・セグメント切替後の DOM 反映を待つため少し遅延させる。
 */
export function useFocusFlash(focus: NavTarget | null | undefined, ownTab: string) {
  useEffect(() => {
    if (!focus || focus.tab !== ownTab || !focus.focusId) return;
    const id = focus.focusId;
    const t = window.setTimeout(() => {
      const el = document.getElementById(`rec-${id}`);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.classList.add("flash-focus");
        window.setTimeout(() => el.classList.remove("flash-focus"), 2100);
      }
    }, 150);
    return () => window.clearTimeout(t);
  }, [focus, ownTab]);
}

/** 電話リンク。 */
export function Tel({ phone }: { phone?: string }) {
  if (!phone) return null;
  return (
    <a
      href={`tel:${phone.replace(/[^0-9+]/g, "")}`}
      className="text-accent underline-offset-2 hover:underline"
    >
      {phone}
    </a>
  );
}

/** メールリンク。 */
export function Mail({ email }: { email?: string }) {
  if (!email) return null;
  return (
    <a
      href={`mailto:${email}`}
      className="break-all text-accent underline-offset-2 hover:underline"
    >
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
            className="h-14 w-14 rounded-lg border border-line object-cover"
          />
        </a>
      ))}
    </div>
  );
}
