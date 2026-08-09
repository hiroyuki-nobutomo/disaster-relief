// プロジェクトのパスワードハッシュを生成する補助スクリプト。
// PROJECTS 環境変数に入れる passwordHash の値をこれで作る。
//
// 使い方:
//   AUTH_SECRET="あなたの長いランダム文字列" node scripts/hash-password.mjs "設定したいパスワード"
//
// 出力された文字列を PROJECTS の passwordHash に貼り付ける。
// 重要: 本番（Vercel）と同じ AUTH_SECRET で生成すること（鍵が違うとログインできない）。

import { webcrypto as crypto } from "node:crypto";

const secret = process.env.AUTH_SECRET ?? "";
const password = process.argv[2];

if (!secret) {
  console.error("エラー: AUTH_SECRET を環境変数で指定してください。");
  process.exit(1);
}
if (!password) {
  console.error('使い方: AUTH_SECRET="..." node scripts/hash-password.mjs "パスワード"');
  process.exit(1);
}

const enc = new TextEncoder();

function bytesToB64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return Buffer.from(s, "binary")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const key = await crypto.subtle.importKey(
  "raw",
  enc.encode(secret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);
const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`pw:${password}`));
console.log(bytesToB64url(new Uint8Array(sig)));
