import { Router } from 'express';
import { pool } from '../db.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

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
      `SELECT id, user_id AS userId, DATE_FORMAT(date, '%Y-%m-%d') AS date, type, note
       FROM absences
       WHERE date BETWEEN ? AND ?
       ORDER BY date ASC`,
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
      `SELECT id, user_id AS userId, DATE_FORMAT(date, '%Y-%m-%d') AS date, type, note
       FROM absences
       WHERE user_id = ? AND date BETWEEN ? AND ?
       ORDER BY date ASC`,
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
  type: z.enum(['VACATION', 'SEMINAR']),
  note: z.string().max(500).optional().nullable(),
});

// POST /api/absences
router.post('/', async (req, res) => {
  const parse = CreateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { userId, date, type, note } = parse.data;
  const id = randomUUID();
  try {
    // Conflict: user already assigned on this date
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

    await pool.query(
      'INSERT INTO absences (id, user_id, date, type, note) VALUES (?, ?, ?, ?, ?)',
      [id, userId, date, type, note ?? null]
    );
    res.status(201).json({ id, userId, date, type, note: note ?? null });
  } catch (e: any) {
    console.error(e);
    // Handle duplicate
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Absence already exists for this user and date' });
    }
    res.status(500).json({ error: 'Failed to create absence' });
  }
});

// DELETE /api/absences/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params as { id: string };
  try {
    const [result]: any = await pool.query('DELETE FROM absences WHERE id=?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Absence not found' });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete absence' });
  }
});

export default router;
