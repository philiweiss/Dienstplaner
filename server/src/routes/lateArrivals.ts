import { Router } from 'express';
import { pool } from '../db.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const ReasonEnum = z.enum(['VERKEHR','ARZT','KIND_BETREUUNG','OEFFIS','WETTER','SONSTIGES']);

const ListSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// GET /api/late-arrivals?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/', async (req, res) => {
  const parse = ListSchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { start, end } = parse.data;
  try {
    const [rows]: any = await pool.query(
      `SELECT la.id,
              la.assignment_id as assignmentId,
              la.user_id as userId,
              DATE_FORMAT(a.date, '%Y-%m-%d') as date,
              a.shift_type_id as shiftTypeId,
              DATE_FORMAT(la.arrive_time, '%H:%i') as arriveTime,
              la.reason,
              la.note
       FROM late_arrivals la
       JOIN assignments a ON a.id = la.assignment_id
       WHERE a.date BETWEEN ? AND ?
       ORDER BY a.date ASC, la.arrive_time ASC`,
      [start, end]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list late arrivals' });
  }
});

const CreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftTypeId: z.string().min(1),
  userId: z.string().min(1),
  arriveTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:mm
  reason: ReasonEnum,
  note: z.string().max(500).optional().nullable(),
});

// POST /api/late-arrivals (auth required)
router.post('/', requireAuth, async (req, res) => {
  const parse = CreateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { date, shiftTypeId, userId, arriveTime, reason, note } = parse.data as { date: string; shiftTypeId: string; userId: string; arriveTime: string; reason: typeof ReasonEnum._type; note?: string | null };

  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'Admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Find assignment id
    const [aRows]: any = await pool.query('SELECT id FROM assignments WHERE date=? AND shift_type_id=? LIMIT 1', [date, shiftTypeId]);
    const assignmentId = aRows?.[0]?.id as string | undefined;
    if (!assignmentId) return res.status(404).json({ error: 'Assignment not found for date/shift' });

    // Ensure user is assigned to this assignment
    const [uRows]: any = await pool.query('SELECT 1 FROM assignment_users WHERE assignment_id=? AND user_id=? LIMIT 1', [assignmentId, userId]);
    if (!Array.isArray(uRows) || uRows.length === 0) return res.status(409).json({ error: 'User is not assigned to this shift' });

    // Upsert-like behavior: one per (assignment,user)
    const [existing]: any = await pool.query('SELECT id FROM late_arrivals WHERE assignment_id=? AND user_id=? LIMIT 1', [assignmentId, userId]);
    if (Array.isArray(existing) && existing.length) {
      const id = existing[0].id as string;
      await pool.query('UPDATE late_arrivals SET arrive_time=?, reason=?, note=? WHERE id=?', [arriveTime + ':00', reason, note ?? null, id]);
      return res.json({ id, assignmentId, userId, date, shiftTypeId, arriveTime, reason, note: note ?? null });
    }

    const id = randomUUID();
    await pool.query('INSERT INTO late_arrivals (id, assignment_id, user_id, arrive_time, reason, note) VALUES (?,?,?,?,?,?)', [id, assignmentId, userId, arriveTime + ':00', reason, note ?? null]);
    res.status(201).json({ id, assignmentId, userId, date, shiftTypeId, arriveTime, reason, note: note ?? null });
  } catch (e: any) {
    console.error(e);
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Late arrival already exists for this user and shift' });
    }
    res.status(500).json({ error: 'Failed to create late arrival' });
  }
});

// DELETE /api/late-arrivals/:id (auth required)
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params as { id: string };
  try {
    const [rows]: any = await pool.query('SELECT user_id as userId FROM late_arrivals WHERE id=? LIMIT 1', [id]);
    const ownerId = rows?.[0]?.userId as string | undefined;
    if (!ownerId) return res.status(404).json({ error: 'Not found' });
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'Admin' && req.user.id !== ownerId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM late_arrivals WHERE id=?', [id]);
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete late arrival' });
  }
});

export default router;
