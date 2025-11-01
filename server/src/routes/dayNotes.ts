import { Router } from 'express';
import { pool } from '../db.js';
import { z } from 'zod';

const router = Router();

const QuerySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

// GET /api/day-notes?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/', async (req, res) => {
  const parse = QuerySchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { start, end } = parse.data;
  try {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date,
              note,
              admin_only AS adminOnly,
              approved,
              created_by AS createdBy,
              approved_by AS approvedBy,
              DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updatedAt
       FROM day_notes
       WHERE date BETWEEN ? AND ?
       ORDER BY date ASC`, [start, end]
    );
    // @ts-ignore
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list day notes' });
  }
});

const DateParamSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const UpsertSchema = z.object({
  note: z.string().min(0).max(1000),
  adminOnly: z.boolean().optional().default(false),
  approved: z.boolean().optional().default(false),
  createdBy: z.string().uuid().optional().nullable(),
  approvedBy: z.string().uuid().optional().nullable()
});

// PUT /api/day-notes/:date  -> upsert a note for date
router.put('/:date', async (req, res) => {
  const p = DateParamSchema.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: p.error.format() });
  const d = UpsertSchema.safeParse(req.body);
  if (!d.success) return res.status(400).json({ error: d.error.format() });
  const { date } = p.data;
  const { note, adminOnly, approved, createdBy, approvedBy } = d.data;
  try {
    await pool.query(
      `INSERT INTO day_notes (date, note, admin_only, approved, created_by, approved_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE note=VALUES(note), admin_only=VALUES(admin_only), approved=VALUES(approved), created_by=VALUES(created_by), approved_by=VALUES(approved_by)`,
      [date, note, adminOnly ? 1 : 0, approved ? 1 : 0, createdBy ?? null, approved ? (approvedBy ?? null) : null]
    );
    res.json({ date, note, adminOnly: !!adminOnly, approved: !!approved, createdBy: createdBy ?? null, approvedBy: approved ? (approvedBy ?? null) : null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to upsert day note' });
  }
});

// DELETE /api/day-notes/:date
router.delete('/:date', async (req, res) => {
  const p = DateParamSchema.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: p.error.format() });
  const { date } = p.data;
  try {
    await pool.query('DELETE FROM day_notes WHERE date=?', [date]);
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete day note' });
  }
});

export default router;
