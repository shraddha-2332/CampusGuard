import http from 'node:http';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { askWithHistory, getConversation, listConversations } from './conversations.js';
import { createRefreshToken, createToken, getBearerToken, hashPassword, hashToken, requireAuth, requireRole, verifyPassword, verifyToken, canAccessApplicantRecord } from './auth.js';
import { badRequest, forbidden, HttpError, notFound, tooManyRequests, unauthorized } from './errors.js';
import { getDb, loadDb, saveDb } from './store.js';
import { generateId, jsonResponse, nowIso, pick, requireString } from './utils.js';

const publicRoutes = new Set(['GET /api/health', 'POST /api/auth/login', 'POST /api/auth/signup', 'POST /api/auth/refresh', 'POST /api/auth/logout']);
const allowedRoles = ['applicant', 'parent', 'staff', 'admin'];
const authAttempts = new Map();
const assistantAttempts = new Map();
const uploadDir = path.resolve(process.cwd(), 'uploads');
const officialSourceDir = path.resolve(process.cwd(), 'official-sources');
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const allowedOfficialMimeTypes = new Set([
  ...allowedMimeTypes,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]);
const extensionByMimeType = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
};

export function resetRuntimeStateForTests() {
  authAttempts.clear();
  assistantAttempts.clear();
}
const assistantRules = [
  { match: ['direct admission', 'management quota', 'acap', 'institute level', 'institute-level', 'vacancy'], source: 'Institute-level admission notices', answer: 'Institute-level and ACAP admission follow the published schedule, merit list, vacancy notice, and applicable rules. They are separate from a CAP allotment and cannot guarantee a seat before the current notice is checked.', next: 'Open the ACAP notice and check the current schedule, merit list, and vacancy record.', actionView: 'cap', actionLabel: 'Check ACAP notices' },
  { match: ['cutoff', 'cut-off', 'closing percentile', 'closing rank'], source: 'Historical cutoff records', answer: 'Cutoffs must be matched by academic year, round, branch, exam, category, seat type, and candidature. Historical values support preference planning but do not guarantee current admission.', next: 'Specify the year, CAP round, branch, category, seat type, and whether the score is MHT-CET or JEE.', actionView: 'cap', actionLabel: 'Check CAP history' },
  { match: ['eligible', 'eligibility', 'percentile', 'cse', 'computer science'], source: 'Engineering eligibility and branch allotment guidance', answer: 'A CET or JEE percentile alone cannot confirm CSE admission. Basic eligibility and branch allotment are separate checks.', next: 'Share your category, candidature, qualifying-examination subjects and marks, admission route, and CAP round for a more useful assessment.', actionView: 'programs', actionLabel: 'Check programs' },
  { match: ['document', 'certificate', 'upload', 'validity', 'marksheet'], source: 'Document workflow', answer: 'Upload documents against the checklist. Staff can mark each record as ready or needing correction before reporting.', next: 'Open document checklist and upload the matching file.', actionView: 'documents', actionLabel: 'Open documents' },
  { match: ['cap', 'allotment', 'freeze', 'betterment', 'reporting'], source: 'Admission CAP workflow', answer: 'Use the CAP workflow to identify your current round, freeze/betterment choice, and reporting readiness before travelling.', next: 'Open CAP tracker and complete the reporting readiness checklist.', actionView: 'cap', actionLabel: 'Open CAP tracker' },
  { match: ['fee', 'fees', 'payment', 'amount', 'installment'], source: 'Fee planner', answer: 'Use the fee planner to estimate academic, hostel, and mess amount by admission type and category.', next: 'Open fee planner and verify scholarship/category documents before payment.', actionView: 'fees', actionLabel: 'Open fee planner' },
  { match: ['scholarship', 'ebc', 'ews', 'tfws', 'income', 'concession'], source: 'Scholarship readiness', answer: 'Scholarship fit depends on category, income, admission route, and required proof. Prepare documents before reporting.', next: 'Open scholarship readiness and check likely routes.', actionView: 'scholarships', actionLabel: 'Open scholarship' },
  { match: ['branch', 'program', 'course', 'choice code', 'preference'], source: 'Program finder', answer: 'Compare branches and build a draft preference order before CAP option form or institute-level discussion.', next: 'Open program finder and create preference draft.', actionView: 'programs', actionLabel: 'Open programs' },
  { match: ['placement', 'company', 'career', 'package'], source: 'Career outcome guidance', answer: 'Placement data should support branch decision, but does not guarantee outcome. Check branch-goal fit and preparation path.', next: 'Open placement readiness.', actionView: 'placements', actionLabel: 'Open placement' },
  { match: ['hostel', 'mess', 'room', 'bus', 'transport', 'stay'], source: 'Hostel and mess planning', answer: 'Estimate stay cost and confirm room availability, mess charges, transport route, and rules before travelling.', next: 'Open hostel and mess estimator.', actionView: 'visit', actionLabel: 'Open hostel & mess' },
];

function normalizeIntentText(text) {
  const aliases = [
    [/seat\s*matrix|seats?\s+and\s+intake|\u091c\u093e\u0917\u093e\s+\u0906\u0923\u093f\s+\u092a\u094d\u0930\u0935\u0947\u0936\s+\u0915\u094d\u0937\u092e\u0924\u093e|\u0938\u0940\u091f\s*\u092e\u0948\u091f\u094d\u0930\u093f\u0915\u094d\u0938|\u0907\u0902\u091f\u0947\u0915/giu, ' seat matrix '],
    [/\u0905\u092d\u094d\u092f\u093e\u0938\u0915\u094d\u0930\u092e|\u092a\u093e\u0920\u094d\u092f\u0915\u094d\u0930\u092e/giu, ' program '],
    [/\u0924\u093e\u0930\u0916\u093e|\u092e\u0941\u0926\u0924|\u0924\u093f\u0925\u093f\u092f\u093e\u0902|\u0905\u0902\u0924\u093f\u092e\s*\u0938\u092e\u092f/giu, ' deadline '],
    [/\u092a\u093e\u0924\u094d\u0930\u0924\u093e|\u092a\u093e\u0924\u094d\u0930|\u092f\u094b\u0917\u094d\u092f/giu, ' eligible '],
    [/\u0915\u091f\u0911\u092b|\u0915\u091f\u0905\u092b/giu, ' cutoff '],
    [/\u091f\u0915\u094d\u0915\u0947\u0935\u093e\u0930\u0940|\u092a\u094d\u0930\u0924\u093f\u0936\u0924/giu, ' percentile '],
    [/\u092a\u094d\u0930\u0935\u0947\u0936|\u0926\u093e\u0916\u0932\u093e/giu, ' admission '],
    [/\u0915\u093e\u0917\u0926\u092a\u0924\u094d\u0930\u0947?|\u0926\u0938\u094d\u0924\u093e\u0935\u0947\u091c/giu, ' document '],
    [/\u0936\u093f\u0937\u094d\u092f\u0935\u0943\u0924\u094d\u0924\u0940|\u091b\u093e\u0924\u094d\u0930\u0935\u0943\u0924\u094d\u0924\u093f/giu, ' scholarship '],
    [/\u0936\u0941\u0932\u094d\u0915|\u092b\u0940\u0938/giu, ' fee '],
    [/\u0935\u0938\u0924\u093f\u0917\u0943\u0939|\u091b\u093e\u0924\u094d\u0930\u093e\u0935\u093e\u0938/giu, ' hostel '],
    [/\u092a\u094d\u0932\u0947\u0938\u092e\u0947\u0902\u091f|\u0928\u094c\u0915\u0930\u0940/giu, ' placement '],
    [/\u092c\u0938|\u092a\u0930\u093f\u0935\u0939\u0928/giu, ' bus transport '],
    [/\u0938\u0902\u092a\u0930\u094d\u0915|\u092b\u094b\u0928|\u092a\u0924\u094d\u0924\u093e/giu, ' contact '],
    [/\u0924\u093e\u0930\u0940\u0916|\u0905\u0902\u0924\u093f\u092e\s*\u0924\u093e\u0930\u0940\u0916/giu, ' deadline '],
    [/पात्रता|पात्र|योग्य|eligibility|eligible|yogya|patra/giu, ' eligible '],
    [/कट\s?ऑफ|कटऑफ|cut\s?off/giu, ' cutoff '],
    [/टक्केवारी|प्रतिशत|percentile|percent/giu, ' percentile '],
    [/प्रवेश|दाखला|admission|admission milel|admission milega/giu, ' admission '],
    [/कागदपत्रे?|दस्तावेज|documents?|papers?/giu, ' document '],
    [/शिष्यवृत्ती|छात्रवृत्ति|scholarship/giu, ' scholarship '],
    [/शुल्क|फी|fees?/giu, ' fee '],
    [/वसतिगृह|छात्रावास|hostel/giu, ' hostel '],
    [/प्लेसमेंट|नोकरी|placement|job/giu, ' placement '],
    [/संगणक\s?अभियांत्रिकी|कंप्यूटर\s?साइंस|computer\s?science|cse/giu, ' cse computer science '],
    [/जागा|सीटें|seats?|intake/giu, ' seat intake '],
    [/फेरी|राउंड|round/giu, ' round '],
    [/seat\s+(?:intake\s+)?matrix/giu, ' seat matrix '],
  ];
  return aliases.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), String(text || '').normalize('NFKC').toLocaleLowerCase());
}

function audit(action, resourceType, resourceId, user, details = '') {
  const db = getDb();
  db.auditLogs = db.auditLogs || [];
  db.auditLogs.unshift({
    id: generateId('AUD'),
    actorEmail: user?.email || 'anonymous',
    actorRole: user?.role || 'anonymous',
    action,
    resourceType,
    resourceId,
    details,
    createdAt: nowIso(),
  });
  db.auditLogs = db.auditLogs.slice(0, 500);
  saveDb();
}

