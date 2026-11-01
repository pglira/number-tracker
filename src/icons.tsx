// Line icons on a 24 × 24 grid with one stroke width and square ends, so that
// all icons have the same weight. The icons use the current text color.
const PATHS = {
  plus: 'M12 5v14M5 12h14',
  auto: 'M12 4a8 8 0 0 1 0 16a8 8 0 0 1 0-16zM12 4v16',
  sun: 'M12 8a4 4 0 0 1 0 8a4 4 0 0 1 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  moon: 'M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10z',
  back: 'M15 5l-7 7 7 7',
  edit: 'M4 20v-4L15 5l4 4L8 20zM12 8l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  line: 'M4 4v16h16M7 15l4-4 3 3 5-6',
  bar: 'M4 4v16h16M8 16v-4M12 16V8M16 16v-6',
  check: 'M5 12l5 5L19 7',
  sort: 'M8 4v16M4 16l4 4 4-4M16 20V4M12 8l4-4 4 4',
  grip: 'M4 8h16M4 12h16M4 16h16',
  backup: 'M4 5h16v4H4zM5 9v10h14V9M10 13h4',
  download: 'M12 4v11M7 10l5 5l5-5M4 20h16',
  upload: 'M12 15V4M7 9l5-5l5 5M4 20h16',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="svg-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
