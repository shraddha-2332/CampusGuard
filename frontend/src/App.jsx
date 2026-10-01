import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BarChart3, BookOpen, CheckCircle2, FileCheck2, FileText,
  HandCoins, LockKeyhole, LogOut, Menu, MessageCircle, Paperclip, Phone,
  Send, ShieldCheck, UploadCloud, UsersRound, X, Eye, EyeOff, LoaderCircle,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import feeFirstYearImage from './assets/fee-first-year-2026.jpeg';
import feeDirectSecondYearImage from './assets/fee-direct-second-year-2026.jpeg';
import hostelMessFeeImage from './assets/hostel-mess-fee-2026.jpeg';
import mitcorerLogo from './assets/mitcorer-logo.png';
import { api } from './api.js';
import { formatAnswer } from './answer-format.mjs';
import { useChatHistory } from './useChatHistory.js';

const institution = {
  name: 'MIT College of Railway Engineering and Research',
  shortName: 'MITCORER',
  city: 'Barshi',
  code: 'DTE 06901',
  university: 'Punyashlok Ahilyadevi Holkar Solapur University',
  contact: '91 84599 67882, +91 86696 62106',
  email: 'info.mitcorer@mitpune.edu.in',
  address: 'Industrial Estate No. 03, Barshi, Dist. Solapur, Maharashtra - 413401',
  status: ['AICTE approved', 'AY 2026-27 admissions', 'Verified source mode'],
};

const admissionPhones = [
  { label: '+91 84599 67882', href: 'tel:+918459967882' },
  { label: '+91 86696 62106', href: 'tel:+918669662106' },
];

const roles = [
  { id: 'applicant', label: 'Applicant', note: 'Admission steps, eligibility, documents' },
  { id: 'parent', label: 'Parent', note: 'Fees, hostel, visit, confidence' },
  { id: 'staff', label: 'Admission Staff', note: 'Inquiry and document review' },
  { id: 'admin', label: 'College Admin', note: 'Verified content and reports' },
];

const rolePermissions = {
  applicant: {
    allowedViews: ['assistant', 'cap', 'documents', 'programs', 'fees', 'scholarships', 'placements', 'visit', 'inquiry'],
    capabilities: ['Ask verified admission questions', 'Upload own documents for pre-check', 'View programs, fees, CAP guidance', 'Create admission inquiry'],
    denied: ['Staff inquiry queue', 'Admin content publishing', 'Reports for all users'],
  },
  parent: {
    allowedViews: ['assistant', 'cap', 'documents', 'programs', 'fees', 'scholarships', 'placements', 'visit', 'inquiry'],
    capabilities: ['Ask parent-focused questions', 'View fees, hostel, visit planning', 'Check document readiness', 'Create admission inquiry'],
    denied: ['Staff document approval', 'Admin content publishing', 'Reports for all users'],
  },
  staff: {
    allowedViews: ['queue', 'documents', 'reports', 'audit', 'assistant'],
    capabilities: ['Review inquiries', 'Review document pre-check queue', 'Use admission desk for verified replies', 'View operational reports'],
    denied: ['Admin content publishing', 'Role management', 'System configuration'],
  },
  admin: {
    allowedViews: ['knowledge', 'queue', 'reports', 'audit', 'assistant'],
    capabilities: ['Manage verified content', 'Monitor inquiries', 'View reports', 'Review admission knowledge'],
    denied: ['Candidate private portal actions on CET Cell', 'Direct admission decision automation'],
  },
};

const courses = [
  { name: 'Computer Science and Engineering', intake: 120, choiceCode: '0690124210' },
  { name: 'Artificial Intelligence and Data Science', intake: 60, choiceCode: '0690126310' },
  { name: 'Civil Engineering', intake: 60, choiceCode: '0690119110' },
  { name: 'Electronics and Computer Engineering', intake: 60, choiceCode: '0690184410' },
  { name: 'Electronics and Telecommunication Engineering', intake: 60, choiceCode: '0690137210' },
  { name: 'Mechanical and Rail Engineering', intake: 60, choiceCode: '0690158510' },
];

const dseCourses = [
  { name: 'Civil Engineering', choiceCode: '690119110' },
  { name: 'Computer Science and Engineering', choiceCode: '690124210' },
  { name: 'Electronics and Computer Engineering', choiceCode: '690184410' },
  { name: 'Electronics and Telecommunication Engineering', choiceCode: '690137210' },
  { name: 'Mechanical and Rail Engineering', choiceCode: '690161210' },
];

const polytechnicCourses = [
  { name: 'Civil Engineering', intake: 60 },
  { name: 'Computer Science and Engineering', intake: 60 },
  { name: 'Electronics and Telecommunication Engineering', intake: 60 },
  { name: 'Mechanical Engineering', intake: 60 },
];

const facilities = [
  'Hostel',
  'Bus facility',
  'Library',
  'Computer center',
  'Railway model room',
  'Workshop',
  'Cafeteria',
  'Seminar hall',
];

const scholarshipSchemes = [
  'AICTE Pragati Scholarship Scheme for Girl Students (Technical Degree / Diploma)',
  'Dr. Panjabrao Deshmukh Vastigruh Nirvah Bhatta Yojna',
  'Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulkh Shishyavrutti Yojna',
  'Minority communities scholarship for higher and professional courses',
  'OBC / VJNT / SBC post-matric and maintenance allowance schemes',
  'Tuition and examination fee support for eligible category students',
];

const scholarshipDocuments = {
  open: ['Income certificate', 'Domicile / nationality proof', 'Admission / allotment proof', 'Bank passbook'],
  ews: ['EWS certificate', 'Income certificate', 'Domicile / nationality proof', 'Bank passbook'],
  obc: ['Caste certificate', 'Caste validity if required', 'Non-creamy layer certificate', 'Income certificate', 'Domicile / nationality proof'],
  vjnt: ['Caste certificate', 'Caste validity if required', 'Non-creamy layer certificate', 'Income certificate', 'Domicile / nationality proof'],
  scst: ['Caste certificate', 'Caste validity if required', 'Domicile / nationality proof', 'Bank passbook'],
  minority: ['Minority declaration/certificate', 'Income certificate', 'Domicile / nationality proof', 'Bank passbook'],
};

const scholarshipChecklist = [
  ['Admission route', 'CAP and institute-level/non-CAP admissions must be checked against each scheme\'s current route condition.'],
  ['Income proof', 'Needed for EBC/EWS/OBC/minority or other income-linked claims.'],
  ['Category proof', 'Caste certificate, validity, and non-creamy layer wherever applicable.'],
  ['Domicile / nationality', 'Often required to confirm Maharashtra/state scheme eligibility.'],
  ['Bank details', 'Keep passbook or account details ready for scheme applications.'],
  ['Hostel claim', 'If hostel benefit is expected, confirm stay proof and scheme condition with staff.'],
];

function getLikelyScholarships(profile) {
  const items = [];
  if (profile.gender === 'girl' && profile.income === 'under8') {
    items.push({
      title: 'AICTE Pragati Scholarship for Girl Students',
      reason: profile.route === 'cap'
        ? 'Potential match for a girl student in an AICTE-approved technical degree or diploma course. Confirm the current NSP merit criteria, family limit, admission details, and documents before applying.'
        : 'Potential profile match, but institute-level/non-CAP admission does not automatically establish Pragati eligibility. Verify that the current NSP specification accepts this admission route before applying.',
    });
  }
  if (profile.income === 'under8' && ['open', 'ews'].includes(profile.category)) {
    items.push({
      title: 'Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulkh Shishyavrutti Yojna',
      reason: 'Relevant for EBC/EWS or eligible open-category fee concession checks where income criteria are satisfied.',
    });
  }
  if (profile.hostel === 'yes' && ['open', 'ews', 'minority'].includes(profile.category)) {
    items.push({
      title: 'Dr. Panjabrao Deshmukh Vastigruh Nirvah Bhatta Yojna',
      reason: 'Relevant when the student is claiming hostel/residence-related support and satisfies scheme conditions.',
    });
  }
  if (profile.category === 'minority') {
    items.push({
      title: 'Minority scholarship for higher and professional courses',
      reason: 'Relevant for eligible minority-community students pursuing professional courses.',
    });
  }
  if (profile.category === 'obc') {
    items.push({
      title: 'Post Matric Scholarship / Tuition and Examination Fee support for OBC',
      reason: 'Relevant for eligible OBC/SEBC students, with income and required category documents.',
    });
  }
  if (profile.category === 'vjnt') {
    items.push({
      title: 'VJNT / SBC maintenance allowance and post-matric support',
      reason: 'Relevant for eligible VJNT/SBC students, especially where hostel or professional-course support applies.',
    });
  }
  if (profile.category === 'scst') {
    items.push({
      title: 'SC/ST post-matric or fee support route',
      reason: 'Relevant for eligible SC/ST students as per applicable state scholarship rules and category verification.',
    });
  }
  if (profile.admission === 'polytechnic') {
    items.push({
      title: 'Diploma admission scholarship check',
      reason: 'Scheme applicability can differ from B.Tech, so diploma candidates should verify the exact portal/scheme route.',
    });
  }
  if (profile.route === 'nonCap') {
    items.push({
      title: 'Institute-level / non-CAP route verification',
      reason: 'Keep the institute application, merit-list or allotment proof, fee receipt, and originals ready. Confirm the selected scheme explicitly accepts this admission route before relying on a scholarship or concession.',
    });
  }
  if (items.length === 0) {
    items.push({
      title: 'No clear concession route from selected profile',
      reason: 'The student may follow the regular fee route unless another official scheme, category, or income condition applies.',
    });
  }
  return items;
}

const placementSignals = [
  ['Final-year students', '113'],
  ['Internships recorded', '81'],
  ['Students placed', '48'],
  ['Highest CTC', '21 LPA'],
];

const branchPlacementRecords = [
  ['Civil Engineering', '13', '0', '11'],
  ['Computer Science Engineering', '62', '50', '13'],
  ['E&TC Engineering', '35', '31', '21'],
  ['Mechanical Engineering', '3', '0', '3'],
];

const placementPlatforms = [
  { name: 'Preskilet', purpose: 'Build recruiter-facing readiness', details: ['Create a live/video profile', 'Practise communication and presentation', 'Show projects and proof of work', 'Complete recruiter-recommended tasks'], url: 'https://preskilet.com/' },
  { name: 'POD.AI', purpose: 'Track and apply for opportunities', details: ['Receive company and job-description updates', 'Check eligibility and register for drives', 'Follow interview or selection stages', 'Receive recruitment notifications'], url: 'https://pod.ai/' },
];

const recruiters = ['Accenture', 'Amdocs', 'TCS', 'Wipro', 'IBM', 'Infosys', 'Cognizant', 'Cummins', 'Atlas Copco', 'Cloud4C', "Byju's", 'Clover', 'Atos', 'Juspay'];

const branchCareerOutcomes = {
  'Computer Science and Engineering': { roles: ['Software developer', 'Web or app developer', 'Cloud and DevOps associate', 'Data analyst'], skills: ['Programming fundamentals', 'Data structures and problem solving', 'Projects and Git portfolio', 'Aptitude and communication'] },
  'Artificial Intelligence and Data Science': { roles: ['Data analyst', 'Junior ML engineer', 'Business intelligence analyst', 'Software developer'], skills: ['Python and SQL', 'Statistics and data handling', 'Machine-learning projects', 'Programming and aptitude'] },
  'Civil Engineering': { roles: ['Site engineer', 'Quantity surveyor', 'CAD/BIM trainee', 'Government exam pathway'], skills: ['Surveying and estimation', 'CAD/BIM tools', 'Site exposure', 'Core aptitude and communication'] },
  'Electronics and Computer Engineering': { roles: ['Embedded systems trainee', 'Software developer', 'IoT engineer', 'Electronics testing engineer'], skills: ['C/C++ and programming', 'Microcontrollers and embedded systems', 'Electronics fundamentals', 'Projects and aptitude'] },
  'Electronics and Telecommunication Engineering': { roles: ['Telecom engineer', 'Embedded systems trainee', 'Network support engineer', 'Electronics testing engineer'], skills: ['Communication systems', 'Networking basics', 'Embedded projects', 'Core aptitude and communication'] },
  'Mechanical and Rail Engineering': { roles: ['Design engineer', 'Production engineer', 'Quality engineer', 'Railway and government exam pathway'], skills: ['CAD and design tools', 'Manufacturing fundamentals', 'Workshop or industry exposure', 'Core aptitude and communication'] },
};

