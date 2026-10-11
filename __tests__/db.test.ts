import type { Db } from '../db/client';
import {
  createEntry,
  createTopic,
  deleteEntry,
  getEntry,
  getLastTopicId,
  listEntriesByDay,
  listEntriesInRange,
  listTopics,
  recentTextsByTopic,
  setLastTopicId,
  updateEntry,
} from '../db';
import { LATEST_VERSION, migrate, type Migration } from '../db/migrations';
import { toDayKey } from '../services/dates';
import { openMigratedDb, openNodeDb } from './helpers/nodeDb';

let db: Db;
beforeEach(async () => {
  db = await openMigratedDb();
});

describe('migrations', () => {
  it('sets user_version to the latest migration', async () => {
    const row = await db.get<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(LATEST_VERSION);
  });

  it('is idempotent', async () => {
    await expect(migrate(db)).resolves.toBe(LATEST_VERSION);
  });

  it('only runs pending migrations, in order', async () => {
    const fresh = openNodeDb();
    const ran: number[] = [];
    const mk = (version: number): Migration => ({
      version,
      name: `m${version}`,
      up: async (d) => {
        ran.push(version);
        await d.exec(`CREATE TABLE t${version} (x)`);
      },
    });
    await migrate(fresh, [mk(2), mk(1)]);
    await migrate(fresh, [mk(1), mk(2), mk(3)]);
    expect(ran).toEqual([1, 2, 3]);
  });

  it('rolls back a failing migration', async () => {
    const fresh = openNodeDb();
    const bad: Migration = {
      version: 1,
      name: 'bad',
      up: async (d) => {
        await d.exec('CREATE TABLE half (x)');
        throw new Error('boom');
      },
    };
    await expect(migrate(fresh, [bad])).rejects.toThrow('boom');
    const v = await fresh.get<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(0);
    const t = await fresh.get("SELECT name FROM sqlite_master WHERE name = 'half'");
    expect(t).toBeNull();
  });
});

describe('topics', () => {
  it('creates topics with rotating colors and lists them by name', async () => {
    const b = await createTopic(db, '  Website   redesign ');
    const a = await createTopic(db, 'API');
    expect(b.name).toBe('Website redesign');
    expect(a.color).not.toBe(b.color);
    expect((await listTopics(db)).map((t) => t.name)).toEqual(['API', 'Website redesign']);
  });

  it('returns the existing topic for a case-insensitive duplicate name', async () => {
    const a = await createTopic(db, 'Hiring');
    const b = await createTopic(db, 'hiring');
    expect(b.id).toBe(a.id);
  });

  it('rejects empty names', async () => {
    await expect(createTopic(db, '   ')).rejects.toThrow();
  });
});

describe('entries', () => {
  it('creates an entry with defaults and an auto timestamp', async () => {
    const before = Date.now();
    const e = await createEntry(db, { topicId: null, text: '  Fixed login bug ' });
    expect(e.text).toBe('Fixed login bug');
    expect(e.type).toBe('done');
    expect(e.durationMinutes).toBeNull();
    expect(e.day).toBe(toDayKey());
    expect(e.createdAt).toBeGreaterThanOrEqual(before);
  });

  it('validates text, type and duration', async () => {
    await expect(createEntry(db, { topicId: null, text: ' ' })).rejects.toThrow();
    await expect(createEntry(db, { topicId: null, text: 'x', type: 'nope' as never })).rejects.toThrow();
    await expect(createEntry(db, { topicId: null, text: 'x', durationMinutes: -5 })).rejects.toThrow();
  });

  it('places entries added to a past day on that day', async () => {
    const e = await createEntry(db, { topicId: null, text: 'Forgot this', day: '2026-01-05' });
    expect(e.day).toBe('2026-01-05');
    expect(toDayKey(e.createdAt)).toBe('2026-01-05');
  });

  it('lists a day in chronological order', async () => {
    await createEntry(db, { topicId: null, text: 'second', day: '2026-02-01', createdAt: new Date(2026, 1, 1, 14).getTime() });
    await createEntry(db, { topicId: null, text: 'first', day: '2026-02-01', createdAt: new Date(2026, 1, 1, 9).getTime() });
    await createEntry(db, { topicId: null, text: 'other day', day: '2026-02-02' });
    expect((await listEntriesByDay(db, '2026-02-01')).map((e) => e.text)).toEqual(['first', 'second']);
    expect(await listEntriesInRange(db, '2026-02-01', '2026-02-02')).toHaveLength(3);
  });

  it('updates type, text, topic, duration and day', async () => {
    const t = await createTopic(db, 'Infra');
    const e = await createEntry(db, { topicId: null, text: 'Migrate DB', type: 'in_progress' });
    const u = await updateEntry(db, e.id, {
      type: 'done',
      text: 'Migrated DB',
      topicId: t.id,
      durationMinutes: 90,
      day: '2026-03-03',
    });
    expect(u).toMatchObject({ type: 'done', text: 'Migrated DB', topicId: t.id, durationMinutes: 90, day: '2026-03-03' });
    expect(toDayKey(u.createdAt)).toBe('2026-03-03');
    expect(u.updatedAt).toBeGreaterThanOrEqual(e.updatedAt);

    const cleared = await updateEntry(db, e.id, { durationMinutes: null, topicId: null });
    expect(cleared.durationMinutes).toBeNull();
    expect(cleared.topicId).toBeNull();
  });

  it('stores and replaces tags', async () => {
    const e = await createEntry(db, { topicId: null, text: 'x', tags: ['#Urgent', 'client a', 'urgent'] });
    expect(e.tags).toEqual(['client-a', 'urgent']);
    const u = await updateEntry(db, e.id, { tags: ['review'] });
    expect(u.tags).toEqual(['review']);
  });

  it('deletes an entry and its tag links', async () => {
    const e = await createEntry(db, { topicId: null, text: 'x', tags: ['a'] });
    await deleteEntry(db, e.id);
    expect(await getEntry(db, e.id)).toBeNull();
    expect(await db.get('SELECT * FROM entry_tags WHERE entry_id = ?', [e.id])).toBeNull();
  });

  it('keeps entries when their topic is deleted', async () => {
    const t = await createTopic(db, 'Temp');
    const e = await createEntry(db, { topicId: t.id, text: 'x' });
    await db.run('DELETE FROM topics WHERE id = ?', [t.id]);
    expect((await getEntry(db, e.id))?.topicId).toBeNull();
  });

  it('collects recent texts per active topic', async () => {
    const a = await createTopic(db, 'A');
    const b = await createTopic(db, 'B');
    await createEntry(db, { topicId: a.id, text: 'a1' });
    await createEntry(db, { topicId: a.id, text: 'a2' });
    await createEntry(db, { topicId: b.id, text: 'b1' });
    await db.run('UPDATE topics SET archived = 1 WHERE id = ?', [b.id]);
    const map = await recentTextsByTopic(db);
    expect(map.get(a.id)?.sort()).toEqual(['a1', 'a2']);
    expect(map.has(b.id)).toBe(false);
  });
});

describe('settings', () => {
  it('remembers the last used topic, ignoring archived ones', async () => {
    expect(await getLastTopicId(db)).toBeNull();
    const t = await createTopic(db, 'X');
    await setLastTopicId(db, t.id);
    expect(await getLastTopicId(db)).toBe(t.id);
    await db.run('UPDATE topics SET archived = 1 WHERE id = ?', [t.id]);
    expect(await getLastTopicId(db)).toBeNull();
  });
});
