// A backup holds the stored data of an app in one JSON file, so that the data
// can move to another device. `data` maps each storage key to its parsed value.
export interface Backup {
  app: string;
  version: 1;
  exported: string;
  data: Record<string, unknown>;
}

// The storage keys for which `isKey` is true.
function storedKeys(isKey: (key: string) => boolean): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null && isKey(key)) keys.push(key);
  }
  return keys.sort();
}

// The parsed JSON value of a stored item, or the raw text when the item is
// not JSON or is a JSON string. A string in the backup is the exact raw text.
function parse(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'string' ? raw : value;
  } catch {
    return raw;
  }
}

export function createBackup(app: string, isKey: (key: string) => boolean): Backup {
  const data: Record<string, unknown> = {};
  for (const key of storedKeys(isKey)) data[key] = parse(localStorage.getItem(key));
  return { app, version: 1, exported: new Date().toISOString(), data };
}

// Give the backup file to the user. Where the browser can share files (for
// example iOS), the share sheet opens, so that the user can save the file or
// send it to another device. Other browsers download the file.
export async function exportBackup(app: string, isKey: (key: string) => boolean): Promise<void> {
  const backup = createBackup(app, isKey);
  const date = backup.exported.slice(0, 10);
  const name = `${app}-backup-${date}.json`;
  const text = JSON.stringify(backup, null, 2);
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      // The user closed the share sheet.
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Read a backup file of the app. Throw an Error with a message for the user
// when the file is not a backup of this app.
export function readBackup(text: string, app: string): Backup {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('The file is not a JSON file.');
  }
  const b = value as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || typeof b.data !== 'object' || b.data === null) {
    throw new Error('The file is not a backup file.');
  }
  if (b.app !== app) throw new Error(`The file is a backup of "${b.app ?? 'unknown'}", not of this app.`);
  return b as Backup;
}

// Replace the stored data with the data of the backup. Only keys for which
// `isKey` is true are removed or written.
export function restoreBackup(backup: Backup, isKey: (key: string) => boolean): void {
  for (const key of storedKeys(isKey)) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(backup.data)) {
    if (!isKey(key)) continue;
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
}
