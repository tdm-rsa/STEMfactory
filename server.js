const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/images', express.static('images'));

// Database initialization with backup system
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        // Check if backup exists and restore it
        if (fs.existsSync('bookings.backup.db') && !fs.existsSync('bookings.db')) {
            console.log('Restoring from backup...');
            fs.copyFileSync('bookings.backup.db', 'bookings.db');
        }

        // Ensure database file exists
        if (!fs.existsSync('bookings.db')) {
            console.log('Creating new database file...');
            fs.writeFileSync('bookings.db', '');
        }

        const db = new sqlite3.Database('bookings.db', (err) => {
            if (err) {
                console.error('Error opening database:', err);
                reject(err);
                return;
            }

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
                    reject(err);
                } else {
                    console.log('Bookings table ready');
                    
                    // Create automatic backup every hour
                    setInterval(() => {
                        if (fs.existsSync('bookings.db')) {
                            fs.copyFileSync('bookings.db', 'bookings.backup.db');
                            console.log('Database backup created:', new Date().toLocaleString());
                        }
                    }, 3600000); // Backup every hour
                    
                    resolve(db);
                }
            });
        });
    });
}

// Email notification function (optional)
function sendEmailNotification(booking) {
    // This is a placeholder - you can integrate with SendGrid, Mailgun, etc.
    console.log('New booking received:');
    console.log('Name:', booking.name);
    console.log('Email:', booking.email);
    console.log('Subjects:', booking.subjects);
    console.log('Total: R', booking.total);
    console.log('---');
    
    // In production, you would add actual email sending code here
    // Example with SendGrid:
    /*
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const msg = {
        to: 'your-email@gmail.com',
        from: 'noreply@stemfactorysa.co.za',
        subject: 'New Booking Received',
        text: `New booking from ${booking.name} for ${booking.subjects}`
    };
    sgMail.send(msg);
    */
}

// Initialize database and start server
initializeDatabase()
    .then((db) => {
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
                
                // Send email notification
                sendEmailNotification({ name, email, subjects: subjectsString, total });
                
                res.json({ 
                    message: 'Booking successful', 
                    total: total,
                    bookingId: this.lastID 
                });
            });
            
            stmt.finalize();
        });

        // API endpoint to get all bookings
        app.get('/api/bookings', (req, res) => {
            db.all('SELECT * FROM bookings ORDER BY timestamp DESC', (err, rows) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Failed to fetch bookings' });
                }
                res.json(rows);
            });
        });

        // Admin route to view all bookings
        app.get('/admin/bookings', (req, res) => {
            db.all('SELECT * FROM bookings ORDER BY timestamp DESC', (err, rows) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).send('Error fetching bookings');
                }
                
                let html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>STEMfactory Bookings</title>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 40px; }
                            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                            th { background-color: #3a86ff; color: white; }
                            tr:nth-child(even) { background-color: #f2f2f2; }
                            .backup-btn { 
                                background: #38b000; color: white; padding: 10px 15px; 
                                border: none; border-radius: 5px; cursor: pointer; margin: 10px 0;
                            }
                        </style>
                    </head>
                    <body>
                        <h1>STEMfactory Bookings (${rows.length} total)</h1>
                        <button class="backup-btn" onclick="location.href='/admin/backup'">Download Backup</button>
                        <table>
                            <tr>
                                <th>ID</th><th>Name</th><th>Email</th><th>Subjects</th><th>Total</th><th>Date/Time</th>
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

        // Download database backup
        app.get('/admin/backup', (req, res) => {
            if (fs.existsSync('bookings.db')) {
                res.download('bookings.db', 'bookings-backup.db');
            } else {
                res.status(404).send('Database file not found');
            }
        });

        // Export bookings as CSV
        app.get('/admin/export-csv', (req, res) => {
            db.all('SELECT * FROM bookings ORDER BY timestamp DESC', (err, rows) => {
                if (err) {
                    return res.status(500).send('Error fetching bookings');
                }
                
                let csv = 'ID,Name,Email,Subjects,Total,Timestamp\n';
                rows.forEach(booking => {
                    csv += `"${booking.id}","${booking.name}","${booking.email}","${booking.subjects}","${booking.total}","${booking.timestamp}"\n`;
                });
                
                res.header('Content-Type', 'text/csv');
                res.attachment('bookings-export.csv');
                res.send(csv);
            });
        });

        // Serve the frontend
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Start server
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Admin panel: http://localhost:${PORT}/admin/bookings`);
        });
    })
    .catch((err) => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });

// Graceful shutdown with final backup
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    if (fs.existsSync('bookings.db')) {
        fs.copyFileSync('bookings.db', 'bookings.backup.db');
        console.log('Final backup created');
    }
    process.exit(0);
});