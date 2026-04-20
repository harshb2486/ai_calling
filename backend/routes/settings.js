import express from 'express';
import asteriskService from '../services/asteriskService.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const settings = asteriskService.getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { 
      asteriskHost, 
      asteriskPort, 
      asteriskUser, 
      asteriskSecret,
      asteriskContext,
      asteriskOutboundChannel,
      openaiKey 
    } = req.body;
    
    asteriskService.loadSettings({
      asteriskHost,
      asteriskPort,
      asteriskUser,
      asteriskSecret,
      asteriskContext,
      asteriskOutboundChannel,
      openaiKey
    });
    
    res.json(asteriskService.getSettings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/connect', (req, res) => {
  try {
    asteriskService.connectAMI();
    res.json({ message: 'Connecting to Asterisk...' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/disconnect', (req, res) => {
  try {
    asteriskService.disconnectAMI();
    res.json({ message: 'Disconnected from Asterisk' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
