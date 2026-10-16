import { MIGRATIONS, migrate } from '../db/migrations';
import { openNodeDb } from './helpers/nodeDb';

describe('migration 003 (on hold)', () => {
  it('rebuilds entries keeping rows, tags and carry-over links', async () => {
    const db = openNodeDb();
    await migrate(db, MIGRATIONS.slice(0, 2));
    await db.run("INSERT INTO topics (name, color, archived, created_at) VALUES ('Web', '#000000', 0, 1)");
    await db.run("INSERT INTO entries (topic_id, text, type, day, created_at, updated_at) VALUES (1, 'Plan', 'next', '2026-10-14', 1, 1)");
    await db.run("INSERT INTO entries (topic_id, text, type, day, created_at, updated_at, carried_from_id) VALUES (1, 'Plan', 'in_progress', '2026-10-15', 2, 2, 1)");
    await db.run("INSERT INTO tags (name) VALUES ('acme')");
    await db.run('INSERT INTO entry_tags (entry_id, tag_id) VALUES (1, 1), (2, 1)');

    await migrate(db);

    expect(await db.all('SELECT id, topic_id, text, type, day, carried_from_id FROM entries ORDER BY id')).toEqual([
      { id: 1, topic_id: 1, text: 'Plan', type: 'next', day: '2026-10-14', carried_from_id: null },
      { id: 2, topic_id: 1, text: 'Plan', type: 'in_progress', day: '2026-10-15', carried_from_id: 1 },
    ]);
    expect(await db.all('SELECT entry_id, tag_id FROM entry_tags ORDER BY entry_id')).toEqual([
      { entry_id: 1, tag_id: 1 },
      { entry_id: 2, tag_id: 1 },
    ]);
    await db.run("UPDATE entries SET type = 'on_hold' WHERE id = 2");
    await expect(db.run("UPDATE entries SET type = 'nope' WHERE id = 2")).rejects.toThrow();
    // New ids keep counting up, and deleting an entry still cascades to its tags.
    const r = await db.run("INSERT INTO entries (text, type, day, created_at, updated_at) VALUES ('x', 'done', '2026-10-16', 3, 3)");
    expect(r.lastInsertRowId).toBe(3);
    await db.run('DELETE FROM entries WHERE id = 1');
    expect(await db.all('SELECT entry_id FROM entry_tags')).toEqual([{ entry_id: 2 }]);
    expect((await db.all("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'entries' AND name LIKE 'idx_%'")).length).toBe(4);
  });
});
