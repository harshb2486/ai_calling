let candidates = [
  { id: 1, name: 'Sarah Johnson', phone: '+1 555-0101', email: 'sarah.j@email.com', status: 'completed', score: 85, questions: 'Tell me about your experience with React.' },
  { id: 2, name: 'Michael Chen', phone: '+1 555-0102', email: 'mchen@email.com', status: 'pending', score: null, questions: 'What is your experience with TypeScript?' },
  { id: 3, name: 'Emily Davis', phone: '+1 555-0103', email: 'emily.d@email.com', status: 'pending', score: null, questions: 'Describe your frontend architecture knowledge.' },
  { id: 4, name: 'James Wilson', phone: '+1 555-0104', email: 'jwilson@email.com', status: 'completed', score: 72, questions: 'How do you handle state management?' },
];

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
  const candidate = {
    id: nextCandidateId++,
    ...data,
    status: 'pending',
    score: null,
    transcript: [],
    callDuration: 0
  };
  candidates.push(candidate);
  return candidate;
}

export function updateCandidate(id, data) {
  const index = candidates.findIndex(c => c.id === parseInt(id));
  if (index === -1) return null;
  candidates[index] = { ...candidates[index], ...data };
  return candidates[index];
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