import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// All routes require auth (we only use user id to store last seen timestamp)
router.use(requireAuth);

// GET /api/changes/unread-count
// Returns { count } = number of changes since user's last_seen_changes_at
router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user!.id;
    // last seen timestamp
    const [[userRow]]: any = await pool.query(
      'SELECT last_seen_changes_at AS lastSeen FROM users WHERE id=? LIMIT 1',
      [userId]
    );
    const lastSeen: string | null = userRow?.lastSeen ?? null;

    let sql = 'SELECT COUNT(*) AS cnt FROM shift_changes';
    const params: any[] = [];
    if (lastSeen) {
      sql += ' WHERE created_at > ?';
      params.push(lastSeen);
    } else {
      // If never set, treat as 0 unread since "last login" time will be set when logging in
      return res.json({ count: 0 });
    }
    const [[row]]: any = await pool.query(sql, params);
    const count = Number(row?.cnt || 0);
    return res.json({ count });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// GET /api/changes/recent?limit=20
// Returns a list of recent changes after last seen (or all recent if none)
router.get('/recent', async (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    const [[userRow]]: any = await pool.query(
      'SELECT last_seen_changes_at AS lastSeen FROM users WHERE id=? LIMIT 1',
      [userId]
    );
    const lastSeen: string | null = userRow?.lastSeen ?? null;

    const params: any[] = [];
    let where = '';
    if (lastSeen) {
      where = 'WHERE sc.created_at > ?';
      params.push(lastSeen);
    }

    const [rows]: any = await pool.query(
      `SELECT sc.id, DATE_FORMAT(sc.date, '%Y-%m-%d') AS date, sc.shift_type_id AS shiftTypeId,
              sc.action, sc.actor_user_id AS actorUserId, sc.target_user_id AS targetUserId,
              st.name AS shiftTypeName, st.color AS shiftTypeColor,
              au.name AS actorName, tu.name AS targetName,
              sc.details, sc.created_at AS createdAt
       FROM shift_changes sc
       JOIN shift_types st ON st.id = sc.shift_type_id
       LEFT JOIN users au ON au.id = sc.actor_user_id
       LEFT JOIN users tu ON tu.id = sc.target_user_id
       ${where}
       ORDER BY sc.created_at DESC
       LIMIT ${limit}`,
      params
    );

    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to get recent changes' });
  }
});

// POST /api/changes/mark-seen
// Sets last_seen_changes_at = NOW() for current user
router.post('/mark-seen', async (req, res) => {
  try {
    const userId = req.user!.id;
    await pool.query('UPDATE users SET last_seen_changes_at = NOW() WHERE id=?', [userId]);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to mark seen' });
  }
});

export default router;