const feeRecords = [
  {
    title: 'First Year Engineering',
    year: 'AY 2026-27',
    image: feeFirstYearImage,
    rows: ['Open/OMS: INR 1,05,000', 'Open EBC/EWS/OBC/SEBC boys: INR 61,109', 'Girls/VJNT/SBC/TFWS: INR 17,217', 'SC/ST: INR 8,000'],
  },
  {
    title: 'Direct Second Year',
    year: 'AY 2026-27',
    image: feeDirectSecondYearImage,
    rows: ['Open/OMS: INR 98,000', 'Open EBC/EWS/OBC/SEBC boys: INR 58,181', 'Girls/VJNT/SBC/TFWS: INR 18,362', 'SC/ST: INR 10,000'],
  },
  {
    title: 'Hostel and Mess',
    year: 'AY 2026-27',
    image: hostelMessFeeImage,
    rows: ['Hostel fee: INR 35,000', 'Refundable deposit: INR 5,000', 'Hostel total: INR 40,000', 'Mess fee per year: INR 42,000'],
  },
];

const hostelMessDetails = [
  ['Hostel fee', 'INR 35,000'],
  ['Refundable deposit', 'INR 5,000'],
  ['Hostel total', 'INR 40,000'],
  ['Mess fee per year', 'INR 42,000'],
];

const hostelConfirmations = [
  'Room availability and allotment timing',
  'Deposit refund process',
  'Documents needed for hostel admission',
  'Mess joining date and payment process',
  'Local transport or bus option if hostel is not selected',
  'Parent visit timing before final reporting',
];

const documents = [
  { name: '10th marksheet', required: true, keywords: ['10th', 'ssc'] },
  { name: '12th marksheet / diploma marksheet', required: true, keywords: ['12th', 'hsc', 'diploma'] },
  { name: 'CET or JEE scorecard', required: true, keywords: ['cet', 'jee', 'scorecard', 'score'] },
  { name: 'CAP allotment letter', required: true, keywords: ['cap', 'allotment', 'letter'] },
  { name: 'Leaving / transfer certificate', required: true, keywords: ['leaving', 'transfer', 'tc', 'lc'] },
  { name: 'Domicile / nationality proof', required: true, keywords: ['domicile', 'nationality'] },
  { name: 'Caste / validity / non-creamy layer certificate', required: false, keywords: ['caste', 'validity', 'non creamy', 'ncl'] },
  { name: 'Income certificate for concessions', required: false, keywords: ['income', 'concession', 'ebc', 'ews'] },
];

const capStages = [
  { stage: 'Registration', owner: 'Candidate', action: 'Register on CET Cell portal and upload required documents.', support: 'Guide required data, category claims, and document readiness.' },
  { stage: 'Scrutiny', owner: 'CET Cell / Scrutiny Center', action: 'Complete e-Scrutiny or physical scrutiny and confirm application.', support: 'Explain e-Scrutiny vs physical scrutiny and flag missing documents.' },
  { stage: 'Merit List', owner: 'CET Cell', action: 'Check provisional merit, raise grievance if details are wrong, then check final merit.', support: 'Explain merit status, grievance timing, and correction evidence.' },
  { stage: 'Option Form', owner: 'Candidate', action: 'Fill college and branch preferences before each CAP round deadline.', support: 'Show MITCORER branches, choice codes, intake, and previous cutoff references when available.' },
  { stage: 'Allotment', owner: 'CET Cell', action: 'Check round-wise allotment and decide freeze, not freeze, or betterment.', support: 'Explain decision impact without making the decision for the student.' },
  { stage: 'Seat Acceptance', owner: 'Candidate', action: 'Accept allotted seat and pay seat acceptance fee through candidate login.', support: 'Remind deadlines and route payment-specific doubts to official portal/staff.' },
  { stage: 'Institute Reporting', owner: 'College', action: 'Report to allotted institute with documents and applicable fees.', support: 'Prepare reporting checklist, fee estimate, hostel questions, and staff inquiry.' },
  { stage: 'ACAP / Institute Level', owner: 'College', action: 'Apply for institute-level/vacant seats after CAP as per official schedule.', support: 'Publish vacancy notices, collect inquiries, and guide registered candidates.' },
];

const deskCategories = [
  { label: 'CAP', view: 'cap' },
  { label: 'Documents', view: 'documents' },
  { label: 'Programs', view: 'programs' },
  { label: 'Fees', view: 'fees' },
  { label: 'Scholarship', view: 'scholarships' },
  { label: 'Career & placement', view: 'placements' },
  { label: 'Hostel & mess', view: 'visit' },
];

const initialInquiries = [
  { id: 'INQ-2401', name: 'Aarav Kulkarni', role: 'Applicant', topic: 'Caste validity receipt', priority: 'High', status: 'Needs reply' },
  { id: 'INQ-2402', name: 'Mrs. Deshmukh', role: 'Parent', topic: 'Hostel and fee installment', priority: 'Medium', status: 'In progress' },
  { id: 'INQ-2403', name: 'Rohan Jadhav', role: 'Applicant', topic: 'TFWS and EBC documents', priority: 'New', status: 'Unassigned' },
];

const initialDocumentReviews = [
  { id: 'seed-aarav-cet', ownerName: 'Aarav Kulkarni', ownerEmail: 'aarav@example.com', ownerRole: 'Applicant', docName: 'CET or JEE scorecard', fileName: 'aarav-cet-scorecard.pdf', status: 'Needs caste validity check' },
  { id: 'seed-rohan-cap', ownerName: 'Rohan Jadhav', ownerEmail: 'rohan@example.com', ownerRole: 'Applicant', docName: 'CAP allotment letter', fileName: 'rohan-cap-allotment.pdf', status: 'Ready for reporting' },
];

const contentItems = [
  { title: 'Admission process 2026-27', category: 'Admissions', status: 'Published' },
  { title: 'Course intake and choice codes', category: 'Courses', status: 'Published' },
  { title: 'Hostel and transport guide', category: 'Facilities', status: 'Review' },
  { title: 'Fee records and scholarship notes', category: 'Fees', status: 'Published' },
];

function App() {
  const [role, setRole] = useState('applicant');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const history = useChatHistory(token);
  const [view, setView] = useState('assistant');
  const [viewHistory, setViewHistory] = useState([]);
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('campusguard.sidebarCollapsed') === 'true');
  const [documentReviews, setDocumentReviews] = useState(initialDocumentReviews);
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [content, setContent] = useState(contentItems);
  const [knowledge, setKnowledge] = useState([]);
  const [officialSources, setOfficialSources] = useState([]);
  const [assistantAttachments, setAssistantAttachments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [reports, setReports] = useState(null);
  const [admissionWorkspace, setAdmissionWorkspace] = useState({ cap: {}, programs: { preferences: [] }, fees: {}, scholarship: {}, stay: {} });
  const [appError, setAppError] = useState('');

  const navigateTo = (nextView) => {
    if (!nextView || nextView === view) return;
    setViewHistory((items) => [...items, view].slice(-20));
    setView(nextView);
  };

  const returnToPreviousView = () => {
    if (!viewHistory.length) return;
    const nextHistory = [...viewHistory];
    const previousView = nextHistory.pop();
    setViewHistory(nextHistory);
    setView(previousView);
  };

  const refreshWorkspaceData = async (authToken, currentRole) => {
    const [docsResult, inquiriesResult, contentResult, attachmentResult] = await Promise.all([
      api.getDocuments(authToken),
      api.getInquiries(authToken),
      api.getContent(authToken),
      api.getAssistantAttachments(authToken),
    ]);
    setDocumentReviews(docsResult.items || []);
    setInquiries(inquiriesResult.items || []);
    setContent(contentResult.items || []);
    setAssistantAttachments(attachmentResult.items || []);
    if (['applicant', 'parent'].includes(currentRole)) {
      setAdmissionWorkspace(await api.getAdmissionWorkspace(authToken));
    }
    if (['staff', 'admin'].includes(currentRole)) {
      const [reportResult, auditResult, knowledgeResult, sourceResult] = await Promise.all([
        api.getReports(authToken),
        api.getAuditLogs(authToken),
        api.getKnowledge(authToken),
        api.getOfficialSources(authToken),
      ]);
      setReports(reportResult);
      setAuditLogs(auditResult.items || []);
      setKnowledge(knowledgeResult.items || []);
      setOfficialSources(sourceResult.items || []);
    } else {
      setReports(null);
      setAuditLogs([]);
      setKnowledge([]);
      setOfficialSources([]);
      setAssistantAttachments([]);
    }
  };

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const payload = await api.refresh();
        if (!active) return;
        setToken(payload.token);
        setRole(payload.user.role);
        setView(getDefaultView(payload.user.role));
        setViewHistory([]);
        await refreshWorkspaceData(payload.token, payload.user.role);
        setUser(payload.user);
      } catch {
        // No active refresh cookie is the normal state for a first visit.
      }
    };
    restoreSession();
    return () => { active = false; };
  }, []);

  const enterWorkspace = async ({ name, email, password, selectedRole, mode }) => {
    setAppError('');
    const nextRole = selectedRole || role;
    try {
      const payload = mode === 'signup'
        ? await api.signup({ name, email, password, role: nextRole })
        : await api.login({ email, password });
      const nextUser = payload.user;
      setToken(payload.token);
      setRole(nextUser.role);
      setView(getDefaultView(nextUser.role));
      setViewHistory([]);
      await refreshWorkspaceData(payload.token, nextUser.role);
      setUser(nextUser);
    } catch (error) {
      setAppError(error.message);
    }
  };

  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
    setToken('');
    setReports(null);
    setAuditLogs([]);
    setKnowledge([]);
    setOfficialSources([]);
    setView('assistant');
    setViewHistory([]);
  };

  const upsertDocumentReview = async (record, file) => {
    setAppError('');
    try {
      const saved = file ? await api.uploadDocument(token, record, file) : await api.createDocument(token, record);
      setDocumentReviews((items) => {
        const nextItems = items.filter((item) => !(item.ownerEmail === saved.ownerEmail && item.docName === saved.docName));
        return [saved, ...nextItems];
      });
      return saved;
    } catch (error) {
      setAppError(error.message);
      return null;
    }
  };

  const removeDocumentReview = async (id) => {
    setAppError('');
    try {
      await api.deleteDocument(token, id);
      setDocumentReviews((items) => items.filter((item) => item.id !== id));
    } catch (error) {
      setAppError(error.message);
    }
  };

  const updateDocumentReviewStatus = async (id, status, reviewNote = '') => {
    setAppError('');
    try {
      const saved = await api.updateDocumentStatus(token, id, status, reviewNote);
      setDocumentReviews((items) => items.map((item) => (item.id === id ? saved : item)));
      if (['staff', 'admin'].includes(role)) setReports(await api.getReports(token));
    } catch (error) {
      setAppError(error.message);
    }
  };

  const submitDocumentsForReview = async () => {
    setAppError('');
    try {
      const result = await api.submitDocuments(token);
      const submitted = new Map(result.items.map((item) => [item.id, item]));
      setDocumentReviews((items) => items.map((item) => submitted.get(item.id) || item));
      return result;
    } catch (error) {
      setAppError(error.message);
      return null;
    }
  };

  const createInquiry = async (record) => {
    setAppError('');
    try {
      const saved = await api.createInquiry(token, record);
      setInquiries((items) => [saved, ...items]);
      return saved;
    } catch (error) {
      setAppError(error.message);
      return null;
    }
  };

  const saveAdmissionWorkspace = async (section, value) => {
    setAdmissionWorkspace((workspace) => ({ ...workspace, [section]: value }));
    try {
      const saved = await api.updateAdmissionWorkspace(token, section, value);
      setAdmissionWorkspace(saved);
    } catch (error) {
      setAppError(error.message);
    }
  };

  const updateInquiryStatus = async (id, updates) => {
    setAppError('');
    try {
      const saved = await api.updateInquiryStatus(token, id, typeof updates === 'string' ? { status: updates } : updates);
      setInquiries((items) => items.map((item) => (item.id === id ? saved : item)));
      if (['staff', 'admin'].includes(role)) {
        setReports(await api.getReports(token));
      }
    } catch (error) {
      setAppError(error.message);
    }
  };

  const createContentItem = async (record) => {
    setAppError('');
    try {
      const saved = await api.createContent(token, record);
      setContent((items) => [saved, ...items]);
    } catch (error) {
      setAppError(error.message);
    }
  };

  const updateContentItem = async (id, record) => {
    setAppError('');
    try {
      const saved = await api.updateContent(token, id, record);
      setContent((items) => items.map((item) => (item.id === id ? saved : item)));
    } catch (error) {
      setAppError(error.message);
    }
  };

  const createKnowledgeItem = async (record) => {
    setAppError('');
    try {
      const saved = await api.createKnowledge(token, record);
      setKnowledge((items) => [saved, ...items]);
    } catch (error) {
      setAppError(error.message);
    }
  };

  const uploadOfficialSource = async (record, file) => {
    setAppError('');
    try {
      const saved = await api.uploadOfficialSource(token, record, file);
      setOfficialSources((items) => [saved, ...items]);
      if (record.verifiedText?.trim()) {
        const knowledgeResult = await api.getKnowledge(token);
        setKnowledge(knowledgeResult.items || []);
      }
      return true;
    } catch (error) {
      setAppError(error.message);
      return false;
    }
  };

  const uploadAssistantAttachment = async (note, file) => {
    const saved = await api.uploadAssistantAttachment(token, note, file);
    setAssistantAttachments((items) => [saved, ...items]);
    return saved;
  };

  const openDocument = async (id) => {
    try {
      await api.openDocument(token, id);
    } catch (error) {
      setAppError(error.message);
    }
  };

  const openAssistantAttachment = async (id) => {
    try {
      await api.openAssistantAttachment(token, id);
    } catch (error) {
      setAppError(error.message);
    }
  };

  const openOfficialSource = async (id) => {
    try {
      await api.openOfficialSource(token, id);
    } catch (error) {
      setAppError(error.message);
    }
  };

  const reviewOfficialSource = async (id) => {
    try {
      return await api.getOfficialSourceExtractedText(token, id);
    } catch (error) {
      setAppError(error.message);
      return null;
    }
  };

  const publishOfficialSource = async (id, verifiedText) => {
    setAppError('');
    try {
      const saved = await api.publishOfficialSource(token, id, verifiedText);
      setOfficialSources((items) => items.map((item) => (item.id === id ? saved : item)));
      const knowledgeResult = await api.getKnowledge(token);
      setKnowledge(knowledgeResult.items || []);
      return saved;
    } catch (error) {
      setAppError(error.message);
      return null;
    }
  };

  if (!user) {
    return <AuthScreen role={role} setRole={setRole} onEnter={enterWorkspace} authError={appError} />;
  }

  return (
    <div className={`appShell ${sidebarCollapsed ? 'sidebarCollapsed' : ''}`}>
      <Sidebar user={user} role={role} view={view} setView={navigateTo} navOpen={navOpen} setNavOpen={setNavOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} onLogout={logout} history={history} />
      <main className="workspace">
        <Header user={user} setNavOpen={setNavOpen} canGoBack={viewHistory.length > 0} onBack={returnToPreviousView} />
        {navOpen && <button className="mobileScrim" type="button" aria-label="Close navigation" onClick={() => setNavOpen(false)}><X size={18} /></button>}
        <section className="workspaceBody">
          {appError && <div className="errorBanner">{appError}</div>}
          <ProtectedView role={role} view={view} setView={navigateTo}>
            {view === 'assistant' && <AdmissionDesk key={history.active?.id || 'new'} setView={navigateTo} history={history} onError={setAppError} onUploadAttachment={uploadAssistantAttachment} />}
            {view === 'cap' && <CapProcess initial={admissionWorkspace.cap} onSave={(value) => saveAdmissionWorkspace('cap', value)} setView={navigateTo} />}
            {view === 'documents' && <Documents role={role} user={user} documentReviews={documentReviews} assistantAttachments={assistantAttachments} onDocumentUpload={upsertDocumentReview} onDocumentSubmit={submitDocumentsForReview} onDocumentRemove={removeDocumentReview} onDocumentStatusChange={updateDocumentReviewStatus} onOpenDocument={openDocument} onOpenAttachment={openAssistantAttachment} />}
            {view === 'programs' && <Programs initial={admissionWorkspace.programs} onSave={(value) => saveAdmissionWorkspace('programs', value)} setView={navigateTo} />}
            {view === 'fees' && <Fees initial={admissionWorkspace.fees} onSave={(value) => saveAdmissionWorkspace('fees', value)} setView={navigateTo} />}
            {view === 'scholarships' && <ScholarshipAid initial={admissionWorkspace.scholarship} onSave={(value) => saveAdmissionWorkspace('scholarship', value)} setView={navigateTo} />}
            {view === 'placements' && <CareerOutcomes setView={navigateTo} />}
            {view === 'visit' && <HostelMess initial={admissionWorkspace.stay} onSave={(value) => saveAdmissionWorkspace('stay', value)} setView={navigateTo} />}
            {view === 'inquiry' && <Inquiry user={user} role={role} inquiries={inquiries} onCreateInquiry={createInquiry} />}
            {view === 'queue' && <StaffQueue user={user} inquiries={inquiries} documentReviews={documentReviews} onUpdateInquiry={updateInquiryStatus} />}
            {view === 'content' && <ContentManager contentItems={content} onCreate={createContentItem} onUpdate={updateContentItem} />}
            {view === 'knowledge' && <KnowledgeManager items={knowledge} sources={officialSources} onCreate={createKnowledgeItem} onUploadSource={uploadOfficialSource} onOpenSource={openOfficialSource} onReviewSource={reviewOfficialSource} onPublishSource={publishOfficialSource} />}
            {view === 'audit' && <AuditLogs items={auditLogs} />}
            {view === 'reports' && <Reports inquiries={inquiries} documentReviews={documentReviews} reports={reports} />}
          </ProtectedView>
        </section>
      </main>
    </div>
  );
}

