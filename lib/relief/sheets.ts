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
import { todayKeyJST } from "@/lib/relief/derive";
import { SHEETS, colLetter, colIndex, dataRange, rowToRecord } from "@/lib/relief/schema";
import { activeSheetId, hasSheetsCreds, sheetsClient } from "@/lib/google-sheets";

// 災害対応データの読み取り層。Google Sheets の各タブを ReliefData に組み立てる。
// 列の並び・取得レンジは lib/relief/schema.ts（単一情報源）から導出し、
// ここでは「文字列レコード → 型付きオブジェクト」への正規化だけを行う。
// 未接続時は SEED を返してローカルでも UI を確認できる。

function opt(t: string): string | undefined {
  return t === "" ? undefined : t;
}

/** 許可値のいずれかに一致すればそれを、しなければ既定値を返す（表記ゆれをUIで壊さない）。 */
function oneOf<T extends string>(t: string, allowed: readonly T[], fallback: T): T {
  return allowed.includes(t as T) ? (t as T) : fallback;
}

/** 取得結果の行群を schema でキー付きレコードに変換（id 空行は除外）。 */
function toRecords(
  def: (typeof SHEETS)[keyof typeof SHEETS],
  rows: unknown[][],
): Record<string, string>[] {
  return rows.map((row) => rowToRecord(def, row)).filter((r) => r[def.columns[0].key] !== "");
}

/** 閲覧者（ログイン中の担当者）。logs の公開範囲フィルタと個人出し分けに使う。 */
export type Viewer = { id: string; name: string } | null;

