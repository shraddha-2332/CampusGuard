import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, test } from 'node:test';
import { createServer, resetRuntimeStateForTests } from '../src/server.js';
import { config } from '../src/config.js';
import { resetDbForTests } from '../src/store.js';
import { createSeedData } from '../src/seed.js';
import { DatabaseSync } from 'node:sqlite';

async function withServer(fn) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  return { response, payload };
}

async function login(base, email) {
  const { payload } = await request(base, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'campusguard' }),
  });
  return payload.data.token;
}

beforeEach(() => {
  config.databaseFile = path.resolve(process.cwd(), 'data', 'campusguard.test.sqlite');
  resetRuntimeStateForTests();
  resetDbForTests(createSeedData());
});

test('health endpoint works without auth', async () => {
  await withServer(async (base) => {
    const { response, payload } = await request(base, '/api/health');
    assert.equal(response.status, 200);
    assert.equal(payload.data.status, 'ok');
  });
});

test('chat history persists exchanges, preserves sources, and supports reopening and continuing', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const headers = { Authorization: `Bearer ${token}` };
    const first = await request(base, '/api/conversations/ask', { method: 'POST', headers, body: JSON.stringify({ question: 'bus facility?' }) });
    assert.equal(first.response.status, 200);
    const chat = first.payload.data.conversation;
    assert.equal(chat.messages.length, 2);
    assert.ok(chat.messages[1].source);
    const continued = await request(base, '/api/conversations/ask', { method: 'POST', headers, body: JSON.stringify({ question: 'hostel fees?', conversationId: chat.id }) });
    assert.equal(continued.payload.data.conversation.messages.length, 4);
    const reopened = await request(base, `/api/conversations/${chat.id}`, { headers });
    assert.deepEqual(reopened.payload.data.messages, continued.payload.data.conversation.messages);
    const list = await request(base, '/api/conversations', { headers });
    assert.equal(list.payload.data.items.length, 1);
    assert.equal(list.payload.data.items[0].id, chat.id);
    assert.equal(list.payload.data.items[0].messages, undefined);
    const disk = new DatabaseSync(config.databaseFile);
    try {
      const saved = JSON.parse(disk.prepare("SELECT data FROM collections WHERE name = 'app'").get().data);
      assert.equal(saved.conversations.find((item) => item.id === chat.id).messages.length, 4);
    } finally { disk.close(); }
    const invalid = await request(base, '/api/conversations/ask', { method: 'POST', headers, body: JSON.stringify({ question: ' ' }) });
    assert.equal(invalid.response.status, 400);
  });
});

test('assistant returns route-specific official admission links and saves them in history', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const headers = { Authorization: `Bearer ${token}` };
    const cases = [
      ['What is the B.Tech CAP deadline?', 'https://fe2026.mahacet.org/StaticPages/HomePage'],
      ['What is the DSE admission schedule?', 'https://dse2026.mahacet.org.in/'],
      ['What is the Polytechnic admission deadline?', 'https://poly26.dtemaharashtra.gov.in/poly_26/home'],
      ['Show the ACAP vacancy notice.', 'https://mitcorer.edu.in/acap-institute-level-admission.php'],
    ];
    for (const [question, expectedUrl] of cases) {
      const result = await request(base, '/api/conversations/ask', { method: 'POST', headers, body: JSON.stringify({ question }) });
      assert.equal(result.response.status, 200);
      const assistant = result.payload.data.conversation.messages.at(-1);
      assert.ok(assistant.officialLinks.some((link) => link.url === expectedUrl));
    }
    const unrelated = await request(base, '/api/assistant/ask', { method: 'POST', headers, body: JSON.stringify({ question: 'What is the hostel fee?' }) });
    assert.deepEqual(unrelated.payload.data.officialLinks, []);
  });
});

test('assistant answers engineering attendance from verified university rules', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const headers = { Authorization: `Bearer ${token}` };
    const result = await request(base, '/api/conversations/ask', {
      method: 'POST',
      headers,
      body: JSON.stringify({ question: 'What is the minimum attendance requirement?' }),
    });
    assert.equal(result.response.status, 200);
    const assistant = result.payload.data.conversation.messages.at(-1);
    assert.match(assistant.text, /75%/);
    assert.match(assistant.text, /XX grade \(Detained\)/);
    assert.match(assistant.text, /biometric attendance/i);
    assert.ok(assistant.officialLinks.some((link) => link.url.includes('CBCS%20UG%20Rules.pdf')));
    assert.ok(assistant.officialLinks.some((link) => link.url.includes('LMS%20Circular')));
  });
});

