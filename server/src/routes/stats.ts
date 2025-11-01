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

export default router;
