const UPLOAD_KEY = 'ceriga_print_upload_library';
const FONT_KEY = 'ceriga_print_font_library';
const MAX_UPLOADS = 16;
const MAX_UPLOAD_BYTES = 1_600_000;

export interface SavedUpload {
  id: string;
  name: string;
  dataUrl: string;
}

export interface SavedFont {
  family: string;
  mime: string;
  dataUrl: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadUploadLibrary(): SavedUpload[] {
  if (typeof window === 'undefined') return [];
  const list = readJson<SavedUpload[]>(UPLOAD_KEY, []);
  return Array.isArray(list) ? list.filter((item) => item?.dataUrl) : [];
}

export function saveUploadToLibrary(name: string, dataUrl: string): SavedUpload[] {
  const list = loadUploadLibrary().filter((item) => item.dataUrl !== dataUrl);
  if (dataUrl.length > MAX_UPLOAD_BYTES) return list;
  const next: SavedUpload = {
    id: `up-${Date.now()}`,
    name: name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Artwork',
    dataUrl,
  };
  const merged = [next, ...list].slice(0, MAX_UPLOADS);
  try {
    localStorage.setItem(UPLOAD_KEY, JSON.stringify(merged));
  } catch {
    /* quota */
  }
  return merged;
}

export function loadFontLibrary(): SavedFont[] {
  if (typeof window === 'undefined') return [];
  const list = readJson<SavedFont[]>(FONT_KEY, []);
  return Array.isArray(list) ? list.filter((item) => item?.family && item?.dataUrl) : [];
}

export async function hydrateFontLibrary(): Promise<string[]> {
  const fonts = loadFontLibrary();
  const names: string[] = [];
  for (const font of fonts) {
    try {
      const face = new FontFace(font.family, `url(${font.dataUrl})`);
      await face.load();
      document.fonts.add(face);
      names.push(font.family);
    } catch {
      /* skip broken face */
    }
  }
  return names;
}

export async function saveFontToLibrary(file: File): Promise<string | null> {
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[^\w\s-]+/g, '') || 'Font';
  const family = `Custom ${base}`.slice(0, 40);
  const unique = `${family}-${Date.now().toString(36)}`;
  try {
    const buf = await file.arrayBuffer();
    const face = new FontFace(unique, buf);
    await face.load();
    document.fonts.add(face);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(file);
    });
    if (dataUrl.length < 2_400_000) {
      const list = loadFontLibrary().filter((item) => item.family !== unique);
      list.unshift({ family: unique, mime: file.type || 'font/ttf', dataUrl });
      localStorage.setItem(FONT_KEY, JSON.stringify(list.slice(0, 24)));
    }
    return unique;
  } catch {
    return null;
  }
}
