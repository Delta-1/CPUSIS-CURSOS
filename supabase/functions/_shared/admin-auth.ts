import { secretKey } from "./common.ts";

const encoder = new TextEncoder();

function base64url(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(normalized);
}

async function signature(value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secretKey()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

export async function issueAdminToken(username: string) {
  const payload = base64url(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 }));
  return `${payload}.${base64url(await signature(payload))}`;
}

export async function verifyAdminToken(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const [payload, supplied] = token.split(".");
  if (!payload || !supplied || !safeEqual(base64url(await signature(payload)), supplied)) return null;
  try {
    const parsed = JSON.parse(decodeBase64url(payload));
    if (!parsed.sub || Number(parsed.exp) <= Math.floor(Date.now() / 1000)) return null;
    return String(parsed.sub);
  } catch {
    return null;
  }
}

export async function passwordMatches(supplied: string, expected: string) {
  const digest = async (value: string) => base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
  return safeEqual(await digest(supplied), await digest(expected));
}

export function adminCors(req: Request) {
  const requestOrigin = req.headers.get("origin") ?? "";
  const configured = Deno.env.get("SITE_URL") ?? "https://delta-1.github.io/CPUSIS-CURSOS";
  const allowedOrigin = new URL(configured).origin;
  return {
    "Access-Control-Allow-Origin": requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Vary": "Origin",
  };
}

export function adminJson(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...adminCors(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
