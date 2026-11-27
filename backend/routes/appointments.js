const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendNewAppointmentAlert } = require('../email');
const { requireAuth } = require('../auth');
const rateLimit = require('express-rate-limit');

// Customers can book at most 20 times per hour from one computer
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many bookings from this computer. Please try again later.' }
});

// GET all appointments (staff only)
router.get('/', requireAuth, (req, res) => {
  const sql = 'SELECT * FROM appointments ORDER BY appointment_date, start_time';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// GET single appointment by ID (staff only)
router.get('/:id', requireAuth, (req, res) => {
  const sql = 'SELECT * FROM appointments WHERE id = ?';
  db.query(sql, [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json(results[0]);
  });
});

// POST create new appointment (public, so customers can book)
router.post('/', bookingLimiter, (req, res) => {
  const {
    appointment_date,
    start_time,
    end_time,
    appointment_type,
    company_name,
    truck_number,
    driver_name,
    driver_contact,
    bol_number,
    reference_number,
    cargo_type,
    weight,
    pallet_count,
    special_handling,
    notes
  } = req.body;

  // Check required fields
  if (!bol_number || !reference_number) {
    return res.status(400).json({ error: 'BOL number and reference number are required' });
  }

  // Check for weekends - Door 1 is weekdays only
  const dayOfWeek = new Date(appointment_date + 'T00:00:00').getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return res.status(400).json({ error: 'We are not open on weekends. Please select a weekday.' });
  }

  // Check time is within operating hours (8:00 AM - 3:00 PM)
  const [startHour, startMin] = start_time.split(':').map(Number);
  const startTotal = startHour * 60 + startMin;
  if (startTotal < 480 || startTotal >= 900) {
    return res.status(400).json({ error: 'Appointments must be between 8:00 AM and 3:00 PM.' });
  }

  // Block lunch 12:00 - 12:30
  if (startTotal >= 720 && startTotal < 750) {
    return res.status(400).json({ error: 'No appointments during lunch break (12:00 PM - 12:30 PM).' });
  }

  // Calculate the hour block (e.g. 08:00 or 08:30 both belong to hour 8)
  const hour = parseInt(start_time.split(':')[0]);
  const hourStart = `${hour.toString().padStart(2, '0')}:00:00`;
  const hourEnd   = `${hour.toString().padStart(2, '0')}:59:59`;

  // Check for same type (delivery or pickup) already booked in the same hour
  const conflictSQL = `
    SELECT * FROM appointments 
    WHERE appointment_date = ? 
    AND status != 'cancelled'
    AND appointment_type = ?
    AND start_time >= ? AND start_time <= ?
  `;
  db.query(conflictSQL, [appointment_date, appointment_type, hourStart, hourEnd], (err, conflicts) => {
    if (err) return res.status(500).json({ error: err.message });
    if (conflicts.length > 0) {
      return res.status(400).json({ 
        error: `Only 1 ${appointment_type} allowed per hour. This hour is already booked for a ${appointment_type}.` 
      });
    }

    // Insert appointment
    const insertSQL = `
      INSERT INTO appointments 
      (appointment_date, start_time, end_time, appointment_type, status,
       company_name, truck_number, driver_name, driver_contact,
       bol_number, reference_number, cargo_type, weight, pallet_count,
       special_handling, notes)
      VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      appointment_date, start_time, end_time, appointment_type,
      company_name, truck_number, driver_name, driver_contact,
      bol_number, reference_number, cargo_type, weight, pallet_count,
      special_handling, notes
    ];

    db.query(insertSQL, values, async (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Send the email in the background so the booking never waits for it
      sendNewAppointmentAlert({
        ...req.body,
        start_time,
        end_time
      }).catch((e) => console.error('Email error:', e.message));

      res.status(201).json({ message: 'Appointment created!', id: result.insertId });
    });
  });
});

// PUT update appointment status (staff only)
router.put('/:id', requireAuth, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const sql = 'UPDATE appointments SET status = ?, updated_at = NOW() WHERE id = ?';
  db.query(sql, [status, req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ message: 'Appointment updated!' });
  });
});

// DELETE cancel appointment (staff only)
router.delete('/:id', requireAuth, (req, res) => {
  const sql = 'UPDATE appointments SET status = "cancelled", updated_at = NOW() WHERE id = ?';
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ message: 'Appointment cancelled!' });
  });
});

// GET available time slots for a date
router.get('/slots/:date', (req, res) => {
  // Block weekends
  const dayOfWeek = new Date(req.params.date + 'T00:00:00').getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return res.json({ date: req.params.date, available_slots: [], message: 'We are not open on weekends.' });
  }

  const allSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:30', '13:00', '13:30',
    '14:00', '14:30'
  ];

  const sql = `
    SELECT start_time FROM appointments 
    WHERE appointment_date = ? AND status != 'cancelled'
  `;
  db.query(sql, [req.params.date], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    const booked = results.map(r => r.start_time.substring(0, 5));
    const available = allSlots.filter(slot => !booked.includes(slot));
    res.json({ date: req.params.date, available_slots: available });
  });
});

module.exports = router;
