import type { Db } from '../db/client';
import {
  createEntry,
  createTopic,
  createTopicWithTags,
  listTopicStats,
  mergeTopics,
  searchEntries,
  setTopicTags,
} from '../db';
import { MIGRATIONS, migrate } from '../db/migrations';
import { buildBackup, importBackup } from '../services/export';
import { openMigratedDb, openNodeDb } from './helpers/nodeDb';

const tagsOf = async (db: Db, id: number) => (await listTopicStats(db, { includeArchived: true })).find((s) => s.topic.id === id)?.tags;

describe('topic tags', () => {
  let db: Db;
  beforeEach(async () => {
    db = await openMigratedDb();
  });

  it('are set on create, kept as typed, de-duplicated and sorted', async () => {
    const t = await createTopicWithTags(db, 'Portal', ['  Client A ', '#urgent', 'client a', '']);
    expect(await tagsOf(db, t.id)).toEqual(['Client A', 'urgent']);
    await setTopicTags(db, t.id, ['Q4']);
    expect(await tagsOf(db, t.id)).toEqual(['Q4']);
    await setTopicTags(db, t.id, []);
    expect(await tagsOf(db, t.id)).toEqual([]);
  });

  it('make entries findable by searching a tag', async () => {
    const t = await createTopicWithTags(db, 'Portal', ['Acme Corp']);
    await createEntry(db, { topicId: t.id, text: 'Wireframes', day: '2026-10-15' });
    await createEntry(db, { topicId: null, text: 'Lunch', day: '2026-10-15' });
    const found = await searchEntries(db, { query: 'acme' });
    expect(found.map((e) => e.text)).toEqual(['Wireframes']);
  });

  it('move with the entries when topics are merged', async () => {
    const a = await createTopicWithTags(db, 'A', ['one']);
    const b = await createTopicWithTags(db, 'B', ['two']);
    await mergeTopics(db, a.id, b.id);
    expect(await tagsOf(db, b.id)).toEqual(['one', 'two']);
  });

  it('survive a backup and merge into existing topics on import', async () => {
    const t = await createTopicWithTags(db, 'Portal', ['Acme']);
    await createEntry(db, { topicId: t.id, text: 'x', day: '2026-10-15' });
    const backup = JSON.parse(JSON.stringify(await buildBackup(db)));
    expect(backup.topics[0].tags).toEqual(['Acme']);

    const other = await openMigratedDb();
    const existing = await createTopicWithTags(other, 'portal', ['Q4']);
    await importBackup(other, backup);
    expect(await tagsOf(other, existing.id)).toEqual(['Acme', 'Q4']);

    // Older backups have no tags field.
    delete backup.topics[0].tags;
    const third = await openMigratedDb();
    await expect(importBackup(third, backup)).resolves.toMatchObject({ topicsAdded: 1 });
  });

  it('migration copies old entry tags onto their topic', async () => {
    const old = openNodeDb();
    await migrate(old, MIGRATIONS.slice(0, 1));
    const topic = await createTopic(old, 'Portal');
    await old.run("INSERT INTO entries (topic_id, text, type, day, created_at, updated_at) VALUES (?, 'x', 'done', '2026-10-15', 1, 1)", [topic.id]);
    await old.run("INSERT INTO entries (topic_id, text, type, day, created_at, updated_at) VALUES (NULL, 'y', 'done', '2026-10-15', 2, 2)");
    await old.run("INSERT INTO tags (name) VALUES ('acme'), ('loose')");
    await old.run("INSERT INTO entry_tags (entry_id, tag_id) VALUES (1, 1), (2, 2)");
    await migrate(old);
    expect(await tagsOf(old, topic.id)).toEqual(['acme']);
  });
});
