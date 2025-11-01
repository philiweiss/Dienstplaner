import 'dotenv/config';
import { pool } from '../db.js';

async function seed() {

  // Shift types
  await pool.query(`INSERT IGNORE INTO shift_types (id, name, start_time, end_time, color, min_users, max_users) VALUES
    ('st1','Frühschicht','06:00','14:00','bg-sky-200 text-sky-800',2,2),
    ('st2','Spätschicht','14:00','22:00','bg-amber-200 text-amber-800',1,1),
  `);

  // Assignments and users
  // Helper to upsert assignment and link user(s)
  async function ensureAssignment(date: string, shiftTypeId: string, userIds: string[]) {
    const [rows]: any = await pool.query('SELECT id FROM assignments WHERE date=? AND shift_type_id=? LIMIT 1', [date, shiftTypeId]);
    let id = rows?.[0]?.id as string | undefined;
    if (!id) {
      // deterministic id for seed
      id = `a_${date}_${shiftTypeId}`;
      await pool.query('INSERT IGNORE INTO assignments (id, date, shift_type_id) VALUES (?, ?, ?)', [id, date, shiftTypeId]);
    }
    for (const uid of userIds) {
      await pool.query('INSERT IGNORE INTO assignment_users (assignment_id, user_id) VALUES (?, ?)', [id, uid]);
    }
  }

  await ensureAssignment('2024-07-22','st1',['u2']);
  await ensureAssignment('2024-07-22','st2',['u3']);
  await ensureAssignment('2024-07-23','st1',['u4']);
  await ensureAssignment('2024-07-23','st3',['u2']);

  // Week configs
  await pool.query(`INSERT IGNORE INTO week_configs (year, week_number, status) VALUES
    (2024,30,'Offen'),
    (2024,31,'Gesperrt')
  `);

  console.log('Seed completed.');
}

seed().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
