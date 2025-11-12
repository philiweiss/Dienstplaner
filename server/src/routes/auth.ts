import { Router } from 'express';
import { pool } from '../db.js';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { signToken, requireAuth } from '../middleware/auth.js';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { randomUUID, randomBytes } from 'crypto';

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
    // Initialize last_seen_changes_at as baseline for unread indicator
    try { await pool.query('UPDATE users SET last_seen_changes_at = NOW(), last_login_at = NOW() WHERE id=?', [user.id]); } catch (_) {}
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
    const token = signToken({ id: user.id, name: user.name, role: user.role });
    try { await pool.query('UPDATE users SET last_seen_changes_at = NOW(), last_login_at = NOW() WHERE id=?', [user.id]); } catch (_) {}
    return res.json({ user: { id: user.id, name: user.name, role: user.role }, token });
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
    const token = signToken({ id: user.id, name: user.name, role: user.role });
    return res.json({ user: { id: user.id, name: user.name, role: user.role }, token });
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

// WebAuthn Passkey implementation
const RP_ID = process.env.RP_ID;
const RP_NAME = process.env.RP_NAME || 'IT-Dienstplaner';
const RP_ORIGIN = process.env.RP_ORIGIN; // optional; if not provided, derive from request

// Simple in-memory challenge store (non-persistent; fine for dev)
const regChallenges = new Map<string, string>(); // key: userId -> challenge
const authChallenges = new Map<string, string>(); // key: userId -> challenge

function getOrigin(req: any): string | null {
  if (RP_ORIGIN) return RP_ORIGIN;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString();
  if (!host) return null;
  return `${proto}://${host}`;
}

// Helper to convert binary to Base64URL string as required by @simplewebauthn types
function toBase64URL(data: Uint8Array | Buffer): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

router.post('/passkey/register/start', requireAuth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;
    const rpID = RP_ID || (req.hostname || '').split(':')[0];

    // Exclude existing credentials
    const [rows]: any = await pool.query('SELECT cred_id FROM webauthn_credentials WHERE user_id=?', [userId]);
    const excludeCredentials = (rows || []).map((r: any) => ({ id: Buffer.from(r.cred_id), type: 'public-key' as const }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: Buffer.from(userId),
      userName: req.user.name,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      excludeCredentials,
    });

    regChallenges.set(userId, options.challenge);
    res.json(options);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Passkey-Registrierung (Start) fehlgeschlagen' });
  }
});

router.post('/passkey/register/finish', requireAuth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;
    const expectedChallenge = regChallenges.get(userId);
    if (!expectedChallenge) return res.status(400).json({ error: 'Keine Challenge gefunden. Bitte erneut starten.' });

    const rpID = RP_ID || (req.hostname || '').split(':')[0];
    const origin = getOrigin(req);
    if (!origin) return res.status(400).json({ error: 'Origin konnte nicht ermittelt werden' });

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    const { verified, registrationInfo } = verification as any;
    if (!verified || !registrationInfo) return res.status(400).json({ error: 'Verifikation fehlgeschlagen' });

    const { credentialPublicKey, credentialID, counter, fmt, aaguid } = registrationInfo;

    await pool.query(
      'INSERT INTO webauthn_credentials (id, user_id, cred_id, public_key, counter, transports, aaguid, fmt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), userId, Buffer.from(credentialID), Buffer.from(credentialPublicKey), counter || 0, null, aaguid || null, fmt || null]
    );

    regChallenges.delete(userId);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Passkey-Registrierung (Abschluss) fehlgeschlagen' });
  }
});

// Start login with passkey: expects { username }
router.post('/passkey/login/start', async (req, res) => {
  try {
    const parse = UsernameSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.format() });
    const { username } = parse.data;
    const [rows] = await pool.query<UserRow[]>('SELECT id, name, role FROM users WHERE LOWER(name)=LOWER(?) LIMIT 1', [username]);
    const user: UserRow | null = Array.isArray(rows) && rows.length ? (rows[0] as UserRow) : null;
    if (!user) return res.status(404).json({ error: 'Benutzer existiert nicht' });

    const [creds]: any = await pool.query('SELECT cred_id FROM webauthn_credentials WHERE user_id=?', [user.id]);
    const allowCredentials = (creds || []).map((r: any) => ({ id: Buffer.from(r.cred_id), type: 'public-key' as const }));

    const rpID = RP_ID || (req.hostname || '').split(':')[0];
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    authChallenges.set(user.id, options.challenge);
    res.json({ ...options, userId: user.id, user: { id: user.id, name: user.name, role: user.role } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Passkey-Login (Start) fehlgeschlagen' });
  }
});