test('history is private to each account, including staff and admin, and requires authentication', async () => {
  await withServer(async (base) => {
    const signup = await request(base, '/api/auth/signup', { method: 'POST', body: JSON.stringify({ name: 'Second applicant', email: 'second-applicant@example.com', password: 'campusguard', role: 'applicant' }) });
    assert.equal(signup.response.status, 200);
    const accounts = ['applicant@example.com', 'second-applicant@example.com', 'parent@example.com', 'staff@mitcorer.edu.in', 'admin@mitcorer.edu.in'];
    const tokens = [];
    const ids = [];
    for (const email of accounts) {
      const token = await login(base, email);
      tokens.push(token);
      const created = await request(base, '/api/conversations/ask', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ question: 'bus facility?', ownerId: 'USR-ADM' }) });
      assert.equal(created.response.status, 200);
      ids.push(created.payload.data.conversation.id);
    }
    for (let index = 0; index < tokens.length; index++) {
      const headers = { Authorization: `Bearer ${tokens[index]}` };
      const list = await request(base, '/api/conversations', { headers });
      assert.deepEqual(list.payload.data.items.map((item) => item.id), [ids[index]]);
      for (const id of ids.filter((item) => item !== ids[index])) {
        assert.equal((await request(base, `/api/conversations/${id}`, { headers })).response.status, 404);
        assert.equal((await request(base, '/api/conversations/ask', { method: 'POST', headers, body: JSON.stringify({ question: 'fees?', conversationId: id }) })).response.status, 404);
      }
    }
    assert.equal((await request(base, '/api/conversations')).response.status, 401);
    assert.equal((await request(base, `/api/conversations/${ids[0]}`)).response.status, 401);
  });
});

test('malformed access tokens receive an authentication error instead of a server error', async () => {
  await withServer(async (base) => {
    const { response, payload } = await request(base, '/api/me', {
      headers: { Authorization: 'Bearer not-a-valid-token' },
    });
    assert.equal(response.status, 401);
    assert.equal(payload.error.code, 'UNAUTHORIZED');
  });
});

test('inquiry lifecycle returns assigned staff replies only to the owning applicant', async () => {
  await withServer(async (base) => {
    const applicantToken = await login(base, 'applicant@example.com');
    const staffToken = await login(base, 'staff@mitcorer.edu.in');
    const parentToken = await login(base, 'parent@example.com');
    const created = await request(base, '/api/inquiries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${applicantToken}` },
      body: JSON.stringify({ topic: 'Documents', question: 'Is allotment letter enough?', contact: 'applicant@example.com', role: 'staff' }),
    });
    assert.equal(created.response.status, 200);
    assert.equal(created.payload.data.status, 'Unassigned');
    assert.equal(created.payload.data.role, 'applicant');
    const updated = await request(base, `/api/inquiries/${created.payload.data.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({ status: 'Resolved', assignedTo: 'Admission Staff', reply: 'Bring the allotment letter with the full reporting checklist.' }),
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.payload.data.status, 'Resolved');
    assert.equal(updated.payload.data.assignedTo, 'Admission Staff');
    assert.equal(updated.payload.data.messages.length, 1);
    const applicantList = await request(base, '/api/inquiries', { headers: { Authorization: `Bearer ${applicantToken}` } });
    const owned = applicantList.payload.data.items.find((item) => item.id === created.payload.data.id);
    assert.equal(owned.messages[0].text, 'Bring the allotment letter with the full reporting checklist.');
    const parentList = await request(base, '/api/inquiries', { headers: { Authorization: `Bearer ${parentToken}` } });
    assert.equal(parentList.payload.data.items.some((item) => item.id === created.payload.data.id), false);
  });
});

test('applicant cannot access staff reports', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/reports', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 403);
    assert.equal(payload.error.code, 'FORBIDDEN');
  });
});

test('admission workspace persists per user and is unavailable to staff', async () => {
  await withServer(async (base) => {
    const applicantToken = await login(base, 'applicant@example.com');
    const parentToken = await login(base, 'parent@example.com');
    const staffToken = await login(base, 'staff@mitcorer.edu.in');
    const saved = await request(base, '/api/admission-workspace', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${applicantToken}` },
      body: JSON.stringify({ section: 'programs', value: { preferences: [{ choiceCode: '0690124210', name: 'Computer Science and Engineering' }] } }),
    });
    assert.equal(saved.response.status, 200);
    const applicantWorkspace = await request(base, '/api/admission-workspace', { headers: { Authorization: `Bearer ${applicantToken}` } });
    assert.equal(applicantWorkspace.payload.data.programs.preferences[0].choiceCode, '0690124210');
    const parentWorkspace = await request(base, '/api/admission-workspace', { headers: { Authorization: `Bearer ${parentToken}` } });
    assert.deepEqual(parentWorkspace.payload.data.programs.preferences, []);
    assert.equal((await request(base, '/api/admission-workspace', { headers: { Authorization: `Bearer ${staffToken}` } })).response.status, 403);
  });
});

