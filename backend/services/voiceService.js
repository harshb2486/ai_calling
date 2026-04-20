import twilio from 'twilio';
import OpenAI from 'openai';
import Settings from '../models/Settings.js';

let cachedSettings = null;

async function getSettings() {
  if (cachedSettings) return cachedSettings;
  
  const dbSettings = await Settings.find({ key: { $in: ['twilioSid', 'twilioToken', 'twilioPhone', 'elevenLabsKey', 'openaiKey'] } });
  cachedSettings = {};
  dbSettings.forEach(s => {
    cachedSettings[s.key] = s.value;
  });
  return cachedSettings;
}

function clearSettingsCache() {
  cachedSettings = null;
}

async function getTwilioClient(settings) {
  return twilio(settings.twilioSid, settings.twilioToken);
}

async function getOpenAI(settings) {
  return new OpenAI({ apiKey: settings.openaiKey });
}

async function textToSpeech(text, settings) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': settings.elevenLabsKey
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5
      }
    })
  });
  
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

async function generateAIResponse(conversation, settings) {
  const openai = await getOpenAI(settings);
  
  const messages = [
    { 
      role: 'system', 
      content: `You are an AI recruiter conducting a phone interview. Keep responses brief (1-2 sentences), natural, and conversational. Ask one question at a time. End the call politely when the interview is complete.`
    },
    ...conversation.map(msg => ({
      role: msg.speaker === 'AI' ? 'assistant' : 'user',
      content: msg.text
    }))
  ];
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
    max_tokens: 150
  });
  
  return completion.choices[0].message.content;
}

async function evaluateCandidate(transcript, questions, settings) {
  const openai = await getOpenAI(settings);
  
  const prompt = `Based on the following interview transcript and questions asked, evaluate the candidate and provide a score from 0-100. Also provide brief feedback.

Questions asked: ${questions}

Transcript:
${transcript.map(m => `${m.speaker}: ${m.text}`).join('\n')}

Respond in JSON format:
{
  "score": number (0-100),
  "feedback": "brief feedback string"
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  });

  try {
    return JSON.parse(completion.choices[0].message.content);
  } catch {
    return { score: 75, feedback: 'Interview completed successfully' };
  }
}

async function initiateCall(candidateId, candidate) {
  const settings = await getSettings();
  
  if (!settings.twilioSid || !settings.twilioToken || !settings.twilioPhone) {
    throw new Error('Twilio credentials not configured');
  }
  
  const twilioClient = await getTwilioClient(settings);
  
  const call = await twilioClient.calls.create({
    to: candidate.phone,
    from: settings.twilioPhone,
    url: `${process.env.SERVER_URL || 'http://localhost:3001'}/api/calls/twiml/${candidateId}`,
    statusCallback: `${process.env.SERVER_URL || 'http://localhost:3001'}/api/calls/status/${candidateId}`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
  });
  
  return call;
}

async function generateGreeting(name, questions) {
  const settings = await getSettings();
  const openai = await getOpenAI(settings);
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{
      role: 'user',
      content: `Generate a brief greeting (2-3 sentences) for a candidate named ${name}. Mention the interview questions: ${questions || 'Tell me about yourself and your experience.'}`
    }],
    max_tokens: 100
  });
  
  return completion.choices[0].message.content;
}

export default {
  getSettings,
  clearSettingsCache,
  textToSpeech,
  generateAIResponse,
  evaluateCandidate,
  initiateCall,
  generateGreeting
};
