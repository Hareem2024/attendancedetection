const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance-system')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Attendance Record Schema
const attendanceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  timestamp: { type: Date, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true }
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

// Routes
app.get('/api/attendance', async (req, res) => {
  try {
    const records = await Attendance.find().sort({ timestamp: -1 });
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
    
    const record = new Attendance({
      name,
      timestamp,
      date,
      time
    });
    
    await record.save();
    res.status(201).json(record);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 