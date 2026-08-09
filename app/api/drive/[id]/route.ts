import { driveClient, listFolderFiles } from "@/lib/drive";
import { getDriveFolderId } from "@/lib/sheets";

// 資料のダウンロードをサービスアカウント経由で配信（プロキシ）。
// ダッシュボードを閲覧できる人なら、各自の Google アクセス権が無くても DL できる。
// 対象は meta.drive_folder_id のフォルダ直下のファイルのみに限定（ID 総当たり対策）。
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const folderId = await getDriveFolderId();
  if (!folderId) {
    return new Response("資料フォルダ（meta.drive_folder_id）が未設定です。", { status: 404 });
  }

  // 対象フォルダ内のファイルだけを許可。
  let allowed;
  try {
    allowed = await listFolderFiles(folderId);
  } catch {
    return new Response("Drive からの取得に失敗しました（API有効化・共有を確認）。", {
      status: 502,
    });
  }
  const file = allowed.find((f) => f.id === id);
  if (!file) return new Response("対象フォルダ外のファイルです。", { status: 404 });

  const drive = driveClient();
  try {
    let buf: ArrayBuffer;
    let mime = file.mimeType || "application/octet-stream";
    let name = file.name;

    if (file.mimeType.startsWith("application/vnd.google-apps")) {
      // Google ネイティブ形式は PDF にエクスポートして配信。
      mime = "application/pdf";
      name = name.replace(/\.[^.]+$/, "") + ".pdf";
      const r = await drive.files.export(
        { fileId: id, mimeType: mime },
        { responseType: "arraybuffer" },
      );
      buf = r.data as ArrayBuffer;
    } else {
      const r = await drive.files.get(
        { fileId: id, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" },
      );
      buf = r.data as ArrayBuffer;
    }

    return new Response(Buffer.from(buf), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("/api/drive download failed:", err);
    return new Response("ダウンロードに失敗しました。", { status: 502 });
  }
}
