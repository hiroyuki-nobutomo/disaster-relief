import { getDashboardData } from "@/lib/sheets";
import { isMultiTenant } from "@/lib/projects";

// 関数は毎回実行し、CDN 側で 60 秒キャッシュ（s-maxage）して Sheets 呼び出しを抑える。
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDashboardData();
    // マルチテナントは Cookie でテナントが変わるため CDN 共有不可（private/no-store）。
    // シングルテナントは従来どおり CDN で 60 秒キャッシュ。
    const cache = isMultiTenant()
      ? "private, no-store"
      : "public, s-maxage=60, stale-while-revalidate=300";
    return Response.json(data, {
      headers: {
        // charset を明示して、生JSON閲覧時のブラウザ自動判定による文字化けを防ぐ。
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": cache,
      },
    });
  } catch (err) {
    console.error("/api/data failed:", err);
    return Response.json(
      { error: "Google Sheets からのデータ取得に失敗しました。" },
      { status: 502 },
    );
  }
}
