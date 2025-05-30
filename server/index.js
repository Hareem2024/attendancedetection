const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// File path for storing attendance records
const DATA_FILE = path.join(__dirname, 'attendance.json');

// Ensure the data file exists
async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([]));
  }
}

// Read attendance records
async function readRecords() {
  await ensureDataFile();
  const data = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(data);
}

// Write attendance records
async function writeRecords(records) {
  await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2));
}

// Routes
app.get('/api/attendance', async (req, res) => {
  try {
    const records = await readRecords();
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/attendance', async (req, res) => {
  try {
    const { name, timestamp } = req.body;
    const date = new Date(timestamp).toLocaleDateString();
    const time = new Date(timestamp).toLocaleTimeString();
    
    const records = await readRecords();
    const newRecord = {
      id: `${name}-${Date.now()}`,
      name,
      timestamp,
      date,
      time
    };
    
    records.unshift(newRecord); // Add to beginning of array
    await writeRecords(records);
    
    res.status(201).json(newRecord);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 