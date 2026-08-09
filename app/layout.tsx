import type { Metadata } from "next";
import { Inter, Noto_Sans_JP, Zen_Old_Mincho } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

// 見出し用の明朝体。知的で落ち着いた印象の要（本文は角ゴのまま可読性を優先）。
const zenOldMincho = Zen_Old_Mincho({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-mincho",
  display: "swap",
});

export const metadata: Metadata = {
  title: "disaster-relief — 災害対応 情報管理",
  description:
    "災害対応の現地支援に必要な情報（名簿・スケジュール・予約・物資・避難所・記録）を一元管理するアプリ。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ja"
      className={`${inter.variable} ${notoSansJP.variable} ${zenOldMincho.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
