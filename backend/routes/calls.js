import express from 'express';
import { getCandidateById, updateCandidate } from '../data/store.js';
import asteriskService from '../services/asteriskService.js';

const router = express.Router();

router.post('/start/:id', async (req, res) => {
  try {
    const candidate = getCandidateById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const greeting = await asteriskService.generateGreeting(candidate.name, candidate.questions);

    updateCandidate(req.params.id, {
      status: 'in-progress',
      transcript: [{ speaker: 'AI', text: greeting, timestamp: new Date() }]
    });

    try {
      const callResult = await asteriskService.initiateCall(candidate.id, candidate);
      
      asteriskService.activeCalls.set(candidate.id.toString(), {
        channel: callResult.channel,
        candidateId: candidate.id,
        startTime: new Date(),
        transcript: candidate.transcript
      });

      res.json({ 
        message: 'Call initiated', 
        candidate: getCandidateById(req.params.id)
      });
    } catch (callErr) {
      console.error('Asterisk call error:', callErr.message);
      res.json({ 
        message: 'Call initiated (Asterisk not connected - demo mode)', 
        candidate: getCandidateById(req.params.id)
      });
    }
  } catch (err) {
    console.error('Error starting call:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/end/:id', async (req, res) => {
  try {
    const candidate = getCandidateById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const callData = asteriskService.activeCalls.get(candidate.id.toString());
    if (callData && callData.channel) {
      await asteriskService.hangupCall(callData.channel);
    }

    const evaluation = await asteriskService.evaluateCandidate(
      candidate.transcript || [],
      candidate.questions
    );

    updateCandidate(req.params.id, {
      status: 'completed',
      score: evaluation.score
    });

    asteriskService.activeCalls.delete(candidate.id.toString());

    res.json({ 
      message: 'Call ended', 
      candidate: getCandidateById(req.params.id),
      evaluation
    });
  } catch (err) {
    console.error('Error ending call:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/status/:id', async (req, res) => {
  try {
    const { Event, Channel, CallerIDNum } = req.body;
    const candidate = getCandidateById(req.params.id);
    
    if (candidate && Event === 'Hangup') {
      const evaluation = await asteriskService.evaluateCandidate(
        candidate.transcript || [],
        candidate.questions
      );
      updateCandidate(req.params.id, { status: 'completed', score: evaluation.score });
      asteriskService.activeCalls.delete(candidate.id.toString());
    }
    
    res.sendStatus(200);
  } catch (err) {
    console.error('Error in status callback:', err);
    res.sendStatus(500);
  }
});

router.get('/active/:id', (req, res) => {
  const callData = asteriskService.activeCalls.get(req.params.id);
  if (callData) {
    const candidate = getCandidateById(req.params.id);
    res.json({ 
      active: true, 
      channel: callData.channel,
      startTime: callData.startTime,
      transcript: candidate?.transcript || []
    });
  } else {
    res.json({ active: false });
  }
});

router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const onEvent = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  
  asteriskService.on('event', onEvent);
  
  req.on('close', () => {
    asteriskService.off('event', onEvent);
  });
});

export default router;
