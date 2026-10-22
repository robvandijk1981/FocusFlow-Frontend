/**
 * Local drum-fill library.
 *
 * The user picks a folder (or files) of audio fills once; the files are kept
 * in this browser's IndexedDB and never leave the device. Nothing is bundled
 * with the app or committed to the repo, so licensed samples stay private.
 */

const DB_NAME = 'focusflow-fills';
const STORE = 'fills';
const AUDIO_EXT = /\.(wav|mp3|m4a|aac|aif|aiff|ogg|flac)$/i;

interface StoredFill {
  name: string;
  blob: Blob;
}

let names: string[] = [];
const listeners = new Set<(names: string[]) => void>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'name' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => {
          db.close();
          resolve(req ? req.result : undefined);
        };
        t.onerror = () => {
          db.close();
          reject(t.error);
        };
      }),
  );
}

function setNames(next: string[]) {
  names = [...next].sort();
  listeners.forEach((fn) => fn(names));
}

/** Fill names currently in the library (empty until loaded). */
export function getFillNames(): string[] {
  return names;
}

export function onFillsChanged(fn: (names: string[]) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Replace the library with the audio files from a folder or file picker. */
export async function importFills(files: FileList | File[]): Promise<number> {
  const audio = Array.from(files).filter((f) => AUDIO_EXT.test(f.name) || f.type.startsWith('audio/'));
  if (audio.length === 0) return 0;
  await tx('readwrite', (s) => {
    s.clear();
    for (const f of audio) s.put({ name: f.name, blob: f } satisfies StoredFill);
  });
  decoded.clear();
  setNames(audio.map((f) => f.name));
  return audio.length;
}

export async function clearFills(): Promise<void> {
  await tx('readwrite', (s) => {
    s.clear();
  });
  decoded.clear();
  setNames([]);
}

async function loadBlob(name: string): Promise<Blob | null> {
  const row = (await tx<StoredFill>('readonly', (s) => s.get(name))) as StoredFill | undefined;
  return row?.blob ?? null;
}

// ==================== DECODING & PICKING ====================

const decoded = new Map<string, Promise<AudioBuffer | null>>();

function decode(ac: BaseAudioContext, name: string): Promise<AudioBuffer | null> {
  let p = decoded.get(name);
  if (!p) {
    p = loadBlob(name)
      .then((blob) => (blob ? blob.arrayBuffer() : null))
      .then((buf) => (buf ? ac.decodeAudioData(buf) : null))
      .catch((err) => {
        console.warn('Could not decode fill', name, err);
        decoded.delete(name);
        return null;
      });
    decoded.set(name, p);
    // Keep memory bounded: only hold a handful of decoded fills.
    if (decoded.size > 6) decoded.delete(decoded.keys().next().value as string);
  }
  return p;
}

let lastPlayed: string | null = null;
let nextUp: string | null = null;

function pickRandom(): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  let n: string;
  do {
    n = names[(Math.random() * names.length) | 0];
  } while (n === lastPlayed);
  return n;
}

/** Decode the next fill ahead of time so it starts instantly on the next check-off. */
export function prepareNextFill(ac: BaseAudioContext) {
  if (!nextUp || !names.includes(nextUp)) nextUp = pickRandom();
  if (nextUp) void decode(ac, nextUp);
}

/**
 * Play a random fill from the library. Returns its file name, or null when
 * the library is empty (caller falls back to the synthesized fill).
 */
export function playRandomFill(ac: AudioContext, destination: AudioNode): string | null {
  const name = nextUp && names.includes(nextUp) ? nextUp : pickRandom();
  if (!name) return null;
  lastPlayed = name;
  nextUp = null;
  void decode(ac, name).then((buffer) => {
    if (!buffer) return;
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.connect(destination);
    src.start();
    prepareNextFill(ac);
  });
  return name;
}

// Load the index at startup
if (typeof indexedDB !== 'undefined') {
  tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())
    .then((keys) => setNames((keys ?? []).map(String)))
    .catch((err) => console.warn('Fill library unavailable:', err));
}
