export const ENTRY_TYPES = ['done', 'in_progress', 'blocked', 'next'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  done: 'Done',
  in_progress: 'In progress',
  blocked: 'Blocked',
  next: 'Next',
};

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
}

export type EntryPatch = Partial<
  Pick<Entry, 'topicId' | 'text' | 'type' | 'durationMinutes' | 'day' | 'tags'>
>;
