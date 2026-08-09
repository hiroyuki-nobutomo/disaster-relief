// AIアシスタント（自然言語によるデータ編集）の入口。
//
// 設計方針（ガードレール）:
//  - 触れてよいのは Google Sheet 上の「データ」のみ:
//      tasks（名称・担当・期間・進捗）/ meta（基準日・次回MTG等）/ links（URL）。
//  - 画面のフレーム・レイアウト・計算ロジック（lib/derive.ts 等）・コードは変更しない。
//    → 書き込みは lib/sheets-write.ts の許可関数（検証付き）経由のみ。任意セルや構造は触れない。
//  - 反映方式は「確認してから書き込み」: 変更指示を受けたら、まず対象と新しい値を復唱して
//    確認を求め、ユーザーが明示的に同意した次のターンで初めて書き込みツールを呼ぶ。
//
// 有効化条件: ANTHROPIC_API_KEY と、サービスアカウントの Sheet 書き込み権限（編集者昇格）。
// 未設定時は安全側で「準備中」を返す。

import Anthropic from "@anthropic-ai/sdk";
import {
  updateTask,
  addTask,
  bulkUpdateTaskDates,
  updateMeta,
  updateLink,
  addMilestone,
  addEvent,
  moveTask,
  hasWriteCreds,
  META_KEYS,
  type ScheduleUpdate,
  type MoveTarget,
} from "@/lib/sheets-write";
import { activeSheetId, hasSheetsCreds, sheetsClient } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

type ClientMsg = { role: "user" | "assistant"; text: string };

const SYSTEM = `あなたはプロジェクト管理ダッシュボードの「PMエージェント」です。日本語で簡潔に応答します。

このプロジェクトの作業は 大項目（phase）→ 中項目（activity）→ 小項目（タスク） の3階層で整理され、
小項目（タスク）にはすべて一意のタスクID（例: 1-3＝中項目1の小項目3、M1＝節目）が付与されています。
ガント・予実管理・活動報告はこのIDを軸に管理されており、タスクの特定は必ずIDで行います。

あなたができるのは Google Sheet 上の「データ」の編集だけです:
- tasks: 名称(name)・担当(owner)・開始日(start)・終了日(end)・進捗(progress) を、タスクID(id)で指定して更新
- タスクの新規追加（add_task）: ID・大項目(phase)・中項目(activity)・名称・期間（・担当）を確認のうえ追加できる。IDは既存の体系に合わせて提案し（例: 中項目2の次の小項目なら 2-8）、ユーザーに確認する。ガントにも反映される。
- スケジュール一括変更（update_schedule_bulk）: 複数タスクの開始日・終了日をまとめて変更（「1週間後ろ倒し」等は現在日付から新日付を計算して提示する）。
- meta: project_name / org を更新
- links: 既存ラベルの URL を更新
- カレンダー予定（events）: ミーティング等の予定を1件追加できる（日付・内容）。カレンダーにのみ表示され、ガントチャートには出ない。
- 節目（milestone）: プロジェクトの正式な節目・成果物の締めを1件追加できる（日付・名称）。カレンダーとガントの両方に出る。
- 表示順の変更（move_task）: ガント／一覧の上からの並び（tasks タブの行順）を変更できる。指定タスクを先頭/末尾、または別タスクの直前/直後へ移動する（日付・進捗は変えない）。

できないこと（依頼されても丁寧に断る）:
- 画面レイアウト・デザイン・計算ロジック・コードの変更（ガントチャートの見た目はタスクの日付から自動描画。調整したい場合は日付変更を提案する）
- 行の削除、kind・タスクID・大項目・中項目の変更、列やタブなどシート構造（スキーマ）の変更（※行の並べ替えは move_task で可能）

反映ルール（重要・確認してから書き込み）:
1. 変更の指示を受けたら、まず「何を・どの値に」変えるかを具体的に復唱し、「よろしいですか？」と確認を求める。この時点ではツールを呼ばない。
2. ユーザーが「はい/OK/お願い」等で明確に同意したら、対応する更新ツールを呼ぶ。
3. 一括変更は、対象タスクと新旧日付の一覧を表にして見せてから確認する。同意後に update_schedule_bulk を1回で呼ぶ。
4. 日付は YYYY-MM-DD、進捗は 0〜100%。範囲外や不正な値は書き込まず理由を伝える。日付が曖昧なら具体的な日付を聞き返す。
5. 書き込み後は「反映まで最大1分ほどかかる」ことを添える。
6. 「カレンダーに入れて／予定を入れて」と言われたら、原則 **予定(event)** として扱う。日付と内容を確認し「予定としてカレンダーに追加します（ガントには出ません）。よろしいですか？」と確認してから add_event を呼ぶ。
7. ユーザーが明確に「節目／マイルストーン／成果物の締め」と述べた場合のみ add_milestone を使い、「節目としてカレンダーとガントに追加します。よろしいですか？」と確認する。判断に迷う時は予定か節目かを尋ねる。
8. 右上の「次回ミーティング」は予定(events)のうち今日以降で最も近いものを自動表示する。変更したい場合は該当の予定(event)を add_event で追加する（meta では管理しない）。
9. 後続の system メッセージに現在のタスク一覧が与えられる。タスクの特定（名前→id）や日付計算はそれを根拠に行い、一覧に無いタスクを推測で更新しない。
10. 「順番を変えて／上に／下に／一番上に／○の前(後)に」等の並べ替えは move_task を使う。対象と移動先を復唱して確認し、同意後に呼ぶ。完了後は新しい並び（id の順）を伝える。一覧の順序はこの行順がそのまま表示順。`;

