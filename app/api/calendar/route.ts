import {
  addEvent,
  updateEvent,
  deleteEvent,
  addMilestone,
  updateTask,
  deleteTask,
  hasWriteCreds,
} from "@/lib/sheets-write";

// カレンダー項目（予定 events / 節目 milestone）の Web からの追加・編集・削除。
// PMエージェント（/api/assistant）と同じく lib/sheets-write の検証付き関数のみ経由する。
export const dynamic = "force-dynamic";

type Body = {
  action?: "add" | "update" | "delete";
  kind?: "event" | "milestone";
  row?: number; // event の行番号
  id?: string; // milestone のタスクID
  date?: string; // milestone の日付
  title?: string; // event の内容 / milestone の名称
  startDate?: string; // event の開始日 YYYY-MM-DD
  startTime?: string; // event の開始時刻 HH:MM（任意）
  endDate?: string; // event の終了日 YYYY-MM-DD（任意）
  endTime?: string; // event の終了時刻 HH:MM（任意）
  place?: string; // event の場所（任意）
  url?: string; // event の関連URL（任意）
  note?: string; // event のメモ（任意）
};

export async function POST(req: Request) {
  if (!hasWriteCreds()) {
    return Response.json({ error: "Google Sheet への書き込みが未設定です。" }, { status: 503 });
  }
  const b = (await req.json().catch(() => ({}))) as Body;
  const { action, kind } = b;

  try {
    if (kind === "event") {
      const ev = {
        startDate: String(b.startDate ?? ""),
        startTime: b.startTime,
        endDate: b.endDate,
        endTime: b.endTime,
        title: String(b.title ?? ""),
        place: b.place,
        url: b.url,
        note: b.note,
      };
      if (action === "add") {
        const r = await addEvent(ev);
        return r.ok
          ? Response.json({ ok: true })
          : Response.json({ error: r.error }, { status: 400 });
      }
      if (action === "update") {
        const r = await updateEvent(Number(b.row), ev);
        return r.ok
          ? Response.json({ ok: true })
          : Response.json({ error: r.error }, { status: 400 });
      }
      if (action === "delete") {
        const r = await deleteEvent(Number(b.row));
        return r.ok
          ? Response.json({ ok: true })
          : Response.json({ error: r.error }, { status: 400 });
      }
    }
    if (kind === "milestone") {
      if (action === "add") {
        const r = await addMilestone(String(b.title ?? ""), String(b.date ?? ""));
        return r.ok
          ? Response.json({ ok: true })
          : Response.json({ error: r.error }, { status: 400 });
      }
      if (action === "update") {
        const date = String(b.date ?? "").trim();
        const fields: Record<string, string> = {};
        if (b.title !== undefined) fields.name = String(b.title);
        if (date) {
          fields.start = date;
          fields.end = date;
        }
        const r = await updateTask(String(b.id ?? ""), fields);
        return r.ok
          ? Response.json({ ok: true })
          : Response.json({ error: r.error }, { status: 400 });
      }
      if (action === "delete") {
        const r = await deleteTask(String(b.id ?? ""));
        return r.ok
          ? Response.json({ ok: true })
          : Response.json({ error: r.error }, { status: 400 });
      }
    }
    return Response.json({ error: "不正なリクエストです。" }, { status: 400 });
  } catch (err) {
    console.error("/api/calendar failed:", err);
    return Response.json(
      { error: "更新に失敗しました（サービスアカウントが編集者か確認してください）。" },
      { status: 502 },
    );
  }
}