function enforceRateLimit(bucket, key, maxRequests, windowMs) {
  const now = Date.now();
  const recent = (bucket.get(key) || []).filter((timestamp) => timestamp > now - windowMs);
  if (recent.length >= maxRequests) throw tooManyRequests();
  recent.push(now);
  bucket.set(key, recent);
}

function routeKey(req) {
  return `${req.method} ${new URL(req.url, 'http://localhost').pathname}`;
}

async function readJson(req) {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return {};
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > config.maxBodyBytes) throw badRequest('Request body is too large.');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw badRequest('Request body must be valid JSON.');
  }
}

async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > config.maxBodyBytes) throw badRequest('Request body is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sanitizeFileName(fileName) {
  return path.basename(String(fileName || 'upload.bin')).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function fileHasExpectedSignature(file) {
  const extension = path.extname(file.filename).toLowerCase();
  if (!extensionByMimeType[file.mimeType]?.includes(extension)) return false;
  if (file.mimeType === 'application/pdf') return file.content.subarray(0, 5).toString('ascii') === '%PDF-';
  if (file.mimeType === 'image/jpeg') return file.content.length >= 3 && file.content[0] === 0xff && file.content[1] === 0xd8 && file.content[2] === 0xff;
  if (file.mimeType === 'image/png') return file.content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimeType.includes('openxmlformats')) return file.content.subarray(0, 2).equals(Buffer.from('PK'));
  return true;
}

function assertAllowedUpload(file, allowedTypes, message) {
  if (!file) throw badRequest('A file is required.');
  if (!allowedTypes.has(file.mimeType) || !fileHasExpectedSignature(file)) throw badRequest(message);
  if (file.content.length === 0) throw badRequest('Uploaded file is empty.');
}

function parseMultipart(req, bodyBuffer) {
  const contentType = req.headers['content-type'] || '';
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!boundary) throw badRequest('Multipart boundary is missing.');
  const body = bodyBuffer.toString('binary');
  const parts = body.split(`--${boundary}`).slice(1, -1);
  const fields = {};
  const files = {};

  for (const part of parts) {
    const trimmed = part.replace(/^\r\n/, '').replace(/\r\n$/, '');
    const separator = trimmed.indexOf('\r\n\r\n');
    if (separator < 0) continue;
    const rawHeaders = trimmed.slice(0, separator);
    const rawContent = trimmed.slice(separator + 4);
    const disposition = rawHeaders.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || '';
    const name = disposition.match(/name="([^"]+)"/)?.[1];
    if (!name) continue;
    const filename = disposition.match(/filename="([^"]*)"/)?.[1];
    const mimeType = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || 'application/octet-stream';
    const content = Buffer.from(rawContent, 'binary');
    if (filename) {
      files[name] = { filename: sanitizeFileName(filename), mimeType, content };
    } else {
      fields[name] = Buffer.from(rawContent, 'binary').toString('utf8');
    }
  }
  return { fields, files };
}

function attachCors(req, res) {
  const origin = req.headers.origin;
  const isLocalDevelopmentOrigin = config.nodeEnv !== 'production'
    && /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin || '');
  const allowOrigin = origin && (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin) || isLocalDevelopmentOrigin)
    ? origin
    : config.corsOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || '').split(';');
  const prefix = `${name}=`;
  const match = cookies.map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : '';
}

function refreshCookie(token, maxAgeSeconds) {
  const secure = config.nodeEnv === 'production' ? '; Secure' : '';
  return `campusguard_refresh=${encodeURIComponent(token || '')}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=${maxAgeSeconds}${secure}`;
}

function sanitizeUser(user) {
  return pick(user, ['id', 'name', 'email', 'role', 'createdAt']);
}

function issueSession(user) {
  const db = getDb();
  const refreshToken = createRefreshToken();
  const now = nowIso();
  db.refreshTokens = db.refreshTokens || [];
  db.refreshTokens.unshift({
    id: generateId('SES'),
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    revoked: false,
    createdAt: now,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
  });
  db.refreshTokens = db.refreshTokens.slice(0, 1000);
  saveDb();
  return { token: createToken(user), refreshToken };
}

function refreshSession(body, req) {
  const db = getDb();
  const refreshToken = requireString(body.refreshToken || getCookie(req, 'campusguard_refresh'), 'refreshToken', 500);
  const tokenHash = hashToken(refreshToken);
  const session = (db.refreshTokens || []).find((item) => item.tokenHash === tokenHash);
  if (!session || session.revoked || new Date(session.expiresAt).getTime() < Date.now()) {
    throw unauthorized('Invalid refresh session.');
  }
  const user = db.users.find((item) => item.id === session.userId);
  if (!user) throw unauthorized('Session user no longer exists.');
  session.revoked = true;
  session.revokedAt = nowIso();
  const nextSession = issueSession(user);
  audit('auth.refresh', 'user', user.id, user, 'Access token refreshed.');
  return { user: sanitizeUser(user), ...nextSession };
}

function logoutSession(body, req) {
  const db = getDb();
  const refreshToken = String(body.refreshToken || getCookie(req, 'campusguard_refresh') || '');
  if (!refreshToken) return { loggedOut: true, clearRefreshCookie: true };
  const tokenHash = hashToken(refreshToken);
  const session = (db.refreshTokens || []).find((item) => item.tokenHash === tokenHash);
  if (session) {
    session.revoked = true;
    session.revokedAt = nowIso();
    saveDb();
  }
  return { loggedOut: true, clearRefreshCookie: true };
}

function getUserFromRequest(req) {
  const key = routeKey(req);
  if (publicRoutes.has(key)) return null;
  const token = getBearerToken(req);
  if (!token) throw unauthorized();
  const payload = verifyToken(token);
  const user = getDb().users.find((item) => item.id === payload.sub);
  if (!user) throw unauthorized('User no longer exists.');
  return user;
}

function filterRecordsForUser(records, user) {
  if (['staff', 'admin'].includes(user.role)) return records;
  return records.filter((item) => item.ownerEmail === user.email || item.contact === user.email);
}

function handleAuthLogin(body) {
  const email = requireString(body.email, 'email', 120).toLowerCase();
  const password = requireString(body.password, 'password', 200);
  const attempt = authAttempts.get(email) || { count: 0, lockedUntil: 0 };
  if (attempt.lockedUntil > Date.now()) {
    throw unauthorized('Too many failed login attempts. Try again shortly.');
  }
  const user = getDb().users.find((item) => item.email.toLowerCase() === email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    const nextCount = attempt.count + 1;
    authAttempts.set(email, {
      count: nextCount,
      lockedUntil: nextCount >= 5 ? Date.now() + 60_000 : 0,
    });
    throw unauthorized('Invalid email or password.');
  }
  authAttempts.delete(email);
  audit('auth.login', 'user', user.id, user, 'User signed in.');
  return { user: sanitizeUser(user), ...issueSession(user) };
}

function handleAuthSignup(body) {
  const db = getDb();
  const name = requireString(body.name, 'name', 120);
  const email = requireString(body.email, 'email', 120).toLowerCase();
  const password = requireString(body.password, 'password', 200);
  const role = body.role || 'applicant';
  if (!allowedRoles.includes(role)) throw badRequest('Invalid role.');
  if (['staff', 'admin'].includes(role)) throw forbidden('Staff and admin accounts must be provisioned by college admin.');
  if (db.users.some((item) => item.email.toLowerCase() === email)) throw badRequest('Email already exists.');
  const user = { id: generateId('USR'), name, email, role, passwordHash: hashPassword(password), createdAt: nowIso() };
  db.users.push(user);
  saveDb();
  audit('auth.signup', 'user', user.id, user, 'New applicant/parent account created.');
  return { user: sanitizeUser(user), ...issueSession(user) };
}

