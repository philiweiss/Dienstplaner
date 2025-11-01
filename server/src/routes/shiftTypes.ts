import { Router } from 'express';
import { pool } from '../db.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, TIME_FORMAT(start_time, "%H:%i") AS startTime, TIME_FORMAT(end_time, "%H:%i") AS endTime, color, min_users AS minUsers, max_users AS maxUsers FROM shift_types ORDER BY start_time ASC');
    // @ts-ignore
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list shift types' });
  }
});

const BaseShiftType = z.object({
  name: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  color: z.string().min(1),
  minUsers: z.number().int().min(0),
  maxUsers: z.number().int().min(0)
});
const ShiftTypeSchema = BaseShiftType.refine((d) => d.maxUsers >= d.minUsers, { message: 'maxUsers must be >= minUsers', path: ['maxUsers']});

router.post('/', async (req, res) => {
  const parse = ShiftTypeSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const id = randomUUID();
  const { name, startTime, endTime, color, minUsers, maxUsers } = parse.data;
  try {
    await pool.query('INSERT INTO shift_types (id, name, start_time, end_time, color, min_users, max_users) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, name, startTime, endTime, color, minUsers, maxUsers]);
    res.status(201).json({ id, name, startTime, endTime, color, minUsers, maxUsers });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create shift type' });
  }
});

const UpdateShiftTypeSchema = BaseShiftType.partial();

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const parse = UpdateShiftTypeSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const fields = parse.data;
  try {
    if (Object.keys(fields).length === 0) return res.status(400).json({ error: 'No fields to update' });
    const sets: string[] = [];
    const values: any[] = [];
    if (fields.name !== undefined) { sets.push('name=?'); values.push(fields.name); }
    if (fields.startTime !== undefined) { sets.push('start_time=?'); values.push(fields.startTime); }
    if (fields.endTime !== undefined) { sets.push('end_time=?'); values.push(fields.endTime); }
    if (fields.color !== undefined) { sets.push('color=?'); values.push(fields.color); }
    if (fields.minUsers !== undefined) { sets.push('min_users=?'); values.push(fields.minUsers); }
    if (fields.maxUsers !== undefined) { sets.push('max_users=?'); values.push(fields.maxUsers); }
    values.push(id);
    await pool.query(`UPDATE shift_types SET ${sets.join(', ')} WHERE id=?`, values);
    res.json({ id, ...fields });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update shift type' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM shift_types WHERE id=?', [id]);
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete shift type' });
  }
});

export default router;
