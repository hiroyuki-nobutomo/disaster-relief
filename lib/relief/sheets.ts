import type {
  Booking,
  Contact,
  Group,
  ImageIndex,
  LogEntry,
  Member,
  ReliefData,
  ScheduleItem,
  Shelter,
  Supply,
  SupportRequest,
} from "@/lib/relief/types";
import { RELIEF_SEED } from "@/lib/relief/seed";
import { activeSheetId, hasSheetsCreds, sheetsClient } from "@/lib/google-sheets";

// 災害対応データの読み取り層。Google Sheets の各タブ（docs/DESIGN.md の列定義）を
// ReliefData に組み立てる。未接続時は SEED を返してローカルでも UI を確認できる。

function s(v: unknown): string {
  return String(v ?? "").trim();
}

function opt(v: unknown): string | undefined {
  const t = s(v);
  return t === "" ? undefined : t;
}

/** 許可値のいずれかに一致すればそれを、しなければ既定値を返す（表記ゆれをUIで壊さない）。 */
function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  const t = s(v) as T;
  return allowed.includes(t) ? t : fallback;
}

function todayKeyJST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** 閲覧者（ログイン中の担当者）。logs の公開範囲フィルタと個人出し分けに使う。 */
export type Viewer = { id: string; name: string } | null;

