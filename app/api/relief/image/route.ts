import { getReliefData, getReliefImage } from "@/lib/relief/sheets";
import { currentMember } from "@/lib/relief/auth-server";

// 添付画像の表示。images タブの base64 チャンクを連結して画像として返す。
// <img src="/api/relief/image?id=IMG-001"> で直接表示できる。
//
// 認可: 画像は紐づく記録の公開範囲に従う。紐づく先がすべて「閲覧者に見えない記録」
// （他人の下書き・プライベートの logs）の場合は 404 を返し、連番IDの総当たりで
// 非公開記録の写真だけが取得される穴を塞ぐ。
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^IMG-\d+$/.test(id)) {
    return Response.json({ error: "id を IMG-000 形式で指定してください。" }, { status: 400 });
  }

  // 閲覧者の見えるデータ一式（logs は公開範囲フィルタ済み）で参照可否を判定する。
  const member = await currentMember();
  const data = await getReliefData(member);
  const index = data.images.find((img) => img.id === id);
  if (!index) return Response.json({ error: "画像が見つかりません。" }, { status: 404 });
  const visible = index.refIds.some((ref) =>
    // logs（L-）は閲覧者に返っている（＝共有 or 本人の）記録のみ可。それ以外の表は全員閲覧可。
    ref.startsWith("L-") ? data.logs.some((l) => l.id === ref) : true,
  );
  if (!visible) return Response.json({ error: "画像が見つかりません。" }, { status: 404 });

  const img = await getReliefImage(id);
  if (!img) return Response.json({ error: "画像が見つかりません。" }, { status: 404 });
  const bytes = Buffer.from(img.base64, "base64");
  return new Response(bytes, {
    headers: {
      "Content-Type": img.mime,
      // 認可付きのため共有キャッシュには乗せない（ブラウザ内のみ1時間）。
      "Cache-Control": "private, max-age=3600",
    },
  });
}
