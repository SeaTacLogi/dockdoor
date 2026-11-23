require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.sendMail({
  from: `"JRY Dock Doors" <${process.env.EMAIL_USER}>`,
  to: process.env.EMAIL_ALERT,
  subject: 'JRY Dock Doors - Email Test',
  html: '<h1>Email is working!</h1><p>This is a test from JRY Dock Doors.</p>'
}, (err, info) => {
  if (err) {
    console.error('ERROR:', err.message);
  } else {
    console.log('Email sent successfully!', info.response);
  }
});
