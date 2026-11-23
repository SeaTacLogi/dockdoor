const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const db = require('./db');
const { sendDailyScheduleReport } = require('./email');

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const appointmentRoutes = require('./routes/appointments');
app.use('/appointments', appointmentRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'DockDoor API is running!' });
});

// =====================
// DAILY SCHEDULE EMAIL - 8:00 PM PST (UTC-8 = 04:00 UTC)
// Cron: minute hour * * * 
// 8PM PST = 04:00 UTC next day -> '0 4 * * *'
// =====================
cron.schedule('0 4 * * *', () => {
  console.log('Running daily schedule email...');

  const today = new Date();
  const in7Days = new Date();
  in7Days.setDate(today.getDate() + 7);

  const todayStr   = today.toISOString().split('T')[0];
  const futureStr  = in7Days.toISOString().split('T')[0];

  const sql = `
    SELECT * FROM appointments 
    WHERE appointment_date >= ? AND appointment_date <= ?
    AND status != 'cancelled'
    ORDER BY appointment_date, start_time
  `;

  db.query(sql, [todayStr, futureStr], async (err, results) => {
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
