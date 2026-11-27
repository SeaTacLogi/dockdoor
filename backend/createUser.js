// Run this to add a staff login:  node createUser.js
// It asks for a name, email and password. The password is stored scrambled.
const readline = require('readline');
const bcrypt = require('bcryptjs');
const db = require('./db');

function ask(question, hidden) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });
    if (hidden) {
      // Do not show the password while typing
      rl._writeToOutput = (text) => {
        if (text.startsWith(question)) rl.output.write(text);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) console.log('');
      resolve(answer.trim());
    });
  });
}

function query(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

async function main() {
  await query(`
    CREATE TABLE IF NOT EXISTS staff_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const name = await ask('Name: ', false);
  const email = (await ask('Email: ', false)).toLowerCase();
  const password = await ask('Password (at least 10 characters, typing is hidden): ', true);
  const again = await ask('Type the password again: ', true);

  if (!name || !email) throw new Error('Name and email are required.');
  if (password.length < 10) throw new Error('Password must be at least 10 characters.');
  if (password !== again) throw new Error('The two passwords did not match.');

  const hash = bcrypt.hashSync(password, 10);

  await query(
    `INSERT INTO staff_users (name, email, password_hash) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), is_active = 1`,
    [name, email, hash]
  );

  console.log(`Done. ${email} can now log in.`);
}

main()
  .catch((e) => console.error('Error:', e.message))
  .finally(() => db.end());