const demoAccounts = [
  { role: 'applicant', label: 'Applicant', email: 'applicant@example.com', password: 'campusguard' },
  { role: 'parent', label: 'Parent', email: 'parent@example.com', password: 'campusguard' },
  { role: 'staff', label: 'Staff', email: 'staff@mitcorer.edu.in', password: 'campusguard' },
  { role: 'admin', label: 'Admin', email: 'admin@mitcorer.edu.in', password: 'campusguard' },
];

function AuthScreen({ role, setRole, onEnter, authError }) {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const localDemo = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  const selectDemo = (account) => {
    setRole(account.role);
    setEmail(account.email);
    setPassword(localDemo ? account.password : '');
    setVisible(false);
    setSubmitted(false);
  };
  const changeMode = (next) => {
    setMode(next);
    setSubmitted(false);
    setPassword('');
    setVisible(false);
    if (!['applicant', 'parent'].includes(role)) setRole('applicant');
  };
  const submit = async (event) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setSubmitted(true);
    try {
      await onEnter({ name: name.trim(), email: email.trim(), password, selectedRole: role, mode });
    } finally {
      setPending(false);
    }
  };
  return (
    <main className="loginPage">
      <header className="loginHeader">
        <div className="brandLockup"><span className="collegeLogo"><img src={mitcorerLogo} alt="MITCORER logo" /></span><div><strong>CampusGuard</strong><small>MITCORER, Barshi</small></div></div>
        <span className="loginInstitution">{institution.name}</span>
      </header>
      <section className="loginMain" aria-labelledby="login-title">
        <div className="loginHeading">
          <span className="loginEmblem"><img src={mitcorerLogo} alt="MITCORER logo" /></span>
          <h1 id="login-title">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
          <p>{mode === 'signin' ? 'Sign in to continue your admission journey.' : 'Your admission journey starts here.'}</p>
        </div>
        <div className="loginTabs" role="group" aria-label="Account access">
          <button type="button" aria-pressed={mode === 'signin'} disabled={pending} onClick={() => changeMode('signin')}>Sign in</button>
          <button type="button" aria-pressed={mode === 'signup'} disabled={pending} onClick={() => changeMode('signup')}>Sign up</button>
        </div>
        <form className="loginForm" onSubmit={submit} aria-busy={pending}>
          <fieldset disabled={pending}>
            {mode === 'signin' && <div className="loginDemo">
              <div role="group" aria-label="Choose an account">
                {demoAccounts.map((account) => <button key={account.role} type="button" aria-pressed={email === account.email && password === account.password} onClick={() => selectDemo(account)}>{account.label}</button>)}
              </div>
            </div>}
            {mode === 'signup' && <label htmlFor="login-name">Full name<input id="login-name" autoComplete="name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" /></label>}
            <label htmlFor="login-email">Email address<input id="login-email" type="email" autoComplete="username" required maxLength={120} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
            <label htmlFor="login-password">Password</label>
            <div className="loginPassword">
              <input id="login-password" type={visible ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'signin' ? 'Enter your password' : 'Choose a password'} />
              <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'} title={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button>
            </div>
            {mode === 'signup' && <label htmlFor="login-role">I am applying as<select id="login-role" value={['applicant', 'parent'].includes(role) ? role : 'applicant'} onChange={(event) => setRole(event.target.value)}><option value="applicant">Applicant</option><option value="parent">Parent / guardian</option></select></label>}
            {submitted && authError && <div className="authError" role="alert">{authError}</div>}
            <button className="loginSubmit" type="submit">{pending ? <><LoaderCircle className="loginSpinner" size={18} /> {mode === 'signin' ? 'Signing in...' : 'Creating account...'}</> : <>{mode === 'signin' ? 'Sign in' : 'Create account'}<ArrowRight size={18} /></>}</button>
          </fieldset>
        </form>
        <p className="loginSwitch">{mode === 'signin' ? 'New to CampusGuard?' : 'Already have an account?'} <button type="button" disabled={pending} onClick={() => changeMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p>
      </section>
      <footer className="loginFooter"><LockKeyhole size={14} /> CampusGuard <span>Admission support at MITCORER</span></footer>
    </main>
  );
}

