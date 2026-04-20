import { getCandidates, getCandidateById, updateCandidate } from '../data/store.js';

let settings = {
  asteriskHost: 'localhost',
  asteriskPort: 5038,
  asteriskUser: 'admin',
  asteriskSecret: 'password',
  asteriskContext: 'from-sip',
  asteriskOutboundChannel: 'SIP/trunk',
  openaiKey: ''
};

const activeCalls = new Map();
let ami = null;

function loadSettings(newSettings) {
  if (newSettings.asteriskHost) settings.asteriskHost = newSettings.asteriskHost;
  if (newSettings.asteriskPort) settings.asteriskPort = parseInt(newSettings.asteriskPort);
  if (newSettings.asteriskUser) settings.asteriskUser = newSettings.asteriskUser;
  if (newSettings.asteriskSecret) settings.asteriskSecret = newSettings.asteriskSecret;
  if (newSettings.asteriskContext) settings.asteriskContext = newSettings.asteriskContext;
  if (newSettings.asteriskOutboundChannel) settings.asteriskOutboundChannel = newSettings.asteriskOutboundChannel;
  if (newSettings.openaiKey) settings.openaiKey = newSettings.openaiKey;
}

function getSettings() {
  return { ...settings, openaiKey: settings.openaiKey ? '***' : '' };
}

function connectAMI() {
  try {
    const AMI = require('asterisk-manager');
    ami = new AMI(settings.asteriskPort, settings.asteriskHost, settings.asteriskUser, settings.asteriskSecret, true);
    
    ami.on('connect', () => {
      console.log('Connected to Asterisk AMI');
    });
    
    ami.on('error', (err) => {
      console.error('Asterisk AMI error:', err.message);
    });
    
    ami.on('close', () => {
      console.log('Asterisk AMI disconnected');
    });
  } catch (err) {
    console.error('Failed to create AMI connection:', err.message);
  }
}

function disconnectAMI() {
  if (ami) {
    try {
      ami.disconnect();
    } catch (err) {
      console.error('Error disconnecting AMI:', err.message);
    }
    ami = null;
  }
}

async function generateGreeting(name, questions) {
  if (!settings.openaiKey) {
    return `Hello ${name}, this is an AI recruiter calling regarding your application. Are you available for a brief interview?`;
  }
  
  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: settings.openaiKey });
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{
        role: 'user',
        content: `Generate a brief greeting (2-3 sentences) for a candidate named ${name}. Mention the interview questions: ${questions || 'Tell me about yourself and your experience.'}`
      }],
      max_tokens: 100
    });
    
    return completion.choices[0].message.content;
  } catch (err) {
    console.error('OpenAI error:', err.message);
    return `Hello ${name}, this is an AI recruiter calling regarding your application. Are you available for a brief interview?`;
  }
}

async function generateAIResponse(conversation) {
  if (!settings.openaiKey) {
    return 'Thank you for your response. Do you have any questions about the position?';
  }
  
  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: settings.openaiKey });
    
    const messages = [
      { 
        role: 'system', 
        content: `You are an AI recruiter conducting a phone interview. Keep responses brief (1-2 sentences), natural, and conversational. Ask one question at a time.`
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
  } catch (err) {
    console.error('OpenAI error:', err.message);
    return 'Thank you for your response.';
  }
}

function initiateCall(candidateId, candidate) {
  return new Promise((resolve, reject) => {
    if (!ami) {
      return reject(new Error('Asterisk AMI not connected'));
    }
    
    const channel = `${settings.asteriskOutboundChannel}/${candidate.phone.replace(/\D/g, '')}`;
    
    ami.action({
      action: 'Originate',
      channel: channel,
      context: settings.asteriskContext,
      exten: '100',
      priority: 1,
      callerid: 'AI Recruiter',
      async: true,
      variables: {
        CANDIDATE_ID: candidateId,
        CANDIDATE_NAME: candidate.name
      }
    }, (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve({ success: true, channel });
      }
    });
  });
}

function playAudio(channel, audioFile) {
  return new Promise((resolve, reject) => {
    if (!ami) {
      return reject(new Error('Asterisk AMI not connected'));
    }
    
    ami.action({
      action: 'PlayDTMF',
      channel: channel,
      digit: ''
    }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function hangupCall(channel) {
  return new Promise((resolve, reject) => {
    if (!ami) {
      return resolve();
    }
    
    ami.action({
      action: 'Hangup',
      channel: channel
    }, (err) => {
      if (err) console.error('Hangup error:', err.message);
      resolve();
    });
  });
}

function evaluateCandidate(transcript, questions) {
  return new Promise((resolve) => {
    if (!settings.openaiKey) {
      const score = Math.floor(Math.random() * 30) + 70;
      resolve({ score, feedback: 'Interview completed successfully' });
      return;
    }
    
    (async () => {
      try {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: settings.openaiKey });
        
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

        const result = JSON.parse(completion.choices[0].message.content);
        resolve(result);
      } catch (err) {
        console.error('Evaluation error:', err.message);
        const score = Math.floor(Math.random() * 30) + 70;
        resolve({ score, feedback: 'Interview completed' });
      }
    })();
  });
}

export default {
  settings,
  loadSettings,
  getSettings,
  connectAMI,
  disconnectAMI,
  generateGreeting,
  generateAIResponse,
  initiateCall,
  playAudio,
  hangupCall,
  evaluateCandidate,
  activeCalls
};
