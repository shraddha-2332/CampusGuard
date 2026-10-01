import fs from 'node:fs';
import path from 'node:path';

const topics = [
  ['eligibility', 'first-year B.Tech eligibility', 'पहिल्या वर्षाची B.Tech पात्रता', 'प्रथम वर्ष B.Tech पात्रता', 'first year B.Tech eligibility'],
  ['cutoff', 'historical CSE cutoff', 'मागील CSE कटऑफ', 'पिछला CSE कटऑफ', 'previous CSE cutoff'],
  ['seat_matrix', 'CSE seat matrix and intake', 'CSE जागा आणि प्रवेश क्षमता', 'CSE सीट मैट्रिक्स और इंटेक', 'CSE seats and intake'],
  ['cap', 'CAP round process', 'CAP फेरी प्रक्रिया', 'CAP राउंड प्रक्रिया', 'CAP round process'],
  ['acap', 'ACAP and institute-level admission', 'ACAP आणि संस्था स्तर प्रवेश', 'ACAP और संस्थान स्तर प्रवेश', 'ACAP institute level admission'],
  ['documents', 'required admission documents', 'प्रवेशासाठी आवश्यक कागदपत्रे', 'प्रवेश के आवश्यक दस्तावेज', 'admission documents'],
  ['document_status', 'uploaded document review status', 'अपलोड कागदपत्र तपासणी स्थिती', 'अपलोड दस्तावेज समीक्षा स्थिति', 'uploaded document status'],
  ['fees', 'category-wise academic fees', 'प्रवर्गानुसार शैक्षणिक फी', 'श्रेणी के अनुसार शैक्षणिक शुल्क', 'category wise fees'],
  ['scholarship', 'scholarship eligibility and documents', 'शिष्यवृत्ती पात्रता आणि कागदपत्रे', 'छात्रवृत्ति पात्रता और दस्तावेज', 'scholarship eligibility'],
  ['hostel', 'hostel and mess fees', 'वसतिगृह आणि मेस फी', 'छात्रावास और मेस शुल्क', 'hostel and mess fees'],
  ['programs', 'available B.Tech programs', 'उपलब्ध B.Tech अभ्यासक्रम', 'उपलब्ध B.Tech पाठ्यक्रम', 'available B.Tech programs'],
  ['placement', 'placement companies and outcomes', 'प्लेसमेंट कंपन्या आणि निकाल', 'प्लेसमेंट कंपनियां और परिणाम', 'placement companies and outcomes'],
  ['transport', 'college bus and transport', 'कॉलेज बस आणि वाहतूक', 'कॉलेज बस और परिवहन', 'college bus transport'],
  ['contact', 'official admission contact', 'अधिकृत प्रवेश संपर्क', 'आधिकारिक प्रवेश संपर्क', 'official admission contact'],
  ['deadlines', 'admission dates and deadlines', 'प्रवेश तारखा आणि अंतिम मुदत', 'प्रवेश तिथियां और अंतिम समय', 'admission dates deadlines'],
];

const patterns = {
  en: [
    'What is {topic}?', 'Explain {topic}.', 'Which verified rule covers {topic}?',
    'What information do you need to answer about {topic}?', 'Show the source for {topic}.',
    'What should an applicant do next regarding {topic}?',
  ],
  mr: [
    '{topic} काय आहे?', '{topic} समजावून सांगा.', '{topic} साठी कोणता अधिकृत नियम आहे?',
    '{topic} बद्दल उत्तर देण्यासाठी कोणती माहिती हवी?', '{topic} चा स्रोत दाखवा.',
    '{topic} साठी अर्जदाराने पुढे काय करावे?',
  ],
  hi: [
    '{topic} क्या है?', '{topic} समझाइए।', '{topic} के लिए कौन सा आधिकारिक नियम है?',
    '{topic} का उत्तर देने के लिए कौन सी जानकारी चाहिए?', '{topic} का स्रोत दिखाइए।',
    '{topic} के लिए आवेदक को आगे क्या करना चाहिए?',
  ],
  hinglish: [
    '{topic} kya hai?', '{topic} explain karo.', '{topic} ke liye verified rule konsa hai?',
    '{topic} answer karne ke liye kya details chahiye?', '{topic} ka official source dikhao.',
    '{topic} ke liye applicant ka next step kya hai?',
  ],
};

const expectedBehavior = {
  eligibility: 'Separate minimum eligibility from branch allotment and request only missing academic/candidature facts.',
  cutoff: 'Require year, round, exam, category and seat type; label historical values and avoid guarantees.',
  seat_matrix: 'Return the matching academic year, branch choice code and seat breakdown from the verified matrix.',
  cap: 'Explain the relevant CAP stage, candidate action and deadline source.',
  acap: 'Distinguish institute-level admission from CAP and use the applicable vacancy/merit notice.',
  documents: 'Return the category and route-specific checklist without requesting unrelated documents.',
  document_status: 'Use the authenticated applicant record; never reveal another applicant’s status.',
  fees: 'Return the verified academic year and category amount without estimating unsupported charges.',
  scholarship: 'Evaluate scheme fit from category, income, admission route and required evidence.',
  hostel: 'Return verified hostel, deposit and mess amounts and label availability as requiring current confirmation.',
  programs: 'Return verified program names, intake and choice codes for the requested year.',
  placement: 'Return sourced historical outcomes and never promise placement or package.',
  transport: 'Return only verified routes or request the applicant location when route data is missing.',
  contact: 'Return the official admission contact and purpose-specific desk when available.',
  deadlines: 'Return the applicable academic year and source date; do not reuse an expired deadline.',
};

const records = [];
let id = 1;
for (const [intent, english, marathi, hindi, hinglish] of topics) {
  const phrases = { en: english, mr: marathi, hi: hindi, hinglish };
  for (const [language, templates] of Object.entries(patterns)) {
    for (const template of templates) {
      records.push({
        id: `CGQ-${String(id).padStart(3, '0')}`,
        language,
        intent,
        question: template.replace('{topic}', phrases[language]),
        expectedEvidenceCategory: intent,
        expectedBehavior: expectedBehavior[intent],
        mustCiteSource: true,
        mustNotGuarantee: ['eligibility', 'cutoff', 'scholarship', 'placement'].includes(intent),
      });
      id += 1;
    }
  }
}

const output = path.resolve('backend', 'evaluation', 'campusguard-qa-360.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify({ version: '1.0', purpose: 'retrieval and response evaluation, not model fine-tuning', count: records.length, records }, null, 2)}\n`);
console.log(`Wrote ${records.length} benchmark questions to ${output}`);