const tools: Anthropic.Tool[] = [
  {
    name: "update_task",
    description:
      "tasks タブの指定タスク（id）の許可フィールドを更新する。ユーザーが確認に同意した後にのみ呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "タスクID（tasks の id 列。例: 1-3）" },
        name: { type: "string", description: "タスクの名称" },
        owner: { type: "string", description: "担当" },
        start: { type: "string", description: "開始日 YYYY-MM-DD" },
        end: { type: "string", description: "終了日 YYYY-MM-DD" },
        progress: { type: "number", description: "進捗 0..1（または 0..100 の%）" },
      },
      required: ["id"],
    },
  },
  {
    name: "add_task",
    description:
      "新しいタスク（kind=task）を tasks タブに1件追加する。ガント・進捗集計にも反映される。id は既存の体系（例: 中項目2の次の小項目なら 2-8）に合わせ、大項目(phase)・中項目(activity)は既存の表記と揃えること。確認同意後にのみ呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "タスクID（一意。例: 2-8）" },
        phase: { type: "string", description: "大項目（既存と同じ表記。例: 大項目1：調査・研究）" },
        activity: {
          type: "string",
          description: "中項目（既存と同じ表記。例: 中項目2：評価研究。任意）",
        },
        name: { type: "string", description: "タスク名" },
        owner: { type: "string", description: "担当（任意）" },
        start: { type: "string", description: "開始日 YYYY-MM-DD" },
        end: { type: "string", description: "終了日 YYYY-MM-DD" },
        progress: { type: "number", description: "進捗 0..1（任意・既定0）" },
      },
      required: ["id", "phase", "name", "start", "end"],
    },
  },
  {
    name: "update_schedule_bulk",
    description:
      "複数タスクの開始日・終了日を一括変更する。全件検証し1件でも不正なら何も書き込まない。新旧日付の一覧を提示しユーザーが同意した後にのみ呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        updates: {
          type: "array",
          description: "変更一覧（最大50件）",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "タスクID" },
              start: { type: "string", description: "新しい開始日 YYYY-MM-DD（変更時のみ）" },
              end: { type: "string", description: "新しい終了日 YYYY-MM-DD（変更時のみ）" },
            },
            required: ["id"],
          },
        },
      },
      required: ["updates"],
    },
  },
  {
    name: "update_meta",
    description: "meta タブの許可キー（project_name/org）を更新する。確認同意後にのみ呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", enum: [...META_KEYS] },
        value: { type: "string" },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "update_link",
    description: "links タブの既存ラベルの URL を更新する。確認同意後にのみ呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string", description: "既存の資料リンクのラベル" },
        url: { type: "string", description: "新しい URL" },
      },
      required: ["label", "url"],
    },
  },
  {
    name: "add_event",
    description:
      "カレンダー予定（ミーティング等）を events タブに1件追加する。カレンダーのみに表示されガントには出ない。「カレンダーに入れて／予定を入れて」は原則これを使う。時刻を指定すると週表示で時間ブロックになる（省略すると終日）。日をまたぐ予定は end_date を指定する。確認同意後にのみ呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "予定の内容（名称）" },
        start_date: { type: "string", description: "開始日 YYYY-MM-DD" },
        start_time: { type: "string", description: "開始時刻 HH:MM（任意・終日なら省略）" },
        end_date: {
          type: "string",
          description: "終了日 YYYY-MM-DD（任意・省略時は開始日と同じ）",
        },
        end_time: { type: "string", description: "終了時刻 HH:MM（任意・終日なら省略）" },
        place: { type: "string", description: "場所（任意）" },
        url: { type: "string", description: "関連URL（任意）" },
        note: { type: "string", description: "メモ（任意）" },
      },
      required: ["title", "start_date"],
    },
  },
  {
    name: "add_milestone",
    description:
      "プロジェクトの正式な節目(milestone)を tasks に1件追加する。カレンダーとガントの両方に表示される。ユーザーが『節目／マイルストーン』と明確に述べ確認・同意した後にのみ呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "節目の名称" },
        date: { type: "string", description: "日付 YYYY-MM-DD" },
      },
      required: ["name", "date"],
    },
  },
  {
    name: "move_task",
    description:
      "ガント／一覧の上からの表示順（tasks タブの行順）を変更する。指定タスク(id)を、先頭(top)・末尾(bottom)、または別タスク(ref_id)の直前(before)・直後(after)へ移動する。日付や進捗は変えず並びだけ変更する。確認同意後にのみ呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "移動するタスクID" },
        position: {
          type: "string",
          enum: ["top", "bottom", "before", "after"],
          description:
            "移動先: top=先頭 / bottom=末尾 / before=ref_id の直前 / after=ref_id の直後",
        },
        ref_id: {
          type: "string",
          description: "position が before/after のときの基準タスクID",
        },
      },
      required: ["id", "position"],
    },
  },
];

