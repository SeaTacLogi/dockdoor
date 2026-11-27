const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const db = require('./db');
const { sendDailyScheduleReport } = require('./email');

// Railway sits behind a proxy, so trust it to report the real visitor address
app.set('trust proxy', 1);

// Basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// Only our own website may call the API.
// When you open index.html from your own computer (testing), the browser
// sends the origin "null". That is allowed only when NOT running on Railway.
const onRailway = !!process.env.RAILWAY_ENVIRONMENT_NAME;
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // same-site requests
    if (!onRailway && (origin === 'null' || origin.startsWith('http://localhost'))) {
      return callback(null, true);
    }
    return callback(null, false);
  }
}));

app.use(express.json({ limit: '50kb' }));

// Routes
const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointments');
app.use('/auth', authRoutes);
app.use('/appointments', appointmentRoutes);

// Serve the website (the frontend folder) from the same server
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// =====================
// DAILY SCHEDULE EMAIL - every day at 8:00 PM Pacific time
// '0 20 * * *' = minute 0, hour 20 (8 PM). The timezone setting makes it Pacific.
// =====================
function pacificDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  // en-CA gives YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

cron.schedule('0 20 * * *', () => {
  console.log('Running daily schedule email...');

  const sql = `
    SELECT * FROM appointments 
    WHERE appointment_date >= ? AND appointment_date <= ?
    AND status != 'cancelled'
    ORDER BY appointment_date, start_time
  `;

  db.query(sql, [pacificDate(0), pacificDate(7)], async (err, results) => {
    if (err) {
      console.error('Error fetching appointments for daily report:', err.message);
      return;
    }
    try {
      await sendDailyScheduleReport(results);
    } catch (e) {
      console.error('Error sending daily report:', e.message);
    }
  });
}, {
  timezone: 'America/Los_Angeles'
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
