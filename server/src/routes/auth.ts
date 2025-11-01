import { Router } from 'express';
import { pool } from '../db.js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const router = Router();

const UsernameSchema = z.object({
  username: z.string().min(1),
});

const PasswordLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6)
});

const SetPasswordSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8)
});

// Check if a user exists and whether a password is set
router.post('/check-user', async (req, res) => {
  const parse = UsernameSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { username } = parse.data;
  try {
    const [rows] = await pool.query('SELECT id, name, role, password_hash FROM users WHERE LOWER(name)=LOWER(?) LIMIT 1', [username]);
    // @ts-ignore - mysql2 types
    const user = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!user) return res.json({ exists: false });
    const needsPassword = !user.password_hash;
    return res.json({ exists: true, needsPassword, user: { id: user.id, name: user.name, role: user.role } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Check failed' });
  }
});

// Username-only login: allowed ONLY if user exists and has no password yet
router.post('/login', async (req, res) => {
  const parse = UsernameSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { username } = parse.data;
  try {
    const [rows] = await pool.query('SELECT id, name, role, password_hash FROM users WHERE LOWER(name)=LOWER(?) LIMIT 1', [username]);
    // @ts-ignore - mysql2 types
    const user = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!user) return res.status(404).json({ error: 'Benutzer existiert nicht' });
    if (user.password_hash) {
      return res.status(400).json({ error: 'Passwort erforderlich' });
    }
    return res.json({ user: { id: user.id, name: user.name, role: user.role }, needsPassword: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Password login for users who have already set a password
router.post('/login-password', async (req, res) => {
  const parse = PasswordLoginSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { username, password } = parse.data;
  try {
    const [rows] = await pool.query('SELECT id, name, role, password_hash FROM users WHERE LOWER(name)=LOWER(?) LIMIT 1', [username]);
    // @ts-ignore - mysql2 types
    const user = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    return res.json({ user: { id: user.id, name: user.name, role: user.role } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

// Set initial password: only allowed if user exists and has no password yet
router.post('/set-password', async (req, res) => {
  const parse = SetPasswordSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { username, password } = parse.data;
  try {
    const [rows] = await pool.query('SELECT id, name, role, password_hash FROM users WHERE LOWER(name)=LOWER(?) LIMIT 1', [username]);
    // @ts-ignore - mysql2 types
    const user = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!user) return res.status(404).json({ error: 'Benutzer existiert nicht' });
    if (user.password_hash) return res.status(400).json({ error: 'Passwort bereits gesetzt' });
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash=? WHERE id=?', [hash, user.id]);
    return res.json({ user: { id: user.id, name: user.name, role: user.role } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Passwort setzen fehlgeschlagen' });
  }
});

export default router;