async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    if (name === "update_task") {
      const { id, ...fields } = input as { id: string } & Record<string, unknown>;
      const r = await updateTask(String(id), fields);
      return r.ok
        ? `OK: タスク${id} を更新（${Object.entries(r.applied)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}）`
        : `失敗: ${r.error}`;
    }
    if (name === "add_task") {
      const f = input as {
        id?: string;
        phase?: string;
        activity?: string;
        name?: string;
        owner?: string;
        start?: string;
        end?: string;
        progress?: number;
      };
      const r = await addTask({
        id: String(f.id ?? ""),
        phase: String(f.phase ?? ""),
        activity: f.activity === undefined ? undefined : String(f.activity),
        name: String(f.name ?? ""),
        owner: f.owner === undefined ? undefined : String(f.owner),
        start: String(f.start ?? ""),
        end: String(f.end ?? ""),
        progress: f.progress,
      });
      return r.ok ? `OK: タスク「${f.name}」を追加（id=${r.id}）` : `失敗: ${r.error}`;
    }
    if (name === "update_schedule_bulk") {
      const ups = Array.isArray(input.updates) ? (input.updates as ScheduleUpdate[]) : [];
      const r = await bulkUpdateTaskDates(ups);
      return r.ok
        ? `OK: ${r.applied.length}件を一括更新（${r.applied.join(" / ")}）`
        : `失敗: ${r.error}`;
    }
    if (name === "update_meta") {
      const r = await updateMeta(String(input.key), String(input.value ?? ""));
      return r.ok ? `OK: meta.${input.key} を更新` : `失敗: ${r.error}`;
    }
    if (name === "update_link") {
      const r = await updateLink(String(input.label), String(input.url ?? ""));
      return r.ok ? `OK: リンク「${input.label}」のURLを更新` : `失敗: ${r.error}`;
    }
    if (name === "add_event") {
      const sd = String(input.start_date ?? "");
      const st = input.start_time === undefined ? undefined : String(input.start_time);
      const ed = input.end_date === undefined ? undefined : String(input.end_date);
      const et = input.end_time === undefined ? undefined : String(input.end_time);
      const r = await addEvent({
        startDate: sd,
        startTime: st,
        endDate: ed,
        endTime: et,
        title: String(input.title ?? ""),
        place: input.place === undefined ? undefined : String(input.place),
        url: input.url === undefined ? undefined : String(input.url),
        note: input.note === undefined ? undefined : String(input.note),
      });
      const span = ed && ed !== sd ? `${sd}〜${ed}` : sd;
      const when = st && et ? `${span} ${st}–${et}` : span;
      return r.ok
        ? `OK: カレンダーに予定「${input.title}」を追加（${when}・ガントには出ません）`
        : `失敗: ${r.error}`;
    }
    if (name === "add_milestone") {
      const r = await addMilestone(String(input.name ?? ""), String(input.date ?? ""));
      return r.ok
        ? `OK: 節目「${input.name}」を追加（id=${r.id}・カレンダーとガントに表示）`
        : `失敗: ${r.error}`;
    }
    if (name === "move_task") {
      const id = String(input.id ?? "").trim();
      const position = String(input.position ?? "");
      let target: MoveTarget;
      if (position === "before" || position === "after") {
        const refId = String(input.ref_id ?? "").trim();
        if (!refId) {
          return "失敗: before/after には ref_id（基準タスクID）が必要です。";
        }
        target = { position, refId };
      } else if (position === "top" || position === "bottom") {
        target = { position };
      } else {
        return "失敗: position は top/bottom/before/after のいずれかです。";
      }
      const r = await moveTask(id, target);
      return r.ok ? `OK: 表示順を変更（新しい並び: ${r.order.join(" → ")}）` : `失敗: ${r.error}`;
    }
    return `失敗: 未知のツール ${name}`;
  } catch (e) {
    console.error("tool error", name, e);
    return `失敗: 書き込み中にエラー（サービスアカウントが編集者か、シート権限を確認）`;
  }
}

