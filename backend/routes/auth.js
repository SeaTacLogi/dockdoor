const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const db = require('../db');
const { signToken } = require('../auth');

// Max 10 login tries per 15 minutes per computer
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' }
});

// A fake hash so a wrong email takes the same time as a wrong password
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post('/login', loginLimiter, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Enter your email and password.' });
  }

  db.query(
    'SELECT * FROM staff_users WHERE email = ? AND is_active = 1',
    [email],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Something went wrong.' });

      const user = rows[0];
      const ok = bcrypt.compareSync(password, user ? user.password_hash : DUMMY_HASH);

      if (!user || !ok) {
        return res.status(401).json({ error: 'Wrong email or password.' });
      }

      res.json({ token: signToken(user), name: user.name });
    }
  );
});

module.exports = router;
