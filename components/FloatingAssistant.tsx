"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import AssistantPanel from "@/components/AssistantPanel";
import { PAL } from "@/lib/palette";

/**
 * 全ページ共通のフローティング PMエージェント。
 * - ルートレイアウトに 1 つだけ置くことで、ページ移動しても会話が保持される。
 * - 閉じている間は右下の起動ボタンのみで、閲覧の邪魔をしない。
 * - パネルは会話状態を保つため常時マウントし、開閉は表示の切替で行う。
 */
export default function FloatingAssistant() {
  const pathname = usePathname();
  const page = pathname?.startsWith("/gantt") ? "gantt" : "dashboard";
  const [open, setOpen] = useState(false);

  // ログイン画面ではアシスタントを出さない。
  if (pathname === "/login") return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          right: 20,
          bottom: 88,
          width: 380,
          maxWidth: "calc(100vw - 32px)",
          zIndex: 50,
          display: open ? "block" : "none",
        }}
      >
        <AssistantPanel page={page} />
      </div>

      <button
        type="button"
        aria-label={open ? "PMエージェントを閉じる" : "PMエージェントを開く"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 51,
          width: 56,
          height: 56,
          borderRadius: 9999,
          background: PAL.brand,
          color: "#fff",
          boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
        }}
        className="flex items-center justify-center"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 5.5A1.5 1.5 0 015.5 4h13A1.5 1.5 0 0120 5.5v9a1.5 1.5 0 01-1.5 1.5H9l-4 4v-4H5.5A1.5 1.5 0 014 14.5v-9z"
              fill="currentColor"
            />
          </svg>
        )}
      </button>
    </>
  );
}