/** 現在のタスク一覧を system 用の軽量テキストにする（特定・日程計算の根拠）。 */
async function readTaskContext(): Promise<string> {
  if (!hasSheetsCreds()) return "（タスク一覧は未取得）";
  const spreadsheetId = await activeSheetId();
  if (!spreadsheetId) return "（タスク一覧は未取得）";
  try {
    const sheets = sheetsClient("read");
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "tasks!A2:I",
    });
    const lines = (r.data.values ?? [])
      .filter((row) => row && String(row[0] ?? "").trim() !== "")
      .slice(0, 200)
      .map((row) =>
        [
          `id=${String(row[0]).trim()}`,
          String(row[3] ?? "task").trim(),
          `[${String(row[1] ?? "").trim()}${String(row[2] ?? "").trim() ? " / " + String(row[2]).trim() : ""}]`,
          String(row[4] ?? "").trim(),
          `${String(row[6] ?? "").trim()}〜${String(row[7] ?? "").trim()}`,
          `担当:${String(row[5] ?? "").trim() || "-"}`,
          `進捗:${String(row[8] ?? "").trim() || "0"}`,
        ].join(" | "),
      );
    return `現在のタスク一覧（id | kind | [大項目 / 中項目] | name | start〜end | 担当 | 進捗0..1）:\n${lines.join("\n")}`;
  } catch {
    return "（タスク一覧の取得に失敗。id の特定はユーザーに確認すること）";
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // 後方互換: 単発 {message} でも、履歴 {messages:[{role,text}]} でも受ける。
  // クライアント由来の値なので、role/text を検証して不正・空の要素は落とす。
  const raw: unknown[] = Array.isArray(body?.messages)
    ? body.messages
    : typeof body?.message === "string"
      ? [{ role: "user", text: body.message }]
      : [];
  const history: ClientMsg[] = raw.filter(
    (m): m is ClientMsg =>
      typeof m === "object" &&
      m !== null &&
      ((m as ClientMsg).role === "user" || (m as ClientMsg).role === "assistant") &&
      typeof (m as ClientMsg).text === "string" &&
      (m as ClientMsg).text.trim() !== "",
  );

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({
      reply:
        "（準備中）PMエージェントはまだ有効化されていません。\n" +
        "有効化には次が必要です：\n" +
        "・ANTHROPIC_API_KEY の設定\n" +
        "・Google Sheet への書き込み権限（サービスアカウントを「編集者」に昇格）\n" +
        "設定が済むと、ここでデータ（タスク・基準日・リンク等）の編集を指示できます。",
    });
  }
  if (!hasWriteCreds()) {
    return Response.json({
      reply:
        "（設定未完了）Google Sheet の接続情報が未設定のため書き込めません。\n" +
        "GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / SHEET_ID を設定し、" +
        "サービスアカウントを対象シートの「編集者」にしてください。",
    });
  }
  if (history.length === 0) {
    return Response.json({ reply: "ご用件を入力してください（例：タスク1-3の進捗を50%に）。" });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.text,
  }));

  // 現在のタスク一覧（タスク特定・日程計算の根拠）。静的プロンプトと分けてキャッシュを保つ。
  const taskContext = await readTaskContext();

  try {
    // tool use ループ。確認後の同意ターンでのみモデルがツールを呼ぶ想定。
    for (let i = 0; i < 4; i++) {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: [
          { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
          { type: "text", text: taskContext },
        ],
        tools,
        messages,
      });

      if (res.stop_reason !== "tool_use") {
        const text = res.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return Response.json({ reply: text || "（応答がありません）" });
      }

      // ツール実行 → 結果を会話に戻して継続。
      messages.push({ role: "assistant", content: res.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type === "tool_use") {
          const out = await runTool(block.name, block.input as Record<string, unknown>);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: out,
          });
        }
      }
      // tool_use 宣言なのにツールブロックが無い異常時は、空の user ターンを送らず打ち切る。
      if (toolResults.length === 0) break;
      messages.push({ role: "user", content: toolResults });
    }
    return Response.json({ reply: "処理が長くなりすぎました。指示を分けて再度お試しください。" });
  } catch (err) {
    console.error("/api/assistant failed:", err);
    return Response.json(
      { reply: "アシスタントの処理中にエラーが発生しました。時間をおいて再度お試しください。" },
      { status: 500 },
    );
  }
}
