const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Add these lines after: const app = express();
app.use(express.static('public')); // Serves files from public folder
app.use('/images', express.static('images')); // Serves files from images folder
app.use(express.json());
app.use(express.static('public')); // Serve static files from public directory

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
    )`, (err) => {
      if (err) {
        console.error('Error creating table:', err);
      } else {
        console.log('Bookings table ready');
      }
    });
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

// API endpoint to get all bookings (for admin purposes)
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
// Admin route to view all bookings
app.get('/admin/bookings', (req, res) => {
  db.all('SELECT * FROM bookings ORDER BY timestamp DESC', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Error fetching bookings');
    }
    
    // Create HTML table with bookings
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>STEMfactory Bookings</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #3a86ff; color: white; }
          tr:nth-child(even) { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>STEMfactory Bookings</h1>
        <table>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Subjects</th>
            <th>Total</th>
            <th>Date/Time</th>
          </tr>
    `;
    
    rows.forEach(booking => {
      html += `
        <tr>
          <td>${booking.id}</td>
          <td>${booking.name}</td>
          <td>${booking.email}</td>
          <td>${booking.subjects}</td>
          <td>R${booking.total}</td>
          <td>${booking.timestamp}</td>
        </tr>
      `;
    });
    
    html += '</table></body></html>';
    res.send(html);
  });
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
