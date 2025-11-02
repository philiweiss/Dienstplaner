import { Router } from 'express';
import { pool } from '../db.js';
import { z } from 'zod';

const router = Router();

// Get statistics for a given user
// GET /api/stats/user/:id
router.get('/user/:id', async (req, res) => {
  const schema = z.object({ id: z.string().min(1) });
  const parse = schema.safeParse(req.params);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { id } = parse.data;

  try {
    // Total shifts for user
    const [[{ total }]]: any = await pool.query(
      `SELECT COUNT(*) AS total
       FROM assignment_users au
       JOIN assignments a ON a.id = au.assignment_id
       WHERE au.user_id = ?`,
      [id]
    );

    // Counts per shift type
    const [rows]: any = await pool.query(
      `SELECT st.id AS shiftTypeId,
              st.name AS shiftTypeName,
              st.color AS shiftTypeColor,
              COUNT(*) AS count
       FROM assignment_users au
       JOIN assignments a ON a.id = au.assignment_id
       JOIN shift_types st ON st.id = a.shift_type_id
       WHERE au.user_id = ?
       GROUP BY st.id, st.name, st.color
       ORDER BY st.start_time ASC`,
      [id]
    );

    // Last shift date (most recent past or upcoming)
    const [[{ lastDate }]]: any = await pool.query(
      `SELECT DATE_FORMAT(MAX(a.date), '%Y-%m-%d') AS lastDate
       FROM assignment_users au
       JOIN assignments a ON a.id = au.assignment_id
       WHERE au.user_id = ?`,
      [id]
    );

    res.json({
      userId: id,
      total: Number(total) || 0,
      byShiftType: rows?.map((r: any) => ({
        shiftTypeId: r.shiftTypeId,
        name: r.shiftTypeName,
        color: r.shiftTypeColor,
        count: Number(r.count) || 0,
      })) || [],
      lastDate: lastDate || null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// Weekly stats: totals (and optional per-shift-type breakdown) per ISO week between start and end dates
// GET /api/stats/weekly?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/weekly', async (req, res) => {
  const schema = z.object({
    start: z.string().regex(/\d{4}-\d{2}-\d{2}/),
    end: z.string().regex(/\d{4}-\d{2}-\d{2}/),
  });
  const parse = schema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { start, end } = parse.data as any;

  try {
    // Totals per ISO week
    const [totals]: any = await pool.query(
      `SELECT YEARWEEK(a.date, 3) AS yw,
              YEAR(a.date) AS year,
              WEEK(a.date, 3) AS week,
              COUNT(*) AS total
       FROM assignments a
       WHERE a.date BETWEEN ? AND ?
       GROUP BY YEARWEEK(a.date, 3), YEAR(a.date), WEEK(a.date, 3)
       ORDER BY YEAR(a.date), WEEK(a.date, 3)`,
      [start, end]
    );

    // Breakdown per shift type per week
    const [byShiftType]: any = await pool.query(
      `SELECT YEARWEEK(a.date, 3) AS yw,
              YEAR(a.date) AS year,
              WEEK(a.date, 3) AS week,
              st.id AS shiftTypeId,
              st.name AS shiftTypeName,
              st.color AS shiftTypeColor,
              COUNT(*) AS count
       FROM assignments a
       JOIN shift_types st ON st.id = a.shift_type_id
       WHERE a.date BETWEEN ? AND ?
       GROUP BY YEARWEEK(a.date, 3), YEAR(a.date), WEEK(a.date, 3), st.id, st.name, st.color
       ORDER BY YEAR(a.date), WEEK(a.date, 3), st.start_time`,
      [start, end]
    );

    const result = (totals as any[]).map(t => ({
      year: Number(t.year),
      week: Number(t.week),
      total: Number(t.total),
      byShiftType: [] as any[],
    }));

    const index = new Map<number, any>();
    for (const r of result) index.set(r.year * 100 + r.week, r);
    for (const r of byShiftType as any[]) {
      const key = Number(r.year) * 100 + Number(r.week);
      const entry = index.get(key);
      if (entry) {
        entry.byShiftType.push({
          shiftTypeId: r.shiftTypeId,
          name: r.shiftTypeName,
          color: r.shiftTypeColor,
          count: Number(r.count) || 0,
        });
      }
    }

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load weekly stats' });
  }
});

export default router;
