import { useLayoutEffect, useRef, useState } from 'react';
import { type ChartType, DAY, type Entry, bins, formatValue } from './data';

interface ChartProps {
  type: ChartType;
  color: string;
  // Entries of one tracker, oldest first.
  entries: Entry[];
  from: number;
  to: number;
  height: number;
  // Show the value scale and the dates of the range.
  axes?: boolean;
}

// Space for the labels of the axes, in pixels.
const LABEL_W = 44;
const LABEL_H = 18;
const PAD = 6;

const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: '2-digit' });

// The width of an element, updated when the element changes size.
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current!;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

// A line chart of the single values, or a bar chart of the sums per day (per
// month for long ranges). The value scale of a bar chart starts at 0.
export function Chart({ type, color, entries, from, to, height, axes = false }: ChartProps) {
  const [ref, width] = useWidth();
  const left = PAD;
  const right = width - (axes ? LABEL_W : PAD);
  const top = PAD;
  const bottom = height - (axes ? LABEL_H : PAD);

  const shown = entries.filter((e) => e.time >= from && e.time <= to);
  const barBins = type === 'bar' ? bins(entries, from, to) : [];
  const values = type === 'bar' ? barBins.map((b) => b.sum) : shown.map((e) => e.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (type === 'bar') {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (!(max > min)) {
    min -= 1;
    max += 1;
  }

  const x = (time: number) => left + ((time - from) / (to - from)) * (right - left);
  const y = (value: number) => bottom - ((value - min) / (max - min)) * (bottom - top);
  const empty = shown.length === 0;
  const dates = to - from > 300 * DAY ? longDate : shortDate;

  return (
    <div ref={ref} className="chart" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} aria-hidden="true">
          {axes && (
            <g className="grid">
              <line x1={left} x2={right} y1={top} y2={top} />
              <line x1={left} x2={right} y1={bottom} y2={bottom} />
            </g>
          )}
          {type === 'line' && !empty && (
            <g stroke={color} fill={color}>
              <polyline
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                points={shown.map((e) => `${x(e.time)},${y(e.value)}`).join(' ')}
              />
              {shown.length <= 60 &&
                shown.map((e) => <circle key={e.id} cx={x(e.time)} cy={y(e.value)} r={3} />)}
            </g>
          )}
          {type === 'bar' && !empty && (
            <g fill={color}>
              {barBins.map((b) => {
                const x0 = x(Math.max(b.start, from));
                const x1 = x(Math.min(b.end, to));
                const w = Math.max(1, (x1 - x0) * 0.7);
                const y0 = y(Math.max(0, b.sum));
                const h = Math.abs(y(b.sum) - y(0));
                return b.sum === 0 ? null : (
                  <rect key={b.start} x={(x0 + x1 - w) / 2} y={y0} width={w} height={Math.max(1, h)} />
                );
              })}
            </g>
          )}
          {axes && (
            <g className="labels">
              {!empty && (
                <>
                  <text x={right + 6} y={top} dominantBaseline="hanging">
                    {formatValue(max)}
                  </text>
                  <text x={right + 6} y={bottom}>
                    {formatValue(min)}
                  </text>
                </>
              )}
              <text x={left} y={height - 2}>
                {dates.format(from)}
              </text>
              <text x={right} y={height - 2} textAnchor="end">
                {dates.format(to)}
              </text>
            </g>
          )}
        </svg>
      )}
      {empty && <span className="chart-empty">No values in this time range</span>}
    </div>
  );
}
