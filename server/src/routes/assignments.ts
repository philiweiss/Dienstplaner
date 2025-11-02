import { Router } from 'express';
import { pool } from '../db.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const router = Router();

const ListSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

// GET /api/assignments?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/', async (req, res) => {
  const parse = ListSchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { start, end } = parse.data;
  try {
    const [rows] = await pool.query(
      `SELECT a.id, DATE_FORMAT(a.date, '%Y-%m-%d') AS date, a.shift_type_id AS shiftTypeId,
              GROUP_CONCAT(au.user_id) AS userIds
       FROM assignments a
       LEFT JOIN assignment_users au ON au.assignment_id = a.id
       WHERE a.date BETWEEN ? AND ?
       GROUP BY a.id, a.date, a.shift_type_id
       ORDER BY a.date ASC`, [start, end]
    );
    // @ts-ignore
    const data = (rows as any[]).map(r => ({
      id: r.id,
      date: r.date,
      shiftTypeId: r.shiftTypeId,
      userIds: r.userIds ? (r.userIds as string).split(',') : []
    }));
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list assignments' });
  }
});

const AssignSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftTypeId: z.string().min(1),
  userId: z.string().min(1),
  allowOverbook: z.boolean().optional(),
  adminId: z.string().min(1).optional()
});

// POST /api/assignments/assign
router.post('/assign', async (req, res) => {
  const parse = AssignSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { date, shiftTypeId, userId, allowOverbook, adminId } = parse.data;
  try {
    // Conflict: user has an absence on this date
    const [abs]: any = await pool.query('SELECT 1 FROM absences WHERE user_id=? AND date=? LIMIT 1', [userId, date]);
    if (Array.isArray(abs) && abs.length) {
      return res.status(409).json({ error: 'User is marked absent on this date' });
    }

    // Ensure assignment exists
    const [existing] = await pool.query('SELECT id FROM assignments WHERE date=? AND shift_type_id=? LIMIT 1', [date, shiftTypeId]);
    // @ts-ignore
    let assignmentId = Array.isArray(existing) && existing.length ? existing[0].id : null;
    if (!assignmentId) {
      assignmentId = randomUUID();
      await pool.query('INSERT INTO assignments (id, date, shift_type_id) VALUES (?, ?, ?)', [assignmentId, date, shiftTypeId]);
    }

    // Load capacity
    const [[{ max_users }]]: any = await pool.query('SELECT max_users FROM shift_types WHERE id=? LIMIT 1', [shiftTypeId]);
    const maxUsers = Number(max_users);

    // Current occupancy
    const [[{ count }]]: any = await pool.query('SELECT COUNT(*) AS count FROM assignment_users WHERE assignment_id=?', [assignmentId]);

    let isAdmin = false;
    let canOverbook = false;
    if (allowOverbook) {
      if (!adminId) {
        return res.status(403).json({ error: 'Admin privileges required for overbooking' });
      }
      const [adminRows]: any = await pool.query('SELECT role FROM users WHERE id=? LIMIT 1', [adminId]);
      const role = adminRows?.[0]?.role;
      if (role !== 'Admin') {
        return res.status(403).json({ error: 'Admin privileges required for overbooking' });
      }
      isAdmin = true;
      canOverbook = true;
    }

    // Enforce capacity for non-admins
    if (!canOverbook && count >= maxUsers) {
      return res.status(409).json({ error: 'Shift is at capacity' });
    }

    // Add user if not already
    await pool.query('INSERT IGNORE INTO assignment_users (assignment_id, user_id) VALUES (?, ?)', [assignmentId, userId]);

    // Recompute occupancy to determine overbooked flag
    const [[{ count: newCount }]]: any = await pool.query('SELECT COUNT(*) AS count FROM assignment_users WHERE assignment_id=?', [assignmentId]);
    const overbooked = newCount > maxUsers;

    res.status(200).json({ date, shiftTypeId, userId, overbooked });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to assign user' });
  }
});

// POST /api/assignments/unassign
router.post('/unassign', async (req, res) => {
  const parse = AssignSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { date, shiftTypeId, userId } = parse.data;
  try {
    const [existing] = await pool.query('SELECT id FROM assignments WHERE date=? AND shift_type_id=? LIMIT 1', [date, shiftTypeId]);
    // @ts-ignore
    const assignmentId = Array.isArray(existing) && existing.length ? existing[0].id : null;
    if (!assignmentId) return res.status(404).json({ error: 'Assignment not found' });

    await pool.query('DELETE FROM assignment_users WHERE assignment_id=? AND user_id=?', [assignmentId, userId]);

    // Optionally cleanup empty assignment rows
    await pool.query('DELETE a FROM assignments a LEFT JOIN assignment_users au ON au.assignment_id=a.id WHERE a.id=? AND au.assignment_id IS NULL', [assignmentId]);

    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to unassign user' });
  }
});

export default router;
