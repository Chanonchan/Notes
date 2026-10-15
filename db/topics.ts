import type { Topic } from '../types';
import type { Db } from './client';

export const TOPIC_COLORS = [
  '#4F7DF3', '#E5734A', '#2BA57E', '#B55FD6', '#D9A21B',
  '#E0527E', '#3AA6C2', '#7A8B2E', '#8C6CF0', '#C2683A',
];

interface TopicRow {
  id: number;
  name: string;
  color: string;
  archived: number;
  created_at: number;
}

const toTopic = (r: TopicRow): Topic => ({
  id: r.id,
  name: r.name,
  color: r.color,
  archived: r.archived === 1,
  createdAt: r.created_at,
});

export async function listTopics(db: Db, opts: { includeArchived?: boolean } = {}): Promise<Topic[]> {
  const rows = await db.all<TopicRow>(
    `SELECT * FROM topics ${opts.includeArchived ? '' : 'WHERE archived = 0'} ORDER BY name COLLATE NOCASE`,
  );
  return rows.map(toTopic);
}

export async function getTopic(db: Db, id: number): Promise<Topic | null> {
  const row = await db.get<TopicRow>('SELECT * FROM topics WHERE id = ?', [id]);
  return row ? toTopic(row) : null;
}

export async function findTopicByName(db: Db, name: string): Promise<Topic | null> {
  const row = await db.get<TopicRow>('SELECT * FROM topics WHERE name = ? COLLATE NOCASE', [name.trim()]);
  return row ? toTopic(row) : null;
}

/**
 * Creates a topic, or returns the existing one with the same name
 * (case-insensitive) — un-archiving it if needed.
 */
export async function createTopic(db: Db, name: string, color?: string): Promise<Topic> {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) throw new Error('Topic name is required');

  const existing = await findTopicByName(db, clean);
  if (existing) {
    if (existing.archived) {
      await db.run('UPDATE topics SET archived = 0 WHERE id = ?', [existing.id]);
      return { ...existing, archived: false };
    }
    return existing;
  }

  const count = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM topics');
  const pick = color ?? TOPIC_COLORS[(count?.n ?? 0) % TOPIC_COLORS.length];
  const now = Date.now();
  const res = await db.run('INSERT INTO topics (name, color, archived, created_at) VALUES (?, ?, 0, ?)', [
    clean,
    pick,
    now,
  ]);
  return { id: res.lastInsertRowId, name: clean, color: pick, archived: false, createdAt: now };
}

/** Renames a topic. Fails if another topic already has that name. */
export async function renameTopic(db: Db, id: number, name: string): Promise<Topic> {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) throw new Error('Topic name is required');
  const clash = await findTopicByName(db, clean);
  if (clash && clash.id !== id) {
    throw new Error(`A topic named "${clash.name}" already exists. Use Merge to combine them.`);
  }
  await db.run('UPDATE topics SET name = ? WHERE id = ?', [clean, id]);
  const topic = await getTopic(db, id);
  if (!topic) throw new Error(`Topic ${id} not found`);
  return topic;
}

export async function setTopicArchived(db: Db, id: number, archived: boolean): Promise<void> {
  await db.run('UPDATE topics SET archived = ? WHERE id = ?', [archived ? 1 : 0, id]);
}

/** Moves every entry of `sourceId` into `targetId`, then deletes the source topic. */
export async function mergeTopics(db: Db, sourceId: number, targetId: number): Promise<void> {
  if (sourceId === targetId) throw new Error('Cannot merge a topic into itself');
  const [source, target] = await Promise.all([getTopic(db, sourceId), getTopic(db, targetId)]);
  if (!source || !target) throw new Error('Topic not found');
  await db.transaction(async () => {
    await db.run('UPDATE entries SET topic_id = ? WHERE topic_id = ?', [targetId, sourceId]);
    await db.run('DELETE FROM topics WHERE id = ?', [sourceId]);
    if (target.archived && !source.archived) {
      await db.run('UPDATE topics SET archived = 0 WHERE id = ?', [targetId]);
    }
  });
  const last = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'last_topic_id'");
  if (last && Number(last.value) === sourceId) {
    await db.run("UPDATE settings SET value = ? WHERE key = 'last_topic_id'", [String(targetId)]);
  }
}

export interface TopicStats {
  topic: Topic;
  entryCount: number;
  totalMinutes: number;
  daysActive: number;
  /** Most recent day with an entry, or null if none. */
  lastDay: string | null;
  /** Entries recorded as Blocked. */
  blockedCount: number;
}

/** Every topic with its totals, most recently active first. */
export async function listTopicStats(db: Db, opts: { includeArchived?: boolean } = {}): Promise<TopicStats[]> {
  const rows = await db.all<TopicRow & { entry_count: number; total_minutes: number; days_active: number; last_day: string | null; blocked_count: number }>(
    `SELECT t.*,
            COUNT(e.id) AS entry_count,
            COALESCE(SUM(e.duration_minutes), 0) AS total_minutes,
            COUNT(DISTINCT e.day) AS days_active,
            MAX(e.day) AS last_day,
            COALESCE(SUM(e.type = 'blocked'), 0) AS blocked_count
     FROM topics t LEFT JOIN entries e ON e.topic_id = t.id
     ${opts.includeArchived ? '' : 'WHERE t.archived = 0'}
     GROUP BY t.id
     ORDER BY t.archived, last_day IS NULL, last_day DESC, MAX(e.created_at) DESC, t.name COLLATE NOCASE`,
  );
  return rows.map((r) => ({
    topic: toTopic(r),
    entryCount: r.entry_count,
    totalMinutes: r.total_minutes,
    daysActive: r.days_active,
    lastDay: r.last_day,
    blockedCount: r.blocked_count,
  }));
}
