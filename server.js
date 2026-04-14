/**
 * Event Management Module - Backend Server
 * Training Management System
 * Stack: Node.js + Express + SQLite
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Database Setup ───────────────────────────────────────────────────────────
const db = new sqlite3.Database(path.join(__dirname, 'database.db'), (err) => {
  if (err) {
    console.error('❌ Failed to connect to SQLite:', err.message);
  } else {
    console.log('✅ Connected to SQLite database.');
    initializeDB();
  }
});

/**
 * Create tables and seed sample events if empty
 */
function initializeDB() {
  db.serialize(() => {
    // Create events table
    db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        title        TEXT    NOT NULL,
        date         TEXT    NOT NULL,
        location     TEXT    NOT NULL,
        max_capacity INTEGER NOT NULL
      )
    `);

    // Create registrations table with unique constraint on (event_id, email)
    db.run(`
      CREATE TABLE IF NOT EXISTS registrations (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        name     TEXT    NOT NULL,
        email    TEXT    NOT NULL,
        FOREIGN KEY (event_id) REFERENCES events(id),
        UNIQUE (event_id, email)
      )
    `);

    // Seed sample data if no events exist
    db.get('SELECT COUNT(*) as count FROM events', [], (err, row) => {
      if (!err && row.count === 0) {
        const seed = db.prepare(`
          INSERT INTO events (title, date, location, max_capacity) VALUES (?, ?, ?, ?)
        `);
        seed.run('Leadership & Management Workshop', '2026-05-10', 'Conference Hall A', 30);
        seed.run('Python for Data Science Bootcamp', '2026-05-18', 'Training Room 2', 20);
        seed.run('Effective Communication Skills', '2026-06-02', 'Auditorium B', 50);
        seed.run('Agile & Scrum Fundamentals', '2026-06-15', 'Online (Zoom)', 100);
        seed.finalize();
        console.log('🌱 Sample events seeded.');
      }
    });
  });
}

// ─── Helper: Simulate Email ───────────────────────────────────────────────────
function sendEmail(to, subject, body) {
  console.log('\n📧 ─── Email Simulation ───────────────────────────');
  console.log(`   To      : ${to}`);
  console.log(`   Subject : ${subject}`);
  console.log(`   Body    : ${body}`);
  console.log('────────────────────────────────────────────────────\n');
}

// ─── API Routes ───────────────────────────────────────────────────────────────

/**
 * GET /events
 * Returns all events with registered count and seats left
 */
app.get('/events', (req, res) => {
  const sql = `
    SELECT
      e.id,
      e.title,
      e.date,
      e.location,
      e.max_capacity,
      COUNT(r.id) AS registered_count,
      (e.max_capacity - COUNT(r.id)) AS seats_left
    FROM events e
    LEFT JOIN registrations r ON e.id = r.event_id
    GROUP BY e.id
    ORDER BY e.date ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
    res.json({ success: true, events: rows });
  });
});

/**
 * POST /events
 * Create a new event
 * Body: { title, date, location, max_capacity }
 */
app.post('/events', (req, res) => {
  const { title, date, location, max_capacity } = req.body;

  // Validation
  if (!title || !date || !location || !max_capacity) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  if (isNaN(max_capacity) || parseInt(max_capacity) <= 0) {
    return res.status(400).json({ success: false, message: 'Capacity must be a positive number.' });
  }

  const sql = `INSERT INTO events (title, date, location, max_capacity) VALUES (?, ?, ?, ?)`;
  db.run(sql, [title.trim(), date, location.trim(), parseInt(max_capacity)], function (err) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Failed to create event.' });
    }
    res.status(201).json({
      success: true,
      message: 'Event created successfully.',
      eventId: this.lastID
    });
  });
});

/**
 * POST /register
 * Register a user for an event
 * Body: { event_id, name, email }
 */
app.post('/register', (req, res) => {
  const { event_id, name, email } = req.body;

  // Validation
  if (!event_id || !name || !email) {
    return res.status(400).json({ success: false, message: 'event_id, name, and email are required.' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email address.' });
  }

  // Step 1: Check if event exists
  db.get('SELECT * FROM events WHERE id = ?', [event_id], (err, event) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error.' });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    // Step 2: Check current registration count
    db.get('SELECT COUNT(*) as count FROM registrations WHERE event_id = ?', [event_id], (err, row) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error.' });

      // Step 3: Check if event is full
      if (row.count >= event.max_capacity) {
        return res.status(409).json({ success: false, message: 'Event is full. No seats available.' });
      }

      // Step 4: Insert registration (UNIQUE constraint handles duplicates)
      const sql = `INSERT INTO registrations (event_id, name, email) VALUES (?, ?, ?)`;
      db.run(sql, [event_id, name.trim(), email.trim().toLowerCase()], function (err) {
        if (err) {
          // SQLite UNIQUE constraint violation
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({
              success: false,
              message: 'You are already registered for this event.'
            });
          }
          return res.status(500).json({ success: false, message: 'Registration failed.' });
        }

        // Step 5: Simulate email confirmation
        sendEmail(
          email,
          `Registration Confirmed: ${event.title}`,
          `Hi ${name}, you are successfully registered for "${event.title}" on ${event.date} at ${event.location}.`
        );

        res.status(201).json({
          success: true,
          message: `Successfully registered for "${event.title}".`,
          registrationId: this.lastID
        });
      });
    });
  });
});

/**
 * DELETE /cancel
 * Cancel a registration using email + event_id
 * Body: { event_id, email }
 */
app.delete('/cancel', (req, res) => {
  const { event_id, email } = req.body;

  if (!event_id || !email) {
    return res.status(400).json({ success: false, message: 'event_id and email are required.' });
  }

  const sql = `DELETE FROM registrations WHERE event_id = ? AND email = ?`;
  db.run(sql, [event_id, email.trim().toLowerCase()], function (err) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Cancellation failed.' });
    }

    // Check if any row was actually deleted
    if (this.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'No registration found for this email and event.'
      });
    }

    // Seats are automatically freed since we count from the registrations table
    console.log(`🗑️  Registration cancelled: event_id=${event_id}, email=${email}`);
    res.json({ success: true, message: 'Registration cancelled successfully. Your seat has been freed.' });
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Event Management Server running at http://localhost:${PORT}`);
  console.log(`   User dashboard : http://localhost:${PORT}/index.html`);
  console.log(`   Admin panel    : http://localhost:${PORT}/admin.html\n`);
});
