import type { Db } from '../db/client';
import { addProgressNote, createEntry, createTopic, getEntry, listOpenItems, setStatus } from '../db';
import { openMigratedDb } from './helpers/nodeDb';

let db: Db;
beforeEach(async () => {
  db = await openMigratedDb();
});

describe('to-do list', () => {
  it('keeps open jobs from any day, in progress first, never expiring; blocked is not a to-do', async () => {
    const web = await createTopic(db, 'Website');
    await createEntry(db, { topicId: web.id, text: 'Plan launch', type: 'next', day: '2026-09-01' });
    await createEntry(db, { topicId: web.id, text: 'Build API', type: 'in_progress', day: '2026-10-01' });
    await createEntry(db, { topicId: web.id, text: 'Waiting on keys', type: 'blocked', day: '2026-10-10' });
    await createEntry(db, { topicId: web.id, text: 'Shipped hotfix', type: 'done', day: '2026-10-14' });
    expect((await listOpenItems(db)).map((e) => e.text)).toEqual(['Build API', 'Plan launch']);
  });

  it('finishing a job moves it to the day it was finished', async () => {
    const e = await createEntry(db, { topicId: null, text: 'Build API', type: 'in_progress', day: '2026-10-01' });
    const done = await setStatus(db, e.id, 'done', '2026-10-15');
    expect(done).toMatchObject({ type: 'done', day: '2026-10-15' });
    expect(await listOpenItems(db)).toHaveLength(0);
  });

  it('starting a planned job keeps its day', async () => {
    const e = await createEntry(db, { topicId: null, text: 'Plan launch', type: 'next', day: '2026-10-01' });
    expect(await setStatus(db, e.id, 'in_progress', '2026-10-15')).toMatchObject({ type: 'in_progress', day: '2026-10-01' });
  });

  it('blocking closes a job like Done: logged on the day it was blocked, off the to-do list', async () => {
    const e = await createEntry(db, { topicId: null, text: 'Ship release', type: 'in_progress', day: '2026-10-01' });
    expect(await setStatus(db, e.id, 'blocked', '2026-10-15')).toMatchObject({ type: 'blocked', day: '2026-10-15' });
    expect(await listOpenItems(db)).toHaveLength(0);
  });

  it('a progress note is logged today and leaves the job open', async () => {
    const t = await createTopic(db, 'Infra');
    const job = await createEntry(db, { topicId: t.id, text: 'Migrate DB', type: 'in_progress', day: '2026-10-01' });
    const note = await addProgressNote(db, job, 'Moved 3 of 5 tables', '2026-10-15');
    expect(note).toMatchObject({ type: 'done', day: '2026-10-15', topicId: t.id, carriedFromId: job.id });
    expect((await getEntry(db, job.id))?.type).toBe('in_progress');
    expect((await listOpenItems(db)).map((e) => e.text)).toEqual(['Migrate DB']);
  });
});
