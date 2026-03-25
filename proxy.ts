import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Edge-compatible session verification (uses Web Crypto API, no Node modules)

const SESSION_COOKIE = "bookaro_session";

async function getHmacKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET || "bookaro-dev-auth-secret";
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64urlToArrayBuffer(b64: string): ArrayBuffer {
  const base64 = b64.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  const dotIdx = cookieValue.lastIndexOf(".");
  if (dotIdx === -1) return false;

  const encoded = cookieValue.slice(0, dotIdx);
  const sigB64 = cookieValue.slice(dotIdx + 1);

  try {
    const key = await getHmacKey();
    const encoder = new TextEncoder();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlToArrayBuffer(sigB64),
      encoder.encode(encoded)
    );
    if (!valid) return false;

    const payloadJson = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson) as { exp?: number };
    return !!(payload?.exp && payload.exp > Date.now());
  } catch {
    return false;
  }
}

const PROTECTED_PREFIXES = ["/plan", "/results", "/api/plans", "/api/plan", "/api/chat"];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieVal = request.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = await isValidSession(cookieVal);

  if (pathname === "/login" && authenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isProtectedRoute(pathname) && !authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images/).*)"],
};
