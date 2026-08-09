import { PAL } from "@/lib/palette";

export default function SourceNote({ source }: { source?: "sheets" | "seed" }) {
  return (
    <div style={{ color: PAL.slateLt }} className="mt-4 text-xs">
      {source === "seed" ? (
        <span className="inline-flex items-center gap-1.5">
          <span
            style={{
              background: PAL.gold,
              width: 8,
              height: 8,
              borderRadius: 9999,
              display: "inline-block",
            }}
          />
          サンプルデータを表示中（Google Sheets
          未接続）。環境変数を設定すると実データに切り替わります。
        </span>
      ) : (
        <span>
          実データは Google
          Sheets（データ層）から取得し、この画面（Vercel）に描画しています（約60秒で再検証）。
        </span>
      )}
    </div>
  );
}
