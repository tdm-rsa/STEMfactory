const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public')); // If serving static files

// Initialize database
const db = new sqlite3.Database('bookings.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    // Create bookings table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subjects TEXT NOT NULL,
      total REAL NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

// API endpoint to handle booking submissions
app.post('/api/book', (req, res) => {
  const { name, email, subjects } = req.body;
  
  if (!name || !email || !subjects || subjects.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const total = subjects.length * 300;
  const subjectsString = subjects.join(',');
  
  const stmt = db.prepare('INSERT INTO bookings (name, email, subjects, total) VALUES (?, ?, ?, ?)');
  stmt.run([name, email, subjectsString, total], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to save booking' });
    }
    
    res.json({ 
      message: 'Booking successful', 
      total: total,
      bookingId: this.lastID 
    });
  });
  
  stmt.finalize();
});

// API endpoint to get all bookings (optional, for admin)
app.get('/api/bookings', (req, res) => {
  db.all('SELECT * FROM bookings ORDER BY timestamp DESC', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch bookings' });
    }
    res.json(rows);
  });
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});