function createInquiry(body, user) {
  const db = getDb();
  const now = nowIso();
  const record = {
    id: generateId('INQ'),
    name: requireString(body.name || user.name, 'name', 120),
    role: user.role,
    topic: requireString(body.topic, 'topic', 80),
    priority: 'New',
    status: 'Unassigned',
    city: typeof body.city === 'string' && body.city.trim() ? body.city.trim() : 'Not provided',
    contact: requireString(body.contact || user.email, 'contact', 160),
    question: requireString(body.question, 'question', 1000),
    ownerEmail: user.email,
    assignedTo: '',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  db.inquiries.unshift(record);
  saveDb();
  audit('inquiry.created', 'inquiry', record.id, user, record.topic);
  return record;
}

function updateInquiryStatus(id, body, user) {
  requireRole({ user }, ['staff', 'admin']);
  const validStatuses = ['Unassigned', 'Needs reply', 'In progress', 'Resolved'];
  if (!validStatuses.includes(body.status)) throw badRequest('Invalid inquiry status.');
  const record = getDb().inquiries.find((item) => item.id === id);
  if (!record) throw notFound('Inquiry not found.');
  const reply = typeof body.reply === 'string' ? body.reply.trim() : '';
  if (reply.length > 1500) throw badRequest('Reply must be 1500 characters or fewer.');
  if (body.status === 'Resolved' && !reply && !(record.messages || []).some((item) => item.authorRole === 'staff' || item.authorRole === 'admin')) {
    throw badRequest('Add a staff reply before resolving the inquiry.');
  }
  record.status = body.status;
  if (typeof body.assignedTo === 'string') record.assignedTo = body.assignedTo.trim().slice(0, 120);
  record.messages = record.messages || [];
  if (reply) {
    record.messages.push({ id: generateId('MSG'), text: reply, authorName: user.name, authorRole: user.role, createdAt: nowIso() });
    record.lastReplyAt = nowIso();
  }
  record.updatedAt = nowIso();
  saveDb();
  audit('inquiry.status_updated', 'inquiry', record.id, user, body.status);
  return record;
}

const workspaceSections = new Set(['cap', 'programs', 'fees', 'scholarship', 'stay']);

function getAdmissionWorkspace(user) {
  if (!['applicant', 'parent'].includes(user.role)) throw forbidden();
  return getDb().admissionWorkspaces.find((item) => item.ownerEmail === user.email) || {
    ownerEmail: user.email,
    cap: {},
    programs: { preferences: [] },
    fees: {},
    scholarship: {},
    stay: {},
    updatedAt: null,
  };
}

function updateAdmissionWorkspace(body, user) {
  if (!['applicant', 'parent'].includes(user.role)) throw forbidden();
  const section = requireString(body.section, 'section', 40);
  if (!workspaceSections.has(section)) throw badRequest('Invalid admission workspace section.');
  if (!body.value || typeof body.value !== 'object' || Array.isArray(body.value)) throw badRequest('Workspace value must be an object.');
  const serialized = JSON.stringify(body.value);
  if (serialized.length > 5000) throw badRequest('Workspace section is too large.');
  const db = getDb();
  let workspace = db.admissionWorkspaces.find((item) => item.ownerEmail === user.email);
  if (!workspace) {
    workspace = { ownerEmail: user.email, cap: {}, programs: { preferences: [] }, fees: {}, scholarship: {}, stay: {}, updatedAt: nowIso() };
    db.admissionWorkspaces.push(workspace);
  }
  workspace[section] = body.value;
  workspace.updatedAt = nowIso();
  saveDb();
  audit('admission_workspace.updated', 'admission_workspace', user.id, user, section);
  return workspace;
}

function createDocument(body, user) {
  const db = getDb();
  const now = nowIso();
  const ownerEmail = body.ownerEmail || user.email;
  if (!canAccessApplicantRecord(user, ownerEmail)) throw forbidden();
  const record = {
    id: generateId('DOC'),
    ownerName: requireString(body.ownerName || user.name, 'ownerName', 120),
    ownerEmail: requireString(ownerEmail, 'ownerEmail', 120).toLowerCase(),
    ownerRole: ['staff', 'admin'].includes(user.role) && allowedRoles.includes(body.ownerRole) ? body.ownerRole : user.role,
    docName: requireString(body.docName, 'docName', 160),
    fileName: requireString(body.fileName, 'fileName', 220),
    status: 'Uploaded (not submitted)',
    createdAt: now,
    updatedAt: now,
  };
  const existingIndex = db.documents.findIndex((item) => item.ownerEmail === record.ownerEmail && item.docName === record.docName);
  if (existingIndex >= 0) db.documents.splice(existingIndex, 1, record);
  else db.documents.unshift(record);
  saveDb();
  audit('document.uploaded', 'document', record.id, user, record.docName);
  return record;
}

function createDocumentFromUpload(fields, file, user) {
  assertAllowedUpload(file, allowedMimeTypes, 'Only valid PDF, JPG, and PNG files are allowed.');
  const db = getDb();
  const now = nowIso();
  const ownerEmail = fields.ownerEmail || user.email;
  if (!canAccessApplicantRecord(user, ownerEmail)) throw forbidden();
  const id = generateId('DOC');
  const storedFileName = `${id}-${file.filename}`;
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, storedFileName), file.content);
  const record = {
    id,
    ownerName: requireString(fields.ownerName || user.name, 'ownerName', 120),
    ownerEmail: requireString(ownerEmail, 'ownerEmail', 120).toLowerCase(),
    ownerRole: ['staff', 'admin'].includes(user.role) && allowedRoles.includes(fields.ownerRole) ? fields.ownerRole : user.role,
    docName: requireString(fields.docName, 'docName', 160),
    fileName: file.filename,
    storedFileName,
    mimeType: file.mimeType,
    sizeBytes: file.content.length,
    status: 'Uploaded (not submitted)',
    createdAt: now,
    updatedAt: now,
  };
  const existingIndex = db.documents.findIndex((item) => item.ownerEmail === record.ownerEmail && item.docName === record.docName);
  if (existingIndex >= 0) db.documents.splice(existingIndex, 1, record);
  else db.documents.unshift(record);
  saveDb();
  audit('document.file_uploaded', 'document', record.id, user, record.docName);
  return record;
}

function updateDocumentStatus(id, body, user) {
  requireRole({ user }, ['staff', 'admin']);
  const validStatuses = ['Submitted for review', 'Ready for reporting', 'Needs correction'];
  if (!validStatuses.includes(body.status)) throw badRequest('Invalid document status.');
  const record = getDb().documents.find((item) => item.id === id);
  if (!record) throw notFound('Document not found.');
  record.status = body.status;
  record.reviewNote = typeof body.reviewNote === 'string' ? body.reviewNote.trim().slice(0, 500) : '';
  record.reviewedBy = user.name;
  record.reviewedAt = nowIso();
  record.updatedAt = nowIso();
  saveDb();
  audit('document.status_updated', 'document', record.id, user, body.status);
  return record;
}

function submitDocumentsForReview(user) {
  if (!['applicant', 'parent'].includes(user.role)) throw forbidden();
  const db = getDb();
  const records = db.documents.filter((item) => item.ownerEmail === user.email && ['Uploaded (not submitted)', 'Needs correction'].includes(item.status));
  if (records.length === 0) throw badRequest('Upload a new or corrected document before submitting for review.');
  const submittedAt = nowIso();
  records.forEach((record) => {
    record.status = 'Submitted for review';
    record.submittedAt = submittedAt;
    record.updatedAt = submittedAt;
    record.reviewNote = '';
    record.reviewedBy = '';
    record.reviewedAt = '';
  });
  saveDb();
  audit('documents.submitted_for_review', 'document_batch', user.id, user, `${records.length} document(s)`);
  return { items: records, submittedCount: records.length, submittedAt };
}

