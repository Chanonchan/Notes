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
