export const ENTRY_TYPES = ['done', 'in_progress', 'blocked', 'next', 'on_hold'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  done: 'Done',
  in_progress: 'In progress',
  blocked: 'Blocked',
  next: 'Next',
  on_hold: 'On hold',
};

/**
 * Types that close a job: it leaves the to-do list and lands on the day it was closed.
 * On hold is finished like Done, just not a satisfying finish (dropped, not needed, parked for good).
 */
export const CLOSING_TYPES: EntryType[] = ['done', 'blocked', 'on_hold'];

/** Local calendar date, formatted 'YYYY-MM-DD'. */
export type DayKey = string;

export interface Topic {
  id: number;
  name: string;
  color: string;
  archived: boolean;
  createdAt: number;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Entry {
  id: number;
  topicId: number | null;
  text: string;
  type: EntryType;
  durationMinutes: number | null;
  day: DayKey;
  createdAt: number;
  updatedAt: number;
  carriedFromId: number | null;
  tags: string[];
  /** Starred: important to its project; highlighted on the topic page and in summaries. */
  starred: boolean;
  /** Optional deadline for open work; nearest first on the to-do list. */
  dueDay: DayKey | null;
}

export interface NewEntry {
  topicId: number | null;
  text: string;
  type?: EntryType;
  durationMinutes?: number | null;
  /** Defaults to the local day of `createdAt`. */
  day?: DayKey;
  createdAt?: number;
  carriedFromId?: number | null;
  tags?: string[];
  starred?: boolean;
  dueDay?: DayKey | null;
}

export type EntryPatch = Partial<
  Pick<Entry, 'topicId' | 'text' | 'type' | 'durationMinutes' | 'day' | 'tags' | 'starred' | 'dueDay'>
>;
