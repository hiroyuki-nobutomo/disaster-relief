// Flat config (ESLint 9). Next.js 16 の eslint-config-next はネイティブで
// flat config 配列をエクスポートするため、そのまま spread して合成する。
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
// 整形系ルールを無効化（Prettier と競合させない）。必ず最後に置く。
import prettier from "eslint-config-prettier/flat";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  // next/typescript 側に .next/** out/** build/** next-env.d.ts の ignore を含む
  ...nextCoreWebVitals,
  ...nextTypeScript,
  prettier,
];

export default config;
