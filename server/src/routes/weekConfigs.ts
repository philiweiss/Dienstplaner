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
      [rows] = await pool.query('SELECT year, week_number AS weekNumber, status FROM week_configs WHERE year=? ORDER BY week_number ASC', [year]);
    } else {
      [rows] = await pool.query('SELECT year, week_number AS weekNumber, status FROM week_configs ORDER BY year DESC, week_number DESC');
    }
    // @ts-ignore
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list week configs' });
  }
});

const UpdateSchema = z.object({
  year: z.number().int(),
  weekNumber: z.number().int().min(1).max(53),
  status: z.enum(['Gesperrt','Offen'])
});

router.put('/', async (req, res) => {
  const parse = UpdateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { year, weekNumber, status } = parse.data;
  try {
    await pool.query(
      'INSERT INTO week_configs (year, week_number, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status=VALUES(status)',
      [year, weekNumber, status]
    );
    res.json({ year, weekNumber, status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update week config' });
  }
});

export default router;
