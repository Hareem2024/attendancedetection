const fs = require('fs').promises;
const path = require('path');

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

exports.handler = async function(event, context) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Handle GET request
    if (event.httpMethod === 'GET') {
      const records = await readRecords();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(records)
      };
    }

    // Handle POST request
    if (event.httpMethod === 'POST') {
      const { name, timestamp } = JSON.parse(event.body);
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
      
      records.unshift(newRecord);
      await writeRecords(records);
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(newRecord)
      };
    }

    // Handle unsupported methods
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: error.message })
    };
  }
}; 