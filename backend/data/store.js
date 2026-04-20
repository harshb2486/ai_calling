const seedCandidates = [
  { id: 1, name: 'Sarah Johnson', phone: '+1 555-0101', email: 'sarah.j@email.com', status: 'completed', score: 85, questions: 'Tell me about your experience with React.' },
  { id: 2, name: 'Michael Chen', phone: '+1 555-0102', email: 'mchen@email.com', status: 'pending', score: null, questions: 'What is your experience with TypeScript?' },
  { id: 3, name: 'Emily Davis', phone: '+1 555-0103', email: 'emily.d@email.com', status: 'pending', score: null, questions: 'Describe your frontend architecture knowledge.' },
  { id: 4, name: 'James Wilson', phone: '+1 555-0104', email: 'jwilson@email.com', status: 'completed', score: 72, questions: 'How do you handle state management?' },
];

function compactObject(data = {}) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function normalizeCandidate(data = {}, id) {
  const now = new Date().toISOString();
  const status = data.status || 'pending';

  return {
    id,
    name: data.name || '',
    phone: data.phone || '',
    email: data.email || '',
    company: data.company || '',
    interest: data.interest || data.questions || '',
    customFields: data.customFields || {},
    questions: data.questions || '',
    status,
    score: data.score ?? null,
    transcript: Array.isArray(data.transcript) ? data.transcript : [],
    callDuration: data.callDuration || 0,
    retryCount: data.retryCount || 0,
    callbackAt: data.callbackAt || null,
    notes: data.notes || '',
    conversationStage: data.conversationStage || (status === 'completed' ? 'closing' : 'greeting'),
    lastIntent: data.lastIntent || '',
    lastAction: data.lastAction || 'continue',
    language: data.language || 'en',
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
}

let candidates = seedCandidates.map((candidate) => normalizeCandidate(candidate, candidate.id));

let clients = [
  { id: 1, name: 'Acme Corp', contactPerson: 'John Doe', phone: '+1 555-1001', email: 'john.doe@acmecorp.com' },
  { id: 2, name: 'Globex Inc', contactPerson: 'Jane Smith', phone: '+1 555-1002', email: 'jane.smith@globex.com' },
];

let nextCandidateId = 5;
let nextClientId = 3;

export function getCandidates() {
  return candidates;
}

export function getCandidateById(id) {
  return candidates.find(c => c.id === parseInt(id));
}

export function createCandidate(data) {
  const candidate = normalizeCandidate(data, nextCandidateId++);
  candidates.push(candidate);
  return candidate;
}

export function updateCandidate(id, data) {
  const index = candidates.findIndex(c => c.id === parseInt(id));
  if (index === -1) return null;
  const patch = compactObject(data);
  candidates[index] = {
    ...candidates[index],
    ...patch,
    updatedAt: new Date().toISOString()
  };
  return candidates[index];
}

export function appendCandidateTranscript(id, message) {
  const candidate = getCandidateById(id);
  if (!candidate) return null;

  const transcriptEntry = {
    speaker: message.speaker || 'AI',
    text: message.text || '',
    timestamp: message.timestamp || new Date().toISOString()
  };

  return updateCandidate(id, {
    transcript: [...candidate.transcript, transcriptEntry]
  });
}

export function appendCandidateNote(id, note) {
  const candidate = getCandidateById(id);
  if (!candidate) return null;

  const noteLine = `[${new Date().toISOString()}] ${note}`;
  const combinedNotes = candidate.notes ? `${candidate.notes}\n${noteLine}` : noteLine;

  return updateCandidate(id, { notes: combinedNotes });
}

export function getQueuedLeads(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);

  return candidates
    .filter((lead) => {
      if (['pending', 'retry', 'busy', 'no_answer'].includes(lead.status)) return true;
      if (lead.status === 'callback') {
        return !lead.callbackAt || new Date(lead.callbackAt) <= current;
      }
      return false;
    })
    .sort((a, b) => {
      const aTime = a.callbackAt ? new Date(a.callbackAt).getTime() : new Date(a.createdAt).getTime();
      const bTime = b.callbackAt ? new Date(b.callbackAt).getTime() : new Date(b.createdAt).getTime();
      return aTime - bTime;
    });
}

export function claimNextLead() {
  const [nextLead] = getQueuedLeads();
  if (!nextLead) return null;

  return updateCandidate(nextLead.id, {
    status: 'connected',
    conversationStage: 'greeting',
    lastAction: 'continue'
  });
}

export function markLeadCallResult(id, outcome, meta = {}) {
  const lead = getCandidateById(id);
  if (!lead) return null;

  const normalizedOutcome = (outcome || '').toLowerCase();
  const patch = {};

  switch (normalizedOutcome) {
    case 'connected':
      patch.status = 'connected';
      break;
    case 'busy':
      patch.status = 'busy';
      patch.retryCount = (lead.retryCount || 0) + 1;
      break;
    case 'no_answer':
      patch.status = 'no_answer';
      patch.retryCount = (lead.retryCount || 0) + 1;
      break;
    case 'call_dropped':
      patch.status = 'retry';
      patch.retryCount = (lead.retryCount || 0) + 1;
      break;
    case 'callback':
      patch.status = 'callback';
      patch.callbackAt = meta.callbackAt || null;
      break;
    case 'wrong_number':
    case 'invalid':
      patch.status = 'invalid';
      break;
    case 'interested':
      patch.status = 'interested';
      break;
    case 'not_interested':
      patch.status = 'not_interested';
      break;
    case 'completed':
      patch.status = 'completed';
      break;
    default:
      break;
  }

  if (meta.notes) {
    const noteLine = `[${new Date().toISOString()}] ${meta.notes}`;
    patch.notes = lead.notes ? `${lead.notes}\n${noteLine}` : noteLine;
  }

  return updateCandidate(id, patch);
}

export function importLeads(leads = []) {
  if (!Array.isArray(leads)) return [];
  return leads.map((lead) => createCandidate(lead));
}

export function deleteCandidate(id) {
  const index = candidates.findIndex(c => c.id === parseInt(id));
  if (index === -1) return false;
  candidates.splice(index, 1);
  return true;
}

export function getClients() {
  return clients;
}

export function getClientById(id) {
  return clients.find(c => c.id === parseInt(id));
}

export function createClient(data) {
  const client = {
    id: nextClientId++,
    ...data,
  };
  clients.push(client);
  return client;
}

export function updateClient(id, data) {
  const index = clients.findIndex(c => c.id === parseInt(id));
  if (index === -1) return null;
  clients[index] = { ...clients[index], ...data };
  return clients[index];
}

export function deleteClient(id) {
  const index = clients.findIndex(c => c.id === parseInt(id));
  if (index === -1) return false;
  clients.splice(index, 1);
  return true;
}