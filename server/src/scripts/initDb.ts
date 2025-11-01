import 'dotenv/config';
import mysql from 'mysql2/promise';

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'dienstplaner'
} = process.env;

async function ensureDatabase() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await conn.end();
}

async function run() {
  await ensureDatabase();
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
  });

  const sql = `
  CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role ENUM('User','Admin') NOT NULL,
    password_hash VARCHAR(255) NULL,
    calendar_token VARCHAR(64) NULL,
    birthday DATE NULL,
    anniversary DATE NULL,
    UNIQUE KEY uk_calendar_token (calendar_token)
  );

  CREATE TABLE IF NOT EXISTS shift_types (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    color VARCHAR(64) NOT NULL,
    min_users INT NOT NULL,
    max_users INT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id VARCHAR(36) PRIMARY KEY,
    date DATE NOT NULL,
    shift_type_id VARCHAR(36) NOT NULL,
    CONSTRAINT fk_assign_shift_type FOREIGN KEY (shift_type_id) REFERENCES shift_types(id) ON DELETE CASCADE,
    UNIQUE KEY uk_date_shift (date, shift_type_id)
  );

  CREATE TABLE IF NOT EXISTS assignment_users (
    assignment_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (assignment_id, user_id),
    CONSTRAINT fk_au_assign FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    CONSTRAINT fk_au_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS week_configs (
    year INT NOT NULL,
    week_number INT NOT NULL,
    status ENUM('Gesperrt','Offen') NOT NULL,
    PRIMARY KEY (year, week_number)
  );

  CREATE TABLE IF NOT EXISTS week_shift_overrides (
    year INT NOT NULL,
    week_number INT NOT NULL,
    shift_type_id VARCHAR(36) NOT NULL,
    min_users INT NULL,
    max_users INT NULL,
    PRIMARY KEY (year, week_number, shift_type_id),
    CONSTRAINT fk_wso_shift_type FOREIGN KEY (shift_type_id) REFERENCES shift_types(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS handover_requests (
    id VARCHAR(36) PRIMARY KEY,
    assignment_id VARCHAR(36) NOT NULL,
    from_user_id VARCHAR(36) NOT NULL,
    to_user_id VARCHAR(36) NOT NULL,
    status ENUM('REQUESTED','ACCEPTED','REJECTED','APPROVED','DECLINED') NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_hr_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    CONSTRAINT fk_hr_from_user FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_hr_to_user FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS absences (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    type ENUM('VACATION','SEMINAR') NOT NULL,
    note VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_abs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_date (user_id, date)
  );
  `;

  await conn.query(sql);

  // Attempt to migrate existing databases: add password_hash and calendar_token if missing
  try {
    await conn.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL");
  } catch (_) {}
  try {
    await conn.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_token VARCHAR(64) NULL");
  } catch (_) {}
  // Unique index (best-effort); may fail if not supported or already exists
  try {
    await conn.query("ALTER TABLE users ADD UNIQUE KEY uk_calendar_token (calendar_token)");
  } catch (_) {}

  await conn.end();
  console.log('Database initialized.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
