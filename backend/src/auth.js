import crypto from 'node:crypto';
import { config } from './config.js';
import { forbidden, unauthorized } from './errors.js';

const TOKEN_TTL_SECONDS = 60 * 15;

function base64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', config.tokenSecret).update(value).digest('base64url');
}

function signaturesMatch(expected, actual) {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && crypto.timingSafeEqual(expectedBytes, actualBytes);
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || '').split(':');
  if (!salt || !expected) return false;
  const actual = hashPassword(password, salt).split(':')[1];
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export function createToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const encoded = base64Url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function createRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyToken(token) {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature || !signaturesMatch(sign(encoded), signature)) {
    throw unauthorized('Invalid authentication token.');
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw unauthorized('Invalid authentication token.');
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw unauthorized('Authentication token expired.');
  }
  return payload;
}

export function getBearerToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice('Bearer '.length);
}

export function requireAuth(context) {
  if (!context.user) throw unauthorized();
  return context.user;
}

export function requireRole(context, allowedRoles) {
  const user = requireAuth(context);
  if (!allowedRoles.includes(user.role)) {
    throw forbidden();
  }
  return user;
}

export function canAccessApplicantRecord(user, ownerEmail) {
  return ['staff', 'admin'].includes(user.role) || user.email === ownerEmail;
}
