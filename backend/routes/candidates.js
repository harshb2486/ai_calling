import express from 'express';
import { getCandidates, getCandidateById, createCandidate, updateCandidate, deleteCandidate } from '../data/store.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const candidates = getCandidates();
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const candidate = getCandidateById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    res.json(candidate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, phone, email, questions } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }
    
    const candidate = createCandidate({ name, phone, email, questions });
    res.status(201).json(candidate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, phone, email, questions, status, score } = req.body;
    const candidate = updateCandidate(req.params.id, { name, phone, email, questions, status, score });
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    res.json(candidate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const deleted = deleteCandidate(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    res.json({ message: 'Candidate deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