export async function getReliefData(viewer: Viewer = null): Promise<ReliefData> {
  const spreadsheetId = await activeSheetId();
  if (!hasSheetsCreds() || !spreadsheetId) {
    return { ...RELIEF_SEED, basisDate: todayKeyJST() };
  }

  // 取得順は固定（下の分割代入と対応）。clientHidden 列（members.password）はレンジ外。
  const defs = [
    SHEETS.meta,
    SHEETS.members,
    SHEETS.groups,
    SHEETS.schedule,
    SHEETS.bookings,
    SHEETS.supplies,
    SHEETS.requests,
    SHEETS.shelters,
    SHEETS.contacts,
    SHEETS.logs,
  ];
  const sheets = sheetsClient("read");
  const { data } = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: defs.map((d) => dataRange(d)),
  });
  const [
    metaRows,
    memberRows,
    groupRows,
    schedRows,
    bookRows,
    supplyRows,
    reqRows,
    shelterRows,
    contactRows,
    logRows,
  ] = defs.map((d, i) => toRecords(d, (data.valueRanges?.[i]?.values ?? []) as unknown[][]));

  // 添付画像の索引（images タブ・任意）。本体（data 列）は読まない。
  // タブ未作成でも本体が壊れないよう別取得＋try/catch。
  let imageRows: Record<string, string>[] = [];
  try {
    const ir = await sheets.spreadsheets.values.get({
      spreadsheetId,
      // id〜seq のみ（data 列の手前まで）
      range: `images!A2:${colLetter(colIndex(SHEETS.images, "seq"))}`,
    });
    imageRows = toRecords(SHEETS.images, (ir.data.values ?? []) as unknown[][]);
  } catch {
    imageRows = [];
  }

  const meta = new Map<string, string>();
  metaRows.forEach((r) => meta.set(r.key, r.value));

  const members: Member[] = memberRows
    .map((r) => ({
      id: r.id,
      name: r.name,
      kana: opt(r.kana),
      org: opt(r.org),
      role: opt(r.role),
      groupId: opt(r.groupId),
      phone: opt(r.phone),
      email: opt(r.email),
      note: opt(r.note),
    }))
    .filter((m) => m.name !== "");

  const groups: Group[] = groupRows
    .map((r) => ({
      id: r.id,
      name: r.name,
      mission: opt(r.mission),
      leaderId: opt(r.leaderId),
      note: opt(r.note),
    }))
    .filter((g) => g.name !== "");

  const schedule: ScheduleItem[] = schedRows
    .map((r) => ({
      id: r.id,
      date: r.date,
      start: opt(r.start),
      end: opt(r.end),
      scope: oneOf(r.scope, ["全体", "グループ", "個人"] as const, "全体"),
      targetId: opt(r.targetId),
      title: r.title,
      place: opt(r.place),
      note: opt(r.note),
    }))
    .filter((e) => e.date !== "" && e.title !== "");

  const bookings: Booking[] = bookRows
    .map((r) => ({
      id: r.id,
      memberId: r.memberId,
      type: oneOf(
        r.type,
        ["ホテル", "飛行機", "新幹線", "レンタカー", "その他"] as const,
        "その他",
      ),
      startDate: r.startDate,
      endDate: opt(r.endDate),
      name: r.name,
      detail: opt(r.detail),
      confNo: opt(r.confNo),
      status: oneOf(r.status, ["予約済", "仮予約", "キャンセル"] as const, "仮予約"),
      note: opt(r.note),
    }))
    .filter((b) => b.startDate !== "" && b.name !== "");

  const supplies: Supply[] = supplyRows
    .map((r) => ({
      id: r.id,
      lotNo: opt(r.lotNo),
      item: r.item,
      category: opt(r.category),
      qty: opt(r.qty),
      unit: opt(r.unit),
      from: opt(r.from),
      toShelterId: opt(r.toShelterId),
      status: oneOf(r.status, ["手配中", "輸送中", "到着", "配布済"] as const, "手配中"),
      shipDate: opt(r.shipDate),
      arriveDate: opt(r.arriveDate),
      requestId: opt(r.requestId),
      note: opt(r.note),
    }))
    .filter((x) => x.item !== "");

  const requests: SupportRequest[] = reqRows
    .map((r) => ({
      id: r.id,
      date: r.date,
      shelterId: opt(r.shelterId),
      content: r.content,
      qty: opt(r.qty),
      urgency: oneOf(r.urgency, ["高", "中", "低"] as const, "中"),
      status: oneOf(r.status, ["受付", "手配中", "対応済"] as const, "受付"),
      note: opt(r.note),
    }))
    .filter((x) => x.content !== "");

  const shelters: Shelter[] = shelterRows
    .map((r) => ({
      id: r.id,
      name: r.name,
      type: opt(r.type),
      address: opt(r.address),
      mapUrl: opt(r.mapUrl),
      contactName: opt(r.contactName),
      phone: opt(r.phone),
      capacity: opt(r.capacity),
      current: opt(r.current),
      needs: opt(r.needs),
      status: oneOf(r.status, ["開設", "閉鎖"] as const, "開設"),
      note: opt(r.note),
    }))
    .filter((x) => x.name !== "");

  const contacts: Contact[] = contactRows
    .map((r) => ({
      id: r.id,
      org: r.org,
      name: opt(r.name),
      role: opt(r.role),
      category: opt(r.category),
      phone: opt(r.phone),
      email: opt(r.email),
      shelterId: opt(r.shelterId),
      note: opt(r.note),
    }))
    .filter((x) => x.org !== "");

  // 「共有」以外（下書き・プライベート）は作成者本人にだけ返す（サーバ側で除外）。
  const logs: LogEntry[] = logRows
    .map((r) => ({
      id: r.id,
      datetime: r.datetime,
      kind: oneOf(r.kind, ["ヒアリング", "時系列", "指示・決定", "申し送り"] as const, "時系列"),
      reporter: opt(r.reporter),
      shelterId: opt(r.shelterId),
      title: r.title,
      content: opt(r.content),
      tags: opt(r.tags),
      source: opt(r.source),
      visibility: oneOf(r.visibility, ["共有", "下書き", "プライベート"] as const, "共有"),
      authorId: opt(r.authorId),
      createdAt: opt(r.createdAt),
    }))
    .filter((x) => x.datetime !== "" && x.title !== "")
    .filter((x) => x.visibility === "共有" || (viewer !== null && x.authorId === viewer.id));

  // チャンク行（seq>1）は索引に含めない。
  const images: ImageIndex[] = imageRows
    .filter((r) => r.seq === "" || r.seq === "1")
    .map((r) => ({
      id: r.id,
      refIds: r.refIds
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      mime: r.mime || "image/jpeg",
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
      // id〜data（created_at は不要）
      range: `images!A2:${colLetter(colIndex(SHEETS.images, "data"))}`,
    });
    const rows = ((r.data.values ?? []) as unknown[][])
      .map((row) => rowToRecord(SHEETS.images, row))
      .filter((row) => row.id === imageId.trim());
    if (!rows.length) return null;
    rows.sort((a, b) => Number(a.seq || 1) - Number(b.seq || 1));
    return {
      mime: rows[0].mime || "image/jpeg",
      base64: rows.map((row) => row.data).join(""),
    };
  } catch {
    return null;
  }
}
