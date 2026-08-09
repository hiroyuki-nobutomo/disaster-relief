import { google } from "googleapis";
import type { drive_v3 } from "googleapis";
import { googleAuth } from "@/lib/google-sheets";
import type { Material } from "@/lib/types";

// Google Drive（資料フォルダの一覧・ダウンロード）用クライアント。読み取り専用スコープ。
// 利用には Cloud で Drive API 有効化＋対象フォルダをサービスアカウントに共有が必要。
export function driveClient(): drive_v3.Drive {
  return google.drive({
    version: "v3",
    auth: googleAuth(["https://www.googleapis.com/auth/drive.readonly"]),
  });
}

/**
 * 指定フォルダ配下のファイルを再帰的に一覧する（サブフォルダ内も含む）。
 * 各ファイルには対象フォルダからの相対サブフォルダパス（folder）を付与。
 * 暴走防止にフォルダ走査数を上限（200）でガード。
 */
export async function listFolderFiles(folderId: string): Promise<Material[]> {
  const drive = driveClient();
  const FOLDER_MIME = "application/vnd.google-apps.folder";
  const out: Material[] = [];
  const seen = new Set<string>();
  const stack: { id: string; path: string }[] = [{ id: folderId, path: "" }];
  let folderCount = 0;

  while (stack.length && folderCount < 200) {
    const { id, path } = stack.pop()!;
    folderCount++;
    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q: `'${id.replace(/'/g, "\\'")}' in parents and trashed = false`,
        fields: "nextPageToken, files(id,name,mimeType,size,modifiedTime,createdTime)",
        orderBy: "folder,name",
        pageSize: 200,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      for (const f of res.data.files ?? []) {
        if (!f.id) continue;
        if (f.mimeType === FOLDER_MIME) {
          stack.push({ id: f.id, path: path ? `${path}/${f.name ?? ""}` : (f.name ?? "") });
        } else if (!seen.has(f.id)) {
          seen.add(f.id);
          out.push({
            id: f.id,
            name: f.name ?? "(名称不明)",
            mimeType: f.mimeType ?? "",
            size: f.size ? Number(f.size) : undefined,
            modifiedTime: f.modifiedTime ?? undefined,
            createdTime: f.createdTime ?? undefined,
            folder: path || undefined,
          });
        }
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  }

  // 新しいアップロード順（createdTime 降順、fallback modifiedTime → 名前）。
  out.sort((a, b) => {
    const ka = a.createdTime ?? a.modifiedTime ?? "";
    const kb = b.createdTime ?? b.modifiedTime ?? "";
    if (ka !== kb) return kb.localeCompare(ka);
    return a.name.localeCompare(b.name);
  });
  return out;
}
