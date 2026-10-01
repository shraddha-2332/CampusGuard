import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(backendDir, 'backups', `campusguard-${stamp}`);
const paths = ['data', 'uploads', 'official-sources'];

fs.mkdirSync(backupDir, { recursive: true });
paths.forEach((name) => {
  const source = path.join(backendDir, name);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(backupDir, name), { recursive: true });
});

console.log(`CampusGuard backup created at ${backupDir}`);