// Finish passkey login: expects { userId, credential }
router.post('/passkey/login/finish', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string().uuid(),
      credential: z.any(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.format() });
    const { userId, credential } = parse.data as any;

    const expectedChallenge = authChallenges.get(userId);
    if (!expectedChallenge) return res.status(400).json({ error: 'Keine Challenge gefunden. Bitte erneut starten.' });

    const [users] = await pool.query<UserRow[]>('SELECT id, name, role FROM users WHERE id=? LIMIT 1', [userId]);
    const user = Array.isArray(users) && users.length ? (users[0] as UserRow) : null;
    if (!user) return res.status(404).json({ error: 'Benutzer existiert nicht' });

    // Find authenticator by credential ID
    const credIdBuf = Buffer.from(credential.rawId ? Buffer.from(credential.rawId, 'base64url') : Buffer.alloc(0));
    const [creds]: any = await pool.query('SELECT cred_id, public_key, counter FROM webauthn_credentials WHERE user_id=? AND cred_id=? LIMIT 1', [userId, credIdBuf]);
    const cred = Array.isArray(creds) && creds.length ? creds[0] : null;
    if (!cred) return res.status(400).json({ error: 'Credential nicht gefunden' });

    const rpID = RP_ID || (req.hostname || '').split(':')[0];
    const origin = getOrigin(req);
    if (!origin) return res.status(400).json({ error: 'Origin konnte nicht ermittelt werden' });

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: toBase64URL(Buffer.from(cred.cred_id)),
        credentialPublicKey: Buffer.from(cred.public_key),
        counter: Number(cred.counter) || 0,
        transports: undefined,
      },
    });

    const { verified, authenticationInfo } = verification as any;
    if (!verified || !authenticationInfo) return res.status(401).json({ error: 'Verifikation fehlgeschlagen' });

    // Update signature counter
    await pool.query('UPDATE webauthn_credentials SET counter=? WHERE user_id=? AND cred_id=?', [authenticationInfo.newCounter || authenticationInfo.counter || 0, userId, Buffer.from(cred.cred_id)]);

    const token = signToken({ id: user.id, name: user.name, role: user.role });
    try { await pool.query('UPDATE users SET last_seen_changes_at = NOW(), last_login_at = NOW() WHERE id=?', [user.id]); } catch (_) {}

    authChallenges.delete(userId);
    res.json({ user: { id: user.id, name: user.name, role: user.role }, token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Passkey-Login (Abschluss) fehlgeschlagen' });
  }
});

// MAGIC LINKS
router.post('/magic/start', async (req, res) => {
  try {
    const parse = UsernameSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.format() });
    const { username } = parse.data;
    const [rows] = await pool.query<UserRow[]>('SELECT id, name, role, password_hash FROM users WHERE LOWER(name)=LOWER(?) LIMIT 1', [username]);
    const user: UserRow | null = Array.isArray(rows) && rows.length ? (rows[0] as UserRow) : null;
    if (!user) return res.status(404).json({ error: 'Benutzer existiert nicht' });

    // Generate token
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await pool.query('INSERT INTO magic_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)', [randomUUID(), user.id, token, expiresAt]);

    const origin = getOrigin(req);
    const devLink = origin ? `${origin}/?magic=${encodeURIComponent(token)}` : null;

    // TODO: Send email if SMTP configured; for now, return devLink so user can copy
    return res.json({ ok: true, devLink });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Magic Link Erzeugung fehlgeschlagen' });
  }
});

router.post('/magic/verify', async (req, res) => {
  try {
    const parse = z.object({ token: z.string().min(10) }).safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.format() });
    const { token } = parse.data;

    const now = new Date();
    const [rows]: any = await pool.query(
      'SELECT mt.user_id, u.name, u.role FROM magic_tokens mt JOIN users u ON u.id=mt.user_id WHERE mt.token=? AND mt.used_at IS NULL AND mt.expires_at > ? LIMIT 1',
      [token, now]
    );
    const entry = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!entry) return res.status(400).json({ error: 'Token ungültig oder abgelaufen' });

    // Mark as used
    await pool.query('UPDATE magic_tokens SET used_at = NOW() WHERE token=?', [token]);

    const jwt = signToken({ id: entry.user_id, name: entry.name, role: entry.role });
    try { await pool.query('UPDATE users SET last_seen_changes_at = NOW(), last_login_at = NOW() WHERE id=?', [entry.user_id]); } catch (_) {}

    return res.json({ user: { id: entry.user_id, name: entry.name, role: entry.role }, token: jwt });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Magic Link Verifikation fehlgeschlagen' });
  }
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

// ADMIN: Delete password (set to NULL) so user must set a new one on next login
router.post('/admin/delete-password', async (req, res) => {
  const schema = z.object({
    userId: z.string().uuid(),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { userId } = parse.data;
  try {
    const [rows] = await pool.query<UserPwdRow[]>('SELECT id FROM users WHERE id=? LIMIT 1', [userId]);
    const user: UserPwdRow | null = Array.isArray(rows) && rows.length ? (rows[0] as UserPwdRow) : null;
    if (!user) return res.status(404).json({ error: 'Benutzer existiert nicht' });
    await pool.query('UPDATE users SET password_hash=NULL WHERE id=?', [userId]);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Passwort löschen fehlgeschlagen' });
  }
});

export default router;
