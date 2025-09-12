const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const db = new sqlite3.Database("bookings.db");

// Middleware
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Create bookings table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    subjects TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Handle booking form submission
app.post("/book", (req, res) => {
  const { name, email, subjects } = req.body;
  const selectedSubjects = Array.isArray(subjects) ? subjects.join(", ") : subjects;

  db.run(
    `INSERT INTO bookings (name, email, subjects) VALUES (?, ?, ?)`,
    [name, email, selectedSubjects],
    function (err) {
      if (err) {
        console.error(err.message);
        return res.status(500).send("Booking failed.");
      }
      res.status(200).send("Booking successful!");
    }
  );
});

// View all bookings
app.get("/bookings", (req, res) => {
  db.all(`SELECT * FROM bookings ORDER BY timestamp DESC`, [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Error retrieving bookings.");
    }
    res.json(rows);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
