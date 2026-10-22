import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FolderOpen, Music, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { clearFills, getFillNames, importFills, onFillsChanged } from '@/lib/fillLibrary';

/** Settings block: load your own drum fills into this browser. */
export function FillLibrarySettings() {
  const [names, setNames] = useState<string[]>(getFillNames);
  const [busy, setBusy] = useState(false);
  const folderInput = useRef<HTMLInputElement | null>(null);
  const filesInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => onFillsChanged(setNames), []);

  // React has no typed prop for folder selection; set it on the element.
  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
    folderInput.current?.setAttribute('directory', '');
  }, []);

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const count = await importFills(files);
      if (count === 0) toast.error('Geen audiobestanden gevonden');
      else toast.success(`${count} drumfills geladen`);
    } catch (err) {
      console.error('Import fills failed:', err);
      toast.error('Kon de fills niet opslaan');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-2 p-4 bg-stone-50 rounded-lg border">
      <div className="flex items-center gap-2 font-medium text-stone-800">
        <Music className="w-4 h-4" />
        Drumfills bij afvinken
      </div>
      <p className="text-xs text-stone-600">
        {names.length > 0
          ? `${names.length} eigen fills geladen. Bij elke afgevinkte taak speelt er een willekeurige.`
          : 'Nog geen eigen fills: je hoort de ingebouwde fill. Kies een map met WAV- of MP3-bestanden.'}{' '}
        De bestanden blijven in deze browser op dit apparaat.
      </p>
      <input ref={folderInput} type="file" multiple className="hidden" onChange={handlePick} />
      <input ref={filesInput} type="file" multiple accept="audio/*" className="hidden" onChange={handlePick} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => folderInput.current?.click()}>
          <FolderOpen className="w-4 h-4 mr-1" />
          Kies map
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => filesInput.current?.click()}>
          <Music className="w-4 h-4 mr-1" />
          Kies bestanden
        </Button>
        {names.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600"
            disabled={busy}
            onClick={async () => {
              await clearFills();
              toast.success('Eigen fills verwijderd');
            }}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Wissen
          </Button>
        )}
      </div>
    </div>
  );
}
