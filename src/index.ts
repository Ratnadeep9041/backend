import 'dotenv/config';
import express from 'express';
import cors from "cors"
import { auditWebsite } from './audit';
import { AuditRequest } from './types';

const app = express();

// Enable CORS for all routes
app.use(cors());

// Parse JSON
app.use(express.json());

app.get('/api/audit', async (req, res) => {
  try {
    const { url } = req.query ;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      new URL(url as string);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
   console.log("inside")
    const result = await auditWebsite(url as string);
    res.json(result);
  } catch (err) {
    console.error('Audit error:', err);
    res.status(500).json({
      error: 'Failed to audit website',
      message: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SEO Audit API running on port ${PORT}`);
});
