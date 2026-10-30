import {workspaceFonts,importWorkspaceFont,fontWorkspaceScope} from '../../../lib/workspaceFonts';
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
  id?:string;postscriptName?:string;weight?:number;italic?:boolean;
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
  return [...workspaceFonts(),...(fontWorkspaceScope()==='guest'&&Array.isArray(list)?list.filter(item=>item?.family&&item?.dataUrl):[])];
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

export async function saveFontToLibrary(file:File,rightsAccepted=false):Promise<string|null>{const font=await importWorkspaceFont(file,rightsAccepted);return font.family;}