test('content records require an authenticated user', async () => {
  await withServer(async (base) => {
    const { response, payload } = await request(base, '/api/content');
    assert.equal(response.status, 401);
    assert.equal(payload.error.code, 'UNAUTHORIZED');
  });
});

test('staff can read audit logs after workflow actions', async () => {
  await withServer(async (base) => {
    const applicantToken = await login(base, 'applicant@example.com');
    const staffToken = await login(base, 'staff@mitcorer.edu.in');
    await request(base, '/api/inquiries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${applicantToken}` },
      body: JSON.stringify({ topic: 'Fees', question: 'What amount should I keep ready?', contact: 'applicant@example.com' }),
    });
    const { response, payload } = await request(base, '/api/audit-logs', {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(response.status, 200);
    assert.ok(payload.data.items.some((item) => item.action === 'inquiry.created'));
  });
});

test('assistant returns routed guidance', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'What fees should I pay for hostel and mess?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.actionView, 'visit');
    assert.ok(payload.data.evidence.length > 0);
  });
});

test('assistant answers percentile and CSE questions without default staff escalation', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'If I got 20 percentile then am I eligible for CSE department admission?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.actionView, 'programs');
    assert.equal(payload.data.actionLabel, 'Check programs');
    assert.match(payload.data.answer, /percentile alone/i);
    assert.doesNotMatch(payload.data.next, /staff request/i);
    assert.equal(payload.data.evidence[0].category, 'Eligibility');
  });
});

test('assistant routes Marathi eligibility questions to verified eligibility evidence', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'मला 20 टक्केवारी मिळाली तर मी CSE प्रवेशासाठी पात्र आहे का?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.actionView, 'programs');
    assert.equal(payload.data.evidence[0].category, 'Eligibility');
  });
});

test('assistant answers SC category fee questions without inventing a semester split', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'I am from SC category, I am a boy and want CSE admission. How much fee will I pay per semester?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.actionView, 'fees');
    assert.match(payload.data.answer, /INR 8,000 for First Year Engineering/i);
    assert.match(payload.data.answer, /INR 10,000 for Direct Second Year Engineering/i);
    assert.match(payload.data.answer, /not semester-wise/i);
    assert.equal(payload.data.evidence[0].category, 'Fees');
  });
});

test('assistant uses the approved fee matrix for common category and route combinations', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const cases = [
      ['I am OBC and a boy. What is my first year engineering fee?', /INR 61,109/i],
      ['I am EWS girl. What is the FY BTech fee?', /INR 17,217/i],
      ['What is the Direct Second Year TFWS fee?', /INR 18,362/i],
      ['What is the open category DSE engineering fee?', /INR 98,000/i],
    ];
    for (const [question, expectedAmount] of cases) {
      const { response, payload } = await request(base, '/api/assistant/ask', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
      assert.equal(response.status, 200, question);
      assert.match(payload.data.answer, expectedAmount, question);
      assert.match(payload.data.answer, /not a semester-wise schedule/i, question);
      assert.equal(payload.data.evidence[0].category, 'Fees', question);
    }
  });
});

