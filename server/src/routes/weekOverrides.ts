import { Router } from 'express';
import { pool } from '../db.js';
import { z } from 'zod';

const router = Router();

// List all or by year
router.get('/', async (req, res) => {
  const YearSchema = z.object({ year: z.coerce.number().int().optional() });
  const parse = YearSchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { year } = parse.data;
  try {
    let rows;
    if (year) {
      [rows] = await pool.query(
        'SELECT year, week_number AS weekNumber, shift_type_id AS shiftTypeId, min_users AS minUsers, max_users AS maxUsers FROM week_shift_overrides WHERE year=? ORDER BY week_number ASC',
        [year]
      );
    } else {
      [rows] = await pool.query(
        'SELECT year, week_number AS weekNumber, shift_type_id AS shiftTypeId, min_users AS minUsers, max_users AS maxUsers FROM week_shift_overrides ORDER BY year DESC, week_number DESC'
      );
    }
    // @ts-ignore
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list week overrides' });
  }
});

const UpdateSchema = z.object({
  year: z.number().int(),
  weekNumber: z.number().int().min(1).max(53),
  shiftTypeId: z.string().min(1),
  minUsers: z.number().int().min(0).optional(),
  maxUsers: z.number().int().min(0).optional(),
}).refine((d) => d.minUsers !== undefined || d.maxUsers !== undefined, { message: 'At least one of minUsers or maxUsers must be provided' })
  .refine((d) => (d.minUsers === undefined || d.maxUsers === undefined) || (d.maxUsers! >= d.minUsers!), { message: 'maxUsers must be >= minUsers' });

router.put('/', async (req, res) => {
  const parse = UpdateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { year, weekNumber, shiftTypeId, minUsers, maxUsers } = parse.data;
  try {
    await pool.query(
      'INSERT INTO week_shift_overrides (year, week_number, shift_type_id, min_users, max_users) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE min_users=VALUES(min_users), max_users=VALUES(max_users)',
      [year, weekNumber, shiftTypeId, minUsers ?? null, maxUsers ?? null]
    );
    res.json({ year, weekNumber, shiftTypeId, minUsers, maxUsers });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update week override' });
  }
});

export default router;
