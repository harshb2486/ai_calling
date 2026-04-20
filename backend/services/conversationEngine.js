const STAGES = {
  GREETING: 'greeting',
  INTENT_DETECTION: 'intent_detection',
  QUALIFICATION: 'qualification',
  OBJECTION_HANDLING: 'objection_handling',
  CLOSING: 'closing'
};

const ACTIONS = {
  CONTINUE: 'continue',
  CALLBACK: 'callback',
  RETRY: 'retry',
  END: 'end'
};

function cleanText(text = '') {
  return String(text).trim();
}

function normalizeText(text = '') {
  return cleanText(text).toLowerCase();
}

function isHindiPreferred(text = '') {
  const value = normalizeText(text);
  return /[\u0900-\u097F]/.test(text)
    || /\b(haan|han|nahi|nahin|thik|theek|baad|kal|aaj|shaam|subah|hindi|hinglish)\b/.test(value);
}

function chooseLanguage(lead, userText) {
  if (lead?.language === 'hinglish') return 'hinglish';
  if (isHindiPreferred(userText)) return 'hinglish';
  return 'en';
}

function say(language, englishText, hinglishText) {
  return language === 'hinglish' ? hinglishText : englishText;
}

function deriveContext(lead = {}) {
  return lead.interest
    || lead.questions
    || lead.customFields?.context
    || lead.company
    || 'the details you shared earlier';
}

function buildOpeningSpeech(lead = {}, language = 'en') {
  const name = lead.name ? ` ${lead.name}` : '';
  const context = deriveContext(lead);
  return say(
    language,
    `Hi${name}, I'm calling regarding ${context}. Is this a good time to talk?`,
    `Hi${name}, main ${context} ke regarding call kar raha hoon. Kya abhi baat karna convenient hai?`
  );
}

