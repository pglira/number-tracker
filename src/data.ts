export type ChartType = 'line' | 'bar';

// A number that the user tracks over time, for example the weight. A line
// chart shows each value. A bar chart shows the sum of the values per day.
export interface Tracker {
  id: string;
  name: string;
  unit: string;
  color: string;
  chart: ChartType;
}

// One value of one tracker at one time (milliseconds since the epoch).
export interface Entry {
  id: string;
  trackerId: string;
  time: number;
  value: number;
}

export interface Data {
  trackers: Tracker[];
  entries: Entry[];
}

const STORAGE_KEY = 'number-tracker.v1';

// Colors that the user can select for a tracker.
export const COLORS = [
  '#43a047',
  '#1e88e5',
  '#8e24aa',
  '#d81b60',
  '#f4511e',
  '#fb8c00',
  '#00897b',
  '#6d4c41',
];

const EMPTY: Data = { trackers: [], entries: [] };

export function loadData(): Data {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Data>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function saveData(data: Data): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage is full or blocked; the data stays in memory only.
  }
}

// Return the first color that no tracker uses, or cycle through COLORS when
// all colors are in use.
export function nextColor(trackers: Tracker[]): string {
  const used = new Set(trackers.map((t) => t.color));
  return COLORS.find((c) => !used.has(c)) ?? COLORS[trackers.length % COLORS.length];
}

export function saveTracker(data: Data, tracker: Omit<Tracker, 'id'>, id: string | null): Data {
  if (id === null) {
    return { ...data, trackers: [...data.trackers, { ...tracker, id: crypto.randomUUID() }] };
  }
  return { ...data, trackers: data.trackers.map((t) => (t.id === id ? { ...tracker, id } : t)) };
}

export function removeTracker(data: Data, id: string): Data {
  return {
    trackers: data.trackers.filter((t) => t.id !== id),
    entries: data.entries.filter((e) => e.trackerId !== id),
  };
}

export function saveEntry(data: Data, entry: Omit<Entry, 'id'>, id: string | null): Data {
  if (id === null) {
    return { ...data, entries: [...data.entries, { ...entry, id: crypto.randomUUID() }] };
  }
  return { ...data, entries: data.entries.map((e) => (e.id === id ? { ...entry, id } : e)) };
}

export function removeEntry(data: Data, id: string): Data {
  return { ...data, entries: data.entries.filter((e) => e.id !== id) };
}

// The entries of a tracker, oldest first.
export function entriesOf(data: Data, trackerId: string): Entry[] {
  return data.entries.filter((e) => e.trackerId === trackerId).sort((a, b) => a.time - b.time);
}

export const DAY = 24 * 60 * 60 * 1000;

export function startOfDay(time: number): number {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function startOfMonth(time: number): number {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

// The start of the next day or month. Local days are not always 24 h long, so
// the calendar fields define the step.
export function nextDay(time: number): number {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

function nextMonth(time: number): number {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}

type Bucket = 'day' | 'month';

// One bar of a bar chart: the sum of the values from start to end.
export interface Bin {
  start: number;
  end: number;
  sum: number;
}

// Sum the entries per day, or per month for ranges longer than MAX_DAY_BINS
// days. The bins cover the full range, also the bins without entries.
const MAX_DAY_BINS = 92;

export function bins(entries: Entry[], from: number, to: number): Bin[] {
  const bucket: Bucket = (to - from) / DAY > MAX_DAY_BINS ? 'month' : 'day';
  const first = bucket === 'day' ? startOfDay(from) : startOfMonth(from);
  const step = bucket === 'day' ? nextDay : nextMonth;
  const result: Bin[] = [];
  for (let start = first; start <= to; start = step(start)) {
    result.push({ start, end: step(start), sum: 0 });
  }
  let i = 0;
  for (const e of entries) {
    if (e.time < first || e.time > to) continue;
    while (i < result.length - 1 && e.time >= result[i].end) i++;
    result[i].sum += e.value;
  }
  return result;
}

// The sum of the values of today.
export function todayTotal(entries: Entry[], now: number): number {
  const start = startOfDay(now);
  const end = nextDay(start);
  return entries.reduce((sum, e) => (e.time >= start && e.time < end ? sum + e.value : sum), 0);
}

export const RANGES = [
  { key: 'week', label: '7 d', days: 7 },
  { key: 'month', label: '30 d', days: 30 },
  { key: 'quarter', label: '90 d', days: 90 },
  { key: 'year', label: '1 y', days: 365 },
  { key: 'all', label: 'All', days: Infinity },
] as const;

export type RangeKey = (typeof RANGES)[number]['key'];

// The time range of a chart. 'all' starts at the first entry. A range always
// ends at the end of the current day, so that today's bar is complete.
export function rangeOf(key: RangeKey, entries: Entry[], now: number): [number, number] {
  const to = nextDay(startOfDay(now)) - 1;
  const days = RANGES.find((r) => r.key === key)!.days;
  if (days === Infinity) {
    return [entries.length > 0 ? startOfDay(Math.min(entries[0].time, now)) : startOfDay(now), to];
  }
  const d = new Date(now);
  return [new Date(d.getFullYear(), d.getMonth(), d.getDate() - days + 1).getTime(), to];
}

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function formatValue(value: number): string {
  return number.format(value);
}

// Parse a number with a point or a comma as the decimal separator. Return null
// for text that is not a number.
export function parseValue(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (clean === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(clean)) return null;
  return Number(clean);
}

const pad = (n: number) => String(n).padStart(2, '0');

// The local time in the format of an <input type="datetime-local">.
export function toInputTime(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromInputTime(text: string): number | null {
  const time = new Date(text).getTime();
  return Number.isNaN(time) ? null : time;
}
