import type { Db } from '../client';
import { m001Init } from './001_init';
import { m002TopicTags } from './002_topic_tags';
import { m003OnHold } from './003_on_hold';
import { m004Starred } from './004_starred';
import { m005DueDay } from './005_due_day';

export interface Migration {
  version: number;
  name: string;
  up: (db: Db) => Promise<void>;
}

/** Append new migrations here. Never edit one that has shipped. */
export const MIGRATIONS: Migration[] = [m001Init, m002TopicTags, m003OnHold, m004Starred, m005DueDay];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/**
 * Brings the schema up to date. The applied version is stored in
 * `PRAGMA user_version`; each migration runs in its own transaction.
 */
export async function migrate(db: Db, migrations: Migration[] = MIGRATIONS): Promise<number> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;

  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (m.version <= current) continue;
    await db.transaction(async () => {
      await m.up(db);
      // PRAGMA doesn't accept bound parameters; version is a trusted integer.
      await db.exec(`PRAGMA user_version = ${Math.trunc(m.version)}`);
    });
    current = m.version;
  }
  return current;
}
