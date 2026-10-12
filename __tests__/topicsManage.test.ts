import type { Db } from '../db/client';
import {
  countEntriesByDay,
  createEntry,
  createTopic,
  getLastTopicId,
  getTopic,
  listEntriesByTopic,
  listTopicStats,
  listTopics,
  mergeTopics,
  renameTopic,
  setLastTopicId,
  setTopicArchived,
} from '../db';
import { openMigratedDb } from './helpers/nodeDb';

let db: Db;
beforeEach(async () => {
  db = await openMigratedDb();
});

describe('topic stats', () => {
  it('counts entries, time, active days and last activity', async () => {
    const web = await createTopic(db, 'Web');
    const idle = await createTopic(db, 'Idle');
    await createEntry(db, { topicId: web.id, text: 'a', day: '2026-01-05', durationMinutes: 30 });
    await createEntry(db, { topicId: web.id, text: 'b', day: '2026-01-05', durationMinutes: 60 });
    await createEntry(db, { topicId: web.id, text: 'c', day: '2026-01-07' });

    const stats = await listTopicStats(db);
    expect(stats.map((s) => s.topic.name)).toEqual(['Web', 'Idle']);
    expect(stats[0]).toMatchObject({ entryCount: 3, totalMinutes: 90, daysActive: 2, lastDay: '2026-01-07' });
    expect(stats.find((s) => s.topic.id === idle.id)).toMatchObject({ entryCount: 0, totalMinutes: 0, daysActive: 0, lastDay: null });
  });

  it('hides archived topics unless asked', async () => {
    const t = await createTopic(db, 'Old');
    await setTopicArchived(db, t.id, true);
    expect(await listTopicStats(db)).toHaveLength(0);
    expect(await listTopicStats(db, { includeArchived: true })).toHaveLength(1);
    expect(await listTopics(db)).toHaveLength(0);
  });
});

describe('rename', () => {
  it('renames, and refuses a name another topic uses', async () => {
    const a = await createTopic(db, 'A');
    await createTopic(db, 'B');
    expect((await renameTopic(db, a.id, ' Alpha ')).name).toBe('Alpha');
    expect((await renameTopic(db, a.id, 'alpha')).name).toBe('alpha'); // case change of itself is fine
    await expect(renameTopic(db, a.id, 'b')).rejects.toThrow(/Merge/);
  });
});

describe('merge', () => {
  it('moves entries to the target and deletes the source', async () => {
    const src = await createTopic(db, 'Site');
    const dst = await createTopic(db, 'Website');
    await createEntry(db, { topicId: src.id, text: 'one' });
    await createEntry(db, { topicId: dst.id, text: 'two' });
    await setLastTopicId(db, src.id);

    await mergeTopics(db, src.id, dst.id);

    expect(await getTopic(db, src.id)).toBeNull();
    expect((await listEntriesByTopic(db, dst.id)).map((e) => e.text).sort()).toEqual(['one', 'two']);
    expect(await getLastTopicId(db)).toBe(dst.id);
  });

  it('rejects merging a topic into itself', async () => {
    const t = await createTopic(db, 'X');
    await expect(mergeTopics(db, t.id, t.id)).rejects.toThrow();
  });
});

describe('history queries', () => {
  it('lists a topic timeline newest day first, and untopiced entries', async () => {
    const t = await createTopic(db, 'T');
    await createEntry(db, { topicId: t.id, text: 'old', day: '2026-01-01' });
    await createEntry(db, { topicId: t.id, text: 'new', day: '2026-02-01' });
    await createEntry(db, { topicId: null, text: 'loose', day: '2026-02-01' });
    expect((await listEntriesByTopic(db, t.id)).map((e) => e.text)).toEqual(['new', 'old']);
    expect((await listEntriesByTopic(db, null)).map((e) => e.text)).toEqual(['loose']);
  });

  it('counts entries per day in a range', async () => {
    await createEntry(db, { topicId: null, text: 'a', day: '2026-03-01' });
    await createEntry(db, { topicId: null, text: 'b', day: '2026-03-01' });
    await createEntry(db, { topicId: null, text: 'c', day: '2026-03-31' });
    await createEntry(db, { topicId: null, text: 'd', day: '2026-04-01' });
    const counts = await countEntriesByDay(db, '2026-03-01', '2026-03-31');
    expect(Object.fromEntries(counts)).toEqual({ '2026-03-01': 2, '2026-03-31': 1 });
  });
});