test('assistant keeps hostel and mess costs separate from academic-fee questions', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'What are the hostel and mess fees?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.evidence[0].id, 'KB-3');
    assert.match(payload.data.answer, /hostel total of INR 40,000/i);
    assert.match(payload.data.answer, /mess fees are INR 42,000 per year/i);
    assert.doesNotMatch(payload.data.answer, /Open or OMS total/i);
  });
});

test('assistant returns the complete historical seat matrix instead of one CSE intake record', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'Show the MITCORER seat matrix.' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.evidence[0].id, 'KB-6');
    assert.match(payload.data.answer, /Civil Engineering - sanctioned intake 30/i);
    assert.match(payload.data.answer, /Electronics and Telecommunication Engineering - intake 60/i);
    assert.match(payload.data.answer, /historical AY 2024-25/i);
    assert.doesNotMatch(payload.data.answer, /^The MITCORER FY B\.Tech admissions page/i);
  });
});

test('assistant retrieves current official program and contact records', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const programs = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'What is the current intake and choice code for CSE B.Tech?' }),
    });
    assert.equal(programs.response.status, 200);
    assert.equal(programs.payload.data.evidence[0].category, 'Programs');
    assert.equal(programs.payload.data.sourceUrl, 'https://mitcorer.edu.in/fy-btech.php');
    assert.match(programs.payload.data.answer, /sanctioned intake 120/i);

    const contact = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'What is the official MITCORER admission phone number and address?' }),
    });
    assert.equal(contact.response.status, 200);
    assert.equal(contact.payload.data.evidence[0].category, 'Contact');
    assert.match(contact.payload.data.answer, /84599 67882/);
  });
});

test('assistant answers bus questions without mixing in hostel details', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'Does MITCORER have a bus facility and what are the routes?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.actionLabel, 'Request bus details');
    assert.match(payload.data.answer, /lists a bus facility/i);
    assert.match(payload.data.answer, /does not give bus routes/i);
    assert.doesNotMatch(payload.data.answer, /hostel/i);
    assert.equal(payload.data.evidence[0].title, 'MITCORER bus facility');
  });
});

test('official-fact routing keeps distinct website questions distinct', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const cases = [
      ['Does the campus provide Wi-Fi?', 'MITCORER campus internet and Wi-Fi', /internet facilities are available/i, /hostel/i],
      ['What does the MITCORER library provide?', 'MITCORER library and digital resources', /digital resources and journals/i, /bus facility/i],
      ['What documents are needed for SC category admission?', 'MITCORER SC and ST admission documents', /caste certificate and caste validity/i, /non-creamy/i],
      ['Does the college provide placement assistance and internships?', 'MITCORER placement assistance and internships', /Training and Placement Cell/i, /hostel/i],
      ['Which exams are accepted for engineering admission?', 'MITCORER admission entrance examinations', /MHT-CET or JEE Main/i, /bus route/i],
    ];
    for (const [question, expectedTitle, expectedText, forbiddenText] of cases) {
      const { response, payload } = await request(base, '/api/assistant/ask', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
      assert.equal(response.status, 200, question);
      assert.equal(payload.data.evidence[0].title, expectedTitle, question);
      assert.match(payload.data.answer, expectedText, question);
      assert.doesNotMatch(payload.data.answer, forbiddenText, question);
    }
  });
});

test('assistant category regression suite routes core admission questions to the intended verified record', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const cases = [
      ['What is the CAP round process?', 'KB-29'],
      ['What is ACAP and institute-level admission?', 'KB-14'],
      ['What are the required admission documents?', 'KB-1'],
      ['What scholarship support is available?', 'KB-18'],
      ['What facilities are available in the hostel?', 'KB-23'],
      ['Show all B.Tech programs and choice codes.', 'KB-10'],
      ['Which Polytechnic courses are available?', 'KB-12'],
      ['What is the DSE CSE choice code?', 'KB-11'],
      ['Which companies visit for placement and what is the package?', 'KB-16'],
      ['Does MITCORER provide a bus facility?', 'KB-19'],
      ['Does the campus provide Wi-Fi?', 'KB-21'],
      ['Are laboratories and workshops available?', 'KB-22'],
      ['What is the official admission phone number?', 'KB-17'],
      ['What is the current admission deadline?', 'KB-30'],
    ];
    for (const [question, expectedId] of cases) {
      const { response, payload } = await request(base, '/api/assistant/ask', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
      assert.equal(response.status, 200, question);
      assert.equal(payload.data.evidence[0]?.id, expectedId, question);
    }
  });
});

