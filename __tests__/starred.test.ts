import type { Db } from '../db/client';
import { createEntry, createTopic, getEntry, setStatus, updateEntry } from '../db';
import { MIGRATIONS, migrate } from '../db/migrations';
import { buildBackup, importBackup } from '../services/export';
import { buildSummary, formatSummaryText, rangeFor } from '../services/summary';
import { openMigratedDb, openNodeDb } from './helpers/nodeDb';

let db: Db;
beforeEach(async () => {
  db = await openMigratedDb();
});

describe('starred entries', () => {
  it('can be starred on create or later, and keep the star when closed', async () => {
    const web = await createTopic(db, 'Website');
    const a = await createEntry(db, { topicId: web.id, text: 'Payment flow', type: 'in_progress', day: '2026-10-14', starred: true });
    const b = await createEntry(db, { topicId: web.id, text: 'Fix typo', day: '2026-10-14' });
    expect(a.starred).toBe(true);
    expect(b.starred).toBe(false);
    expect((await updateEntry(db, b.id, { starred: true })).starred).toBe(true);
    expect((await updateEntry(db, b.id, { starred: false })).starred).toBe(false);
    expect(await setStatus(db, a.id, 'done', '2026-10-16')).toMatchObject({ type: 'done', starred: true });
  });

  it('are marked with ★ in the summary text', async () => {
    const web = await createTopic(db, 'Website');
    await createEntry(db, { topicId: web.id, text: 'Payment flow', day: '2026-10-14', starred: true });
    await createEntry(db, { topicId: web.id, text: 'Fix typo', day: '2026-10-14' });
    const s = await buildSummary(db, rangeFor('day', '2026-10-14'));
    expect(formatSummaryText(s)).toContain('  • Done (2): ★ Payment flow; Fix typo');
  });

  it('survive a backup round trip', async () => {
    await createEntry(db, { topicId: null, text: 'Key decision', day: '2026-10-14', starred: true });
    const backup = JSON.parse(JSON.stringify(await buildBackup(db)));
    const other = await openMigratedDb();
    await importBackup(other, backup);
    const [e] = await other.all<{ id: number }>('SELECT id FROM entries');
    expect((await getEntry(other, e.id))?.starred).toBe(true);
  });

  it('migration 004 leaves existing entries unstarred', async () => {
    const old = openNodeDb();
    await migrate(old, MIGRATIONS.slice(0, 3));
    await old.run("INSERT INTO entries (text, type, day, created_at, updated_at) VALUES ('Old', 'done', '2026-10-01', 1, 1)");
    await migrate(old);
    expect((await getEntry(old, 1))?.starred).toBe(false);
  });
});
