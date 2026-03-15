import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { getLastUploadedCSVPath } from './upload';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'No query provided' });
  }

  const csvPath = getLastUploadedCSVPath();
  if (!csvPath || !fs.existsSync(csvPath)) {
    return res.status(400).json({ error: 'No CSV uploaded yet' });
  }

  // Read CSV and search for query (simple contains search in any cell)
  const results = [];
  try {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        // If any cell contains the query string, add the row to results
        if (Object.values(row).some(val => String(val).toLowerCase().includes(query.toLowerCase()))) {
          results.push(row);
        }
      })
      .on('end', () => {
        res.status(200).json({ results });
      })
      .on('error', (err) => {
        res.status(500).json({ error: 'CSV read error', details: err.message });
      });
  } catch (err) {
    res.status(500).json({ error: 'CSV processing error', details: err.message });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
