// シート列定義（lib/relief/schema.ts）と docs/seed/*.csv のヘッダーが一致するかを検証する。
// 列を増減・並べ替えしたら必ず実行する:
//   npm run check:schema
// （Node 22.6+ の型ストリップ実行を使うため、npm script 経由での実行を前提とする）

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SHEETS, headers } from "../lib/relief/schema.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;

for (const def of Object.values(SHEETS)) {
  const csvPath = join(root, "docs", "seed", `${def.name}.csv`);
  let firstLine: string;
  try {
    firstLine = readFileSync(csvPath, "utf8").split(/\r?\n/, 1)[0] ?? "";
  } catch {
    console.error(`NG ${def.name}: docs/seed/${def.name}.csv がありません`);
    failed++;
    continue;
  }
  const want = headers(def).join(",");
  if (firstLine.trim() !== want) {
    console.error(
      `NG ${def.name}: ヘッダー不一致\n  schema: ${want}\n  csv   : ${firstLine.trim()}`,
    );
    failed++;
  } else {
    console.log(`OK ${def.name}`);
  }
}

if (failed > 0) {
  console.error(
    `\n${failed} 件のズレがあります。lib/relief/schema.ts と docs/seed/*.csv を揃えてください。`,
  );
  process.exit(1);
}
console.log("\nすべて一致しています。");
