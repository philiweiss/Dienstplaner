import { Router } from 'express';
import { pool } from '../db.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, role, DATE_FORMAT(birthday, "%Y-%m-%d") as birthday, DATE_FORMAT(anniversary, "%Y-%m-%d") as anniversary FROM users ORDER BY name ASC');
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

export default router;
