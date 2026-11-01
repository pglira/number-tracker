import { type ChangeEvent, useState } from 'react';
import { type Backup, exportBackup, readBackup, restoreBackup } from './backup';
import { Icon } from './icons';

interface BackupFormProps {
  // The id of the app in the backup file.
  app: string;
  // True for the storage keys that the backup holds.
  isKey: (key: string) => boolean;
  onClose: () => void;
}

// Export all data to a file, or replace all data with the data of a backup
// file. An import needs a second tap to replace the data. After the import,
// the app reloads with the new data.
export function BackupForm({ app, isKey, onClose }: BackupFormProps) {
  const [backup, setBackup] = useState<Backup | null>(null);
  const [error, setError] = useState('');

  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input so that the same file can be selected again.
    e.target.value = '';
    if (!file) return;
    try {
      setBackup(readBackup(await file.text(), app));
      setError('');
    } catch (err) {
      setBackup(null);
      setError(err instanceof Error ? err.message : 'The file cannot be read.');
    }
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <form
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        onSubmit={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        <h2>Backup</h2>
        <p className="backup-hint">Export all data to a file. Import the file on the new phone.</p>
        <div className="backup-buttons">
          <button type="button" onClick={() => exportBackup(app, isKey)}>
            <Icon name="download" size={18} />
            Export
          </button>
          <label>
            <Icon name="upload" size={18} />
            Import
            <input type="file" accept="application/json,.json" hidden onChange={importFile} />
          </label>
        </div>
        {error && <p className="backup-error">{error}</p>}
        {backup && (
          <button
            type="button"
            className="backup-replace"
            onClick={() => {
              restoreBackup(backup, isKey);
              location.reload();
            }}
          >
            Tap to replace all data
            <small>Backup of {new Date(backup.exported).toLocaleString()}</small>
          </button>
        )}
        <div className="buttons">
          <button type="submit" className="primary">
            Close
          </button>
        </div>
      </form>
    </div>
  );
}
