import type { Db } from '../db/client';
import {
  continueItems,
  createEntry,
  createTopic,
  dismissCarryOver,
  getCarryOver,
  isEmptySearch,
  markCarryOverPrompted,
  searchEntries,
  shouldPromptCarryOver,
} from '../db';
import type { Entry, Topic } from '../types';
import { openMigratedDb } from './helpers/nodeDb';

let db: Db;
let web: Topic;
let ops: Topic;
const add = (topic: Topic | null, text: string, day: string, type: Entry['type'] = 'done', tags?: string[]) =>
  createEntry(db, { topicId: topic?.id ?? null, text, day, type, tags });

beforeEach(async () => {
  db = await openMigratedDb();
  web = await createTopic(db, 'Website');
  ops = await createTopic(db, 'Ops');
});

describe('search', () => {
  beforeEach(async () => {
    await add(web, 'Fixed login bug on Safari', '2026-10-01');
    await add(web, 'Login page redesign', '2026-10-05', 'in_progress', ['ux']);
    await add(ops, 'Rotate DB passwords', '2026-10-06', 'blocked');
    await add(null, 'Expense report 100% done_ok', '2026-10-07');
  });

  it('matches all words, case-insensitively, newest first', async () => {
    expect((await searchEntries(db, { query: 'login' })).map((e) => e.text)).toEqual([
      'Login page redesign',
      'Fixed login bug on Safari',
    ]);
    expect((await searchEntries(db, { query: 'LOGIN safari' })).map((e) => e.text)).toEqual(['Fixed login bug on Safari']);
  });

  it('matches tags, with or without #', async () => {
    expect((await searchEntries(db, { query: '#ux' })).map((e) => e.text)).toEqual(['Login page redesign']);
    expect((await searchEntries(db, { query: 'ux' })).map((e) => e.text)).toEqual(['Login page redesign']);
  });

  it('treats % and _ literally', async () => {
    expect(await searchEntries(db, { query: '100%' })).toHaveLength(1);
    expect(await searchEntries(db, { query: 'done_ok' })).toHaveLength(1);
    expect(await searchEntries(db, { query: '_' })).toHaveLength(1);
  });

  it('filters by topic, no topic, type and date range', async () => {
    expect(await searchEntries(db, { topicId: web.id })).toHaveLength(2);
    expect((await searchEntries(db, { topicId: null })).map((e) => e.text)).toEqual(['Expense report 100% done_ok']);
    expect((await searchEntries(db, { type: 'blocked' })).map((e) => e.text)).toEqual(['Rotate DB passwords']);
    expect(await searchEntries(db, { from: '2026-10-05', to: '2026-10-06' })).toHaveLength(2);
    expect(await searchEntries(db, { query: 'login', type: 'done', to: '2026-10-03' })).toHaveLength(1);
  });

  it('knows when there is nothing to search', () => {
    expect(isEmptySearch({ query: '  ' })).toBe(true);
    expect(isEmptySearch({ type: 'done' })).toBe(false);
    expect(isEmptySearch({ topicId: null })).toBe(false);
  });
});

describe('carry-over', () => {
  it('offers open items from the last logged day, most urgent first', async () => {
    await add(web, 'Old thing', '2026-10-01', 'next');
    await add(web, 'Shipped it', '2026-10-09', 'done');
    await add(web, 'Write tests', '2026-10-09', 'next');
    await add(ops, 'Waiting on vendor', '2026-10-09', 'blocked');
    await add(web, 'Migrate CSS', '2026-10-09', 'in_progress');

    // Monday after a weekend: Friday (10-09) is the last logged day.
    const c = await getCarryOver(db, '2026-10-12');
    expect(c?.fromDay).toBe('2026-10-09');
    expect(c?.items.map((e) => e.text)).toEqual(['Waiting on vendor', 'Migrate CSS', 'Write tests']);
  });

  it('returns null when nothing is open or the last day is too far back', async () => {
    await add(web, 'Done thing', '2026-10-09', 'done');
    expect(await getCarryOver(db, '2026-10-12')).toBeNull();
    await add(web, 'Ancient', '2026-09-01', 'next');
    expect(await getCarryOver(db, '2026-10-12')).toBeNull();
  });

  it('continues items to today, linked, keeping their type', async () => {
    await add(web, 'Write tests', '2026-10-09', 'next', ['qa']);
    await add(ops, 'Waiting on vendor', '2026-10-09', 'blocked');
    const c = (await getCarryOver(db, '2026-10-12'))!;

    const created = await continueItems(db, c.items, '2026-10-12');
    expect(created.map((e) => [e.text, e.type, e.day])).toEqual([
      ['Waiting on vendor', 'blocked', '2026-10-12'],
      ['Write tests', 'next', '2026-10-12'],
    ]);
    expect(created[1].carriedFromId).toBe(c.items[1].id);
    expect(created[1].tags).toEqual(['qa']);
    expect(created[1].topicId).toBe(web.id);

    // Already continued → nothing left to offer; the prompt stays quiet.
    expect(await getCarryOver(db, '2026-10-12')).toBeNull();
    expect(await shouldPromptCarryOver(db, '2026-10-12')).toBe(false);
  });

  it('treats an item re-logged later with the same text as handled', async () => {
    await add(web, 'Write tests', '2026-10-09', 'in_progress');
    await add(web, 'write tests ', '2026-10-12', 'done');
    expect(await getCarryOver(db, '2026-10-13')).toBeNull();
  });

  it('prompts once a day, and not after "Not today"', async () => {
    await add(web, 'Write tests', '2026-10-09', 'next');
    expect(await shouldPromptCarryOver(db, '2026-10-12')).toBe(true);
    await markCarryOverPrompted(db, '2026-10-12');
    expect(await shouldPromptCarryOver(db, '2026-10-12')).toBe(false);

    expect(await shouldPromptCarryOver(db, '2026-10-13')).toBe(true);
    await dismissCarryOver(db, '2026-10-13');
    expect(await shouldPromptCarryOver(db, '2026-10-13')).toBe(false);
  });
});
