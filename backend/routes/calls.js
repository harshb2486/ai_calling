import express from 'express';
import {
  getCandidateById,
  updateCandidate,
  appendCandidateTranscript,
  appendCandidateNote,
  claimNextLead,
  markLeadCallResult
} from '../data/store.js';
import asteriskService from '../services/asteriskService.js';
import {
  ACTIONS,
  STAGES,
  buildOpeningSpeech,
  processConversationTurn,
  normalizeLeadUpdate
} from '../services/conversationEngine.js';

const router = express.Router();

function formatAgentResponse({ speech = '', intent = '', stage = STAGES.GREETING, lead, action = ACTIONS.CONTINUE }) {
  return {
    speech,
    intent,
    stage,
    lead_update: normalizeLeadUpdate(lead || {}),
    action
  };
}

function mapTelephonyEventToOutcome(eventValue = '') {
  const event = String(eventValue).toLowerCase();
  if (event.includes('noanswer') || event.includes('no_answer') || event.includes('no-answer')) return 'no_answer';
  if (event.includes('busy')) return 'busy';
  if (event.includes('failed') || event.includes('drop')) return 'call_dropped';
  if (event.includes('wrong') || event.includes('invalid')) return 'invalid';
  if (event.includes('answered') || event.includes('connect')) return 'connected';
  if (event.includes('completed') || event.includes('hangup')) return 'completed';
  return '';
}

