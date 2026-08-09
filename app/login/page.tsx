import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

// ログイン画面。useSearchParams を使うため Suspense 境界で包む。
export const metadata = { title: "ログイン｜災害対応 情報管理" };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
