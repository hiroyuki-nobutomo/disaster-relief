"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/** 担当者ID（例: M-01）＋パスワードでログインする。 */
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

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-7 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_16px_36px_-20px_rgba(16,24,40,0.25)]">
        <p className="text-[11px] font-semibold tracking-widest text-accent">DISASTER RELIEF</p>
        <h1 className="font-display mt-1.5 text-xl font-bold text-ink">
          災害対応 情報管理
        </h1>
        <p className="mt-1 mb-6 text-[13px] text-mute">
          担当者ID とパスワードを入力してください。
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-body">
              担当者ID
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              placeholder="例: M-01"
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-body">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none"
            />
          </div>

          {error && <p className="text-[12.5px] font-medium text-alert">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-accent py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-60"
          >
            {busy ? "確認中…" : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