function Sidebar({ user, role, view, setView, navOpen, setNavOpen, collapsed, setCollapsed, onLogout, history }) {
  const nav = getNavigation(role);
  const openView = (id) => { setView(id); setNavOpen(false); };
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('campusguard.sidebarCollapsed', String(next));
  };
  return (
    <aside className={`sidebar ${navOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebarBrandRow">
        <div className="brandLockup compact"><span className="collegeLogo"><img src={mitcorerLogo} alt="MITCORER logo" /></span><div><strong>CampusGuard</strong><small>{institution.code}</small></div></div>
        <button className="sidebarToggle" type="button" onClick={toggleCollapsed} aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'} title={collapsed ? 'Open sidebar' : 'Close sidebar'}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button>
      </div>
      <button className="collegeMini" type="button" onClick={() => openView('assistant')}>
        <strong>{institution.shortName}</strong>
        <span>{institution.city} admission desk</span>
      </button>
      <nav className="sideNav">{nav.map(([id, label, Icon]) => <button key={id} className={view === id ? 'active' : ''} type="button" onClick={() => openView(id)} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}><Icon size={17} /><span>{label}</span></button>)}</nav>
      <section className="chatHistory" aria-label="Chat history">
        <button className="newChatButton" type="button" disabled={history.busy || history.loading} onClick={() => { history.startNew(); openView('assistant'); }}><MessageCircle size={16} /> New chat</button>
        <h2>Recent chats</h2>
        {history.error && <div className="historyError" role="alert"><p>{history.error}</p><button type="button" disabled={history.busy || history.loading} onClick={() => history.loadMore(true)}>Retry</button></div>}
        <div className="historyList">
          {history.items.map((chat) => <button key={chat.id} type="button" className={history.active?.id === chat.id && view === 'assistant' ? 'active' : ''} aria-current={history.active?.id === chat.id && view === 'assistant' ? 'page' : undefined} title={chat.title} disabled={history.busy || history.loading} onClick={() => { history.open(chat.id); openView('assistant'); }}><span>{chat.title}</span><small>{new Date(chat.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></button>)}
        </div>
        {history.loading ? <p role="status">Loading history...</p> : !history.items.length && !history.error ? <p>No conversations yet.</p> : null}
        {history.hasMore && <button className="historyMore" type="button" disabled={history.busy || history.loading} onClick={() => history.loadMore()}>Load older chats</button>}
      </section>
      <div className="accountFooter" title={user.email}>
        <span aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</span>
        <div><strong>{user.name}</strong><small>{roles.find((item) => item.id === role)?.label}</small></div>
        <button type="button" onClick={onLogout} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button>
      </div>
    </aside>
  );
}

function getNavigation(role) {
  if (role === 'staff') return [['queue', 'Review Queue', UsersRound], ['documents', 'Document Reviews', FileCheck2], ['reports', 'Reports', BarChart3], ['audit', 'Audit Logs', ShieldCheck], ['assistant', 'Admission Desk', MessageCircle]];
  if (role === 'admin') return [['knowledge', 'Knowledge Base', FileText], ['queue', 'Inquiries', UsersRound], ['reports', 'Reports', BarChart3], ['audit', 'Audit Logs', ShieldCheck], ['assistant', 'Admission Desk', MessageCircle]];
  return [['assistant', 'Admission Desk', MessageCircle], ['documents', 'Documents', FileText], ['inquiry', 'Request Help', Phone]];
}

function getDefaultView(role) {
  if (role === 'staff') return 'queue';
  if (role === 'admin') return 'knowledge';
  return 'assistant';
}

function Header({ user, setNavOpen, canGoBack, onBack }) {
  return (
    <header className="topHeader">
      <button className="menuBtn" type="button" aria-label="Open navigation" onClick={() => setNavOpen(true)}><Menu size={20} /></button>
      <button className="backBtn" type="button" disabled={!canGoBack} aria-label="Return to previous activity" title="Back" onClick={onBack}><ArrowLeft size={19} /></button>
      <div>
        <h1>{institution.name}</h1>
      </div>
      <div className="authBadge"><LockKeyhole size={15} /><span>{user.email}</span></div>
    </header>
  );
}

function ProtectedView({ role, view, setView, children }) {
  const allowed = rolePermissions[role].allowedViews.includes(view);
  if (allowed) return children;
  return (
    <section className="unauthorizedView">
      <LockKeyhole size={34} />
      <span className="eyebrow">Access denied</span>
      <h2>This area is not available for your current role.</h2>
      <p>{roles.find((item) => item.id === role)?.label} can access: {rolePermissions[role].allowedViews.join(', ')}.</p>
      <button type="button" onClick={() => setView(getDefaultView(role))}>Go to allowed workspace <ArrowRight size={16} /></button>
    </section>
  );
}

function AdmissionDesk({ setView, history, onError, onUploadAttachment }) {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]);
  const messages = history.active?.messages || [];
  const [isSending, setIsSending] = useState(false);
  const sendInFlight = useRef(false);
  const messagesEnd = useRef(null);
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  const send = async (forcedText = '') => {
    if (sendInFlight.current || history.busy || history.loading) return;
    const question = (forcedText || input).trim();
    if (!question && files.length === 0) return;
    sendInFlight.current = true;
    setIsSending(true);
    let uploadedFiles = [];
    try {
      await history.send(async () => {
        uploadedFiles = await Promise.all(files.map((file) => onUploadAttachment(question, file)));
        const attachmentText = uploadedFiles.length ? `Supporting file saved for staff review: ${uploadedFiles.map((file) => file.fileName).join(', ')}` : '';
        return [question, attachmentText].filter(Boolean).join('\n');
      });
      onError('');
      setInput('');
      setFiles([]);
    } catch (error) {
      onError(error.message);
    } finally {
      sendInFlight.current = false;
      setIsSending(false);
    }
  };

  return (
    <section className="chatWorkspace cleanDesk">
      <div className="chatMain">
        <div className="chatToolbar">
          <span>Admission assistant</span>
          <button className="chatHelpAction" type="button" onClick={() => setView('inquiry')}><Phone size={16} /> Staff help</button>
        </div>
        <div className="chatMessages">{messages.length === 0 ? <div className="emptyChatState"><MessageCircle size={26} /><strong>Ask CampusGuard</strong><span>Choose a topic near the question bar or type your question. You can also attach a form, certificate, or notice.</span></div> : messages.map((message, index) => <MessageBubble key={`${message.type}-${index}`} message={message} onAction={setView} />)}{history.busy && <p className="chatActivity" role="status">Please wait...</p>}<div ref={messagesEnd} /></div>
        {files.length > 0 && <div className="attachedFiles">{files.map((file) => <span key={file.name}><Paperclip size={13} /> {file.name}</span>)}</div>}
        <div className="persistentTopics" aria-label="Admission topics">{deskCategories.map((item) => <button key={item.label} type="button" onClick={() => setView(item.view)}>{item.label}</button>)}</div>
        <div className="composer">
          <label title="Attach a supporting file for staff review"><Paperclip size={18} /><input type="file" multiple disabled={isSending || history.busy || history.loading} accept="image/png,image/jpeg,application/pdf" onChange={(event) => setFiles(Array.from(event.target.files || []))} /></label>
          <textarea value={input} rows={2} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            event.preventDefault();
            if (!event.repeat) send();
          }} aria-label="Your admission question" placeholder="Ask about admission, fees, eligibility, documents, or CAP." disabled={isSending || history.busy || history.loading} />
          <button type="button" onClick={() => send()} aria-label="Send" disabled={isSending || history.busy || history.loading}>{isSending || history.busy ? '...' : <Send size={18} />}</button>
        </div>
      </div>
    </section>
  );
}

function MessageBubble({ message, onAction }) {
  return (
    <article className={message.type === 'user' ? 'bubble user' : 'bubble assistant'}>
      {message.type === 'assistant' && <div className="botIcon"><img src={mitcorerLogo} alt="MITCORER" /></div>}
      <div>
        {message.type === 'user' ? <p>{message.text}</p> : <div className="answerBody">
          {formatAnswer(message.text, message.next).map((block, index) => block.type === 'list'
            ? <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>
            : <p key={index}>{block.text}</p>)}
        </div>}
        {message.next && (!message.actionView || !/^Open\b/i.test(message.next.trim())) && <div className="answerNext"><p>{message.next}</p></div>}
        {(message.source || message.officialLinks?.length > 0) && <div className="answerSource">
          {message.sourceUrl ? <a href={message.sourceUrl} target="_blank" rel="noreferrer">{message.source}</a> : message.source && <p>{message.source}</p>}
          {message.officialLinks?.map((link) => <a className="officialAnswerLink" key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} <ArrowRight size={14} /></a>)}
        </div>}
        {message.actionView && <button className="messageAction" type="button" onClick={() => onAction(message.actionView)}>{message.actionLabel} <ArrowRight size={15} /></button>}
      </div>
    </article>
  );
}

function Documents({ role, user, documentReviews, assistantAttachments, onDocumentUpload, onDocumentSubmit, onDocumentRemove, onDocumentStatusChange, onOpenDocument, onOpenAttachment }) {
  const uploadedByDoc = documentReviews
    .filter((item) => item.ownerEmail === user.email)
    .reduce((items, item) => ({ ...items, [item.docName]: item }), {});
  const uploadedCount = Object.keys(uploadedByDoc).length;
  const readyCount = Object.values(uploadedByDoc).filter((item) => item.status === 'Ready for reporting').length;
  const correctionCount = Object.values(uploadedByDoc).filter((item) => item.status === 'Needs correction').length;
  const draftCount = Object.values(uploadedByDoc).filter((item) => ['Uploaded (not submitted)', 'Needs correction'].includes(item.status)).length;
  const submittedCount = Object.values(uploadedByDoc).filter((item) => item.status === 'Submitted for review').length;
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [pendingBulkFiles, setPendingBulkFiles] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);

  if (role === 'staff') {
    return <StaffDocumentReviews records={documentReviews} attachments={assistantAttachments} onStatusChange={onDocumentStatusChange} onOpenDocument={onOpenDocument} onOpenAttachment={onOpenAttachment} />;
  }

  const handleDocumentUpload = (docName, fileList) => {
    const [file] = Array.from(fileList || []);
    if (!file) return;
    onDocumentUpload({
      id: `${user.email}-${docName}`.replace(/\s+/g, '-').toLowerCase(),
      ownerName: user.name,
      ownerEmail: user.email,
      ownerRole: roles.find((item) => item.id === role)?.label || role,
      docName,
      fileName: file.name,
    }, file);
  };

  const handleBulkUpload = (fileList) => {
    const selectedFiles = Array.from(fileList || []);
    const reservedDocs = new Set();
    const availableDocs = documents.filter((doc) => !['Submitted for review', 'Ready for reporting'].includes(uploadedByDoc[doc.name]?.status));
    const mapped = selectedFiles.map((file) => {
      const normalized = file.name.toLowerCase().replace(/[_-]+/g, ' ');
      const matchedDoc = availableDocs.find((doc) => !reservedDocs.has(doc.name) && doc.keywords.some((keyword) => normalized.includes(keyword)));
      if (matchedDoc) reservedDocs.add(matchedDoc.name);
      return { file, docName: matchedDoc?.name || '' };
    });
    setPendingBulkFiles(mapped);
  };

  const updateBulkAssignment = (index, docName) => setPendingBulkFiles((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, docName } : item)));

  const uploadBulkFiles = async () => {
    const assigned = pendingBulkFiles.filter((item) => item.docName);
    if (!assigned.length) return;
    setBulkUploading(true);
    setBulkMessage('');
    let uploaded = 0;
    for (const { file, docName } of assigned) {
      const saved = await onDocumentUpload({
        id: `${user.email}-${docName}`.replace(/\s+/g, '-').toLowerCase(),
        ownerName: user.name,
        ownerEmail: user.email,
        ownerRole: roles.find((item) => item.id === role)?.label || role,
        docName,
        fileName: file.name,
      }, file);
      if (saved) uploaded += 1;
    }
    setBulkUploading(false);
    if (uploaded === assigned.length) setPendingBulkFiles([]);
    setBulkMessage(uploaded
      ? `${uploaded} file${uploaded === 1 ? '' : 's'} added as private drafts. Submit them when the checklist is ready.`
      : 'No files were uploaded. Check the file type and try again.');
  };

  const removeDocument = (docName) => {
    const record = uploadedByDoc[docName];
    if (record) onDocumentRemove(record.id);
  };

  return (
    <div className="documentWorkspace">
      <section className="checklistCard documentChecklist">
        <div className="documentChecklistHead">
          <div className="sectionHead"><span className="eyebrow">Document checklist</span><h2>Prepare and submit your documents.</h2><p>Upload individually or select several files together. Files remain private drafts until you submit them for staff review.</p></div>
          <label className="bulkUploadBtn"><UploadCloud size={18} /> Add multiple files<input type="file" multiple onChange={(event) => handleBulkUpload(event.target.files)} /></label>
        </div>
        {pendingBulkFiles.length > 0 && <div className="bulkAssignment" role="region" aria-label="Match selected files to checklist items">
          <div className="bulkAssignmentHead"><div><strong>Match selected files</strong><span>Confirm what each file contains. Unmatched files are not discarded.</span></div><button type="button" onClick={() => setPendingBulkFiles([])} aria-label="Cancel selected files"><X size={16} /></button></div>
          <div className="bulkAssignmentRows">{pendingBulkFiles.map((item, index) => <label key={`${item.file.name}-${index}`}><span>{item.file.name}</span><select value={item.docName} onChange={(event) => updateBulkAssignment(index, event.target.value)}><option value="">Choose document type</option>{documents.map((doc) => <option key={doc.name} value={doc.name} disabled={pendingBulkFiles.some((selected, selectedIndex) => selectedIndex !== index && selected.docName === doc.name) || ['Submitted for review', 'Ready for reporting'].includes(uploadedByDoc[doc.name]?.status)}>{doc.name}</option>)}</select></label>)}</div>
          <button className="confirmBulkUpload" type="button" disabled={bulkUploading || !pendingBulkFiles.some((item) => item.docName)} onClick={uploadBulkFiles}>{bulkUploading ? 'Uploading...' : `Upload ${pendingBulkFiles.filter((item) => item.docName).length} assigned file${pendingBulkFiles.filter((item) => item.docName).length === 1 ? '' : 's'}`} <ArrowRight size={16} /></button>
        </div>}
        {bulkMessage && <div className="successBox" role="status"><CheckCircle2 size={18} /><div><strong>Draft upload</strong><span>{bulkMessage}</span></div></div>}
        <div className="documentRows">{documents.map((doc) => {
        const uploadedRecord = uploadedByDoc[doc.name];
        return (
          <div key={doc.name} className={`docUploadRow ${uploadedRecord ? 'uploaded' : ''} ${uploadedRecord?.status === 'Needs correction' ? 'needsCorrection' : ''}`}>
            <div className="docUploadStatus">{uploadedRecord ? <CheckCircle2 size={18} /> : <FileText size={18} />}</div>
            <div>
              <strong>{doc.name}</strong>
              <span>{uploadedRecord?.fileName || (doc.required ? 'Required for reporting' : 'If applicable')}</span>
              {uploadedRecord && <small>{uploadedRecord.status}</small>}
            </div>
            <label className={`rowUploadBtn ${['Submitted for review', 'Ready for reporting'].includes(uploadedRecord?.status) ? 'disabled' : ''}`}>
              {uploadedRecord ? 'Replace' : 'Upload'}
              <input type="file" disabled={['Submitted for review', 'Ready for reporting'].includes(uploadedRecord?.status)} onChange={(event) => handleDocumentUpload(doc.name, event.target.files)} />
            </label>
            {uploadedRecord && !['Submitted for review', 'Ready for reporting'].includes(uploadedRecord.status) && <button className="clearDocBtn" type="button" onClick={() => removeDocument(doc.name)} aria-label={`Remove ${doc.name}`}><X size={15} /></button>}
            {uploadedRecord?.reviewNote && <p className="documentFeedback"><strong>Staff feedback:</strong> {uploadedRecord.reviewNote}</p>}
          </div>
        );
      })}</div>
        <div className="documentOverview">
          <div className="uploadProgress"><strong>{uploadedCount}/{documents.length}</strong><span>uploaded</span></div>
          <div className="statusSummary">
            <span>{readyCount} ready</span>
            <span>{correctionCount} need correction</span>
            <span>{submittedCount} with staff</span>
          </div>
        </div>
        <div className="documentHandoff">
          <div><strong>{draftCount ? `${draftCount} file${draftCount === 1 ? '' : 's'} ready to submit` : submittedCount ? 'Staff review is in progress' : readyCount === uploadedCount && uploadedCount ? 'Review completed' : 'Upload files to begin'}</strong><span>{draftCount ? 'Submit once to send all new and corrected files to the staff Document Reviews queue.' : 'Review status and staff feedback appear on each document row.'}</span></div>
          <button type="button" disabled={!draftCount} onClick={async () => { const result = await onDocumentSubmit(); if (result) setSubmissionMessage(`${result.submittedCount} document${result.submittedCount === 1 ? '' : 's'} submitted to admission staff.`); }}>Submit for staff review <ArrowRight size={16} /></button>
        </div>
        {submissionMessage && <div className="successBox" role="status"><CheckCircle2 size={18} /><div><strong>Sent to staff</strong><span>{submissionMessage}</span></div></div>}
        <p className="warningText"><ShieldCheck size={16} /> Pre-check is guidance only. Final verification remains with admission authority.</p>
      </section>
    </div>
  );
}

function StaffDocumentReviews({ records, attachments, onStatusChange, onOpenDocument, onOpenAttachment }) {
  const [notes, setNotes] = useState({});
  return (
    <div className="pageStack">
      <div className="sectionHead"><span className="eyebrow">Staff document review</span><h2>Pre-check queue for uploaded admission documents</h2><p>Review uploaded files, mark readiness, and identify documents that need correction before campus reporting.</p></div>
      {records.length === 0 ? (
        <section className="emptyState"><FileCheck2 size={28} /><h3>No documents uploaded yet</h3><p>Applicant uploads will appear here for staff review.</p></section>
      ) : (
        <div className="reviewGrid">{records.map((record) => (
          <article key={record.id}>
            <FileCheck2 size={20} />
            <div>
              <h3>{record.ownerName}</h3>
              <p>{record.docName}<br />{record.fileName}</p>
              <strong>{record.status}</strong>
              <label className="reviewNote">Feedback to applicant<textarea rows={2} value={notes[record.id] ?? record.reviewNote ?? ''} onChange={(event) => setNotes((items) => ({ ...items, [record.id]: event.target.value }))} placeholder="Required when requesting a correction" /></label>
              <div className="reviewActions">
                {record.storedFileName && <button type="button" onClick={() => onOpenDocument(record.id)}>Open file</button>}
                <button type="button" onClick={() => onStatusChange(record.id, 'Ready for reporting', notes[record.id] || 'Document verified for reporting pre-check.')}>Ready</button>
                <button type="button" disabled={!(notes[record.id] ?? record.reviewNote ?? '').trim()} onClick={() => onStatusChange(record.id, 'Needs correction', notes[record.id] || record.reviewNote)}>Needs correction</button>
              </div>
            </div>
          </article>
        ))}</div>
      )}
      <section className="panelBlock">
        <div className="sectionHead"><span className="eyebrow">Admission desk attachments</span><h2>Files shared with questions</h2><p>These files are supporting context for staff. They are separate from the mandatory document checklist.</p></div>
        {attachments.length === 0 ? <p className="mutedText">No supporting files have been shared yet.</p> : <div className="compactList">{attachments.map((item) => <div key={item.id}><strong>{item.ownerName}</strong><span>{item.fileName}</span><button className="miniEditBtn" type="button" onClick={() => onOpenAttachment(item.id)}>Open file</button></div>)}</div>}
      </section>
    </div>
  );
}

function getAllotmentDecision(allotment) {
  if (allotment.decision === 'keep') {
    return {
      title: allotment.preference === '1-3' ? 'Self Freeze / confirm seat carefully' : 'Keep seat only if branch and college fit',
      text: 'If the student is satisfied with the allotted seat, freezing stops further betterment. Confirm consequences on the official portal before submitting.',
    };
  }
  if (allotment.decision === 'betterment') {
    return {
      title: 'Betterment path',
      text: 'Accept the current seat where required, but continue for better preference only if official CAP rules for the round allow it. Track deadlines closely.',
    };
  }
  return {
    title: 'Decision needs discussion',
    text: 'Compare branch fit, travel, fees, scholarship documents, and career preference before choosing freeze or betterment.',
  };
}

function CapProcess({ initial, onSave, setView }) {
  const [stageIndex, setStageIndex] = useState(initial?.stageIndex ?? 4);
  const [allotment, setAllotment] = useState(initial?.allotment || { round: 'Round 1', preference: '1-3', decision: 'betterment' });
  const [readyItems, setReadyItems] = useState(initial?.readyItems || {
    acceptance: false,
    allotmentLetter: true,
    documents: false,
    fees: false,
    scholarship: false,
    hostel: false,
  });
  const stage = capStages[stageIndex];
  const nextStage = capStages[Math.min(stageIndex + 1, capStages.length - 1)];
  const readinessLabels = {
    acceptance: 'Seat acceptance step understood/completed',
    allotmentLetter: 'CAP allotment letter ready',
    documents: 'Required documents checked',
    fees: 'Fee category and payable amount understood',
    scholarship: 'Scholarship/category documents prepared',
    hostel: 'Hostel/mess decision clear',
  };
  const completed = Object.values(readyItems).filter(Boolean).length;
  const readinessPercent = Math.round((completed / Object.keys(readyItems).length) * 100);
  const decisionText = getAllotmentDecision(allotment);
  const saveCap = (nextStageIndex, nextAllotment, nextReadyItems) => onSave({ stageIndex: nextStageIndex, allotment: nextAllotment, readyItems: nextReadyItems });
  const changeStage = (value) => { const next = Number(value); setStageIndex(next); saveCap(next, allotment, readyItems); };
  const changeAllotment = (key, value) => { const next = { ...allotment, [key]: value }; setAllotment(next); saveCap(stageIndex, next, readyItems); };
  const toggleReady = (key) => setReadyItems((items) => { const next = { ...items, [key]: !items[key] }; saveCap(stageIndex, allotment, next); return next; });

  return (
    <div className="pageStack capPage">
      <section className="capHero">
        <div>
          <span className="eyebrow">Maharashtra Engineering CAP</span>
          <h2>Know where you are in CAP and what to do next.</h2>
          <p>Select your current step. CampusGuard will show the next action and help you prepare for college reporting.</p>
        </div>
        <div className="capOfficialLinks">
          <a href="https://fe2026.mahacet.org/StaticPages/HomePage" target="_blank" rel="noreferrer">B.Tech CAP portal <ArrowRight size={16} /></a>
          <a href="https://cetcell.mahacet.org/notices/" target="_blank" rel="noreferrer">CET notices <ArrowRight size={16} /></a>
          <a href="https://dte.maharashtra.gov.in/" target="_blank" rel="noreferrer">DTE Maharashtra <ArrowRight size={16} /></a>
        </div>
      </section>
      <section className="decisionPanel">
        <div>
          <div className="sectionHead"><span className="eyebrow">Choose your situation</span><h2>What has happened so far?</h2><p>Select the closest option. You can change it anytime.</p></div>
          <div className="capSituationGrid">{capStages.map((item, index) => <button className={stageIndex === index ? 'active' : ''} type="button" key={item.stage} onClick={() => changeStage(index)}><span>{index + 1}</span>{item.stage}</button>)}</div>
        </div>
        <div className="decisionResult">
          <span className="eyebrow">Do this now</span>
          <strong>{stage.stage}</strong>
          <p>{stage.action}</p>
          <small>Next: {nextStage.stage}</small>
        </div>
      </section>
      {stageIndex >= 4 && stageIndex <= 5 && <section className="decisionPanel">
        <div>
          <div className="sectionHead"><span className="eyebrow">2. If you received a seat</span><h2>Do you want to keep it or try for a better choice?</h2></div>
          <div className="decisionForm">
            <label>CAP round<select value={allotment.round} onChange={(event) => changeAllotment('round', event.target.value)}><option>Round 1</option><option>Round 2</option><option>Round 3</option><option>Institute level</option></select></label>
            <label>Allotted preference<select value={allotment.preference} onChange={(event) => changeAllotment('preference', event.target.value)}><option value="1-3">Preference 1-3</option><option value="4+">Preference 4 or lower</option><option value="notPreferred">Not preferred</option></select></label>
            <label>What do you want to do?<select value={allotment.decision} onChange={(event) => changeAllotment('decision', event.target.value)}><option value="keep">I want to keep this seat</option><option value="betterment">I want to try for a better choice</option><option value="unsure">I need help deciding</option></select></label>
          </div>
        </div>
        <div className={`decisionResult ${allotment.decision === 'keep' ? 'positive' : 'notice'}`}>
          <span className="eyebrow">What this choice means</span>
          <strong>{decisionText.title}</strong>
          <p>{decisionText.text}</p>
        </div>
      </section>}
      {stageIndex >= 6 && <section className="panelBlock">
        <div className="sectionHead"><span className="eyebrow">3. Before visiting college</span><h2>{readinessPercent}% ready for institute reporting</h2><p>Tick only the items you have completed or clearly understood.</p></div>
        <div className="progressBar"><span style={{ width: `${readinessPercent}%` }} /></div>
        <div className="checkGrid">{Object.entries(readinessLabels).map(([key, label]) => <label key={key} className={readyItems[key] ? 'checked' : ''}><input type="checkbox" checked={readyItems[key]} onChange={() => toggleReady(key)} /> <span>{label}</span></label>)}</div>
        <div className="workflowActions"><button type="button" onClick={() => setView('documents')}>Continue to documents <ArrowRight size={16} /></button><button type="button" onClick={() => setView('inquiry')}>Ask staff about reporting</button></div>
      </section>}
      <section className="capSimpleHelp"><p>Not sure which option matches your case?</p><button type="button" onClick={() => setView('inquiry')}>Ask admission staff <ArrowRight size={16} /></button></section>
    </div>
  );
}

function Programs({ initial, onSave, setView }) {
  const [preferences, setPreferences] = useState(initial?.preferences || []);
  const updatePreferences = (updater) => setPreferences((items) => { const next = typeof updater === 'function' ? updater(items) : updater; onSave({ preferences: next }); return next; });
  const addPreference = (course) => {
    updatePreferences((items) => (items.some((item) => item.choiceCode === course.choiceCode) ? items : [...items, course]));
  };
  const removePreference = (choiceCode) => updatePreferences((items) => items.filter((item) => item.choiceCode !== choiceCode));
  const movePreference = (index, direction) => {
    updatePreferences((items) => {
      const target = index + direction;
      if (target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <div className="pageStack">
      <section className="panelBlock verificationStrip">
        <div><span className="eyebrow">Official verification</span><h2>Approval and university records</h2></div>
        <div className="workflowActions">
          <a href="https://mitcorer.edu.in/pdf/Extension-of-Approval-2025-26.pdf" target="_blank" rel="noreferrer">AICTE extension of approval <ArrowRight size={16} /></a>
          <a href="https://mitcorer.edu.in/pdf/Mandatory-Disclousure.pdf" target="_blank" rel="noreferrer">Mandatory disclosure <ArrowRight size={16} /></a>
          <a href="https://su.digitaluniversity.ac/" target="_blank" rel="noreferrer">PAHSUS University portal <ArrowRight size={16} /></a>
        </div>
      </section>
      <div className="sectionHead"><span className="eyebrow">Program Finder</span><h2>Compare admission options before filling preferences.</h2><p>Shortlist branches, arrange a draft preference order, and keep choice codes ready for CAP or institute-level discussion.</p></div>
      <section className="decisionPanel">
        <div className="programGrid">
          {courses.map((course) => {
            const added = preferences.some((item) => item.choiceCode === course.choiceCode);
            return (
              <article key={course.choiceCode}>
                <h3>{course.name}</h3>
                <dl><div><dt>Intake</dt><dd>{course.intake}</dd></div><div><dt>Choice code</dt><dd>{course.choiceCode}</dd></div></dl>
                <button className="inlineAction secondary" type="button" disabled={added} onClick={() => addPreference(course)}>{added ? 'Added to draft' : 'Add to preference'} <ArrowRight size={15} /></button>
              </article>
            );
          })}
        </div>
        <div className="decisionResult">
          <span className="eyebrow">CAP preference draft</span>
          {preferences.length === 0 ? (
            <p>Add branches from the left side to build a draft order before CAP option form discussion.</p>
          ) : (
            <div className="preferenceList">
              {preferences.map((course, index) => (
                <div className="preferenceItem" key={course.choiceCode}>
                  <strong>{index + 1}. {course.name}</strong>
                  <span>{course.choiceCode}</span>
                  <div>
                    <button type="button" onClick={() => movePreference(index, -1)} disabled={index === 0}>Up</button>
                    <button type="button" onClick={() => movePreference(index, 1)} disabled={index === preferences.length - 1}>Down</button>
                    <button type="button" onClick={() => removePreference(course.choiceCode)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {preferences.length > 0 && <button className="inlineAction" type="button" onClick={() => setView('cap')}>Use this draft in CAP planning <ArrowRight size={16} /></button>}
        </div>
      </section>
      <section className="panelBlock"><div className="sectionHead"><span className="eyebrow">Direct Second Year</span><h2>DSE choice codes</h2></div><div className="compactList">{dseCourses.map((course) => <div key={course.choiceCode}><strong>{course.name}</strong><span>{course.choiceCode}</span></div>)}</div></section>
      <section className="panelBlock"><div className="sectionHead"><span className="eyebrow">Polytechnic</span><h2>Diploma courses</h2></div><div className="compactList">{polytechnicCourses.map((course) => <div key={course.name}><strong>{course.name}</strong><span>Intake {course.intake}</span></div>)}</div></section>
    </div>
  );
}

function Fees({ initial, onSave, setView }) {
  const [estimate, setEstimate] = useState(Object.keys(initial || {}).length ? initial : { admission: 'fy', category: 'open', hostel: 'no', mess: 'no' });
  const updateEstimate = (key, value) => { const next = { ...estimate, [key]: value }; setEstimate(next); onSave(next); };
  const academicFees = {
    fy: { open: 105000, boys: 61109, girls: 17217, vjnt: 17217, scst: 8000 },
    dse: { open: 98000, boys: 58181, girls: 18362, vjnt: 18362, scst: 10000 },
  };
  const academic = academicFees[estimate.admission][estimate.category];
  const hostel = estimate.hostel === 'yes' ? 40000 : 0;
  const mess = estimate.mess === 'yes' ? 42000 : 0;
  const total = academic + hostel + mess;
  const formatCurrency = (amount) => `INR ${amount.toLocaleString('en-IN')}`;
  const scholarshipHint = estimate.category === 'open'
    ? 'Open/OMS profile may need EBC/EWS income proof if concession is expected.'
    : estimate.category === 'scst'
      ? 'SC/ST profile should prepare category proof and applicable scholarship documents.'
      : 'Category profile should verify scholarship/concession documents before reporting.';

  return <div className="pageStack"><div className="sectionHead"><span className="eyebrow">Fee Planner</span><h2>Estimate what to confirm before reporting.</h2><p>Select admission route and category to get an estimated payable amount before visiting campus.</p></div><section className="decisionPanel"><div><div className="sectionHead"><span className="eyebrow">Estimate calculator</span><h2>{formatCurrency(total)}</h2></div><div className="decisionForm"><label>Admission type<select value={estimate.admission} onChange={(event) => updateEstimate('admission', event.target.value)}><option value="fy">First Year Engineering</option><option value="dse">Direct Second Year</option></select></label><label>Category<select value={estimate.category} onChange={(event) => updateEstimate('category', event.target.value)}><option value="open">Open / OMS</option><option value="boys">Open EBC/EWS/OBC/SEBC Boys</option><option value="girls">Girls</option><option value="vjnt">VJNT / SBC / TFWS</option><option value="scst">SC / ST</option></select></label><label>Hostel<select value={estimate.hostel} onChange={(event) => updateEstimate('hostel', event.target.value)}><option value="no">No</option><option value="yes">Yes</option></select></label><label>Mess<select value={estimate.mess} onChange={(event) => updateEstimate('mess', event.target.value)}><option value="no">No</option><option value="yes">Yes</option></select></label></div></div><div className="decisionResult positive"><span className="eyebrow">Saved estimate</span><div className="stepRow compact"><CheckCircle2 size={17} /> Academic fee: {formatCurrency(academic)}</div><div className="stepRow compact"><CheckCircle2 size={17} /> Hostel: {formatCurrency(hostel)}</div><div className="stepRow compact"><CheckCircle2 size={17} /> Mess: {formatCurrency(mess)}</div><strong>Total: {formatCurrency(total)}</strong></div></section><section className="panelBlock"><div className="sectionHead"><span className="eyebrow">Scholarship connection</span><h2>Check concession documents before payment.</h2><p>{scholarshipHint}</p></div><div className="workflowActions"><button type="button" onClick={() => setView('scholarships')}>Check scholarship readiness <ArrowRight size={16} /></button><button type="button" onClick={() => setView('documents')}>Prepare fee documents</button><a href="https://mahafra.org/" target="_blank" rel="noreferrer">Verify approved fees on FRA <ArrowRight size={16} /></a><button type="button" onClick={() => setView('inquiry')}>Ask staff about payment</button></div></section>{feeRecords.map((record) => <section className="feeRecord" key={record.title}><div><span className="eyebrow">{record.year}</span><h3>{record.title}</h3><ul>{record.rows.map((row) => <li key={row}>{row}</li>)}</ul></div><img src={record.image} alt={`${record.title} fee table`} /></section>)}</div>;
}

function ScholarshipAid({ initial, onSave, setView }) {
  const [profile, setProfile] = useState({
    category: 'obc',
    income: 'under8',
    hostel: 'yes',
    admission: 'firstYear',
    gender: 'girl',
    route: 'cap',
    ...(initial || {}),
  });
  const updateProfile = (key, value) => { const next = { ...profile, [key]: value }; setProfile(next); onSave(next); };
  const pragatiDocuments = profile.gender === 'girl' && profile.income === 'under8'
    ? ['10th / 12th marksheet as applicable', 'Admission letter or institute-level allotment / merit proof', 'Institute certificate', 'Tuition fee receipt', 'Aadhaar-seeded student bank passbook', 'Aadhaar card', 'Parent declaration']
    : [];
  const selectedDocs = [...new Set([...(scholarshipDocuments[profile.category] || scholarshipDocuments.open), ...pragatiDocuments])];
  const likelyScholarships = getLikelyScholarships(profile);
  return (
    <div className="pageStack">
      <div className="sectionHead"><span className="eyebrow">Scholarship Aid</span><h2>Find likely scholarship routes from student profile.</h2><p>Select the profile to see which scholarship or concession route may fit and which documents should be prepared.</p></div>
      <section className="decisionPanel">
        <div className="decisionForm">
          <label>Admission type<select value={profile.admission} onChange={(event) => updateProfile('admission', event.target.value)}><option value="firstYear">First Year Engineering</option><option value="dse">Direct Second Year</option><option value="polytechnic">Polytechnic</option></select></label>
          <label>Admission route<select value={profile.route || 'cap'} onChange={(event) => updateProfile('route', event.target.value)}><option value="cap">CAP / centralized admission</option><option value="nonCap">Institute-level / non-CAP</option></select></label>
          <label>Student gender<select value={profile.gender || 'girl'} onChange={(event) => updateProfile('gender', event.target.value)}><option value="girl">Girl</option><option value="boy">Boy</option><option value="other">Other / prefer not to say</option></select></label>
          <label>Category / claim<select value={profile.category} onChange={(event) => updateProfile('category', event.target.value)}><option value="open">Open / OMS</option><option value="ews">EWS / EBC</option><option value="obc">OBC / SEBC</option><option value="vjnt">VJNT / SBC</option><option value="scst">SC / ST</option><option value="minority">Minority</option></select></label>
          <label>Family income<select value={profile.income} onChange={(event) => updateProfile('income', event.target.value)}><option value="under8">Up to 8 lakh</option><option value="over8">Above 8 lakh / not claiming</option></select></label>
          <label>Hostel needed<select value={profile.hostel} onChange={(event) => updateProfile('hostel', event.target.value)}><option value="yes">Yes</option><option value="no">No</option><option value="unsure">Not decided</option></select></label>
        </div>
        <div className="decisionResult">
          <span className="eyebrow">Required document checklist</span>
          {selectedDocs.map((item) => <div className="stepRow compact" key={item}><CheckCircle2 size={17} /> {item}</div>)}
        </div>
      </section>
      <section className="panelBlock">
        <div className="sectionHead"><span className="eyebrow">Likely applicable routes</span><h2>Based on selected situation</h2></div>
        <div className="ruleGrid">{likelyScholarships.map((item) => <div key={item.title}><strong>{item.title}</strong><p>{item.reason}</p></div>)}</div>
        <p className="warningText"><ShieldCheck size={16} /> This is guidance for preparation. Final eligibility depends on official scheme rules and document verification.</p>
        <div className="workflowActions"><button type="button" onClick={() => setView('documents')}>Upload required proofs <ArrowRight size={16} /></button><a href="https://scholarships.gov.in/All-Scholarships" target="_blank" rel="noreferrer">Check Pragati on NSP <ArrowRight size={16} /></a><a href="https://www.mitcorer.edu.in/scholarship.php" target="_blank" rel="noreferrer">MITCORER scholarship list <ArrowRight size={16} /></a><a href="https://mahadbt.maharashtra.gov.in/login/login" target="_blank" rel="noreferrer">Apply through MahaDBT <ArrowRight size={16} /></a><button type="button" onClick={() => setView('inquiry')}>Ask staff about scheme fit</button></div>
      </section>
      <div className="visitGrid">
      <section className="panelBlock">
        <div className="sectionHead"><span className="eyebrow">Scheme groups</span><h2>Scholarships listed for admission guidance</h2></div>
        {scholarshipSchemes.map((scheme) => <div className="stepRow" key={scheme}><HandCoins size={17} /> {scheme}</div>)}
      </section>
      <section className="panelBlock">
        <div className="sectionHead"><span className="eyebrow">Document purpose</span><h2>Why each proof matters</h2></div>
        <div className="compactList">{scholarshipChecklist.map(([label, text]) => <div key={label}><strong>{label}</strong><span>{text}</span></div>)}</div>
      </section>
      </div>
    </div>
  );
}

function CareerOutcomes({ setView }) {
  const [branch, setBranch] = useState('Computer Science and Engineering');
  const outcome = branchCareerOutcomes[branch];
  return (
    <div className="pageStack careerPage">
      <div className="placementHero"><div><span className="eyebrow">Career & Placement</span><h2>From admission to a placement opportunity</h2><p>Understand how students prepare, discover opportunities, register for drives, and verify MITCORER placement outcomes.</p></div><a href="https://www.mitcorer.edu.in/placement-committee.php" target="_blank" rel="noreferrer">Contact placement cell <ArrowRight size={16} /></a></div>
      <section className="placementJourney"><article><span>1</span><div><h3>Build your profile</h3><p>Keep academics, resume, projects, skills, and communication evidence ready.</p></div></article><article><span>2</span><div><h3>Become placement-ready</h3><p>Use Preskilet for video-profile, communication, proof-of-work, and recruiter-oriented activities.</p></div></article><article><span>3</span><div><h3>Find and register</h3><p>Use POD.AI and official TPO communication for job descriptions, eligibility, registrations, dates, and updates.</p></div></article><article><span>4</span><div><h3>Complete the drive</h3><p>Attend tests, interviews, and selection stages; follow the company criteria and placement policy.</p></div></article></section>
      <section className="placementPlatformGrid">{placementPlatforms.map((platform) => <article key={platform.name}><div><span>Student platform</span><h2>{platform.name}</h2><p>{platform.purpose}</p></div><ul>{platform.details.map((item) => <li key={item}>{item}</li>)}</ul><a href={platform.url} target="_blank" rel="noreferrer">Open official platform <ArrowRight size={15} /></a></article>)}</section>
      <section className="branchExplorer">
        <label>Choose the branch you are considering<select value={branch} onChange={(event) => setBranch(event.target.value)}>{courses.map((course) => <option key={course.choiceCode} value={course.name}>{course.name}</option>)}</select></label>
        <div className="branchOutcomeColumns"><div><span>Possible career directions</span><h2>{branch}</h2><ul>{outcome.roles.map((item) => <li key={item}>{item}</li>)}</ul></div><div><span>What the student should prepare</span><h2>Skills and exposure</h2><ul>{outcome.skills.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
        <p className="careerDisclaimer">These are possible directions, not guaranteed jobs. Actual eligibility depends on the recruiter, student skills, academic performance, and market conditions.</p>
      </section>
      <section className="placementEvidence"><div className="sectionHead"><span className="eyebrow">Official 2024-25 record</span><h2>Placement and internship snapshot</h2><p>Period-specific figures from MITCORER's published Placement/Internship Statistics 2024–25. They should not be combined with lifetime promotional totals.</p></div><div className="reportGrid">{placementSignals.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><div className="placementTable"><div><strong>Branch</strong><strong>Students</strong><strong>Internships</strong><strong>Placed</strong></div>{branchPlacementRecords.map((row) => <div key={row[0]}>{row.map((value) => <span key={value}>{value}</span>)}</div>)}</div><div className="evidenceLinks"><a href="https://www.mitcorer.edu.in/pdf/Placement_Internship_statistics_2024-2025.pdf" target="_blank" rel="noreferrer">Open official 2024-25 record <ArrowRight size={15} /></a><a href="https://mitcorer.edu.in/" target="_blank" rel="noreferrer">View current college highlights <ArrowRight size={15} /></a></div></section>
      <section className="placementEvidence"><div className="sectionHead"><span className="eyebrow">Recruiter context</span><h2>Companies highlighted in college admission material</h2><p>Presence in published material does not mean every company recruits every branch or visits every year.</p></div><div className="facilityList">{recruiters.map((item) => <span key={item}>{item}</span>)}</div></section>
      <section className="placementQuestions"><div><h2>Before taking admission, ask the TPO:</h2><ul><li>Show the latest branch-wise eligible, placed, internship, and offer counts.</li><li>Which opportunities are currently posted through POD.AI?</li><li>How will students be onboarded and assessed through Preskilet?</li><li>Which training begins in first year, and which activities are compulsory?</li><li>Are package figures college-wide, branch-specific, or single-student outcomes?</li></ul></div><div className="workflowActions"><button type="button" onClick={() => setView('inquiry')}>Ask placement cell <ArrowRight size={16} /></button><button type="button" onClick={() => setView('programs')}>Compare programs</button></div></section>
    </div>
  );
}

function HostelMess({ initial, onSave, setView }) {
  const [plan, setPlan] = useState(Object.keys(initial || {}).length ? initial : { hostel: 'yes', mess: 'yes', transport: 'no' });
  const updatePlan = (key, value) => { const next = { ...plan, [key]: value }; setPlan(next); onSave(next); };
  const hostelTotal = plan.hostel === 'yes' ? 40000 : 0;
  const messTotal = plan.mess === 'yes' ? 42000 : 0;
  const stayTotal = hostelTotal + messTotal;
  const formatCurrency = (amount) => `INR ${amount.toLocaleString('en-IN')}`;
  return (
    <div className="pageStack">
      <div className="sectionHead"><span className="eyebrow">Hostel & Mess</span><h2>Check stay and meal planning before reporting.</h2><p>Estimate stay cost and confirm availability, rules, and payment process before travelling.</p></div>
      <section className="decisionPanel">
        <div className="decisionForm">
          <label>Hostel needed<select value={plan.hostel} onChange={(event) => updatePlan('hostel', event.target.value)}><option value="yes">Yes</option><option value="no">No</option></select></label>
          <label>Mess needed<select value={plan.mess} onChange={(event) => updatePlan('mess', event.target.value)}><option value="yes">Yes</option><option value="no">No</option></select></label>
          <label>Bus/transport query<select value={plan.transport} onChange={(event) => updatePlan('transport', event.target.value)}><option value="no">No</option><option value="yes">Yes</option></select></label>
        </div>
        <div className="decisionResult positive">
          <span className="eyebrow">Stay cost estimate</span>
          <strong>{formatCurrency(stayTotal)}</strong>
          <p>Hostel: {formatCurrency(hostelTotal)}<br />Mess: {formatCurrency(messTotal)}{plan.transport === 'yes' ? <><br />Bus route and charges should be confirmed with staff.</> : null}</p>
        </div>
      </section>
      <div className="reportGrid">{hostelMessDetails.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <div className="visitGrid"><section className="panelBlock"><div className="sectionHead"><span className="eyebrow">Confirm before admission</span><h2>Stay decision checklist</h2></div>{hostelConfirmations.map((item) => <div className="stepRow" key={item}><CheckCircle2 size={17} /> {item}</div>)}</section><section className="panelBlock"><div className="sectionHead"><span className="eyebrow">Campus facilities</span><h2>Useful infrastructure</h2></div><div className="facilityList">{facilities.map((item) => <span key={item}>{item}</span>)}</div><p className="warningText"><ShieldCheck size={16} /> Final room availability, rules, and payment process should be confirmed by admission/hostel staff.</p></section></div>
      <section className="panelBlock"><div className="sectionHead"><span className="eyebrow">Continue</span><h2>Confirm current availability with the college.</h2></div><div className="workflowActions"><button type="button" onClick={() => setView('inquiry')}>Request hostel or transport confirmation <ArrowRight size={16} /></button><button type="button" onClick={() => setView('fees')}>Include stay cost in fee plan</button></div></section>
    </div>
  );
}

function Inquiry({ user, role, inquiries, onCreateInquiry }) {
  const [form, setForm] = useState({ name: user.name || '', contact: user.email || '', city: '', topic: 'Documents', question: '' });
  const [submitted, setSubmitted] = useState(null);
  const update = (key, value) => setForm((item) => ({ ...item, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.contact.trim() || !form.question.trim()) return;
    const record = {
      name: form.name.trim(),
      role: roles.find((item) => item.id === role)?.label || role,
      topic: form.topic,
      city: form.city.trim() || 'Not provided',
      contact: form.contact.trim(),
      question: form.question.trim(),
    };
    const saved = await onCreateInquiry(record);
    if (saved) {
      setSubmitted(saved);
      setForm((item) => ({ ...item, question: '' }));
    }
  };
  return <div className="pageStack"><div className="visitGrid"><section className="formBlock"><div className="sectionHead"><span className="eyebrow">Request help</span><h2>Create one admission inquiry</h2><p>Use staff help for student-specific doubts: pending certificates, payable amount, hostel availability, travel timing, or reporting confirmation.</p></div>{submitted && <div className="successBox"><CheckCircle2 size={18} /><div><strong>Inquiry submitted</strong><span>{submitted.topic} query is now visible in the staff queue. Track its reply below.</span></div></div>}<form onSubmit={submit}><label>Name<input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Student or parent name" /></label><label>Phone or email<input value={form.contact} onChange={(event) => update('contact', event.target.value)} placeholder="Contact for callback" /></label><label>City<input value={form.city} onChange={(event) => update('city', event.target.value)} placeholder="Example: Latur, Beed, Solapur" /></label><label>Topic<select value={form.topic} onChange={(event) => update('topic', event.target.value)}><option>Documents</option><option>Fees</option><option>Scholarship</option><option>Hostel & mess</option><option>Programs</option><option>Placement</option><option>Campus visit</option></select></label><label className="wide">Question<textarea rows={4} value={form.question} onChange={(event) => update('question', event.target.value)} placeholder="Write the exact admission doubt..." /></label><label className="check wide"><input type="checkbox" defaultChecked /> Staff may contact me about this admission inquiry.</label><button type="submit">Submit inquiry <ArrowRight size={16} /></button></form></section><section className="panelBlock"><div className="sectionHead"><span className="eyebrow">Official contact</span><h2>Call or contact MITCORER admissions</h2></div><p>{institution.address}</p><div className="officialContact"><a href={`mailto:${institution.email}`}>{institution.email}</a>{admissionPhones.map((phone) => <a key={phone.href} href={phone.href}><Phone size={15} /> {phone.label}</a>)}</div><div className="facilityList">{['Admissions', 'Documents', 'Fees', 'Hostel', 'Transport', 'Course selection'].map((item) => <span key={item}>{item}</span>)}</div></section></div><section className="panelBlock"><div className="sectionHead"><span className="eyebrow">My requests</span><h2>Track staff responses</h2><p>Status and replies update here after admission staff reviews your request.</p></div>{inquiries.length === 0 ? <p className="mutedText">No help requests submitted yet.</p> : <div className="inquiryTimeline">{inquiries.map((item) => <article key={item.id}><header><div><strong>{item.topic}</strong><span>{item.id}</span></div><span className="pill">{item.status}</span></header><p>{item.question}</p>{item.assignedTo && <small>Assigned to {item.assignedTo}</small>}{(item.messages || []).map((message) => <blockquote key={message.id}><strong>{message.authorName}</strong><p>{message.text}</p><small>{new Date(message.createdAt).toLocaleString()}</small></blockquote>)}</article>)}</div>}</section></div>;
}

function StaffQueue({ user, inquiries, documentReviews, onUpdateInquiry }) {
  const [selectedId, setSelectedId] = useState(inquiries[0]?.id || '');
  const [reply, setReply] = useState('');
  const selected = inquiries.find((item) => item.id === selectedId) || inquiries[0];
  const openInquiries = inquiries.filter((item) => item.status !== 'Resolved').length;
  const pendingDocuments = documentReviews.filter((item) => !['Ready for reporting'].includes(item.status)).length;
  const highPriority = inquiries.filter((item) => ['High', 'New'].includes(item.priority)).length;
  return (
    <div className="pageStack">
      <div className="sectionHead"><span className="eyebrow">Staff workflow</span><h2>Inquiry and document review queue</h2><p>Applicant and parent requests arrive here, while uploaded documents remain available in the document review workspace.</p></div>
      <div className="reportGrid">
        <article><span>Open inquiries</span><strong>{openInquiries}</strong></article>
        <article><span>Pending documents</span><strong>{pendingDocuments}</strong></article>
        <article><span>High/new priority</span><strong>{highPriority}</strong></article>
        <article><span>Total requests</span><strong>{inquiries.length}</strong></article>
      </div>
      <div className="inquiryWorkspace"><section className="inquiryList" aria-label="Inquiry queue">{inquiries.map((item) => <button key={item.id} className={selected?.id === item.id ? 'active' : ''} type="button" onClick={() => { setSelectedId(item.id); setReply(''); }}><div><strong>{item.name}</strong><span>{item.topic}</span></div><span className="pill">{item.status}</span><p>{item.question}</p></button>)}</section>{selected ? <section className="inquiryDetail"><div className="sectionHead"><span className="eyebrow">{selected.id}</span><h2>{selected.topic}</h2></div><dl><div><dt>Applicant</dt><dd>{selected.name} ({selected.role})</dd></div><div><dt>Contact</dt><dd>{selected.contact}</dd></div><div><dt>City</dt><dd>{selected.city}</dd></div><div><dt>Assigned to</dt><dd>{selected.assignedTo || 'Unassigned'}</dd></div></dl><div className="inquiryQuestion"><strong>Question</strong><p>{selected.question}</p></div>{(selected.messages || []).length > 0 && <div className="staffReplyHistory">{selected.messages.map((message) => <div key={message.id}><strong>{message.authorName}</strong><p>{message.text}</p><small>{new Date(message.createdAt).toLocaleString()}</small></div>)}</div>}<label className="staffReply">Reply to applicant<textarea rows={4} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a clear action or answer for the applicant" /></label><div className="inquiryActions"><button type="button" onClick={() => onUpdateInquiry(selected.id, { status: 'In progress', assignedTo: user.name })}>Assign to me</button><button type="button" disabled={!reply.trim()} onClick={async () => { await onUpdateInquiry(selected.id, { status: 'In progress', assignedTo: selected.assignedTo || user.name, reply }); setReply(''); }}>Send reply</button><button type="button" disabled={!reply.trim() && !(selected.messages || []).length} onClick={async () => { await onUpdateInquiry(selected.id, { status: 'Resolved', assignedTo: selected.assignedTo || user.name, reply }); setReply(''); }}>Reply & resolve</button></div></section> : <section className="emptyState"><h3>No inquiry selected</h3></section>}</div>
      <section className="panelBlock">
        <div className="sectionHead"><span className="eyebrow">Recent document uploads</span><h2>Quick review snapshot</h2></div>
        <div className="compactList">{documentReviews.slice(0, 4).map((record) => <div key={record.id}><strong>{record.ownerName}</strong><span>{record.docName} - {record.status}</span></div>)}</div>
      </section>
    </div>
  );
}

function ContentManager({ contentItems, onCreate, onUpdate }) {
  const [form, setForm] = useState({ title: '', category: 'Admissions', status: 'Review' });
  const [editingId, setEditingId] = useState('');
  const update = (key, value) => setForm((item) => ({ ...item, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    if (editingId) await onUpdate(editingId, form);
    else await onCreate(form);
    setEditingId('');
    setForm({ title: '', category: 'Admissions', status: 'Review' });
  };
  const edit = (item) => {
    setEditingId(item.id);
    setForm({ title: item.title, category: item.category, status: item.status });
  };
  return (
    <div className="pageStack">
      <div className="sectionHead"><span className="eyebrow">Verified content</span><h2>Admission knowledge controls</h2><p>Create or update verified admission topics that the assistant can use later through backend/RAG integration.</p></div>
      <section className="formBlock">
        <form onSubmit={submit}>
          <label className="wide">Title<input value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Example: CAP reporting document checklist" /></label>
          <label>Category<select value={form.category} onChange={(event) => update('category', event.target.value)}><option>Admissions</option><option>Courses</option><option>Fees</option><option>Scholarship</option><option>Facilities</option><option>Placement</option></select></label>
          <label>Status<select value={form.status} onChange={(event) => update('status', event.target.value)}><option>Review</option><option>Published</option><option>Archived</option></select></label>
          <button type="submit">{editingId ? 'Update content' : 'Add content'} <ArrowRight size={16} /></button>
        </form>
      </section>
      <div className="contentGrid">{contentItems.map((item) => <article key={item.id || item.title}><BookOpen size={20} /><div><span>{item.category}</span><h3>{item.title}</h3></div><strong>{item.status}</strong><button className="miniEditBtn" type="button" onClick={() => edit(item)}>Edit</button></article>)}</div>
    </div>
  );
}

function KnowledgeManager({ items, sources, onCreate, onUploadSource, onOpenSource, onReviewSource, onPublishSource }) {
  const [form, setForm] = useState({ title: '', category: 'Admissions', source: 'Admin verified source', text: '', status: 'Published' });
  const [sourceForm, setSourceForm] = useState({ title: '', documentType: 'Eligibility', academicYear: '2026-27', sourceAuthority: 'MITCORER / Maharashtra CET Cell', verifiedText: '' });
  const [sourceFile, setSourceFile] = useState(null);
  const [review, setReview] = useState(null);
  const update = (key, value) => setForm((item) => ({ ...item, [key]: value }));
  const updateSource = (key, value) => setSourceForm((item) => ({ ...item, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.text.trim()) return;
    await onCreate(form);
    setForm({ title: '', category: 'Admissions', source: 'Admin verified source', text: '', status: 'Published' });
  };
  const submitSource = async (event) => {
    event.preventDefault();
    if (!sourceFile || !sourceForm.title.trim()) return;
    const saved = await onUploadSource(sourceForm, sourceFile);
    if (saved) {
      setSourceForm({ title: '', documentType: 'Eligibility', academicYear: '2026-27', sourceAuthority: 'MITCORER / Maharashtra CET Cell', verifiedText: '' });
      setSourceFile(null);
      event.currentTarget.reset();
    }
  };
  const openReview = async (source) => {
    const result = await onReviewSource(source.id);
    if (result) setReview({ id: source.id, title: source.title, text: result.extractedText || '', status: result.extractionStatus });
  };
  const publishReview = async (event) => {
    event.preventDefault();
    if (!review?.text.trim()) return;
    const saved = await onPublishSource(review.id, review.text);
    if (saved) setReview(null);
  };
  return (
    <div className="pageStack">
      <div className="sectionHead"><span className="eyebrow">Official source library</span><h2>Documents and verified knowledge used by CampusGuard</h2><p>Upload institutional sources here. Personal applicant documents remain in the separate document-review workflow.</p></div>
      <section className="formBlock">
        <form onSubmit={submitSource}>
          <label>Document title<input value={sourceForm.title} onChange={(event) => updateSource('title', event.target.value)} placeholder="Example: CAP Round I cutoff 2025" /></label>
          <label>Document type<select value={sourceForm.documentType} onChange={(event) => updateSource('documentType', event.target.value)}><option>Eligibility</option><option>Cutoff</option><option>Seat Matrix</option><option>Admissions</option><option>Fees</option><option>Scholarship</option><option>Programs</option><option>Facilities</option><option>Placement</option><option>Calendar</option></select></label>
          <label>Academic year<input value={sourceForm.academicYear} onChange={(event) => updateSource('academicYear', event.target.value)} placeholder="2026-27" /></label>
          <label>Source authority<input value={sourceForm.sourceAuthority} onChange={(event) => updateSource('sourceAuthority', event.target.value)} placeholder="MITCORER or Maharashtra CET Cell" /></label>
          <label className="wide">Official file<input type="file" accept=".pdf,.docx,.xlsx,.csv,.txt,image/png,image/jpeg" onChange={(event) => setSourceFile(event.target.files?.[0] || null)} /></label>
          <label className="wide">Verified extracted text (optional)<textarea rows={4} value={sourceForm.verifiedText} onChange={(event) => updateSource('verifiedText', event.target.value)} placeholder="Paste the reviewed eligibility rule, cutoff row, seat matrix, fee notice, or policy text. Leaving this empty stores the source for later extraction and review." /></label>
          <button type="submit" disabled={!sourceFile || !sourceForm.title.trim()}><UploadCloud size={17} /> Upload official source</button>
        </form>
      </section>
      <div className="tableWrap sourceTable">
        <table>
          <thead><tr><th>Source</th><th>Type</th><th>Academic year</th><th>Authority</th><th>Extraction</th><th>Status</th><th>File</th></tr></thead>
          <tbody>{sources.map((item) => <tr key={item.id}><td><strong>{item.title}</strong><br /><span>{item.originalFileName}</span></td><td>{item.documentType}</td><td>{item.academicYear}</td><td>{item.sourceAuthority}</td><td>{item.extractionStatus}</td><td>{item.status}</td><td>{item.storedFileName ? <button className="miniEditBtn" type="button" onClick={() => onOpenSource(item.id)}>Open file</button> : item.sourceUrl ? <a className="miniEditBtn sourceReference" href={item.sourceUrl} target="_blank" rel="noreferrer">Open source</a> : 'Reference only'} {item.status !== 'Published' && <button className="miniEditBtn" type="button" onClick={() => openReview(item)}>Review text</button>}</td></tr>)}</tbody>
        </table>
      </div>
      {review && <section className="formBlock"><div className="sectionHead"><span className="eyebrow">Source review</span><h2>{review.title}</h2><p>{review.status}</p></div><form onSubmit={publishReview}><label className="wide">Verified text for retrieval<textarea rows={9} value={review.text} onChange={(event) => setReview((item) => ({ ...item, text: event.target.value }))} placeholder="No text was extracted. Paste the reviewed official text before publishing." /></label><button type="submit" disabled={!review.text.trim()}><CheckCircle2 size={17} /> Publish verified knowledge</button><button className="miniEditBtn" type="button" onClick={() => setReview(null)}>Cancel</button></form></section>}
      <div className="sectionHead"><span className="eyebrow">Knowledge records</span><h2>Reviewed text available to retrieval</h2></div>
      <section className="formBlock">
        <form onSubmit={submit}>
          <label>Title<input value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Example: CAP 2026 reporting rules" /></label>
          <label>Category<select value={form.category} onChange={(event) => update('category', event.target.value)}><option>Admissions</option><option>Eligibility</option><option>Cutoff</option><option>Seat Matrix</option><option>Documents</option><option>Fees</option><option>Scholarship</option><option>Facilities</option><option>Programs</option><option>Placement</option></select></label>
          <label className="wide">Source<input value={form.source} onChange={(event) => update('source', event.target.value)} placeholder="Official brochure / website / notice" /></label>
          <label>Status<select value={form.status} onChange={(event) => update('status', event.target.value)}><option>Published</option><option>Review</option><option>Archived</option></select></label>
          <label className="wide">Verified text<textarea rows={5} value={form.text} onChange={(event) => update('text', event.target.value)} placeholder="Paste concise verified admission information..." /></label>
          <button type="submit">Add knowledge record <ArrowRight size={16} /></button>
        </form>
      </section>
      <div className="knowledgeGrid">{items.map((item) => <article key={item.id}><span className="eyebrow">{item.category}</span><h3>{item.title}</h3><p>{item.text}</p><footer>{item.source} · {item.status}</footer></article>)}</div>
    </div>
  );
}

function AuditLogs({ items }) {
  return (
    <div className="pageStack">
      <div className="sectionHead"><span className="eyebrow">Audit logs</span><h2>Trace important admission actions</h2><p>Authentication, inquiry, document, content, and assistant events are recorded for staff/admin accountability.</p></div>
      <div className="tableWrap">
        <table>
          <thead><tr><th>Time</th><th>Actor</th><th>Role</th><th>Action</th><th>Resource</th><th>Details</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.actorEmail}</td><td>{item.actorRole}</td><td>{item.action}</td><td>{item.resourceType}<br />{item.resourceId}</td><td>{item.details}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function Reports({ inquiries, documentReviews, reports }) {
  const topicCounts = inquiries.reduce((items, item) => ({ ...items, [item.topic]: (items[item.topic] || 0) + 1 }), {});
  const topTopic = reports?.topTopic || Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No data';
  const openInquiries = reports?.openInquiries ?? inquiries.filter((item) => item.status !== 'Resolved').length;
  const unresolved = reports?.unresolved ?? inquiries.filter((item) => ['Unassigned', 'Needs reply'].includes(item.status)).length;
  const readyDocs = reports?.readyDocuments ?? documentReviews.filter((item) => item.status === 'Ready for reporting').length;
  const readinessPercent = reports?.documentReadinessPercent ?? (documentReviews.length ? Math.round((readyDocs / documentReviews.length) * 100) : 0);
  return (
    <div className="pageStack">
      <div className="sectionHead"><span className="eyebrow">Operational reports</span><h2>Admission support dashboard</h2><p>Use these numbers to explain how CampusGuard reduces repeated calls, missing document confusion, and staff follow-up gaps.</p></div>
      <div className="reportGrid">{[['Top topic', topTopic], ['Open inquiries', openInquiries], ['Document reviews', documentReviews.length], ['Unresolved', unresolved]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <section className="panelBlock">
        <div className="sectionHead"><span className="eyebrow">Document readiness</span><h2>{readyDocs}/{documentReviews.length || 1} uploaded records ready</h2></div>
        <div className="progressBar"><span style={{ width: `${readinessPercent}%` }} /></div>
      </section>
    </div>
  );
}

export default App;
