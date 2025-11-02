import { Router } from 'express';
import { pool } from '../db.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const ListSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// GET /api/absences?start=YYYY-MM-DD&end=YYYY-MM-DD (all users)
router.get('/', async (req, res) => {
  const parse = ListSchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { start, end } = parse.data;
  try {
    const [rows]: any = await pool.query(
      `SELECT a.id, a.user_id AS userId, DATE_FORMAT(a.date, '%Y-%m-%d') AS date, a.type, a.part, a.note, u.name AS userName
       FROM absences a
       JOIN users u ON u.id = a.user_id
       WHERE a.date BETWEEN ? AND ?
       ORDER BY a.date ASC`,
      [start, end]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list absences' });
  }
});

// GET /api/absences/user/:userId?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params as { userId: string };
  const parse = ListSchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { start, end } = parse.data;
  try {
    const [rows]: any = await pool.query(
      `SELECT a.id, a.user_id AS userId, DATE_FORMAT(a.date, '%Y-%m-%d') AS date, a.type, a.part, a.note, u.name AS userName
       FROM absences a
       JOIN users u ON u.id = a.user_id
       WHERE a.user_id = ? AND a.date BETWEEN ? AND ?
       ORDER BY a.date ASC`,
      [userId, start, end]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list user absences' });
  }
});

const CreateSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['VACATION', 'SEMINAR', 'SICK']),
  part: z.enum(['FULL','AM','PM']).optional().default('FULL'),
  note: z.string().max(500).optional().nullable(),
});

// POST /api/absences (auth required)
router.post('/', requireAuth, async (req, res) => {
  const parse = CreateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { userId, date, type, part, note } = parse.data as { userId: string; date: string; type: 'VACATION'|'SEMINAR'|'SICK'; part: 'FULL'|'AM'|'PM'; note?: string|null };
  const id = randomUUID();
  try {
    // Authorization: user can create only for self unless Admin
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'Admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Conflict rules
    if (type !== 'SICK') {
      const [rows]: any = await pool.query(
        `SELECT 1
         FROM assignment_users au
         JOIN assignments a ON a.id = au.assignment_id
         WHERE au.user_id = ? AND a.date = ?
         LIMIT 1`, [userId, date]
      );
      if (Array.isArray(rows) && rows.length) {
        return res.status(409).json({ error: 'User is already assigned to a shift on this date' });
      }
    }

    await pool.query(
      'INSERT INTO absences (id, user_id, date, type, part, note) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, date, type, part ?? 'FULL', note ?? null]
    );
    res.status(201).json({ id, userId, date, type, part: part ?? 'FULL', note: note ?? null });
  } catch (e: any) {
    console.error(e);
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Absence already exists for this user and date' });
    }
    res.status(500).json({ error: 'Failed to create absence' });
  }
});

// DELETE /api/absences/:id (auth required)
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params as { id: string };
  try {
    // Load absence owner
    const [rows]: any = await pool.query('SELECT user_id AS userId FROM absences WHERE id=? LIMIT 1', [id]);
    const ownerId = rows?.[0]?.userId as string | undefined;
    if (!ownerId) return res.status(404).json({ error: 'Absence not found' });
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'Admin' && req.user.id !== ownerId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await pool.query('DELETE FROM absences WHERE id=?', [id]);
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete absence' });
  }
});

// POST /api/absences/range (auth required)
const RangeSchema = z.object({
  userId: z.string().min(1),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['VACATION', 'SEMINAR', 'SICK']),
  part: z.enum(['FULL','AM','PM']).optional().default('FULL'),
  note: z.string().max(500).optional().nullable(),
});

router.post('/range', requireAuth, async (req, res) => {
  const parse = RangeSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { userId, start, end, type, part, note } = parse.data as { userId: string; start: string; end: string; type: 'VACATION'|'SEMINAR'|'SICK'; part: 'FULL'|'AM'|'PM'; note?: string|null };

  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'Admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const dStart = new Date(start + 'T00:00:00Z');
    const dEnd = new Date(end + 'T00:00:00Z');
    if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime()) || dEnd < dStart) {
      return res.status(400).json({ error: 'Invalid date range' });
    }
    // cap range to 366 days
    const maxDays = 366;
    const created: any[] = [];
    const skipped: any[] = [];
    const cur = new Date(dStart);
    while (cur <= dEnd && created.length + skipped.length < maxDays) {
      const date = cur.toISOString().slice(0,10);
      try {
        if (type !== 'SICK') {
          const [rows]: any = await pool.query(
            `SELECT 1 FROM assignment_users au JOIN assignments a ON a.id = au.assignment_id WHERE au.user_id=? AND a.date=? LIMIT 1`,
            [userId, date]
          );
          if (Array.isArray(rows) && rows.length) {
            skipped.push({ date, reason: 'ASSIGNED' });
            cur.setUTCDate(cur.getUTCDate() + 1);
            continue;
          }
        }
        const id = randomUUID();
        await pool.query(
          'INSERT INTO absences (id, user_id, date, type, part, note) VALUES (?, ?, ?, ?, ?, ?)',
          [id, userId, date, type, part ?? 'FULL', note ?? null]
        );
        created.push({ id, userId, date, type, part: part ?? 'FULL', note: note ?? null });
      } catch (e: any) {
        if (e?.code === 'ER_DUP_ENTRY') {
          skipped.push({ date, reason: 'DUPLICATE' });
        } else {
          skipped.push({ date, reason: 'ERROR' });
        }
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    res.json({ created, skipped });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create absence range' });
  }
});

export default router;
