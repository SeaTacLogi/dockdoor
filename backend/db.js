const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Return dates as plain text like "2026-11-30" so time zones can't shift them
  dateStrings: ['DATE']
});

// Creates the tables if they do not exist yet (needed on the new Railway database)
const createAppointments = `
  CREATE TABLE IF NOT EXISTS appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    appointment_type ENUM('delivery','pickup') NOT NULL,
    status ENUM('scheduled','checked_in','in_progress','completed','cancelled') DEFAULT 'scheduled',
    company_name VARCHAR(150),
    truck_number VARCHAR(50),
    driver_name VARCHAR(100),
    driver_contact VARCHAR(20),
    bol_number VARCHAR(100) NOT NULL,
    reference_number VARCHAR(100) NOT NULL,
    cargo_type VARCHAR(100),
    weight DECIMAL(10,2),
    pallet_count INT,
    special_handling VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`;

const createStaff = `
  CREATE TABLE IF NOT EXISTS staff_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    return;
  }
  console.log('Connected to MySQL database!');
  db.query(createAppointments, (e) => e && console.error('Table error (appointments):', e.message));
  db.query(createStaff, (e) => e && console.error('Table error (staff_users):', e.message));
});

module.exports = db;
