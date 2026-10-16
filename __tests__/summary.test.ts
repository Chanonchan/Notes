import type { Db } from '../db/client';
import { createEntry, createTopic, setTopicArchived } from '../db';
import {
  buildSummary,
  formatRange,
  formatSummaryText,
  rangeFor,
  shiftRange,
  summarizeWithRules,
  type Summarizer,
} from '../services/summary';
import type { Entry, Topic } from '../types';
import { openMigratedDb } from './helpers/nodeDb';

// 2026-10-05 is a Monday.
const WEEK = rangeFor('week', '2026-10-07');

describe('ranges', () => {
  it('computes Monday–Sunday weeks, months and days', () => {
    expect(WEEK).toEqual({ kind: 'week', from: '2026-10-05', to: '2026-10-11' });
    expect(rangeFor('week', '2026-10-11')).toEqual(WEEK); // Sunday belongs to the same week
    expect(rangeFor('month', '2026-02-14')).toEqual({ kind: 'month', from: '2026-02-01', to: '2026-02-28' });
    expect(rangeFor('day', '2026-10-07')).toEqual({ kind: 'day', from: '2026-10-07', to: '2026-10-07' });
  });

  it('shifts to the previous / next period', () => {
    expect(shiftRange(WEEK, -1)).toEqual({ kind: 'week', from: '2026-09-28', to: '2026-10-04' });
    expect(shiftRange(rangeFor('month', '2026-01-10'), -1)).toEqual({ kind: 'month', from: '2025-12-01', to: '2025-12-31' });
    expect(shiftRange({ kind: 'custom', from: '2026-10-01', to: '2026-10-03' }, 1)).toEqual({
      kind: 'custom',
      from: '2026-10-04',
      to: '2026-10-06',
    });
  });

  it('formats range labels', () => {
    expect(formatRange(WEEK)).toBe('Week of Mon 5 Oct – Sun 11 Oct 2026');
    expect(formatRange(rangeFor('month', '2026-10-01'))).toBe('October 2026');
    expect(formatRange(rangeFor('day', '2026-10-12'))).toBe('Mon, 12 Oct 2026');
    expect(formatRange({ kind: 'custom', from: '2025-12-29', to: '2026-01-02' })).toBe('Mon 29 Dec 2025 – Fri 2 Jan 2026');
  });
});

