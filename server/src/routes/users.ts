import { Router } from 'express';
import { pool } from '../db.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name, role, DATE_FORMAT(birthday, '%Y-%m-%d') as birthday, DATE_FORMAT(anniversary, '%Y-%m-%d') as anniversary, DATE_FORMAT(last_login_at, '%Y-%m-%d %H:%i:%s') as lastLogin, (password_hash IS NOT NULL) AS hasPassword FROM users ORDER BY name ASC");
    // @ts-ignore
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

const CreateUserSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['User','Admin']).default('User'),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  anniversary: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

router.post('/', async (req, res) => {
  const parse = CreateUserSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const id = randomUUID();
  const { name, role, birthday, anniversary } = parse.data;
  try {
    await pool.query('INSERT INTO users (id, name, role, birthday, anniversary) VALUES (?, ?, ?, ?, ?)', [id, name, role, birthday ?? null, anniversary ?? null]);
    res.status(201).json({ id, name, role, birthday: birthday ?? null, anniversary: anniversary ?? null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['User','Admin']).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  anniversary: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const parse = UpdateUserSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const fields = parse.data;
  try {
    if (Object.keys(fields).length === 0) return res.status(400).json({ error: 'No fields to update' });
    const sets: string[] = [];
    const values: any[] = [];
    if (fields.name !== undefined) { sets.push('name=?'); values.push(fields.name); }
    if (fields.role !== undefined) { sets.push('role=?'); values.push(fields.role); }
    if (fields.birthday !== undefined) { sets.push('birthday=?'); values.push(fields.birthday ?? null); }
    if (fields.anniversary !== undefined) { sets.push('anniversary=?'); values.push(fields.anniversary ?? null); }
    values.push(id);
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id=?`, values);
    res.json({ id, ...fields });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id=?', [id]);
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Upcoming shifts for a user
router.get('/:id/next-shifts', async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || '5'), 10) || 5));
  try {
    const [rows]: any = await pool.query(
      `SELECT DATE_FORMAT(a.date, '%Y-%m-%d') AS date,
              st.id AS shiftTypeId,
              st.name AS shiftName,
              TIME_FORMAT(st.start_time, '%H:%i') AS startTime,
              TIME_FORMAT(st.end_time, '%H:%i') AS endTime
       FROM assignment_users au
       JOIN assignments a ON a.id = au.assignment_id
       JOIN shift_types st ON st.id = a.shift_type_id
       WHERE au.user_id = ? AND a.date >= CURDATE()
       ORDER BY a.date ASC, st.start_time ASC
       LIMIT ?`,
      [id, limit]
    );
    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to load next shifts' });
  }
});

export default router;