router.post('/queue/next', (req, res) => {
  try {
    const lead = claimNextLead();
    if (!lead) {
      return res.json({
        lead: null,
        response: {
          speech: '',
          intent: 'queue_empty',
          stage: STAGES.CLOSING,
          lead_update: {},
          action: ACTIONS.END
        }
      });
    }

    const speech = buildOpeningSpeech(lead, lead.language || 'en');
    appendCandidateTranscript(lead.id, { speaker: 'AI', text: speech });
    updateCandidate(lead.id, {
      status: 'connected',
      conversationStage: STAGES.INTENT_DETECTION,
      lastIntent: 'opening',
      lastAction: ACTIONS.CONTINUE
    });
    appendCandidateNote(lead.id, 'Lead dequeued and outbound greeting delivered.');

    const updatedLead = getCandidateById(lead.id);
    res.json({
      lead: updatedLead,
      response: formatAgentResponse({
        speech,
        intent: 'opening',
        stage: STAGES.INTENT_DETECTION,
        lead: updatedLead,
        action: ACTIONS.CONTINUE
      })
    });
  } catch (err) {
    console.error('Error claiming next lead:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/start/:id', async (req, res) => {
  try {
    const lead = getCandidateById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const speech = buildOpeningSpeech(lead, lead.language || 'en');

    appendCandidateTranscript(req.params.id, { speaker: 'AI', text: speech });
    updateCandidate(req.params.id, {
      status: 'connected',
      conversationStage: STAGES.INTENT_DETECTION,
      lastIntent: 'opening',
      lastAction: ACTIONS.CONTINUE
    });
    appendCandidateNote(req.params.id, 'Call started and greeting delivered.');

    try {
      const callResult = await asteriskService.initiateCall(lead.id, lead);
      
      asteriskService.activeCalls.set(lead.id.toString(), {
        channel: callResult.channel,
        candidateId: lead.id,
        startTime: new Date()
      });

      const updatedLead = getCandidateById(req.params.id);
      res.json({ 
        message: 'Call initiated', 
        candidate: updatedLead,
        response: formatAgentResponse({
          speech,
          intent: 'opening',
          stage: STAGES.INTENT_DETECTION,
          lead: updatedLead,
          action: ACTIONS.CONTINUE
        })
      });
    } catch (callErr) {
      console.error('Asterisk call error:', callErr.message);
      markLeadCallResult(req.params.id, 'call_dropped', {
        notes: `Call initiation failed: ${callErr.message}`
      });
      const updatedLead = getCandidateById(req.params.id);
      res.json({ 
        message: 'Call initiated (Asterisk not connected - demo mode)', 
        candidate: updatedLead,
        response: formatAgentResponse({
          speech,
          intent: 'opening',
          stage: STAGES.INTENT_DETECTION,
          lead: updatedLead,
          action: ACTIONS.CONTINUE
        })
      });
    }
  } catch (err) {
    console.error('Error starting call:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/turn/:id', (req, res) => {
  try {
    const lead = getCandidateById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const {
      userText = '',
      event = '',
      callbackAt = null,
      direction = 'outbound',
      stage
    } = req.body || {};

    if (userText) {
      appendCandidateTranscript(req.params.id, { speaker: 'Lead', text: userText });
    }

    const latestLead = getCandidateById(req.params.id);
    const result = processConversationTurn({
      lead: latestLead,
      userText,
      event,
      callbackAt,
      direction,
      currentStage: stage || latestLead.conversationStage
    });

    updateCandidate(req.params.id, result.leadPatch);
    if (result.note) {
      appendCandidateNote(req.params.id, result.note);
    }
    if (result.speech) {
      appendCandidateTranscript(req.params.id, { speaker: 'AI', text: result.speech });
    }

    const updatedLead = getCandidateById(req.params.id);
    res.json(
      formatAgentResponse({
        speech: result.speech,
        intent: result.intent,
        stage: result.stage,
        lead: updatedLead,
        action: result.action
      })
    );
  } catch (err) {
    console.error('Error processing conversation turn:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/end/:id', async (req, res) => {
  try {
    const lead = getCandidateById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const callData = asteriskService.activeCalls.get(lead.id.toString());
    if (callData && callData.channel) {
      await asteriskService.hangupCall(callData.channel);
    }

    let evaluation = { score: lead.score ?? null, feedback: 'Call completed' };
    if (lead.questions) {
      evaluation = await asteriskService.evaluateCandidate(
        lead.transcript || [],
        lead.questions
      );
    }

    const endStatus = ['interested', 'not_interested', 'callback', 'invalid'].includes(lead.status)
      ? lead.status
      : 'completed';

    updateCandidate(req.params.id, {
      status: endStatus,
      conversationStage: STAGES.CLOSING,
      lastAction: ACTIONS.END,
      score: evaluation.score
    });
    appendCandidateNote(req.params.id, `Call ended with status: ${endStatus}.`);

    asteriskService.activeCalls.delete(lead.id.toString());

    const updatedLead = getCandidateById(req.params.id);

    res.json({ 
      message: 'Call ended', 
      candidate: updatedLead,
      evaluation,
      response: formatAgentResponse({
        speech: "Thanks for your time, we'll follow up shortly.",
        intent: 'call_end',
        stage: STAGES.CLOSING,
        lead: updatedLead,
        action: ACTIONS.END
      })
    });
  } catch (err) {
    console.error('Error ending call:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/status/:id', async (req, res) => {
  try {
    const lead = getCandidateById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const { Event, outcome, callbackAt, notes } = req.body || {};
    const detectedOutcome = outcome || mapTelephonyEventToOutcome(Event);

    if (detectedOutcome) {
      markLeadCallResult(req.params.id, detectedOutcome, {
        callbackAt,
        notes: notes || `Telephony event received: ${detectedOutcome}`
      });
    }

    if (String(Event || '').toLowerCase() === 'hangup') {
      asteriskService.activeCalls.delete(req.params.id.toString());
    }

    const updatedLead = getCandidateById(req.params.id);
    const action = ['busy', 'no_answer', 'call_dropped'].includes(detectedOutcome)
      ? ACTIONS.RETRY
      : detectedOutcome === 'callback'
        ? ACTIONS.CALLBACK
        : ACTIONS.CONTINUE;

    res.json({
      ok: true,
      event: Event || detectedOutcome || 'unknown',
      response: formatAgentResponse({
        speech: '',
        intent: detectedOutcome || 'status_update',
        stage: updatedLead?.conversationStage || STAGES.INTENT_DETECTION,
        lead: updatedLead,
        action
      })
    });
  } catch (err) {
    console.error('Error in status callback:', err);
    res.status(500).json({ error: err.message });
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