describe('rule-based summary', () => {
  let db: Db;
  let web: Topic;
  let hiring: Topic;
  let infra: Topic;

  const add = (topic: Topic | null, text: string, day: string, type: Entry['type'] = 'done', durationMinutes: number | null = null, hour = 10) =>
    createEntry(db, {
      topicId: topic?.id ?? null,
      text,
      day,
      type,
      durationMinutes,
      createdAt: new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8)), hour).getTime(),
    });

  beforeEach(async () => {
    db = await openMigratedDb();
    web = await createTopic(db, 'Website redesign');
    hiring = await createTopic(db, 'Hiring');
    infra = await createTopic(db, 'Infra');
    const old = await createTopic(db, 'Old project');
    await setTopicArchived(db, old.id, true);
    // Topics created "now" would count as created after the range; backdate them.
    await db.run('UPDATE topics SET created_at = 0');

    await add(web, 'Hero layout', '2026-10-05', 'done', 90);
    await add(web, 'Navbar fixes', '2026-10-05', 'done', 30, 11);
    await add(web, 'API keys from vendor', '2026-10-07', 'blocked', null);
    await add(web, 'Footer', '2026-10-07', 'in_progress', 90, 12);
    await add(hiring, 'Interview candidate', '2026-10-06', 'done', 60);
    await add(hiring, 'Send offer', '2026-10-06', 'next', null, 11);
    await add(null, 'Expense report', '2026-10-08', 'done', 15);
    await add(web, 'Out of range', '2026-10-12', 'done', 600);
  });

  it('groups by topic with counts, days and time, busiest first', async () => {
    const s = await buildSummary(db, WEEK);
    expect(s.totals).toEqual({ entries: 7, minutes: 285, days: 4, topics: 2 });
    expect(s.topics.map((t) => t.topic?.name ?? null)).toEqual(['Website redesign', 'Hiring', null]);

    const w = s.topics[0];
    expect(w.entryCount).toBe(4);
    expect(w.days).toEqual(['2026-10-05', '2026-10-07']);
    expect(w.totalMinutes).toBe(210);
    expect(w.counts).toEqual({ done: 2, in_progress: 1, blocked: 1, next: 0, on_hold: 0 });
    expect(w.items.done).toEqual(['Hero layout', 'Navbar fixes']);
    // Each item links back to its entry (for tap-to-edit).
    const ids = w.itemIds.done;
    expect(ids).toHaveLength(2);
    expect((await db.get<{ text: string }>('SELECT text FROM entries WHERE id = ?', [ids[1]]))?.text).toBe('Navbar fixes');
  });

  it('lists active topics not touched in the range, excluding archived ones', async () => {
    const s = await buildSummary(db, WEEK);
    expect(s.untouched.map((t) => t.name)).toEqual(['Infra']);
    expect(s.untouched[0].id).toBe(infra.id);
  });

  it('lists open items (in progress, then planned) and blocked separately', async () => {
    const s = await buildSummary(db, WEEK);
    expect(s.openItems.map((o) => [o.entry.type, o.entry.text])).toEqual([
      ['in_progress', 'Footer'],
      ['next', 'Send offer'],
    ]);
    expect(s.blocked.map((o) => [o.entry.text, o.topic?.name])).toEqual([['API keys from vendor', 'Website redesign']]);
  });

  it('lists On hold with the finished work in its topic, not as open', async () => {
    await add(web, 'CMS migration', '2026-10-08', 'on_hold');
    const s = await buildSummary(db, WEEK);
    expect(s.topics[0].items.on_hold).toEqual(['CMS migration']);
    expect(s.openItems.map((o) => o.entry.text)).not.toContain('CMS migration');
    expect(formatSummaryText(s)).toContain('  • Done (2): Hero layout; Navbar fixes\n  • On hold: CMS migration\n  • In progress: Footer');
  });

  it('drops open items later marked Done with the same text, or carried over', async () => {
    await add(web, 'footer', '2026-10-09', 'done'); // same text, different case
    const offer = (await buildSummary(db, WEEK)).openItems.find((o) => o.entry.text === 'Send offer')!;
    await createEntry(db, { topicId: hiring.id, text: 'Send offer', day: '2026-10-09', type: 'next', carriedFromId: offer.entry.id });
    const s = await buildSummary(db, WEEK);
    const texts = s.openItems.map((o) => `${o.entry.text}@${o.entry.day}`);
    expect(texts).not.toContain('Footer@2026-10-07');
    expect(texts).not.toContain('Send offer@2026-10-06');
    expect(texts).toContain('Send offer@2026-10-09');
  });

  it('formats clean plain text', async () => {
    const text = formatSummaryText(await buildSummary(db, WEEK));
    expect(text).toBe(
      [
        'Work summary · Week of Mon 5 Oct – Sun 11 Oct 2026',
        '7 entries · 2 topics · 4 days · 4h 45m',
        '',
        'Website redesign: 4 entries over 2 days (Mon, Wed), 3h 30m',
        '  • Done (2): Hero layout; Navbar fixes',
        '  • In progress: Footer',
        '',
        'Hiring: 2 entries over 1 day (Tue), 1h',
        '  • Done: Interview candidate',
        '  • Next: Send offer',
        '',
        'No topic: 1 entry over 1 day (Thu), 15m',
        '  • Done: Expense report',
        '',
        'Not touched: Infra',
        '',
        'Blocked:',
        '  • API keys from vendor (Website redesign, Wed)',
        '',
        'Still open:',
        '  • [In progress] Footer (Website redesign, Wed)',
        '  • [Next] Send offer (Hiring, Tue)',
      ].join('\n'),
    );
  });

  it('formats a single day without day lists', async () => {
    const text = formatSummaryText(await buildSummary(db, rangeFor('day', '2026-10-06')));
    expect(text.split('\n').slice(0, 4)).toEqual([
      'Work summary · Tue, 6 Oct 2026',
      '2 entries · 1 topic · 1h',
      '',
      'Hiring: 2 entries, 1h',
    ]);
  });

  it('handles an empty range', async () => {
    const s = await buildSummary(db, rangeFor('day', '2026-01-01'));
    expect(s.totals.entries).toBe(0);
    expect(formatSummaryText(s)).toContain('Nothing logged.');
  });

  it('de-duplicates repeated texts within a type', () => {
    const topic = { id: 1, name: 'T', color: '#000', archived: false, createdAt: 0 };
    const mk = (id: number, text: string): Entry => ({
      id, topicId: 1, text, type: 'done', durationMinutes: null, day: '2026-10-05',
      createdAt: id, updatedAt: id, carriedFromId: null, tags: [], starred: false,
    });
    const s = summarizeWithRules({ range: WEEK, entries: [mk(1, 'Standup'), mk(2, 'standup ')], topics: [topic], continuedIds: new Set() });
    expect(s.topics[0].items.done).toEqual(['Standup']);
    expect(s.topics[0].counts.done).toBe(2);
  });

  it('lets another summarizer be plugged in', async () => {
    const fake: Summarizer = {
      id: 'fake',
      summarize: async (input) => ({ ...summarizeWithRules(input), source: 'fake' }),
    };
    expect((await buildSummary(db, WEEK, fake)).source).toBe('fake');
  });
});
