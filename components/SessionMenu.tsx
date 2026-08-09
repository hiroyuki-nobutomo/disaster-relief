"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PAL } from "@/lib/palette";

/** ヘッダ右端に「ログアウト」ボタンを表示する。
 * シングルテナント（未ログイン運用）・未ログイン時は何も表示しない。 */
export default function SessionMenu() {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.multiTenant) setProjectId(d.projectId ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  if (!projectId) return null;

  return (
    <button
      type="button"
      onClick={logout}
      style={{ border: `1px solid ${PAL.border}`, color: PAL.slate }}
      className="rounded px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-black/5"
    >
      ログアウト
    </button>
  );
}