test('assistant does not attach unrelated evidence to an unsupported question', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'What will the weather be in Barshi on my joining day?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.source, 'No verified record');
    assert.equal(payload.data.evidence.length, 0);
    assert.match(payload.data.answer, /do not have a verified official record/i);
  });
});

test('assistant answers final admission-step questions with a reporting checklist', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: "My category is Open. I am at the last step of admission; what else is remaining?" }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.evidence[0]?.id, 'KB-1');
    assert.equal(payload.data.actionView, 'documents');
    assert.match(payload.data.answer, /allotment or institute-level merit\/vacancy confirmation/i);
    assert.match(payload.data.answer, /10th marksheet/i);
    assert.match(payload.data.answer, /approved fee payment/i);
    assert.doesNotMatch(payload.data.answer, /do not have a verified official record/i);
  });
});

test('assistant identifies only the remaining admission workflow stages stated by the applicant', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const cases = [
      ['I received my CAP allotment. What should I do next for admission?', /seat acceptance or freeze\/betterment/i],
      ['I received allotment, accepted the seat, uploaded documents, paid the fee, and completed reporting. I need the final admission checklist.', /all main workflow stages appear complete/i],
    ];
    for (const [question, expectedText] of cases) {
      const { response, payload } = await request(base, '/api/assistant/ask', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
      assert.equal(response.status, 200, question);
      assert.equal(payload.data.evidence[0]?.id, 'KB-1', question);
      assert.equal(payload.data.actionView, 'documents', question);
      assert.match(payload.data.answer, expectedText, question);
    }
  });
});

test('assistant routes real Marathi and Hindi seat-matrix and deadline questions', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const cases = [
      ['CSE \u091c\u093e\u0917\u093e \u0906\u0923\u093f \u092a\u094d\u0930\u0935\u0947\u0936 \u0915\u094d\u0937\u092e\u0924\u093e \u0915\u093e\u092f \u0906\u0939\u0947?', 'KB-6'],
      ['CSE \u0938\u0940\u091f \u092e\u0948\u091f\u094d\u0930\u093f\u0915\u094d\u0938 \u0914\u0930 \u0907\u0902\u091f\u0947\u0915 \u0915\u094d\u092f\u093e \u0939\u0948?', 'KB-6'],
      ['\u092a\u094d\u0930\u0935\u0947\u0936 \u0924\u093e\u0930\u0916\u093e \u0914\u0930 \u0905\u0902\u0924\u093f\u092e \u092e\u0941\u0926\u0924 \u0915\u093e\u092f \u0906\u0939\u0947?', 'KB-30'],
    ];
    for (const [question, expectedId] of cases) {
      const { payload } = await request(base, '/api/assistant/ask', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
      assert.equal(payload.data.evidence[0]?.id, expectedId, question);
    }
  });
});

