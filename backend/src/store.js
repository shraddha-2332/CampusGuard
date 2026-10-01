import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { createSeedData, seedKnowledge, seedOfficialSources } from './seed.js';

let db = null;
let sqlite = null;

function openDatabase() {
  if (sqlite) return sqlite;
  fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true });
  sqlite = new DatabaseSync(config.databaseFile);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      name TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return sqlite;
}

function readCollection(name) {
  const row = openDatabase().prepare('SELECT data FROM collections WHERE name = ?').get(name);
  return row ? JSON.parse(row.data) : null;
}

function writeCollection(name, data) {
  openDatabase()
    .prepare('INSERT OR REPLACE INTO collections (name, data, updated_at) VALUES (?, ?, ?)')
    .run(name, JSON.stringify(data), new Date().toISOString());
}

function normalizeDb(nextDb) {
  const existingKnowledge = nextDb.knowledge || [];
  const seedKnowledgeById = new Map(seedKnowledge.map((item) => [item.id, item]));
  const mergedKnowledge = existingKnowledge.map((item) => {
    const seedItem = seedKnowledgeById.get(item.id);
    if (!seedItem) return item;
    seedKnowledgeById.delete(item.id);
    return { ...item, ...seedItem, updatedAt: item.updatedAt || new Date().toISOString() };
  });
  const missingSeedKnowledge = [...seedKnowledgeById.values()]
    .map((item) => ({ ...item, updatedAt: new Date().toISOString() }));
  const migratedOfficialSources = (nextDb.officialSources || []).map((item) => (
    item.id === 'SRC-10' && item.title === 'Official contact and travel information'
      ? { ...item, id: 'SRC-12' }
      : item
  ));
  const existingOfficialSources = [...new Map(migratedOfficialSources.map((item) => [item.id, item])).values()];
  const existingSourceIds = new Set(existingOfficialSources.map((item) => item.id));
  const missingOfficialSources = seedOfficialSources
    .filter((item) => !existingSourceIds.has(item.id))
    .map((item) => ({ ...item, uploadedBy: 'system', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
  return {
    users: (nextDb.users || []).map((user) => {
      if (user.id === 'USR-STF') return { ...user, name: 'Shobhana Raichurkar' };
      if (user.id === 'USR-ADM') return { ...user, name: 'Mundhe' };
      return user;
    }),
    inquiries: nextDb.inquiries || [],
    documents: (nextDb.documents || []).map((item) => item.status === 'Uploaded for review'
      ? { ...item, status: 'Submitted for review', submittedAt: item.submittedAt || item.updatedAt || item.createdAt }
      : item),
    content: nextDb.content || [],
    auditLogs: nextDb.auditLogs || [],
    refreshTokens: nextDb.refreshTokens || [],
    assistantAttachments: nextDb.assistantAttachments || [],
    admissionWorkspaces: nextDb.admissionWorkspaces || [],
    conversations: nextDb.conversations || [],
    knowledge: [...mergedKnowledge, ...missingSeedKnowledge],
    officialSources: [...existingOfficialSources, ...missingOfficialSources],
  };
}

export function loadDb() {
  if (db) return db;
  const persisted = readCollection('app');
  if (persisted) {
    db = normalizeDb(persisted);
    return db;
  }
  db = normalizeDb(createSeedData());
  saveDb();
  return db;
}

export function saveDb() {
  if (!db) return;
  writeCollection('app', normalizeDb(db));
}

export function getDb() {
  return loadDb();
}

export function resetDbForTests(nextDb = createSeedData()) {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
  }
  db = normalizeDb(nextDb);
}
