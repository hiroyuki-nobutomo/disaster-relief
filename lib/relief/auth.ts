// 担当者ログインの中核（Edge・Node 両対応）。
//
// 設計:
//  - 認証の単位は「担当者」。ID・パスワードは members タブで管理する
//    （A列=id, J列=password。password は平文か、scripts/hash-password.mjs で
//    生成した HMAC ハッシュのどちらでもよい。照合は両対応）。
//  - AUTH_SECRET が設定されているときだけログイン必須になる（未設定はデモ表示）。
//  - ログイン後は署名付きセッショントークン（HMAC）を Cookie に入れる。
//
// middleware（Edge）から読み込まれるため、next/headers や node:crypto に依存せず
// Web Crypto（globalThis.crypto.subtle）のみで実装する。シート照合など Node 専用の
// 処理は lib/relief/auth-server.ts に分離している。

export const SESSION_COOKIE = "relief_session";
// セッション有効期限（3日。現地派遣中に毎日ログインし直さなくて済む長さ）。
export const SESSION_TTL_MS = 3 * 24 * 60 * 60 * 1000;

function authSecret(): string {
  return process.env.AUTH_SECRET ?? "";
}

/** AUTH_SECRET が設定されていればログイン必須モード。 */
export function authEnabled(): boolean {
  return authSecret() !== "";
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, encoder.encode(msg));
  return bytesToB64url(new Uint8Array(sig));
}

/** 文字列の定数時間比較。 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** パスワードのハッシュ（AUTH_SECRET を鍵にした HMAC）。scripts/hash-password.mjs と同じ実装。 */
export async function hashPassword(password: string): Promise<string> {
  return hmac(authSecret(), `pw:${password}`);
}

/** 担当者ID から署名付きセッショントークンを発行する。 */
export async function signSession(memberId: string): Promise<string> {
  const payload = bytesToB64url(
    encoder.encode(JSON.stringify({ id: memberId, exp: Date.now() + SESSION_TTL_MS })),
  );
  const sig = await hmac(authSecret(), payload);
  return `${payload}.${sig}`;
}

/** セッショントークンを検証し、正しければ担当者ID を返す。失効・改竄は null。 */
export async function verifySession(token: string): Promise<string | null> {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(authSecret(), payload);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const obj = JSON.parse(decoder.decode(b64urlToBytes(payload))) as { id?: string; exp?: number };
    if (!obj.id || typeof obj.exp !== "number" || obj.exp < Date.now()) return null;
    return obj.id;
  } catch {
    return null;
  }
}