test('college admin can upload and list an official knowledge source', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'admin@mitcorer.edu.in');
    const formData = new FormData();
    formData.append('title', 'CAP Round I cutoff sample');
    formData.append('documentType', 'Cutoff');
    formData.append('academicYear', '2025-26');
    formData.append('sourceAuthority', 'Maharashtra CET Cell');
    formData.append('verifiedText', 'Historical sample cutoff record for retrieval testing.');
    formData.append('file', new Blob(['%PDF-1.4\nsource sample'], { type: 'application/pdf' }), 'cutoff.pdf');
    const uploadResponse = await fetch(`${base}/api/official-sources/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const uploaded = await uploadResponse.json();
    assert.equal(uploadResponse.status, 200);
    assert.equal(uploaded.data.documentType, 'Cutoff');
    assert.equal(uploaded.data.linkedKnowledgeCount, 1);

    const listed = await request(base, '/api/official-sources', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.ok(listed.payload.data.items.some((item) => item.id === uploaded.data.id));
  });
});

test('admin-reviewed extracted source text becomes published retrieval knowledge', async () => {
  await withServer(async (base) => {
    const adminToken = await login(base, 'admin@mitcorer.edu.in');
    const formData = new FormData();
    formData.append('title', 'CampusGuard source ingestion test notice');
    formData.append('documentType', 'Admissions');
    formData.append('academicYear', '2026-27');
    formData.append('sourceAuthority', 'MITCORER');
    formData.append('file', new Blob(['CampusGuard source ingestion verification notice: reporting token ALPHA-2026 must be checked.'], { type: 'text/plain' }), 'ingestion-notice.txt');
    const uploadResponse = await fetch(`${base}/api/official-sources/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });
    const uploaded = (await uploadResponse.json()).data;
    assert.equal(uploaded.status, 'Review');
    assert.match(uploaded.extractionStatus, /Text extracted/i);

    const extracted = await request(base, `/api/official-sources/${uploaded.id}/extracted-text`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.match(extracted.payload.data.extractedText, /ALPHA-2026/);

    const published = await request(base, `/api/official-sources/${uploaded.id}/publish`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ verifiedText: extracted.payload.data.extractedText }),
    });
    assert.equal(published.response.status, 200);
    assert.equal(published.payload.data.status, 'Published');
    assert.equal(published.payload.data.linkedKnowledgeCount, 1);

    const applicantToken = await login(base, 'applicant@example.com');
    const answer = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${applicantToken}` },
      body: JSON.stringify({ question: 'What does the ALPHA-2026 reporting token notice say?' }),
    });
    assert.equal(answer.response.status, 200);
    assert.equal(answer.payload.data.evidence[0]?.title, 'CampusGuard source ingestion test notice');
  });
});

test('multilingual assistant benchmark contains 360 cases', () => {
  const benchmarkPath = path.resolve(process.cwd(), 'evaluation', 'campusguard-qa-360.json');
  const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
  assert.equal(benchmark.count, 360);
  assert.deepEqual(new Set(benchmark.records.map((item) => item.language)), new Set(['en', 'mr', 'hi', 'hinglish']));
});

test('refresh token rotates session and logout revokes it', async () => {
  await withServer(async (base) => {
    const loginResponse = await request(base, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'applicant@example.com', password: 'campusguard' }),
    });
    assert.equal(loginResponse.payload.data.refreshToken, undefined);
    const refreshCookie = loginResponse.response.headers.get('set-cookie');
    assert.match(refreshCookie, /HttpOnly/);
    assert.match(refreshCookie, /SameSite=Strict/);
    const refreshed = await request(base, '/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: refreshCookie },
    });
    assert.equal(refreshed.response.status, 200);
    assert.ok(refreshed.payload.data.token);
    const rotatedCookie = refreshed.response.headers.get('set-cookie');
    assert.notEqual(rotatedCookie, refreshCookie);
    const loggedOut = await request(base, '/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: rotatedCookie },
    });
    assert.equal(loggedOut.payload.data.loggedOut, true);
    assert.match(loggedOut.response.headers.get('set-cookie'), /Max-Age=0/);
  });
});

test('applicant can upload a real document file record', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const formData = new FormData();
    formData.append('ownerName', 'Applicant');
    formData.append('ownerEmail', 'applicant@example.com');
    formData.append('ownerRole', 'Applicant');
    formData.append('docName', '10th marksheet');
    formData.append('file', new Blob(['%PDF-1.4\ndocument sample'], { type: 'application/pdf' }), '10th-marksheet.pdf');
    const response = await fetch(`${base}/api/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.data.docName, '10th marksheet');
    assert.equal(payload.data.mimeType, 'application/pdf');
    assert.equal(payload.data.status, 'Uploaded (not submitted)');
    assert.ok(payload.data.storedFileName.endsWith('10th-marksheet.pdf'));
  });
});

