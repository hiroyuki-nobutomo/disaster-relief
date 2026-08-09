"use client";

import { useEffect, useRef, useState } from "react";
import { PAL } from "@/lib/palette";
import SectionTitle from "@/components/ui/SectionTitle";
import type { Material } from "@/lib/types";

function fmtSize(n?: number): string {
  if (!n) return "";
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

// 拡張子をラベル化（アイコン代わりの簡易バッジ）。
function extOf(name: string): string {
  const m = name.match(/\.([^.]+)$/);
  return m ? m[1].toUpperCase() : "FILE";
}

// アップロード日（createdTime → YYYY-MM-DD）。無ければ modifiedTime にフォールバック。
function fmtDate(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// 1行（最新3件のフレーム高さ算出に使う想定の概算）。
const ROW_H = 56;
const VISIBLE = 3;

/** 資料リスト：Google ドライブの対象フォルダ内ファイルを一覧し、プロキシ経由でDLする。
 * 最新アップロード3件を表示し、それより古いファイルはフレーム内を矢印でスクロールして閲覧する。 */
export default function MaterialsPanel({ materials }: { materials: Material[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const scrollable = materials.length > VISIBLE;

  function refreshEdges(el: HTMLDivElement) {
    setAtTop(el.scrollTop <= 1);
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  }

  // マウント時・件数変化時に矢印の活性状態（特に下端）を初期化。
  useEffect(() => {
    if (scrollRef.current) refreshEdges(scrollRef.current);
  }, [materials.length]);

  function scrollByRows(dir: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ top: dir * ROW_H, behavior: "smooth" });
  }

  const arrowStyle = (disabled: boolean) => ({
    border: `1px solid ${PAL.border}`,
    color: disabled ? PAL.slateLt : PAL.brand,
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? "default" : "pointer",
  });

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>資料</SectionTitle>
        <span style={{ color: PAL.slateLt }} className="text-xs">
          {scrollable ? `新しい順 ・ 全${materials.length}件` : "ダウンロード"}
        </span>
      </div>

      {materials.length === 0 ? (
        <div style={{ color: PAL.slateLt }} className="text-xs">
          資料がありません（Sheet の <code>meta</code> タブに <code>drive_folder_id</code>{" "}
          を設定し、対象フォルダをサービスアカウントに共有してください）。
        </div>
      ) : (
        <div className="flex items-stretch gap-2">
          <div
            ref={scrollRef}
            onScroll={(e) => refreshEdges(e.currentTarget)}
            className="min-w-0 flex-1"
            style={
              scrollable
                ? { maxHeight: ROW_H * VISIBLE, overflowY: "auto", paddingRight: 4 }
                : undefined
            }
          >
            {materials.map((m, i) => {
              const downloadable = m.id && m.id !== "#";
              const sub = [m.folder, fmtDate(m.createdTime), m.size != null ? fmtSize(m.size) : ""]
                .filter(Boolean)
                .join(" ・ ");
              return (
                <div
                  key={m.id && m.id !== "#" ? m.id : `${m.name}-${i}`}
                  className="flex items-center gap-3"
                  style={{
                    borderTop: i ? `1px solid ${PAL.borderLt}` : "none",
                    paddingTop: i ? 10 : 0,
                    marginTop: i ? 10 : 0,
                  }}
                >
                  <span
                    style={{
                      background: PAL.tint2,
                      color: PAL.slate,
                      fontSize: 9,
                      fontWeight: 700,
                      borderRadius: 4,
                      padding: "3px 5px",
                      minWidth: 36,
                      textAlign: "center",
                    }}
                  >
                    {extOf(m.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      style={{ color: PAL.ink }}
                      className="truncate text-sm font-medium"
                      title={m.folder ? `${m.folder}/${m.name}` : m.name}
                    >
                      {m.name}
                    </div>
                    {sub && (
                      <div style={{ color: PAL.slateLt }} className="truncate text-xs">
                        {sub}
                      </div>
                    )}
                  </div>
                  {downloadable ? (
                    <a
                      href={`/api/drive/${encodeURIComponent(m.id)}`}
                      download
                      style={{ border: `1px solid ${PAL.border}`, color: PAL.brand }}
                      className="rounded-md px-3 py-1 text-xs font-semibold whitespace-nowrap"
                    >
                      ↓ DL
                    </a>
                  ) : (
                    <span style={{ color: PAL.slateLt }} className="text-xs whitespace-nowrap">
                      サンプル
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {scrollable && (
            <div className="flex flex-col justify-between">
              <button
                type="button"
                aria-label="新しい資料へスクロール"
                onClick={() => scrollByRows(-1)}
                disabled={atTop}
                style={arrowStyle(atTop)}
                className="rounded-md px-2 py-1 text-xs font-bold"
              >
                ▲
              </button>
              <button
                type="button"
                aria-label="古い資料へスクロール"
                onClick={() => scrollByRows(1)}
                disabled={atBottom}
                style={arrowStyle(atBottom)}
                className="rounded-md px-2 py-1 text-xs font-bold"
              >
                ▼
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
