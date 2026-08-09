import { getReliefImage } from "@/lib/relief/sheets";

// 添付画像の表示。images タブの base64 チャンクを連結して画像として返す。
// <img src="/api/relief/image?id=IMG-001"> で直接表示できる。
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^IMG-\d+$/.test(id)) {
    return Response.json({ error: "id を IMG-000 形式で指定してください。" }, { status: 400 });
  }
  const img = await getReliefImage(id);
  if (!img) return Response.json({ error: "画像が見つかりません。" }, { status: 404 });
  const bytes = Buffer.from(img.base64, "base64");
  return new Response(bytes, {
    headers: {
      "Content-Type": img.mime,
      // 画像は追記のみで書き換わらないため、ブラウザ側で1時間キャッシュしてよい。
      "Cache-Control": "private, max-age=3600",
    },
  });
}
