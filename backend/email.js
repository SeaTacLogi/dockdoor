require('dotenv').config();

// Emails are sent through Resend over HTTPS (Railway blocks Gmail's SMTP on this plan).
const FROM = process.env.EMAIL_FROM || 'JRY Dock Doors <alerts@updates.jrylogistics.com>';

async function sendMail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is missing');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: FROM, to, subject, html })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error ${response.status}: ${text}`);
  }
}

// =====================
// EMAIL 1: New Appointment Alert
// =====================
async function sendNewAppointmentAlert(apt) {
  apt = safe(apt);
  const subject = `New Appointment Booked - ${apt.company_name}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a3c5e; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">🚛 JRY Dock Doors</h1>
        <p style="color: #ccc; margin: 5px 0;">New Appointment Booked</p>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #555; width: 40%;">Company</td>
            <td style="padding: 10px;">${apt.company_name}</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px; font-weight: bold; color: #555;">Driver</td>
            <td style="padding: 10px;">${apt.driver_name}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #555;">Driver Contact</td>
            <td style="padding: 10px;">${apt.driver_contact}</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px; font-weight: bold; color: #555;">Truck Number</td>
            <td style="padding: 10px;">${apt.truck_number}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #555;">Date</td>
            <td style="padding: 10px;">${formatDate(apt.appointment_date)}</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px; font-weight: bold; color: #555;">Time</td>
            <td style="padding: 10px;">${formatTime(apt.start_time)} - ${formatTime(apt.end_time)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #555;">Type</td>
            <td style="padding: 10px; text-transform: capitalize;">${apt.appointment_type}</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px; font-weight: bold; color: #555;">BOL Number</td>
            <td style="padding: 10px;">${apt.bol_number}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #555;">Reference Number</td>
            <td style="padding: 10px;">${apt.reference_number}</td>
          </tr>
          ${apt.cargo_type ? `<tr style="background: #fff;"><td style="padding: 10px; font-weight: bold; color: #555;">Cargo Type</td><td style="padding: 10px;">${apt.cargo_type}</td></tr>` : ''}
          ${apt.weight ? `<tr><td style="padding: 10px; font-weight: bold; color: #555;">Weight</td><td style="padding: 10px;">${apt.weight} lbs</td></tr>` : ''}
          ${apt.pallet_count ? `<tr style="background: #fff;"><td style="padding: 10px; font-weight: bold; color: #555;">Pallets</td><td style="padding: 10px;">${apt.pallet_count}</td></tr>` : ''}
          ${apt.notes ? `<tr><td style="padding: 10px; font-weight: bold; color: #555;">Notes</td><td style="padding: 10px;">${apt.notes}</td></tr>` : ''}
        </table>
      </div>
      <div style="background: #1a3c5e; padding: 15px; text-align: center;">
        <p style="color: #ccc; margin: 0; font-size: 12px;">JRY Dock Doors — Automated Notification</p>
      </div>
    </div>
  `;

  await sendMail({
    to: [process.env.EMAIL_ALERT],
    subject,
    html
  });

  console.log(`New appointment email sent for ${apt.company_name}`);
}

// =====================
// EMAIL 2: Daily Schedule Report
// =====================
async function sendDailyScheduleReport(appointments) {
  appointments = appointments.map(safe);
  const subject = `JRY Dock Doors — 7-Day Schedule Report`;

  let rows = '';
  if (appointments.length === 0) {
    rows = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: #999;">No upcoming appointments in the next 7 days.</td></tr>`;
  } else {
    appointments.forEach((apt, i) => {
      const bg = i % 2 === 0 ? '#f9f9f9' : '#ffffff';
      rows += `
        <tr style="background: ${bg};">
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${formatDate(apt.appointment_date)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${formatTime(apt.start_time)} - ${formatTime(apt.end_time)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-transform: capitalize;">${apt.appointment_type}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${apt.company_name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${apt.driver_name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${apt.bol_number}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${apt.reference_number}</td>
        </tr>
      `;
    });
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto;">
      <div style="background: #1a3c5e; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">🚛 JRY Dock Doors</h1>
        <p style="color: #ccc; margin: 5px 0;">7-Day Schedule Report</p>
      </div>
      <div style="padding: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background: #1a3c5e; color: white;">
              <th style="padding: 12px; text-align: left;">Date</th>
              <th style="padding: 12px; text-align: left;">Time</th>
              <th style="padding: 12px; text-align: left;">Type</th>
              <th style="padding: 12px; text-align: left;">Company</th>
              <th style="padding: 12px; text-align: left;">Driver</th>
              <th style="padding: 12px; text-align: left;">BOL</th>
              <th style="padding: 12px; text-align: left;">Reference</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <p style="color: #999; font-size: 12px; margin-top: 20px;">Total appointments: ${appointments.length}</p>
      </div>
      <div style="background: #1a3c5e; padding: 15px; text-align: center;">
        <p style="color: #ccc; margin: 0; font-size: 12px;">JRY Dock Doors — Automated Daily Report</p>
      </div>
    </div>
  `;

  await sendMail({
    to: [process.env.EMAIL_DAILY_1, process.env.EMAIL_DAILY_2],
    subject,
    html
  });

  console.log('Daily schedule report sent!');
}

// =====================
// HELPERS
// =====================
function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

function formatDate(value) {
  if (!value) return '';
  let d;
  if (value instanceof Date) {
    // The database gives a Date object for the 7-day report
    d = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  } else {
    const [year, month, day] = String(value).split('T')[0].split('-').map(Number);
    d = new Date(year, month - 1, day);
  }
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// Turns special characters into plain text so nobody can sneak code into an email
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function safe(apt) {
  const out = {};
  for (const key in apt) {
    out[key] = typeof apt[key] === 'string' ? escapeHtml(apt[key]) : apt[key];
  }
  return out;
}

module.exports = { sendNewAppointmentAlert, sendDailyScheduleReport };