function detectIntent({ userText = '', event = '' }) {
  const eventValue = normalizeText(event);
  if (eventValue === 'no_answer') return 'no_answer';
  if (eventValue === 'busy') return 'busy';
  if (eventValue === 'call_dropped') return 'call_dropped';
  if (eventValue === 'wrong_number' || eventValue === 'invalid') return 'wrong_number';

  const text = normalizeText(userText);
  if (!text) return 'silence';

  if (/\b(hello|hi|hey|good morning|good afternoon|good evening|namaste|namaskar)\b/.test(text)) return 'greeting';
  if (/\b(thanks|thank you|shukriya|dhanyavad|dhanyavaad)\b/.test(text)) return 'gratitude';
  if (/\b(help|support|issue|problem|query|question|madad|sahayata)\b/.test(text)) return 'help_request';
  if (/\b(repeat|come again|didn't get|did not get|samjha nahi|samjha nahin|samajh nahi|samajh nahin)\b/.test(text)) return 'confusion';
  if (/\b(wrong number|galat number|not .*person|koi aur)\b/.test(text)) return 'wrong_number';
  if (/\b(callback|call back|call me|later|later please|not now|can't talk|cant talk|tomorrow|tmrw|baad me|baad mein|phir call|kal call|kal baat)\b/.test(text)) return 'callback_request';
  if (/\b(not interested|no interest|nahi chahiye|mat call|don't call|do not call)\b/.test(text)) return 'not_interested';
  if (/\b(busy|in meeting|driving|abhi nahi|abhi nahin|free nahi|free nahin)\b/.test(text)) return 'busy';
  if (/\b(yes|yeah|yep|sure|interested|interest|inquiry|enquiry|job opening|opportunity|application|apply|looking for|regarding|about|haan|han|bilkul|okay|ok)\b/.test(text)) return 'interested';
  if (/\b(how|why|charges|spam|who are you|kaun|kis liye|details)\b/.test(text)) return 'objection';
  if (/\b(no|nahin|nahi)\b/.test(text)) return 'decline_now';

  return 'general_response';
}

function extractEmail(userText = '') {
  const match = cleanText(userText).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : '';
}

function normalizeLeadUpdate(lead = {}, patch = {}) {
  const merged = { ...lead, ...patch };
  return {
    name: merged.name || '',
    phone: merged.phone || '',
    email: merged.email || '',
    interest: merged.interest || '',
    status: merged.status || 'pending',
    notes: merged.notes || '',
    callbackAt: merged.callbackAt || null,
    retryCount: merged.retryCount || 0,
    stage: merged.conversationStage || STAGES.GREETING
  };
}

function edgeCaseResponse({ lead, intent, language, callbackAt }) {
  switch (intent) {
    case 'no_answer':
      return {
        speech: '',
        stage: STAGES.CLOSING,
        action: ACTIONS.RETRY,
        leadPatch: {
          status: 'retry',
          lastIntent: intent,
          lastAction: ACTIONS.RETRY,
          conversationStage: STAGES.CLOSING,
          retryCount: (lead.retryCount || 0) + 1
        },
        note: 'No answer from lead; moved to retry queue.'
      };
    case 'busy':
      return {
        speech: say(
          language,
          "No worries, I'll connect again at a better time.",
          'Koi baat nahi, main aapko better time par phir call kar lunga.'
        ),
        stage: STAGES.CLOSING,
        action: ACTIONS.RETRY,
        leadPatch: {
          status: 'retry',
          lastIntent: intent,
          lastAction: ACTIONS.RETRY,
          conversationStage: STAGES.CLOSING,
          retryCount: (lead.retryCount || 0) + 1
        },
        note: 'Lead was busy; marked for retry.'
      };
    case 'call_dropped':
      return {
        speech: '',
        stage: STAGES.CLOSING,
        action: ACTIONS.RETRY,
        leadPatch: {
          status: 'retry',
          lastIntent: intent,
          lastAction: ACTIONS.RETRY,
          conversationStage: STAGES.CLOSING,
          retryCount: (lead.retryCount || 0) + 1
        },
        note: 'Call dropped; scheduled retry.'
      };
    case 'wrong_number':
      return {
        speech: say(
          language,
          "Thanks for letting me know. I'll update my records.",
          'Batane ke liye thanks, main records update kar deta hoon.'
        ),
        stage: STAGES.CLOSING,
        action: ACTIONS.END,
        leadPatch: {
          status: 'invalid',
          lastIntent: intent,
          lastAction: ACTIONS.END,
          conversationStage: STAGES.CLOSING
        },
        note: 'Wrong number reported; marked invalid.'
      };
    case 'callback_request':
      return {
        speech: callbackAt
          ? say(
            language,
            `Perfect, I'll call you at ${callbackAt}.`,
            `Perfect, main aapko ${callbackAt} par call karunga.`
          )
          : say(
            language,
            'Sure, what time works best for a callback today?',
            'Sure, callback ke liye aaj kaunsa time best rahega?'
          ),
        stage: STAGES.CLOSING,
        action: ACTIONS.CALLBACK,
        leadPatch: {
          status: 'callback',
          callbackAt: callbackAt || lead.callbackAt || null,
          lastIntent: intent,
          lastAction: ACTIONS.CALLBACK,
          conversationStage: STAGES.CLOSING
        },
        note: callbackAt ? `Callback scheduled for ${callbackAt}.` : 'Lead requested callback time.'
      };
    default:
      return null;
  }
}

function processConversationTurn({
  lead,
  userText = '',
  event = '',
  currentStage,
  callbackAt,
  direction = 'outbound'
}) {
  const stage = currentStage || lead.conversationStage || STAGES.GREETING;
  const language = chooseLanguage(lead, userText);
  const intent = detectIntent({ userText, event });
  const emailFromText = extractEmail(userText);

  if (direction === 'inbound' && stage === STAGES.GREETING && !cleanText(userText)) {
    return {
      speech: say(
        language,
        'Hi, thanks for calling. How can I help you today?',
        'Hi, call karne ke liye thanks. Aaj main aapki kaise help kar sakta hoon?'
      ),
      intent: 'inbound_greeting',
      stage: STAGES.INTENT_DETECTION,
      action: ACTIONS.CONTINUE,
      leadPatch: {
        status: 'connected',
        language,
        conversationStage: STAGES.INTENT_DETECTION,
        lastIntent: 'inbound_greeting',
        lastAction: ACTIONS.CONTINUE
      },
      note: 'Inbound greeting delivered.'
    };
  }

  const edgeResponse = edgeCaseResponse({ lead, intent, language, callbackAt });
  if (edgeResponse) {
    return {
      speech: edgeResponse.speech,
      intent,
      stage: edgeResponse.stage,
      action: edgeResponse.action,
      leadPatch: {
        ...edgeResponse.leadPatch,
        language
      },
      note: edgeResponse.note
    };
  }

  if (!cleanText(userText) && stage === STAGES.GREETING && direction === 'outbound') {
    return {
      speech: buildOpeningSpeech(lead, language),
      intent: 'opening',
      stage: STAGES.INTENT_DETECTION,
      action: ACTIONS.CONTINUE,
      leadPatch: {
        status: 'connected',
        language,
        conversationStage: STAGES.INTENT_DETECTION,
        lastIntent: 'opening',
        lastAction: ACTIONS.CONTINUE
      },
      note: 'Outbound greeting delivered.'
    };
  }

  if (stage === STAGES.GREETING || stage === STAGES.INTENT_DETECTION) {
    if (intent === 'greeting') {
      return {
        speech: say(
          language,
          'Hi, glad we connected. Is this a good time for a quick call?',
          'Hi, connect karne ke liye thanks. Kya abhi quick call ke liye sahi time hai?'
        ),
        intent,
        stage: STAGES.INTENT_DETECTION,
        action: ACTIONS.CONTINUE,
        leadPatch: {
          status: 'connected',
          language,
          conversationStage: STAGES.INTENT_DETECTION,
          lastIntent: intent,
          lastAction: ACTIONS.CONTINUE
        },
        note: 'Greeting acknowledged and availability reconfirmed.'
      };
    }

    if (intent === 'help_request') {
      return {
        speech: say(
          language,
          'Sure, I can help. Are you currently exploring this opportunity?',
          'Bilkul, main help karta hoon. Kya aap abhi is opportunity ko explore kar rahe hain?'
        ),
        intent,
        stage: STAGES.QUALIFICATION,
        action: ACTIONS.CONTINUE,
        leadPatch: {
          status: 'connected',
          language,
          conversationStage: STAGES.QUALIFICATION,
          lastIntent: intent,
          lastAction: ACTIONS.CONTINUE
        },
        note: 'Help request detected and routed to qualification.'
      };
    }

    if (intent === 'confusion') {
      return {
        speech: say(
          language,
          'Sure, I will keep it brief. Should I continue for one minute?',
          'Sure, main short rakhta hoon. Kya main ek minute ke liye continue karun?'
        ),
        intent,
        stage: STAGES.INTENT_DETECTION,
        action: ACTIONS.CONTINUE,
        leadPatch: {
          status: 'connected',
          language,
          conversationStage: STAGES.INTENT_DETECTION,
          lastIntent: intent,
          lastAction: ACTIONS.CONTINUE
        },
        note: 'Lead asked for clarification.'
      };
    }

    if (intent === 'interested') {
      return {
        speech: say(
          language,
          'Great, are you actively looking for this opportunity right now?',
          'Great, kya aap abhi actively is opportunity ko explore kar rahe hain?'
        ),
        intent,
        stage: STAGES.QUALIFICATION,
        action: ACTIONS.CONTINUE,
        leadPatch: {
          status: 'connected',
          language,
          conversationStage: STAGES.QUALIFICATION,
          lastIntent: intent,
          lastAction: ACTIONS.CONTINUE
        },
        note: 'Lead accepted conversation and moved to qualification.'
      };
    }

    if (intent === 'gratitude') {
      return {
        speech: say(
          language,
          'Happy to help. Is this a good time for one quick question?',
          'Khushi hui help karke. Kya ek quick question ke liye abhi sahi time hai?'
        ),
        intent,
        stage: STAGES.INTENT_DETECTION,
        action: ACTIONS.CONTINUE,
        leadPatch: {
          status: 'connected',
          language,
          conversationStage: STAGES.INTENT_DETECTION,
          lastIntent: intent,
          lastAction: ACTIONS.CONTINUE
        },
        note: 'Gratitude acknowledged.'
      };
    }

    if (intent === 'decline_now') {
      return {
        speech: say(
          language,
          'No worries, what time should I call you back?',
          'Koi baat nahi, aapko kis time callback karun?'
        ),
        intent,
        stage: STAGES.CLOSING,
        action: ACTIONS.CALLBACK,
        leadPatch: {
          status: 'callback',
          language,
          conversationStage: STAGES.CLOSING,
          lastIntent: intent,
          lastAction: ACTIONS.CALLBACK
        },
        note: 'Lead not available right now; callback requested.'
      };
    }

    if (intent === 'not_interested') {
      return {
        speech: say(
          language,
          'Understood, thanks for your time. Have a great day.',
          'Samajh gaya, aapke time ke liye shukriya. Have a great day.'
        ),
        intent,
        stage: STAGES.CLOSING,
        action: ACTIONS.END,
        leadPatch: {
          status: 'not_interested',
          language,
          conversationStage: STAGES.CLOSING,
          lastIntent: intent,
          lastAction: ACTIONS.END
        },
        note: 'Lead marked as not interested.'
      };
    }

    if (intent === 'objection') {
      return {
        speech: say(
          language,
          'I understand, this will only take a minute and is about your earlier request. Shall we continue?',
          'Samajh sakta hoon, yeh sirf ek minute lega aur aapki pehle wali request ke liye hai. Continue karein?'
        ),
        intent,
        stage: STAGES.OBJECTION_HANDLING,
        action: ACTIONS.CONTINUE,
        leadPatch: {
          status: 'connected',
          language,
          conversationStage: STAGES.OBJECTION_HANDLING,
          lastIntent: intent,
          lastAction: ACTIONS.CONTINUE
        },
        note: 'Objection detected and handled.'
      };
    }

    return {
      speech: say(
        language,
        direction === 'inbound'
          ? 'Got it. Could you share what you need help with in one line?'
          : 'Quick check, is now okay for a 1-minute conversation?',
        direction === 'inbound'
          ? 'Samajh gaya. Aap ek line mein batayenge kis cheez mein help chahiye?'
          : 'Quick check, kya abhi 1-minute ki conversation ke liye theek hai?'
      ),
      intent,
      stage: STAGES.INTENT_DETECTION,
      action: ACTIONS.CONTINUE,
      leadPatch: {
        status: 'connected',
        language,
        conversationStage: STAGES.INTENT_DETECTION,
        lastIntent: intent,
        lastAction: ACTIONS.CONTINUE
      },
      note: 'Intent not clear, asked availability again.'
    };
  }

  if (stage === STAGES.OBJECTION_HANDLING) {
    if (intent === 'interested') {
      return {
        speech: say(
          language,
          'Perfect, could you share your preferred work location?',
          'Perfect, aap apni preferred work location share karenge?'
        ),
        intent,
        stage: STAGES.QUALIFICATION,
        action: ACTIONS.CONTINUE,
        leadPatch: {
          status: 'connected',
          language,
          conversationStage: STAGES.QUALIFICATION,
          lastIntent: intent,
          lastAction: ACTIONS.CONTINUE
        },
        note: 'Objection resolved and moved to qualification.'
      };
    }

    if (intent === 'not_interested') {
      return {
        speech: say(
          language,
          'Understood, thanks for your time. I will close this out.',
          'Theek hai, time dene ke liye thanks. Main isko close kar deta hoon.'
        ),
        intent,
        stage: STAGES.CLOSING,
        action: ACTIONS.END,
        leadPatch: {
          status: 'not_interested',
          language,
          conversationStage: STAGES.CLOSING,
          lastIntent: intent,
          lastAction: ACTIONS.END
        },
        note: 'Lead declined after objection handling.'
      };
    }

    return {
      speech: say(
        language,
        'No problem, should I schedule a quick callback instead?',
        'Koi issue nahi, kya main quick callback schedule kar doon?'
      ),
      intent,
      stage: STAGES.OBJECTION_HANDLING,
      action: ACTIONS.CONTINUE,
      leadPatch: {
        status: 'connected',
        language,
        conversationStage: STAGES.OBJECTION_HANDLING,
        lastIntent: intent,
        lastAction: ACTIONS.CONTINUE
      },
      note: 'Objection follow-up prompt sent.'
    };
  }

  if (stage === STAGES.QUALIFICATION) {
    if (intent === 'gratitude') {
      return {
        speech: say(
          language,
          'You are welcome. Could you share your best email for follow-up?',
          'Aapka welcome hai. Follow-up ke liye aap apna best email share karenge?'
        ),
        intent,
        stage: STAGES.QUALIFICATION,
        action: ACTIONS.CONTINUE,
        leadPatch: {
          status: 'connected',
          language,
          conversationStage: STAGES.QUALIFICATION,
          lastIntent: intent,
          lastAction: ACTIONS.CONTINUE
        },
        note: 'Gratitude handled during qualification.'
      };
    }

    if (intent === 'not_interested') {
      return {
        speech: say(
          language,
          'Got it, thanks for letting me know. I will update your preference.',
          'Samajh gaya, batane ke liye thanks. Main aapki preference update kar deta hoon.'
        ),
        intent,
        stage: STAGES.CLOSING,
        action: ACTIONS.END,
        leadPatch: {
          status: 'not_interested',
          language,
          conversationStage: STAGES.CLOSING,
          lastIntent: intent,
          lastAction: ACTIONS.END
        },
        note: 'Lead marked not interested during qualification.'
      };
    }

    if (emailFromText) {
      return {
        speech: say(
          language,
          "Thanks, that's helpful. We'll follow up shortly.",
          'Thanks, yeh helpful hai. Hum aapse jaldi follow up karenge.'
        ),
        intent: 'email_provided',
        stage: STAGES.CLOSING,
        action: ACTIONS.END,
        leadPatch: {
          email: emailFromText,
          status: 'interested',
          language,
          conversationStage: STAGES.CLOSING,
          lastIntent: 'email_provided',
          lastAction: ACTIONS.END
        },
        note: `Captured email: ${emailFromText}`
      };
    }

    if (!lead.email) {
      return {
        speech: say(
          language,
          'Thanks, could I quickly confirm your best email for follow-up?',
          'Thanks, follow-up ke liye aapka best email confirm kar sakta hoon?'
        ),
        intent,
        stage: STAGES.QUALIFICATION,
        action: ACTIONS.CONTINUE,
        leadPatch: {
          status: 'connected',
          language,
          conversationStage: STAGES.QUALIFICATION,
          lastIntent: intent,
          lastAction: ACTIONS.CONTINUE
        },
        note: 'Requested email as part of qualification.'
      };
    }

    return {
      speech: say(
        language,
        "Great, thanks for confirming. We'll follow up shortly.",
        'Great, confirm karne ke liye thanks. Hum aapse jaldi follow up karenge.'
      ),
      intent,
      stage: STAGES.CLOSING,
      action: ACTIONS.END,
      leadPatch: {
        status: 'interested',
        language,
        conversationStage: STAGES.CLOSING,
        lastIntent: intent,
        lastAction: ACTIONS.END
      },
      note: 'Lead qualified and marked interested.'
    };
  }

  return {
    speech: say(
      language,
      "Thanks for your time. We'll follow up soon.",
      'Aapke time ke liye shukriya. Hum jaldi follow up karenge.'
    ),
    intent,
    stage: STAGES.CLOSING,
    action: ACTIONS.END,
    leadPatch: {
      status: lead.status || 'connected',
      language,
      conversationStage: STAGES.CLOSING,
      lastIntent: intent,
      lastAction: ACTIONS.END
    },
    note: 'Conversation closed.'
  };
}

export {
  STAGES,
  ACTIONS,
  buildOpeningSpeech,
  processConversationTurn,
  normalizeLeadUpdate
};
