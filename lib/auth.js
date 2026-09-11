import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { getSql } from './db.js';

const scrypt = promisify(crypto.scrypt);
const SESSION_COOKIE = 'infinity_session';
const SESSION_DAYS = 30;
const MAX_JSON_BYTES = 16_384;

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function decodeCookie(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCookies(header = '') {
  const cookies = {};
  for (const rawPart of String(header).split(';')) {
    const part = rawPart.trim();
    if (!part) continue;
    const index = part.indexOf('=');
    const name = index === -1 ? part : part.slice(0, index);
    const value = index === -1 ? '' : part.slice(index + 1);
    if (name) cookies[name] = decodeCookie(value);
  }
  return cookies;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function validateUsername(value) {
  const username = String(value || '').trim();
  if (username.length < 3 || username.length > 32) return null;
  if (!/^[A-Za-z0-9_.-]+$/.test(username)) return null;
  return { username, usernameNorm: normalizeUsername(username) };
}

export function validatePassword(value) {
  const password = String(value || '');
  if (password.length < 8 || password.length > 128) return null;
  return password;
}

export async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = await scrypt(password, salt, 64);
  return { salt, hash: Buffer.from(derived).toString('hex') };
}

export async function verifyPassword(password, salt, expectedHash) {
  const { hash } = await hashPassword(password, salt);
  const actual = Buffer.from(hash, 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function sessionCookie(token, maxAge = SESSION_DAYS * 86_400) {
  const secure = process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${maxAge}; Priority=High`;
}

export function clearSessionCookie() {
  const secure = process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0; Priority=High`;
}

export async function createSession(userId) {
  const sql = getSql();
  const token = crypto.randomBytes(32).toString('base64url');
  const hash = tokenHash(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400 * 1000);
  await sql`
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES (${userId}, ${hash}, ${expiresAt.toISOString()})`;
  return token;
}

export async function getCurrentUser(req) {
  const token = parseCookies(req.headers.cookie || '')[SESSION_COOKIE];
  if (!token) return null;

  const sql = getSql();
  const hash = tokenHash(token);
  const rows = await sql`
    SELECT u.id, u.username
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hash} AND s.expires_at > now()
    LIMIT 1`;
  return rows[0] || null;
}

export async function destroySession(req) {
  const token = parseCookies(req.headers.cookie || '')[SESSION_COOKIE];
  if (!token) return;
  const sql = getSql();
  await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash(token)}`;
}

export function json(res, status, body, { cacheControl = 'no-store' } = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

export function requestError(res, error, fallbackMessage) {
  const status = Number(error?.statusCode);
  if (status >= 400 && status < 500) return json(res, status, { error: error.message });
  console.error(error);
  return json(res, 500, { error: fallbackMessage });
}

export async function readJson(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) throw httpError(413, 'Payload too large');
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw httpError(400, 'Invalid JSON payload');
  }
}
