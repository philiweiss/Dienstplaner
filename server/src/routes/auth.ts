import { Router } from 'express';
import { pool } from '../db.js';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const router = Router();

interface UserRow extends RowDataPacket {
  id: string;
  name: string;
  role: 'User' | 'Admin';
  password_hash: string | null;
}

interface UserPwdRow extends RowDataPacket {
  id: string;
  password_hash: string | null;
}

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
    const [rows] = await pool.query<UserRow[]>('SELECT id, name, role, password_hash FROM users WHERE LOWER(name)=LOWER(?) LIMIT 1', [username]);
    const user: UserRow | null = Array.isArray(rows) && rows.length ? (rows[0] as UserRow) : null;
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
    const [rows] = await pool.query<UserRow[]>('SELECT id, name, role, password_hash FROM users WHERE LOWER(name)=LOWER(?) LIMIT 1', [username]);
    const user: UserRow | null = Array.isArray(rows) && rows.length ? (rows[0] as UserRow) : null;
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
    const [rows] = await pool.query<UserRow[]>('SELECT id, name, role, password_hash FROM users WHERE LOWER(name)=LOWER(?) LIMIT 1', [username]);
    const user: UserRow | null = Array.isArray(rows) && rows.length ? (rows[0] as UserRow) : null;
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
    const [rows] = await pool.query<UserRow[]>('SELECT id, name, role, password_hash FROM users WHERE LOWER(name)=LOWER(?) LIMIT 1', [username]);
    const user: UserRow | null = Array.isArray(rows) && rows.length ? (rows[0] as UserRow) : null;
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

// Change password for existing user (requires current password)
router.post('/change-password', async (req, res) => {
  const schema = z.object({
    username: z.string().min(1),
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8)
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { username, currentPassword, newPassword } = parse.data;
  try {
    const [rows] = await pool.query<UserPwdRow[]>('SELECT id, password_hash FROM users WHERE LOWER(name)=LOWER(?) LIMIT 1', [username]);
    const user: UserPwdRow | null = Array.isArray(rows) && rows.length ? (rows[0] as UserPwdRow) : null;
    if (!user || !user.password_hash) return res.status(400).json({ error: 'Benutzer oder Passwort ungültig' });
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Benutzer oder Passwort ungültig' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash=? WHERE id=?', [hash, user.id]);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Passwort ändern fehlgeschlagen' });
  }
});

// WebAuthn passkey registration stubs (to be implemented)
router.post('/passkey/register/start', async (_req, res) => {
  // TODO: Implement proper WebAuthn options generation and session binding
  res.json({ ok: true, message: 'WebAuthn-Registrierung bald verfügbar' });
});

router.post('/passkey/register/finish', async (_req, res) => {
  // TODO: Implement proper WebAuthn attestation verification and storage
  res.json({ ok: true, message: 'WebAuthn-Registrierung bald verfügbar' });
});

// ADMIN: Reset password for a user (temporary: not protected yet)
// WARNING: This endpoint must be protected by admin authentication in production.
router.post('/admin/reset-password', async (req, res) => {
  const schema = z.object({
    userId: z.string().uuid().optional(),
    username: z.string().min(1).optional(),
    newPassword: z.string().min(8)
  }).refine(d => !!d.userId || !!d.username, {
    message: 'userId oder username erforderlich',
    path: ['userId']
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { userId, username, newPassword } = parse.data;
  try {
    let user: UserRow | null = null;
    if (userId) {
      const [rows] = await pool.query<UserRow[]>('SELECT id, name, role, password_hash FROM users WHERE id=? LIMIT 1', [userId]);
      user = Array.isArray(rows) && rows.length ? (rows[0] as UserRow) : null;
    } else if (username) {
      const [rows] = await pool.query<UserRow[]>('SELECT id, name, role, password_hash FROM users WHERE LOWER(name)=LOWER(?) LIMIT 1', [username]);
      user = Array.isArray(rows) && rows.length ? (rows[0] as UserRow) : null;
    }
    if (!user) return res.status(404).json({ error: 'Benutzer existiert nicht' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash=? WHERE id=?', [hash, user.id]);
    return res.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Admin Passwort-Reset fehlgeschlagen' });
  }
});

export default router;
