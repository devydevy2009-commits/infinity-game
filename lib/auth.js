import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { getSql } from './db.js';

const scrypt = promisify(crypto.scrypt);
const SESSION_COOKIE = 'infinity_session';
const SESSION_DAYS = 30;

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
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
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const index = part.indexOf('=');
    return index === -1 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function sessionCookie(token, maxAge = SESSION_DAYS * 86400) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function createSession(userId) {
  const sql = getSql();
  const token = crypto.randomBytes(32).toString('base64url');
  const hash = tokenHash(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);
  await sql`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (${userId}, ${hash}, ${expiresAt.toISOString()})`;
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
  if (!rows[0]) return null;
  await sql`UPDATE sessions SET last_seen_at = now() WHERE token_hash = ${hash}`;
  return rows[0];
}

export async function destroySession(req) {
  const token = parseCookies(req.headers.cookie || '')[SESSION_COOKIE];
  if (!token) return;
  const sql = getSql();
  await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash(token)}`;
}

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.length > 16_384) throw new Error('Payload too large');
  return raw ? JSON.parse(raw) : {};
}
