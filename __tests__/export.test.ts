import type { Db } from '../db/client';
import { continueItems, createEntry, createTopic, getCarryOver, listTopics, queryEntries, setTopicArchived } from '../db';
import { buildBackup, deleteAllData, exportJson, exportText, importBackup, parseBackup, storageStats } from '../services/export';
import { openMigratedDb } from './helpers/nodeDb';

async function seed(db: Db) {
  const web = await createTopic(db, 'Website');
  const old = await createTopic(db, 'Old project');
  await setTopicArchived(db, old.id, true);
  await createEntry(db, { topicId: web.id, text: 'Hero layout', day: '2026-10-09', type: 'done', durationMinutes: 90, tags: ['ui'], createdAt: new Date(2026, 9, 9, 10).getTime() });
  await createEntry(db, { topicId: web.id, text: 'Write tests', day: '2026-10-09', type: 'next', createdAt: new Date(2026, 9, 9, 11).getTime() });
  await createEntry(db, { topicId: null, text: 'Expenses', day: '2026-10-09', createdAt: new Date(2026, 9, 9, 12).getTime() });
  const carry = (await getCarryOver(db, '2026-10-12'))!;
  await continueItems(db, carry.items, '2026-10-12');
  return { web, old };
}

describe('export', () => {
  it('exports everything as a versioned backup', async () => {
    const db = await openMigratedDb();
    await seed(db);
    const b = await buildBackup(db);
    expect(b.format).toBe('daylog-backup');
    expect(b.version).toBe(1);
    expect(b.topics.map((t) => t.name).sort()).toEqual(['Old project', 'Website']);
    expect(b.entries).toHaveLength(4);
  });

  it('exports readable plain text grouped by day', async () => {
    const db = await openMigratedDb();
    await seed(db);
    const text = await exportText(db);
    expect(text).toContain('Fri, 9 Oct 2026');
    expect(text).toContain('10:00  [Done] Website: Hero layout (1h 30m, #ui)');
    expect(text).toContain('[Done] Expenses');
    expect(text).toContain('Mon, 12 Oct 2026');
  });
});

describe('import', () => {
  it('moves a whole log into an empty one (Safari → home-screen app)', async () => {
    const from = await openMigratedDb();
    await seed(from);
    const to = await openMigratedDb();

    const res = await importBackup(to, parseBackup(await exportJson(from)));
    expect(res).toEqual({ entriesAdded: 4, entriesSkipped: 0, topicsAdded: 2 });

    const topics = await listTopics(to, { includeArchived: true });
    expect(topics.find((t) => t.name === 'Old project')?.archived).toBe(true);
    const entries = await queryEntries(to, 'SELECT * FROM entries ORDER BY created_at');
    expect(entries.map((e) => [e.day, e.text, e.type])).toEqual([
      ['2026-10-09', 'Hero layout', 'done'],
      ['2026-10-09', 'Write tests', 'next'],
      ['2026-10-09', 'Expenses', 'done'],
      ['2026-10-12', 'Write tests', 'in_progress'],
    ]);
    expect(entries[0].durationMinutes).toBe(90);
    expect(entries[0].tags).toEqual(['ui']);
    expect(entries[0].topicId).toBe(topics.find((t) => t.name === 'Website')!.id);
    // Carry-over link points at the imported original.
    expect(entries[3].carriedFromId).toBe(entries[1].id);
  });

  it('merges into an existing log: matches topics by name and skips duplicates', async () => {
    const from = await openMigratedDb();
    await seed(from);
    const json = await exportJson(from);

    const to = await openMigratedDb();
    const mine = await createTopic(to, 'website'); // same topic, different case
    await createEntry(to, { topicId: mine.id, text: 'Something new', day: '2026-10-12' });

    expect(await importBackup(to, parseBackup(json))).toEqual({ entriesAdded: 4, entriesSkipped: 0, topicsAdded: 1 });
    // Importing the same backup again changes nothing.
    expect(await importBackup(to, parseBackup(json))).toEqual({ entriesAdded: 0, entriesSkipped: 4, topicsAdded: 0 });

    const topics = await listTopics(to, { includeArchived: true });
    expect(topics.map((t) => t.name).sort()).toEqual(['Old project', 'website']);
    expect(await queryEntries(to, 'SELECT * FROM entries')).toHaveLength(5);
  });

  it('rejects things that are not a backup', () => {
    expect(() => parseBackup('hello')).toThrow(/not a DayLog backup/);
    expect(() => parseBackup('{"a":1}')).toThrow(/not a DayLog backup/);
    expect(() => parseBackup(JSON.stringify({ format: 'daylog-backup', version: 99, topics: [], entries: [] }))).toThrow(/newer version/);
    expect(() =>
      parseBackup(JSON.stringify({ format: 'daylog-backup', version: 1, topics: [], entries: [{ text: '', day: '2026-01-01' }] })),
    ).toThrow(/damaged/);
  });

  it('accepts a backup with surrounding whitespace (pasted)', async () => {
    const from = await openMigratedDb();
    await seed(from);
    expect(parseBackup(`\n  ${await exportJson(from)}  \n`).entries).toHaveLength(4);
  });
});

describe('delete all data', () => {
  it('empties the log, and a backup made first can bring it back', async () => {
    const db = await openMigratedDb();
    await seed(db);
    const json = await exportJson(db);
    await deleteAllData(db);
    expect(await storageStats(db)).toEqual({ entries: 0, topics: 0, firstDay: null });
    expect(await db.get('SELECT * FROM settings')).toBeNull();
    expect((await importBackup(db, parseBackup(json))).entriesAdded).toBe(4);
  });
});
