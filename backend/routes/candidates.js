import express from 'express';
import {
  getCandidates,
  getCandidateById,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  importLeads
} from '../data/store.js';

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
    const {
      name,
      phone,
      email,
      company,
      interest,
      customFields,
      questions
    } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone is required' });
    }
    
    const candidate = createCandidate({
      name,
      phone,
      email,
      company,
      interest,
      customFields,
      questions
    });
    res.status(201).json(candidate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/import', (req, res) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads)) {
      return res.status(400).json({ error: 'leads must be an array' });
    }

    const imported = importLeads(leads);
    res.status(201).json({
      importedCount: imported.length,
      leads: imported
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      company,
      interest,
      customFields,
      questions,
      status,
      score,
      notes,
      callbackAt,
      retryCount,
      conversationStage,
      lastIntent,
      lastAction,
      language
    } = req.body;

    const candidate = updateCandidate(req.params.id, {
      name,
      phone,
      email,
      company,
      interest,
      customFields,
      questions,
      status,
      score,
      notes,
      callbackAt,
      retryCount,
      conversationStage,
      lastIntent,
      lastAction,
      language
    });

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
