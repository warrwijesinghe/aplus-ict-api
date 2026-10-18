import fs from 'node:fs/promises';
import mariadb from 'mariadb';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const config = require('../config/database.cjs').development;
const descriptions = JSON.parse(await fs.readFile(new URL('./data/course-descriptions.json', import.meta.url), 'utf8'));
const db = await mariadb.createConnection({ host: config.host, port: config.port, user: config.username, password: config.password, database: config.database });
try {
  await db.beginTransaction();
  const rows = await db.query('SELECT c.id,c.slug,c.description,c.shortDescriptionEn,c.shortDescriptionSi,a.code AS levelCode FROM courses c JOIN academic_levels a ON a.id=c.academicLevelId FOR UPDATE');
  const selected = rows.filter((row) => descriptions[row.levelCode]);
  await fs.mkdir(new URL('../storage/content-backups/', import.meta.url), { recursive: true });
  const backup = new URL('../storage/content-backups/course-descriptions-' + Date.now() + '.json', import.meta.url);
  await fs.writeFile(backup, JSON.stringify(selected, null, 2));
  for (const row of selected) {
    const copy = descriptions[row.levelCode];
    await db.query('UPDATE courses SET description=?,shortDescriptionEn=?,shortDescriptionSi=?,updatedAt=NOW() WHERE id=?', [copy.en, copy.en, copy.si, row.id]);
  }
  await db.commit();
  console.log('Updated descriptions for ' + selected.length + ' courses. Backup: ' + backup.pathname);
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
