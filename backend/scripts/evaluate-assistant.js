import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/server.js';
import { config } from '../src/config.js';
import { resetDbForTests } from '../src/store.js';
import { createSeedData } from '../src/seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const expectedCategoryByIntent = {
  eligibility: 'eligibility',
  cutoff: 'cutoff',
  seat_matrix: 'seat matrix',
  cap: 'admissions',
  acap: 'admissions',
  documents: 'documents',
  document_status: 'documents',
  fees: 'fees',
  scholarship: 'scholarship',
  hostel: 'facilities',
  programs: 'programs',
  placement: 'placement',
  transport: 'facilities',
  contact: 'contact',
  deadlines: 'admissions',
};

function repairLegacyEncoding(value) {
  return value.includes('à¤') ? Buffer.from(value, 'latin1').toString('utf8') : value;
}

function createWorkflowCases() {
  const states = [
    { detail: 'I am at the last step of admission.', expectedText: 'allotment or institute-level merit' },
    { detail: 'I received my CAP allotment.', expectedText: 'seat acceptance or freeze' },
    { detail: 'I received allotment, accepted the seat, and uploaded all documents.', expectedText: 'approved fee payment' },
    { detail: 'I received allotment, accepted the seat, uploaded documents, and paid the fee.', expectedText: 'institute reporting' },
    { detail: 'I received allotment, accepted the seat, uploaded documents, paid the fee, and completed reporting.', expectedText: 'all main workflow stages appear complete' },
  ];
  const forms = [
    (detail) => `My category is Open. ${detail} What is remaining?`,
    (detail) => `${detail} What should I do next for admission?`,
    (detail) => `Please show my admission reporting checklist. ${detail}`,
    (detail) => `${detail} Which final admission steps are pending?`,
    (detail) => `${detail} Tell me the remaining CAP reporting workflow.`,
    (detail) => `${detail} I need the final admission checklist.`,
    (detail) => `${detail} What else should I confirm before institute reporting?`,
  ];
  const languagePrefixes = [
    ['', 'en'],
    ['Mala sang, ', 'hinglish'],
    ['\u092e\u0932\u093e \u0938\u093e\u0902\u0917\u093e, ', 'mr'],
    ['\u092e\u0941\u091d\u0947 \u092c\u0924\u093e\u0907\u090f, ', 'hi'],
  ];
  const cases = [];
  let index = 1;
  for (const state of states) {
    for (const form of forms) {
      for (const [prefix, language] of languagePrefixes) {
        cases.push({
          id: `CGW-${String(index).padStart(3, '0')}`,
          intent: 'workflow',
          language,
          question: `${prefix}${form(state.detail)}`,
          expectedCategory: 'documents',
          expectedAction: 'documents',
          mustInclude: state.expectedText,
        });
        index += 1;
      }
    }
  }
  return cases;
}

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  return { response, payload: await response.json() };
}

async function main() {
  const benchmarkPath = path.resolve(__dirname, '..', 'evaluation', 'campusguard-qa-360.json');
  const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
  const cases = [...benchmark.records, ...createWorkflowCases()];
  config.databaseFile = path.resolve(__dirname, '..', 'data', 'campusguard.evaluation.sqlite');
  config.openRouterApiKey = '';
  config.assistantRateLimitMax = 10_000;
  resetDbForTests(createSeedData());

  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await request(base, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'applicant@example.com', password: 'campusguard' }),
    });
    const token = login.payload.data.token;
    const failures = [];
    for (const item of cases) {
      const question = repairLegacyEncoding(item.question);
      const { response, payload } = await request(base, '/api/assistant/ask', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
      const expectedCategory = item.expectedCategory || expectedCategoryByIntent[item.intent];
      const actualCategory = String(payload.data?.evidence?.[0]?.category || '').toLowerCase();
      const answer = String(payload.data?.answer || '').toLowerCase();
      const expectedText = String(item.mustInclude || '').toLowerCase();
      const actionMatches = !item.expectedAction || payload.data?.actionView === item.expectedAction;
      if (response.status !== 200 || actualCategory !== expectedCategory || !actionMatches || (expectedText && !answer.includes(expectedText))) {
        failures.push({ id: item.id, intent: item.intent, question, expectedCategory, actualCategory, status: response.status, action: payload.data?.actionView, expectedText });
      }
    }
    const failuresByIntent = failures.reduce((counts, item) => {
      counts[item.intent] = (counts[item.intent] || 0) + 1;
      return counts;
    }, {});
    const result = { total: cases.length, passed: cases.length - failures.length, failed: failures.length, failuresByIntent, failures: failures.slice(0, 20) };
    console.log(JSON.stringify(result, null, 2));
    if (failures.length > 0) process.exitCode = 1;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
