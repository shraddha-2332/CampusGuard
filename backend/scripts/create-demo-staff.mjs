import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from '../src/auth.js';
import { config } from '../src/config.js';

// Run only with the backend stopped: its in-memory collection would overwrite external changes.
if (!process.argv.includes('--backend-stopped')) {
  throw new Error('Stop the backend before running with --backend-stopped.');
}
const database = new DatabaseSync(config.databaseFile);
try {
  database.exec('BEGIN IMMEDIATE');
  const row = database.prepare("SELECT data FROM collections WHERE name = 'app'").get();
  if (!row) throw new Error('Initialize the application database first.');
  const data = JSON.parse(row.data);
  const created = [];
  for (const account of [
    { name: 'Shobhana Raichurkar', email: 'shobhana.raichurkar@example.com', role: 'staff' },
    { name: 'Mundhe', email: 'dean.mundhe@example.com', role: 'admin' },
  ]) {
    if (data.users.some((user) => user.email.toLowerCase() === account.email)) {
      created.push({ email: account.email, status: 'Already exists; unchanged' });
      continue;
    }
    const password = randomBytes(12).toString('base64url');
    const user = { ...account, id: `USR-${randomUUID()}`, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
    data.users.push(user);
    data.auditLogs ||= [];
    data.auditLogs.unshift({ id: `AUD-${randomUUID()}`, action: 'user.demo_provisioned', entity: 'user', entityId: user.id, actor: 'local-operator', detail: `Test account: ${account.email}`, createdAt: user.createdAt });
    created.push({ ...account, password });
  }
  database.prepare("UPDATE collections SET data = ?, updated_at = ? WHERE name = 'app'").run(JSON.stringify(data), new Date().toISOString());
  database.exec('COMMIT');
  console.log(JSON.stringify(created));
} catch (error) {
  database.exec('ROLLBACK');
  throw error;
} finally {
  database.close();
}
