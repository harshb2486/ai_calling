import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import candidatesRouter from './routes/candidates.js';
import settingsRouter from './routes/settings.js';
import callsRouter from './routes/calls.js';
import clientsRouter from './routes/clients.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.use('/api/candidates', candidatesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/calls', callsRouter);
app.use('/api/clients', clientsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>AI Voice Recruiter API</title></head>
      <body style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h1>AI Voice Recruiter Backend</h1>
        <p>API is running. Go to <a href="http://localhost:5173">http://localhost:5173</a> to use the app.</p>
        <p>API endpoints: /api/candidates, /api/settings, /api/calls</p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
