import { Router } from 'express';
import { pool } from '../db.js';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';

const router = Router();

const TZ = process.env.TIMEZONE || 'Europe/Berlin';

function baseUrlFromRequest(req: any) {
  const envBase = process.env.BASE_URL;
  if (envBase) return envBase.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  return `${proto}://${host}`;
}

function toDateTime(dateStr: string, timeStr: string, addDay = 0) {
  // dateStr: YYYY-MM-DD, timeStr: HH:MM:SS or HH:MM
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + addDay, hh, mm || 0, 0));
  return dt;
}

function formatICSDate(dt: Date, tzid: string) {
  // Format as local time with TZID, e.g., DTSTART;TZID=Europe/Berlin:20250101T090000
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const mm = String(dt.getUTCMinutes()).padStart(2, '0');
  const ss = '00';
  // We are using UTC clock but labeling with TZID is not strictly correct.
  // To avoid DST complexities in code, we'll output in UTC (Z) and set TRANSP:OPAQUE which Outlook honors.
  // Return Zulu time instead of TZID-based local time.
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

function nowAsStamp() {
  const dt = new Date();
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const mm = String(dt.getUTCMinutes()).padStart(2, '0');
  const ss = String(dt.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

function escapeText(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function buildTimezoneBlock(tzid: string) {
  // Minimal Europe/Berlin VTIMEZONE block
  if (tzid !== 'Europe/Berlin') return '';
  return [
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Berlin',
    'X-LIC-LOCATION:Europe/Berlin',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE'
  ].join('\r\n');
}

// Generate or regenerate a secret calendar token for a user
const TokenReq = z.object({
  userId: z.string().min(1),
  regenerate: z.boolean().optional().default(false)
});

router.post('/token', async (req, res) => {
  const parse = TokenReq.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { userId, regenerate } = parse.data;
  try {
    // If not regenerating, try to reuse existing
    if (!regenerate) {
      const [rows]: any = await pool.query('SELECT calendar_token FROM users WHERE id=? LIMIT 1', [userId]);
      const token = rows?.[0]?.calendar_token || null;
      if (token) {
        const url = `${baseUrlFromRequest(req)}/api/calendar/${token}.ics`;
        return res.json({ token, url });
      }
    }
    const token = randomBytes(24).toString('hex');
    await pool.query('UPDATE users SET calendar_token=? WHERE id=?', [token, userId]);
    const url = `${baseUrlFromRequest(req)}/api/calendar/${token}.ics`;
    return res.json({ token, url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to generate calendar token' });
  }
});

// Public ICS feed by token
router.get('/:token.ics', async (req, res) => {
  const { token } = req.params as { token: string };
  try {
    const [urows]: any = await pool.query('SELECT id, name FROM users WHERE calendar_token=? LIMIT 1', [token]);
    const user = Array.isArray(urows) && urows.length ? urows[0] : null;
    if (!user) return res.status(404).send('Not found');

    // Range: past 30 days to next 365 days
    const now = new Date();
    const past = new Date(now.getTime() - 30 * 86400000);
    const future = new Date(now.getTime() + 365 * 86400000);
    const fmt = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    const [rows]: any = await pool.query(
      `SELECT a.id AS assignmentId, DATE_FORMAT(a.date, '%Y-%m-%d') AS date,
              st.id AS shiftTypeId, st.name AS shiftName,
              TIME_FORMAT(st.start_time, '%H:%i') AS startTime,
              TIME_FORMAT(st.end_time, '%H:%i') AS endTime
       FROM assignment_users au
       JOIN assignments a ON a.id = au.assignment_id
       JOIN shift_types st ON st.id = a.shift_type_id
       WHERE au.user_id = ? AND a.date BETWEEN ? AND ?
       ORDER BY a.date ASC, st.start_time ASC`,
      [user.id, fmt(past), fmt(future)]
    );

    const [absRows]: any = await pool.query(
      `SELECT id, DATE_FORMAT(date, '%Y-%m-%d') AS date, type, COALESCE(part, 'FULL') AS part, COALESCE(note, '') AS note
       FROM absences
       WHERE user_id = ? AND date BETWEEN ? AND ?
       ORDER BY date ASC`,
      [user.id, fmt(past), fmt(future)]
    );

    const lines: string[] = [];
    lines.push('BEGIN:VCALENDAR');
    lines.push('VERSION:2.0');
    lines.push('PRODID:-//Dienstplaner//Calendar//DE');
    lines.push('CALSCALE:GREGORIAN');
    lines.push('METHOD:PUBLISH');
    lines.push(`X-WR-CALNAME:Dienstplaner ${escapeText(user.name)}`);
    lines.push(`X-WR-TIMEZONE:${TZ}`);
    const tzBlock = buildTimezoneBlock(TZ);
    if (tzBlock) lines.push(tzBlock);

    const stamp = nowAsStamp();

    for (const r of rows as any[]) {
      const start = r.startTime as string;
      const end = r.endTime as string;
      const overnight = end <= start; // simplistic string compare OK for HH:MM format
      const dtStart = toDateTime(r.date, start, 0);
      const dtEnd = toDateTime(r.date, end, overnight ? 1 : 0);

      const uid = `${r.assignmentId}-${user.id}@dienstplaner`;
      const summary = `Schicht: ${r.shiftName}`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${stamp}`);
      // Use UTC to avoid DST pitfalls in generation
      lines.push(`DTSTART:${formatICSDate(dtStart, TZ)}`);
      lines.push(`DTEND:${formatICSDate(dtEnd, TZ)}`);
      lines.push('TRANSP:OPAQUE'); // block time
      lines.push(`SUMMARY:${escapeText(summary)}`);
      lines.push('END:VEVENT');
    }

    // Absences as all-day events
    const fmtDateOnly = (s: string) => s.replace(/-/g, ''); // YYYYMMDD
    for (const a of absRows as any[]) {
      const uid = `ABS-${a.id}-${user.id}@dienstplaner`;
      const start = fmtDateOnly(a.date);
      // DTEND is non-inclusive next day for all-day
      const d = new Date(a.date + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + 1);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const end = `${y}${m}${dd}`;
      let summary = a.type === 'VACATION' ? 'Urlaub' : (a.type === 'SEMINAR' ? 'Seminar' : 'Krank');
      if (a.part && a.part !== 'FULL') {
        summary += a.part === 'AM' ? ' (Vormittag)' : ' (Nachmittag)';
      }

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${stamp}`);
      lines.push(`DTSTART;VALUE=DATE:${start}`);
      lines.push(`DTEND;VALUE=DATE:${end}`);
      lines.push('TRANSP:OPAQUE');
      lines.push(`SUMMARY:${escapeText(summary)}`);
      if (a.note) lines.push(`DESCRIPTION:${escapeText(a.note)}`);
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');

    const body = lines.join('\r\n') + '\r\n';
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    // Cache for a short time; clients like Outlook will poll periodically
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(body);
  } catch (e) {
    console.error(e);
    return res.status(500).send('Internal Server Error');
  }
});

export default router;
