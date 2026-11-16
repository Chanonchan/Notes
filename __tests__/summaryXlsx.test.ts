import { createEntry, createTopic, setTopicTags } from '../db';
import type { Db } from '../db/client';
import { buildXlsx, columnName, crc32, escapeXml, excelDate } from '../services/export/xlsx';
import { buildSummary, formatSummaryXlsx, rangeFor, summaryFilename, summaryToSheets } from '../services/summary';
import type { Entry, Topic } from '../types';
import { openMigratedDb } from './helpers/nodeDb';

/** Reads a stored (uncompressed) zip, checking each entry's CRC. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Map<string, string>();
  const dec = new TextDecoder();
  let pos = 0;
  while (view.getUint32(pos, true) === 0x04034b50) {
    expect(view.getUint16(pos + 8, true)).toBe(0); // stored
    const crc = view.getUint32(pos + 14, true);
    const size = view.getUint32(pos + 18, true);
    const nameLen = view.getUint16(pos + 26, true);
    const extraLen = view.getUint16(pos + 28, true);
    const name = dec.decode(bytes.subarray(pos + 30, pos + 30 + nameLen));
    const data = bytes.subarray(pos + 30 + nameLen + extraLen, pos + 30 + nameLen + extraLen + size);
    expect(crc32(data)).toBe(crc);
    out.set(name, dec.decode(data));
    pos += 30 + nameLen + extraLen + size;
  }
  expect(view.getUint32(pos, true)).toBe(0x02014b50); // central directory follows
  return out;
}

describe('xlsx writer', () => {
  it('helpers', () => {
    expect([0, 25, 26, 51, 52, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA', 'ZZ', 'AAA']);
    expect(excelDate('1900-03-01')).toBe(61);
    expect(excelDate('2026-10-05')).toBe(46300);
    expect(escapeXml('a<b & "c"\u0001')).toBe('a&lt;b &amp; &quot;c&quot;');
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('writes a valid package with typed cells', () => {
    const files = unzip(
      buildXlsx([
        {
          name: 'A/B',
          rows: [[{ value: 'Head', style: 'header' }, 'x & y', 3, { value: 90, style: 'duration' }, { value: '2026-10-05', style: 'date' }, null]],
          widths: [10],
          freezeRows: 1,
        },
        { name: 'a b', rows: [] },
      ]),
    );
    expect([...files.keys()]).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]);
    // Invalid characters replaced; duplicate names (case-insensitive) made unique.
    expect(files.get('xl/workbook.xml')).toContain('<sheet name="A B" sheetId="1"');
    expect(files.get('xl/workbook.xml')).toContain('<sheet name="a b 2" sheetId="2"');
    const sheet = files.get('xl/worksheets/sheet1.xml')!;
    expect(sheet).toContain('<c r="A1" s="2" t="inlineStr"><is><t xml:space="preserve">Head</t></is></c>');
    expect(sheet).toContain('<t xml:space="preserve">x &amp; y</t>');
    expect(sheet).toContain('<c r="C1"><v>3</v></c>');
    expect(sheet).toContain('<c r="D1" s="4"><v>0.0625</v></c>');
    expect(sheet).toContain('<c r="E1" s="5"><v>46300</v></c>');
    expect(sheet).not.toContain('r="F1"');
    expect(sheet).toContain('state="frozen"');
  });
});

describe('summary as Excel', () => {
  let db: Db;
  let web: Topic;

  const add = (topic: Topic | null, text: string, day: string, type: Entry['type'] = 'done', durationMinutes: number | null = null, hour = 10, tags: string[] = []) =>
    createEntry(db, {
      tags,
      topicId: topic?.id ?? null,
      text,
      day,
      type,
      durationMinutes,
      createdAt: new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8)), hour).getTime(),
    });

  beforeEach(async () => {
    db = await openMigratedDb();
    web = await createTopic(db, 'Website');
    await createTopic(db, 'Infra');
    await setTopicTags(db, web.id, ['Client work', 'web']);
    await db.run('UPDATE topics SET created_at = 0');
    await add(web, 'Hero layout', '2026-10-05', 'done', 90, 10, ['ui']);
    await add(web, 'hero layout', '2026-10-06', 'done', null, 9, ['ui', 'design']); // repeat: merged, tags combined
    await add(web, 'API keys', '2026-10-06', 'blocked');
    await add(web, 'Footer', '2026-10-07', 'in_progress', 30, 12);
    await add(web, 'Tests', '2026-10-07', 'next', null, 13, ['qa']);
    await add(web, 'CMS', '2026-10-07', 'on_hold', null, 14);
    await add(null, 'Expenses', '2026-10-08', 'done', 15);
    await db.run("UPDATE entries SET starred = 1 WHERE text = 'Hero layout'");
  });

  it('lists each topic with its items underneath', async () => {
    const s = await buildSummary(db, rangeFor('week', '2026-10-07'));
    const sheets = summaryToSheets(s);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].rows).toEqual([
      [{ value: 'Work summary', style: 'title' }],
      ['Week of Mon 5 Oct – Sun 11 Oct 2026'],
      [],
      [{ value: 'Website', style: 'bold' }, { value: 'Status', style: 'bold' }, { value: 'Tags', style: 'bold' }],
      ['Project tags: Client work, web'],
      ['- Hero layout', 'Done', '#ui #design'],
      ['- CMS', 'On hold', null],
      ['- Footer', 'In progress', null],
      ['- Tests', 'Next', '#qa'],
      ['- API keys', 'Blocked', null],
      [],
      [{ value: 'No topic', style: 'bold' }, { value: 'Status', style: 'bold' }, { value: 'Tags', style: 'bold' }],
      ['- Expenses', 'Done', null],
    ]);

    const files = unzip(formatSummaryXlsx(s));
    expect(files.get('xl/worksheets/sheet1.xml')).toContain('- Hero layout');
    expect(summaryFilename(s)).toBe('daylog-summary-2026-10-05-to-2026-10-11.xlsx');
  });

  it('handles an empty day', async () => {
    const s = await buildSummary(db, rangeFor('day', '2026-10-10'));
    expect(summaryToSheets(s)[0].rows.at(-1)).toEqual(['Nothing logged.']);
    expect(summaryFilename(s)).toBe('daylog-summary-2026-10-10.xlsx');
    expect(() => unzip(formatSummaryXlsx(s))).not.toThrow();
  });
});
