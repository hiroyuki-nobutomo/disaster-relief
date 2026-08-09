"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PAL } from "@/lib/palette";

const TOOL_NAME = "プロジェクト・マネジメント ダッシュボード";

/** ID（例: AI-BCP / ASC）＋パスワードでログインし、該当プロジェクトの画面へ遷移する。 */
export default function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";

  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        // セッション Cookie 反映後に目的ページへ。
        router.replace(next.startsWith("/") ? next : "/");
        router.refresh();
      } else {
        setError(data?.error || "ログインに失敗しました。");
      }
    } catch {
      setError("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  const field = {
    border: `1px solid ${PAL.border}`,
    color: PAL.ink,
  };

  return (
    <div
      style={{ background: PAL.tint, color: PAL.body }}
      className="flex min-h-screen items-center justify-center p-6"
    >
      <div className="card w-full max-w-sm p-7">
        <div style={{ color: PAL.slateLt }} className="mb-1 text-xs">
          {TOOL_NAME}
        </div>
        <h1 style={{ color: PAL.ink }} className="mb-1 text-lg font-bold tracking-tight">
          ログイン
        </h1>
        <p style={{ color: PAL.slate }} className="mb-5 text-sm">
          プロジェクトID とパスワードを入力してください。
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label style={{ color: PAL.slate }} className="mb-1 block text-xs font-semibold">
              プロジェクトID
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              placeholder="例: AI-BCP"
              style={field}
              className="w-full rounded-md bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label style={{ color: PAL.slate }} className="mb-1 block text-xs font-semibold">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={field}
              className="w-full rounded-md bg-white px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <div style={{ color: "#b42318" }} className="text-xs font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{ background: PAL.brand, color: "#fff", opacity: busy ? 0.6 : 1 }}
            className="w-full rounded-md py-2 text-sm font-semibold"
          >
            {busy ? "確認中…" : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