test('document submission hands drafts to staff and returns review feedback to applicant', async () => {
  await withServer(async (base) => {
    const applicantToken = await login(base, 'applicant@example.com');
    const staffToken = await login(base, 'staff@mitcorer.edu.in');
    const parentToken = await login(base, 'parent@example.com');
    const formData = new FormData();
    formData.append('ownerName', 'Applicant');
    formData.append('ownerEmail', 'applicant@example.com');
    formData.append('docName', '12th marksheet');
    formData.append('file', new Blob(['%PDF-1.4\nprivate document'], { type: 'application/pdf' }), '12th-marksheet.pdf');
    const uploaded = await fetch(`${base}/api/documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${applicantToken}` }, body: formData });
    const record = (await uploaded.json()).data;
    const staffDrafts = await request(base, '/api/documents', { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal(staffDrafts.payload.data.items.some((item) => item.id === record.id), false);
    const hiddenDraft = await fetch(`${base}/api/documents/${record.id}/file`, { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal(hiddenDraft.status, 403);
    const submitted = await request(base, '/api/documents/submit', { method: 'POST', headers: { Authorization: `Bearer ${applicantToken}` }, body: '{}' });
    assert.equal(submitted.response.status, 200);
    assert.ok(submitted.payload.data.items.some((item) => item.id === record.id && item.status === 'Submitted for review'));
    const staffQueue = await request(base, '/api/documents', { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.ok(staffQueue.payload.data.items.some((item) => item.id === record.id));
    const staffFile = await fetch(`${base}/api/documents/${record.id}/file`, { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal(staffFile.status, 200);
    assert.equal(await staffFile.text(), '%PDF-1.4\nprivate document');
    const parentFile = await fetch(`${base}/api/documents/${record.id}/file`, { headers: { Authorization: `Bearer ${parentToken}` } });
    assert.equal(parentFile.status, 403);
    const correction = await request(base, `/api/documents/${record.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({ status: 'Needs correction', reviewNote: 'Upload a readable full-page scan.' }),
    });
    assert.equal(correction.response.status, 200);
    const applicantDocuments = await request(base, '/api/documents', { headers: { Authorization: `Bearer ${applicantToken}` } });
    const correctedRecord = applicantDocuments.payload.data.items.find((item) => item.id === record.id);
    assert.equal(correctedRecord.status, 'Needs correction');
    assert.equal(correctedRecord.reviewNote, 'Upload a readable full-page scan.');
  });
});

test('assistant attachments are visible to staff without claiming document-checklist status', async () => {
  await withServer(async (base) => {
    const applicantToken = await login(base, 'applicant@example.com');
    const staffToken = await login(base, 'staff@mitcorer.edu.in');
    const formData = new FormData();
    formData.append('note', 'Please check this notice.');
    formData.append('file', new Blob(['%PDF-1.4\nattachment'], { type: 'application/pdf' }), 'notice.pdf');
    const uploaded = await fetch(`${base}/api/assistant/attachments/upload`, { method: 'POST', headers: { Authorization: `Bearer ${applicantToken}` }, body: formData });
    const attachment = (await uploaded.json()).data;
    const listed = await request(base, '/api/assistant/attachments', { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.ok(listed.payload.data.items.some((item) => item.id === attachment.id));
    const content = await fetch(`${base}/api/assistant/attachments/${attachment.id}/file`, { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal(content.status, 200);
    assert.equal(await content.text(), '%PDF-1.4\nattachment');
  });
});

test('rejects a file whose declared MIME type does not match its contents', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const formData = new FormData();
    formData.append('docName', '10th marksheet');
    formData.append('file', new Blob(['not a PDF'], { type: 'application/pdf' }), '10th-marksheet.pdf');
    const response = await fetch(`${base}/api/documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.match(payload.error.message, /valid PDF/i);
  });
});

test('assistant rate limit protects the verified-answer endpoint', async () => {
  await withServer(async (base) => {
    const signup = await request(base, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name: 'Rate Limit Test', email: 'ratelimit@example.com', password: 'campusguard', role: 'applicant' }),
    });
    const token = signup.payload.data.token;
    for (let index = 0; index < 30; index += 1) {
      const response = await request(base, '/api/assistant/ask', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: `What are admission documents request ${index}?` }),
      });
      assert.equal(response.response.status, 200);
    }
    const limited = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'One more admission documents request' }),
    });
    assert.equal(limited.response.status, 429);
    assert.equal(limited.payload.error.code, 'RATE_LIMITED');
  });
});
