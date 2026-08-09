"use client";

import { useCallback, useState } from "react";
import type { ReliefData } from "@/lib/relief/types";
import type { NavTarget, TabKey } from "@/lib/relief/nav";
import { fmtDate } from "@/lib/relief/derive";
import HomeView from "@/components/relief/HomeView";
import RosterView from "@/components/relief/RosterView";
import ScheduleView from "@/components/relief/ScheduleView";
import SuppliesView from "@/components/relief/SuppliesView";
import FieldView from "@/components/relief/FieldView";
import LogsView from "@/components/relief/LogsView";
import IntakePanel from "@/components/relief/IntakePanel";

// アプリシェル。主流のレスポンシブ構成:
//  - デスクトップ(lg+): 左サイドバーでタブ切替
//  - モバイル: 上部ヘッダー＋下部タブバー
//  - 右下の「取り込み」ボタンはどの画面からも使える
// タブ間の相互リンク（navigate → 対象タブへ切替＋該当レコードへスクロール）もここで束ねる。

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  {
    key: "home",
    label: "ホーム",
    icon: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />,
  },
  {
    key: "roster",
    label: "名簿",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 15.2c2 .6 3.5 2.1 4 4.8" />
      </>
    ),
  },
  {
    key: "schedule",
    label: "予定",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2.5" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    key: "supplies",
    label: "物資",
    icon: <path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3ZM3.3 7.6 12 12m0 0 8.7-4.4M12 12v8.8" />,
  },
  {
    key: "field",
    label: "現地",
    icon: (
      <>
        <path d="M12 21s7-6.1 7-11.2A7 7 0 0 0 5 9.8C5 14.9 12 21 12 21Z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </>
    ),
  },
  {
    key: "logs",
    label: "記録",
    icon: (
      <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 5h6M9 12h6M9 16h4" />
    ),
  },
];

function TabIcon({ icon, className }: { icon: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {icon}
    </svg>
  );
}

export default function ReliefApp({ initial }: { initial: ReliefData }) {
  const [data, setData] = useState<ReliefData>(initial);
  const [tab, setTab] = useState<TabKey>("home");
  const [intakeOpen, setIntakeOpen] = useState(false);
  // タブ間ジャンプの行き先（セグメント切替・レコードのハイライトは各ビューが focus を見て行う）
  const [focus, setFocus] = useState<NavTarget | null>(null);

  const navigate = useCallback((t: NavTarget) => {
    setFocus({ ...t, at: Date.now() });
    setTab(t.tab);
  }, []);

  // 取り込み保存後にデータを再取得して全タブへ反映する。
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/relief/data", { cache: "no-store" });
      if (res.ok) setData((await res.json()) as ReliefData);
    } catch {
      // 再取得失敗時は表示中のデータを維持（次回の操作で再試行される）
    }
  }, []);

  const logout = useCallback(async () => {
    if (!confirm("ログアウトしますか？")) return;
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    location.href = "/login";
  }, []);

  const view = {
    home: <HomeView data={data} navigate={navigate} />,
    roster: <RosterView data={data} navigate={navigate} focus={focus} />,
    schedule: <ScheduleView data={data} navigate={navigate} focus={focus} />,
    supplies: <SuppliesView data={data} navigate={navigate} focus={focus} />,
    field: <FieldView data={data} navigate={navigate} focus={focus} />,
    logs: <LogsView data={data} onChanged={refresh} navigate={navigate} focus={focus} />,
  }[tab];

  const title = data.disasterName || "災害対応 情報管理";

  return (
    <div className="min-h-dvh bg-paper text-ink">
      {/* デスクトップ: 左サイドバー */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 pt-7 pb-5">
          <p className="text-[10.5px] font-semibold tracking-[0.22em] text-accent/70">
            DISASTER RELIEF
          </p>
          <h1 className="font-display mt-1.5 text-[16.5px] leading-snug font-bold text-ink">
            {title}
          </h1>
          {data.hq && <p className="mt-1 text-[11.5px] tracking-wide text-faint">{data.hq}</p>}
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                tab === t.key
                  ? "bg-accent-soft text-accent"
                  : "text-mute hover:bg-paper hover:text-body"
              }`}
            >
              <TabIcon icon={t.icon} className="h-[18px] w-[18px]" />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="space-y-2 px-5 py-4">
          {data.currentMemberId && (
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[12px] font-medium text-body">
                👤 {data.currentMemberName || data.currentMemberId}
              </p>
              <button
                onClick={logout}
                className="shrink-0 text-[11.5px] font-medium text-faint hover:text-body"
              >
                ログアウト
              </button>
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-faint">
            {data.source === "seed"
              ? "サンプルデータ表示中（Sheets 未接続）"
              : "データ: Google Sheets"}
          </p>
        </div>
      </aside>

      {/* モバイル: 上部ヘッダー */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <h1 className="font-display truncate text-[16px] font-bold text-ink">{title}</h1>
            <p className="text-[11px] tracking-wide text-faint">
              {fmtDate(data.basisDate)}
              {data.hq ? `・${data.hq}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {data.source === "seed" && (
              <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[10.5px] font-medium text-warn">
                サンプル
              </span>
            )}
            {data.currentMemberId && (
              <button
                onClick={logout}
                aria-label="ログアウト"
                className="rounded-full bg-wash px-2.5 py-1 text-[11px] font-medium text-body"
              >
                {data.currentMemberName || data.currentMemberId}・ログアウト
              </button>
            )}
          </div>
        </div>
      </header>

      {/* コンテンツ */}
      <main className="px-4 pt-4 pb-28 sm:px-6 lg:ml-56 lg:px-8 lg:pt-8 lg:pb-16">
        <div className="mx-auto max-w-5xl">
          {/* デスクトップのページ見出し */}
          <div className="mb-6 hidden items-baseline justify-between lg:flex">
            <h2 className="font-display text-[22px] font-bold text-ink">
              {TABS.find((t) => t.key === tab)?.label}
            </h2>
            <p className="text-[13px] tracking-wide text-faint">{fmtDate(data.basisDate)}</p>
          </div>
          {view}
        </div>
      </main>

      {/* 取り込みボタン（フローティング・全画面共通） */}
      <button
        onClick={() => setIntakeOpen(true)}
        className="fixed right-4 bottom-20 z-40 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-[13.5px] font-semibold text-white shadow-[0_8px_24px_-6px_rgba(49,86,126,0.5)] transition-transform hover:scale-[1.03] active:scale-95 lg:right-8 lg:bottom-8"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="8" y="2.5" width="8" height="4" rx="1" />
          <path d="M16 4.5h2a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h2M12 10.5v7M8.5 14H15.5" />
        </svg>
        取り込み
      </button>

      {/* モバイル: 下部タブバー */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium transition-colors ${
                tab === t.key ? "text-accent" : "text-faint"
              }`}
            >
              <TabIcon icon={t.icon} className="h-[21px] w-[21px]" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <IntakePanel open={intakeOpen} onClose={() => setIntakeOpen(false)} onSaved={refresh} />
    </div>
  );
}
