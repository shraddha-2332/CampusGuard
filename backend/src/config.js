import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const nodeEnv = process.env.NODE_ENV || 'development';
const configuredTokenSecret = process.env.TOKEN_SECRET;
const configuredCorsOrigins = process.env.CORS_ORIGIN || 'http://127.0.0.1:5173';

if (nodeEnv === 'production' && !configuredTokenSecret) {
  throw new Error('TOKEN_SECRET must be configured when NODE_ENV=production.');
}

export const config = {
  nodeEnv,
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || (nodeEnv === 'production' ? '0.0.0.0' : '127.0.0.1'),
  corsOrigins: configuredCorsOrigins.split(',').map((origin) => origin.trim()).filter(Boolean),
  // A development fallback keeps the local academic demo runnable. Production must supply a secret.
  tokenSecret: configuredTokenSecret || 'campusguard-development-only-secret',
  dataFile: path.resolve(rootDir, process.env.DATA_FILE || './data/db.json'),
  databaseFile: path.resolve(rootDir, process.env.DATABASE_FILE || './data/campusguard.sqlite'),
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterModel: process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-27b:free',
  openRouterReferer: process.env.OPENROUTER_REFERER || 'http://127.0.0.1:5173',
  openRouterTitle: process.env.OPENROUTER_TITLE || 'CampusGuard',
  maxBodyBytes: 15 * 1024 * 1024,
  assistantRateLimitMax: Number(process.env.ASSISTANT_RATE_LIMIT_MAX || 30),
};
