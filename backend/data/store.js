let candidates = [
  { id: 1, name: 'Sarah Johnson', phone: '+1 555-0101', email: 'sarah.j@email.com', status: 'completed', score: 85, questions: 'Tell me about your experience with React.' },
  { id: 2, name: 'Michael Chen', phone: '+1 555-0102', email: 'mchen@email.com', status: 'pending', score: null, questions: 'What is your experience with TypeScript?' },
  { id: 3, name: 'Emily Davis', phone: '+1 555-0103', email: 'emily.d@email.com', status: 'pending', score: null, questions: 'Describe your frontend architecture knowledge.' },
  { id: 4, name: 'James Wilson', phone: '+1 555-0104', email: 'jwilson@email.com', status: 'completed', score: 72, questions: 'How do you handle state management?' },
];

let nextId = 5;

export function getCandidates() {
  return candidates;
}

export function getCandidateById(id) {
  return candidates.find(c => c.id === parseInt(id));
}

export function createCandidate(data) {
  const candidate = {
    id: nextId++,
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
