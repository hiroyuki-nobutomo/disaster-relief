// マルチテナント（ID でプロジェクト＝対象 Google Sheet を切り替える）の中核。
//
// 設計:
//  - プロジェクト定義は環境変数 PROJECTS（JSON）で管理する。
//      PROJECTS={"AI-BCP":{"sheetId":"...","passwordHash":"..."},"ASC":{...}}
//    （id をログインIDとして打鍵 → 対応する Google Sheet を開く）。
//  - パスワードは平文で持たず、AUTH_SECRET を鍵にした HMAC-SHA256 のハッシュで保存・照合する。
//  - ログイン後は署名付きセッショントークン（HMAC）を Cookie に入れて以降の認証に使う。
//
// このモジュールは middleware（Edge）と通常のサーバ（Node）の両方から読み込まれるため、
// next/headers や node:crypto に依存せず、Web Crypto（globalThis.crypto.subtle）のみで実装する。

export const SESSION_COOKIE = "pm_session";
// セッション有効期限（12時間）。
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type ProjectConfig = { sheetId: string; passwordHash: string };

/** PROJECTS（JSON）をパースして返す。未設定・不正は空オブジェクト。 */
export function getProjects(): Record<string, ProjectConfig> {
  const raw = process.env.PROJECTS;
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? (obj as Record<string, ProjectConfig>) : {};
  } catch {
    return {};
  }
}

/** PROJECTS が設定されていればマルチテナント（要ログイン）モード。 */
export function isMultiTenant(): boolean {
  return Object.keys(getProjects()).length > 0;
}

/** ID をプロジェクト定義に照合（大文字小文字を無視）。見つかれば正規化キー付きで返す。 */
export function findProject(id: string): ({ id: string } & ProjectConfig) | null {
  const want = id.trim().toLowerCase();
  if (!want) return null;
  for (const [key, v] of Object.entries(getProjects())) {
    if (key.trim().toLowerCase() === want && v && typeof v.sheetId === "string") {
      return { id: key, sheetId: v.sheetId, passwordHash: v.passwordHash };
    }
  }
  return null;
}

function authSecret(): string {
  return process.env.AUTH_SECRET ?? "";
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

/** 文字列の定数時間比較（長さが違えば即 false だが分岐タイミングは漏らさない）。 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** パスワードのハッシュ（AUTH_SECRET を鍵にした HMAC）。設定スクリプトと同じ実装。 */
export async function hashPassword(password: string): Promise<string> {
  return hmac(authSecret(), `pw:${password}`);
}

/** ID＋パスワードを照合し、成功なら正規化済みプロジェクトIDを返す。 */
export async function verifyCredentials(id: string, password: string): Promise<string | null> {
  const p = findProject(id);
  if (!p || !p.passwordHash) return null;
  const h = await hashPassword(password);
  return timingSafeEqual(h, p.passwordHash) ? p.id : null;
}

/** プロジェクトID から署名付きセッショントークンを発行する。 */
export async function signSession(id: string): Promise<string> {
  const payload = bytesToB64url(
    encoder.encode(JSON.stringify({ id, exp: Date.now() + SESSION_TTL_MS })),
  );
  const sig = await hmac(authSecret(), payload);
  return `${payload}.${sig}`;
}

/** セッショントークンを検証し、正しければプロジェクトID を返す。失効・改竄は null。 */
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
    // 署名が有効でも、設定から消えた（無効化した）プロジェクトは拒否する。
    return findProject(obj.id) ? obj.id : null;
  } catch {
    return null;
  }
}
