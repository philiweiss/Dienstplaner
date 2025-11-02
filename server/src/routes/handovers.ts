import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { randomUUID } from 'node:crypto';

const router = Router();

// Schemas
const CreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftTypeId: z.string().min(1),
  fromUserId: z.string().min(1), // until real auth exists we pass it explicitly
  toUserId: z.string().min(1)
});

const RespondSchema = z.object({
  userId: z.string().min(1), // recipient user performing the action
  action: z.enum(['accept', 'reject'])
});

const AdminActionSchema = z.object({
  adminId: z.string().min(1) // placeholder; real auth/role checks can be added later
});

// Helper to get or create assignment by date+shiftTypeId
async function getAssignmentId(date: string, shiftTypeId: string): Promise<string | null> {
  const [rows]: any = await pool.query('SELECT id FROM assignments WHERE date=? AND shift_type_id=? LIMIT 1', [date, shiftTypeId]);
  if (Array.isArray(rows) && rows.length) return rows[0].id as string;
  return null;
}

// POST /api/handovers
// Create a handover request
router.post('/', async (req, res) => {
  const parse = CreateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { date, shiftTypeId, fromUserId, toUserId } = parse.data;
  try {
    // Ensure assignment exists and fromUser is currently assigned
    const assignmentId = await getAssignmentId(date, shiftTypeId);
    if (!assignmentId) return res.status(404).json({ error: 'Assignment not found' });

    const [[{ count }]]: any = await pool.query('SELECT COUNT(*) AS count FROM assignment_users WHERE assignment_id=? AND user_id=?', [assignmentId, fromUserId]);
    if (!count) return res.status(409).json({ error: 'User is not assigned to this shift' });

    // Prevent duplicate open requests for same assignment and fromUser
    const [existing]: any = await pool.query(
      `SELECT id FROM handover_requests WHERE assignment_id=? AND from_user_id=? AND status IN ('REQUESTED','ACCEPTED') LIMIT 1`,
      [assignmentId, fromUserId]
    );
    if (Array.isArray(existing) && existing.length) {
      return res.status(409).json({ error: 'Es existiert bereits eine offene Übergabe-Anfrage' });
    }

    const id = randomUUID();
    await pool.query(
      `INSERT INTO handover_requests (id, assignment_id, from_user_id, to_user_id, status) VALUES (?, ?, ?, ?, 'REQUESTED')`,
      [id, assignmentId, fromUserId, toUserId]
    );

    res.status(201).json({ id, assignmentId, fromUserId, toUserId, status: 'REQUESTED' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create handover request' });
  }
});

// GET /api/handovers/mine?userId=...
// List incoming and outgoing requests for a user
router.get('/mine', async (req, res) => {
  const userId = String(req.query.userId || '');
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const [incoming]: any = await pool.query(
      `SELECT hr.id, hr.status, hr.assignment_id AS assignmentId, hr.from_user_id AS fromUserId, hr.to_user_id AS toUserId,
              DATE_FORMAT(a.date, '%Y-%m-%d') AS date, a.shift_type_id AS shiftTypeId
       FROM handover_requests hr
       JOIN assignments a ON a.id=hr.assignment_id
       WHERE hr.to_user_id=?
       ORDER BY hr.created_at DESC`,
      [userId]
    );
    const [outgoing]: any = await pool.query(
      `SELECT hr.id, hr.status, hr.assignment_id AS assignmentId, hr.from_user_id AS fromUserId, hr.to_user_id AS toUserId,
              DATE_FORMAT(a.date, '%Y-%m-%d') AS date, a.shift_type_id AS shiftTypeId
       FROM handover_requests hr
       JOIN assignments a ON a.id=hr.assignment_id
       WHERE hr.from_user_id=?
       ORDER BY hr.created_at DESC`,
      [userId]
    );
    res.json({ incoming, outgoing });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list handover requests' });
  }
});

// GET /api/handovers/admin
// List requests that are accepted by recipient and waiting for admin approval
router.get('/admin', async (_req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT hr.id, hr.status, hr.assignment_id AS assignmentId, hr.from_user_id AS fromUserId, hr.to_user_id AS toUserId,
              DATE_FORMAT(a.date, '%Y-%m-%d') AS date, a.shift_type_id AS shiftTypeId
       FROM handover_requests hr
       JOIN assignments a ON a.id=hr.assignment_id
       WHERE hr.status='ACCEPTED'
       ORDER BY hr.created_at ASC`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list admin pending handovers' });
  }
});

// POST /api/handovers/:id/respond
// Recipient accepts or rejects the request
router.post('/:id/respond', async (req, res) => {
  const { id } = req.params;
  const parse = RespondSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { userId, action } = parse.data;
  try {
    const [rows]: any = await pool.query('SELECT id, to_user_id AS toUserId, status FROM handover_requests WHERE id=? LIMIT 1', [id]);
    if (!Array.isArray(rows) || !rows.length) return res.status(404).json({ error: 'Request not found' });
    const reqRow = rows[0];
    if (reqRow.toUserId !== userId) return res.status(403).json({ error: 'Not your request' });
    if (reqRow.status !== 'REQUESTED') return res.status(409).json({ error: 'Request already processed' });

    const newStatus = action === 'accept' ? 'ACCEPTED' : 'REJECTED';
    await pool.query('UPDATE handover_requests SET status=? WHERE id=?', [newStatus, id]);
    res.json({ id, status: newStatus });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update handover request' });
  }
});

// POST /api/handovers/:id/approve
// Admin approves the transfer; perform the actual reassignment
router.post('/:id/approve', async (req, res) => {
  const { id } = req.params;
  const parse = AdminActionSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  try {
    const [rows]: any = await pool.query(
      'SELECT id, assignment_id AS assignmentId, from_user_id AS fromUserId, to_user_id AS toUserId, status FROM handover_requests WHERE id=? LIMIT 1',
      [id]
    );
    if (!Array.isArray(rows) || !rows.length) return res.status(404).json({ error: 'Request not found' });
    const r = rows[0];
    if (r.status !== 'ACCEPTED') return res.status(409).json({ error: 'Not in ACCEPTED state' });

    // Perform assignment change: remove fromUser, add toUser (ignore capacity since it is a swap)
    await pool.query('DELETE FROM assignment_users WHERE assignment_id=? AND user_id=?', [r.assignmentId, r.fromUserId]);
    await pool.query('INSERT IGNORE INTO assignment_users (assignment_id, user_id) VALUES (?, ?)', [r.assignmentId, r.toUserId]);

    // Log change: SUBSTITUTION (Vertretung)
    try {
      const [[a]]: any = await pool.query(
        'SELECT DATE_FORMAT(date, "%Y-%m-%d") AS date, shift_type_id AS shiftTypeId FROM assignments WHERE id=? LIMIT 1',
        [r.assignmentId]
      );
      const date = a?.date as string;
      const shiftTypeId = a?.shiftTypeId as string;
      if (date && shiftTypeId) {
        const idChange = randomUUID();
        await pool.query(
          `INSERT INTO shift_changes (id, assignment_id, date, shift_type_id, action, actor_user_id, target_user_id, details)
           VALUES (?, ?, ?, ?, 'SUBSTITUTION', ?, ?, NULL)`,
          [idChange, r.assignmentId, date, shiftTypeId, r.fromUserId, r.toUserId]
        );
      }
    } catch (_) {}

    await pool.query('UPDATE handover_requests SET status="APPROVED" WHERE id=?', [id]);
    res.json({ id, status: 'APPROVED' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to approve handover' });
  }
});

// POST /api/handovers/:id/decline
router.post('/:id/decline', async (req, res) => {
  const { id } = req.params;
  const parse = AdminActionSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  try {
    const [rows]: any = await pool.query('SELECT status FROM handover_requests WHERE id=? LIMIT 1', [id]);
    if (!Array.isArray(rows) || !rows.length) return res.status(404).json({ error: 'Request not found' });
    const status = rows[0].status as string;
    if (status !== 'ACCEPTED') return res.status(409).json({ error: 'Not in ACCEPTED state' });
    await pool.query('UPDATE handover_requests SET status="DECLINED" WHERE id=?', [id]);
    res.json({ id, status: 'DECLINED' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to decline handover' });
  }
});

export default router;
