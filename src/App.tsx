import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Chart } from './Chart';
import {
  COLORS,
  type ChartType,
  DAY,
  type Data,
  type Entry,
  RANGES,
  type RangeKey,
  type Tracker,
  entriesOf,
  formatValue,
  fromInputTime,
  loadData,
  moveTracker,
  nextColor,
  parseValue,
  rangeOf,
  removeEntry,
  removeTracker,
  saveData,
  saveEntry,
  saveTracker,
  toInputTime,
  todayTotal,
} from './data';
import { Icon, type IconName } from './icons';
import { type Theme, useTheme } from './theme';

const THEME_ICONS: Record<Theme, IconName> = { auto: 'auto', light: 'sun', dark: 'moon' };
const THEME_LABELS: Record<Theme, string> = {
  auto: 'Theme: system',
  light: 'Theme: light',
  dark: 'Theme: dark',
};

// The open sheet: a tracker form or an entry form. An id of null makes a new
// tracker or entry.
type Sheet =
  | { kind: 'tracker'; id: string | null }
  | { kind: 'entry'; trackerId: string; id: string | null }
  | null;

// The URL hash '#/<tracker id>' shows the page of one tracker, so that the
// back button of the browser returns to the start page.
function useRoute(): [string | null, (id: string | null) => void] {
  const read = () => decodeURIComponent(location.hash.replace(/^#\/?/, '')) || null;
  const [id, setId] = useState(read);
  useEffect(() => {
    const onChange = () => setId(read());
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);
  const go = (next: string | null) => {
    if (next === null && history.state?.tracker) history.back();
    else if (next === null) location.hash = '';
    else {
      history.pushState({ tracker: true }, '', `#/${encodeURIComponent(next)}`);
      setId(next);
    }
  };
  return [id, go];
}

export default function App() {
  const [data, setData] = useState<Data>(loadData);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [route, go] = useRoute();
  const [theme, nextTheme] = useTheme();

  useEffect(() => saveData(data), [data]);

  const close = () => setSheet(null);
  const tracker = data.trackers.find((t) => t.id === route);
  const sheetTracker =
    sheet?.kind === 'tracker'
      ? data.trackers.find((t) => t.id === sheet.id)
      : sheet?.kind === 'entry'
        ? data.trackers.find((t) => t.id === sheet.trackerId)
        : undefined;
  const sheetEntry =
    sheet?.kind === 'entry' && sheet.id !== null ? data.entries.find((e) => e.id === sheet.id) : undefined;

  const themeButton = (
    <button className="icon" onClick={nextTheme} aria-label={THEME_LABELS[theme]} title={THEME_LABELS[theme]}>
      <Icon name={THEME_ICONS[theme]} />
    </button>
  );

  return (
    <main>
      {tracker ? (
        <TrackerPage
          tracker={tracker}
          entries={entriesOf(data, tracker.id)}
          themeButton={themeButton}
          onBack={() => go(null)}
          onEdit={() => setSheet({ kind: 'tracker', id: tracker.id })}
          onAdd={() => setSheet({ kind: 'entry', trackerId: tracker.id, id: null })}
          onEditEntry={(id) => setSheet({ kind: 'entry', trackerId: tracker.id, id })}
          onDeleteEntry={(id) => setData((d) => removeEntry(d, id))}
        />
      ) : (
        <StartPage
          data={data}
          themeButton={themeButton}
          onOpen={go}
          onNew={() => setSheet({ kind: 'tracker', id: null })}
          onAdd={(trackerId) => setSheet({ kind: 'entry', trackerId, id: null })}
          onEdit={(id) => setSheet({ kind: 'tracker', id })}
          onDelete={(id) => setData((d) => removeTracker(d, id))}
          onMove={(from, to) => setData((d) => moveTracker(d, from, to))}
        />
      )}

      {sheet?.kind === 'tracker' && (
        <TrackerForm
          key={sheet.id ?? 'new'}
          tracker={sheetTracker}
          color={nextColor(data.trackers)}
          onCancel={close}
          onSave={(t) => {
            setData((d) => saveTracker(d, t, sheet.id));
            close();
          }}
          onDelete={
            sheetTracker
              ? () => {
                  setData((d) => removeTracker(d, sheetTracker.id));
                  close();
                  if (route === sheetTracker.id) go(null);
                }
              : undefined
          }
        />
      )}

      {sheet?.kind === 'entry' && sheetTracker && (
        <EntryForm
          key={sheet.id ?? 'new'}
          tracker={sheetTracker}
          entry={sheetEntry}
          onCancel={close}
          onSave={(time, value) => {
            setData((d) => saveEntry(d, { trackerId: sheetTracker.id, time, value }, sheet.id));
            close();
          }}
          onDelete={
            sheetEntry
              ? () => {
                  setData((d) => removeEntry(d, sheetEntry.id));
                  close();
                }
              : undefined
          }
        />
      )}
    </main>
  );
}

interface StartPageProps {
  data: Data;
  themeButton: ReactNode;
  onOpen: (id: string) => void;
  onNew: () => void;
  onAdd: (trackerId: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (from: number, to: number) => void;
}

// All trackers, each with its current value and a chart of the last 30 days.
// The order button shows the trackers with drag handles to change their order.
function StartPage({ data, themeButton, onOpen, onNew, onAdd, onEdit, onDelete, onMove }: StartPageProps) {
  // The id of the tracker whose row shows the swipe actions.
  const [swiped, setSwiped] = useState<string | null>(null);
  // True while the list shows drag handles to change the order of the trackers.
  const [reorder, setReorder] = useState(false);
  const now = Date.now();
  const reordering = reorder && data.trackers.length > 1;

  return (
    <>
      <header>
        <h1>Numbers</h1>
        <div className="header-buttons">
          {data.trackers.length > 1 && (
            <button
              className={reordering ? 'icon active' : 'icon'}
              onClick={() => {
                setSwiped(null);
                setReorder(!reordering);
              }}
              aria-pressed={reordering}
              aria-label="Change order"
              title="Change order"
            >
              <Icon name={reordering ? 'check' : 'sort'} />
            </button>
          )}
          {themeButton}
          <button className="add" onClick={onNew} aria-label="New tracker" title="New tracker">
            <Icon name="plus" size={24} />
          </button>
        </div>
      </header>

      {data.trackers.length === 0 && (
        <p className="empty">No trackers. Tap + to track a number, for example your weight.</p>
      )}

      {reordering ? (
        <ReorderList data={data} now={now} onMove={onMove} />
      ) : (
        <ul>
          {data.trackers.map((tracker) => {
            const entries = entriesOf(data, tracker.id);
            const [from, to] = rangeOf('month', entries, now);
            return (
              <SwipeRow
                key={tracker.id}
                className="card"
                style={{ '--color': tracker.color } as CSSProperties}
                confirmDelete
                open={swiped === tracker.id}
                onOpen={() => setSwiped(tracker.id)}
                onClose={() => setSwiped(null)}
                onEdit={() => {
                  setSwiped(null);
                  onEdit(tracker.id);
                }}
                onDelete={() => {
                  setSwiped(null);
                  onDelete(tracker.id);
                }}
              >
                <div className="card-head">
                  <button className="info" onClick={() => onOpen(tracker.id)} aria-label={`Open ${tracker.name}`}>
                    <span className="name">{tracker.name}</span>
                    <Headline tracker={tracker} entries={entries} now={now} />
                  </button>
                  <button
                    className="add add-value"
                    onClick={() => onAdd(tracker.id)}
                    aria-label={`Add a value to ${tracker.name}`}
                    title="Add value"
                  >
                    <Icon name="plus" size={24} />
                  </button>
                </div>
                <button className="chart-button" onClick={() => onOpen(tracker.id)} tabIndex={-1} aria-hidden="true">
                  <Chart type={tracker.chart} color={tracker.color} entries={entries} from={from} to={to} height={72} />
                </button>
              </SwipeRow>
            );
          })}
        </ul>
      )}
    </>
  );
}

interface ReorderListProps {
  data: Data;
  now: number;
  onMove: (from: number, to: number) => void;
}

// The trackers with a drag handle on each row. Drag a handle up or down to move
// the tracker. The arrow keys move the tracker of the focused handle.
function ReorderList({ data, now, onMove }: ReorderListProps) {
  const trackers = data.trackers;
  // The dragged tracker, the pointer position at which its row is at rest, and
  // the current pointer position.
  const [drag, setDrag] = useState<{ id: string; origin: number; y: number } | null>(null);
  const rows = useRef<HTMLUListElement>(null);

  // The distance between the tops of two rows in pixels.
  const step = () => {
    const ul = rows.current;
    const li = ul?.firstElementChild as HTMLElement | null;
    if (!ul || !li) return 1;
    return li.offsetHeight + parseFloat(getComputedStyle(ul).rowGap || '0');
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    const index = trackers.findIndex((t) => t.id === drag.id);
    const s = step();
    let origin = drag.origin;
    let to = index;
    while (e.clientY - origin > s / 2 && to < trackers.length - 1) {
      origin += s;
      to++;
    }
    while (e.clientY - origin < -s / 2 && to > 0) {
      origin -= s;
      to--;
    }
    if (to !== index) onMove(index, to);
    setDrag({ id: drag.id, origin, y: e.clientY });
  };

  const onKeyDown = (e: ReactKeyboardEvent, index: number) => {
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : -1;
    if (to < 0 || to >= trackers.length) return;
    e.preventDefault();
    onMove(index, to);
  };

  return (
    <ul ref={rows} className="reorder">
      {trackers.map((tracker, index) => {
        const dragged = drag?.id === tracker.id;
        const style = {
          '--color': tracker.color,
          transform: dragged ? `translateY(${drag.y - drag.origin}px)` : undefined,
        } as CSSProperties;
        return (
          <li key={tracker.id} className={`card${dragged ? ' dragged' : ''}`} style={style}>
            <div className="card-head">
              <span className="info">
                <span className="name">{tracker.name}</span>
                <Headline tracker={tracker} entries={entriesOf(data, tracker.id)} now={now} />
              </span>
              <button
                className="handle"
                aria-label={`Move ${tracker.name}`}
                title="Drag to move"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDrag({ id: tracker.id, origin: e.clientY, y: e.clientY });
                }}
                onPointerMove={onPointerMove}
                onPointerUp={() => setDrag(null)}
                onPointerCancel={() => setDrag(null)}
                onKeyDown={(e) => onKeyDown(e, index)}
              >
                <Icon name="grip" size={24} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// The main value of a tracker: the last value for a line chart, the sum of
// today for a bar chart.
function Headline({ tracker, entries, now }: { tracker: Tracker; entries: Entry[]; now: number }) {
  const last = entries.at(-1);
  if (tracker.chart === 'bar') {
    return (
      <span className="value">
        {formatValue(todayTotal(entries, now))}
        <span className="unit"> {tracker.unit}</span>
        <span className="when">today</span>
      </span>
    );
  }
  if (!last) return <span className="value muted">–</span>;
  return (
    <span className="value">
      {formatValue(last.value)}
      <span className="unit"> {tracker.unit}</span>
      <span className="when">{dateTime.format(last.time)}</span>
    </span>
  );
}

interface TrackerPageProps {
  tracker: Tracker;
  entries: Entry[];
  themeButton: ReactNode;
  onBack: () => void;
  onEdit: () => void;
  onAdd: () => void;
  onEditEntry: (id: string) => void;
  onDeleteEntry: (id: string) => void;
}

const RANGE_KEY = 'number-tracker.range';

function loadRange(): RangeKey {
  try {
    const value = localStorage.getItem(RANGE_KEY);
    return RANGES.some((r) => r.key === value) ? (value as RangeKey) : 'month';
  } catch {
    return 'month';
  }
}

// One tracker: a chart for a selectable time range, statistics and all
// entries, newest first.
function TrackerPage(props: TrackerPageProps) {
  const { tracker, entries } = props;
  const [range, setRange] = useState<RangeKey>(loadRange);
  const [swiped, setSwiped] = useState<string | null>(null);
  const now = Date.now();
  const [from, to] = rangeOf(range, entries, now);
  const shown = entries.filter((e) => e.time >= from && e.time <= to);

  useEffect(() => {
    try {
      localStorage.setItem(RANGE_KEY, range);
    } catch {
      // The range stays for this session only.
    }
  }, [range]);

  return (
    <div style={{ '--color': tracker.color } as CSSProperties}>
      <header>
        <div className="title">
          <button className="icon" onClick={props.onBack} aria-label="Back" title="Back">
            <Icon name="back" />
          </button>
          <h1>{tracker.name}</h1>
        </div>
        <div className="header-buttons">
          {props.themeButton}
          <button className="icon" onClick={props.onEdit} aria-label="Edit tracker" title="Edit tracker">
            <Icon name="edit" />
          </button>
          <button className="add add-value" onClick={props.onAdd} aria-label="Add value" title="Add value">
            <Icon name="plus" size={24} />
          </button>
        </div>
      </header>

      <div className="ranges" role="radiogroup" aria-label="Time range">
        {RANGES.map((r) => (
          <button key={r.key} role="radio" aria-checked={r.key === range} onClick={() => setRange(r.key)}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="panel">
        <Chart
          type={tracker.chart}
          color={tracker.color}
          entries={entries}
          from={from}
          to={to}
          height={220}
          axes
        />
      </div>

      <Stats tracker={tracker} entries={shown} from={from} to={to} />

      <h2 className="section">Values</h2>
      {entries.length === 0 && <p className="empty">No values. Tap + to add a value.</p>}
      <ul className="entries">
        {entries
          .slice()
          .reverse()
          .map((entry) => (
            <SwipeRow
              key={entry.id}
              className="entry"
              open={swiped === entry.id}
              onOpen={() => setSwiped(entry.id)}
              onClose={() => setSwiped(null)}
              onEdit={() => {
                setSwiped(null);
                props.onEditEntry(entry.id);
              }}
              onDelete={() => {
                setSwiped(null);
                props.onDeleteEntry(entry.id);
              }}
            >
              <button className="entry-button" onClick={() => props.onEditEntry(entry.id)}>
                <span className="entry-time">{dateTime.format(entry.time)}</span>
                <span className="entry-value">
                  {formatValue(entry.value)}
                  <span className="unit"> {tracker.unit}</span>
                </span>
              </button>
            </SwipeRow>
          ))}
      </ul>
    </div>
  );
}

// Statistics of the values in the time range of the chart.
function Stats({ tracker, entries, from, to }: { tracker: Tracker; entries: Entry[]; from: number; to: number }) {
  if (entries.length === 0) return null;
  const values = entries.map((e) => e.value);
  const sum = values.reduce((a, b) => a + b, 0);
  const days = Math.max(1, Math.round((to - from) / DAY));
  const items: [string, number][] =
    tracker.chart === 'bar'
      ? [
          ['Total', sum],
          ['Per day', sum / days],
          ['Values', values.length],
        ]
      : [
          ['Change', values[values.length - 1] - values[0]],
          ['Min', Math.min(...values)],
          ['Max', Math.max(...values)],
          ['Average', sum / values.length],
        ];
  return (
    <dl className="stats">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            {label === 'Change' && value > 0 ? '+' : ''}
            {formatValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Width of the swipe actions in pixels, and the distance a pointer must move
// before a row starts to follow it.
const SWIPE_WIDTH = 160;
const SWIPE_SLOP = 10;

interface SwipeRowProps {
  className: string;
  style?: CSSProperties;
  // Ask for a second tap before the delete.
  confirmDelete?: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  children: ReactNode;
}

// A list row that shows the Edit and Delete actions when the user swipes it
// to the left. A swipe to the right, a tap on the row or a tap outside the row
// hides the actions. A tap that ends a swipe does not reach the row content.
function SwipeRow(props: SwipeRowProps) {
  const { className, style, open, onOpen, onClose, children } = props;
  const row = useRef<HTMLLIElement>(null);
  const gesture = useRef<{ x: number; y: number; swiping: boolean } | null>(null);
  const swiped = useRef(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [armed, setArmed] = useState(false);
  const base = open ? -SWIPE_WIDTH : 0;
  const offset = drag ?? base;

  useEffect(() => {
    if (!open) {
      setArmed(false);
      return;
    }
    const onDown = (e: globalThis.PointerEvent) => {
      if (!row.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, onClose]);

  const position = (e: PointerEvent) =>
    Math.min(0, Math.max(-SWIPE_WIDTH, base + e.clientX - gesture.current!.x));

  const onPointerDown = (e: PointerEvent) => {
    gesture.current = { x: e.clientX, y: e.clientY, swiping: false };
    swiped.current = false;
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (!g.swiping) {
      const dx = Math.abs(e.clientX - g.x);
      const dy = Math.abs(e.clientY - g.y);
      if (dy > SWIPE_SLOP && dy > dx) gesture.current = null;
      if (dx <= SWIPE_SLOP || dx <= dy) return;
      g.swiping = true;
      swiped.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDrag(position(e));
  };

  const onPointerUp = (e: PointerEvent) => {
    if (gesture.current?.swiping) {
      if (position(e) < -SWIPE_WIDTH / 2) onOpen();
      else onClose();
    }
    gesture.current = null;
    setDrag(null);
  };

  return (
    <li ref={row} className="swipe">
      <div className="swipe-actions" style={{ width: SWIPE_WIDTH }} aria-hidden={!open}>
        <button className="swipe-edit" tabIndex={open ? 0 : -1} onClick={props.onEdit}>
          <Icon name="edit" />
          Edit
        </button>
        <button
          className="swipe-delete"
          tabIndex={open ? 0 : -1}
          onClick={() => (props.confirmDelete && !armed ? setArmed(true) : props.onDelete())}
        >
          <Icon name="trash" />
          {armed ? 'Confirm' : 'Delete'}
        </button>
      </div>
      <div
        className={drag === null ? `${className} settle` : className}
        style={{ ...style, transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          gesture.current = null;
          setDrag(null);
        }}
        onClickCapture={(e) => {
          if (!swiped.current && !open) return;
          e.preventDefault();
          e.stopPropagation();
          if (!swiped.current) onClose();
          swiped.current = false;
        }}
      >
        {children}
      </div>
    </li>
  );
}

function SheetFrame(props: {
  title: string;
  onCancel: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.onCancel]);

  return (
    <div className="backdrop" onClick={props.onCancel}>
      <form
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          props.onSubmit();
        }}
      >
        <h2>{props.title}</h2>
        {props.children}
      </form>
    </div>
  );
}

// A Delete button that asks for a second tap.
function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button type="button" className="delete" onClick={() => (armed ? onDelete() : setArmed(true))}>
      {armed ? 'Tap to delete' : 'Delete'}
    </button>
  );
}

interface EntryFormProps {
  tracker: Tracker;
  entry?: Entry;
  onSave: (time: number, value: number) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

// Enter a value and its time. The time of a new value is the current time.
function EntryForm({ tracker, entry, onSave, onCancel, onDelete }: EntryFormProps) {
  const [text, setText] = useState(entry ? String(entry.value) : '');
  const [time, setTime] = useState(() => toInputTime(entry?.time ?? Date.now()));
  const value = parseValue(text);
  const timeValue = fromInputTime(time);
  const valid = value !== null && timeValue !== null;

  return (
    <SheetFrame
      title={tracker.name}
      onCancel={onCancel}
      onSubmit={() => valid && onSave(timeValue, value)}
    >
      <label>
        Value
        <div className="value-input">
          <input
            autoFocus
            inputMode="decimal"
            enterKeyHint="done"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="0"
          />
          {tracker.unit && <span className="unit">{tracker.unit}</span>}
        </div>
      </label>
      <label>
        Time
        <div className="time-input">
          <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
          <button type="button" onClick={() => setTime(toInputTime(Date.now()))}>
            Now
          </button>
        </div>
      </label>
      <div className="buttons">
        {onDelete && <DeleteButton onDelete={onDelete} />}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={!valid}>
          Save
        </button>
      </div>
    </SheetFrame>
  );
}

interface TrackerFormProps {
  tracker?: Tracker;
  // The color of a new tracker.
  color: string;
  onSave: (tracker: Omit<Tracker, 'id'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const CHART_TYPES: { type: ChartType; label: string; icon: IconName }[] = [
  { type: 'line', label: 'Line: each value', icon: 'line' },
  { type: 'bar', label: 'Bars: sum per day', icon: 'bar' },
];

function TrackerForm(props: TrackerFormProps) {
  const [name, setName] = useState(props.tracker?.name ?? '');
  const [unit, setUnit] = useState(props.tracker?.unit ?? '');
  const [chart, setChart] = useState<ChartType>(props.tracker?.chart ?? 'line');
  const [color, setColor] = useState(props.tracker?.color ?? props.color);

  return (
    <SheetFrame
      title={props.tracker ? 'Edit tracker' : 'New tracker'}
      onCancel={props.onCancel}
      onSubmit={() => props.onSave({ name: name.trim() || 'Number', unit: unit.trim(), chart, color })}
    >
      <div className="row">
        <label className="grow">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Number" />
        </label>
        <label className="narrow">
          Unit
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg" />
        </label>
      </div>
      <div className="segmented" role="radiogroup" aria-label="Chart">
        {CHART_TYPES.map((c) => (
          <button
            key={c.type}
            type="button"
            role="radio"
            aria-checked={c.type === chart}
            onClick={() => setChart(c.type)}
          >
            <Icon name={c.icon} />
            {c.label}
          </button>
        ))}
      </div>
      <div className="colors" role="radiogroup" aria-label="Color">
        {COLORS.map((c, i) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === color}
            aria-label={`Color ${i + 1}`}
            className="swatch"
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <div className="buttons">
        {props.onDelete && <DeleteButton onDelete={props.onDelete} />}
        <button type="button" onClick={props.onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary">
          Save
        </button>
      </div>
    </SheetFrame>
  );
}
