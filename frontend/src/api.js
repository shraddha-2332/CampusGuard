const API_BASE_URL = import.meta.env.VITE_API_URL || '';

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || 'CampusGuard API request failed.';
    throw new Error(message);
  }
  return payload.data;
}

async function upload(path, { token, formData }) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || 'CampusGuard upload failed.';
    throw new Error(message);
  }
  return payload.data;
}

async function openProtectedFile(path, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include', headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message || 'The requested file is unavailable.');
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export const api = {
  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  signup: (body) => request('/api/auth/signup', { method: 'POST', body }),
  refresh: () => request('/api/auth/refresh', { method: 'POST' }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  getInquiries: (token) => request('/api/inquiries', { token }),
  getConversations: (token, offset = 0) => request(`/api/conversations?offset=${offset}`, { token }),
  getConversation: (token, id) => request(`/api/conversations/${encodeURIComponent(id)}`, { token }),
  askInConversation: (token, question, conversationId) => request('/api/conversations/ask', { token, method: 'POST', body: { question, conversationId } }),
  askAssistant: (token, question) => request('/api/assistant/ask', { token, method: 'POST', body: { question } }),
  getAssistantAttachments: (token) => request('/api/assistant/attachments', { token }),
  uploadAssistantAttachment: (token, note, file) => {
    const formData = new FormData();
    formData.append('note', note);
    formData.append('file', file);
    return upload('/api/assistant/attachments/upload', { token, formData });
  },
  openAssistantAttachment: (token, id) => openProtectedFile(`/api/assistant/attachments/${id}/file`, token),
  createInquiry: (token, body) => request('/api/inquiries', { token, method: 'POST', body }),
  updateInquiryStatus: (token, id, updates) => request(`/api/inquiries/${id}/status`, { token, method: 'PATCH', body: updates }),
  getAdmissionWorkspace: (token) => request('/api/admission-workspace', { token }),
  updateAdmissionWorkspace: (token, section, value) => request('/api/admission-workspace', { token, method: 'PATCH', body: { section, value } }),
  getDocuments: (token) => request('/api/documents', { token }),
  createDocument: (token, body) => request('/api/documents', { token, method: 'POST', body }),
  uploadDocument: (token, body, file) => {
    const formData = new FormData();
    Object.entries(body).forEach(([key, value]) => formData.append(key, value));
    formData.append('file', file);
    return upload('/api/documents/upload', { token, formData });
  },
  submitDocuments: (token) => request('/api/documents/submit', { token, method: 'POST' }),
  updateDocumentStatus: (token, id, status, reviewNote = '') => request(`/api/documents/${id}/status`, { token, method: 'PATCH', body: { status, reviewNote } }),
  deleteDocument: (token, id) => request(`/api/documents/${id}`, { token, method: 'DELETE' }),
  openDocument: (token, id) => openProtectedFile(`/api/documents/${id}/file`, token),
  getContent: (token) => request('/api/content', { token }),
  createContent: (token, body) => request('/api/content', { token, method: 'POST', body }),
  updateContent: (token, id, body) => request(`/api/content/${id}`, { token, method: 'PATCH', body }),
  getKnowledge: (token) => request('/api/knowledge', { token }),
  createKnowledge: (token, body) => request('/api/knowledge', { token, method: 'POST', body }),
  getOfficialSources: (token) => request('/api/official-sources', { token }),
  uploadOfficialSource: (token, body, file) => {
    const formData = new FormData();
    Object.entries(body).forEach(([key, value]) => formData.append(key, value));
    formData.append('file', file);
    return upload('/api/official-sources/upload', { token, formData });
  },
  getOfficialSourceExtractedText: (token, id) => request(`/api/official-sources/${id}/extracted-text`, { token }),
  publishOfficialSource: (token, id, verifiedText) => request(`/api/official-sources/${id}/publish`, { token, method: 'PATCH', body: { verifiedText } }),
  openOfficialSource: (token, id) => openProtectedFile(`/api/official-sources/${id}/file`, token),
  getReports: (token) => request('/api/reports', { token }),
  getAuditLogs: (token) => request('/api/audit-logs', { token }),
};
