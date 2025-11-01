import { Router } from 'express';
import { pool } from '../db.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const router = Router();

const LoginSchema = z.object({
  username: z.string().min(1),
});

// Very simple username-only login for demo purposes
router.post('/login', async (req, res) => {
  const parse = LoginSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { username } = parse.data;

  try {
    const [rows] = await pool.query('SELECT id, name, role FROM users WHERE LOWER(name)=LOWER(?) LIMIT 1', [username]);
    // @ts-ignore - mysql2 types
    const user = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (user) return res.json({ user });

    const id = randomUUID();
    const role = 'User';
    await pool.query('INSERT INTO users (id, name, role) VALUES (?, ?, ?)', [id, username, role]);
    return res.json({ user: { id, name: username, role } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
