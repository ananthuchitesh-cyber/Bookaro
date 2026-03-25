import crypto from "crypto";
import { cookies } from "next/headers";
import { getUserDbPool } from "@/lib/postgres";

const SESSION_COOKIE = "bookaro_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

type UserRecord = {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
  created_at: string;
};

type SessionPayload = {
  userId: number;
  fullName: string;
  email: string;
  exp: number;
};

function getAuthSecret() {
  return process.env.AUTH_SECRET || "bookaro-dev-auth-secret";
}

function encodeBase64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value: string) {
  return crypto.createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function buildCookieValue(payload: SessionPayload) {
  const encoded = encodeBase64Url(JSON.stringify(payload));
  const signature = signValue(encoded);
  return `${encoded}.${signature}`;
}

function parseCookieValue(value: string): SessionPayload | null {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  const expected = signValue(encoded);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(encoded)) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function ensureUsersTable() {
  const pool = getUserDbPool();
  if (!pool) {
    throw new Error("User database connection is not configured (USER_DB_URL missing)");
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(lower(email))
  `);

  return pool;
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });

  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;

  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derived) => {
      if (error) reject(error);
      else resolve(derived as Buffer);
    });
  });

  return crypto.timingSafeEqual(Buffer.from(key, "hex"), derivedKey);
}

export async function findUserByEmail(email: string) {
  const pool = await ensureUsersTable();
  const result = await pool.query(
    "SELECT id, full_name, email, password_hash, created_at FROM users WHERE lower(email) = lower($1) LIMIT 1",
    [email]
  );

  return (result.rows[0] as UserRecord | undefined) ?? null;
}

export async function createUser(fullName: string, email: string, password: string) {
  const pool = await ensureUsersTable();
  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash)
     VALUES ($1, lower($2), $3)
     RETURNING id, full_name, email, password_hash, created_at`,
    [fullName, email, passwordHash]
  );

  return result.rows[0] as UserRecord;
}

export async function createSessionCookie(user: Pick<UserRecord, "id" | "full_name" | "email">) {
  const payload: SessionPayload = {
    userId: user.id,
    fullName: user.full_name,
    email: user.email,
    exp: Date.now() + SESSION_TTL_MS,
  };

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, buildCookieValue(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(payload.exp),
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  return parseCookieValue(cookie);
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getAuthenticatedUser() {
  const session = await getSession();
  if (!session) return null;

  const pool = await ensureUsersTable();
  const result = await pool.query(
    "SELECT id, full_name, email, password_hash, created_at FROM users WHERE id = $1 LIMIT 1",
    [session.userId]
  );

  return (result.rows[0] as UserRecord | undefined) ?? null;
}
