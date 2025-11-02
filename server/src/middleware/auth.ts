import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { pool } from '../db.js';

const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';

interface TokenPayload {
  id: string;
  name: string;
  role: 'User' | 'Admin';
  exp: number; // unix seconds
}

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function signToken(user: { id: string; name: string; role: 'User' | 'Admin' }, ttlSeconds = 60 * 60 * 24 * 7): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: TokenPayload = { id: user.id, name: user.name, role: user.role, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const sig = createHmac('sha256', AUTH_SECRET).update(unsigned).digest();
  return `${unsigned}.${base64url(sig)}`;
}

function verifyAndDecode(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = createHmac('sha256', AUTH_SECRET).update(`${h}.${p}`).digest();
  const sig = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  // pad base64
  const pad = 4 - (sig.length % 4);
  const padded = Buffer.from((s + (pad < 4 ? '='.repeat(pad) : '')).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (expected.length !== padded.length || !timingSafeEqual(expected, padded)) return null;
  try {
    const payload = JSON.parse(Buffer.from(p, 'base64').toString('utf8')) as TokenPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; name: string; role: 'User' | 'Admin' };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ error: 'Unauthorized' });
  const payload = verifyAndDecode(m[1]);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  req.user = { id: payload.id, name: payload.name, role: payload.role };
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}
