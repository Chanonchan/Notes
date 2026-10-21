import type { Db } from '../db/client';
import { createEntry, getEntry, listOpenItems, updateEntry } from '../db';
import { MIGRATIONS, migrate } from '../db/migrations';
import { deadlineChoices, formatDue } from '../services/deadline';
import { buildBackup, importBackup } from '../services/export';
import { openMigratedDb, openNodeDb } from './helpers/nodeDb';

let db: Db;
beforeEach(async () => {
  db = await openMigratedDb();
});

describe('deadlines', () => {
  it('put the nearest deadline first within each section, keeping In progress before Planned', async () => {
    const add = (text: string, type: 'in_progress' | 'next', day: string, dueDay?: string) =>
      createEntry(db, { topicId: null, text, type, day, dueDay });
    await add('Old job', 'in_progress', '2026-10-01');
    await add('Due Friday', 'in_progress', '2026-10-15', '2026-10-23');
    await add('Due tomorrow', 'in_progress', '2026-10-20', '2026-10-22');
    await add('Plan A', 'next', '2026-10-02');
    await add('Plan due', 'next', '2026-10-19', '2026-11-02');
    expect((await listOpenItems(db)).map((e) => e.text)).toEqual(['Due tomorrow', 'Due Friday', 'Old job', 'Plan due', 'Plan A']);
  });

  it('can be set, changed and cleared, and must be a day', async () => {
    const e = await createEntry(db, { topicId: null, text: 'Report', type: 'next', day: '2026-10-21' });
    expect(e.dueDay).toBeNull();
    expect((await updateEntry(db, e.id, { dueDay: '2026-10-30' })).dueDay).toBe('2026-10-30');
    expect((await updateEntry(db, e.id, { dueDay: null })).dueDay).toBeNull();
    await expect(updateEntry(db, e.id, { dueDay: 'friday' })).rejects.toThrow();
  });

  it('labels: overdue, today, tomorrow, weekday, date', () => {
    const today = '2026-10-21'; // Wednesday
    expect(formatDue('2026-10-19', today)).toEqual({ label: 'Overdue 2 days', tone: 'overdue' });
    expect(formatDue('2026-10-20', today)).toEqual({ label: 'Overdue 1 day', tone: 'overdue' });
    expect(formatDue('2026-10-21', today)).toEqual({ label: 'Due today', tone: 'soon' });
    expect(formatDue('2026-10-22', today)).toEqual({ label: 'Due tomorrow', tone: 'soon' });
    expect(formatDue('2026-10-23', today)).toEqual({ label: 'Due Fri', tone: 'later' });
    expect(formatDue('2026-11-03', today)).toEqual({ label: 'Due 3 Nov', tone: 'later' });
    expect(formatDue('2027-01-05', today).label).toBe('Due 5 Jan 2027');
  });

  it('offers quick choices without duplicates', () => {
    expect(deadlineChoices('2026-10-21').map((c) => `${c.label}:${c.day}`)).toEqual([
      'Today:2026-10-21',
      'Tomorrow:2026-10-22',
      'Friday:2026-10-23',
      'Next Mon:2026-10-26',
      'In a week:2026-10-28',
    ]);
    // On a Monday, "Next Mon" and "In a week" are the same day.
    expect(deadlineChoices('2026-10-26').map((c) => c.label)).toEqual(['Today', 'Tomorrow', 'Friday', 'Next Mon']);
  });

  it('survive a backup, and old data has none', async () => {
    await createEntry(db, { topicId: null, text: 'Report', type: 'next', day: '2026-10-21', dueDay: '2026-10-30' });
    const other = await openMigratedDb();
    await importBackup(other, JSON.parse(JSON.stringify(await buildBackup(db))));
    expect((await listOpenItems(other))[0].dueDay).toBe('2026-10-30');

    const old = openNodeDb();
    await migrate(old, MIGRATIONS.slice(0, 4));
    await old.run("INSERT INTO entries (text, type, day, created_at, updated_at) VALUES ('Old', 'next', '2026-10-01', 1, 1)");
    await migrate(old);
    expect((await getEntry(old, 1))?.dueDay).toBeNull();
  });
});