function deleteDocument(id, user) {
  const db = getDb();
  const record = db.documents.find((item) => item.id === id);
  if (!record) throw notFound('Document not found.');
  if (!canAccessApplicantRecord(user, record.ownerEmail)) throw forbidden();
  if (!['staff', 'admin'].includes(user.role) && ['Submitted for review', 'Ready for reporting'].includes(record.status)) {
    throw forbidden('Submitted documents cannot be removed unless staff requests a correction.');
  }
  db.documents = db.documents.filter((item) => item.id !== id);
  if (record.storedFileName) {
    const filePath = path.resolve(uploadDir, record.storedFileName);
    if (filePath.startsWith(uploadDir) && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  saveDb();
  audit('document.deleted', 'document', id, user, record.docName);
  return { deleted: true };
}

function getDocumentFile(id, user) {
  const record = getDb().documents.find((item) => item.id === id);
  if (!record) throw notFound('Document not found.');
  if (!canAccessApplicantRecord(user, record.ownerEmail)) throw forbidden();
  if (['staff', 'admin'].includes(user.role) && record.status === 'Uploaded (not submitted)') throw forbidden('This document has not been submitted for review.');
  if (!record.storedFileName) throw notFound('The original file is not available for this record.');
  const filePath = path.resolve(uploadDir, record.storedFileName);
  if (!filePath.startsWith(uploadDir) || !fs.existsSync(filePath)) throw notFound('Document file is unavailable.');
  audit('document.file_opened', 'document', record.id, user, record.docName);
  return { __file: true, filePath, mimeType: record.mimeType || 'application/octet-stream', fileName: record.fileName };
}

function createContent(body, user) {
  requireRole({ user }, ['admin']);
  const db = getDb();
  const record = {
    id: generateId('CNT'),
    title: requireString(body.title, 'title', 180),
    category: requireString(body.category, 'category', 80),
    status: body.status || 'Review',
    updatedAt: nowIso(),
  };
  db.content.unshift(record);
  saveDb();
  audit('content.created', 'content', record.id, user, record.title);
  return record;
}

function updateContent(id, body, user) {
  requireRole({ user }, ['admin']);
  const record = getDb().content.find((item) => item.id === id);
  if (!record) throw notFound('Content item not found.');
  Object.assign(record, pick(body, ['title', 'category', 'status']), { updatedAt: nowIso() });
  saveDb();
  audit('content.updated', 'content', record.id, user, record.title);
  return record;
}

function buildReports(user) {
  requireRole({ user }, ['staff', 'admin']);
  const db = getDb();
  const topicCounts = db.inquiries.reduce((items, item) => {
    items[item.topic] = (items[item.topic] || 0) + 1;
    return items;
  }, {});
  const topTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No data';
  const readyDocs = db.documents.filter((item) => item.status === 'Ready for reporting').length;
  return {
    topTopic,
    openInquiries: db.inquiries.filter((item) => item.status !== 'Resolved').length,
    unresolved: db.inquiries.filter((item) => ['Unassigned', 'Needs reply'].includes(item.status)).length,
    documentReviews: db.documents.length,
    readyDocuments: readyDocs,
    documentReadinessPercent: db.documents.length ? Math.round((readyDocs / db.documents.length) * 100) : 0,
  };
}

function tokenize(text) {
  return String(text || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((word) => word.length > 1) || [];
}

function buildEligibilityAnswer(question) {
  const normalized = normalizeIntentText(question);
  const isEligibilityQuestion = ['eligible', 'eligibility', 'percentile']
    .some((term) => normalized.includes(term));
  const isBranchQuestion = ['cse', 'computer science', 'branch', 'department', 'course']
    .some((term) => normalized.includes(term));
  if (!isEligibilityQuestion || !isBranchQuestion) return null;

  const percentile = normalized.match(/(\d+(?:\.\d+)?)\s*(?:%|percentile|percent)/)?.[1];
  const scoreReference = percentile ? `${percentile} percentile` : 'the stated percentile';
  return {
    source: 'Maharashtra CET Cell admission process guidance',
    answer: `${scoreReference} alone is not enough to confirm admission to CSE. First, basic engineering eligibility must be checked from your qualifying-examination subjects and marks, entrance score, candidature, and documents. After that, CSE allotment depends on merit rank, category, seat type, CAP or institute-level route, round, preferences, vacancies, and the applicable cutoff. Therefore, CampusGuard cannot honestly guarantee or reject CSE from percentile alone.`,
    next: 'Provide your category, Maharashtra candidature status, qualifying-examination subjects and marks, CAP or institute-level route, and current round to refine the guidance.',
    actionView: 'programs',
    actionLabel: 'Check programs',
  };
}

function buildStructuredFeeAnswer(question) {
  const normalized = normalizeIntentText(question);
  if (!['fee', 'payment', 'amount', 'semester'].some((term) => normalized.includes(term))) return null;

  const isDirectSecondYear = /direct second|dse|lateral|second year/i.test(normalized);
  const isFirstYear = /first year|fy|12th/i.test(normalized);
  if (!isDirectSecondYear && !isFirstYear) return null;
  const route = isDirectSecondYear ? 'Direct Second Year Engineering' : 'First Year Engineering';
  const feeTable = isDirectSecondYear
    ? { open: 'INR 98,000', concessionBoy: 'INR 58,181', concessionGirl: 'INR 18,362', vjnt: 'INR 18,362', scst: 'INR 10,000' }
    : { open: 'INR 1,05,000', concessionBoy: 'INR 61,109', concessionGirl: 'INR 17,217', vjnt: 'INR 17,217', scst: 'INR 8,000' };
  const isScSt = /\bsc\b|\bst\b|scheduled caste|scheduled tribe/i.test(normalized);
  const isVjntSbcTfws = /\bvjnt\b|\bvj\b|\bnt\b|\bsbc\b|\btfws\b/i.test(normalized);
  const isEbcEwsObcSebc = /\bebc\b|\bews\b|\bobc\b|\bsebc\b|non[- ]?creamy/i.test(normalized);
  const isOpenOrOms = /\bopen\b|\boms\b|general category|without ebc/i.test(normalized);
  const isGirl = /\bgirl\b|\bfemale\b|\bwoman\b/i.test(normalized);
  const isBoy = /\bboy\b|\bmale\b/i.test(normalized);

  let category = '';
  let amount = '';
  if (isScSt) [category, amount] = ['SC/ST', feeTable.scst];
  else if (isVjntSbcTfws) [category, amount] = ['VJNT/SBC/TFWS', feeTable.vjnt];
  else if (isEbcEwsObcSebc && isGirl) [category, amount] = ['Open EBC/EWS/OBC/SEBC girls', feeTable.concessionGirl];
  else if (isEbcEwsObcSebc && isBoy) [category, amount] = ['Open EBC/EWS/OBC/SEBC boys', feeTable.concessionBoy];
  else if (isOpenOrOms) [category, amount] = ['OMS/Open without EBC income concession', feeTable.open];
  if (!amount) return null;

  return {
    source: 'Approved fee records shared for AY 2026-27',
    answer: `For ${route} in AY 2026-27, the approved ${category} total is ${amount} for the academic year. CSE branch does not change the amount in the approved table. This is not a semester-wise schedule, so CampusGuard will not invent an installment split. Category concession processing still requires valid admission and category documents.`,
    next: 'Check the official payment schedule for due dates and any approved installment arrangement.',
    actionView: 'fees',
    actionLabel: 'Open fee record',
  };
}

function buildHostelMessFeeAnswer(question) {
  const normalized = normalizeIntentText(question);
  const asksForFee = ['fee', 'fees', 'payment', 'amount', 'charges', 'cost'].some((term) => normalized.includes(term));
  const asksHostel = normalized.includes('hostel');
  const asksMess = normalized.includes('mess');
  if (!asksForFee || (!asksHostel && !asksMess)) return null;

  const details = asksHostel && asksMess
    ? 'the hostel fee is INR 35,000 plus a refundable hostel deposit of INR 5,000, for a hostel total of INR 40,000; mess fees are INR 42,000 per year. The combined first-year amount is INR 82,000, including the refundable INR 5,000 hostel deposit.'
    : asksHostel
      ? 'the hostel fee is INR 35,000 plus a refundable hostel deposit of INR 5,000, for a total of INR 40,000.'
      : 'mess fees are INR 42,000 per year.';
  return {
    source: 'Hostel and mess fee structure shared for AY 2026-27',
    answer: `For AY 2026-27, ${details} Room availability, hostel and mess rules, and payment process are not guaranteed by the fee table and must be confirmed through the current hostel notice.`,
    next: 'Check the current hostel notice before paying or planning travel.',
    actionView: 'visit',
    actionLabel: 'Open hostel & mess',
  };
}

function buildSeatMatrixAnswer(question) {
  const normalized = normalizeIntentText(question);
  if (!normalized.includes('seat matrix')) return null;
  return {
    source: 'Maharashtra CET Cell PHSeatvacancy 2024-25, pages 1403-1407',
    answer: 'The detailed verified MITCORER seat matrix available in CampusGuard is historical AY 2024-25 data for institute code 06901: Civil Engineering - sanctioned intake 30 and CAP seats 30; Computer Science and Engineering - sanctioned intake 90, CAP seats 72, Maharashtra State seats 58, All India seats 18, EWS seats 9, and TFWS choice code 0690124211T with 5 seats; Electronics and Telecommunication Engineering - intake 60 and CAP seats 60; Mechanical Engineering - intake 60 and CAP seats 60; Electronics and Computer Engineering - intake 60 and CAP seats 60. This must not be presented as the 2026-27 matrix. The current FY B.Tech page separately lists CSE intake 120 for 2026-27, but a current CAP seat matrix must come from the current CET Cell notice.',
    next: 'Use the current Maharashtra CET Cell CAP notice for current-year vacancy and category-wise seat decisions.',
    actionView: 'cap',
    actionLabel: 'Open CAP tracker',
  };
}

function buildDocumentStatusAnswer(question, user) {
  const normalized = normalizeIntentText(question);
  const asksStatus = ['status', 'review', 'uploaded', 'upload'].some((term) => normalized.includes(term));
  const asksDocuments = ['document', 'documents', 'certificate', 'marksheet'].some((term) => normalized.includes(term));
  if (!asksStatus || !asksDocuments) return null;
  const records = getDb().documents.filter((item) => item.ownerEmail === user.email);
  if (records.length === 0) {
    return {
      source: 'My document records',
      answer: 'There are no uploaded admission documents in your CampusGuard record yet. Upload each required document from the Documents section; it will then appear for staff review.',
      next: 'Open Documents and upload the required files together.',
      actionView: 'documents',
      actionLabel: 'Open documents',
    };
  }
  const summary = records.reduce((items, item) => {
    items[item.status] = (items[item.status] || 0) + 1;
    return items;
  }, {});
  const statusSummary = Object.entries(summary).map(([status, count]) => `${count} ${status}`).join(', ');
  return {
    source: 'My document records',
    answer: `Your CampusGuard document record contains ${records.length} uploaded file${records.length === 1 ? '' : 's'}: ${statusSummary}. Uploading a file does not mean it is approved; staff review status is shown in the Documents section.`,
    next: 'Open Documents to see each file and any correction request.',
    actionView: 'documents',
    actionLabel: 'Open documents',
  };
}

function buildAdmissionReadinessAnswer(question, user) {
  const normalized = normalizeIntentText(question);
  const rawQuestion = String(question || '').normalize('NFKC').toLocaleLowerCase();
  const intentText = `${normalized} ${rawQuestion}`;
  const hasStrongReadinessMarker = ['what else', 'what remaining', 'what is remaining', 'remaining', 'pending', 'last step', 'final step', 'admission complete', 'complete admission', 'reporting checklist', 'admission checklist', 'final admission checklist', 'before institute reporting', 'after allotment']
    .some((term) => intentText.includes(term));
  const hasProgressSignal = ['received', 'got', 'accepted', 'uploaded', 'paid', 'payment done', 'reporting complete'].some((term) => intentText.includes(term));
  const asksWhatRemains = hasStrongReadinessMarker || (['what next', 'what should i do next', 'next step'].some((term) => intentText.includes(term)) && hasProgressSignal);
  const mentionsAdmissionWorkflow = ['admission', 'allotment', 'reporting', 'cap', 'acap'].some((term) => intentText.includes(term));
  if (!asksWhatRemains || !mentionsAdmissionWorkflow) return null;

  const documents = getDb().documents.filter((item) => item.ownerEmail === user.email);
  const uploaded = new Set(documents.map((item) => item.docName.toLocaleLowerCase()));
  const coreDocuments = ['10th marksheet', '12th marksheet', 'CET or JEE scorecard', 'school leaving certificate', 'nationality or domicile proof', 'Aadhaar copy', 'bank passbook copy'];
  const missingKnownDocuments = coreDocuments.filter((name) => !uploaded.has(name.toLocaleLowerCase()));
  const hasAllotment = /allotment.*(?:received|got|available)|(?:received|got).*allotment|allotted/i.test(intentText);
  const hasAcceptance = /seat.*accepted|accepted.*seat|acceptance.*complete|freeze.*complete/i.test(intentText);
  const hasPayment = /payment.*(?:done|paid|complete)|(?:paid|payment done|fee paid)/i.test(intentText);
  const saysDocumentsReady = /documents?.*(?:uploaded|ready|complete)|(?:uploaded|ready).*documents?/i.test(intentText);
  const hasReported = /reported.*(?:college|institute)|reporting.*complete|admission.*complete/i.test(intentText);
  const workflowSteps = [
    ['allotment or institute-level merit/vacancy confirmation', hasAllotment],
    ['seat acceptance or freeze/betterment decision where applicable', hasAcceptance],
    ['document upload and staff readiness check', saysDocumentsReady || documents.length > 0],
    ['approved fee payment or payment-schedule confirmation', hasPayment],
    ['institute reporting within the current notice deadline', hasReported],
  ];
  const remainingSteps = workflowSteps.filter(([, complete]) => !complete).map(([label]) => label);
  const documentSummary = documents.length === 0
    ? 'No documents have been uploaded in this workspace yet.'
    : `${documents.length} document file${documents.length === 1 ? '' : 's'} ${documents.length === 1 ? 'is' : 'are'} currently uploaded.`;
  const isOpenCategory = /\bopen\b|general category/i.test(normalized);
  const remainingText = remainingSteps.length
    ? `Based on what you wrote, the remaining workflow items are: ${remainingSteps.join('; ')}.`
    : 'Based on what you wrote, all main workflow stages appear complete; only the current official reporting confirmation and staff document status remain authoritative.';
  return {
    source: 'Verified admission checklist',
    answer: `${isOpenCategory ? 'For Open-category reporting, ' : 'For admission reporting, '}the core documents are 10th marksheet, 12th marksheet, CET or JEE scorecard, school leaving certificate, nationality or domicile proof, Aadhaar copy, bank passbook copy, and photographs. Migration certificate, gap certificate, and income certificate are only needed where applicable. ${remainingText} ${documentSummary} ${missingKnownDocuments.length ? `The workspace does not yet show: ${missingKnownDocuments.join(', ')}.` : 'The core named documents are present in the workspace; staff review status still matters.'}`,
    next: 'Open Documents to upload or check files, then confirm your CAP/ACAP route, allotment acceptance, reporting date, and payment status.',
    actionView: 'documents',
    actionLabel: 'Check reporting checklist',
  };
}

function buildDeadlineAnswer(question) {
  const normalized = normalizeIntentText(question);
  if (!['deadline', 'last date', 'admission date', 'schedule', 'reporting date'].some((term) => normalized.includes(term))) return null;
  return {
    source: 'Maharashtra CET Cell 2026-27 admission portals',
    answer: 'Admission dates and reporting deadlines change by academic year, route, and round. Use the current official portal for the applicable route. CampusGuard will state an exact date only when that current notice has been added and verified.',
    next: 'Specify B.Tech CAP, Direct Second Year, Polytechnic, or ACAP and the relevant round for an exact check.',
    actionView: 'cap',
    actionLabel: 'Check current notices',
  };
}

function getOfficialAdmissionLinks(question) {
  const normalized = normalizeIntentText(question);
  const links = [];
  const add = (label, url) => links.push({ label, url });
  const asksDse = /direct second|dse|lateral|second year/.test(normalized);
  const asksPolytechnic = /polytechnic|diploma|post ssc/.test(normalized);
  const asksAcap = /acap|institute level|institute-level|against cap|vacancy/.test(normalized);
  const asksCap = /\bcap\b|allotment|option form|freeze|betterment|seat acceptance|reporting|deadline|schedule|last date/.test(normalized);

  if (asksDse) add('Official DSE Engineering portal 2026-27', 'https://dse2026.mahacet.org.in/');
  else if (asksPolytechnic) add('Official Polytechnic admission portal 2026-27', 'https://poly26.dtemaharashtra.gov.in/poly_26/home');
  else if (asksCap) add('Official B.Tech CAP portal 2026-27', 'https://fe2026.mahacet.org/StaticPages/HomePage');
  if (asksAcap) add('MITCORER ACAP and institute-level notices', 'https://mitcorer.edu.in/acap-institute-level-admission.php');
  if (asksCap || asksAcap) add('Maharashtra CET Cell notices', 'https://cetcell.mahacet.org/notices/');
  return links;
}

function getOfficialUniversityLinks(question) {
  const normalized = normalizeIntentText(question);
  if (!/attendance|present|absen|detain|condonation|biometric|\bxx\b/.test(normalized)) return [];
  return [
    { label: 'Official engineering attendance rules', url: 'https://www.sus.ac.in/uploads/engineering/Eng%20Revised%20Semester%20Pattern/CBCS%20UG%20Rules.pdf' },
    { label: 'Official biometric attendance circular 2026-27', url: 'https://www.sus.ac.in/uploads/admission/Admission%202026%2027/Circular/LMS%20Circular%20-%206%2020062026.pdf' },
  ];
}

function buildAttendanceAnswer(question) {
  const normalized = normalizeIntentText(question);
  if (!/attendance|present|absen|detain|condonation|biometric|\bxx\b/.test(normalized)) return null;
  return {
    source: 'PAH Solapur University CBCS UG Engineering Rules',
    answer: 'For engineering courses, regular 100% attendance is expected. The minimum threshold is 75% in each theory and laboratory course because only a maximum of 25% absence may be permitted. Falling below 75% results in an XX grade (Detained) for that course. Absence relaxation is not automatic: it is limited to valid grounds such as illness, death in the family, or another emergency beyond the student\'s control and requires approval from the affiliated institute. For AY 2026-27, the university also requires biometric attendance for students of affiliated colleges and university schools.',
    next: 'Check your subject-wise attendance with the college and submit supporting evidence promptly if you need institute consideration for an eligible absence.',
    actionView: 'inquiry',
    actionLabel: 'Ask attendance support',
  };
}

function buildFeeAnswer(question) {
  const normalized = normalizeIntentText(question);
  const isFeeQuestion = ['fee', 'payment', 'amount', 'semester'].some((term) => normalized.includes(term));
  const isScSt = /\bsc\b|\bst\b|scheduled caste|scheduled tribe|अनुसूचित जाती|अनुसूचित जमाती/i.test(normalized);
  if (!isFeeQuestion || !isScSt) return null;

  const isDirectSecondYear = /direct second|dse|lateral|द्वितीय वर्ष|second year/i.test(normalized);
  const isFirstYear = /first year|fy|12th|बारावी|प्रथम वर्ष/i.test(normalized);
  const answer = isDirectSecondYear
    ? 'For Direct Second Year Engineering in AY 2026-27, the approved SC/ST total is INR 10,000 for the academic year: tuition fee INR 0, development fee INR 0, other charges INR 8,000, and refundable caution money deposit INR 2,000.'
    : isFirstYear
      ? 'For First Year Engineering in AY 2026-27, the approved SC/ST total is INR 8,000 for the academic year: tuition fee INR 0, development fee INR 0, other charges INR 6,000, and refundable caution money deposit INR 2,000.'
      : 'For AY 2026-27, the approved SC/ST total is INR 8,000 for First Year Engineering and INR 10,000 for Direct Second Year Engineering. These are academic-year totals, not semester-wise figures. The published table does not provide a semester split, so CampusGuard should not divide the amount without an official payment schedule.';
  return {
    source: 'Approved fee records shared for AY 2026-27',
    answer: `${answer} The CSE branch and the applicant being a boy do not change the SC/ST amount shown in this approved table. Final concession processing still depends on valid category and admission documents.`,
    next: isFirstYear || isDirectSecondYear
      ? 'Check the official payment schedule for the due date and whether the annual amount is collected in one or more installments.'
      : 'Confirm whether this is First Year or Direct Second Year admission, then check the official payment schedule for installment dates.',
    actionView: 'fees',
    actionLabel: 'Open fee record',
  };
}

function buildFacilityAnswer(question) {
  const normalized = normalizeIntentText(question);
  if (/\bbus\b|transport facility|bus facility|bus route|bus stop|bus fee|bus timing/.test(normalized)) {
    return {
      source: 'MITCORER Bus Facility page',
      answer: 'MITCORER lists a bus facility under campus infrastructure. The currently published official page does not give bus routes, stops, timetable, seat availability, or transport fee. CampusGuard should not guess these details.',
      next: 'Request the current route, stop, timing, seat availability, and fee for your location from admission staff.',
      actionView: 'inquiry',
      actionLabel: 'Request bus details',
    };
  }
  if (/\blibrary\b|digital resources|journal/.test(normalized)) {
    return {
      source: 'MITCORER Admissions FAQ',
      answer: 'MITCORER states that it has a well-equipped library with digital resources and journals. The official FAQ does not publish library timings, borrowing rules, or access procedure.',
      next: 'Ask the library or admission desk for current timings and access rules.',
      actionView: 'inquiry',
      actionLabel: 'Request library details',
    };
  }
  if (/cafeteria|computer center|railway model room|seminar hall|classroom/.test(normalized)) {
    const facility = normalized.includes('cafeteria') ? 'cafeteria'
      : normalized.includes('computer center') ? 'computer center'
        : normalized.includes('railway model') ? 'railway model room'
          : normalized.includes('seminar') ? 'seminar hall'
            : 'classrooms';
    return {
      source: 'MITCORER Admissions FAQ and infrastructure pages',
      answer: `MITCORER lists a ${facility} among its campus facilities. The public information does not publish operating hours, access rules, or service details for it, so CampusGuard should not infer them.`,
      next: 'Use the official contact details to confirm the current operational details before making a visit decision.',
      actionView: 'inquiry',
      actionLabel: 'Request facility details',
    };
  }
  return null;
}

export function retrieveKnowledge(question) {
  const normalizedQuestion = normalizeIntentText(question);
  const rawQuestion = String(question || '').normalize('NFKC').toLocaleLowerCase();
  const intentText = `${normalizedQuestion} ${rawQuestion}`;
  const stopWords = new Set(['the', 'and', 'for', 'with', 'then', 'that', 'this', 'from', 'into', 'got', 'have', 'has', 'are', 'was', 'what', 'which', 'can']);
  const words = new Set(tokenize(normalizedQuestion).filter((word) => !stopWords.has(word)));
  const categoryHints = [
    [['eligible', 'eligibility', 'percentile', 'pcm'], 'eligibility'],
    [['cutoff', 'closing', 'rank'], 'cutoff'],
    [['fee', 'payment', 'amount', 'installment'], 'fees'],
    [['document', 'certificate', 'marksheet', 'aadhaar', 'domicile', 'validity'], 'documents'],
    [['scholarship', 'concession', 'ebc', 'ews', 'tfws', 'income'], 'scholarship'],
    [['hostel', 'mess', 'library', 'wifi', 'laboratory', 'bus', 'transport', 'facility'], 'facilities'],
    [['placement', 'package', 'company', 'recruiter', 'internship', 'career'], 'placement'],
    [['contact', 'phone', 'email', 'address', 'reach', 'station'], 'contact'],
    [['seat matrix', 'cap seats', 'sanctioned intake'], 'seat matrix'],
    [['polytechnic', 'diploma', 'program', 'course', 'branch', 'choice code', 'intake'], 'programs'],
    [['acap', 'institute level', 'management quota', 'vacancy', 'merit list'], 'admissions'],
    [['attendance', 'absence', 'detained', 'biometric', 'condonation'], 'university rules'],
  ];
  const preferredCategory = categoryHints.find(([terms]) => terms.some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term)))?.[1] || '';
  const targetedRecordIds = new Set();
  const primaryRecordIds = new Set();
  const asksForDocuments = ['document', 'documents', 'certificate', 'certificates', 'checklist', 'papers'].some((term) => words.has(term));
  const hasWorkflowContext = ['admission', 'allotment', 'reporting', 'cap', 'acap'].some((term) => intentText.includes(term));
  const hasStrongReadinessMarker = ['what else', 'what remaining', 'what is remaining', 'remaining', 'pending', 'last step', 'final step', 'reporting checklist', 'admission checklist', 'final admission checklist', 'before institute reporting', 'after allotment']
    .some((term) => intentText.includes(term));
  const hasProgressSignal = ['received', 'got', 'accepted', 'uploaded', 'paid', 'payment done', 'reporting complete'].some((term) => intentText.includes(term));
  const hasNextStepWithProgress = ['what next', 'what should i do next', 'next step'].some((term) => intentText.includes(term)) && hasProgressSignal;
  const isReadinessQuestion = hasWorkflowContext && (hasStrongReadinessMarker || hasNextStepWithProgress);
  if (asksForDocuments && (words.has('sc') || words.has('st') || normalizedQuestion.includes('scheduled caste') || normalizedQuestion.includes('scheduled tribe'))) targetedRecordIds.add('KB-26');
  if (asksForDocuments && (['obc', 'ews', 'vjnt', 'sbc'].some((term) => words.has(term)) || normalizedQuestion.includes('non creamy'))) targetedRecordIds.add('KB-27');
  if (asksForDocuments) targetedRecordIds.add('KB-1');
  if (['what else', 'what remaining', 'what is remaining', 'last step', 'final step'].some((term) => normalizedQuestion.includes(term)) && normalizedQuestion.includes('admission')) targetedRecordIds.add('KB-1');
  if (isReadinessQuestion) {
    targetedRecordIds.add('KB-1');
    primaryRecordIds.add('KB-1');
  }
  if (['exam', 'exams', 'entrance'].some((term) => words.has(term)) && ['accepted', 'accept', 'which'].some((term) => words.has(term))) targetedRecordIds.add('KB-25');
  if (rawQuestion.includes('cap round') || rawQuestion.includes('cap process') || rawQuestion.includes('option form') || rawQuestion.includes('betterment') || rawQuestion.includes('freeze')) targetedRecordIds.add('KB-29');
  if (rawQuestion.includes('acap') || rawQuestion.includes('institute level') || rawQuestion.includes('management quota') || rawQuestion.includes('against cap')) targetedRecordIds.add('KB-14');
  if (['deadline', 'last date', 'admission date', 'reporting date', 'admission schedule'].some((term) => rawQuestion.includes(term)) || normalizedQuestion.includes('deadline')) targetedRecordIds.add('KB-30');
  if (/attendance|present|absen|detain|condonation|biometric|\bxx\b/.test(normalizedQuestion)) {
    targetedRecordIds.add('KB-31');
    primaryRecordIds.add('KB-31');
    if (normalizedQuestion.includes('biometric')) targetedRecordIds.add('KB-32');
  }
  if (['scholarship', 'financial aid', 'mahadbt'].some((term) => rawQuestion.includes(term)) && !rawQuestion.includes('fee')) targetedRecordIds.add('KB-18');
  if (rawQuestion.includes('bus') || rawQuestion.includes('transport')) targetedRecordIds.add('KB-19');
  if (rawQuestion.includes('library') || rawQuestion.includes('digital resources') || rawQuestion.includes('journal')) targetedRecordIds.add('KB-20');
  if (rawQuestion.includes('wifi') || rawQuestion.includes('wi-fi') || rawQuestion.includes('internet')) targetedRecordIds.add('KB-21');
  if (rawQuestion.includes('laboratory') || rawQuestion.includes('laboratories') || rawQuestion.includes(' lab ') || rawQuestion.includes('workshop')) targetedRecordIds.add('KB-22');
  if (rawQuestion.includes('hostel') && !['fee', 'fees', 'payment', 'amount', 'charges', 'cost'].some((term) => rawQuestion.includes(term))) targetedRecordIds.add('KB-23');
  if (rawQuestion.includes('placement assistance') || rawQuestion.includes('placement cell') || rawQuestion.includes('internship')) targetedRecordIds.add('KB-24');
  if (['placement', 'company', 'companies', 'package', 'recruiter'].some((term) => rawQuestion.includes(term))) targetedRecordIds.add('KB-16');
  if (['contact', 'phone', 'email', 'address', 'how to reach'].some((term) => rawQuestion.includes(term))) targetedRecordIds.add('KB-17');
  if (rawQuestion.includes('polytechnic') || rawQuestion.includes('polytechnic course')) targetedRecordIds.add('KB-12');
  if (rawQuestion.includes('direct second year') || rawQuestion.includes('dse') || rawQuestion.includes('lateral entry')) targetedRecordIds.add('KB-11');
  if (rawQuestion.includes('available b.tech programs') || rawQuestion.includes('all b.tech programs') || rawQuestion.includes('programs and choice codes')) targetedRecordIds.add('KB-10');
  if (normalizedQuestion.includes('scholarship')) primaryRecordIds.add('KB-18');
  if (normalizedQuestion.includes('seat matrix')) primaryRecordIds.add('KB-6');
  if (normalizedQuestion.includes('program') && rawQuestion.includes('b.tech')) primaryRecordIds.add('KB-10');
  const asksAccommodationFee = ['hostel', 'mess'].some((term) => rawQuestion.includes(term)) && ['fee', 'fees', 'payment', 'amount', 'charges', 'cost'].some((term) => rawQuestion.includes(term));
  if (asksAccommodationFee) {
    targetedRecordIds.add('KB-3');
    primaryRecordIds.add('KB-3');
  }
  if (['fee', 'fees', 'payment', 'amount', 'semester'].some((term) => rawQuestion.includes(term))) {
    targetedRecordIds.add('KB-2');
    if (!asksAccommodationFee && !isReadinessQuestion) primaryRecordIds.add('KB-2');
  }
  if (rawQuestion.includes('seat matrix')) targetedRecordIds.add('KB-6');
  if (words.has('eligible')) words.add('eligibility');
  if (words.has('eligibility')) words.add('eligible');
  if (words.has('cse')) {
    words.add('computer');
    words.add('science');
  }
  const publishedKnowledge = (getDb().knowledge || []).filter((item) => item.status === 'Published');
  const referenceTokens = rawQuestion.match(/(?=[a-z0-9-]*[a-z])(?=[a-z0-9-]*\d)[a-z0-9-]{5,}/g) || [];
  return publishedKnowledge
    .map((item) => {
      const titleWords = new Set(tokenize(item.title));
      const categoryWords = new Set(tokenize(item.category));
      const textWords = new Set(tokenize(item.text));
      const tags = (item.tags || []).map((tag) => String(tag).toLocaleLowerCase());
      const relevanceScore = [...words].reduce((total, word) => {
        if (titleWords.has(word)) return total + 5;
        if (categoryWords.has(word)) return total + 3;
        if (textWords.has(word)) return total + 1;
        return total;
      }, 0);
      const tagScore = tags.reduce((total, tag) => {
        if (normalizedQuestion.includes(tag)) return total + 18;
        const tagWords = tokenize(tag);
        if (tagWords.length > 0 && tagWords.every((word) => words.has(word))) return total + 16;
        return total + (words.has(tag) ? 10 : 0);
      }, 0);
      const referenceTokenScore = referenceTokens.some((token) => `${item.title} ${item.text}`.toLocaleLowerCase().includes(token)) ? 200 : 0;
      const score = relevanceScore + tagScore + referenceTokenScore + (item.category.toLocaleLowerCase() === preferredCategory ? 20 : 0) + (targetedRecordIds.has(item.id) ? 50 : 0) + (primaryRecordIds.has(item.id) ? 100 : 0);
      return { ...item, score };
    })
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

async function generateWithOpenRouter(question, routedAnswer, evidence) {
  if (!config.openRouterApiKey || evidence.length === 0) return null;
  const evidenceText = evidence
    .map((item, index) => `[${index + 1}] ${item.title} (${item.source}): ${item.text}`)
    .join('\n\n');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': config.openRouterReferer,
        'X-OpenRouter-Title': config.openRouterTitle,
      },
      body: JSON.stringify({
        model: config.openRouterModel,
        temperature: 0.2,
        max_tokens: 320,
        messages: [
          {
            role: 'system',
            content: 'You are CampusGuard, an admission support assistant. Answer in the same language as the user. Answer only from the provided verified evidence. If important facts are missing, ask a concise follow-up question before suggesting staff help. Do not invent fees, dates, rules, cutoffs, eligibility decisions, or guarantees.',
          },
          {
            role: 'user',
            content: `Question: ${question}\n\nWorkflow route: ${routedAnswer.actionView}\n\nVerified evidence:\n${evidenceText}\n\nGive a concise answer with the next action.`,
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function answerAdmissionQuestion(body, user) {
  const question = requireString(body.question, 'question', 1000);
  const normalized = normalizeIntentText(question);
  const retrievedEvidence = retrieveKnowledge(question);
  // Do not attach a loosely matched MITCORER record to an unrelated question.
  const evidence = retrievedEvidence[0]?.score >= 15 ? retrievedEvidence : [];
  const answer = buildAdmissionReadinessAnswer(question, user) || buildDocumentStatusAnswer(question, user) || buildDeadlineAnswer(question) || buildAttendanceAnswer(question) || buildHostelMessFeeAnswer(question) || buildStructuredFeeAnswer(question) || buildSeatMatrixAnswer(question) || buildFeeAnswer(question) || buildEligibilityAnswer(question) || buildFacilityAnswer(question) || assistantRules.find((item) => item.match.some((word) => normalized.includes(word))) || {
    source: 'No verified record',
    answer: 'I do not have a verified official record that answers this yet. I can answer questions grounded in the available admission rules, fees, documents, CAP and ACAP process, programmes, historical cutoff and seat data, scholarships, facilities, placement information, and official contact details.',
    next: 'Ask the question with the admission route, academic year, branch, category, or document name where relevant.',
    actionView: 'inquiry',
    actionLabel: 'Request verified information',
  };
  const officialLinks = [...getOfficialAdmissionLinks(question), ...getOfficialUniversityLinks(question)];
  // The LLM is deliberately not allowed to replace verified admissions answers.
  // It can be introduced later only behind an evaluated, citation-preserving response validator.
  const generated = null;
  const workflowOnlySources = new Set([
    'Historical cutoff records',
    'Engineering eligibility and branch allotment guidance',
    'Document workflow',
    'Admission CAP workflow',
    'Fee planner',
    'Scholarship readiness',
    'Program finder',
    'Career outcome guidance',
    'Hostel and mess planning',
    'Institute-level admission notices',
  ]);
  const deterministicText = answer.source === evidence[0]?.source || answer.source === 'My document records'
    ? answer.answer
    : answer.source === 'No verified record'
      ? `${evidence[0]?.text || answer.answer}\n\nNext: ${answer.next}`
    : workflowOnlySources.has(answer.source) || answer.source === 'Admission support rules'
      ? `${evidence[0]?.text || answer.answer}\n\nNext: ${answer.next}`
      : `${answer.answer} Relevant verified record: ${evidence[0]?.title}. ${evidence[0]?.text.slice(0, 260)}${evidence[0]?.text.length > 260 ? '...' : ''}`;
  const groundedAnswer = evidence.length
    ? {
        ...answer,
        source: evidence[0].source,
        answer: generated || deterministicText,
        sourceUrl: evidence[0].sourceUrl || '',
        evidence: evidence.map((item) => pick(item, ['id', 'title', 'category', 'source', 'sourceUrl', 'score'])),
        officialLinks,
        model: generated ? config.openRouterModel : 'deterministic-rag-fallback',
      }
    : { ...answer, evidence: [], officialLinks, model: 'deterministic-rag-fallback' };
  audit('assistant.asked', 'assistant', generateId('ASK'), user, answer.source);
  return groundedAnswer;
}

function createKnowledge(body, user) {
  requireRole({ user }, ['admin']);
  const db = getDb();
  const record = {
    id: generateId('KB'),
    title: requireString(body.title, 'title', 180),
    category: requireString(body.category, 'category', 80),
    source: requireString(body.source || 'Admin verified source', 'source', 180),
    text: requireString(body.text, 'text', 5000),
    status: body.status || 'Published',
    updatedAt: nowIso(),
  };
  db.knowledge.unshift(record);
  saveDb();
  audit('knowledge.created', 'knowledge', record.id, user, record.title);
  return record;
}

function normalizeExtractedText(text) {
  return String(text || '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, 100000);
}

function runOcr(filePath) {
  try {
    return normalizeExtractedText(execFileSync('tesseract', [filePath, 'stdout', '-l', 'eng'], {
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 2 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    }));
  } catch {
    return '';
  }
}

function extractScannedPdfText(filePath) {
  const tempDir = path.join(officialSourceDir, `.ocr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    execFileSync('pdftoppm', ['-f', '1', '-l', '20', '-jpeg', '-r', '150', filePath, path.join(tempDir, 'page')], {
      timeout: 60000,
      maxBuffer: 512 * 1024,
      stdio: 'ignore',
    });
    const pages = fs.readdirSync(tempDir)
      .filter((name) => /^page-\d+\.jpg$/i.test(name))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    return normalizeExtractedText(pages.map((page) => runOcr(path.join(tempDir, page))).filter(Boolean).join('\n'));
  } catch {
    return '';
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function extractOfficialText(file, filePath) {
  if (file.mimeType === 'text/plain' || file.mimeType === 'text/csv') {
    return { text: normalizeExtractedText(file.content.toString('utf8')), status: 'Text extracted - admin review required' };
  }
  if (file.mimeType === 'application/pdf') {
    try {
      const text = execFileSync('pdftotext', ['-layout', filePath, '-'], {
        encoding: 'utf8',
        timeout: 15000,
        maxBuffer: 2 * 1024 * 1024,
      });
      const normalized = normalizeExtractedText(text);
      if (normalized.length >= 80) return { text: normalized, status: 'PDF text extracted - admin review required' };
    } catch {
      // Docker installs Poppler. Local development can still use manually supplied verified text.
    }
    const ocrText = extractScannedPdfText(filePath);
    if (ocrText) return { text: ocrText, status: 'PDF OCR extracted - admin review required' };
  }
  if (file.mimeType === 'image/jpeg' || file.mimeType === 'image/png') {
    const ocrText = runOcr(filePath);
    if (ocrText) return { text: ocrText, status: 'Image OCR extracted - admin review required' };
  }
  return { text: '', status: 'Manual verified text required for this file type' };
}

function chunkKnowledgeText(text, chunkSize = 2800) {
  const normalized = normalizeExtractedText(text);
  if (!normalized) return [];
  const chunks = [];
  for (let start = 0; start < normalized.length; start += chunkSize) {
    chunks.push(normalized.slice(start, Math.min(normalized.length, start + chunkSize)));
  }
  return chunks;
}

function publishOfficialSource(id, body, user) {
  requireRole({ user }, ['admin']);
  const db = getDb();
  const source = (db.officialSources || []).find((item) => item.id === id);
  if (!source) throw notFound('Official source not found.');
  const verifiedText = requireString(body.verifiedText || source.extractedText, 'verifiedText', 100000);
  const chunks = chunkKnowledgeText(verifiedText);
  if (chunks.length === 0) throw badRequest('Verified text could not be converted into retrieval records.');
  db.knowledge = (db.knowledge || []).filter((item) => item.sourceDocumentId !== source.id);
  const now = nowIso();
  const sourceLabel = `${source.sourceAuthority} - ${source.originalFileName}`;
  chunks.reverse().forEach((text, index) => {
    db.knowledge.unshift({
      id: generateId('KB'),
      sourceDocumentId: source.id,
      title: chunks.length === 1 ? source.title : `${source.title} (part ${chunks.length - index} of ${chunks.length})`,
      category: source.documentType,
      source: sourceLabel,
      text,
      status: 'Published',
      updatedAt: now,
    });
  });
  source.extractedText = verifiedText;
  source.status = 'Published';
  source.extractionStatus = `Admin verified and published (${chunks.length} retrieval ${chunks.length === 1 ? 'record' : 'records'})`;
  source.linkedKnowledgeCount = chunks.length;
  source.updatedAt = now;
  saveDb();
  audit('official_source.published', 'official_source', source.id, user, `${source.title}: ${chunks.length} retrieval records`);
  return source;
}

function createOfficialSourceFromUpload(fields, file, user) {
  requireRole({ user }, ['admin']);
  assertAllowedUpload(file, allowedOfficialMimeTypes, 'Official sources must be valid PDF, DOCX, XLSX, CSV, TXT, JPG, or PNG files.');

  const db = getDb();
  const now = nowIso();
  const id = generateId('SRC');
  const storedFileName = `${id}-${file.filename}`;
  fs.mkdirSync(officialSourceDir, { recursive: true });
  const filePath = path.join(officialSourceDir, storedFileName);
  fs.writeFileSync(filePath, file.content);

  const verifiedText = String(fields.verifiedText || '').trim();
  const extraction = extractOfficialText(file, filePath);
  const record = {
    id,
    title: requireString(fields.title, 'title', 180),
    documentType: requireString(fields.documentType, 'documentType', 80),
    academicYear: requireString(fields.academicYear || 'Not specified', 'academicYear', 30),
    sourceAuthority: requireString(fields.sourceAuthority || 'College admin upload', 'sourceAuthority', 180),
    originalFileName: file.filename,
    storedFileName,
    mimeType: file.mimeType,
    sizeBytes: file.content.length,
    status: 'Review',
    extractionStatus: verifiedText ? 'Verified text supplied - ready to publish' : extraction.status,
    extractedText: verifiedText || extraction.text,
    linkedKnowledgeCount: 0,
    uploadedBy: user.email,
    createdAt: now,
    updatedAt: now,
  };

  db.officialSources = db.officialSources || [];
  db.officialSources.unshift(record);
  saveDb();
  audit('official_source.uploaded', 'official_source', id, user, record.title);
  return verifiedText ? publishOfficialSource(id, { verifiedText }, user) : record;
}

function getOfficialSourceExtractedText(id, user) {
  requireRole({ user }, ['admin']);
  const source = (getDb().officialSources || []).find((item) => item.id === id);
  if (!source) throw notFound('Official source not found.');
  audit('official_source.extraction_opened', 'official_source', source.id, user, source.title);
  return pick(source, ['id', 'title', 'extractedText', 'extractionStatus', 'status']);
}

function getOfficialSourceFile(id, user) {
  requireRole({ user }, ['staff', 'admin']);
  const record = (getDb().officialSources || []).find((item) => item.id === id);
  if (!record) throw notFound('Official source not found.');
  if (!record.storedFileName) throw notFound('The original file is not stored locally for this source.');
  const filePath = path.resolve(officialSourceDir, record.storedFileName);
  if (!filePath.startsWith(officialSourceDir) || !fs.existsSync(filePath)) throw notFound('Official source file is unavailable.');
  audit('official_source.file_opened', 'official_source', record.id, user, record.title);
  return { __file: true, filePath, mimeType: record.mimeType || 'application/octet-stream', fileName: record.originalFileName };
}

function createAssistantAttachment(fields, file, user) {
  assertAllowedUpload(file, allowedMimeTypes, 'Only valid PDF, JPG, and PNG files are allowed.');
  const id = generateId('ATT');
  const storedFileName = `${id}-${file.filename}`;
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, storedFileName), file.content);
  const record = {
    id,
    ownerEmail: user.email,
    ownerName: user.name,
    fileName: file.filename,
    storedFileName,
    mimeType: file.mimeType,
    sizeBytes: file.content.length,
    note: String(fields.note || '').trim().slice(0, 1000),
    createdAt: nowIso(),
  };
  const db = getDb();
  db.assistantAttachments = db.assistantAttachments || [];
  db.assistantAttachments.unshift(record);
  saveDb();
  audit('assistant_attachment.uploaded', 'assistant_attachment', id, user, file.filename);
  return record;
}

function getAssistantAttachments(user) {
  const items = getDb().assistantAttachments || [];
  return ['staff', 'admin'].includes(user.role) ? items : items.filter((item) => item.ownerEmail === user.email);
}

function getAssistantAttachmentFile(id, user) {
  const record = (getDb().assistantAttachments || []).find((item) => item.id === id);
  if (!record) throw notFound('Assistant attachment not found.');
  if (!canAccessApplicantRecord(user, record.ownerEmail)) throw forbidden();
  const filePath = path.resolve(uploadDir, record.storedFileName);
  if (!filePath.startsWith(uploadDir) || !fs.existsSync(filePath)) throw notFound('Attachment file is unavailable.');
  audit('assistant_attachment.file_opened', 'assistant_attachment', record.id, user, record.fileName);
  return { __file: true, filePath, mimeType: record.mimeType, fileName: record.fileName };
}

async function handleApi(req) {
  const url = new URL(req.url, 'http://localhost');
  const user = getUserFromRequest(req);
  const context = { user };
  if (req.method === 'POST' && url.pathname === '/api/documents/upload') {
    const { fields, files } = parseMultipart(req, await readRawBody(req));
    return createDocumentFromUpload(fields, files.file, user);
  }
  if (req.method === 'POST' && url.pathname === '/api/official-sources/upload') {
    const { fields, files } = parseMultipart(req, await readRawBody(req));
    return createOfficialSourceFromUpload(fields, files.file, user);
  }
  if (req.method === 'POST' && url.pathname === '/api/assistant/attachments/upload') {
    const { fields, files } = parseMultipart(req, await readRawBody(req));
    return createAssistantAttachment(fields, files.file, user);
  }
  const body = await readJson(req);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return { status: 'ok', service: 'campusguard-backend', time: nowIso() };
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/login') return handleAuthLogin(body);
  if (req.method === 'POST' && url.pathname === '/api/auth/signup') return handleAuthSignup(body);
  if (req.method === 'POST' && url.pathname === '/api/auth/refresh') return refreshSession(body, req);
  if (req.method === 'POST' && url.pathname === '/api/auth/logout') return logoutSession(body, req);
  if (req.method === 'GET' && url.pathname === '/api/me') return { user: sanitizeUser(requireAuth(context)) };
  if (req.method === 'POST' && url.pathname === '/api/assistant/ask') {
    enforceRateLimit(assistantAttempts, user.id, config.assistantRateLimitMax, 60_000);
    return answerAdmissionQuestion(body, user);
  }
  if (req.method === 'GET' && url.pathname === '/api/conversations') return listConversations(user, url.searchParams.get('offset'));
  const conversationMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)$/);
  if (req.method === 'GET' && conversationMatch) {
    return pick(getConversation(conversationMatch[1], user), ['id', 'title', 'createdAt', 'updatedAt', 'messages']);
  }
  if (req.method === 'POST' && url.pathname === '/api/conversations/ask') {
    enforceRateLimit(assistantAttempts, user.id, config.assistantRateLimitMax, 60_000);
    return askWithHistory(body, user, answerAdmissionQuestion);
  }
  if (req.method === 'GET' && url.pathname === '/api/assistant/attachments') return { items: getAssistantAttachments(user) };
  const assistantAttachmentFileMatch = url.pathname.match(/^\/api\/assistant\/attachments\/([^/]+)\/file$/);
  if (req.method === 'GET' && assistantAttachmentFileMatch) return getAssistantAttachmentFile(assistantAttachmentFileMatch[1], user);
  if (req.method === 'GET' && url.pathname === '/api/knowledge') {
    requireRole({ user }, ['staff', 'admin']);
    return { items: getDb().knowledge || [] };
  }
  if (req.method === 'POST' && url.pathname === '/api/knowledge') return createKnowledge(body, user);
  if (req.method === 'GET' && url.pathname === '/api/official-sources') {
    requireRole({ user }, ['staff', 'admin']);
    return { items: getDb().officialSources || [] };
  }
  const officialSourceExtractionMatch = url.pathname.match(/^\/api\/official-sources\/([^/]+)\/extracted-text$/);
  if (req.method === 'GET' && officialSourceExtractionMatch) return getOfficialSourceExtractedText(officialSourceExtractionMatch[1], user);
  const officialSourcePublishMatch = url.pathname.match(/^\/api\/official-sources\/([^/]+)\/publish$/);
  if (req.method === 'PATCH' && officialSourcePublishMatch) return publishOfficialSource(officialSourcePublishMatch[1], body, user);
  const officialSourceFileMatch = url.pathname.match(/^\/api\/official-sources\/([^/]+)\/file$/);
  if (req.method === 'GET' && officialSourceFileMatch) return getOfficialSourceFile(officialSourceFileMatch[1], user);

  if (req.method === 'GET' && url.pathname === '/api/inquiries') return { items: filterRecordsForUser(getDb().inquiries, user) };
  if (req.method === 'POST' && url.pathname === '/api/inquiries') return createInquiry(body, user);
  const inquiryStatusMatch = url.pathname.match(/^\/api\/inquiries\/([^/]+)\/status$/);
  if (req.method === 'PATCH' && inquiryStatusMatch) return updateInquiryStatus(inquiryStatusMatch[1], body, user);

  if (req.method === 'GET' && url.pathname === '/api/admission-workspace') return getAdmissionWorkspace(user);
  if (req.method === 'PATCH' && url.pathname === '/api/admission-workspace') return updateAdmissionWorkspace(body, user);

  if (req.method === 'GET' && url.pathname === '/api/documents') {
    const records = filterRecordsForUser(getDb().documents, user);
    return { items: ['staff', 'admin'].includes(user.role) ? records.filter((item) => item.status !== 'Uploaded (not submitted)') : records };
  }
  if (req.method === 'POST' && url.pathname === '/api/documents/submit') return submitDocumentsForReview(user);
  if (req.method === 'POST' && url.pathname === '/api/documents') return createDocument(body, user);
  const documentStatusMatch = url.pathname.match(/^\/api\/documents\/([^/]+)\/status$/);
  if (req.method === 'PATCH' && documentStatusMatch) return updateDocumentStatus(documentStatusMatch[1], body, user);
  const documentFileMatch = url.pathname.match(/^\/api\/documents\/([^/]+)\/file$/);
  if (req.method === 'GET' && documentFileMatch) return getDocumentFile(documentFileMatch[1], user);
  const documentMatch = url.pathname.match(/^\/api\/documents\/([^/]+)$/);
  if (req.method === 'DELETE' && documentMatch) return deleteDocument(documentMatch[1], user);

  if (req.method === 'GET' && url.pathname === '/api/content') {
    requireAuth(context);
    return { items: getDb().content };
  }
  if (req.method === 'POST' && url.pathname === '/api/content') return createContent(body, user);
  const contentMatch = url.pathname.match(/^\/api\/content\/([^/]+)$/);
  if (req.method === 'PATCH' && contentMatch) return updateContent(contentMatch[1], body, user);

  if (req.method === 'GET' && url.pathname === '/api/reports') return buildReports(user);
  if (req.method === 'GET' && url.pathname === '/api/audit-logs') {
    requireRole({ user }, ['staff', 'admin']);
    return { items: (getDb().auditLogs || []).slice(0, 100) };
  }

  throw notFound('API route not found.');
}

export function createServer() {
  loadDb();
  return http.createServer(async (req, res) => {
    const requestId = generateId('REQ');
    res.setHeader('X-Request-Id', requestId);
    if (req.url.startsWith('/api/conversations')) res.setHeader('Cache-Control', 'private, no-store');
    attachCors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    try {
      const payload = await handleApi(req);
      if (payload?.__file) {
        res.writeHead(200, {
          'Content-Type': payload.mimeType,
          'Content-Length': fs.statSync(payload.filePath).size,
          'Content-Disposition': `inline; filename="${sanitizeFileName(payload.fileName)}"`,
          'Cache-Control': 'private, no-store',
        });
        fs.createReadStream(payload.filePath).pipe(res);
        return;
      }
      if (payload?.refreshToken) {
        res.setHeader('Set-Cookie', refreshCookie(payload.refreshToken, 60 * 60 * 24 * 14));
      } else if (payload?.clearRefreshCookie) {
        res.setHeader('Set-Cookie', refreshCookie('', 0));
      }
      const { refreshToken, clearRefreshCookie, ...responsePayload } = payload || {};
      jsonResponse(res, 200, { data: responsePayload });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const code = error instanceof HttpError ? error.code : 'INTERNAL_ERROR';
      const message = error instanceof HttpError ? error.message : 'Unexpected server error.';
      jsonResponse(res, status, { error: { code, message } });
    }
  });
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (currentFile === entryFile) {
  createServer().listen(config.port, config.host, () => {
    console.log(`CampusGuard backend listening on http://${config.host}:${config.port}`);
  });
}