export async function getReliefData(viewer: Viewer = null): Promise<ReliefData> {
  const spreadsheetId = await activeSheetId();
  if (!hasSheetsCreds() || !spreadsheetId) {
    return { ...RELIEF_SEED, basisDate: todayKeyJST() };
  }

  const sheets = sheetsClient("read");
  const { data } = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [
      "meta!A2:B",
      "members!A2:I",
      "groups!A2:E",
      "schedule!A2:I",
      "bookings!A2:J",
      "supplies!A2:M",
      "requests!A2:H",
      "shelters!A2:L",
      "contacts!A2:I",
      "logs!A2:L",
    ],
  });

  const [metaR, memberR, groupR, schedR, bookR, supplyR, reqR, shelterR, contactR, logR] =
    data.valueRanges ?? [];

  // 添付画像の索引（images タブ・任意）。本体（E列 data）は読まない。
  // タブ未作成でも本体が壊れないよう別取得＋try/catch。
  let imageRows: string[][] = [];
  try {
    const ir = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "images!A2:D",
    });
    imageRows = ((ir.data.values ?? []) as unknown[][]).map((row) =>
      (row ?? []).map((c) => String(c ?? "")),
    );
  } catch {
    imageRows = [];
  }

  const rows = (r: (typeof metaR | undefined) | { values?: unknown[][] }): string[][] =>
    ((r?.values ?? []) as unknown[][]).map((row) => (row ?? []).map((c) => String(c ?? "")));

  const meta = new Map<string, string>();
  rows(metaR).forEach((r) => {
    if (s(r[0])) meta.set(s(r[0]), s(r[1]));
  });

  const members: Member[] = rows(memberR)
    .filter((r) => s(r[0]) !== "")
    .map((r) => ({
      id: s(r[0]),
      name: s(r[1]),
      kana: opt(r[2]),
      org: opt(r[3]),
      role: opt(r[4]),
      groupId: opt(r[5]),
      phone: opt(r[6]),
      email: opt(r[7]),
      note: opt(r[8]),
    }))
    .filter((m) => m.name !== "");

  const groups: Group[] = rows(groupR)
    .filter((r) => s(r[0]) !== "")
    .map((r) => ({
      id: s(r[0]),
      name: s(r[1]),
      mission: opt(r[2]),
      leaderId: opt(r[3]),
      note: opt(r[4]),
    }))
    .filter((g) => g.name !== "");

  const schedule: ScheduleItem[] = rows(schedR)
    .filter((r) => s(r[0]) !== "")
    .map((r) => ({
      id: s(r[0]),
      date: s(r[1]),
      start: opt(r[2]),
      end: opt(r[3]),
      scope: oneOf(r[4], ["全体", "グループ", "個人"] as const, "全体"),
      targetId: opt(r[5]),
      title: s(r[6]),
      place: opt(r[7]),
      note: opt(r[8]),
    }))
    .filter((e) => e.date !== "" && e.title !== "");

  const bookings: Booking[] = rows(bookR)
    .filter((r) => s(r[0]) !== "")
    .map((r) => ({
      id: s(r[0]),
      memberId: s(r[1]),
      type: oneOf(r[2], ["ホテル", "飛行機", "新幹線", "レンタカー", "その他"] as const, "その他"),
      startDate: s(r[3]),
      endDate: opt(r[4]),
      name: s(r[5]),
      detail: opt(r[6]),
      confNo: opt(r[7]),
      status: oneOf(r[8], ["予約済", "仮予約", "キャンセル"] as const, "仮予約"),
      note: opt(r[9]),
    }))
    .filter((b) => b.startDate !== "" && b.name !== "");

  const supplies: Supply[] = rows(supplyR)
    .filter((r) => s(r[0]) !== "")
    .map((r) => ({
      id: s(r[0]),
      lotNo: opt(r[1]),
      item: s(r[2]),
      category: opt(r[3]),
      qty: opt(r[4]),
      unit: opt(r[5]),
      from: opt(r[6]),
      toShelterId: opt(r[7]),
      status: oneOf(r[8], ["手配中", "輸送中", "到着", "配布済"] as const, "手配中"),
      shipDate: opt(r[9]),
      arriveDate: opt(r[10]),
      requestId: opt(r[11]),
      note: opt(r[12]),
    }))
    .filter((x) => x.item !== "");

  const requests: SupportRequest[] = rows(reqR)
    .filter((r) => s(r[0]) !== "")
    .map((r) => ({
      id: s(r[0]),
      date: s(r[1]),
      shelterId: opt(r[2]),
      content: s(r[3]),
      qty: opt(r[4]),
      urgency: oneOf(r[5], ["高", "中", "低"] as const, "中"),
      status: oneOf(r[6], ["受付", "手配中", "対応済"] as const, "受付"),
      note: opt(r[7]),
    }))
    .filter((x) => x.content !== "");

  const shelters: Shelter[] = rows(shelterR)
    .filter((r) => s(r[0]) !== "")
    .map((r) => ({
      id: s(r[0]),
      name: s(r[1]),
      type: opt(r[2]),
      address: opt(r[3]),
      mapUrl: opt(r[4]),
      contactName: opt(r[5]),
      phone: opt(r[6]),
      capacity: opt(r[7]),
      current: opt(r[8]),
      needs: opt(r[9]),
      status: oneOf(r[10], ["開設", "閉鎖"] as const, "開設"),
      note: opt(r[11]),
    }))
    .filter((x) => x.name !== "");

  const contacts: Contact[] = rows(contactR)
    .filter((r) => s(r[0]) !== "")
    .map((r) => ({
      id: s(r[0]),
      org: s(r[1]),
      name: opt(r[2]),
      role: opt(r[3]),
      category: opt(r[4]),
      phone: opt(r[5]),
      email: opt(r[6]),
      shelterId: opt(r[7]),
      note: opt(r[8]),
    }))
    .filter((x) => x.org !== "");

  // A:L = id, datetime, kind, reporter, shelter_id, title, content, tags, source,
  //       visibility, author_id, created_at
  // 「共有」以外（下書き・プライベート）は作成者本人にだけ返す（サーバ側で除外）。
  const logs: LogEntry[] = rows(logR)
    .filter((r) => s(r[0]) !== "")
    .map((r) => ({
      id: s(r[0]),
      datetime: s(r[1]),
      kind: oneOf(r[2], ["ヒアリング", "時系列", "指示・決定", "申し送り"] as const, "時系列"),
      reporter: opt(r[3]),
      shelterId: opt(r[4]),
      title: s(r[5]),
      content: opt(r[6]),
      tags: opt(r[7]),
      source: opt(r[8]),
      visibility: oneOf(r[9], ["共有", "下書き", "プライベート"] as const, "共有"),
      authorId: opt(r[10]),
      createdAt: opt(r[11]),
    }))
    .filter((x) => x.datetime !== "" && x.title !== "")
    .filter((x) => x.visibility === "共有" || (viewer !== null && x.authorId === viewer.id));

  // A:D = id, ref_ids(カンマ区切り), mime, seq。チャンク行(seq>1)は索引に含めない。
  const images: ImageIndex[] = imageRows
    .filter((r) => s(r[0]) !== "" && (s(r[3]) === "" || s(r[3]) === "1"))
    .map((r) => ({
      id: s(r[0]),
      refIds: s(r[1])
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      mime: s(r[2]) || "image/jpeg",
    }));

  return {
    disasterName: meta.get("disaster_name") ?? "",
    hq: meta.get("hq") ?? "",
    basisDate: todayKeyJST(),
    currentMemberId: viewer?.id,
    currentMemberName: viewer?.name,
    members,
    groups,
    schedule,
    bookings,
    supplies,
    requests,
    shelters,
    contacts,
    logs,
    images,
    source: "sheets",
  };
}

/** 添付画像1件を復元して返す（base64 チャンクを seq 順に連結）。表示 API 用。 */
export async function getReliefImage(
  imageId: string,
): Promise<{ mime: string; base64: string } | null> {
  const spreadsheetId = await activeSheetId();
  if (!hasSheetsCreds() || !spreadsheetId) return null;
  try {
    const sheets = sheetsClient("read");
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "images!A2:E",
    });
    const rows = ((r.data.values ?? []) as unknown[][])
      .map((row) => (row ?? []).map((c) => String(c ?? "")))
      .filter((row) => row[0]?.trim() === imageId.trim());
    if (!rows.length) return null;
    rows.sort((a, b) => Number(a[3] || 1) - Number(b[3] || 1));
    return {
      mime: rows[0][2]?.trim() || "image/jpeg",
      base64: rows.map((row) => row[4] ?? "").join(""),
    };
  } catch {
    return null;
  }
}
