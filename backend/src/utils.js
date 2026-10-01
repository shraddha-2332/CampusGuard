import crypto from 'node:crypto';

export function jsonResponse(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export function generateId(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function pick(object, keys) {
  return keys.reduce((result, key) => {
    if (Object.hasOwn(object, key)) result[key] = object[key];
    return result;
  }, {});
}

export function requireString(value, field, max = 300) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new Error(`${field} must be ${max} characters or less.`);
  }
  return trimmed;
}
