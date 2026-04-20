import express from 'express';
import { getClients, getClientById, createClient, updateClient, deleteClient } from '../data/store.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const clients = getClients();
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const client = getClientById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, contactPerson, phone, email } = req.body;
    if (!name || !contactPerson || !phone) {
      return res.status(400).json({ error: 'Name, contact person, and phone are required' });
    }
    
    const client = createClient({ name, contactPerson, phone, email });
    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, contactPerson, phone, email } = req.body;
    const client = updateClient(req.params.id, { name, contactPerson, phone, email });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const deleted = deleteClient(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json({ message: 'Client deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;